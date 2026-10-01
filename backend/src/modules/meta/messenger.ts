import {signatureValid} from './webhook-security';
export {verifyMetaWebhook} from './webhook-security';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {scope} from '../../core/db';
import {uuid,HttpError} from '../../core/security';
import {createHash} from 'node:crypto';
import {appendMessage} from '../chat/chat-store';
import {enqueueJob} from '../jobs/jobs';
import {realtimeHub} from '../chat/realtime';
import {normalizeMetaInbound} from './inbound';

/** Ingest Messenger, Instagram messaging, and WhatsApp Cloud webhook envelopes.
 * Routing is always resolved from operator configuration in meta_connections; no
 * workspace id supplied by Meta is trusted. */
export async function receiveMetaWebhook(db:PoolClient,raw:Buffer,signature:string|undefined,afterCommit:Array<()=>void>=[]) {
 if(!signatureValid(raw,signature)) throw new HttpError(403,'META_SIGNATURE_INVALID');
 const body=z.unknown().parse(JSON.parse(raw.toString('utf8')));
 const normalized=normalizeMetaInbound(body);
 if(!normalized.length) return {accepted:true,processed:0};
 const configuredWorkspace=process.env.META_WORKSPACE_ID;
 if(!configuredWorkspace) throw new HttpError(503,'META_ROUTING_NOT_CONFIGURED');
 await scope(db,z.string().uuid().parse(configuredWorkspace));
 let processed=0;
 for(const event of normalized){
  const c=(await db.query(`SELECT * FROM meta_connections WHERE workspace_id=$1 AND external_page_id=$2 AND channel_kind=$3 AND status='connected' FOR UPDATE`,[configuredWorkspace,event.externalAccountId,event.surface])).rows[0];
  if(!c) continue;
  const inserted=(await db.query('INSERT INTO meta_events(id,connection_id,external_event_id,event_kind,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id',[uuid(),c.id,event.eventId,'message',body])).rowCount;
  if(!inserted) continue;
  const profile={externalId:event.senderId,name:'Meta user',source:event.surface};
  await db.query('INSERT INTO meta_identities(id,connection_id,workspace_id,external_user_id,profile) VALUES($1,$2,$3,$4,$5) ON CONFLICT(connection_id,external_user_id) DO UPDATE SET profile=EXCLUDED.profile||meta_identities.profile,updated_at=now()',[uuid(),c.id,c.workspace_id,event.senderId, profile]);
  const conv=(await db.query("SELECT c.id,c.visitor_id,c.owner_version,c.reply_owner FROM conversations c JOIN visitors v ON v.id=c.visitor_id WHERE c.workspace_id=$1 AND c.channel_id=$2 AND v.profile->>'metaUserId'=$3 ORDER BY c.updated_at DESC LIMIT 1",[c.workspace_id,c.channel_id,event.senderId])).rows[0];
  let conversation=conv;
  if(!conversation){const visitorId=uuid();conversation={id:uuid(),visitor_id:visitorId,owner_version:1,reply_owner:'AI_ACTIVE'};await db.query('INSERT INTO visitors(id,workspace_id,channel_id,token_hash,profile,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval \'30 days\')',[visitorId,c.workspace_id,c.channel_id,'meta:'+c.id+':'+event.senderId,{...profile,metaUserId:event.senderId}]);await db.query("INSERT INTO conversations(id,workspace_id,channel_id,visitor_id,reply_owner) VALUES($1,$2,$3,$4,'AI_ACTIVE')",[conversation.id,c.workspace_id,c.channel_id,visitorId]);}
  if(event.surface!=='whatsapp_business') await enqueueJob(db,c.workspace_id,{kind:'meta.profile.fetch',key:`meta-profile:${c.id}:${event.senderId}:${new Date().toISOString().slice(0,10)}`,payload:{connectionId:c.id,userId:event.senderId},external:false});
  const digest=createHash('sha256').update(`${c.id}:${event.eventId}`).digest('hex');const clientId=`${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-8${digest.slice(17,20)}-${digest.slice(20,32)}`;
  const attachmentCount=event.attachments.length+event.mediaReferences.length; const bodyText=event.text|| (attachmentCount?`[Đính kèm ${attachmentCount} tệp từ ${event.surface}]`:'');
  let msg; try { msg=await appendMessage(db,{workspace:c.workspace_id,conversation:conversation.id,clientId,author:'visitor',visibility:'public',body:bodyText,attachments:event.attachments,providerMedia:event.mediaReferences}); } catch(error) { throw error; }
  if(conversation.reply_owner==='AI_ACTIVE'&&event.text) await enqueueJob(db,c.workspace_id,{kind:'ai.reply',key:`conversation:${conversation.id}:message:${msg.id}`,payload:{conversationId:conversation.id,messageId:msg.id,ownerVersion:conversation.owner_version,requireGrounded:true},external:false});
  await db.query('UPDATE meta_events SET processed_at=now() WHERE connection_id=$1 AND external_event_id=$2',[c.id,event.eventId]);
  afterCommit.push(()=>{realtimeHub.broadcastToConversation(conversation.id,'message:new',{...msg,attachments:event.attachments});realtimeHub.broadcastToWorkspace(c.workspace_id,'inbox:visitor_message',{conversationId:conversation.id,source:event.surface,messageSnippet:bodyText.slice(0,100),createdAt:msg.created_at});});
  processed++;
 }
 return {accepted:true,processed};
}
