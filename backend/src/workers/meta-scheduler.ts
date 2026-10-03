type Pass = {next:string|null;results:Array<{workspace:string}>};
type Tasks = {
  ingress:(after:string|null)=>Promise<Pass>;
  outbound?: (after:string|null)=>Promise<Pass>;
  history?: (workspace:string)=>Promise<unknown>;
  cleanup?: ()=>Promise<unknown>;
  onError:()=>void;
};

/** Two serial loops: slow history never delays realtime ingestion. */
export function startMetaScheduler(tasks:Tasks,intervalMs=1000):()=>Promise<void>{
 let stopped=false;
 const timers=new Set<ReturnType<typeof setTimeout>>();
 const active=new Set<Promise<void>>();
 function loop(pass:()=>Promise<void>){
  const run=()=>{
   if(stopped)return;
   const current=pass().catch(()=>tasks.onError()).finally(()=>{
    active.delete(current);
    if(!stopped){const timer=setTimeout(()=>{timers.delete(timer);run();},intervalMs);timers.add(timer);timer.unref();}
   });
   active.add(current);
  };
  run();
 }
 let cursor:string|null=null;
 const pending=new Set<string>();
 loop(async()=>{if(tasks.cleanup)await tasks.cleanup();const result=await tasks.ingress(cursor);cursor=result.next;for(const row of result.results)if(tasks.history)pending.add(row.workspace);});
 let outboundCursor:string|null=null;
 if(tasks.outbound)loop(async()=>{const result=await tasks.outbound!(outboundCursor);outboundCursor=result.next;});
 if(tasks.history)loop(async()=>{
  for(const workspace of pending){
   if(stopped)break;
   pending.delete(workspace);
   try{await tasks.history!(workspace);}catch{tasks.onError();}
  }
 });
 return async()=>{stopped=true;for(const timer of timers)clearTimeout(timer);timers.clear();await Promise.allSettled([...active]);};
}
