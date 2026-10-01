import {z} from 'zod';
import type {MetaSurface} from './connectors';
import {parseMetaAttachments, type MetaAttachment} from './attachments';

export type NormalizedMetaInbound = {
  surface: MetaSurface;
  externalAccountId: string;
  senderId: string;
  eventId: string;
  text: string;
  displayName?: string;
  attachments: MetaAttachment[];
  mediaReferences: Array<{type:'image'|'video'|'audio'|'file';id:string}>;
};
export type NormalizedMetaStatus = {surface:'whatsapp_business';externalAccountId:string;eventId:string;providerMessageId:string;status:'sent'|'delivered'|'read'|'failed';recipientId:string;error?:string};
const record=z.record(z.string(),z.unknown());
const object=(value:unknown):Record<string,unknown>=>record.safeParse(value).data||{};
const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const str=(value:unknown):string=>typeof value==='string'?value:'';

/** Signature verification and server-owned tenant routing remain the caller's responsibility.
 * WhatsApp media IDs require authenticated resolution; they are never public URLs.
 */
export function normalizeMetaInbound(input:unknown):NormalizedMetaInbound[]{
 const body=object(input);
 if(!['page','instagram','whatsapp_business_account'].includes(str(body.object)))return [];
 const surface:MetaSurface=body.object==='page'?'facebook_messenger':body.object==='instagram'?'instagram_messaging':'whatsapp_business';
 const out:NormalizedMetaInbound[]=[];
 for(const item of list(body.entry)){
  const entry=object(item);
  if(surface==='whatsapp_business'){
   for(const item of list(entry.changes)){
    const change=object(item),value=object(change.value);
    const account=str(object(value.metadata).phone_number_id);
    if(change.field!=='messages'||value.messaging_product!=='whatsapp'||!account)continue;
    for(const item of list(value.messages)){
     const message=object(item),senderId=str(message.from),eventId=str(message.id);
     if(!senderId||!eventId)continue;
     const kind=str(message.type),media=object(message[kind]);
     const mediaType=kind==='document'?'file':kind==='sticker'?'image':kind;
     const mediaReferences:NormalizedMetaInbound['mediaReferences']=[];
     if(['image','video','audio','file'].includes(mediaType)&&str(media.id))mediaReferences.push({type:mediaType as 'image'|'video'|'audio'|'file',id:str(media.id)});
     const text=(kind==='text'?str(object(message.text).body):str(media.caption)).trim();
     if(!text&&!mediaReferences.length)continue;
     const matches=list(value.contacts).map(object).filter(contact=>str(contact.wa_id)===senderId);
     const displayName=matches.length===1?str(object(matches[0].profile).name).trim().slice(0,300):'';
     out.push({surface,externalAccountId:account,senderId,eventId,text,attachments:[],mediaReferences,...(displayName?{displayName}:{})});
    }
   }
  }else{
   const account=str(entry.id);if(!account)continue;
   for(const item of list(entry.messaging)){
    const event=object(item),message=object(event.message);
    const senderId=str(object(event.sender).id),eventId=str(message.mid);
    if(message.is_echo||str(object(event.recipient).id)!==account||!senderId||!eventId)continue;
    const text=str(message.text).trim(),attachments=parseMetaAttachments(message.attachments);
    if(!text&&!attachments.length)continue;
    out.push({surface,externalAccountId:account,senderId,eventId,text,attachments,mediaReferences:[]});
   }
  }
 }
 return out;
}

export function normalizeMetaStatuses(input:unknown):NormalizedMetaStatus[]{
 const body=object(input),out:NormalizedMetaStatus[]=[];
 if(body.object!=='whatsapp_business_account')return out;
 for(const item of list(body.entry)) for(const change of list(object(item).changes)){
  const value=object(object(change).value),account=str(object(value.metadata).phone_number_id);
  if(object(change).field!=='messages'||value.messaging_product!=='whatsapp'||!account)continue;
  for(const raw of list(value.statuses)){
   const s=object(raw),status=str(s.status),id=str(s.id);
   if(!id||!['sent','delivered','read','failed'].includes(status))continue;
   const errors=list(s.errors).map(object).map(e=>str(e.title)||str(e.message)).filter(Boolean).join('; ');
   out.push({surface:'whatsapp_business',externalAccountId:account,eventId:id,providerMessageId:id,status:status as NormalizedMetaStatus['status'],recipientId:str(s.recipient_id),...(errors?{error:errors}:{})});
  }
 }
 return out;
}
