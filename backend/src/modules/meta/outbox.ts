import type {PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {HttpError} from '../../core/security';
import {access,type Actor} from '../chat/inbox';
import {appendMessage} from '../chat/chat-store';

/** Internal enqueue only until dispatcher/UI delivery-state integration is complete. Same transaction as message insert. */
export async function enqueueFacebookReply(db:PoolClient,actor:Actor,conversationId:string,body:unknown) {
 const input=z.object({clientId:z.string().uuid(),body:z.string().trim().min(1).max(2000)}).strict().parse(body);
 const conversation=await access(db,actor,conversationId);
 const connection=(await db.query("SELECT * FROM meta_connections WHERE workspace_id=$1 AND channel_id=$2 AND provider='facebook' FOR UPDATE",[actor.workspace_id,conversation.channel_id])).rows[0];
 if(!connection || connection.status!=='active' || !connection.granted_scopes.includes('pages_messaging'))throw new HttpError(409,'META_RECONNECT_REQUIRED');
 const current=(await db.query('SELECT * FROM conversations WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[actor.workspace_id,conversationId])).rows[0];
 if(current.reply_owner!=='HUMAN_ACTIVE'||current.assigned_to!==actor.user_id)throw new HttpError(409,'TAKEOVER_REQUIRED');
 const previous=(await db.query(`SELECT m.*,o.status delivery_status FROM messages m JOIN meta_outbox o ON o.message_id=m.id
 WHERE m.workspace_id=$1 AND m.conversation_id=$2 AND m.client_id=$3`,[actor.workspace_id,conversationId,input.clientId])).rows[0];
 if(previous) {
  if(previous.body!==input.body || previous.actor_id!==actor.user_id)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');
  return previous;
 }
 const contact=(await db.query(`SELECT external_user_id FROM meta_contacts WHERE workspace_id=$1 AND connection_id=$2
 AND conversation_id=$3 AND last_inbound_at>now()-interval '24 hours'`,[actor.workspace_id,connection.id,conversationId])).rows[0];
 if(!contact)throw new HttpError(409,'META_MESSAGING_WINDOW_CLOSED');
 const message=await appendMessage(db,{workspace:actor.workspace_id,conversation:conversationId,clientId:input.clientId,body:input.body,author:'agent',actor:actor.user_id,visibility:'public'});
 await db.query(`INSERT INTO meta_outbox(id,workspace_id,connection_id,generation,conversation_id,message_id,recipient_id,actor_id,owner_version)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[randomUUID(),actor.workspace_id,connection.id,connection.generation,conversationId,message.id,contact.external_user_id,actor.user_id,current.owner_version]);
 return {...message,delivery_status:'queued'};
}
