import type {PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {HttpError,requireRole,uuid} from './security';

const filename=z.string().trim().min(1).max(180);
const hash=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
export async function listKnowledgeImports(db:PoolClient,actor:any,query:unknown){
 requireRole(actor.role);
 const q=z.object({limit:z.coerce.number().int().min(1).max(100).default(25),cursor:z.string().uuid().optional(),status:z.enum(['PROCESSING','COMPLETED','FAILED']).optional()}).strict().parse(query);
 const args:unknown[]=[actor.workspace_id],where=['workspace_id=$1'];
 if(q.cursor){
  if(!(await db.query('SELECT id FROM knowledge_imports WHERE workspace_id=$1 AND id=$2',[actor.workspace_id,q.cursor])).rowCount)throw new HttpError(400,'INVALID_CURSOR');
  args.push(q.cursor);where.push(`(created_at,id)<(SELECT created_at,id FROM knowledge_imports WHERE workspace_id=$1 AND id=$${args.length})`);
 }
 if(q.status){args.push(q.status);where.push(`status=$${args.length}`);}
 args.push(q.limit+1);
 const rows=(await db.query(`SELECT id,filename,mime_type,byte_size,content_hash,status,imported_count,error_code,created_at,completed_at FROM knowledge_imports WHERE ${where.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT $${args.length}`,args)).rows;
 return {items:rows.slice(0,q.limit),nextCursor:rows.length>q.limit?rows[q.limit-1].id:null};
}
export async function beginKnowledgeImport(db:PoolClient,actor:any,input:{filename:string;mimeType?:string;bytes:Buffer|string;id?:string}){
 requireRole(actor.role);
 const name=filename.parse(input.filename), bytes=Buffer.isBuffer(input.bytes)?input.bytes:Buffer.from(input.bytes);
 if(bytes.length<1)throw new HttpError(400,'EMPTY_KNOWLEDGE_FILE');
 if(bytes.length>10485760)throw new HttpError(413,'KNOWLEDGE_FILE_TOO_LARGE');
 const receipt=await db.query(`INSERT INTO knowledge_imports(id,workspace_id,uploaded_by,filename,mime_type,byte_size,content_hash)
 VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,filename,mime_type,byte_size,content_hash,status,imported_count,error_code,created_at,completed_at`,
 [input.id??uuid(),actor.workspace_id,actor.user_id,name,input.mimeType??'application/octet-stream',bytes.length,hash(bytes)]).then(r=>r.rows[0]);
 await db.query('INSERT INTO knowledge_import_files(workspace_id,import_id,bytes) VALUES($1,$2,$3)',[actor.workspace_id,receipt.id,bytes]);
 return receipt;
}
export async function getKnowledgeImportFile(db:PoolClient,actor:any,id:string){
 const receipt=await getKnowledgeImport(db,actor,id);
 const file=(await db.query('SELECT bytes FROM knowledge_import_files WHERE workspace_id=$1 AND import_id=$2',[actor.workspace_id,id])).rows[0];
 if(!file)throw new HttpError(404,'IMPORT_FILE_NOT_STORED');
 if(file.bytes.length!==receipt.byte_size||hash(file.bytes)!==receipt.content_hash)throw new HttpError(409,'IMPORT_FILE_INTEGRITY_ERROR');
 return {filename:receipt.filename,bytes:file.bytes as Buffer};
}
export async function completeKnowledgeImport(db:PoolClient,actor:any,id:string,importedCount:number){
 requireRole(actor.role);const count=z.number().int().min(0).parse(importedCount);
 const row=(await db.query(`UPDATE knowledge_imports SET status='COMPLETED',imported_count=$3,error_code=NULL,completed_at=now() WHERE workspace_id=$1 AND id=$2 RETURNING *`,[actor.workspace_id,z.string().uuid().parse(id),count])).rows[0];
 if(!row)throw new HttpError(404,'NOT_FOUND');return row;
}
export async function failKnowledgeImport(db:PoolClient,actor:any,id:string,errorCode:string){
 requireRole(actor.role);const code=z.string().regex(/^[A-Z0-9_]{3,80}$/).parse(errorCode);
 const row=(await db.query(`UPDATE knowledge_imports SET status='FAILED',error_code=$3,completed_at=now() WHERE workspace_id=$1 AND id=$2 RETURNING *`,[actor.workspace_id,z.string().uuid().parse(id),code])).rows[0];
 if(!row)throw new HttpError(404,'NOT_FOUND');return row;
}
export async function getKnowledgeImport(db:PoolClient,actor:any,id:string){
 requireRole(actor.role);const row=(await db.query('SELECT * FROM knowledge_imports WHERE workspace_id=$1 AND id=$2',[actor.workspace_id,z.string().uuid().parse(id)])).rows[0];
 if(!row)throw new HttpError(404,'NOT_FOUND');return row;
}
