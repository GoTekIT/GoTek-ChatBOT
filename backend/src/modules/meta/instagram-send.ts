import {HttpError} from '../../core/security';
import {metaJsonRequest,type MetaFetch} from './http';

export interface InstagramSendInput {
 version:string; accountId:string; accountToken:string; recipientId:string; text:string;
}
export type InstagramSendResult={status:'accepted';messageId:string;recipientId:string}|{status:'unknown'};
/** Instagram Login transport. Caller must check scopes, messaging window and durable dispatch ownership. */
export async function sendInstagramText(input:InstagramSendInput,request?:MetaFetch):Promise<InstagramSendResult> {
 if(!/^v\d+\.\d+$/.test(input.version)||!/^\d{1,100}$/.test(input.accountId)||!/^\d{1,100}$/.test(input.recipientId)
  ||!input.accountToken||/[\r\n]/.test(input.accountToken)||!input.text.trim()||input.text.length>2000)
  throw new HttpError(400,'META_SEND_INVALID');
 const url=new URL(`https://graph.instagram.com/${input.version}/${input.accountId}/messages`);
 try {
  const result=await metaJsonRequest(url,{method:'POST',headers:{Authorization:`Bearer ${input.accountToken}`,'Content-Type':'application/json'},
   body:JSON.stringify({recipient:{id:input.recipientId},message:{text:input.text}})},request);
  if(typeof result.message_id!=='string'||!result.message_id||result.message_id.length>1000||result.recipient_id!==input.recipientId)
   return {status:'unknown'};
  return {status:'accepted',messageId:result.message_id,recipientId:input.recipientId};
 } catch {return {status:'unknown'};}
}
