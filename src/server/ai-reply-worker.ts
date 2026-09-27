import type {PoolClient} from 'pg';import {createHash} from 'node:crypto';
import {HttpError} from './security';
import {appendMessage} from './chat-store';
import {transaction,scope} from './db';
import {buildWidgetAiContext,assertWidgetSourcesCurrent} from './knowledge-retrieval';
import {normalizeTokenUsage,costMicros,type TokenUsage} from './token-metering';
import {recordUsage} from './usage-ledger';
import {workspacePrompt} from './workspace-prompt';
import {retrieveEmbeddedContext} from './knowledge-embedding-worker';
import {loadAiRuleSnapshot,assertAiRuleSnapshotCurrent} from './ai-rule-snapshot';
import {reserveAiResponse,settleUsage} from './quota';
/**
 * Trusted worker boundary for widget AI jobs. Provider invocation is deliberately
 * injected by the caller; this boundary never trusts public job payload for
 * workspace or ownership and never emits an AI message after takeover.
 */
function deterministicClientId(conversation:string,message:string,version:number){const hex=createHash('sha256').update(`gotek-ai:${conversation}:${message}:${version}`).digest('hex').slice(0,32);return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20)}`;}

type AiJob={id?:string,lease_token?:string,workspace_id:string,payload:Record<string,unknown>};
/** Provider boundary. Secrets/configuration are resolved by the trusted server adapter,
 * never from the queued job payload. */
export type AiProviderResult={text:string;usage?:unknown};
export type AiProviderInvoke=(input:{workspace:string,conversation:string,message:string,modelId:string,history?:{role:'visitor'|'agent'|'ai',content:string}[],rules?:{id:string,version:number,title:string,content:string}[],context?:{source:string,title:string,content:string,citation:unknown}[]})=>Promise<string|AiProviderResult>;
type Invoke=AiProviderInvoke;
async function prepare(db:PoolClient,job:AiJob, reserveQuota=true){
  const conversation=String(job.payload.conversationId||'');
  const messageId=String(job.payload.messageId||'');
  const version=Number(job.payload.ownerVersion);
  const row=(await db.query(`SELECT c.reply_owner,c.owner_version,c.channel_id,m.body,m.sequence FROM conversations c JOIN messages m ON m.id=$2 AND m.conversation_id=c.id AND m.workspace_id=c.workspace_id AND m.author_type='visitor' AND m.visibility='public' WHERE c.id=$1 AND c.workspace_id=$3`,[conversation,messageId,job.workspace_id])).rows[0];
  if(!row)throw new HttpError(404,'AI_SOURCE_NOT_FOUND');
  if(row.reply_owner!=='AI_ACTIVE'||row.owner_version!==version)throw new HttpError(409,'STALE_REPLY_OWNER');
  // Provider/model tables are platform-managed and RLS-gated. This handler is
  // only reachable from the trusted tenant worker; keep the tenant predicate
  // explicit while entering the platform read context for the registry lookup.
  const previous=(await db.query("SELECT current_setting('app.platform',true) AS enabled")).rows[0]?.enabled||'';
  let model:{id:string,provider_id:string}|undefined;
  let embeddingModelId:string|undefined;
  try {
   await db.query("SELECT set_config('app.platform','true',true)");
   model=(await db.query(`SELECT m.id, p.id AS provider_id FROM model_grants g JOIN models m ON m.id=g.model_id JOIN providers p ON p.id=m.provider_id WHERE g.workspace_id=$1 AND g.capability='chat' AND g.active AND (g.expires_at IS NULL OR g.expires_at>clock_timestamp()) AND m.enabled AND p.enabled AND 'chat'=ANY(m.capabilities) ORDER BY m.id LIMIT 1`,[job.workspace_id])).rows[0];
  embeddingModelId=(await db.query(`SELECT m.id FROM model_grants g JOIN models m ON m.id=g.model_id JOIN providers p ON p.id=m.provider_id
   WHERE g.workspace_id=$1 AND g.capability='embedding' AND g.active AND (g.expires_at IS NULL OR g.expires_at>clock_timestamp()) AND m.enabled AND p.enabled AND 'embedding'=ANY(m.capabilities) ORDER BY m.id LIMIT 1`,[job.workspace_id])).rows[0]?.id as string|undefined;
  } finally {
   await db.query("SELECT set_config('app.platform',$1,true)",[previous]);
  }
  if(!model)throw new HttpError(409,'AI_MODEL_NOT_CONFIGURED');
  const clientId=deterministicClientId(conversation,messageId,version);
  const existing=(await db.query('SELECT id FROM messages WHERE conversation_id=$1 AND client_id=$2',[conversation,clientId])).rows[0];
 const history=(await db.query("SELECT author_type AS role,body AS content FROM messages WHERE workspace_id=$1 AND conversation_id=$2 AND visibility='public' AND author_type IN ('visitor','agent','ai') AND sequence<$3 ORDER BY sequence DESC LIMIT 12",[job.workspace_id,conversation,row.sequence])).rows.reverse();
  const knowledge=await buildWidgetAiContext(db,job.workspace_id,row.body as string,5,{history});
  const rules=await loadAiRuleSnapshot(db,job.workspace_id);

  if(job.payload.requireGrounded===true&&!knowledge.sources.length&&!embeddingModelId)throw new HttpError(409,'AI_KNOWLEDGE_NOT_FOUND');
  const quota=existing||!reserveQuota?undefined:await reserveAiResponse(db,job.workspace_id,clientId);
  return {workspace:job.workspace_id,conversation,message:row.body as string,modelId:model.id,providerId:model.provider_id,embeddingModelId,usedEmbeddingModelId:undefined as string|undefined,clientId,version,existing:!!existing,history,rules,context:knowledge.sources,quotaId:quota?.id as string|undefined,dispatchClaimed:false};
}
async function commit(db:PoolClient,context:Awaited<ReturnType<typeof prepare>>,output:string,usage?:unknown){
 if(!output.trim())throw new HttpError(502,'PROVIDER_EMPTY_RESPONSE');
 const previous=(await db.query("SELECT current_setting('app.platform',true) AS enabled")).rows[0]?.enabled||'';
  try {
   await db.query("SELECT set_config('app.platform','true',true)");
  const active=(await db.query("SELECT 1 FROM model_grants g JOIN models m ON m.id=g.model_id JOIN providers p ON p.id=m.provider_id WHERE g.workspace_id=$1 AND g.model_id=$2 AND g.capability='chat' AND g.active AND (g.expires_at IS NULL OR g.expires_at>clock_timestamp()) AND m.enabled AND p.enabled AND 'chat'=ANY(m.capabilities) FOR SHARE OF g,m,p",[context.workspace,context.modelId])).rowCount;
  if(!active)throw new HttpError(409,'AI_MODEL_REVOKED');
  if(context.usedEmbeddingModelId){
   const embedding=(await db.query("SELECT 1 FROM model_grants g JOIN models m ON m.id=g.model_id JOIN providers p ON p.id=m.provider_id WHERE g.workspace_id=$1 AND g.model_id=$2 AND g.capability='embedding' AND g.active AND (g.expires_at IS NULL OR g.expires_at>clock_timestamp()) AND m.enabled AND p.enabled AND 'embedding'=ANY(m.capabilities) FOR SHARE OF g,m,p",[context.workspace,context.usedEmbeddingModelId])).rowCount;
   if(!embedding)throw new HttpError(409,'AI_EMBEDDING_REVOKED');
  }
 } finally { await db.query("SELECT set_config('app.platform',$1,true)",[previous]); }

 await assertWidgetSourcesCurrent(db,context.workspace,context.context.map(source=>source.citation.versionId));
 await assertAiRuleSnapshotCurrent(db,context.rules);
 await appendMessage(db,{workspace:context.workspace,conversation:context.conversation,clientId:context.clientId,author:'ai',visibility:'public',body:output,ownerVersion:context.version});
 // The assistant message and dispatch receipt are committed together.  If
 // usage accounting fails, the whole transaction rolls back and remains
 // unknown; a retry must never invoke the provider again.
 if(context.dispatchClaimed)await confirmDispatch(db,context.workspace,context.clientId);
 const metered=normalizeTokenUsage(usage,context.context.length?workspacePrompt(context.message,context.context,context.history,context.rules.rules):context.message,output);
 const promptRate=BigInt(process.env.GOTEK_PROMPT_MICROS_PER_1K||'0'),completionRate=BigInt(process.env.GOTEK_COMPLETION_MICROS_PER_1K||'0');
 await recordUsage(db,{workspaceId:context.workspace,operationKey:context.clientId,provider:context.providerId,model:context.modelId,usage:metered,costMicros:costMicros(metered,{promptMicrosPer1k:promptRate,completionMicrosPer1k:completionRate})});
 if(context.quotaId)await settleUsage(db,context.workspace,context.quotaId,'confirmed',1,`ai:${context.clientId}`);
 return {receipt:`ai:${context.conversation}:${context.clientId}`};
}
/**
 * Claims the irreversible provider dispatch.  This row is deliberately
 * separate from jobs: scheduler leases are retry hints, whereas an external
 * provider call has no reliable cancellation/receipt boundary.  Once claimed,
 * a duplicate must remain unknown rather than invoking the provider again.
 */
async function claimDispatch(db:PoolClient,workspace:string,clientId:string){
 const inserted=await db.query(`INSERT INTO ai_reply_dispatches(workspace_id,client_id,state)
   VALUES($1,$2,'unknown') ON CONFLICT (workspace_id,client_id) DO NOTHING RETURNING state`,[workspace,clientId]);
 if(inserted.rowCount)return 'claimed' as const;
 const row=(await db.query(`SELECT state FROM ai_reply_dispatches WHERE workspace_id=$1 AND client_id=$2 FOR SHARE`,[workspace,clientId])).rows[0];
 if(row?.state==='confirmed')return 'confirmed' as const;
 throw new HttpError(409,'AI_DISPATCH_UNKNOWN');
}
async function assertDispatchAvailable(db:PoolClient,workspace:string,clientId:string){
 const row=(await db.query(`SELECT state FROM ai_reply_dispatches WHERE workspace_id=$1 AND client_id=$2`,[workspace,clientId])).rows[0];
 if(row?.state==='unknown')throw new HttpError(409,'AI_DISPATCH_UNKNOWN');
 return row?.state==='confirmed'?'confirmed' as const:'new' as const;
}
async function confirmDispatch(db:PoolClient,workspace:string,clientId:string){
 const changed=await db.query(`UPDATE ai_reply_dispatches SET state='confirmed',completed_at=clock_timestamp()
   WHERE workspace_id=$1 AND client_id=$2 AND state='unknown'`,[workspace,clientId]);
 if(!changed.rowCount)throw new HttpError(409,'AI_DISPATCH_UNKNOWN');
}
export function aiReplyHandler(db:PoolClient,invoke:Invoke){
 return async(job:AiJob)=>{
  const context=await prepare(db,job);
  if(context.existing)return {receipt:`ai:${context.conversation}:${context.clientId}`};
  let result:Awaited<ReturnType<Invoke>>;
  try {
   result=await invoke({workspace:context.workspace,conversation:context.conversation,message:context.message,modelId:context.modelId,...(context.history.length?{history:context.history}:{}),...(context.rules.rules.length?{rules:context.rules.rules}:{}),...(context.context.length?{context:context.context}: {})});
  } catch(error) {
   if(context.quotaId)await settleUsage(db,context.workspace,context.quotaId!,'unknown');
   throw error;
  }
  const output=typeof result==='string'?result:result.text;
  return commit(db,context,output,typeof result==='string'?undefined:result.usage);
 };
}
/** Trusted scheduler handler. No database transaction spans provider I/O. */
export function transactionalAiReplyHandler(invoke:Invoke){
 return async(job:AiJob)=>{
  const scoped=<T>(fn:(db:PoolClient)=>Promise<T>)=>transaction(async db=>{await scope(db,job.workspace_id);
   if(!(await db.query("SELECT id FROM workspaces WHERE id=$1 AND status='active' FOR SHARE",[job.workspace_id])).rowCount)throw new HttpError(409,'WORKSPACE_DISABLED');
   return fn(db);});
  const checkLease=async(db:PoolClient)=>{
   if(!job.id||!job.lease_token)throw new HttpError(409,'STALE_JOB_LEASE');
   const live=await db.query("SELECT id FROM jobs WHERE id=$1 AND workspace_id=$2 AND state='running' AND lease_token=$3 AND lease_until>clock_timestamp() FOR UPDATE",[job.id,job.workspace_id,job.lease_token]);
   if(!live.rowCount)throw new HttpError(409,'STALE_JOB_LEASE');
  };
  const context=await scoped(async db=>{if(job.id)await checkLease(db);return prepare(db,job,false);});
  if(context.existing)return {receipt:`ai:${context.conversation}:${context.clientId}`};
  // Reject a prior ambiguous dispatch before any embedding/provider network
  // call.  The insert below remains the race-safe winner election.
  const available=await scoped(db=>assertDispatchAvailable(db,context.workspace,context.clientId));
  if(available==='confirmed')return {receipt:`ai:${context.conversation}:${context.clientId}`};
  if(context.embeddingModelId){
   try {
    const semantic=await retrieveEmbeddedContext({workspace:context.workspace,modelId:context.embeddingModelId,message:context.message,history:context.history,limit:5});
    if(semantic.sources.length){context.context=semantic.sources;context.usedEmbeddingModelId=context.embeddingModelId;}
   } catch(error) {
    const code=error instanceof HttpError?error.code:error instanceof Error?error.message:'';
    const fallback=/^PROVIDER_HTTP_[45][0-9]{2}$/.test(code)||['PROVIDER_SECRET_MISSING','PROVIDER_TIMEOUT','PROVIDER_NETWORK_ERROR','PROVIDER_INVALID_RESPONSE','PROVIDER_EMPTY_RESPONSE'].includes(code);
    if(!fallback)throw error;
   }
  }
  await scoped(async db=>{
   if(job.id)await checkLease(db);
   const owner=(await db.query('SELECT reply_owner,owner_version FROM conversations WHERE workspace_id=$1 AND id=$2 FOR SHARE',[context.workspace,context.conversation])).rows[0];
   if(!owner||owner.reply_owner!=='AI_ACTIVE'||owner.owner_version!==context.version)throw new HttpError(409,'STALE_REPLY_OWNER');
   await assertWidgetSourcesCurrent(db,context.workspace,context.context.map(source=>source.citation.versionId));
  });
  if(job.payload.requireGrounded===true&&!context.context.length)throw new HttpError(409,'AI_KNOWLEDGE_NOT_FOUND');
  const dispatchStatus=await scoped(async db=>{
   if(job.id)await checkLease(db);
   const owner=(await db.query('SELECT reply_owner,owner_version FROM conversations WHERE workspace_id=$1 AND id=$2 FOR SHARE',[context.workspace,context.conversation])).rows[0];
   if(!owner||owner.reply_owner!=='AI_ACTIVE'||owner.owner_version!==context.version)throw new HttpError(409,'STALE_REPLY_OWNER');
   await assertWidgetSourcesCurrent(db,context.workspace,context.context.map(source=>source.citation.versionId));
   await assertAiRuleSnapshotCurrent(db,context.rules);
   const claimed=await claimDispatch(db,context.workspace,context.clientId);
   if(claimed==='claimed'&&!context.existing){context.dispatchClaimed=true;context.quotaId=(await reserveAiResponse(db,context.workspace,context.clientId))?.id;}
   return claimed;
  });
  if(dispatchStatus==='confirmed')return {receipt:`ai:${context.conversation}:${context.clientId}`};
  let result:string|AiProviderResult;
  try {
   result=await invoke({workspace:context.workspace,conversation:context.conversation,message:context.message,modelId:context.modelId,...(context.history.length?{history:context.history}:{}),...(context.rules.rules.length?{rules:context.rules.rules}:{}),...(context.context.length?{context:context.context}: {})});
  } catch(error) {
   // The dispatch fence, rather than the scheduler lease, owns settlement.
   // A lost lease cannot turn an already-attempted provider call into a retry.
   if(context.quotaId)await transaction(async db=>{await scope(db,context.workspace);await settleUsage(db,context.workspace,context.quotaId!,'unknown');});
   throw error;
  }
  const output=typeof result==='string'?result:result.text;
  // A durable dispatch prevents resend; an active job lease still gates publishing.
  try {
   return await scoped(async db=>{if(job.id)await checkLease(db);return commit(db,context,output,typeof result==='string'?undefined:result.usage);});
  } catch(error) {
   if(context.quotaId)await transaction(async db=>{await scope(db,context.workspace);return settleUsage(db,context.workspace,context.quotaId!,'unknown');});
   throw error;
  }
 };
}
