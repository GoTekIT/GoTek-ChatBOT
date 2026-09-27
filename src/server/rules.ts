import {lockAiRules} from './ai-rule-snapshot';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {HttpError,audit,requireRole,uuid} from './security';
const ruleId=z.string().uuid();
const ruleInput=z.object({title:z.string().trim().min(1).max(150),content:z.string().trim().min(1).max(2000)}).strict();
const createInput=ruleInput.extend({requestId:z.string().uuid().optional()});
export async function listRules(db:PoolClient,actor:any,query:any){
 requireRole(actor.role); const search=typeof query.search==='string'?query.search.trim().slice(0,150):''; const active=query.active===undefined?undefined:z.enum(['true','false']).parse(String(query.active))==='true'; const params:any[]=[actor.workspace_id]; const where=['workspace_id=$1'];
 if(search){params.push(`%${search}%`);where.push(`(title ILIKE $${params.length} OR content ILIKE $${params.length})`);} if(active!==undefined){params.push(active);where.push(`active=$${params.length}`);}
 return (await db.query(`SELECT id,title,content,active,version,created_by,updated_at,created_at FROM ai_rules WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT 100`,params)).rows;
}
export async function createRule(db:PoolClient,actor:any,body:unknown){requireRole(actor.role);const data=createInput.parse(body),id=uuid(),payload={title:data.title,content:data.content};await lockAiRules(db,actor.workspace_id,'write');if(data.requestId){await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`ai-rule:${actor.workspace_id}:${data.requestId}`]);const previous=(await db.query('SELECT id,request_payload=$3::jsonb AS same_payload FROM ai_rules WHERE workspace_id=$1 AND request_id=$2',[actor.workspace_id,data.requestId,payload])).rows[0];if(previous){if(!previous.same_payload)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');return (await db.query('SELECT id,title,content,active,version,created_by,updated_at,created_at FROM ai_rules WHERE id=$1',[previous.id])).rows[0];}}await db.query('INSERT INTO ai_rules(id,workspace_id,title,content,created_by,request_id,request_payload) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,actor.workspace_id,data.title,data.content,actor.user_id,data.requestId||null,payload]);await audit(db,actor.workspace_id,actor.user_id,'ai_rule.created',id);return (await db.query('SELECT id,title,content,active,version,created_by,updated_at,created_at FROM ai_rules WHERE id=$1',[id])).rows[0];}
const expectedVersion = z.number().int().positive();
const updateInput = ruleInput.extend({expectedVersion});
const stateInput = z.object({active: z.boolean(), expectedVersion}).strict();
async function missingOrStale(db: PoolClient, actor: any, id: string): Promise<never> {
 const existing = await db.query('SELECT id FROM ai_rules WHERE id=$1 AND workspace_id=$2', [id, actor.workspace_id]);
 throw new HttpError(existing.rows.length ? 409 : 404, existing.rows.length ? 'VERSION_CONFLICT' : 'NOT_FOUND');
}
export async function updateRule(db:PoolClient,actor:any,id:string,body:unknown){
 requireRole(actor.role);
 const key=ruleId.parse(id),data=updateInput.parse(body);
 await lockAiRules(db,actor.workspace_id,'write');
 const row=(await db.query('UPDATE ai_rules SET title=$1,content=$2,version=version+1,updated_at=now() WHERE id=$3 AND workspace_id=$4 AND version=$5 RETURNING id,title,content,active,version,created_by,updated_at,created_at',[data.title,data.content,key,actor.workspace_id,data.expectedVersion])).rows[0];
 if(!row)return missingOrStale(db,actor,key);
 await audit(db,actor.workspace_id,actor.user_id,'ai_rule.updated',key);
 return row;
}
export async function setRuleState(db:PoolClient,actor:any,id:string,body:unknown){
 requireRole(actor.role);
 const key=ruleId.parse(id),data=stateInput.parse(body);
 await lockAiRules(db,actor.workspace_id,'write');
 const row=(await db.query('UPDATE ai_rules SET active=$1,version=version+1,updated_at=now() WHERE id=$2 AND workspace_id=$3 AND version=$4 RETURNING id,title,content,active,version,created_by,updated_at,created_at',[data.active,key,actor.workspace_id,data.expectedVersion])).rows[0];
 if(!row)return missingOrStale(db,actor,key);
 await audit(db,actor.workspace_id,actor.user_id,data.active?'ai_rule.activated':'ai_rule.deactivated',key);
 return row;
}
