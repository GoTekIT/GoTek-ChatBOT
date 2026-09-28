import type {PoolClient} from 'pg';
import {z} from 'zod';
import {HttpError,audit,requireRole} from '../../core/security';
import {replaceKnowledgeChunks} from './knowledge-chunk-store';

const processSchema=z.object({requestId:z.string().uuid(),expectedRevision:z.number().int().positive(),versionId:z.string().uuid()}).strict();
const publishSchema=z.object({requestId:z.string().uuid(),expectedRevision:z.number().int().positive(),versionId:z.string().uuid(),audience:z.enum(['INTERNAL','PUBLIC'])}).strict();
const rollbackSchema=z.object({requestId:z.string().uuid(),expectedRevision:z.number().int().positive(),versionId:z.string().uuid()}).strict();

async function replay(db:PoolClient,actor:any,requestId:string,operation:string,payload:unknown){
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`knowledge:${actor.workspace_id}:${requestId}`]);
 const old=(await db.query('SELECT operation,payload=$3::jsonb AS same,response FROM knowledge_mutations WHERE workspace_id=$1 AND request_id=$2',[actor.workspace_id,requestId,payload])).rows[0];
 if(old){if(old.operation!==operation||!old.same)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');return old.response;}
}
async function item(db:PoolClient,workspace:string,id:string){
 const row=(await db.query(`SELECT i.id,i.active,i.audience,i.revision,i.draft_version_id,i.published_version_id,i.published_at,i.published_by,v.title,v.content,v.state,v.version_no,v.processed_at FROM knowledge_items i JOIN knowledge_versions v ON v.id=i.draft_version_id AND v.workspace_id=i.workspace_id WHERE i.workspace_id=$1 AND i.id=$2 FOR UPDATE`,[workspace,id])).rows[0];
 if(!row)throw new HttpError(404,'NOT_FOUND');return row;
}
async function finish(db:PoolClient,actor:any,requestId:string,operation:string,payload:unknown,id:string,response:any){
 await audit(db,actor.workspace_id,actor.user_id,operation,id);
 await db.query('INSERT INTO knowledge_mutations(workspace_id,request_id,operation,payload,response) VALUES($1,$2,$3,$4,$5)',[actor.workspace_id,requestId,operation,payload,response]);
 return response;
}
export async function processKnowledge(db:PoolClient,actor:any,id:string,body:unknown){
 requireRole(actor.role);const data=processSchema.parse(body),payload={id,expectedRevision:data.expectedRevision,versionId:data.versionId};
 const old=await replay(db,actor,data.requestId,'knowledge.processed',payload);if(old)return old;
 const current=await item(db,actor.workspace_id,z.string().uuid().parse(id));
 if(current.revision!==data.expectedRevision)throw new HttpError(409,'VERSION_CONFLICT');
 if(current.draft_version_id!==data.versionId)throw new HttpError(409,'VERSION_CONFLICT');
 const version=(await db.query('SELECT id,state,content FROM knowledge_versions WHERE workspace_id=$1 AND item_id=$2 AND id=$3 FOR UPDATE',[actor.workspace_id,id,data.versionId])).rows[0];
 if(!version)throw new HttpError(404,'NOT_FOUND');
 if(version.state!=='DRAFT'&&version.state!=='FAILED')throw new HttpError(409,'INVALID_STATE');
 await replaceKnowledgeChunks(db,actor.workspace_id,data.versionId,version.content);
 await db.query("UPDATE knowledge_versions SET state='READY',processed_at=now() WHERE workspace_id=$1 AND item_id=$2 AND id=$3",[actor.workspace_id,id,data.versionId]);
 const updated=(await db.query('UPDATE knowledge_items SET revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2 RETURNING revision',[actor.workspace_id,id])).rows[0];
 return finish(db,actor,data.requestId,'knowledge.processed',payload,id,{...current,state:'READY',revision:updated.revision,versionId:data.versionId});
}
export async function publishKnowledge(db:PoolClient,actor:any,id:string,body:unknown){
 requireRole(actor.role);const data=publishSchema.parse(body),payload={id,expectedRevision:data.expectedRevision,versionId:data.versionId,audience:data.audience};
 const old=await replay(db,actor,data.requestId,'knowledge.published',payload);if(old)return old;
 const current=await item(db,actor.workspace_id,z.string().uuid().parse(id));
 if(current.revision!==data.expectedRevision)throw new HttpError(409,'VERSION_CONFLICT');
 if(!current.active)throw new HttpError(409,'INACTIVE_ITEM');
 const version=(await db.query('SELECT id,state FROM knowledge_versions WHERE workspace_id=$1 AND item_id=$2 AND id=$3 FOR UPDATE',[actor.workspace_id,id,data.versionId])).rows[0];
 if(!version)throw new HttpError(404,'NOT_FOUND');
 if(version.state!=='READY')throw new HttpError(409,'INVALID_STATE');
 await db.query('UPDATE knowledge_versions SET first_published_at=coalesce(first_published_at,now()) WHERE workspace_id=$1 AND item_id=$2 AND id=$3',[actor.workspace_id,id,data.versionId]);
 const updated=(await db.query('UPDATE knowledge_items SET audience=$4,published_version_id=$3,revision=revision+1,published_at=now(),published_by=$5,updated_at=now() WHERE workspace_id=$1 AND id=$2 RETURNING id,audience,revision,published_version_id,published_at,published_by',[actor.workspace_id,id,data.versionId,data.audience,actor.user_id])).rows[0];
 return finish(db,actor,data.requestId,'knowledge.published',payload,id,updated);
}

/** Select an existing immutable version as the next draft, leaving publication unchanged. */
export async function rollbackKnowledge(db:PoolClient,actor:any,id:string,body:unknown){
 requireRole(actor.role);const itemId=z.string().uuid().parse(id),data=rollbackSchema.parse(body);
 const payload={id:itemId,expectedRevision:data.expectedRevision,versionId:data.versionId};
 const old=await replay(db,actor,data.requestId,'knowledge.draft_rolled_back',payload);if(old)return old;
 const current=(await db.query('SELECT id,revision,draft_version_id,published_version_id FROM knowledge_items WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[actor.workspace_id,itemId])).rows[0];
 if(!current)throw new HttpError(404,'NOT_FOUND');
 if(current.revision!==data.expectedRevision)throw new HttpError(409,'VERSION_CONFLICT');
 if(current.draft_version_id===data.versionId)throw new HttpError(409,'ALREADY_DRAFT');
 const target=(await db.query('SELECT id,title,content,state,version_no,first_published_at FROM knowledge_versions WHERE workspace_id=$1 AND item_id=$2 AND id=$3 FOR UPDATE',[actor.workspace_id,itemId,data.versionId])).rows[0];
 if(!target)throw new HttpError(404,'NOT_FOUND');
 if(target.state==='PROCESSING'||target.state==='QUEUED')throw new HttpError(409,'INVALID_STATE');
 if(!target.first_published_at)throw new HttpError(409,'ROLLBACK_UNAVAILABLE');
 const updated=(await db.query('UPDATE knowledge_items SET draft_version_id=$3,revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2 RETURNING id,revision,draft_version_id,published_version_id,audience,active',[actor.workspace_id,itemId,data.versionId])).rows[0];
 const response={...updated,version:target,state:'DRAFT'};
 return finish(db,actor,data.requestId,'knowledge.draft_rolled_back',payload,itemId,response);
}
