import {assertKnowledgeCategory} from './knowledge-categories';
import type {PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {HttpError,audit,requireRole,uuid} from '../../core/security';
const text=(max:number)=>z.string().trim().refine(v=>Array.from(v).length>=1&&Array.from(v).length<=max,`Phải có từ 1 đến ${max} ký tự`);
const fields={title:text(100),content:text(2000),categoryId:z.string().uuid().nullable().optional()};
const createSchema=z.object({...fields,requestId:z.string().uuid(),active:z.boolean().default(true)}).strict();
const updateSchema=z.object({...fields,requestId:z.string().uuid(),expectedRevision:z.number().int().positive()}).strict();
const projection=`i.id,i.active,i.audience,i.revision,i.draft_version_id,i.published_version_id,i.source_type,i.created_at,i.updated_at,v.title,v.content,v.state,i.category_id`;
async function read(db:PoolClient,workspace:string,id:string){return (await db.query(`SELECT ${projection} FROM knowledge_items i JOIN knowledge_versions v ON v.id=i.draft_version_id AND v.workspace_id=i.workspace_id WHERE i.workspace_id=$1 AND i.id=$2`,[workspace,id])).rows[0];}
async function replay(db:PoolClient,actor:any,requestId:string,operation:string,payload:unknown){
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`knowledge:${actor.workspace_id}:${requestId}`]);
 const old=(await db.query('SELECT operation,payload=$3::jsonb AS same,response FROM knowledge_mutations WHERE workspace_id=$1 AND request_id=$2',[actor.workspace_id,requestId,payload])).rows[0];
 if(old){if(old.operation!==operation||!old.same)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');return old.response;}
}
async function finish(db:PoolClient,actor:any,requestId:string,operation:string,payload:unknown,id:string){
 await audit(db,actor.workspace_id,actor.user_id,operation,id);
 const response=await read(db,actor.workspace_id,id);
 await db.query('INSERT INTO knowledge_mutations(workspace_id,request_id,operation,payload,response) VALUES($1,$2,$3,$4,$5)',[actor.workspace_id,requestId,operation,payload,response]);return response;
}
async function version(db:PoolClient,actor:any,itemId:string,number:number,data:{title:string;content:string}){
 const id=uuid();await db.query('INSERT INTO knowledge_versions(id,workspace_id,item_id,version_no,title,content,content_hash,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,actor.workspace_id,itemId,number,data.title,data.content,createHash('sha256').update(JSON.stringify([data.title,data.content])).digest('hex'),actor.user_id]);return id;
}
export async function createKnowledge(db:PoolClient,actor:any,body:unknown){
 requireRole(actor.role);const data=createSchema.parse(body),payload={title:data.title,content:data.content,active:data.active,categoryId:data.categoryId??null};
 const old=await replay(db,actor,data.requestId,'knowledge.created',payload);if(old)return old;
 await assertKnowledgeCategory(db,actor.workspace_id,data.categoryId);
 const id=uuid();await db.query('INSERT INTO knowledge_items(id,workspace_id,active,created_by,category_id) VALUES($1,$2,$3,$4,$5)',[id,actor.workspace_id,data.active,actor.user_id,data.categoryId??null]);
 const draft=await version(db,actor,id,1,data);await db.query('UPDATE knowledge_items SET draft_version_id=$1 WHERE workspace_id=$2 AND id=$3',[draft,actor.workspace_id,id]);
 return finish(db,actor,data.requestId,'knowledge.created',payload,id);
}
export async function updateKnowledge(db:PoolClient,actor:any,id:string,body:unknown){
 requireRole(actor.role);id=z.string().uuid().parse(id);const data=updateSchema.parse(body),payload={id,title:data.title,content:data.content,expectedRevision:data.expectedRevision,...(data.categoryId===undefined?{}:{categoryId:data.categoryId})};
 const old=await replay(db,actor,data.requestId,'knowledge.draft_updated',payload);if(old)return old;
 const item=(await db.query('SELECT revision,category_id FROM knowledge_items WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[actor.workspace_id,id])).rows[0];
 if(!item)throw new HttpError(404,'NOT_FOUND');if(item.revision!==data.expectedRevision)throw new HttpError(409,'VERSION_CONFLICT');
 await assertKnowledgeCategory(db,actor.workspace_id,data.categoryId);
 const number=Number((await db.query('SELECT max(version_no)+1 AS n FROM knowledge_versions WHERE workspace_id=$1 AND item_id=$2',[actor.workspace_id,id])).rows[0].n);
 const draft=await version(db,actor,id,number,data);await db.query('UPDATE knowledge_items SET draft_version_id=$1,category_id=$4,revision=revision+1,updated_at=now() WHERE workspace_id=$2 AND id=$3',[draft,actor.workspace_id,id,data.categoryId===undefined?item.category_id:data.categoryId]);
 return finish(db,actor,data.requestId,'knowledge.draft_updated',payload,id);
}
export async function listKnowledge(db:PoolClient,actor:any,query:unknown){
 requireRole(actor.role);const q=z.object({categoryId:z.string().uuid().optional(),search:z.string().trim().max(200).optional(),active:z.enum(['true','false']).optional(),source:z.enum(['MANUAL','WEB']).optional(),sort:z.enum(['newest','oldest']).default('newest'),cursor:z.string().uuid().optional(),limit:z.coerce.number().int().min(1).max(100).default(25)}).strict().parse(query);
 const params:any[]=[actor.workspace_id],where=['i.workspace_id=$1'];
 if(q.source){params.push(q.source);where.push(`i.source_type=$${params.length}`);}
 if(q.categoryId){params.push(q.categoryId);where.push(`i.category_id=$${params.length}`);}
 if(q.search){params.push(`%${q.search.replace(/[\\%_]/g,'\\$&')}%`);where.push(`(v.title ILIKE $${params.length} OR v.content ILIKE $${params.length})`);}
 if(q.active){params.push(q.active==='true');where.push(`i.active=$${params.length}`);}
 if(q.cursor){const anchor=(await db.query('SELECT created_at FROM knowledge_items WHERE workspace_id=$1 AND id=$2',[actor.workspace_id,q.cursor])).rows[0];if(!anchor)throw new HttpError(400,'VALIDATION_ERROR');params.push(q.cursor);where.push(`(i.created_at,i.id) ${q.sort==='newest'?'<':'>'} (SELECT created_at,id FROM knowledge_items WHERE workspace_id=$1 AND id=$${params.length}::uuid)`);}
 params.push(q.limit+1);const order=q.sort==='newest'?'DESC':'ASC';
 const rows=(await db.query(`SELECT ${projection} FROM knowledge_items i JOIN knowledge_versions v ON v.id=i.draft_version_id AND v.workspace_id=i.workspace_id WHERE ${where.join(' AND ')} ORDER BY i.created_at ${order},i.id ${order} LIMIT $${params.length}`,params)).rows;
 const more=rows.length>q.limit;return {items:rows.slice(0,q.limit),nextCursor:more?rows[q.limit-1].id:null};
}

/** Read one knowledge item and its immutable version history within the caller workspace. */
export async function getKnowledge(db:PoolClient,actor:any,id:string){
 requireRole(actor.role);const itemId=z.string().uuid().parse(id);
 const item=(await db.query(`SELECT ${projection},i.published_at,i.published_by FROM knowledge_items i JOIN knowledge_versions v ON v.id=i.draft_version_id AND v.workspace_id=i.workspace_id WHERE i.workspace_id=$1 AND i.id=$2`,[actor.workspace_id,itemId])).rows[0];
 if(!item)throw new HttpError(404,'NOT_FOUND');
 const versions=(await db.query(`SELECT id,version_no,title,content,state,first_published_at,created_by,created_at,processed_at FROM knowledge_versions WHERE workspace_id=$1 AND item_id=$2 ORDER BY version_no DESC,id DESC`,[actor.workspace_id,itemId])).rows;
 return {...item,versions};
}


/** Batch FAQ/data import for workspace owners. Each row follows the same draft contract and remains unpublished until explicitly processed/published. */
export async function importKnowledgeBatch(db:PoolClient,actor:any,body:unknown){
 requireRole(actor.role);
 const data=z.object({items:z.array(z.object({title:text(100),content:text(2000),categoryId:z.string().uuid().nullable().optional(),active:z.boolean().default(true),requestId:z.string().uuid()})).min(1).max(100)}).strict().parse(body);
 const created=[];
 for(const item of data.items) created.push(await createKnowledge(db,actor,item));
 return {items:created,imported:created.length,state:'DRAFT'};
}


/** Parse a bounded UTF-8 text/CSV FAQ payload into the same draft import contract. */
function parseCsvLine(line:string){const out:string[]=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){out.push(value.trim());value='';}else value+=ch;}if(quoted)throw new HttpError(400,'CSV_UNCLOSED_QUOTE');out.push(value.trim());return out;}
export async function importKnowledgeFile(db:PoolClient,actor:any,body:unknown){
 requireRole(actor.role);
 const data=z.object({filename:z.string().trim().min(1).max(180),content:z.string().min(1).max(120000),categoryId:z.string().uuid().nullable().optional()}).strict().parse(body);
 const ext=data.filename.toLowerCase().split('.').pop();
 if(!['txt','md','csv','json'].includes(ext||''))throw new HttpError(415,'UNSUPPORTED_KNOWLEDGE_FILE');
 let rows:{title:string;content:string;categoryId:string|null|undefined;active:boolean;requestId:string}[]=[];
 if(ext==='json'){
  let parsed:unknown;
  try { parsed=JSON.parse(data.content); } catch { throw new HttpError(400,'INVALID_KNOWLEDGE_JSON'); }
  const list=z.array(z.object({title:text(100),content:text(2000)}).strict()).max(100).parse(parsed);
  rows=list.map(x=>({...x,categoryId:data.categoryId,active:true,requestId:uuid()}));
 } else if(ext==='csv'){
  const lines=data.content.split(/\r?\n/).filter(Boolean);if(!lines.length)throw new HttpError(400,'EMPTY_KNOWLEDGE_FILE');
  const header=parseCsvLine(lines.shift()!).map(x=>x.toLowerCase());const ti=header.indexOf('title'),ci=header.indexOf('content');if(ti<0||ci<0)throw new HttpError(400,'CSV_COLUMNS_REQUIRED');
  if(lines.length>100)throw new HttpError(400,'KNOWLEDGE_ROW_LIMIT');
  rows=lines.map(line=>{const cols=parseCsvLine(line);return {title:cols[ti]||'',content:cols[ci]||'',categoryId:data.categoryId,active:true,requestId:uuid()};});
 } else {
  if(data.content.length>2000)throw new HttpError(400,'KNOWLEDGE_CONTENT_LIMIT');
  rows=[{title:data.filename.replace(/\.[^.]+$/,''),content:data.content,categoryId:data.categoryId,active:true,requestId:uuid()}];
 }
 if(!rows.length)throw new HttpError(400,'EMPTY_KNOWLEDGE_FILE');
 return importKnowledgeBatch(db,actor,{items:rows});
}

/**
 * Permanently delete a draft knowledge item if it has never been published.
 * Enforces FR-KNOW-05/06: Never allows deleting knowledge that was published or has active citations.
 */
export async function deleteKnowledgeItem(db: PoolClient, actor: any, id: string) {
 requireRole(actor.role);
 const itemId = z.string().uuid().parse(id);

 // Lock item to prevent concurrent publication
 const item = (
  await db.query(
   `SELECT id, revision, published_version_id, draft_version_id 
    FROM knowledge_items 
    WHERE workspace_id = $1 AND id = $2 
    FOR UPDATE`,
   [actor.workspace_id, itemId]
  )
 ).rows[0];

 if (!item) {
  throw new HttpError(404, 'NOT_FOUND');
 }

 // Safety guard: cannot delete if referenced in active citation sources
 const citations = (
  await db.query(
   `SELECT 1 FROM active_citation_sources 
    WHERE workspace_id = $1 AND source_type = 'KNOWLEDGE' AND source_key = $2
    LIMIT 1`,
   [actor.workspace_id, itemId]
  )
 ).rowCount;

 if (citations) {
  throw new HttpError(409, 'CANNOT_DELETE_CITED_KNOWLEDGE');
 }

 // 1. Break circular FK in knowledge_items
 await db.query(
  `UPDATE knowledge_items 
   SET draft_version_id = NULL, published_version_id = NULL 
   WHERE workspace_id = $1 AND id = $2`,
  [actor.workspace_id, itemId]
 );

 // 2. Remove web source links if any
 await db.query(
  `DELETE FROM web_source_generation_parts WHERE workspace_id = $1 AND knowledge_item_id = $2`,
  [actor.workspace_id, itemId]
 );
 await db.query(
  `DELETE FROM web_snapshot_knowledge WHERE workspace_id = $1 AND knowledge_item_id = $2`,
  [actor.workspace_id, itemId]
 );

 // 3. Remove versions (cascades to knowledge_chunks automatically)
 await db.query(
  `DELETE FROM knowledge_versions WHERE workspace_id = $1 AND item_id = $2`,
  [actor.workspace_id, itemId]
 );

 // 4. Remove the knowledge item itself
 await db.query(
  `DELETE FROM knowledge_items WHERE workspace_id = $1 AND id = $2`,
  [actor.workspace_id, itemId]
 );

 // 5. Audit log
 await audit(db, actor.workspace_id, actor.user_id, 'knowledge.deleted', itemId);

 return { success: true, id: itemId };
}

