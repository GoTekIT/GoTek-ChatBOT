import type {PoolClient} from 'pg';
import {z} from 'zod';
import {transaction,scope,pool} from '../../core/db';
import {HttpError} from '../../core/security';
import {storeKnowledgeEmbedding} from './knowledge-chunk-store';
import {assertWidgetSourcesCurrent,buildWidgetAiContext} from './knowledge-retrieval';
import {invokeEmbedding} from '../../modules/ai/provider-transport';

async function granted(db:PoolClient,workspace:string,modelId:string){
 if(!(await db.query("SELECT id FROM workspaces WHERE id=$1 AND status='active' FOR SHARE",[workspace])).rowCount)throw new HttpError(409,'WORKSPACE_DISABLED');
 const previous=(await db.query("SELECT current_setting('app.platform',true) AS enabled")).rows[0]?.enabled||'';
 try{
  await db.query("SELECT set_config('app.platform','true',true)");
  const row=(await db.query(`SELECT p.adapter,p.base_url,p.secret_ref,m.name FROM model_grants g JOIN models m ON m.id=g.model_id JOIN providers p ON p.id=m.provider_id
   WHERE g.workspace_id=$1 AND g.model_id=$2 AND g.capability='embedding' AND g.active AND (g.expires_at IS NULL OR g.expires_at>clock_timestamp()) AND m.enabled AND p.enabled AND 'embedding'=ANY(m.capabilities) FOR SHARE OF g,m,p`,[workspace,modelId])).rows[0];
  if(!row)throw new HttpError(403,'MODEL_NOT_GRANTED');
  if(!['openai','chatgpt','custom_llm','gemini'].includes(row.adapter))throw new HttpError(409,'EMBEDDING_ADAPTER_UNSUPPORTED');
  return row;
 }finally{await db.query("SELECT set_config('app.platform',$1,true)",[previous]);}
}
/** Trusted local worker entry point, never accepts credentials from a workspace client.
 * Completed chunks survive later failure; reruns skip them. Multi-tenant scheduling
 * and crash-after-provider cost reconciliation remain separate responsibilities.
 */
async function performEmbeddingBatch(input:unknown,invoke:typeof invokeEmbedding=invokeEmbedding){
 const d=z.object({workspace:z.string().uuid(),versionId:z.string().uuid(),modelId:z.string().uuid(),limit:z.number().int().min(1).max(100).default(20)}).strict().parse(input);
 const scoped=<T>(fn:(db:PoolClient)=>Promise<T>)=>transaction(async db=>{await scope(db,d.workspace);return fn(db);});
 const prepared=await scoped(async db=>{
  const model=await granted(db,d.workspace,d.modelId);
  await assertWidgetSourcesCurrent(db,d.workspace,[d.versionId]);
  const chunks=(await db.query(`SELECT chunk_index,content,content_hash FROM knowledge_chunks WHERE workspace_id=$1 AND version_id=$2
   AND (embedding IS NULL OR embedded_at IS NULL OR embedding_model IS DISTINCT FROM $3)
   AND content_hash=encode(sha256(convert_to(content,'UTF8')),'hex') ORDER BY chunk_index LIMIT $4`,[d.workspace,d.versionId,d.modelId,d.limit])).rows;
  return {model,chunks};
 });
 let stored=0;
 for(const chunk of prepared.chunks){
  // Re-read the source immediately before provider I/O. A publication or
  // content edit can happen after batch selection; do not spend provider
  // quota on a chunk that is no longer current.
  const current=await scoped(async db=>{
   await assertWidgetSourcesCurrent(db,d.workspace,[d.versionId]);
   const live=(await db.query(`SELECT content_hash FROM knowledge_chunks
    WHERE workspace_id=$1 AND version_id=$2 AND chunk_index=$3
      AND content_hash=encode(sha256(convert_to(content,'UTF8')),'hex')`,
    [d.workspace,d.versionId,chunk.chunk_index])).rows[0];
   if(!live||live.content_hash!==chunk.content_hash)throw new HttpError(409,'EMBEDDING_SOURCE_CHANGED');
   return granted(db,d.workspace,d.modelId);
  });
  const secret=process.env[current.secret_ref];if(!secret)throw new HttpError(409,'PROVIDER_SECRET_MISSING');
  const result=await invoke(current.adapter,current.name,current.base_url,secret,chunk.content);
  await scoped(async db=>{
   const live=await granted(db,d.workspace,d.modelId);
   if(live.name!==current.name||live.adapter!==current.adapter||live.base_url!==current.base_url)throw new HttpError(409,'AI_MODEL_REVOKED');
   await assertWidgetSourcesCurrent(db,d.workspace,[d.versionId]);
   await storeKnowledgeEmbedding(db,d.workspace,{versionId:d.versionId,chunkIndex:chunk.chunk_index,contentHash:chunk.content_hash,model:d.modelId,vector:result.vector});
  });stored++;
 }
 return {versionId:d.versionId,modelId:d.modelId,stored};
}

/** Trusted query pipeline. Returned sources remain untrusted data for the chat prompt. */
export function buildEmbeddingQuery(message:string,history:unknown[]=[]){
 const visitorHistory=history.filter((entry):entry is {role:'visitor';content:string}=>{
  if(!entry||typeof entry!=='object')return false;
  const value=entry as {role?:unknown;content?:unknown};
  return value.role==='visitor'&&typeof value.content==='string'&&value.content.trim().length>0;
 }).slice(-6);
 if(!visitorHistory.length)return message;
 const parts=[...visitorHistory.map(item=>item.content.trim()),message];
 let budget=6000; const kept:string[]=[];
 for(let i=parts.length-1;i>=0;i--){
  const separator=kept.length?1:0;
  const value=parts[i].slice(0,Math.max(0,budget-separator)); if(!value)continue;
  kept.unshift(value); budget-=value.length+separator; if(budget<=0)break;
 }
 return kept.join('\n');
}

export async function retrieveEmbeddedContext(input:unknown,invoke:typeof invokeEmbedding=invokeEmbedding){
 const d=z.object({workspace:z.string().uuid(),modelId:z.string().uuid(),message:z.string().trim().min(1).max(10000),history:z.array(z.unknown()).max(12).optional(),limit:z.number().int().min(1).max(20).default(5)}).strict().parse(input);
 const query=buildEmbeddingQuery(d.message,d.history||[]);
 const scoped=<T>(fn:(db:PoolClient)=>Promise<T>)=>transaction(async db=>{await scope(db,d.workspace);return fn(db);});
 const model=await scoped(db=>granted(db,d.workspace,d.modelId));
 const secret=process.env[model.secret_ref];if(!secret)throw new HttpError(409,'PROVIDER_SECRET_MISSING');
 const result=await invoke(model.adapter,model.name,model.base_url,secret,query);
 return scoped(async db=>{
  const live=await granted(db,d.workspace,d.modelId);
  if(live.name!==model.name||live.adapter!==model.adapter||live.base_url!==model.base_url)throw new HttpError(409,'AI_MODEL_REVOKED');
  return buildWidgetAiContext(db,d.workspace,d.message,d.limit,{embedding:result.vector,embeddingModel:d.modelId});
 });
}

/** One active batch per version, even across different models: each chunk has one vector slot.
 * Session lock survives short transactions, but does not hold a transaction during I/O.
 */
export async function embedKnowledgeBatch(input:unknown,invoke:typeof invokeEmbedding=invokeEmbedding){
 const identity=z.object({workspace:z.string().uuid(),versionId:z.string().uuid()}).passthrough().parse(input);
 const lockKey=`knowledge-embedding:${identity.workspace}:${identity.versionId}`;
 const client=await pool.connect();
 let locked=false,destroy=false;
 try{
  locked=(await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',[lockKey])).rows[0].locked;
  if(!locked)throw new HttpError(409,'EMBEDDING_BATCH_BUSY');
  return await performEmbeddingBatch(input,invoke);
 }finally{
  if(locked){try{await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lockKey]);}catch{destroy=true;}}
  client.release(destroy);
 }
}
