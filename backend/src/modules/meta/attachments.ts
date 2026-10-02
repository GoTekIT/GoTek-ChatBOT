/** Provider media references only. Never fetch URLs supplied by a webhook here. */
export type MetaAttachment = {type:'image'|'video'|'audio'|'file';url:string};
export function parseMetaAttachments(value:unknown):MetaAttachment[]{
 if(!Array.isArray(value))return [];
 const result:MetaAttachment[]=[];
 for(const attachment of value.slice(0,20)){
  if(!attachment||typeof attachment!=='object')continue;
  const {type,payload}=attachment;
  if(!['image','video','audio','file'].includes(type)||typeof payload?.url!=='string')continue;
  try{
   const url=new URL(payload.url);
   if(url.protocol!=='https:'||url.username||url.password||payload.url.length>8192)continue;
   result.push({type,url:url.href});
  }catch{/* Invalid media remains unavailable; never execute provider markup. */}
 }
 return result;
}


/** Graph conversation history uses image_data/video_data/file_url, unlike webhooks. */
export function parseMetaHistoryAttachments(value:unknown):MetaAttachment[]{
 const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
 const entries=Array.isArray(value)?value:object(value).data;
 if(!Array.isArray(entries))return [];
 return entries.slice(0,20).flatMap(entry=>{
  const item=object(entry);
  const webhook=parseMetaAttachments([item]);
  if(webhook.length)return webhook;
  const image=object(item.image_data),video=object(item.video_data);
  // A video thumbnail must never be mistaken for the playable video itself.
  const candidate=typeof video.url==='string'?{type:'video',payload:{url:video.url}}
   :typeof image.url==='string'?{type:'image',payload:{url:image.url}}
   :typeof item.file_url==='string'?{type:'file',payload:{url:item.file_url}}:null;
  return candidate?parseMetaAttachments([candidate]):[];
 });
}
