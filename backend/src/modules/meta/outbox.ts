import type {PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {HttpError} from '../../core/security';
import {access,type Actor} from '../chat/inbox';
import {appendMessage} from '../chat/chat-store';

/** Enqueue in the same transaction as the local message; retries return the durable result without dispatching again. */
export const enqueueFacebookReply=(db:PoolClient,actor:Actor,id:string,body:unknown)=>enqueueMetaReply(db,actor,id,body,'facebook');
export const enqueueInstagramReply=(db:PoolClient,actor:Actor,id:string,body:unknown)=>enqueueMetaReply(db,actor,id,body,'instagram');
async function enqueueMetaReply(db:PoolClient,actor:Actor,conversationId:string,body:unknown,provider:'facebook'|'instagram') {
 const input=z.object({clientId:z.string().uuid(),body:z.string().trim().min(1).max(2000)}).strict().parse(body);
 const conversation=await access(db,actor,conversationId);
 const connection=(await db.query("SELECT * FROM meta_connections WHERE workspace_id=$1 AND channel_id=$2 AND provider=$3 FOR UPDATE",[actor.workspace_id,conversation.channel_id,provider])).rows[0];
 const current=(await db.query('SELECT * FROM conversations WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[actor.workspace_id,conversationId])).rows[0];
 const previous=(await db.query(`SELECT m.*,o.status delivery_status FROM messages m JOIN meta_outbox o ON o.message_id=m.id
 WHERE m.workspace_id=$1 AND m.conversation_id=$2 AND m.client_id=$3`,[actor.workspace_id,conversationId,input.clientId])).rows[0];
 if(previous) {
  if(previous.body!==input.body || previous.actor_id!==actor.user_id)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');
  return previous;
 }
 if(!connection || connection.status!=='active' || !connection.granted_scopes.includes(provider==='facebook'?'pages_messaging':'instagram_business_manage_messages'))throw new HttpError(409,'META_RECONNECT_REQUIRED');
 if(current.reply_owner!=='HUMAN_ACTIVE'||current.assigned_to!==actor.user_id)throw new HttpError(409,'TAKEOVER_REQUIRED');
 const contact=(await db.query(`SELECT external_user_id FROM meta_contacts WHERE workspace_id=$1 AND connection_id=$2
 AND conversation_id=$3 AND last_inbound_at>now()-interval '24 hours'`,[actor.workspace_id,connection.id,conversationId])).rows[0];
 if(!contact)throw new HttpError(409,'META_MESSAGING_WINDOW_CLOSED');
 const message=await appendMessage(db,{workspace:actor.workspace_id,conversation:conversationId,clientId:input.clientId,body:input.body,author:'agent',actor:actor.user_id,visibility:'public'});
 await db.query(`INSERT INTO meta_outbox(id,workspace_id,connection_id,generation,conversation_id,message_id,recipient_id,actor_id,owner_version)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[randomUUID(),actor.workspace_id,connection.id,connection.generation,conversationId,message.id,contact.external_user_id,actor.user_id,current.owner_version]);
 return {...message,delivery_status:'queued'};
}

/** Claim is committed before network I/O. A dispatching row is never automatically re-queued. */
export const claimFacebookReply=(db:PoolClient,workspace:string)=>claimMetaReply(db,workspace,'facebook');
export const claimInstagramReply=(db:PoolClient,workspace:string)=>claimMetaReply(db,workspace,'instagram');
async function claimMetaReply(db:PoolClient,workspace:string,provider:'facebook'|'instagram') {
 const row=(await db.query("SELECT o.* FROM meta_outbox o JOIN meta_connections x ON x.id=o.connection_id AND x.workspace_id=o.workspace_id WHERE o.workspace_id=$1 AND o.status='queued' AND x.provider=$2 ORDER BY o.created_at,o.id LIMIT 1 FOR UPDATE OF o SKIP LOCKED",[workspace,provider])).rows[0];
 if(!row)return null;
 const eligible=(await db.query(`SELECT m.body,x.asset_id,x.token_ciphertext FROM meta_connections x
 JOIN channels h ON h.id=x.channel_id AND h.workspace_id=x.workspace_id
 JOIN workspaces w ON w.id=x.workspace_id
 JOIN conversations c ON c.id=$3 AND c.workspace_id=x.workspace_id AND c.channel_id=x.channel_id
 JOIN memberships a ON a.workspace_id=x.workspace_id AND a.user_id=$4 AND a.active
 JOIN messages m ON m.id=$5 AND m.workspace_id=x.workspace_id AND m.conversation_id=c.id
 JOIN meta_contacts p ON p.connection_id=x.id AND p.workspace_id=x.workspace_id AND p.conversation_id=c.id AND p.external_user_id=$6
 WHERE x.workspace_id=$1 AND x.id=$2 AND x.provider=$9 AND x.status='active' AND x.generation=$7
 AND x.token_ciphertext IS NOT NULL AND $10=ANY(x.granted_scopes)
 AND (x.token_expires_at IS NULL OR x.token_expires_at>now())
 AND w.status='active' AND h.enabled AND c.reply_owner='HUMAN_ACTIVE' AND c.assigned_to=$4 AND c.owner_version=$8
 AND m.author_type='agent' AND m.actor_id=$4 AND m.visibility='public'
 AND p.last_inbound_at>now()-interval '24 hours'
 AND (a.role IN ('Owner','Admin') OR (a.role='Agent' AND EXISTS(SELECT 1 FROM channel_members cm WHERE cm.workspace_id=x.workspace_id AND cm.channel_id=x.channel_id AND cm.user_id=$4)))
 FOR SHARE OF x,h,w,c,a,m,p`,[workspace,row.connection_id,row.conversation_id,row.actor_id,row.message_id,row.recipient_id,row.generation,row.owner_version,provider,provider==='facebook'?'pages_messaging':'instagram_business_manage_messages'])).rows[0];
 if(!eligible) {
  await db.query("UPDATE meta_outbox SET status='cancelled',completed_at=now() WHERE id=$1 AND workspace_id=$2",[row.id,workspace]);
  return {state:'cancelled' as const,id:row.id};
 }
 await db.query("UPDATE meta_outbox SET status='dispatching',attempted_at=now() WHERE id=$1 AND workspace_id=$2",[row.id,workspace]);
 return {state:'dispatching' as const,...row,...eligible};
}

export const completeFacebookReply=completeMetaReply;
export async function completeMetaReply(db:PoolClient,workspace:string,id:string,result:{status:'accepted';messageId:string}|{status:'unknown'}) {
 const row=(await db.query('SELECT status FROM meta_outbox WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[id,workspace])).rows[0];
 if(!row)throw new HttpError(404,'META_OUTBOX_NOT_FOUND');
 if(row.status!=='dispatching')throw new HttpError(409,'META_OUTBOX_STATE_INVALID');
 if(result.status==='accepted') {
  await db.query("UPDATE meta_outbox SET status='accepted',provider_message_id=$3,completed_at=now() WHERE id=$1 AND workspace_id=$2",[id,workspace,result.messageId]);
  return {status:'accepted' as const};
 }
 await db.query("UPDATE meta_outbox SET status='unknown',completed_at=now() WHERE id=$1 AND workspace_id=$2",[id,workspace]);
 return {status:'unknown' as const};
}
