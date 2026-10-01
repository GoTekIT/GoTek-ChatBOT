import type {PoolClient} from 'pg';
import type {Identity} from '../../middlewares/auth.middleware';
import {requirePermission} from '../../core/authorization';
import {audit,HttpError} from '../../core/security';

/** Credential fields are intentionally excluded from the API-facing projection. */
export async function listMetaConnections(db:PoolClient,actor:Identity) {
 requirePermission(actor.role,'channels.manage');
 return (await db.query(`SELECT id,channel_id,provider,asset_id,asset_name,status,token_expires_at,
  generation,created_at,updated_at FROM meta_connections WHERE workspace_id=$1 ORDER BY created_at,id`,[actor.workspace_id])).rows;
}

/** Local disconnect fences workers immediately; provider unsubscription is a separate retryable operation. */
export async function disconnectMetaConnection(db:PoolClient,actor:Identity,id:string) {
 requirePermission(actor.role,'channels.manage');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new HttpError(400,'INVALID_ID');
 const found=await db.query('SELECT status FROM meta_connections WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[id,actor.workspace_id]);
 if(!found.rowCount) throw new HttpError(404,'META_CONNECTION_NOT_FOUND');
 if(found.rows[0].status!=='disconnected') {
  await db.query(`UPDATE meta_connections SET status='disconnected',token_ciphertext=NULL,
   granted_scopes='{}',token_expires_at=NULL,generation=generation+1,updated_at=now()
   WHERE id=$1 AND workspace_id=$2`,[id,actor.workspace_id]);
  await audit(db,actor.workspace_id,actor.user_id,'meta.connection.disconnected',id);
 }
 return {id,status:'disconnected'};
}
