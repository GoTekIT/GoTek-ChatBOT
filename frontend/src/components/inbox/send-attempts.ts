/** Retain retry identity while this inbox is mounted, including conversation switches. */
export class SendAttempts {
 private pending = new Map<string,string>();
 private key(conversation:string,body:string,visibility:string) {
  return JSON.stringify([conversation,body,visibility]);
 }
 begin(conversation:string,body:string,visibility:string):string {
  const key=this.key(conversation,body,visibility);
  const existing=this.pending.get(key);
  if(existing)return existing;
  const id=crypto.randomUUID();this.pending.set(key,id);return id;
 }
 confirmed(conversation:string,body:string,visibility:string,id:string) {
  const key=this.key(conversation,body,visibility);
  if(this.pending.get(key)===id)this.pending.delete(key);
 }
}
