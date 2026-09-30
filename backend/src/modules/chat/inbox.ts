import type {PoolClient} from 'pg';
import {z} from 'zod';
import {HttpError,audit} from '../../core/security';
import {appendMessage,takeover} from './chat-store';
import {realtimeHub} from './realtime';

export type Actor={workspace_id:string,user_id:string,role:string};

export async function access(db:PoolClient,a:Actor,id:string){
 z.string().uuid().parse(id);
 const c=(await db.query('SELECT * FROM conversations WHERE id=$1 AND workspace_id=$2',[id,a.workspace_id])).rows[0];if(!c)throw new HttpError(404,'NOT_FOUND');
 if(!(await db.query('SELECT id FROM channels WHERE id=$1 AND workspace_id=$2 AND enabled FOR SHARE',[c.channel_id,a.workspace_id])).rowCount)throw new HttpError(404,'NOT_FOUND');
 if(!['Owner','Admin'].includes(a.role)&&!(await db.query('SELECT user_id FROM channel_members WHERE workspace_id=$1 AND channel_id=$2 AND user_id=$3 FOR SHARE',[a.workspace_id,c.channel_id,a.user_id])).rowCount)throw new HttpError(404,'NOT_FOUND');
 return c;
}

export async function inboxList(db:PoolClient,a:Actor,query?:unknown){const q=z.object({search:z.string().trim().max(120).optional(),status:z.enum(['open','resolved','snoozed']).optional(),assigned:z.enum(['mine','unassigned']).optional()}).parse(query||{});return (await db.query(`SELECT c.id,c.channel_id,c.status,c.reply_owner,c.owner_version,c.assigned_to,c.updated_at,h.name channel_name FROM conversations c JOIN channels h ON h.id=c.channel_id AND h.workspace_id=c.workspace_id WHERE c.workspace_id=$1 AND h.enabled AND ($2::boolean OR EXISTS(SELECT 1 FROM channel_members m WHERE m.workspace_id=c.workspace_id AND m.channel_id=c.channel_id AND m.user_id=$3)) AND ($4::text IS NULL OR c.status=$4) AND ($5::text IS NULL OR h.name ILIKE '%'||$5||'%') AND ($6::text IS NULL OR ($6='mine' AND c.assigned_to=$3) OR ($6='unassigned' AND c.assigned_to IS NULL)) ORDER BY c.updated_at DESC LIMIT 100`,[a.workspace_id,['Owner','Admin'].includes(a.role),a.user_id,q.status||null,q.search||null,q.assigned||null])).rows;}

export async function inboxMessages(db:PoolClient,a:Actor,id:string,after:unknown){await access(db,a,id);const cursor=z.coerce.number().int().min(0).default(0).parse(after);return (await db.query('SELECT id,client_id,sequence,author_type,visibility,body,visitor_received_at,created_at FROM messages WHERE conversation_id=$1 AND sequence>$2 ORDER BY sequence LIMIT 100',[id,cursor])).rows;}

export async function inboxTakeover(db:PoolClient,a:Actor,id:string,body:unknown){
 await access(db,a,id);
 const data=z.object({version:z.number().int().positive()}).strict().parse(body);
 const result=await takeover(db,a.workspace_id,id,a.user_id,data.version);
 await audit(db,a.workspace_id,a.user_id,'conversation.takeover',id);

 // Broadcast realtime takeover event
 realtimeHub.broadcastToConversation(id, 'conversation:takeover', {
   conversationId: id,
   assignedTo: a.user_id,
   replyOwner: result.reply_owner,
   ownerVersion: result.owner_version,
 });
 realtimeHub.broadcastToWorkspace(a.workspace_id, 'inbox:takeover', {
   conversationId: id,
   assignedTo: a.user_id,
 });

 return result;
}

export async function inboxSend(db:PoolClient,a:Actor,id:string,body:unknown){
 await access(db,a,id);
 const data=z.object({clientId:z.string().uuid(),body:z.string().trim().min(1).max(10000),visibility:z.enum(['public','internal'])}).strict().parse(body);
 const message=await appendMessage(db,{workspace:a.workspace_id,conversation:id,clientId:data.clientId,body:data.body,visibility:data.visibility,author:'agent',actor:a.user_id});

 // Broadcast realtime new message event
 realtimeHub.broadcastToConversation(id, 'message:new', message);
 realtimeHub.broadcastToWorkspace(a.workspace_id, 'inbox:message_sent', {
   conversationId: id,
   messageSnippet: message.body.slice(0, 100),
   author: message.author_type,
   visibility: message.visibility,
   createdAt: message.created_at,
 });

 return message;
}

export async function inboxSetStatus(db:PoolClient,a:Actor,id:string,body:unknown){
 await access(db,a,id);
 const data=z.object({status:z.enum(['open','resolved','snoozed'])}).strict().parse(body);
 const current=(await db.query('SELECT status FROM conversations WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[id,a.workspace_id])).rows[0];
 if(!current)throw new HttpError(404,'NOT_FOUND');
 const row=(await db.query('UPDATE conversations SET status=$1,updated_at=now() WHERE id=$2 AND workspace_id=$3 RETURNING id,status,updated_at',[data.status,id,a.workspace_id])).rows[0];
 if(!row)throw new HttpError(404,'NOT_FOUND');
 await audit(db,a.workspace_id,a.user_id,`conversation.${data.status}`,id);

 // Broadcast realtime status change event
 realtimeHub.broadcastToConversation(id, 'conversation:status', row);
 realtimeHub.broadcastToWorkspace(a.workspace_id, 'inbox:status_changed', {
   conversationId: id,
   status: row.status,
 });

 return {...row,previousStatus:current.status};
}

/** Explicit return to AI; never triggered automatically by a visitor message. */
export async function inboxResumeAi(db:PoolClient,a:Actor,id:string,body:unknown){
 await access(db,a,id);
 const data=z.object({version:z.number().int().positive()}).strict().parse(body);
 const current=(await db.query('SELECT reply_owner,owner_version,assigned_to FROM conversations WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[id,a.workspace_id])).rows[0];
 if(!current)throw new HttpError(404,'NOT_FOUND');
 if(current.owner_version!==data.version)throw new HttpError(409,'STALE_REPLY_OWNER');
 if(!['Owner','Admin'].includes(a.role)&&current.assigned_to!==a.user_id)throw new HttpError(403,'FORBIDDEN');
 if(current.reply_owner==='AI_ACTIVE')throw new HttpError(409,'INVALID_STATE');
 const row=(await db.query("UPDATE conversations SET reply_owner='AI_ACTIVE',assigned_to=NULL,owner_version=owner_version+1,updated_at=now() WHERE id=$1 AND workspace_id=$2 RETURNING id,reply_owner,owner_version,assigned_to",[id,a.workspace_id])).rows[0];
 await audit(db,a.workspace_id,a.user_id,'conversation.ai_resumed',id);

 // Broadcast realtime AI resume event
 realtimeHub.broadcastToConversation(id, 'conversation:ai_resumed', row);
 realtimeHub.broadcastToWorkspace(a.workspace_id, 'inbox:ai_resumed', {
   conversationId: id,
   replyOwner: row.reply_owner,
 });

 return row;
}

/** Typing indicator broadcast (Client -> Server -> Realtime Stream) */
export async function inboxTyping(db:PoolClient,a:Actor,id:string,body:unknown){
 await access(db,a,id);
 const data=z.object({isTyping:z.boolean()}).parse(body);
 realtimeHub.broadcastToConversation(id, 'typing', {
   conversationId: id,
   actorId: a.user_id,
   actorType: 'agent',
   isTyping: data.isTyping,
   timestamp: new Date().toISOString(),
 });
 return {success:true};
}
