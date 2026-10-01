import type {PoolClient} from 'pg';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {digest,opaque} from '../../core/security';
import {appendMessage} from '../chat/chat-store';
import {afterCommit} from '../../core/db';
import {realtimeHub} from '../chat/realtime';
const incoming=z.object({
 sender:z.object({id:z.string().regex(/^\d{1,100}$/)}),
 recipient:z.object({id:z.string().regex(/^\d{1,100}$/)}),
 timestamp:z.number().int().nonnegative().max(8_640_000_000_000_000),
 message:z.object({mid:z.string().min(1).max(1000),text:z.string().min(1).max(10000),is_echo:z.boolean().optional()})
});
/** Caller has established tenant scope. One receipt per transaction; provider payload never sets tenant scope. */
export const normalizeFacebookReceipt=(db:PoolClient,workspace:string)=>normalizeMetaReceipt(db,workspace,'facebook');
export const normalizeInstagramReceipt=(db:PoolClient,workspace:string)=>normalizeMetaReceipt(db,workspace,'instagram');
async function normalizeMetaReceipt(db:PoolClient,workspace:string,provider:'facebook'|'instagram') {
 const receipt=(await db.query(`SELECT r.* FROM meta_webhook_receipts r JOIN meta_connections x ON x.id=r.connection_id AND x.workspace_id=r.workspace_id
 WHERE r.workspace_id=$1 AND r.processed_at IS NULL AND x.provider=$2 AND x.status='active'
 ORDER BY r.received_at,r.id LIMIT 1 FOR UPDATE OF r SKIP LOCKED`,[workspace,provider])).rows[0];
 if(!receipt)return {state:'idle'};
 if(!(await db.query("SELECT id FROM workspaces WHERE id=$1 AND status='active' FOR SHARE",[workspace])).rowCount)return {state:'disabled'};
 const connection=(await db.query("SELECT * FROM meta_connections WHERE id=$1 AND workspace_id=$2 FOR UPDATE",[receipt.connection_id,workspace])).rows[0];
 if(!connection || connection.generation!==receipt.generation || connection.status==='disconnected') {
  await db.query("UPDATE meta_webhook_receipts SET processed_at=now(),outcome=$2 WHERE id=$1",[receipt.id,{stale:true}]);
  return {state:'stale'};
 }
 if(connection.provider!==provider || connection.status!=='active')return {state:'waiting_connection'};
 if(!(await db.query('SELECT id FROM channels WHERE id=$1 AND workspace_id=$2 AND enabled FOR SHARE',[connection.channel_id,workspace])).rowCount)return {state:'disabled'};
 let inserted=0,duplicates=0,skipped=0;
 const events=Array.isArray(receipt.payload.messaging)?receipt.payload.messaging:[];
 for(const raw of events) {
  const parsed=incoming.safeParse(raw);
  if(!parsed.success || parsed.data.message.is_echo || parsed.data.recipient.id!==connection.asset_id || parsed.data.sender.id===connection.asset_id) {skipped++;continue;}
  const event=parsed.data;
  // Serialize retries for the same provider message before checking/inserting the
  // idempotency row. This also covers the same mid arriving in separate receipts.
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${connection.id}:${event.message.mid}`]);
  if((await db.query('SELECT 1 FROM meta_inbound_messages WHERE connection_id=$1 AND external_message_id=$2',[connection.id,event.message.mid])).rowCount){duplicates++;continue;}
  let contact=(await db.query('SELECT conversation_id FROM meta_contacts WHERE connection_id=$1 AND external_user_id=$2',[connection.id,event.sender.id])).rows[0];
  if(!contact) {
   const visitor=randomUUID(),conversation=randomUUID();
   // Social visitors have no usable website session; random token is discarded and already expired.
   await db.query("INSERT INTO visitors(id,workspace_id,channel_id,token_hash,expires_at,profile) VALUES($1,$2,$3,$4,now(),$5)",[visitor,workspace,connection.channel_id,digest(opaque()),{fullName:(provider==='facebook'?'Facebook ':'Instagram ')+event.sender.id}]);
   await db.query('INSERT INTO conversations(id,workspace_id,channel_id,visitor_id) VALUES($1,$2,$3,$4)',[conversation,workspace,connection.channel_id,visitor]);
   await db.query('INSERT INTO meta_contacts(workspace_id,connection_id,external_user_id,conversation_id) VALUES($1,$2,$3,$4)',[workspace,connection.id,event.sender.id,conversation]);
   contact={conversation_id:conversation};
  }
  const message=await appendMessage(db,{workspace,conversation:contact.conversation_id,clientId:randomUUID(),author:'visitor',visibility:'public',body:event.message.text});
  const timestamp=new Date(event.timestamp);
  const inbound=await db.query('INSERT INTO meta_inbound_messages(workspace_id,connection_id,external_message_id,message_id,provider_timestamp) VALUES($1,$2,$3,$4,$5) ON CONFLICT(connection_id,external_message_id) DO NOTHING RETURNING id',[workspace,connection.id,event.message.mid,message.id,timestamp]);
  if(!inbound.rowCount) { duplicates++; continue; }
  // Out-of-order delivery must never move the messaging window backwards. Future provider times are capped.
  await db.query('UPDATE meta_contacts SET last_inbound_at=greatest(last_inbound_at,least($3::timestamptz,now())) WHERE connection_id=$1 AND external_user_id=$2',[connection.id,event.sender.id,timestamp]);
  afterCommit(db,()=>realtimeHub.broadcastToConversation(contact.conversation_id,'message:new',message));
  afterCommit(db,()=>realtimeHub.broadcastToWorkspace(workspace,'inbox:visitor_message',{conversationId:contact.conversation_id,messageSnippet:message.body.slice(0,100),author:'visitor',createdAt:message.created_at}));
  inserted++;
 }
 await db.query('UPDATE meta_webhook_receipts SET processed_at=now(),outcome=$2 WHERE id=$1',[receipt.id,{inserted,duplicates,skipped,unsupportedEnvelope:!Array.isArray(receipt.payload.messaging)}]);
 return {state:'processed',inserted,duplicates,skipped};
}
