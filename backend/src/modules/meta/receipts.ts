import type {PoolClient} from 'pg';

/** Fold durable callbacks both after ingestion and after an outbound receipt exists. */
export async function reconcileMetaReceipt(db:PoolClient,workspace:string,connection:string,providerMessage:string) {
 await db.query('SELECT id FROM meta_connections WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[workspace,connection]);
 await db.query(`WITH evidence AS (
  SELECT bool_or(event_kind='status:read') AS read,
   bool_or(event_kind='status:delivered') AS delivered,
   bool_or(event_kind='status:sent') AS sent,
   bool_or(event_kind='status:failed') AS failed,
   max(payload->>'error') FILTER(WHERE event_kind='status:failed') AS error_code
  FROM meta_events WHERE workspace_id=$1 AND connection_id=$2
   AND payload->>'providerMessageId'=$3 AND event_kind LIKE 'status:%'
 ) UPDATE meta_message_deliveries d SET status=CASE
  WHEN d.status='read' OR e.read THEN 'read'
  WHEN d.status='delivered' OR e.delivered THEN 'delivered'
  WHEN e.failed THEN 'failed'
  WHEN d.status='sent' OR e.sent THEN 'sent'
  ELSE d.status END,error_code=CASE
  WHEN d.status IN ('read','delivered') OR e.read OR e.delivered THEN NULL
  WHEN e.failed THEN e.error_code ELSE d.error_code END,updated_at=now()
 FROM evidence e WHERE d.workspace_id=$1 AND d.connection_id=$2 AND d.provider_message_id=$3`,
 [workspace,connection,providerMessage]);
 // A local creation time cannot prove when Meta sent a message (queued retries
 // may send much later). Only provider echo timestamps qualify for watermarks.
 await db.query(`WITH evidence AS (
  SELECT d.id,bool_or(w.event_kind='status:read') AS read
  FROM meta_message_deliveries d
  JOIN meta_events echo ON echo.workspace_id=d.workspace_id
   AND echo.connection_id=d.connection_id AND echo.event_kind='message'
   AND echo.external_event_id=d.provider_message_id
   AND echo.payload->>'isPageReply'='true'
  JOIN meta_events w ON w.workspace_id=d.workspace_id AND w.connection_id=d.connection_id
   AND w.event_kind IN ('status:delivered','status:read')
   AND w.payload->>'recipientId'=echo.payload->>'senderId'
   AND (w.payload->>'watermarkAt')::timestamptz >= (echo.payload->>'createdAt')::timestamptz
  WHERE d.workspace_id=$1 AND d.connection_id=$2
   AND ($3='' OR d.provider_message_id=$3)
  GROUP BY d.id
 ) UPDATE meta_message_deliveries d SET
  status=CASE WHEN d.status='read' OR e.read THEN 'read' ELSE 'delivered' END,
  error_code=NULL,updated_at=now()
 FROM evidence e WHERE d.id=e.id AND d.workspace_id=$1 AND d.connection_id=$2`,
 [workspace,connection,providerMessage]);
}
