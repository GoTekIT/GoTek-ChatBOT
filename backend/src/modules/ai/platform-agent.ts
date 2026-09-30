import {platformAgentPrompt} from './platform-agent-prompt';
import {createHash} from 'node:crypto';
import {invokeProvider as invoke} from './provider-transport';
import type {PoolClient} from 'pg';import {z} from 'zod';import {HttpError,uuid} from '../../core/security';import {transaction} from '../../core/db';
const contextItem=z.object({source:z.string().trim().min(1).max(200),title:z.string().trim().min(1).max(300),content:z.string().trim().min(1).max(8000)}).strict();
const reqSchema=z.object({requestId:z.string().uuid(),sessionId:z.string().uuid().optional(),message:z.string().trim().min(1).max(20000),modelId:z.string().uuid(),context:z.array(contextItem).max(20).default([]),workspaceId:z.string().uuid().optional()}).strict();
export async function testProvider(db:PoolClient,providerId:string){const p=(await db.query('SELECT adapter,secret_ref,base_url,enabled FROM providers WHERE id=$1',[providerId])).rows[0];if(!p)throw new HttpError(404,'NOT_FOUND');if(!p.enabled)throw new HttpError(409,'PROVIDER_DISABLED');if(p.adapter!=='local'&&!process.env[p.secret_ref])throw new HttpError(409,'PROVIDER_SECRET_MISSING');if(p.adapter==='local')return {status:'not_configured',detail:'Local adapter has no inference engine'};const selected=(await db.query("SELECT name FROM models WHERE provider_id=$1 AND enabled AND 'chat'=ANY(capabilities) ORDER BY id LIMIT 1",[providerId])).rows[0];if(!selected)throw new HttpError(409,'CHAT_MODEL_REQUIRED');try{await invoke(p.adapter,selected.name,p.base_url,process.env[p.secret_ref]!, 'Reply with OK only.');return {status:'confirmed'};}catch(e){return {status:'failed',error:e instanceof Error?e.message:'PROVIDER_ERROR'};}}
async function model(db:Pick<PoolClient,'query'>,id:string){const row=(await db.query("SELECT p.id provider_id,p.name provider,p.adapter,p.secret_ref,p.base_url,m.id model_id,m.name model FROM models m JOIN providers p ON p.id=m.provider_id WHERE m.id=$1 AND m.enabled AND p.enabled AND 'chat'=ANY(m.capabilities)",[id])).rows[0];if(!row)throw new HttpError(404,'MODEL_NOT_AVAILABLE');return row;}

// Callers must not wrap this orchestration in an ambient transaction.
export async function agentChat(_db:PoolClient,actor:string,body:unknown){return agentChatDetached(actor,body);}
const inFlight=new Map<string,{fingerprint:string;task:Promise<unknown>}>();
export async function agentChatDetached(actor:string,body:unknown):Promise<any>{
 const d=reqSchema.parse(body),key=`${actor}:${d.requestId}`;
 const fingerprint=createHash('sha256').update(JSON.stringify(d)).digest('hex');
 const scoped=<T>(fn:(db:PoolClient)=>Promise<T>)=>transaction(async db=>{
  await db.query("SELECT set_config('app.platform','true',true),set_config('app.actor_id',$1,true),set_config('app.workspace_id',$2,true)",[actor,d.workspaceId||'']);
  return fn(db);
 });
 // Recovery commits independently: a later validation/conflict error must not roll it back.
 await scoped(db=>recoverExpired(db,actor,d.requestId,d.sessionId));
 const recovered=await scoped(async db=>(await db.query("SELECT payload_hash,status,response FROM platform_agent_requests WHERE actor_id=$1 AND request_id=$2",[actor,d.requestId])).rows[0]);
 if(recovered){
  if(recovered.payload_hash!==fingerprint)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');
  if(recovered.status!=='pending')return recovered.response;
 }
 const running=inFlight.get(key);
 if(running){if(running.fingerprint!==fingerprint)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');return running.task;}
 const task=(async()=>{
  const prepared=await scoped(async db=>{
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
   const prior=(await db.query('SELECT payload_hash,status,response FROM platform_agent_requests WHERE actor_id=$1 AND request_id=$2',[actor,d.requestId])).rows[0];
   if(prior){
    if(prior.payload_hash!==fingerprint)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');
    if(prior.status==='pending')throw new HttpError(409,'REQUEST_IN_FLIGHT');
    return {replay:prior.response};
   }
   const m=await model(db,d.modelId),secret=process.env[m.secret_ref];
   if(m.adapter!=='local'&&!secret)throw new HttpError(409,'PROVIDER_SECRET_MISSING');
   let context=d.context;
   if(d.workspaceId){
    const w=(await db.query('SELECT name,status FROM workspaces WHERE id=$1',[d.workspaceId])).rows[0];
    if(!w)throw new HttpError(404,'WORKSPACE_NOT_FOUND');
    context=[{source:'workspace',title:'Workspace context',content:`Workspace: ${w.name}\nStatus: ${w.status}`},...context];
   }
   const session=d.sessionId||uuid();
   if(d.sessionId){
    if(!(await db.query('SELECT id FROM platform_agent_sessions WHERE id=$1 AND actor_id=$2 FOR UPDATE',[session,actor])).rowCount)throw new HttpError(404,'NOT_FOUND');
    if((await db.query("SELECT 1 FROM platform_agent_requests WHERE session_id=$1 AND status='pending'",[session])).rowCount)throw new HttpError(409,'SESSION_BUSY');
   }else await db.query('INSERT INTO platform_agent_sessions(id,actor_id,title) VALUES($1,$2,$3)',[session,actor,d.message.slice(0,120)]);
   const history=(await db.query("SELECT role,content FROM platform_agent_messages WHERE session_id=$1 AND status='confirmed' ORDER BY created_at DESC,id DESC LIMIT 12",[session])).rows.reverse();
   const prompt=platformAgentPrompt(d.message,history,context);
   const token=uuid(),userId=uuid();
   await db.query("INSERT INTO platform_agent_requests(actor_id,request_id,payload_hash,status,claimed_at,session_id,claim_token,lease_expires_at) VALUES($1,$2,$3,'pending',clock_timestamp(),$4,$5,clock_timestamp()+interval '2 minutes')",[actor,d.requestId,fingerprint,session,token]);
   await db.query("INSERT INTO platform_agent_messages(id,session_id,role,content,provider_id,model_id,status,request_id) VALUES($1,$2,'user',$3,$4,$5,'confirmed',$6)",[userId,session,d.message,m.provider_id,m.model_id,d.requestId]);
   await db.query('UPDATE platform_agent_sessions SET updated_at=clock_timestamp() WHERE id=$1',[session]);
   return {session,token,userId,m,secret,prompt};
  });
  if('replay' in prepared)return prepared.replay;
  const dispatch=await scoped(async db=>{
   const claim=(await db.query("SELECT *,lease_expires_at<=clock_timestamp() expired FROM platform_agent_requests WHERE actor_id=$1 AND request_id=$2 FOR UPDATE",[actor,d.requestId])).rows[0];
   if(!claim||claim.claim_token!==prepared.token)throw new HttpError(409,'STALE_AGENT_CLAIM');
   if(claim.status!=='pending')return {replay:claim.response};
   if(claim.expired)return {replay:await expireClaim(db,claim)};
   await db.query("UPDATE platform_agent_requests SET dispatched_at=clock_timestamp() WHERE actor_id=$1 AND request_id=$2",[actor,d.requestId]);
   return {ready:true};
  });
  if('replay' in dispatch)return dispatch.replay;
  let output='',error='';
  if(prepared.m.adapter!=='local'){
   try{output=await invoke(prepared.m.adapter,prepared.m.model,prepared.m.base_url,prepared.secret!,prepared.prompt);if(!output.trim())throw new Error('PROVIDER_EMPTY_RESPONSE');}
   catch(e){error=e instanceof Error?e.message:'PROVIDER_ERROR';}
  }
  return scoped(async db=>{
   const claim=(await db.query('SELECT *,lease_expires_at<=clock_timestamp() expired FROM platform_agent_requests WHERE actor_id=$1 AND request_id=$2 FOR UPDATE',[actor,d.requestId])).rows[0];
   if(!claim)throw new HttpError(409,'STALE_AGENT_CLAIM');
   if(claim.status!=='pending')return claim.response;
   if(claim.claim_token!==prepared.token)throw new HttpError(409,'STALE_AGENT_CLAIM');
   if(claim.expired)return expireClaim(db,claim);
   let response:any;
   if(prepared.m.adapter==='local')response={sessionId:prepared.session,message:{id:prepared.userId,role:'user',content:d.message,status:'confirmed'},assistant:null,state:'not_configured'};
   else{
    const id=uuid(),status=error?'unknown':'confirmed',content=error?`Provider request chưa xác định: ${error}`.slice(0,20000):output;
    await db.query("INSERT INTO platform_agent_messages(id,session_id,role,content,provider_id,model_id,status,request_id) VALUES($1,$2,'assistant',$3,$4,$5,$6,$7)",[id,prepared.session,content,prepared.m.provider_id,prepared.m.model_id,status,d.requestId]);
    response=error?{sessionId:prepared.session,message:null,state:'unknown',error}:{sessionId:prepared.session,message:{id,role:'assistant',content:output,status},state:status};
   }
   await db.query('UPDATE platform_agent_requests SET status=$3,response=$4,completed_at=clock_timestamp() WHERE actor_id=$1 AND request_id=$2',[actor,d.requestId,error?'unknown':'confirmed',response]);
   return response;
  });
 })();
 inFlight.set(key,{fingerprint,task});try{return await task;}finally{inFlight.delete(key);}
}

// Never retry a provider side effect whose outcome is unknown. A fresh explicit turn
// may start after this terminal receipt releases the per-session pending fence.
async function expireClaim(db:PoolClient,claim:any){
 const response={sessionId:claim.session_id,message:null,state:'unknown',error:claim.dispatched_at?'AGENT_REQUEST_EXPIRED':'AGENT_REQUEST_EXPIRED_BEFORE_DISPATCH'};
 await db.query("UPDATE platform_agent_requests SET status='unknown',response=$3,completed_at=clock_timestamp() WHERE actor_id=$1 AND request_id=$2",[claim.actor_id,claim.request_id,response]);
 await db.query("UPDATE platform_agent_messages SET status='unknown' WHERE session_id=$1 AND request_id=$2 AND role='user'",[claim.session_id,claim.request_id]);
 return response;
}
async function recoverExpired(db:PoolClient,actor:string,requestId:string,sessionId?:string){
 const expired=(await db.query("SELECT * FROM platform_agent_requests WHERE actor_id=$1 AND status='pending' AND lease_expires_at<=clock_timestamp() ORDER BY (request_id=$2 OR session_id=$3) DESC NULLS LAST,lease_expires_at LIMIT 100 FOR UPDATE SKIP LOCKED",[actor,requestId,sessionId||null])).rows;
 for(const claim of expired)await expireClaim(db,claim);
}
