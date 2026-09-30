import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import {pool} from '../src/core/db';
import {defaultWorkspaceProviderInvoke,runAiWorkerOnce,runAiWorkerAll} from '../src/modules/jobs/worker';

// Explicit operator-selected tenant; never supplied by a widget request.
if(process.env.NODE_ENV==='production')throw new Error('Production is not approved.');
const all=process.argv.includes('--all');
if(all&&process.env.GOTEK_WORKER_WORKSPACE)throw new Error('WORKSPACE_AND_ALL_ARE_MUTUALLY_EXCLUSIVE');
const workspace=all?undefined:z.string().uuid().parse(process.env.GOTEK_WORKER_WORKSPACE);
const once=process.argv.includes('--once');
let stopping=false;
const idle=new AbortController();
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{stopping=true;idle.abort();});
const invoke=defaultWorkspaceProviderInvoke();
let cursor:string|null=null;
try {
 do {
  try {
   let succeeded=false;
   if(all){
    const batch=await runAiWorkerAll(invoke,{after:cursor,shouldStop:()=>stopping});
    cursor=batch.next;
    const states=batch.results.reduce<Record<string,number>>((out,row)=>(out[row.state]=(out[row.state]??0)+1,out),{});
    succeeded=batch.results.some(row=>row.state==='succeeded');
    console.log(JSON.stringify({worker:'ai.reply',mode:'all',states}));
   }else{
    const result=await runAiWorkerOnce(workspace!,invoke);
    succeeded=result.state==='succeeded';
    console.log(JSON.stringify({worker:'ai.reply',state:result.state}));
   }
   if(once||stopping)break;
   if(all||!succeeded)await delay(succeeded?250:1000,undefined,{signal:idle.signal}).catch(error=>{if(error.name!=='AbortError')throw error;});
  }catch{
   console.error('AI_WORKER_ITERATION_FAILED');
   if(once){process.exitCode=1;break;}
   if(!stopping)await delay(1000,undefined,{signal:idle.signal}).catch(error=>{if(error.name!=='AbortError')throw error;});
  }
 }while(!stopping);
}finally{await pool.end();}
