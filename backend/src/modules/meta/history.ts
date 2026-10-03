import {metaGraphVersion} from './graph-version';
import {resolveMetaCredential} from './credential-vault';
import {HttpError} from '../../core/security';
import type {PoolClient} from 'pg';
import {processNormalizedMetaInbound} from './messenger';
import type {NormalizedMetaInbound} from './inbound';
import {parseMetaHistoryAttachments} from './attachments';

type HistoryMessage={id?:unknown,message?:unknown,created_time?:unknown,from?:{id?:unknown,name?:unknown},attachments?:unknown};
const str=(v:unknown)=>typeof v==='string'?v:'';
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const arr=(v:unknown)=>Array.isArray(v)?v:[];

/** Recover Page Messenger history with a durable Graph paging cursor. Webhooks remain authoritative for new events. */
export async function syncMetaHistoryOnce(db:PoolClient,workspace:string,connectionId:string,fetchImpl:typeof fetch=fetch){
 const c=(await db.query("SELECT id,channel_id,external_page_id,channel_kind,page_access_token_ref,status FROM meta_connections WHERE id=$1 AND workspace_id=$2 AND status='connected' FOR SHARE",[connectionId,workspace])).rows[0];
 if(!c)throw new HttpError(409,'META_CONNECTION_NOT_READY');
 if(c.channel_kind!=='facebook_messenger')return {state:'unsupported',imported:0};
 // Serialize concurrent scheduler passes without blocking another connection.
 const locked=(await db.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked',[`meta-history:${workspace}:${connectionId}`])).rows[0]?.locked;
 if(!locked)return {state:'busy',imported:0};
 const checkpoint=(await db.query("SELECT next_url,state,last_synced_at,updated_at,pending_threads FROM meta_history_sync WHERE workspace_id=$1 AND connection_id=$2",[workspace,connectionId])).rows[0];
 if(checkpoint?.state==='retry'&&Date.now()-new Date(checkpoint.updated_at).getTime()<60000)return {state:'retry_wait',imported:0};
 if(checkpoint?.state==='complete'&&Date.now()-new Date(checkpoint.last_synced_at).getTime()<300000)return {state:'idle',imported:0};
 const token=await resolveMetaCredential(db,workspace,connectionId,c.page_access_token_ref);
 const safeCursor=(value:string):string=>{
  let parsed:URL;try{parsed=new URL(value);}catch{throw new HttpError(502,'META_HISTORY_CURSOR_INVALID');}
  if(parsed.protocol!=='https:'||parsed.hostname!=='graph.facebook.com'||parsed.username||parsed.password)throw new HttpError(502,'META_HISTORY_CURSOR_INVALID');
  parsed.searchParams.delete('access_token');return parsed.href;
 };
 const pending=arr(checkpoint?.pending_threads).map(obj);
 const resumed=pending[0];
 const cursor=resumed?str(resumed.next):str(checkpoint?.next_url);
 if(resumed&&!cursor)throw new HttpError(502,'META_HISTORY_CURSOR_INVALID');
 const url=cursor||`https://graph.facebook.com/${metaGraphVersion()}/${encodeURIComponent(c.external_page_id)}/conversations?platform=messenger&limit=50&fields=participants,messages.limit(100){id,message,created_time,from,attachments}`;
 const target=safeCursor(url);
 const response=await fetchImpl(target,{redirect:'error',headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
 const body=obj(await response.json().catch(()=>null));if(!response.ok)throw new HttpError(502,'META_HISTORY_FETCH_FAILED');
 if(!Array.isArray(body.data)||body.error)throw new HttpError(502,'META_HISTORY_RESPONSE_INVALID');
 const rawNext=str(obj(body.paging).next);
 const providerNext=rawNext?safeCursor(rawNext):null;
 if(providerNext===target)throw new HttpError(502,'META_HISTORY_PAGING_LOOP');
 const next=resumed?(str(checkpoint?.next_url)||null):providerNext;
 const remaining=resumed?pending.slice(1):[];
 const conversations=resumed?[{participants:{data:arr(resumed.participants)},messages:{data:body.data,paging:{next:providerNext}}}]:body.data;
 let imported=0;
 for(const raw of conversations){
  const conversation=obj(raw),messages=arr(obj(conversation.messages).data);
  const nestedNext=str(obj(obj(conversation.messages).paging).next);
  if(nestedNext){
   const nested=safeCursor(nestedNext);
   if(nested===target)throw new HttpError(502,'META_HISTORY_PAGING_LOOP');
   remaining.push({next:nested,participants:arr(obj(conversation.participants).data).map(p=>({id:str(obj(p).id),name:str(obj(p).name)}))});
  }
  for(const rawMessage of messages){
   const m=rawMessage as HistoryMessage, sender=obj(m.from), senderId=str(sender.id), eventId=str(m.id), text=str(m.message).trim();
   const attachments=parseMetaHistoryAttachments(m.attachments);
   if(!senderId||!eventId||(!text&&!attachments.length))continue;
   const pageReply=senderId===String(c.external_page_id);
   const participants=arr(obj(conversation.participants).data).map(obj).filter(p=>str(p.id)&&str(p.id)!==String(c.external_page_id));
   if(pageReply&&participants.length!==1)throw new HttpError(502,'META_HISTORY_RECIPIENT_AMBIGUOUS');
   const customer=pageReply?participants[0]:sender;
   const createdAt=str(m.created_time);
   const event:NormalizedMetaInbound={surface:'facebook_messenger',externalAccountId:String(c.external_page_id),senderId:str(customer.id),eventId,text:text||`[Đính kèm ${attachments.length} tệp từ facebook_messenger]`,displayName:str(customer.name)||undefined,attachments,mediaReferences:[],...(createdAt?{createdAt}:{})};
   if(await processNormalizedMetaInbound(db,event,{id:c.id,workspace_id:workspace,channel_id:c.channel_id},[],{historical:true,historicalPageReply:pageReply}))imported++;
  }
 }
 const more=!!next||remaining.length>0;
 await db.query(`INSERT INTO meta_history_sync(workspace_id,connection_id,next_url,last_synced_at,state,last_error,pending_threads) VALUES($1,$2,$3,now(),$4,NULL,$5::jsonb)
  ON CONFLICT(workspace_id,connection_id) DO UPDATE SET next_url=EXCLUDED.next_url,last_synced_at=EXCLUDED.last_synced_at,state=EXCLUDED.state,last_error=NULL,pending_threads=EXCLUDED.pending_threads,updated_at=now()`,[workspace,connectionId,next,more?'pending':'complete',JSON.stringify(remaining)]);
 return {state:more?'more':'complete',imported};
}
