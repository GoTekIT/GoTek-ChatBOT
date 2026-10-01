import {createHmac} from 'node:crypto';
import {HttpError} from '../../core/security';
import {metaJsonRequest,type MetaFetch} from './http';

export interface FacebookSendInput {
 version:string; appSecret:string; pageId:string; pageToken:string; recipientId:string; text:string;
}
export type FacebookSendResult = {status:'accepted';messageId:string;recipientId:string}|{status:'unknown'};
/** Internal transport only. Caller must durably claim outbox and validate ownership/window before dispatch. */
export async function sendFacebookText(input:FacebookSendInput,request?:MetaFetch):Promise<FacebookSendResult> {
 if(!/^v\d+\.\d+$/.test(input.version) || !/^\d{1,100}$/.test(input.pageId) || !/^\d{1,100}$/.test(input.recipientId)
  || !input.pageToken || /[\r\n]/.test(input.pageToken) || !input.appSecret
  || !input.text.trim() || input.text.length>2000)throw new HttpError(400,'META_SEND_INVALID');
 const url=new URL(`https://graph.facebook.com/${input.version}/${input.pageId}/messages`);
 const body={messaging_type:'RESPONSE',recipient:{id:input.recipientId},message:{text:input.text},
  appsecret_proof:createHmac('sha256',input.appSecret).update(input.pageToken).digest('hex')};
 try {
  const result=await metaJsonRequest(url,{method:'POST',headers:{Authorization:`Bearer ${input.pageToken}`,'Content-Type':'application/json'},body:JSON.stringify(body)},request);
  if(typeof result.message_id!=='string' || !result.message_id || result.message_id.length>1000 || result.recipient_id!==input.recipientId)
   return {status:'unknown'};
  // API acceptance is not proof of delivery/read; those require separate provider receipts.
  return {status:'accepted',messageId:result.message_id,recipientId:result.recipient_id};
 }catch {
  // Conservatively quarantine every uncertain result; never infer that a failed HTTP response means unsent.
  return {status:'unknown'};
 }
}
