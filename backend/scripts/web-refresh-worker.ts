import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import {enqueueDue} from '../src/modules/web-sources/web-source-schedule';
import {pool,transaction,scope} from '../src/core/db';
import {runWebRefreshOnce} from '../src/modules/web-sources/web-refresh-worker';

let stopping=false;
const idle=new AbortController();
const stop=()=>{stopping=true;idle.abort();};
try{
 if(process.env.NODE_ENV==='production')throw new Error('PRODUCTION_NOT_APPROVED');
 const workspace=z.string().uuid().parse(process.env.GOTEK_WORKER_WORKSPACE);
 const args=process.argv.slice(2);
 if(args.some(arg=>arg!=='--once'))throw new Error('INVALID_WORKER_CONFIGURATION');
 const once=args.includes('--once');
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 do{
  let succeeded=false;
  try{
   await transaction(async db=>{await scope(db,workspace);await enqueueDue(db,workspace);});
   const result=await runWebRefreshOnce(workspace);
   succeeded=result.state==='succeeded';
   if(once&&!['succeeded','idle'].includes(result.state))process.exitCode=1;
   console.log(JSON.stringify({worker:'web.refresh',state:result.state}));
  }catch{
   console.error(JSON.stringify({worker:'web.refresh',state:'failed',code:'WEB_REFRESH_ITERATION_FAILED'}));
   if(once){process.exitCode=1;break;}
  }
  if(once||stopping)break;
  await delay(succeeded?250:1000,undefined,{signal:idle.signal}).catch(error=>{if(error.name!=='AbortError')throw error;});
 }while(!stopping);
}catch(error){
 // Emit an allowlisted code only, never raw URLs, IDs, database errors or credentials.
 const code=error instanceof Error&&error.message==='PRODUCTION_NOT_APPROVED'?'PRODUCTION_NOT_APPROVED':'INVALID_WORKER_CONFIGURATION';
 console.error(JSON.stringify({worker:'web.refresh',state:'failed',code}));
 process.exitCode=1;
}finally{
 process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
 await pool.end();
}
