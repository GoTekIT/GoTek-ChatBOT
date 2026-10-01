export type ThreadsPublishResult={status:'accepted'|'failed'|'unknown';providerPostId?:string;errorCode?:string};
/** Publish a Threads post through the official Threads API. Secrets stay server-side. */
export async function publishThreadsText(input:{text:string;tokenRef:string;replyToId?:string;fetchImpl?:typeof fetch}):Promise<ThreadsPublishResult>{
 const token=process.env[input.tokenRef]; if(!token)return {status:'failed',errorCode:'THREADS_TOKEN_NOT_CONFIGURED'};
 if(!input.text.trim()||input.text.length>500)return {status:'failed',errorCode:'THREADS_TEXT_INVALID'};
 const fetchImpl=input.fetchImpl||fetch; const headers={authorization:`Bearer ${token}`};
 try{
  const params=new URLSearchParams({text:input.text,media_type:'TEXT',auto_publish_text:'true'}); if(input.replyToId)params.set('reply_to_id',input.replyToId);
  const created=await fetchImpl(`https://graph.threads.net/v1.0/me/threads?${params}`,{method:'POST',headers,signal:AbortSignal.timeout(20000)});
  const container=await created.json().catch(()=>null); if(!created.ok)return {status:created.status>=500?'unknown':'failed',errorCode:`THREADS_HTTP_${created.status}`};
  const id=typeof container?.id==='string'?container.id:''; if(!id)return {status:'unknown',errorCode:'THREADS_CONTAINER_RECEIPT_MISSING'};
  if(params.get('auto_publish_text')==='true')return {status:'accepted',providerPostId:id};
  return {status:'unknown',errorCode:'THREADS_PUBLISH_NOT_CONFIRMED'};
 }catch{return {status:'unknown',errorCode:'THREADS_NETWORK_UNKNOWN'};}
}
