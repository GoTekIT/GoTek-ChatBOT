import type {PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import {uuid,HttpError,requireRole} from '../../core/security';
import {ingestMetaBody} from './messenger';

export async function quarantineMetaEvent(db:PoolClient, surface:string, account:string, eventId:string, payload:unknown, reason:string) {
 await db.query("SELECT set_config('app.meta_worker','true',true)");
 const safeId=eventId||createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 await db.query(`INSERT INTO meta_webhook_quarantine(id,surface,external_account_id,external_event_id,payload,reason)
 VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(provider,surface,external_account_id,external_event_id) DO NOTHING`,
 [uuid(),surface,account,safeId,payload,reason]);
}

export async function listQuarantinedMetaEvents(db:PoolClient, actor:{workspace_id:string;role:string}) {
 requireRole(actor.role);
 await db.query("SELECT set_config('app.meta_worker','true',true)");
 return (await db.query(`SELECT q.id,q.surface,q.external_account_id AS "externalAccountId",
 q.external_event_id AS "externalEventId",q.reason,q.received_at AS "receivedAt",q.expires_at AS "expiresAt",
 q.replayed_at AS "replayedAt",mc.id AS "connectionId",mc.page_name AS "accountName",mc.status
 FROM meta_webhook_quarantine q JOIN meta_connections mc
 ON mc.workspace_id=$1 AND mc.channel_kind=q.surface AND mc.external_page_id=q.external_account_id
 WHERE q.replayed_at IS NULL AND q.expires_at>now() ORDER BY q.received_at DESC`,[actor.workspace_id])).rows;
}

export async function replayQuarantinedMetaEvent(db:PoolClient, actor:{workspace_id:string;role:string}, id:string) {
 requireRole(actor.role);
 await db.query("SELECT set_config('app.meta_worker','true',true)");
 const row=(await db.query(`SELECT q.id,q.payload,mc.id AS connection_id
 FROM meta_webhook_quarantine q JOIN meta_connections mc
 ON mc.workspace_id=$1 AND mc.channel_kind=q.surface AND mc.external_page_id=q.external_account_id
 WHERE q.id=$2 AND q.replayed_at IS NULL AND q.expires_at>now() AND mc.status='connected' FOR UPDATE`,[actor.workspace_id,id])).rows[0];
 if(!row) throw new HttpError(404,'META_QUARANTINE_NOT_FOUND_OR_UNAVAILABLE');
 const result=await ingestMetaBody(db,row.payload,[]);
 await db.query('UPDATE meta_webhook_quarantine SET replayed_at=now() WHERE id=$1',[row.id]);
 return {id:row.id,replayed:true,result};
}
