/** Legacy user-only draft stores are not loaded into a workspace-scoped view. */
export function inboxDraftKey(userId:string,workspaceId:string){
 return 'gotek.inbox.drafts.v2.'+encodeURIComponent(userId)+'.'+encodeURIComponent(workspaceId);
}
export function parseInboxDrafts(raw:string|null):Record<string,string>{
 const result:Record<string,string>={};
 if(!raw)return result;
 try{
  const data:unknown=JSON.parse(raw);
  if(!data||typeof data!=='object'||Array.isArray(data))return result;
  for(const [id,value] of Object.entries(data)){
   if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)&&typeof value==='string'&&value.length<=10000)result[id]=value;
  }
 }catch{}
 return result;
}
export type PendingReply={clientId:string,body:string,visibility:'public'|'internal'};
export function parsePendingReplies(raw:string|null):Record<string,PendingReply>{
 const result:Record<string,PendingReply>={};
 try{
  const entries=JSON.parse(raw||'{}');
  if(!entries||typeof entries!=='object'||Array.isArray(entries))return result;
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for(const [id,value] of Object.entries(entries)){
   const p=value as PendingReply;
   if(uuid.test(id)&&p&&typeof p.clientId==='string'&&uuid.test(p.clientId)&&typeof p.body==='string'&&p.body.trim().length>0&&p.body.length<=10000&&(p.visibility==='public'||p.visibility==='internal'))
    result[id]={clientId:p.clientId,body:p.body,visibility:p.visibility};
  }
 }catch{}
 return result;
}
