import type {PoolClient} from 'pg';
import {z} from 'zod';
import {audit,requireRole,HttpError} from './security';
import {enqueueJob} from './jobs';
export async function readSchedule(db:PoolClient,actor:any,id:string){
 requireRole(actor.role);z.string().uuid().parse(id);
 const row=(await db.query('SELECT id,refresh_interval_minutes,next_refresh_at,schedule_version FROM web_sources WHERE workspace_id=$1 AND id=$2',[actor.workspace_id,id])).rows[0];
 if(!row)throw new HttpError(404,'NOT_FOUND');return row;
}
export async function setSchedule(db:PoolClient,actor:any,id:string,body:unknown){
 requireRole(actor.role);z.string().uuid().parse(id);
 const d=z.object({intervalMinutes:z.number().int().min(5).max(10080).nullable(),version:z.number().int().positive()}).strict().parse(body);
 await readSchedule(db,actor,id);
 const row=(await db.query(`UPDATE web_sources SET refresh_interval_minutes=$3,next_refresh_at=CASE WHEN $3::integer IS NULL THEN NULL ELSE now()+make_interval(mins=>$3::integer) END,schedule_version=schedule_version+1 WHERE workspace_id=$1 AND id=$2 AND schedule_version=$4 RETURNING id,refresh_interval_minutes,next_refresh_at,schedule_version`,[actor.workspace_id,id,d.intervalMinutes,d.version])).rows[0];
 if(!row)throw new HttpError(409,'VERSION_CONFLICT');
 await audit(db,actor.workspace_id,actor.user_id,'web_source.schedule_changed',id);return row;
}
export async function enqueueDue(db:PoolClient,workspace:string){
 if(!(await db.query("SELECT id FROM workspaces WHERE id=$1 AND status='active' FOR SHARE",[workspace])).rowCount)return [];
 const due=(await db.query("SELECT s.id,s.next_refresh_at,s.refresh_interval_minutes FROM web_sources s WHERE s.workspace_id=$1 AND s.status='ACTIVE' AND s.refresh_interval_minutes IS NOT NULL AND s.next_refresh_at<=now() AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.workspace_id=s.workspace_id AND j.kind='web.refresh' AND j.payload->>'sourceId'=s.id::text AND j.state IN ('queued','retry','running')) ORDER BY s.next_refresh_at,s.id LIMIT 100 FOR UPDATE OF s SKIP LOCKED",[workspace])).rows;
 const jobs=[];
 for(const source of due){
  const job=await enqueueJob(db,workspace,{kind:'web.refresh',key:`web-schedule:${source.id}:${new Date(source.next_refresh_at).toISOString()}`,payload:{sourceId:source.id},external:false,maxAttempts:3});
  jobs.push(job.id);
  await db.query('UPDATE web_sources SET next_refresh_at=now()+make_interval(mins=>refresh_interval_minutes) WHERE workspace_id=$1 AND id=$2',[workspace,source.id]);
 }
 return jobs;
}
