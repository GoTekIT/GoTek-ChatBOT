import type {PoolClient} from 'pg';
import {z} from 'zod';
import {requireRole,HttpError,audit} from '../../core/security';
import {META_CONNECTORS} from './connectors';

/** Inbox source catalog follows channel read permissions, including disconnected history. */
export async function listInboxSources(db:PoolClient, actor:{workspace_id:string;role:string;user_id:string}) {
 return (await db.query(`SELECT mc.id AS "connectionId",mc.channel_kind AS platform,
 mc.page_name AS "accountName",mc.external_page_id AS "externalAccountId",mc.status
 FROM meta_connections mc JOIN channels c ON c.id=mc.channel_id AND c.workspace_id=mc.workspace_id
 WHERE mc.workspace_id=$1 AND c.enabled AND
 ($2::boolean OR EXISTS(SELECT 1 FROM channel_members m WHERE m.workspace_id=mc.workspace_id
 AND m.channel_id=mc.channel_id AND m.user_id=$3)) ORDER BY mc.page_name,mc.id`,
 [actor.workspace_id,['Owner','Admin'].includes(actor.role),actor.user_id])).rows;
}

/** Workspace administration view. Token values and secret references never leave the server. */
export async function listMetaConnections(db:PoolClient, actor:{workspace_id:string;role:string}) {
 requireRole(actor.role);
 const connections=(await db.query(`SELECT id,channel_id,channel_kind,external_page_id,page_name,status,last_verified_at
 FROM meta_connections WHERE workspace_id=$1 ORDER BY created_at,id`,[actor.workspace_id])).rows;
 return {capabilities:META_CONNECTORS,connections};
}

/** Serializes with the dispatch lock; an already-dispatched request cannot be recalled. */
export async function disconnectMetaConnection(db:PoolClient, actor:{workspace_id:string;role:string;user_id:string}, id:string) {
 requireRole(actor.role);
 const connection=(await db.query('SELECT id,status FROM meta_connections WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[actor.workspace_id,z.string().uuid().parse(id)])).rows[0];
 if(!connection)throw new HttpError(404,'META_CONNECTION_NOT_FOUND');
 if(connection.status!=='disconnected'){
  await db.query("UPDATE meta_connections SET status='disconnected',updated_at=now() WHERE id=$1 AND workspace_id=$2",[connection.id,actor.workspace_id]);
  await audit(db,actor.workspace_id,actor.user_id,'meta.connection_disconnected',connection.id);
 }
 return {id:connection.id,status:'disconnected'};
}
