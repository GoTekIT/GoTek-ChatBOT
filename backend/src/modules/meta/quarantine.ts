import type {PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import {uuid} from '../../core/security';

export async function quarantineMetaEvent(db:PoolClient, surface:string, account:string, eventId:string, payload:unknown, reason:string) {
 await db.query("SELECT set_config('app.meta_worker','true',true)");
 const safeId=eventId||createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 await db.query(`INSERT INTO meta_webhook_quarantine(id,surface,external_account_id,external_event_id,payload,reason)
 VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(provider,surface,external_account_id,external_event_id) DO NOTHING`,
 [uuid(),surface,account,safeId,payload,reason]);
}
