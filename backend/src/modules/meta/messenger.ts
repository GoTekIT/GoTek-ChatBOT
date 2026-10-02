import {recordMetaHistoryReply} from './history-reply';
import {reconcileMetaReceipt} from './receipts';
import {signatureValid} from './webhook-security';
export {verifyMetaWebhook} from './webhook-security';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {resolveConnectionRoute, type MetaConnectionRoute} from './connection-route';
import {uuid,HttpError} from '../../core/security';
import {createHash} from 'node:crypto';
import {appendMessage} from '../chat/chat-store';
import {enqueueJob} from '../jobs/jobs';
import {realtimeHub} from '../chat/realtime';
import {normalizeMetaInbound,normalizeMetaStatuses,type NormalizedMetaInbound,type NormalizedMetaStatus} from './inbound';

type MetaIngressKind='message'|'status'|'unknown';
type MetaIngressQueueResult={ingressId:string;state:string};

const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const text=(value:unknown):string=>typeof value==='string'?value:'';
const hashEvent=(surface:string,account:string,payload:unknown):string=>createHash('sha256').update(`${surface}:${account}:${JSON.stringify(payload)}`).digest('hex');

/** Store one already-normalized event through the database-owned routing map. */
async function queueIngress(db:PoolClient,surface:string,account:string,eventId:string,kind:MetaIngressKind,payload:unknown):Promise<MetaIngressQueueResult>{
 const row=(await db.query('SELECT ingress_id AS "ingressId",ingress_state AS state FROM enqueue_meta_ingress($1,$2,$3,$4,$5::jsonb)',[surface,account,eventId,kind,JSON.stringify(payload)])).rows[0];
 if(!row)throw new HttpError(503,'META_INGRESS_UNAVAILABLE');
 return row;
}

/** Keep unsupported events instead of rejecting the whole Meta envelope. */
function collectUnknownEvents(body:unknown,known:Set<string>):Array<{surface:string;account:string,eventId:string,payload:unknown}>{
 const input=record(body),objectName=text(input.object);
 const out:Array<{surface:string;account:string,eventId:string,payload:unknown}>=[];
 if(objectName==='page'||objectName==='instagram'){
  const surface=objectName==='page'?'facebook_messenger':'instagram_messaging';
  for(const rawEntry of list(input.entry)){
   const entry=record(rawEntry),account=text(entry.id);if(!account)continue;
   const events=list(entry.messaging);
   if(!events.length){const id=hashEvent(surface,account,entry);if(!known.has(`${account}:${id}`))out.push({surface,account,eventId:id,payload:entry});continue;}
   for(const rawEvent of events){
    const event=record(rawEvent),message=record(event.message),delivery=record(event.delivery),read=record(event.read);
    const normalizedStatuses=normalizeMetaStatuses({object:objectName,entry:[{id:account,messaging:[event]}]});
    const ids=[text(message.mid),...list(delivery.mids).map(text),text(read.mid),...normalizedStatuses.map(status=>status.eventId)].filter(Boolean);
    if(ids.some(id=>known.has(`${account}:${id}`)))continue;
    const id=ids[0]||hashEvent(surface,account,event);
    out.push({surface,account,eventId:id,payload:event});
   }
  }
 }else if(objectName==='whatsapp_business_account'){
  for(const rawEntry of list(input.entry)) for(const rawChange of list(record(rawEntry).changes)){
   const change=record(rawChange),value=record(change.value),account=text(record(value.metadata).phone_number_id);if(!account)continue;
   const candidates=[...list(value.messages).map(item=>text(record(item).id)),...list(value.statuses).map(item=>text(record(item).id))].filter(Boolean);
   if(candidates.length&&candidates.every(id=>known.has(`${account}:${id}`)))continue;
   const id=candidates.find(candidate=>!known.has(`${account}:${candidate}`))||hashEvent('whatsapp_business',account,change);
   out.push({surface:'whatsapp_business',account,eventId:id,payload:change});
  }
 }
 return out;
}

/** Validate, split, and persist every event before the webhook ACK. */
export async function queueMetaBody(db:PoolClient,body:unknown){
 const statuses=normalizeMetaStatuses(body);
 const messages=normalizeMetaInbound(body);
 const known=new Set<string>([...statuses,...messages].map(event=>`${event.externalAccountId}:${event.eventId}`));
 let queued=0;
 // Delivery and read share a provider message ID but are distinct queue events.
 for(const event of statuses){
  const queueId='status:'+createHash('sha256').update(JSON.stringify([event.eventId,event.status,event.recipientId])).digest('hex');
  await queueIngress(db,event.surface,event.externalAccountId,queueId,'status',event);queued++;
 }
 for(const event of messages){await queueIngress(db,event.surface,event.externalAccountId,event.eventId,'message',event);queued++;}
 for(const event of collectUnknownEvents(body,known)){
  await queueIngress(db,event.surface,event.account,event.eventId,'unknown',event.payload);queued++;
 }
 return {accepted:true,queued};
}

/** Persist one status projection. Caller must already have set the tenant scope. */
export async function processNormalizedMetaStatus(db:PoolClient,event:NormalizedMetaStatus,c:MetaConnectionRoute,afterCommit:Array<()=>void>=[],options:{historical?:boolean;historicalPageReply?:boolean}={}){
 const inserted=(await db.query('INSERT INTO meta_events(id,workspace_id,connection_id,external_event_id,event_kind,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id',[uuid(),c.workspace_id,c.id,event.eventId,'status:'+event.status,event])).rowCount;
 if(!inserted)return false;
 await reconcileMetaReceipt(db,c.workspace_id,c.id,event.providerMessageId);
 afterCommit.push(()=>realtimeHub.broadcastToWorkspace(c.workspace_id,'inbox:message_receipt',{...event,connectionId:c.id},{channelId:c.channel_id}));
 return true;
}

/** Persist one inbound message after the durable ingress worker has claimed it. */
export async function processNormalizedMetaInbound(db:PoolClient,event:NormalizedMetaInbound,c:MetaConnectionRoute,afterCommit:Array<()=>void>=[],options:{historical?:boolean;historicalPageReply?:boolean}={}){
 const inserted=(await db.query('INSERT INTO meta_events(id,workspace_id,connection_id,external_event_id,event_kind,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id',[uuid(),c.workspace_id,c.id,event.eventId,'message',event])).rowCount;
 if(!inserted)return false;
 const profile={externalId:event.senderId,name:event.displayName||'Meta user',source:event.surface};
 await db.query('INSERT INTO meta_identities(id,connection_id,workspace_id,external_user_id,profile) VALUES($1,$2,$3,$4,$5) ON CONFLICT(connection_id,external_user_id) DO UPDATE SET profile=EXCLUDED.profile||meta_identities.profile,updated_at=now()',[uuid(),c.id,c.workspace_id,event.senderId,profile]);
 const conv=(await db.query("SELECT c.id,c.visitor_id,c.owner_version,c.reply_owner FROM conversations c JOIN visitors v ON v.id=c.visitor_id WHERE c.workspace_id=$1 AND c.channel_id=$2 AND c.connection_id=$3 AND v.token_hash=$4 ORDER BY c.updated_at DESC LIMIT 1",[c.workspace_id,c.channel_id,c.id,'meta:'+c.id+':'+event.senderId])).rows[0];
 let conversation=conv;
 if(!conversation){
  const visitorId=uuid();
  conversation={id:uuid(),visitor_id:visitorId,owner_version:1,reply_owner:'AI_ACTIVE'};
  await db.query('INSERT INTO visitors(id,workspace_id,channel_id,token_hash,profile,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval \'30 days\')',[visitorId,c.workspace_id,c.channel_id,'meta:'+c.id+':'+event.senderId,{...profile,metaUserId:event.senderId}]);
  await db.query("INSERT INTO conversations(id,workspace_id,channel_id,visitor_id,reply_owner,connection_id) VALUES($1,$2,$3,$4,'AI_ACTIVE',$5)",[conversation.id,c.workspace_id,c.channel_id,visitorId,c.id]);
 }else if(event.displayName){
  await db.query("UPDATE visitors SET profile=jsonb_set(profile,'{name}',$1::jsonb) WHERE id=$2 AND (profile->>'name' IS NULL OR profile->>'name'='Meta user')",[JSON.stringify(event.displayName),conversation.visitor_id]);
 }
 if(!options.historical&&event.surface!=='whatsapp_business') await enqueueJob(db,c.workspace_id,{kind:'meta.profile.fetch',key:`meta-profile:${c.id}:${event.senderId}:${new Date().toISOString().slice(0,10)}`,payload:{connectionId:c.id,userId:event.senderId},external:false});
 const digest=createHash('sha256').update(`${c.id}:${event.eventId}`).digest('hex');
 const clientId=`${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-8${digest.slice(17,20)}-${digest.slice(20,32)}`;
 const attachmentCount=event.attachments.length+event.mediaReferences.length;
 const bodyText=event.text|| (attachmentCount?`[Đính kèm ${attachmentCount} tệp từ ${event.surface}]`:'');
 if(!bodyText)return false;
 const msg=(event.isPageReply || (options.historical&&options.historicalPageReply)) ? await recordMetaHistoryReply(db,c.workspace_id,c.id,conversation.id,clientId,event) : await appendMessage(db,{workspace:c.workspace_id,conversation:conversation.id,clientId,author:'visitor',visibility:'public',body:bodyText,attachments:event.attachments,providerMedia:event.mediaReferences,...(event.createdAt?{createdAt:event.createdAt}:{})});
 if(event.isPageReply)await reconcileMetaReceipt(db,c.workspace_id,c.id,event.eventId);
 if(!options.historical&&!event.isPageReply&&conversation.reply_owner==='AI_ACTIVE'&&event.text) await enqueueJob(db,c.workspace_id,{kind:'ai.reply',key:`conversation:${conversation.id}:message:${msg.id}`,payload:{conversationId:conversation.id,messageId:msg.id,ownerVersion:conversation.owner_version,requireGrounded:true},external:false});
 await db.query('UPDATE meta_events SET processed_at=now() WHERE connection_id=$1 AND external_event_id=$2 AND event_kind=\'message\'',[c.id,event.eventId]);
 afterCommit.push(()=>{
  realtimeHub.broadcastToConversation(conversation.id,'message:new',{...msg,attachments:event.attachments,connectionId:c.id,platform:event.surface});
  realtimeHub.broadcastToWorkspace(c.workspace_id,event.isPageReply?'inbox:message_sent':'inbox:visitor_message',{conversationId:conversation.id,source:event.surface,connectionId:c.id,messageSnippet:bodyText.slice(0,100),createdAt:msg.created_at},{channelId:c.channel_id});
 });
 return true;
}

/** Synchronous compatibility path used by focused unit tests and operator replay. */
export async function ingestMetaBody(db:PoolClient,body:unknown,afterCommit:Array<()=>void>=[]) {
 const statuses=normalizeMetaStatuses(body);
 for(const status of statuses){const c=await resolveConnectionRoute(db,status.surface,status.externalAccountId);if(!c)throw new HttpError(503,'META_ROUTE_UNAVAILABLE');await processNormalizedMetaStatus(db,status,c,afterCommit);}
 const normalized=normalizeMetaInbound(body);
 const rawAccounts = body && typeof body==='object' && (body as any).object==='page'
  ? ((Array.isArray((body as any).entry)?(body as any).entry:[]).map((e:any)=>({surface:'facebook_messenger',account:String(e?.id||'')})))
  : body && typeof body==='object' && (body as any).object==='instagram'
   ? ((Array.isArray((body as any).entry)?(body as any).entry:[]).map((e:any)=>({surface:'instagram_messaging',account:String(e?.id||'')})))
   : [];
 for(const rawAccount of rawAccounts){if(!rawAccount.account)continue;const route=await resolveConnectionRoute(db,rawAccount.surface,rawAccount.account);if(!route)throw new HttpError(503,'META_ROUTE_UNAVAILABLE');}
 let processed=0;
 for(const event of normalized){const c=await resolveConnectionRoute(db,event.surface,event.externalAccountId);if(!c)throw new HttpError(503,'META_ROUTE_UNAVAILABLE');if(await processNormalizedMetaInbound(db,event,c,afterCommit))processed++;}
 return {accepted:true,processed};
}

export async function receiveMetaWebhook(db:PoolClient,raw:Buffer,signature:string|undefined,_legacyAfterCommit?:Array<()=>void>){
 if(!signatureValid(raw,signature)) throw new HttpError(403,'META_SIGNATURE_INVALID');
 if(raw.length>1024*1024)throw new HttpError(413,'META_WEBHOOK_TOO_LARGE');
 const body=z.unknown().parse(JSON.parse(raw.toString('utf8')));
 const result=await queueMetaBody(db,body);
 // `processed` remains in the response for older internal callers. Live HTTP
 // callers must wait for the durable worker before a message is processed.
 return {...result,processed:0};
}
