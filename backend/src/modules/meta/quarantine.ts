import {normalizeRetainedFacebookStatuses,normalizeRetainedFacebookMessage} from './replay-normalization';
import type {PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {HttpError,requireRole,audit} from '../../core/security';

/**
 * Compatibility helper for internal callers. New webhook traffic uses the
 * SECURITY DEFINER ingress function so an unmapped event can be retained
 * without inventing a tenant.
 */
export async function quarantineMetaEvent(db:PoolClient,workspaceId:string,connectionId:string,surface:string,account:string,eventId:string,payload:unknown,reason:string) {
 await db.query("SELECT set_config('app.workspace_id',$1,true)",[workspaceId]);
 const safeId=eventId||createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 await db.query('SELECT enqueue_meta_ingress($1,$2,$3,$4,$5::jsonb)',[surface,account,safeId,'unknown',JSON.stringify(payload)]);
 // Keep an audit record in the tenant when the caller has one; the durable
 // ingress row remains the source of truth and preserves the payload.
 void connectionId;
 if(reason)await db.query('SELECT annotate_meta_ingress($1,$2,$3,$4,$5)',[workspaceId,surface,account,safeId,reason]);
}

export async function listQuarantinedMetaEvents(db:PoolClient,actor:{workspace_id:string;role:string}) {
 requireRole(actor.role);
 await db.query("SELECT set_config('app.workspace_id',$1,true)",[actor.workspace_id]);
 return (await db.query(`SELECT i.id,i.surface,i.external_account_id AS "externalAccountId",
 i.external_event_id AS "externalEventId",coalesce(i.last_error,'META_EVENT_QUARANTINED') AS reason,
 i.received_at AS "receivedAt",i.expires_at AS "expiresAt",i.processed_at AS "replayedAt",
 i.connection_id AS "connectionId",mc.page_name AS "accountName",mc.status,i.state
 FROM meta_webhook_ingress i LEFT JOIN meta_connections mc
   ON mc.id=i.connection_id AND mc.workspace_id=i.workspace_id
 WHERE i.workspace_id=$1 AND i.state='quarantined' AND i.expires_at>now()
 ORDER BY i.received_at DESC`,[actor.workspace_id])).rows;
}

/** Requeue only a tenant-bound event. Processing still happens in the worker. */
export async function replayQuarantinedMetaEvent(db:PoolClient,actor:{workspace_id:string;role:string;user_id?:string},id:string) {
 requireRole(actor.role);
 await db.query("SELECT set_config('app.workspace_id',$1,true)",[actor.workspace_id]);
 const row=(await db.query(`SELECT id,event_kind,state,connection_id,surface,external_account_id,external_event_id,payload
 FROM meta_webhook_ingress WHERE workspace_id=$1 AND id=$2 AND state='quarantined'
 AND expires_at>now() FOR UPDATE`,[actor.workspace_id,id])).rows[0];
 if(!row)throw new HttpError(404,'META_QUARANTINE_NOT_FOUND_OR_UNAVAILABLE');
 if(row.event_kind==='unknown'&&!normalizeRetainedFacebookMessage(row)&&!normalizeRetainedFacebookStatuses(row).length)return {id:row.id,replayed:false,reason:'META_EVENT_UNSUPPORTED'};
 if(!row.connection_id)throw new HttpError(409,'META_ROUTE_UNAVAILABLE');
 const requeued=(await db.query('SELECT requeue_meta_ingress($1,$2) AS ok',[actor.workspace_id,row.id])).rows[0]?.ok;
 if(!requeued)throw new HttpError(409,'META_QUARANTINE_NOT_FOUND_OR_UNAVAILABLE');
 if(actor.user_id)await audit(db,actor.workspace_id,actor.user_id,'meta.webhook_replayed',row.id);
 return {id:row.id,replayed:true,queued:true};
}

/** Owner/Admin claim of events that arrived before the Page was connected. */
export async function claimUnassignedMetaEvents(db:PoolClient,actor:{workspace_id:string;role:string;user_id:string},connectionId:string) {
 requireRole(actor.role);
 const id=z.string().uuid().parse(connectionId);
 await db.query("SELECT set_config('app.workspace_id',$1,true)",[actor.workspace_id]);
 const connection=(await db.query("SELECT id FROM meta_connections WHERE id=$1 AND workspace_id=$2 AND status='connected' FOR SHARE",[id,actor.workspace_id])).rows[0];
 if(!connection)throw new HttpError(409,'META_CONNECTION_NOT_READY');
 const claimed=Number((await db.query('SELECT claim_meta_unassigned($1,$2) AS count',[actor.workspace_id,id])).rows[0]?.count||0);
 await audit(db,actor.workspace_id,actor.user_id,'meta.webhook_claimed',id);
 return {connectionId:id,claimed};
}
