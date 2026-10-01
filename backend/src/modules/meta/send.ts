export type MetaSendResult={status:'accepted'|'failed'|'unknown';providerMessageId?:string;errorCode?:string};

/** A transport timeout is ambiguous: never retry automatically without reconciliation. */
export async function sendMetaText(input:{recipientId:string;text:string;pageAccessTokenRef:string;fetchImpl?:typeof fetch}):Promise<MetaSendResult>{
 const token=process.env[input.pageAccessTokenRef];
 if(!token)return {status:'failed',errorCode:'META_TOKEN_NOT_CONFIGURED'};
 if(!input.recipientId||!input.text.trim())return {status:'failed',errorCode:'META_MESSAGE_INVALID'};
 const fetchImpl=input.fetchImpl||fetch;
 try{
  const response=await fetchImpl('https://graph.facebook.com/v20.0/me/messages',{
   method:'POST',signal:AbortSignal.timeout(20000),
   headers:{'content-type':'application/json',authorization:`Bearer ${token}`},
   body:JSON.stringify({messaging_type:'RESPONSE',recipient:{id:input.recipientId},message:{text:input.text}})
  });
  const body=await response.json().catch(()=>null);
  if(!response.ok)return {status:response.status>=500?'unknown':'failed',errorCode:`META_HTTP_${response.status}`};
  if(typeof body?.message_id!=='string'||!body.message_id.trim())return {status:'unknown',errorCode:'META_RECEIPT_MISSING'};
  return {status:'accepted',providerMessageId:body.message_id};
 }catch{return {status:'unknown',errorCode:'META_NETWORK_UNKNOWN'};}
}
