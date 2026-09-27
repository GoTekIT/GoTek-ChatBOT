import type {PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {HttpError} from './security';
import {chunkKnowledgeText,rankKnowledgeChunks,selectChunkContext,type KnowledgeChunk} from './knowledge-chunks';

const embeddingResult=z.object({versionId:z.string().uuid(),chunkIndex:z.number().int().nonnegative(),contentHash:z.string().regex(/^[a-f0-9]{64}$/),model:z.string().trim().min(1).max(180),vector:z.array(z.number().finite()).min(1).max(4096).refine(v=>v.some(n=>n!==0))}).strict();
/** Trusted ingestion worker only. Caller resolves the model grant and scopes the transaction.
 * Compare the original content hash at commit so a delayed inference cannot
 * attach its vector to a replacement chunk at the same index.
 */
export async function storeKnowledgeEmbedding(db:PoolClient,workspace:string,result:unknown){
 const d=embeddingResult.parse(result);
 const updated=await db.query(`UPDATE knowledge_chunks c SET embedding=$5::jsonb,embedding_model=$6,embedding_dimensions=$7,embedded_at=now()
 FROM knowledge_versions v WHERE c.workspace_id=$1 AND c.version_id=$2 AND c.chunk_index=$3 AND c.content_hash=$4
 AND c.content_hash=encode(sha256(convert_to(c.content,'UTF8')),'hex')
 AND v.id=c.version_id AND v.workspace_id=c.workspace_id AND v.state='READY'
 RETURNING c.version_id,c.chunk_index,c.embedding_model,c.embedding_dimensions`,[workspace,d.versionId,d.chunkIndex,d.contentHash,JSON.stringify(d.vector),d.model,d.vector.length]);
 if(!updated.rowCount)throw new HttpError(409,'EMBEDDING_SOURCE_CHANGED');
 return updated.rows[0];
}

/** Rebuilds deterministic chunks for a version; callers must already scope the tenant. */
export async function replaceKnowledgeChunks(db:PoolClient,workspaceId:string,versionId:string,content:string){
 const chunks=chunkKnowledgeText(content,{maxChars:900,overlapChars:120});
 await db.query('DELETE FROM knowledge_chunks WHERE workspace_id=$1 AND version_id=$2',[workspaceId,versionId]);
 for(const chunk of chunks)await db.query('INSERT INTO knowledge_chunks(workspace_id,version_id,chunk_index,content,token_estimate,content_hash) VALUES($1,$2,$3,$4,$5,$6)',[workspaceId,versionId,chunk.index,chunk.text,chunk.tokenEstimate,createHash('sha256').update(chunk.text).digest('hex')]);
 return {versionId,chunks:chunks.length};
}

/** Reads only chunks belonging to a published version in the scoped tenant. */
export async function retrieveStoredChunks(db:PoolClient,workspaceId:string,versionId:string,query:string,limit=8){
 const rows=(await db.query('SELECT c.chunk_index AS chunk_index,c.content AS content,c.token_estimate AS token_estimate,c.content_hash AS content_hash FROM knowledge_chunks c JOIN knowledge_versions v ON v.id=c.version_id AND v.workspace_id=c.workspace_id WHERE c.workspace_id=$1 AND c.version_id=$2 AND v.state=\'READY\' ORDER BY c.chunk_index',[workspaceId,versionId])).rows;
 const chunks:KnowledgeChunk[]=rows.filter((r:any)=>createHash('sha256').update(String(r.content)).digest('hex')===String(r.content_hash)).map((r:any)=>({index:Number(r.chunk_index),text:r.content,start:0,end:r.content.length,tokenEstimate:Number(r.token_estimate)}));
 return selectChunkContext(rankKnowledgeChunks(query,chunks,limit));
}
