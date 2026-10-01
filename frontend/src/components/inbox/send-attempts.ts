/** Retain retry identity while this inbox is mounted, including conversation switches. */
export class SendAttempts {
 private pending = new Map<string,string>();
 private key(conversation:string,body:string,visibility:string,media?:{type:string;url:string}) {
  return JSON.stringify([conversation,body,visibility,media?.type||'',media?.url||'']);
 }
 begin(conversation:string,body:string,visibility:string,media?:{type:string;url:string}):string {
  const key=this.key(conversation,body,visibility,media);
  const existing=this.pending.get(key);
  if(existing)return existing;
  const id=crypto.randomUUID();this.pending.set(key,id);return id;
 }
 confirmed(conversation:string,body:string,visibility:string,id:string,media?:{type:string;url:string}) {
  const key=this.key(conversation,body,visibility,media);
  if(this.pending.get(key)===id)this.pending.delete(key);
 }
}
