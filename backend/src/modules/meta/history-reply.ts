import type {PoolClient} from 'pg';
import {uuid,HttpError} from '../../core/security';
import type {NormalizedMetaInbound} from './inbound';

/** Records provider history only. Never dispatches a reply or changes ownership. */
export async function recordMetaHistoryReply(db:PoolClient,workspace:string,connection:string,conversation:string,clientId:string,event:NormalizedMetaInbound){
 const c=(await db.query('SELECT next_sequence FROM conversations WHERE id=$1 AND workspace_id=$2 AND connection_id=$3 FOR UPDATE',[conversation,workspace,connection])).rows[0];
 if(!c)throw new HttpError(404,'NOT_FOUND');
 const existing=(await db.query('SELECT m.* FROM meta_message_deliveries d JOIN messages m ON m.id=d.message_id AND m.workspace_id=d.workspace_id WHERE d.workspace_id=$1 AND d.connection_id=$2 AND d.provider_message_id=$3',[workspace,connection,event.eventId])).rows[0];
 if(existing)return existing;
 const createdAt=new Date(event.createdAt||'');
 if(Number.isNaN(createdAt.getTime()))throw new HttpError(400,'INVALID_CREATED_AT');
 const body=event.text||`[Đính kèm ${event.attachments.length} tệp từ Facebook]`;
 if(body.length>10000)throw new HttpError(400,'META_HISTORY_MESSAGE_TOO_LONG');
 const msg=(await db.query("INSERT INTO messages(id,workspace_id,conversation_id,client_id,sequence,author_type,actor_id,visibility,body,created_at) VALUES($1,$2,$3,$4,$5,'agent',NULL,'public',$6,$7) RETURNING *",[uuid(),workspace,conversation,clientId,c.next_sequence,body,createdAt])).rows[0];
 if(event.attachments.length)await db.query('INSERT INTO message_attachments(message_id,workspace_id,kind,url) SELECT $1,$2,x.type,x.url FROM jsonb_to_recordset($3::jsonb) AS x(type text,url text)',[msg.id,workspace,JSON.stringify(event.attachments)]);
 await db.query("INSERT INTO meta_message_deliveries(id,workspace_id,message_id,provider_message_id,status,connection_id) VALUES($1,$2,$3,$4,'accepted',$5)",[uuid(),workspace,msg.id,event.eventId,connection]);
 await db.query('UPDATE conversations SET next_sequence=next_sequence+1 WHERE id=$1 AND workspace_id=$2',[conversation,workspace]);
 return {...msg,attachments:event.attachments};
}
