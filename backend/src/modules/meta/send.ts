export type MetaSendResult={status:'accepted'|'failed'|'unknown';providerMessageId?:string;errorCode?:string};
export type MetaChannelKind='facebook_messenger'|'instagram_messaging'|'whatsapp_business';
const graphVersion=():string=>{
 const value=process.env.META_GRAPH_API_VERSION?.trim()||'v25.0';
 return /^v\d+\.\d+$/.test(value)?value:'v25.0';
};
/** Sends text through the provider-specific Graph endpoint. Tokens are resolved by reference only. */
export async function sendMetaText(input:{recipientId:string;text:string;pageAccessTokenRef:string;channelKind?:MetaChannelKind;externalAccountId?:string;fetchImpl?:typeof fetch}):Promise<MetaSendResult>{
 const kind=input.channelKind??'facebook_messenger';
 if(!['facebook_messenger','instagram_messaging','whatsapp_business'].includes(kind))return {status:'failed',errorCode:'META_CHANNEL_UNSUPPORTED'};
 if(kind==='whatsapp_business'&&!input.externalAccountId?.trim())return {status:'failed',errorCode:'META_ACCOUNT_REQUIRED'};
 const token=process.env[input.pageAccessTokenRef];
 if(!token)return {status:'failed',errorCode:'META_TOKEN_NOT_CONFIGURED'};
 if(!input.recipientId||!input.text.trim())return {status:'failed',errorCode:'META_MESSAGE_INVALID'};
 const fetchImpl=input.fetchImpl||fetch;
 const endpoint=kind==='whatsapp_business'?`https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(input.externalAccountId||'')}/messages`:`https://graph.facebook.com/${graphVersion()}/me/messages`;
 const message=kind==='whatsapp_business'?{messaging_product:'whatsapp',to:input.recipientId,type:'text',text:{body:input.text}}:{messaging_type:'RESPONSE',recipient:{id:input.recipientId},message:{text:input.text}};
 try{const response=await fetchImpl(endpoint,{method:'POST',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(message)});const body=await response.json().catch(()=>null);if(!response.ok)return {status:response.status>=500?'unknown':'failed',errorCode:`META_HTTP_${response.status}`};const id=typeof body?.message_id==='string'?body.message_id:typeof body?.messages?.[0]?.id==='string'?body.messages[0].id:'';if(!id)return {status:'unknown',errorCode:'META_RECEIPT_MISSING'};return {status:'accepted',providerMessageId:id};}catch{return {status:'unknown',errorCode:'META_NETWORK_UNKNOWN'};}
}
