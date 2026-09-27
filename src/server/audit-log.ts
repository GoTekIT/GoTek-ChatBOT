import type {PoolClient} from 'pg';
import {z} from 'zod';
import {HttpError,requireRole} from './security';

const querySchema=z.object({
 limit:z.union([z.number().int(),z.string().regex(/^[1-9][0-9]*$/).transform(Number)])
  .pipe(z.number().int().min(1).max(100)).default(100),
 before:z.string().uuid().optional(),
}).strict();

/** Cursor values are resolved inside the tenant and retain PostgreSQL timestamp precision. */
export async function listAuditEvents(db:PoolClient,actor:{workspace_id:string;role:string},query:unknown){
 requireRole(actor.role);
 const {limit,before}=querySchema.parse(query);
 if(before){
  const cursor=await db.query('SELECT id FROM audit_events WHERE workspace_id=$1 AND id=$2',[actor.workspace_id,before]);
  if(!cursor.rowCount)throw new HttpError(404,'NOT_FOUND');
 }
 return (await db.query(`SELECT id,actor_id,action,object_id,created_at FROM audit_events
  WHERE workspace_id=$1 AND ($2::uuid IS NULL OR (created_at,id)<
   (SELECT created_at,id FROM audit_events WHERE workspace_id=$1 AND id=$2::uuid))
  ORDER BY created_at DESC,id DESC LIMIT $3`,[actor.workspace_id,before??null,limit])).rows;
}
