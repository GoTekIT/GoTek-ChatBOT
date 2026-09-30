import type {PoolClient} from 'pg';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {requireRole,HttpError} from '../../core/security';
import {importWebSnapshotKnowledge} from './web-snapshot-knowledge';
import {createWebGeneration} from './web-generations';
export async function stageWebSnapshotGeneration(db:PoolClient,actor:any,sourceId:string,snapshotId:string,body:unknown){
 requireRole(actor.role);z.string().uuid().parse(sourceId);z.string().uuid().parse(snapshotId);
 const d=z.object({requestId:z.string().uuid(),itemIndex:z.number().int().nonnegative(),title:z.string().trim().min(1).max(100),categoryId:z.string().uuid().nullable().optional()}).strict().parse(body);
 const snapshot=(await db.query('SELECT document FROM web_source_snapshots WHERE workspace_id=$1 AND source_id=$2 AND id=$3',[actor.workspace_id,sourceId,snapshotId])).rows[0];if(!snapshot)throw new HttpError(404,'NOT_FOUND');
 const entry=String(snapshot.document.items?.[d.itemIndex]?.url||snapshot.document.url||sourceId);const key=entry.length<=500?entry:createHash('sha256').update(entry).digest('hex');
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`web-stage:${actor.workspace_id}:${sourceId}:${key}`]);
 const group=(await db.query('INSERT INTO web_source_document_groups(id,workspace_id,source_id,entry_key) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,source_id,entry_key) DO UPDATE SET entry_key=excluded.entry_key RETURNING id,current_generation_id,published_generation_id',[randomUUID(),actor.workspace_id,sourceId,key])).rows[0];
 const imported=await importWebSnapshotKnowledge(db,actor,sourceId,snapshotId,{itemIndex:d.itemIndex,title:d.title,categoryId:d.categoryId??null});
 if(!imported.items.length)throw new HttpError(422,'SOURCE_CONTENT_EMPTY');
 const parts:{partIndex:number,action:'UPSERT'|'RETIRE',itemId?:string,versionId?:string}[]=imported.items.map(item=>({partIndex:item.partIndex,action:'UPSERT',itemId:item.itemId,versionId:item.draftVersionId}));
 // Replays must reconstruct the original parent manifest, even after publication.
 const existing=(await db.query('SELECT parent_generation_id FROM web_source_generations WHERE workspace_id=$1 AND request_id=$2',[actor.workspace_id,d.requestId])).rows[0];
 const parentId=existing?existing.parent_generation_id:group.published_generation_id;
 if(parentId){
  const previous=(await db.query('SELECT part_index FROM web_source_generation_parts WHERE workspace_id=$1 AND generation_id=$2 ORDER BY part_index',[actor.workspace_id,parentId])).rows;
  for(const prior of previous)if(!parts.some(part=>part.partIndex===prior.part_index))parts.push({partIndex:prior.part_index,action:'RETIRE'});
 }
 const generation=await createWebGeneration(db,actor,{requestId:d.requestId,groupId:group.id,snapshotId,parts});
 return {...generation,groupId:group.id};
}
