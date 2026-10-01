import {HttpError} from '../../core/security';

export type MetaSendResult={status:'accepted'|'failed'|'unknown';providerMessageId?:string;errorCode?:string};

/** Sends only text replies through a server-side Page token reference. */
export async function sendMetaText(input:{recipientId:string;text:string;pageAccessTokenRef:string;fetchImpl?:typeof fetch}):Promise<MetaSendResult>{
 const token=process.env[input.pageAccessTokenRef];
 if(!token) return {status:'failed',errorCode:'META_TOKEN_NOT_CONFIGURED'};
 const fetchImpl=input.fetchImpl||fetch;
 try{
  const response=await fetchImpl('https://graph.facebook.com/v20.0/me/messages',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({recipient:{id:input.recipientId},message:{text:input.text},access_token:token})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)return {status:'failed',errorCode:`META_HTTP_${response.status}`};
  return {status:'accepted',providerMessageId:typeof body?.message_id==='string'?body.message_id:undefined};
 }catch{return {status:'unknown',errorCode:'META_NETWORK_UNKNOWN'};}
}
