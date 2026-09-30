import type {PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {createKnowledge} from '../../modules/knowledge/knowledge';
import {HttpError,requireRole,audit} from '../../core/security';

export async function importWebSnapshotKnowledge(db:PoolClient,actor:any,sourceId:string,snapshotId:string,body:unknown){
 requireRole(actor.role);
 z.string().uuid().parse(sourceId);z.string().uuid().parse(snapshotId);
 const data=z.object({itemIndex:z.number().int().nonnegative(),title:z.string().trim().refine(v=>Array.from(v).length>0&&Array.from(v).length<=100),categoryId:z.string().uuid().nullable().optional()}).strict().parse(body);
 const input={title:data.title,categoryId:data.categoryId??null};
 const snapshot=(await db.query('SELECT document FROM web_source_snapshots WHERE workspace_id=$1 AND source_id=$2 AND id=$3',[actor.workspace_id,sourceId,snapshotId])).rows[0];
 if(!snapshot)throw new HttpError(404,'NOT_FOUND');
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`web-import:${actor.workspace_id}:${snapshotId}:${data.itemIndex}`]);
 const read=async()=> (await db.query(`SELECT k.knowledge_item_id AS "itemId",k.draft_version_id AS "draftVersionId",k.part_index AS "partIndex",k.input,v.title,v.content,v.state FROM web_snapshot_knowledge k JOIN knowledge_versions v ON v.workspace_id=k.workspace_id AND v.item_id=k.knowledge_item_id AND v.id=k.draft_version_id WHERE k.workspace_id=$1 AND k.snapshot_id=$2 AND k.item_index=$3 ORDER BY k.part_index`,[actor.workspace_id,snapshotId,data.itemIndex])).rows;
 const prior=await read();
 if(prior.length){if(prior[0].input.title!==input.title||prior[0].input.categoryId!==input.categoryId)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');return {items:prior};}
 if(snapshot.document.kind==='SITEMAP')throw new HttpError(409,'SOURCE_REQUIRES_CRAWL');
 const text=snapshot.document.items?.[data.itemIndex]?.text;
 if(typeof text!=='string'||!text.trim())throw new HttpError(422,'SOURCE_CONTENT_EMPTY');
 const chars=Array.from(text.trim());
 if(chars.length>200000)throw new HttpError(422,'SOURCE_CONTENT_LIMIT');
 let part=0;
 for(let offset=0;offset<chars.length;offset+=2000){
  const content=chars.slice(offset,offset+2000).join('').trim();if(!content)continue;
  const item=await createKnowledge(db,actor,{...input,content,requestId:randomUUID()});
  await db.query("UPDATE knowledge_items SET source_type='WEB' WHERE workspace_id=$1 AND id=$2",[actor.workspace_id,item.id]);
  await db.query('INSERT INTO web_snapshot_knowledge(workspace_id,snapshot_id,item_index,part_index,knowledge_item_id,draft_version_id,input) VALUES($1,$2,$3,$4,$5,$6,$7)',[actor.workspace_id,snapshotId,data.itemIndex,part++,item.id,item.draft_version_id,input]);
 }
 await audit(db,actor.workspace_id,actor.user_id,'knowledge.web_imported',snapshotId);
 return {items:await read()};
}
