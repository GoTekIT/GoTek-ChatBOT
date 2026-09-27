import type {PoolClient} from 'pg';
import {HttpError} from './security';

/** Shared H28 policy for runtime selectors. Callers must run inside a scoped transaction. */
export async function assertModelGrantUsable(db:PoolClient,workspace:string,modelId:string,capability:'chat'|'embedding'|'vision'){
 const row=(await db.query(`SELECT g.id,g.expires_at
   FROM model_grants g JOIN models m ON m.id=g.model_id JOIN providers p ON p.id=m.provider_id
   JOIN workspaces w ON w.id=g.workspace_id
   WHERE g.workspace_id=$1 AND g.model_id=$2 AND g.capability=$3 AND g.active
     AND (g.expires_at IS NULL OR g.expires_at>now())
     AND m.enabled AND p.enabled AND $3=ANY(m.capabilities) AND w.status='active'`,[workspace,modelId,capability])).rows[0];
 if(!row) throw new HttpError(403,'MODEL_NOT_GRANTED');
 return row as {id:string;expires_at:string|null};
}
