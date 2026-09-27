import {supportMetadata} from './support';
import {agentChatDetached} from './platform-agent';
import {invokeProvider} from './provider-transport';
import type {Express,Request} from 'express';import type {PoolClient} from 'pg';import {z} from 'zod';import {transaction} from './db';import {digest,HttpError,uuid} from './security';import {resolveProviderTarget} from './web-source-security';
async function platformIdentity(db:PoolClient,req:Request){const raw=req.cookies?.gotek_session;if(!raw)throw new HttpError(401,'UNAUTHENTICATED');const row=(await db.query('SELECT s.user_id FROM sessions s JOIN platform_admins a ON a.user_id=s.user_id AND a.active WHERE s.token_hash=$1 AND s.expires_at>now()',[digest(raw)])).rows[0];if(!row)throw new HttpError(403,'PLATFORM_FORBIDDEN');await db.query("SELECT set_config('app.platform','true',true),set_config('app.actor_id',$1,true)",[row.user_id]);return row.user_id as string;}
async function log(db:PoolClient,actor:string,action:string,id:string,reason:string){await db.query('INSERT INTO platform_audit(id,actor_id,action,object_id,reason) VALUES($1,$2,$3,$4,$5)',[uuid(),actor,action,id,reason]);}
const reason=z.string().trim().min(5).max(500),id=z.string().uuid(),capability=z.enum(['chat','embedding','vision']);
export function platformRoutes(app:Express){
 const handler=(fn:(db:PoolClient,actor:string,req:Request)=>Promise<unknown>)=>async(req:Request,res:any)=>res.json(await transaction(async db=>fn(db,await platformIdentity(db,req),req)));
 app.get('/api/platform/support/:id',handler((db,actor,req)=>supportMetadata(db,actor,String(req.params.id))));
 app.get('/api/platform/workspaces/:id',handler(async(db,_actor,req)=>{const key=id.parse(req.params.id);await db.query("SELECT set_config('app.workspace_id',$1,true)",[key]);const row=(await db.query('SELECT id,name,status,created_at FROM workspaces WHERE id=$1',[key])).rows[0];if(!row)throw new HttpError(404,'NOT_FOUND');return row;}));
 app.patch('/api/platform/workspaces/:id/state',handler(async(db,actor,req)=>{const key=id.parse(req.params.id),data=z.object({status:z.enum(['active','disabled']),reason}).strict().parse(req.body);await db.query("SELECT set_config('app.workspace_id',$1,true)",[key]);if(!(await db.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[key])).rowCount)throw new HttpError(404,'NOT_FOUND');await db.query('UPDATE workspaces SET status=$1 WHERE id=$2',[data.status,key]);if(data.status==='disabled')await db.query('DELETE FROM sessions WHERE workspace_id=$1',[key]);await log(db,actor,'workspace.'+data.status,key,data.reason);return {id:key,status:data.status};}));
 app.get('/api/platform/registry',handler(async db=>({providers:(await db.query('SELECT id,name,adapter,enabled FROM providers ORDER BY name')).rows,models:(await db.query('SELECT id,provider_id,name,capabilities,enabled FROM models ORDER BY name')).rows,grants:(await db.query('SELECT id,workspace_id,model_id,capability,active FROM model_grants ORDER BY id')).rows})));
 app.post('/api/platform/providers',handler(async(db,actor,req)=>{const data=z.object({name:z.string().trim().min(2).max(100),adapter:z.enum(['openai','anthropic','gemini','chatgpt','claude_code','custom_llm','local']),secretRef:z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/),baseUrl:z.string().url().optional(),reason}).strict().parse(req.body);if(data.baseUrl){if(data.adapter==='custom_llm'&&!data.baseUrl.startsWith('https://'))throw new HttpError(400,'CUSTOM_LLM_HTTPS_REQUIRED');try{await resolveProviderTarget(data.baseUrl);}catch(error){if(error instanceof HttpError&&error.code==='PROVIDER_HTTPS_REQUIRED'&&data.adapter==='custom_llm')throw new HttpError(400,'CUSTOM_LLM_HTTPS_REQUIRED');throw error;}}else if(data.adapter==='custom_llm')throw new HttpError(400,'PROVIDER_ENDPOINT_REQUIRED');
 const key=uuid();await db.query('INSERT INTO providers(id,name,adapter,secret_ref,base_url) VALUES($1,$2,$3,$4,$5)',[key,data.name,data.adapter,data.secretRef,data.baseUrl??null]);await log(db,actor,'provider.created',key,data.reason);return {id:key,enabled:false};}));
 app.post('/api/platform/models',handler(async(db,actor,req)=>{const data=z.object({providerId:id,name:z.string().trim().min(1).max(100),capabilities:z.array(capability).min(1).max(3),reason}).strict().parse(req.body);if(!(await db.query('SELECT 1 FROM providers WHERE id=$1',[data.providerId])).rowCount)throw new HttpError(404,'NOT_FOUND');const key=uuid();await db.query('INSERT INTO models(id,provider_id,name,capabilities) VALUES($1,$2,$3,$4)',[key,data.providerId,data.name,[...new Set(data.capabilities)]]);await log(db,actor,'model.created',key,data.reason);return {id:key};}));
 app.patch('/api/platform/models/:id/state',handler(async(db,actor,req)=>{const key=id.parse(req.params.id),data=z.object({enabled:z.boolean(),reason}).strict().parse(req.body);if(!(await db.query('SELECT id FROM models WHERE id=$1 FOR UPDATE',[key])).rowCount)throw new HttpError(404,'NOT_FOUND');await db.query('UPDATE models SET enabled=$1 WHERE id=$2',[data.enabled,key]);await log(db,actor,data.enabled?'model.enabled':'model.disabled',key,data.reason);return {id:key,enabled:data.enabled};}));
 app.post('/api/platform/grants',handler(async(db,actor,req)=>{const data=z.object({workspaceId:id,modelId:id,capability,active:z.boolean(),reason}).strict().parse(req.body);const model=(await db.query('SELECT capabilities FROM models WHERE id=$1',[data.modelId])).rows[0];if(!model||!model.capabilities.includes(data.capability))throw new HttpError(400,'CAPABILITY_UNAVAILABLE');
 // Tenant existence is checked through scoped metadata; this never grants chat access.
 await db.query("SELECT set_config('app.workspace_id',$1,true)",[data.workspaceId]);if(!(await db.query('SELECT 1 FROM workspaces WHERE id=$1',[data.workspaceId])).rowCount)throw new HttpError(404,'NOT_FOUND');
 const grant=(await db.query('INSERT INTO model_grants(id,workspace_id,model_id,capability,active) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,model_id,capability) DO UPDATE SET active=excluded.active RETURNING id',[uuid(),data.workspaceId,data.modelId,data.capability,data.active])).rows[0];await log(db,actor,'model.grant',grant.id,data.reason);return grant;}));
 app.patch('/api/platform/providers/:id/state',handler(async(db,actor,req)=>{const key=id.parse(req.params.id),data=z.object({enabled:z.boolean(),reason}).strict().parse(req.body);const provider=(await db.query('SELECT secret_ref,adapter FROM providers WHERE id=$1 FOR UPDATE',[key])).rows[0];if(!provider)throw new HttpError(404,'NOT_FOUND');if(data.enabled&&provider.adapter!=='local'&&!process.env[provider.secret_ref])throw new HttpError(409,'PROVIDER_SECRET_MISSING');await db.query('UPDATE providers SET enabled=$1 WHERE id=$2',[data.enabled,key]);await log(db,actor,data.enabled?'provider.enabled':'provider.disabled',key,data.reason);return {id:key,enabled:data.enabled};}));
 app.get('/api/platform/agent/sessions',handler(async(db,actor)=>{return (await db.query('SELECT id,title,created_at,updated_at FROM platform_agent_sessions WHERE actor_id=$1 ORDER BY updated_at DESC,created_at DESC LIMIT 50',[actor])).rows;}));
 app.get('/api/platform/agent/sessions/:id/messages',handler(async(db,actor,req)=>{const sid=id.parse(String(req.params.id));if(!(await db.query('SELECT 1 FROM platform_agent_sessions WHERE id=$1 AND actor_id=$2',[sid,actor])).rowCount)throw new HttpError(404,'NOT_FOUND');return (await db.query('SELECT id,role,content,status,request_id,created_at FROM platform_agent_messages WHERE session_id=$1 ORDER BY created_at,id',[sid])).rows;}));
 // This endpoint deliberately authenticates in a short transaction, then runs
 // agentChatDetached outside it so provider latency never holds PostgreSQL state.
 app.post('/api/platform/agent/chat',async(req,res)=>{
  const actor=await transaction(async db=>platformIdentity(db,req));
  res.json(await agentChatDetached(actor,req.body));
 });
 app.post('/api/platform/providers/:id/test',async(req,res)=>{
  const prepared=await transaction(async db=>{
   const actor=await platformIdentity(db,req),providerId=id.parse(String(req.params.id));
   const provider=(await db.query('SELECT adapter,secret_ref,base_url,enabled FROM providers WHERE id=$1',[providerId])).rows[0];
   if(!provider)throw new HttpError(404,'NOT_FOUND');
   if(!provider.enabled){await log(db,actor,'provider.test.blocked',providerId,'PROVIDER_DISABLED');return {actor,providerId,blocked:{status:409,body:{error:'PROVIDER_DISABLED'}}};}
   const secret=provider.adapter==='local'?undefined:process.env[provider.secret_ref];
   if(provider.adapter!=='local'&&!secret){await log(db,actor,'provider.test.blocked',providerId,'PROVIDER_SECRET_MISSING');return {actor,providerId,blocked:{status:409,body:{error:'PROVIDER_SECRET_MISSING'}}};}
   if(provider.adapter==='local')return {actor,providerId,provider,secret};
   const selected=(await db.query("SELECT name FROM models WHERE provider_id=$1 AND enabled AND 'chat'=ANY(capabilities) ORDER BY id LIMIT 1",[providerId])).rows[0];
   if(!selected){await log(db,actor,'provider.test.blocked',providerId,'CHAT_MODEL_REQUIRED');return {actor,providerId,blocked:{status:409,body:{error:'CHAT_MODEL_REQUIRED'}}};}
   return {actor,providerId,provider,secret,model:selected.name};
  });
  if(prepared.blocked){res.status(prepared.blocked.status).json(prepared.blocked.body);return;}
  let result:any;
  if(prepared.provider.adapter==='local')result={status:'not_configured',detail:'Local adapter has no inference engine'};
  else {try{const text=await invokeProvider(prepared.provider.adapter,prepared.model!,prepared.provider.base_url,prepared.secret!,'Reply with OK only.');result=text.trim()?{status:'confirmed'}:{status:'failed',error:'PROVIDER_EMPTY_RESPONSE'};}catch(error){result={status:'failed',error:error instanceof Error?error.message:'PROVIDER_ERROR'};}}
  await transaction(async db=>{await platformIdentity(db,req);await log(db,prepared.actor,'provider.test.'+result.status,prepared.providerId,'Platform provider connectivity probe');});
  res.status(200).json(result);
 });
}

/** Trusted runtime use only. Never serialize this return value in an API response. */
export async function resolveModel(workspace:string,modelId:string,cap:'chat'|'embedding'|'vision'){
 return transaction(async db=>{await db.query("SELECT set_config('app.platform','true',true)");await db.query("SELECT set_config('app.workspace_id',$1,true)",[workspace]);
 const result=(await db.query(`SELECT p.adapter,p.secret_ref,m.name FROM model_grants g JOIN models m ON m.id=g.model_id JOIN providers p ON p.id=m.provider_id JOIN workspaces w ON w.id=g.workspace_id WHERE g.workspace_id=$1 AND g.model_id=$2 AND g.capability=$3 AND g.active AND (g.expires_at IS NULL OR g.expires_at>clock_timestamp()) AND m.enabled AND p.enabled AND $3=ANY(m.capabilities) AND w.status='active'`,[workspace,modelId,cap])).rows[0];
 if(!result)throw new HttpError(403,'MODEL_NOT_GRANTED');
 const secret=process.env[result.secret_ref];if(result.adapter!=='local'&&!secret)throw new HttpError(409,'PROVIDER_SECRET_MISSING');return {adapter:result.adapter,model:result.name,secret};});
}
