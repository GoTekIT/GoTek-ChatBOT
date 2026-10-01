import 'dotenv/config';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import {pool} from '../src/core/db';
import {runMetaWorkerOnce} from '../src/modules/jobs/worker';

// Pilot-only, explicit operator-selected tenant. Never discover customer tenants.
if(process.env.NODE_ENV==='production')throw new Error('Production is not approved.');
const workspace=z.string().uuid().parse(process.env.GOTEK_WORKER_WORKSPACE);
if(workspace!==process.env.META_WORKSPACE_ID)throw new Error('META_WORKER_WORKSPACE_MISMATCH');
if(process.env.META_ENABLE_TEST_SEND!=='true')throw new Error('META_TEST_SEND_NOT_ENABLED');
const once=process.argv.includes('--once');
let stopping=false;
const idle=new AbortController();
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{stopping=true;idle.abort();});
try{
 do{
  try{
   const result=await runMetaWorkerOnce(workspace);
   console.log(JSON.stringify({worker:'meta.message.send',state:result.state}));
  }catch{
   // Do not log provider errors or payloads: they can contain credentials or chat text.
   console.error('META_WORKER_ITERATION_FAILED');
   if(once){process.exitCode=1;break;}
  }
  if(once||stopping)break;
  await delay(1000,undefined,{signal:idle.signal}).catch(error=>{if(error.name!=='AbortError')throw error;});
 }while(!stopping);
}finally{await pool.end();}
