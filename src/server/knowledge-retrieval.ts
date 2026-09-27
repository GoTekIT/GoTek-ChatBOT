import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';import {z} from 'zod';import {HttpError} from './security';
const query=z.object({query:z.string().trim().min(1).max(500),audience:z.enum(['PUBLIC','INTERNAL']).default('PUBLIC'),limit:z.coerce.number().int().min(1).max(20).default(5)}).strict();
const embedding=z.array(z.number().finite()).min(1).max(4096).refine(v=>v.some(x=>x!==0),'Embedding must be nonzero');
export type RetrievalOptions={embedding?:number[];embeddingModel?:string;history?:unknown[]};

const historyEntry=z.object({role:z.enum(['visitor','agent','ai']),content:z.string().trim().min(1).max(10000)}).strict();
function meaningfulTerms(text:string){
 const stopwords=new Set('cho tôi mình bạn xin hỏi là có không được của và thì bao lâu như thế nào please what is the how long does a an còn nữa vậy'.split(' '));
 return [...new Set(text.toLocaleLowerCase('vi-VN').normalize('NFC').match(/[\p{L}\p{N}]+/gu)??[])].filter(term=>term.length>1&&!stopwords.has(term));
}
function contextualLexicalQuery(current:string,rawHistory:unknown[]|undefined){
 const currentTerms=meaningfulTerms(current);
 if(!rawHistory?.length)return {terms:currentTerms,query:currentTerms.map(term=>`'${term}'`).join(' & ')};
 const history=rawHistory.flatMap(item=>{const parsed=historyEntry.safeParse(item);return parsed.success&&parsed.data.role==='visitor'?[parsed.data.content]:[]}).slice(-6);
 // Preserve the exact current-question query whenever it contains useful terms.
 if(currentTerms.length>=2)return {terms:currentTerms,query:currentTerms.map(term=>`'${term}'`).join(' & ')};
 const groups=[currentTerms,...history.map(meaningfulTerms)].filter(group=>group.length);
 const unique=groups.flatMap(group=>group).filter((term,index,array)=>array.indexOf(term)===index);
 return {terms:unique,query:groups.map(group=>group.map(term=>`'${term}'`).join(' & ')).join(' | ')};
}

/** Cosine similarity used by the pgvector-independent local/test path. */
export function cosineSimilarity(a:number[],b:number[]){
 if(a.length!==b.length||!a.length)return 0;
 let dot=0,an=0,bn=0; for(let i=0;i<a.length;i++){dot+=a[i]*b[i];an+=a[i]*a[i];bn+=b[i]*b[i];}
 return an&&bn?dot/Math.sqrt(an*bn):0;
}

export function rankEmbeddedKnowledge(rows:any[],queryVector:number[],limit:number){
 const q=embedding.parse(queryVector);
 return rows.flatMap(row=>{
   const parsed=embedding.safeParse(row.embedding);
   if(!parsed.success||parsed.data.length!==q.length)return [];
   const vector=parsed.data;
   return [{...row,semanticScore:cosineSimilarity(vector,q)}];
 }).sort((a,b)=>b.semanticScore-a.semanticScore||String(a.item_id).localeCompare(String(b.item_id))).slice(0,limit);
}
export async function retrieveKnowledge(db:PoolClient,workspace:string,body:unknown){const q=query.parse(body);const rows=(await db.query(`SELECT i.id AS item_id,i.published_version_id,v.title,v.content,i.audience FROM knowledge_items i JOIN knowledge_versions v ON v.id=i.published_version_id AND v.workspace_id=i.workspace_id AND v.state='READY' WHERE i.workspace_id=$1 AND i.active AND i.audience=$2 AND (strpos(lower(v.title),lower($3))>0 OR strpos(lower(v.content),lower($3))>0) ORDER BY i.updated_at DESC,i.id LIMIT $4`,[workspace,q.audience,q.query,q.limit])).rows;return {query:q.query,audience:q.audience,items:rows.map((r:any)=>({knowledgeItemId:r.item_id,versionId:r.published_version_id,title:r.title,content:r.content,citation:{source:'knowledge',title:r.title,versionId:r.published_version_id,audience:r.audience}}))};}
export async function retrieveKnowledgeForWidget(db:PoolClient,workspace:string,body:unknown){const result=await retrieveKnowledge(db,workspace,{...(body as object),audience:'PUBLIC'});if(!result.items.length)throw new HttpError(404,'NO_PUBLISHED_SOURCE');return result;}

/**
 * Build the bounded, public-only context that a trusted widget AI worker may
 * pass to a provider.  This deliberately returns structured sources instead
 * of a ready-made prompt so the provider adapter can add its own untrusted
 * context delimiters.  The workspace identifier never leaves this function's
 * database predicate and draft/internal sources can never be selected.
 */
export async function buildWidgetAiContext(db:PoolClient,workspace:string,message:unknown,limit=5,options:RetrievalOptions={}){
 const text=z.string().trim().min(1).max(10000).parse(message);
 const q=query.parse({query:text.slice(0,500),audience:'PUBLIC',limit});
 const contextual=contextualLexicalQuery(q.query,options.history);
 const requestedEmbedding=options.embedding===undefined?undefined:embedding.parse(options.embedding);
 if(requestedEmbedding){
  const embeddingModel=z.string().trim().min(1).max(180).parse(options.embeddingModel);
  const rows=(await db.query(`SELECT i.id AS item_id,i.published_version_id,v.title,c.content,c.content_hash,c.chunk_index,c.embedding,i.audience
   FROM knowledge_items i JOIN knowledge_versions v ON v.id=i.published_version_id AND v.workspace_id=i.workspace_id AND v.state='READY'
   JOIN knowledge_chunks c ON c.version_id=v.id AND c.workspace_id=i.workspace_id
   WHERE i.workspace_id=$1 AND i.active AND i.audience='PUBLIC' AND c.embedding IS NOT NULL AND c.embedded_at IS NOT NULL
   AND c.embedding_model=$2 AND c.embedding_dimensions=$3
   AND c.content_hash=encode(sha256(convert_to(c.content,'UTF8')),'hex')`,[workspace,embeddingModel,requestedEmbedding.length])).rows;
  const ranked=rankEmbeddedKnowledge(rows,requestedEmbedding,q.limit);
  let remaining=16000;
  return {query:q.query,sources:ranked.flatMap((r:any)=>{if(remaining<=0)return [];const content=r.content.slice(0,Math.min(4000,remaining));remaining-=content.length;return [{source:'knowledge',title:r.title,content,truncated:content.length<r.content.length,citation:{source:'knowledge',title:r.title,versionId:r.published_version_id,audience:r.audience}}]})};
 }
 // Lexical chunk retrieval: this is not semantic/embedding search.
 const stopwords=new Set('cho tôi mình bạn xin hỏi là có không được của và thì bao lâu như thế nào please what is the how long does a an'.split(' '));
 const terms=contextual.terms;
 const lexical=contextual.query;
 if(!lexical)return {query:q.query,sources:[]};
 const rows=(await db.query(`SELECT i.id AS item_id,i.published_version_id,v.title,COALESCE(c.content,v.content) AS content,c.content_hash,c.chunk_index,i.audience
 FROM knowledge_items i
 JOIN knowledge_versions v ON v.id=i.published_version_id AND v.workspace_id=i.workspace_id AND v.state='READY'
 LEFT JOIN knowledge_chunks c ON c.version_id=v.id AND c.workspace_id=i.workspace_id
 WHERE i.workspace_id=$1 AND i.active AND i.audience=$2 AND $3::text IS NOT NULL
 AND (c.chunk_index IS NULL OR c.content_hash=encode(sha256(convert_to(c.content,'UTF8')),'hex'))
 AND to_tsvector('simple',v.title||' '||COALESCE(c.content,v.content)) @@ to_tsquery('simple',$4)
 ORDER BY ts_rank_cd(to_tsvector('simple',v.title||' '||COALESCE(c.content,v.content)),to_tsquery('simple',$4)) DESC,i.id,c.chunk_index
 LIMIT $5`,[workspace,'PUBLIC',q.query,lexical,q.limit])).rows;
 const result={items:rows.filter((r:any)=>r.chunk_index==null||createHash('sha256').update(r.content).digest('hex')===r.content_hash).map((r:any)=>({title:r.title,content:r.content,citation:{source:'knowledge',title:r.title,versionId:r.published_version_id,audience:r.audience}}))};
 let remaining=16000;
 return {
  query:q.query,
  sources:result.items.flatMap(item=>{
   if(remaining<=0)return [];
   const content=item.content.slice(0,Math.min(4000,remaining));remaining-=content.length;
   return [{
   source:item.citation.source,
   title:item.title,
   content,
   truncated:content.length<item.content.length,
   citation:item.citation
  }];})
 };
}

/** Recheck and hold publication locks until the reply transaction commits. */
export async function assertWidgetSourcesCurrent(db:PoolClient,workspace:string,versionIds:string[]){
 const ids=[...new Set(versionIds)].sort();
 if(!ids.length)return;
 const rows=(await db.query(`SELECT v.id FROM knowledge_items i
 JOIN knowledge_versions v ON v.id=i.published_version_id AND v.workspace_id=i.workspace_id
 WHERE i.workspace_id=$1 AND v.id=ANY($2::uuid[]) AND i.active AND i.audience='PUBLIC' AND v.state='READY'
 ORDER BY i.id FOR SHARE OF i,v`,[workspace,ids])).rows;
 if(rows.length!==ids.length)throw new HttpError(409,'AI_KNOWLEDGE_REVOKED');
}
