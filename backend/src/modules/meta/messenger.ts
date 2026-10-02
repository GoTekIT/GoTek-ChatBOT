import {reconcileMetaReceipt} from './receipts';
import {signatureValid} from './webhook-security';
export {verifyMetaWebhook} from './webhook-security';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {resolveConnectionRoute} from './connection-route';
import {uuid,HttpError} from '../../core/security';
import {createHash} from 'node:crypto';
import {appendMessage} from '../chat/chat-store';
import {enqueueJob} from '../jobs/jobs';
import {realtimeHub} from '../chat/realtime';
import {normalizeMetaInbound,normalizeMetaStatuses} from './inbound';
import {quarantineMetaEvent} from './quarantine';

/** Ingest Messenger, Instagram messaging, and WhatsApp Cloud webhook envelopes.
 * Routing is always resolved from operator configuration in meta_connections; no
 * workspace id supplied by Meta is trusted. */
export async function receiveMetaWebhook(db:PoolClient,raw:Buffer,signature:string|undefined,afterCommit:Array<()=>void>=[]) {
 if(!signatureValid(raw,signature)) throw new HttpError(403,'META_SIGNATURE_INVALID');
 const body=z.unknown().parse(JSON.parse(raw.toString('utf8')));
 const statuses=normalizeMetaStatuses(body);
 for(const status of statuses){
  const c=await resolveConnectionRoute(db,status.surface,status.externalAccountId);
  if(!c){ await quarantineMetaEvent(db,status.surface,status.externalAccountId,status.eventId,status,'NO_CONNECTION_MAPPING'); continue; }
  const inserted=(await db.query('INSERT INTO meta_events(id,workspace_id,connection_id,external_event_id,event_kind,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id',[uuid(),c.workspace_id,c.id,status.eventId,'status:'+status.status,status])).rowCount;
  if(inserted){
   await reconcileMetaReceipt(db,c.workspace_id,c.id,status.providerMessageId);
   afterCommit.push(()=>realtimeHub.broadcastToWorkspace(c.workspace_id,'inbox:message_receipt',status));
  }
 }
 const normalized=normalizeMetaInbound(body);
 // Preserve accounts present in the envelope even when normalization cannot
 // produce a message (for example a Page with an unsupported event shape).
 const rawAccounts = body && typeof body==='object' && (body as any).object==='page'
  ? ((Array.isArray((body as any).entry)?(body as any).entry:[]).map((e:any)=>({surface:'facebook_messenger',account:String(e?.id||''),payload:e})))
  : body && typeof body==='object' && (body as any).object==='instagram'
   ? ((Array.isArray((body as any).entry)?(body as any).entry:[]).map((e:any)=>({surface:'instagram_messaging',account:String(e?.id||''),payload:e})))
   : [];
 for(const rawAccount of rawAccounts){
  if(!rawAccount.account) continue;
  const route=await resolveConnectionRoute(db,rawAccount.surface,rawAccount.account);
  if(!route) await quarantineMetaEvent(db,rawAccount.surface,rawAccount.account,createHash('sha256').update(JSON.stringify(rawAccount.payload)).digest('hex'),rawAccount.payload,'NO_CONNECTION_MAPPING');
 }
 if(!normalized.length) return {accepted:true,processed:0};
 let processed=0;
 for(const event of normalized){
  const c=await resolveConnectionRoute(db,event.surface,event.externalAccountId);
  if(!c){ await quarantineMetaEvent(db,event.surface,event.externalAccountId,event.eventId,event,'NO_CONNECTION_MAPPING'); continue; }
  const inserted=(await db.query('INSERT INTO meta_events(id,workspace_id,connection_id,external_event_id,event_kind,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id',[uuid(),c.workspace_id,c.id,event.eventId,'message',event])).rowCount;
  if(!inserted) continue;
  const profile={externalId:event.senderId,name:event.displayName||'Meta user',source:event.surface};
  await db.query('INSERT INTO meta_identities(id,connection_id,workspace_id,external_user_id,profile) VALUES($1,$2,$3,$4,$5) ON CONFLICT(connection_id,external_user_id) DO UPDATE SET profile=EXCLUDED.profile||meta_identities.profile,updated_at=now()',[uuid(),c.id,c.workspace_id,event.senderId, profile]);
  const conv=(await db.query("SELECT c.id,c.visitor_id,c.owner_version,c.reply_owner FROM conversations c JOIN visitors v ON v.id=c.visitor_id WHERE c.workspace_id=$1 AND c.channel_id=$2 AND v.token_hash=$3 ORDER BY c.updated_at DESC LIMIT 1",[c.workspace_id,c.channel_id,'meta:'+c.id+':'+event.senderId])).rows[0];
  let conversation=conv;
  if(!conversation){const visitorId=uuid();conversation={id:uuid(),visitor_id:visitorId,owner_version:1,reply_owner:'AI_ACTIVE'};await db.query('INSERT INTO visitors(id,workspace_id,channel_id,token_hash,profile,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval \'30 days\')',[visitorId,c.workspace_id,c.channel_id,'meta:'+c.id+':'+event.senderId,{...profile,metaUserId:event.senderId}]);await db.query("INSERT INTO conversations(id,workspace_id,channel_id,visitor_id,reply_owner,connection_id) VALUES($1,$2,$3,$4,'AI_ACTIVE',$5)",[conversation.id,c.workspace_id,c.channel_id,visitorId,c.id]);}
  else if(event.displayName) await db.query("UPDATE visitors SET profile=jsonb_set(profile,'{name}',$1::jsonb) WHERE id=$2 AND (profile->>'name' IS NULL OR profile->>'name'='Meta user')",[JSON.stringify(event.displayName),conversation.visitor_id]);
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
