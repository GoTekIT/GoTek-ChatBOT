import {metaGraphVersion} from './graph-version';
export type MetaSendResult={status:'accepted'|'failed'|'unknown';providerMessageId?:string;errorCode?:string};
export type MetaChannelKind='facebook_messenger'|'instagram_messaging'|'whatsapp_business';
export type MetaMediaKind='image'|'video'|'audio'|'file';
/** Sends text through the provider-specific Graph endpoint. Tokens are resolved by reference only. */
export async function sendMetaText(input:{recipientId:string;text:string;pageAccessTokenRef:string;accessToken?:string;channelKind?:MetaChannelKind;externalAccountId?:string;fetchImpl?:typeof fetch}):Promise<MetaSendResult>{
 const kind=input.channelKind??'facebook_messenger';
 if(!['facebook_messenger','instagram_messaging','whatsapp_business'].includes(kind))return {status:'failed',errorCode:'META_CHANNEL_UNSUPPORTED'};
 if(kind==='whatsapp_business'&&!input.externalAccountId?.trim())return {status:'failed',errorCode:'META_ACCOUNT_REQUIRED'};
 const token=input.accessToken??process.env[input.pageAccessTokenRef];
 if(!token)return {status:'failed',errorCode:'META_TOKEN_NOT_CONFIGURED'};
 if(!input.recipientId||!input.text.trim())return {status:'failed',errorCode:'META_MESSAGE_INVALID'};
 const fetchImpl=input.fetchImpl||fetch;
 const endpoint=kind==='whatsapp_business'?`https://graph.facebook.com/${metaGraphVersion()}/${encodeURIComponent(input.externalAccountId||'')}/messages`:`https://graph.facebook.com/${metaGraphVersion()}/me/messages`;
 const message=kind==='whatsapp_business'?{messaging_product:'whatsapp',to:input.recipientId,type:'text',text:{body:input.text}}:{messaging_type:'RESPONSE',recipient:{id:input.recipientId},message:{text:input.text}};
 try{const response=await fetchImpl(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(message)});const body=await response.json().catch(()=>null);if(!response.ok)return {status:response.status>=500?'unknown':'failed',errorCode:`META_HTTP_${response.status}`};const receipt=kind==='whatsapp_business'?body?.messages?.[0]?.id:body?.message_id;const id=typeof receipt==='string'?receipt.trim():'';if(!id)return {status:'unknown',errorCode:'META_RECEIPT_MISSING'};return {status:'accepted',providerMessageId:id};}catch{return {status:'unknown',errorCode:'META_NETWORK_UNKNOWN'};}
}

/** Send one provider-hosted media URL. URLs are validated before leaving the server. */
export async function sendMetaMedia(input:{recipientId:string;mediaType:MetaMediaKind;mediaUrl:string;caption?:string;pageAccessTokenRef:string;accessToken?:string;channelKind?:MetaChannelKind;externalAccountId?:string;fetchImpl?:typeof fetch}):Promise<MetaSendResult>{
 const kind=input.channelKind??'facebook_messenger';
 if(!['facebook_messenger','instagram_messaging','whatsapp_business'].includes(kind))return {status:'failed',errorCode:'META_CHANNEL_UNSUPPORTED'};
 if(kind==='whatsapp_business'&&!input.externalAccountId?.trim())return {status:'failed',errorCode:'META_ACCOUNT_REQUIRED'};
 if(!input.recipientId?.trim()||!['image','video','audio','file'].includes(input.mediaType))return {status:'failed',errorCode:'META_MEDIA_INVALID'};
 if(input.caption&&(kind!=='whatsapp_business'||input.mediaType==='audio'||input.caption.length>1024))return {status:'failed',errorCode:'META_CAPTION_UNSUPPORTED'};
 const token=input.accessToken??process.env[input.pageAccessTokenRef];if(!token)return {status:'failed',errorCode:'META_TOKEN_NOT_CONFIGURED'};
 let url:string;try{const parsed=new URL(input.mediaUrl);if(parsed.protocol!=='https:'||parsed.username||parsed.password||input.mediaUrl.length>8192)throw new Error();url=parsed.href;}catch{return {status:'failed',errorCode:'META_MEDIA_INVALID'};}
 const fetchImpl=input.fetchImpl||fetch;
 const endpoint=kind==='whatsapp_business'?`https://graph.facebook.com/${metaGraphVersion()}/${encodeURIComponent(input.externalAccountId||'')}/messages`:`https://graph.facebook.com/${metaGraphVersion()}/me/messages`;
 const wireType=input.mediaType==='file'?'document':input.mediaType;
 const body=kind==='whatsapp_business'?{messaging_product:'whatsapp',to:input.recipientId,type:wireType,[wireType]:{link:url,...(input.caption?{caption:input.caption}:{})}}:{messaging_type:'RESPONSE',recipient:{id:input.recipientId},message:{attachment:{type:input.mediaType==='file'?'file':input.mediaType,payload:{url,is_reusable:false}}}};
 try{const response=await fetchImpl(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(body)});const result=await response.json().catch(()=>null);if(!response.ok)return {status:response.status>=500?'unknown':'failed',errorCode:`META_HTTP_${response.status}`};const receipt=kind==='whatsapp_business'?result?.messages?.[0]?.id:result?.message_id;const id=typeof receipt==='string'?receipt.trim():'';return id?{status:'accepted',providerMessageId:id}:{status:'unknown',errorCode:'META_RECEIPT_MISSING'};}catch{return {status:'unknown',errorCode:'META_NETWORK_UNKNOWN'};}
}
