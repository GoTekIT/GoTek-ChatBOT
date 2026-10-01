import type {PoolClient} from 'pg';import {z} from 'zod';import {uuid,HttpError} from '../../core/security';
export async function appendMessage(db:PoolClient,input:{workspace:string,conversation:string,clientId:string,author:'visitor'|'agent'|'ai',actor?:string,visibility:'public'|'internal',body:string,ownerVersion?:number,messageId?:string,attachments?:Array<{type:'image'|'video'|'audio'|'file';url:string}>}){
 z.string().uuid().parse(input.clientId);z.string().min(1).max(10000).parse(input.body);
 if(input.messageId)z.string().uuid().parse(input.messageId);
 if(input.visibility==='internal'&&input.author!=='agent')throw new HttpError(403,'INVALID_VISIBILITY');
 const c=(await db.query('SELECT * FROM conversations WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[input.conversation,input.workspace])).rows[0];if(!c)throw new HttpError(404,'NOT_FOUND');
 const old=(await db.query('SELECT * FROM messages WHERE conversation_id=$1 AND client_id=$2',[c.id,input.clientId])).rows[0];if(old){if(old.body!==input.body||old.author_type!==input.author||old.visibility!==input.visibility||old.actor_id!==(input.actor??null))throw new HttpError(409,'IDEMPOTENCY_CONFLICT');const existing=(await db.query('SELECT kind AS type,url FROM message_attachments WHERE workspace_id=$1 AND message_id=$2',[input.workspace,old.id])).rows;
 const canonical=(items:Array<{type:string;url:string}>)=>JSON.stringify(items.map(a=>JSON.stringify([a.type,a.url])).sort());
 if(canonical(existing)!==canonical(input.attachments??[]))throw new HttpError(409,'IDEMPOTENCY_CONFLICT');
 return {...old,attachments:existing};}
 if(input.author==='ai'&&(c.reply_owner!=='AI_ACTIVE'||c.owner_version!==input.ownerVersion))throw new HttpError(409,'STALE_REPLY_OWNER');
 if(input.author==='agent'&&input.visibility==='public'&&(c.reply_owner!=='HUMAN_ACTIVE'||c.assigned_to!==input.actor))throw new HttpError(409,'TAKEOVER_REQUIRED');
 const msgId=input.messageId||uuid();
 const message=(await db.query('INSERT INTO messages(id,workspace_id,conversation_id,client_id,sequence,author_type,actor_id,visibility,body) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[msgId,input.workspace,c.id,input.clientId,c.next_sequence,input.author,input.actor??null,input.visibility,input.body])).rows[0];
 if(input.attachments?.length)await db.query('INSERT INTO message_attachments(message_id,workspace_id,kind,url) SELECT $1,$2,x.kind,x.url FROM jsonb_to_recordset($3::jsonb) AS x(kind text,url text)',[msgId,input.workspace,JSON.stringify(input.attachments.map(({type,url})=>({kind:type,url})))]);
 await db.query("UPDATE conversations SET next_sequence=next_sequence+1,updated_at=now(),status=CASE WHEN $2='visitor' THEN 'open' ELSE status END WHERE id=$1",[c.id,input.author]);return {...message,attachments:input.attachments??[]};
}
export async function takeover(db:PoolClient,workspace:string,conversation:string,actor:string,version:number){const row=(await db.query("UPDATE conversations SET reply_owner='HUMAN_ACTIVE',assigned_to=$1,owner_version=owner_version+1,status='open',updated_at=now() WHERE workspace_id=$2 AND id=$3 AND owner_version=$4 RETURNING id,owner_version,assigned_to,status,reply_owner",[actor,workspace,conversation,version])).rows[0];if(!row)throw new HttpError(409,'STALE_REPLY_OWNER');return row;}
