import {transaction,scope} from './db';
import {claimJob,finishJob,recoverStaleJobs} from './jobs';
import {appendMessage} from './chat-store';
import {HttpError} from './security';
import {transactionalAiReplyHandler, type AiProviderInvoke} from './ai-reply-worker';
import {workspacePrompt} from './workspace-prompt';
import {invokeProvider,invokeProviderDetailed} from './provider-transport';
export type JobHandler=(job:{id:string,workspace_id:string,kind:string,payload:Record<string,unknown>})=>Promise<{receipt:string}>;
/** Explicit tenant assigned by trusted scheduler, never from a public HTTP body. */
export async function runWorkerOnce(workspace:string,handlers:Record<string,JobHandler>){
 const scoped=<T>(fn:Parameters<typeof transaction<T>>[0])=>transaction(async db=>{await scope(db,workspace);return fn(db);});
 const claimed=await scoped(async db=>{
  // Serialize disable and claim, with a single transaction and workspace lock.
  const active=(await db.query("SELECT 1 FROM workspaces WHERE id=$1 AND status='active' FOR SHARE",[workspace])).rowCount;
  if(!active)return {disabled:true,job:null};
  await recoverStaleJobs(db);return {disabled:false,job:await claimJob(db,30,Object.keys(handlers))};
 });
 if(claimed.disabled)return {state:'workspace_disabled'};
 const job=claimed.job;if(!job)return {state:'idle'};
 // External adapters require their own idempotency/receipt protocol before activation.
 if(job.external_effect){await scoped(db=>finishJob(db,job.id,job.lease_token,{state:'failed',code:'EXTERNAL_DELIVERY_DISABLED'}));return {state:'disabled'};}
 const handler=Object.hasOwn(handlers,job.kind)?handlers[job.kind]:undefined;
 if(!handler){await scoped(db=>finishJob(db,job.id,job.lease_token,{state:'failed',code:'HANDLER_UNAVAILABLE'}));return {state:'unavailable'};}
 try{const result=await handler(job);await scoped(db=>finishJob(db,job.id,job.lease_token,{state:'succeeded',receipt:result.receipt}));return {state:'succeeded'};}
 catch(error){if(error instanceof HttpError&&error.code==='STALE_JOB_LEASE')return {state:'lease_expired'};
 // Only read-only web fetch failures are safe to retry automatically.
 if(job.kind==='web.refresh'&&error instanceof HttpError&&['SOURCE_TIMEOUT','SOURCE_FETCH_FAILED'].includes(error.code)){
  try {const outcome=await scoped(db=>finishJob(db,job.id,job.lease_token,{state:'failed',code:error.code}));return {state:outcome.state};}
  catch(settleError){if(settleError instanceof HttpError&&settleError.code==='STALE_JOB_LEASE')return {state:'lease_expired'};throw settleError;}
 }
 // A handler may have committed before throwing; do not automatically repeat it.
 await scoped(db=>finishJob(db,job.id,job.lease_token,{state:'unknown',code:'HANDLER_OUTCOME_UNKNOWN'})).catch(e=>{if(!(e instanceof HttpError&&e.code==='STALE_JOB_LEASE'))throw e;});return {state:'unknown'};}
}


/** Resolve the granted provider in a short scoped transaction; the secret never enters the job. */
export function defaultWorkspaceProviderInvoke(transport:typeof invokeProvider=invokeProvider): AiProviderInvoke {
 return async input => {
 const model=await transaction(async db => {
  await scope(db,input.workspace);
  const previous=(await db.query("SELECT current_setting('app.platform',true) AS enabled")).rows[0]?.enabled||'';
  let model:any;
  try { await db.query("SELECT set_config('app.platform','true',true)"); model=(await db.query("SELECT m.name model,p.adapter,p.base_url,p.secret_ref FROM models m JOIN providers p ON p.id=m.provider_id JOIN model_grants g ON g.model_id=m.id WHERE g.workspace_id=$1 AND g.capability='chat' AND g.active AND (g.expires_at IS NULL OR g.expires_at>clock_timestamp()) AND m.id=$2 AND m.enabled AND p.enabled AND 'chat'=ANY(m.capabilities)",[input.workspace,input.modelId])).rows[0]; }
  finally { await db.query("SELECT set_config('app.platform',$1,true)",[previous]); }
  if(!model)throw new HttpError(409,'AI_MODEL_REVOKED');
  return model;
 });
  if(model.adapter==='local')throw new HttpError(409,'PROVIDER_NOT_CONFIGURED');
  const secret=process.env[model.secret_ref];if(!secret)throw new HttpError(409,'PROVIDER_SECRET_MISSING');
  const prompt=workspacePrompt(input.message,input.context,input.history,input.rules);
  if(transport!==invokeProvider)return transport(model.adapter,model.model,model.base_url,secret,prompt,{timeoutMs:25000});
  return invokeProviderDetailed(model.adapter,model.model,model.base_url,secret,prompt,{timeoutMs:25000});
 };
}

/**
 * Local/test worker entrypoint for the first-party AI job. The provider adapter is
 * injected at process startup, while the queued payload contains only tenant and
 * conversation identifiers. This keeps API keys out of jobs, logs, and retries.
 */
export async function runAiWorkerOnce(workspace:string,invoke:AiProviderInvoke){
 const infer=transactionalAiReplyHandler(invoke);
 return runWorkerOnce(workspace,{'ai.reply':async job=>{
  try{return await infer(job);}catch(error){
   const code=error instanceof HttpError?error.code:error instanceof Error?error.message:'';
   const providerFailure=/^PROVIDER_HTTP_[45][0-9]{2}$/.test(code)||['PROVIDER_TIMEOUT','PROVIDER_NETWORK_ERROR','PROVIDER_INVALID_RESPONSE','PROVIDER_EMPTY_RESPONSE'].includes(code);
   if(!providerFailure&&!['AI_RULES_CHANGED','AI_RULES_CONTEXT_LIMIT','AI_KNOWLEDGE_NOT_FOUND','AI_MODEL_NOT_CONFIGURED','AI_MODEL_REVOKED','AI_EMBEDDING_REVOKED','AI_KNOWLEDGE_REVOKED','PROVIDER_NOT_CONFIGURED','PROVIDER_SECRET_MISSING','PROVIDER_ENDPOINT_REQUIRED','PROVIDER_ADAPTER_UNSUPPORTED'].includes(code))throw error;
   const fallback=code==='AI_KNOWLEDGE_NOT_FOUND'?'Tôi chưa tìm thấy thông tin phù hợp trong dữ liệu của doanh nghiệp. Câu hỏi của bạn đang chờ nhân viên hỗ trợ.':'Trợ lý tự động hiện chưa sẵn sàng. Câu hỏi của bạn đang chờ nhân viên hỗ trợ.';
   return transaction(async db=>{
    await scope(db,workspace);
    if(!(await db.query("SELECT id FROM workspaces WHERE id=$1 AND status='active' FOR SHARE",[workspace])).rowCount)throw new HttpError(409,'WORKSPACE_DISABLED');
    const live=(await db.query("SELECT id FROM jobs WHERE id=$1 AND workspace_id=$2 AND state='running' AND lease_token=$3 AND lease_until>clock_timestamp() FOR UPDATE",[job.id,workspace,(job as typeof job&{lease_token:string}).lease_token])).rowCount;
    if(!live)throw new HttpError(409,'STALE_JOB_LEASE');
    const conversation=String(job.payload.conversationId),version=Number(job.payload.ownerVersion);
    await appendMessage(db,{workspace,conversation,clientId:job.id,author:'ai',visibility:'public',ownerVersion:version,body:fallback});
    const changed=await db.query("UPDATE conversations SET reply_owner='HANDOFF_PENDING',owner_version=owner_version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2 AND reply_owner='AI_ACTIVE' AND owner_version=$3",[workspace,conversation,version]);
    if(!changed.rowCount)throw new HttpError(409,'STALE_REPLY_OWNER');
    return {receipt:`handoff:${job.id}`};
   });
  }
 }});

}

/**
 * Trusted local scheduler pass. Workspace ids are discovered from the active
 * tenant identifiers through a restricted discovery function, then each tenant is processed with
 * the existing scoped claim/lease path. No tenant id comes from a widget.
 * Sequential dispatch keeps provider pressure bounded; jobs inside a tenant
 * remain protected by the normal lease and ownership fences.
 */
export async function runAiWorkerAll(invoke:AiProviderInvoke=defaultWorkspaceProviderInvoke(),options:{after?:string|null;shouldStop?:()=>boolean}={}){
 const page:string[]=await transaction(async db=>(await db.query('SELECT id FROM public.worker_active_tenants($1,100)',[options.after??null])).rows.map(r=>r.id));
 const results:{workspace:string,state:string}[]=[];
 let next=options.after??null;
 for(const workspace of page){
  if(options.shouldStop?.())break;
  try{const result=await runAiWorkerOnce(workspace,invoke);results.push({workspace,state:result.state});}
  catch{results.push({workspace,state:'iteration_failed'});}
  next=workspace;
 }
 return {results,next:page.length===0?null:next};
}
