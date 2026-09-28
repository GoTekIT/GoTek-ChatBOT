import type {PoolClient} from 'pg';
import {z} from 'zod';
import {HttpError,requireRole} from '../../core/security';

const input=z.object({
  limit:z.union([z.number().int(),z.string().regex(/^[1-9][0-9]*$/).transform(Number)])
    .pipe(z.number().int().min(1).max(1000)).default(1000),
  before:z.string().uuid().optional(),
}).strict();

/**
 * Export the tenant's audit stream as newline-delimited JSON.
 * The export is deliberately bounded: a caller must paginate with `before`
 * rather than creating an unbounded response in the API process.
 */
export async function exportAuditEvents(
  db:PoolClient,
  actor:{workspace_id:string;role:string},
  query:unknown,
){
  requireRole(actor.role);
  const {limit,before}=input.parse(query);
  if(before){
    const cursor=await db.query(
      'SELECT id FROM audit_events WHERE workspace_id=$1 AND id=$2',
      [actor.workspace_id,before],
    );
    if(!cursor.rowCount) throw new HttpError(404,'NOT_FOUND');
  }
  const rows=(await db.query(`
    SELECT id,actor_id,action,object_id,created_at
      FROM audit_events
     WHERE workspace_id=$1
       AND ($2::uuid IS NULL OR (created_at,id)<(
         SELECT created_at,id FROM audit_events
          WHERE workspace_id=$1 AND id=$2::uuid
       ))
     ORDER BY created_at DESC,id DESC
     LIMIT $3`,[actor.workspace_id,before??null,limit])).rows;
  const body=rows.map(row=>JSON.stringify(row)).join('\n')+(rows.length?'\n':'');
  return {contentType:'application/x-ndjson; charset=utf-8',body,count:rows.length,nextCursor:rows.at(-1)?.id??null};
}
