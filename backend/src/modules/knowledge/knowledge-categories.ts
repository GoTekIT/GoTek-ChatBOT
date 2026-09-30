import type {PoolClient} from 'pg';
import {z} from 'zod';
import {requireRole,HttpError,uuid,audit} from '../../core/security';
export async function listKnowledgeCategories(db:PoolClient,actor:any){requireRole(actor.role);return (await db.query('SELECT id,name FROM knowledge_categories WHERE workspace_id=$1 ORDER BY name,id',[actor.workspace_id])).rows;}
export async function createKnowledgeCategory(db:PoolClient,actor:any,body:unknown){
 requireRole(actor.role);const d=z.object({requestId:z.string().uuid(),name:z.string().trim().transform(s=>s.normalize('NFC')).refine(s=>Array.from(s).length>=1&&Array.from(s).length<=100)}).strict().parse(body),payload={name:d.name};
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`knowledge:${actor.workspace_id}:${d.requestId}`]);
 const old=(await db.query('SELECT operation,payload=$3::jsonb AS same,response FROM knowledge_mutations WHERE workspace_id=$1 AND request_id=$2',[actor.workspace_id,d.requestId,payload])).rows[0];
 if(old){if(old.operation!=='knowledge.category_created'||!old.same)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');return old.response;}
 const row=(await db.query('INSERT INTO knowledge_categories(id,workspace_id,name,created_by) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id,name',[uuid(),actor.workspace_id,d.name,actor.user_id])).rows[0];
 if(!row)throw new HttpError(409,'CATEGORY_EXISTS');
 await audit(db,actor.workspace_id,actor.user_id,'knowledge.category_created',row.id);
 await db.query('INSERT INTO knowledge_mutations(workspace_id,request_id,operation,payload,response) VALUES($1,$2,$3,$4,$5)',[actor.workspace_id,d.requestId,'knowledge.category_created',payload,row]);return row;
}
export async function assertKnowledgeCategory(db:PoolClient,workspace:string,id:string|null|undefined){if(id&&!(await db.query('SELECT id FROM knowledge_categories WHERE workspace_id=$1 AND id=$2',[workspace,id])).rowCount)throw new HttpError(404,'NOT_FOUND');}
