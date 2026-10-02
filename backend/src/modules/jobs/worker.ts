import {assertMetaWorkerRole} from '../meta/worker-role';
import {resolveMetaCredential} from '../meta/credential-vault';
import {normalizeRetainedFacebookStatuses,normalizeRetainedFacebookMessage} from '../meta/replay-normalization';
import {reconcileMetaReceipt} from '../meta/receipts';
import {transaction,scope} from '../../core/db';
import {claimJob,finishJob,recoverStaleJobs} from './jobs';
import {appendMessage} from '../../modules/chat/chat-store';
import {HttpError} from '../../core/security';
import {transactionalAiReplyHandler, type AiProviderInvoke} from '../../modules/ai/ai-reply-worker';
import {workspacePrompt} from '../../modules/ai/workspace-prompt';
import {invokeProvider,invokeProviderDetailed} from '../../modules/ai/provider-transport';
import {fetchMetaProfile} from '../../modules/meta/profile';
import {sendMetaText,sendMetaMedia} from '../../modules/meta/send';
import {processNormalizedMetaInbound,processNormalizedMetaStatus} from '../../modules/meta/messenger';
import {syncMetaHistoryOnce} from '../../modules/meta/history';
import type {NormalizedMetaInbound,NormalizedMetaStatus} from '../../modules/meta/inbound';
import pg,{type PoolClient} from 'pg';
export type JobHandler=(job:{id:string,workspace_id:string,kind:string,payload:Record<string,unknown>})=>Promise<{receipt:string}>;

let metaWorkerPool:pg.Pool|undefined;
async function notifyMetaRealtime(workspaceId:string, connectionId:string):Promise<void>{
 const url=process.env.META_REALTIME_INTERNAL_URL||'http://127.0.0.1:4317/internal/meta/realtime';
 const secret=process.env.META_REALTIME_INTERNAL_SECRET;
 if(!secret){console.warn('META_REALTIME_BRIDGE_NOT_CONFIGURED');return;}
 try{const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-gotek-worker-secret':secret},body:JSON.stringify({workspaceId,connectionId}),signal:AbortSignal.timeout(5000)});if(!response.ok)console.warn('META_REALTIME_BRIDGE_HTTP_'+response.status);}catch{console.warn('META_REALTIME_BRIDGE_FAILED');}
}
function getMetaWorkerPool():pg.Pool {
 if(metaWorkerPool)return metaWorkerPool;
 const url=process.env.META_WORKER_DATABASE_URL;
 if(!url)throw new HttpError(503,'META_WORKER_DATABASE_NOT_CONFIGURED');
 metaWorkerPool=new pg.Pool({connectionString:url,max:2});
 return metaWorkerPool;
}
async function metaWorkerTransaction<T>(workspace:string,fn:(db:PoolClient)=>Promise<T>):Promise<T>{
 const db=await getMetaWorkerPool().connect();
 try{await db.query('BEGIN');await assertMetaWorkerRole(db);await scope(db,workspace);const result=await fn(db);await db.query('COMMIT');return result;}
 catch(error){await db.query('ROLLBACK');throw error;}
 finally{db.release();}
}
export async function closeMetaWorkerPool():Promise<void>{
 if(metaWorkerPool){const current=metaWorkerPool;metaWorkerPool=undefined;await current.end();}
}
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
 if(job.external_effect && job.kind!=='meta.message.send'){await scoped(db=>finishJob(db,job.id,job.lease_token,{state:'failed',code:'EXTERNAL_DELIVERY_DISABLED'}));return {state:'disabled'};}
 const handler=Object.hasOwn(handlers,job.kind)?handlers[job.kind]:undefined;
 if(!handler){await scoped(db=>finishJob(db,job.id,job.lease_token,{state:'failed',code:'HANDLER_UNAVAILABLE'}));return {state:'unavailable'};}
 try{const result=await handler(job);await scoped(db=>finishJob(db,job.id,job.lease_token,{state:'succeeded',receipt:result.receipt}));return {state:'succeeded'};}
 catch(error){if(error instanceof HttpError&&error.code==='STALE_JOB_LEASE')return {state:'lease_expired'};
 // Ownership rejection cancels publishing, including after an inference race.
 // Keep any provider dispatch/usage uncertainty separately; never retry this reply.
 if(job.kind==='ai.reply'&&error instanceof HttpError&&error.code==='STALE_REPLY_OWNER'){
  await scoped(async db=>{
   await db.query("UPDATE jobs SET max_attempts=attempts WHERE id=$1 AND state='running' AND lease_token=$2 AND lease_until>now()",[job.id,job.lease_token]);
   await finishJob(db,job.id,job.lease_token,{state:'failed',code:'STALE_REPLY_OWNER'});
  });
  return {state:'dead'};
 }
 // Messenger rejections are terminal: do not retry sends implicitly.
 if(job.kind==='meta.message.send'&&error instanceof HttpError){
  const code=error.code;
  const known=['META_CHANNEL_UNSUPPORTED','META_ACCOUNT_REQUIRED','META_DISPATCH_INVALID','STALE_REPLY_OWNER','META_TOKEN_NOT_CONFIGURED','META_MESSAGE_INVALID','META_MEDIA_INVALID','META_CAPTION_UNSUPPORTED'].includes(code)||/^META_HTTP_4[0-9]{2}$/.test(code);
  try{
   await scoped(async db=>{
    if(known)await db.query("UPDATE jobs SET max_attempts=attempts WHERE id=$1 AND state='running' AND lease_token=$2 AND lease_until>now()",[job.id,job.lease_token]);
    await finishJob(db,job.id,job.lease_token,{state:known?'failed':'unknown',code});
   });
   return {state:known?'dead':'unknown'};
  }catch(settleError){if(settleError instanceof HttpError&&settleError.code==='STALE_JOB_LEASE')return {state:'lease_expired'};throw settleError;}
 }
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

/** Sends a queued Messenger reply; the Page token is resolved only inside the worker. */
export async function runMetaProfileWorkerOnce(workspace:string,fetchProfile:typeof fetchMetaProfile=fetchMetaProfile){
 return runWorkerOnce(workspace,{'meta.profile.fetch':async job=>{
  return transaction(async db=>{
   await scope(db,workspace);
   const connection=(await db.query("SELECT id,channel_id,page_access_token_ref,channel_kind FROM meta_connections WHERE id=$1 AND workspace_id=$2 AND status='connected' FOR SHARE",[String(job.payload.connectionId),workspace])).rows[0];
   if(!connection)throw new HttpError(409,'META_CONNECTION_NOT_READY');
   const userId=String(job.payload.userId);
   const token=await resolveMetaCredential(db,workspace,connection.id,connection.page_access_token_ref);
   const profile=await fetchProfile(userId,connection.page_access_token_ref,fetch,connection.channel_kind,token);
   await db.query('UPDATE meta_identities SET profile=profile||$1::jsonb,updated_at=now() WHERE connection_id=$2 AND workspace_id=$3 AND external_user_id=$4',[profile,connection.id,workspace,userId]);
   await db.query("UPDATE visitors SET profile=profile||$1::jsonb WHERE workspace_id=$2 AND channel_id=$3 AND profile->>'metaUserId'=$4",[profile,workspace,connection.channel_id,userId]);
   return {receipt:'meta-profile:updated'};
  });
 }});
}

/** Replays provider history from the durable per-connection cursor after downtime. */
export async function runMetaHistoryWorkerOnce(workspace:string){
 const rows=await metaWorkerTransaction(workspace,async db=>{
  await db.query("SELECT set_config('app.meta_worker','true',true)");
  return (await db.query("SELECT id FROM meta_connections WHERE workspace_id=$1 AND status='connected' AND channel_kind='facebook_messenger'",[workspace])).rows;
 });
 let imported=0;
 const results:Array<{connectionId:string;state:string;code?:string}>=[];
 for(const row of rows){
  try{
   const result=await metaWorkerTransaction(workspace,async db=>{
    await db.query("SELECT set_config('app.meta_worker','true',true)");
    return syncMetaHistoryOnce(db,workspace,row.id);
   });
   imported+=result.imported;
   results.push({connectionId:row.id,state:result.state});
   if(result.imported>0)await notifyMetaRealtime(workspace,row.id);
  }catch(error){
   const code=error instanceof HttpError?error.code:'META_HISTORY_ITERATION_FAILED';
   await metaWorkerTransaction(workspace,async db=>{
    await db.query(`INSERT INTO meta_history_sync(workspace_id,connection_id,state,last_error)
      VALUES($1,$2,'retry',$3) ON CONFLICT(workspace_id,connection_id)
      DO UPDATE SET state='retry',last_error=EXCLUDED.last_error,updated_at=now()`,[workspace,row.id,code]);
   });
   results.push({connectionId:row.id,state:'failed',code});
  }
 }
 const state=results.some(r=>r.state==='failed')?'partial_failure':results.some(r=>r.state==='more')?'more':results.some(r=>r.state==='complete')?'complete':'idle';
 return {state,imported,results};
}

/**
 * Claims one durable Meta webhook event for a single tenant. The claim
 * function may bind an otherwise-unassigned event only when the provider
 * account now resolves to this workspace's connected connection. Unknown
 * events stay quarantined and are never silently discarded.
 */
export async function runMetaIngressOnce(workspace:string){
 const afterCommit:Array<()=>void>=[];
 const outcome=await metaWorkerTransaction(workspace,async db=>{
  await db.query("SELECT set_config('app.meta_worker','true',true)");
  await db.query('SELECT recover_meta_ingress($1)',[workspace]);
  const row=(await db.query('SELECT * FROM claim_meta_ingress($1,$2)',[workspace,30])).rows[0];
  if(!row)return {state:'idle'};
  if(row.event_kind==='unknown'){
   const recovered=normalizeRetainedFacebookMessage(row);
   if(recovered){row.event_kind='message';row.payload=recovered;}
  }
  const retainedStatuses=row.event_kind==='unknown'?normalizeRetainedFacebookStatuses(row):[];
  if(row.event_kind==='unknown'&&!retainedStatuses.length){
   const settled=(await db.query('SELECT finish_meta_ingress($1,$2,$3,$4) AS ok',[row.ingress_id,row.lease_token,'quarantined','META_EVENT_UNSUPPORTED'])).rows[0]?.ok;
   return {state:settled?'quarantined':'lease_expired',ingressId:row.ingress_id};
  }
  const connection=(await db.query('SELECT id,workspace_id,channel_id,channel_kind,external_page_id,status FROM meta_connections WHERE id=$1 AND workspace_id=$2 AND status=\'connected\' FOR SHARE',[row.connection_id,workspace])).rows[0];
  if(!connection){
   await db.query('SELECT finish_meta_ingress($1,$2,$3,$4)',[row.ingress_id,row.lease_token,'quarantined','META_CONNECTION_NOT_READY']);
   return {state:'quarantined',ingressId:row.ingress_id};
  }
  const route={id:connection.id,workspace_id:connection.workspace_id,channel_id:connection.channel_id};
  await db.query('SAVEPOINT meta_ingress_processing');
  try{
   if(retainedStatuses.length){
    for(const status of retainedStatuses)await processNormalizedMetaStatus(db,status,route,afterCommit);
   }else if(row.event_kind==='status'){
    await processNormalizedMetaStatus(db,row.payload as NormalizedMetaStatus,route,afterCommit);
   }else{
    await processNormalizedMetaInbound(db,row.payload as NormalizedMetaInbound,route,afterCommit);
   }
   const settled=(await db.query('SELECT finish_meta_ingress($1,$2,$3,$4) AS ok',[row.ingress_id,row.lease_token,'succeeded',null])).rows[0]?.ok;
   if(!settled)throw new HttpError(409,'META_INGRESS_LEASE_EXPIRED');
   await db.query('RELEASE SAVEPOINT meta_ingress_processing');
    return {state:settled?'succeeded':'lease_expired',ingressId:row.ingress_id,connectionId:connection.id};
  }catch(error){
   // Undo projection/dedupe writes before retaining the claimed event for retry.
   // This also clears PostgreSQL's aborted state after a SQL exception.
   await db.query('ROLLBACK TO SAVEPOINT meta_ingress_processing');
   await db.query('RELEASE SAVEPOINT meta_ingress_processing');
   afterCommit.length=0;
   const code=error instanceof HttpError?error.code:'META_INGRESS_PROCESSING_FAILED';
   const terminal=error instanceof HttpError&&['META_CONNECTION_NOT_READY','META_ROUTE_UNAVAILABLE'].includes(error.code);
   const settled=(await db.query('SELECT finish_meta_ingress($1,$2,$3,$4) AS ok',[row.ingress_id,row.lease_token,terminal?'quarantined':(row.attempts>=5?'dead':'retry'),code])).rows[0]?.ok;
    return {state:settled?(terminal?'quarantined':(row.attempts>=5?'dead':'retry')):'lease_expired',ingressId:row.ingress_id,connectionId:connection.id};
  }
 });
 if(outcome.state==='succeeded'){
  for(const publish of afterCommit){try{publish();}catch{console.warn('META_REALTIME_PUBLISH_FAILED');}}
  if(outcome.connectionId)await notifyMetaRealtime(workspace,outcome.connectionId);
 }
 return outcome;
}

/** Trusted local scheduler pass for inbound events across all active workspaces. */
export async function cleanupExpiredMetaIngress(limit=500):Promise<number>{
 return metaWorkerTransaction('00000000-0000-0000-0000-000000000000',async db=>Number((await db.query('SELECT cleanup_expired_meta_ingress($1) AS count',[limit])).rows[0]?.count||0));
}

export async function runMetaIngressAll(options:{after?:string|null;shouldStop?:()=>boolean}={}){
 const page:string[]=await transaction(async db=>(await db.query('SELECT id FROM public.worker_active_tenants($1,100)',[options.after??null])).rows.map(r=>r.id));
 const results:{workspace:string,state:string}[]=[];let next=options.after??null;
 for(const workspace of page){if(options.shouldStop?.())break;try{const result=await runMetaIngressOnce(workspace);results.push({workspace,state:result.state});}catch{results.push({workspace,state:'iteration_failed'});}next=workspace;}
 return {results,next:page.length===0?null:next};
}

export async function runMetaWorkerOnce(workspace:string,send:typeof sendMetaText=sendMetaText){
 let sentConnection:string|undefined;
 const outcome=await runWorkerOnce(workspace,{'meta.message.send':async job=>{
  return transaction(async db=>{
   await scope(db,workspace);
   // Serialize dispatch with takeover and connection revocation. Resolve the
   // recipient and credential from current scoped rows, never queued secrets.
   const candidates=(await db.query(`SELECT m.body,m.author_type,m.visibility,m.actor_id,
    c.reply_owner,c.owner_version,c.assigned_to,
    v.token_hash AS identity_binding,mc.id AS connection_id,v.profile->>'metaUserId' AS recipient,mc.page_access_token_ref,mc.channel_kind,mc.external_page_id
    FROM messages m JOIN conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id
    JOIN visitors v ON v.id=c.visitor_id AND v.workspace_id=c.workspace_id
    JOIN meta_connections mc ON mc.id=c.connection_id AND mc.channel_id=c.channel_id AND mc.workspace_id=c.workspace_id
    WHERE m.id=$1 AND m.workspace_id=$2 AND c.id=$3 AND mc.status='connected'
    FOR UPDATE OF c,mc`,[String(job.payload.messageId),workspace,String(job.payload.conversationId)])).rows;
   if(candidates.length!==1)throw new HttpError(409,'META_DISPATCH_INVALID');
   const row=candidates[0];
   sentConnection=row.connection_id;
   if(!row||row.visibility!=='public'||!row.recipient||row.identity_binding!==`meta:${row.connection_id}:${row.recipient}`)throw new HttpError(409,'META_DISPATCH_INVALID');
   if(row.author_type==='ai'){
    if(row.reply_owner!=='AI_ACTIVE'||row.owner_version!==job.payload.ownerVersion)throw new HttpError(409,'STALE_REPLY_OWNER');
   }else if(row.author_type!=='agent'||row.reply_owner!=='HUMAN_ACTIVE'||row.assigned_to!==row.actor_id){
    throw new HttpError(409,'STALE_REPLY_OWNER');
   }
   const live=await db.query("SELECT id FROM jobs WHERE id=$1 AND workspace_id=$2 AND state='running' AND lease_token=$3 AND lease_until>clock_timestamp()+interval '21 seconds' FOR UPDATE",[job.id,workspace,(job as typeof job&{lease_token:string}).lease_token]);
   if(!live.rowCount)throw new HttpError(409,'STALE_JOB_LEASE');
   const media=(await db.query("SELECT kind,url FROM message_attachments WHERE workspace_id=$1 AND message_id=$2 ORDER BY created_at LIMIT 1",[workspace,job.payload.messageId])).rows[0];
   const accessToken=await resolveMetaCredential(db,workspace,row.connection_id,row.page_access_token_ref);
   const result=media
    ? await sendMetaMedia({recipientId:row.recipient,mediaType:media.kind,mediaUrl:media.url,...(row.channel_kind==='whatsapp_business'&&media.kind!=='audio'?{caption:row.body}:{}),accessToken,pageAccessTokenRef:row.page_access_token_ref,channelKind:row.channel_kind,externalAccountId:row.external_page_id})
    : await send({recipientId:row.recipient,text:row.body,accessToken,pageAccessTokenRef:row.page_access_token_ref,channelKind:row.channel_kind,externalAccountId:row.external_page_id});
   if(result.status!=='accepted'||!result.providerMessageId)throw new HttpError(502,result.errorCode||'META_DELIVERY_UNKNOWN');
   await db.query(`INSERT INTO meta_message_deliveries(id,workspace_id,message_id,provider_message_id,status,connection_id)
     VALUES(gen_random_uuid(),$1,$2,$3,'accepted',$4) ON CONFLICT(workspace_id,message_id) DO NOTHING`,[workspace,job.payload.messageId,result.providerMessageId,row.connection_id]);
   await reconcileMetaReceipt(db,workspace,row.connection_id,result.providerMessageId);
   sentConnection=row.connection_id;
   return {receipt:`meta:${result.providerMessageId}`};
  });
 }});
 if(['succeeded','dead','unknown'].includes(outcome.state)&&sentConnection)await notifyMetaRealtime(workspace,sentConnection);
 return outcome;
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
