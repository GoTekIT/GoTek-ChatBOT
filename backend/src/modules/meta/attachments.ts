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
