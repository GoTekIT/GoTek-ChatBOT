import 'dotenv/config';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import {pool} from '../src/core/db';
import {HttpError} from '../src/core/security';
import {runMetaIngressOnce,runMetaIngressAll,runMetaWorkerOnce,runMetaProfileWorkerOnce,runMetaHistoryWorkerOnce,closeMetaWorkerPool} from '../src/modules/jobs/worker';

// This process is for the explicitly enabled local/staging tester only. It
// never enables provider sends implicitly and never runs in production.
if(process.env.NODE_ENV==='production')throw new Error('Production is not approved.');
if(process.env.META_ENABLE_TEST_SEND!=='true')throw new Error('META_TEST_SEND_NOT_ENABLED');
const once=process.argv.includes('--once');
const historyOnly=process.argv.includes('--history-only');
const ingressOnly=process.argv.includes('--ingress-only');
const dispatchOnly=process.argv.includes('--dispatch-only');
let ingressCursor:string|null=null;
const all=process.argv.includes('--all');
const configured=process.env.GOTEK_WORKER_WORKSPACES?.split(',').map(value=>value.trim()).filter(Boolean)||[];
const single=process.env.GOTEK_WORKER_WORKSPACE?.trim()||'';
if(!all&&!single&&!configured.length)throw new Error('META_WORKER_WORKSPACE_REQUIRED');
// Legacy seed workspaces use deterministic UUID-shaped identifiers whose
// version nibble is zero; accept UUID shape here and let the scoped DB query
// remain authoritative.
const workspaceId=z.string().regex(/^[0-9a-fA-F-]{36}$/);
const workspaces=single?[workspaceId.parse(single)]:configured.map(value=>workspaceId.parse(value));
async function resolveAllWorkspaces():Promise<string[]>{
 const rows=(await pool.query("SELECT id FROM public.worker_active_tenants($1,1000)",[null])).rows;
 return rows.map(row=>workspaceId.parse(String(row.id)));
}
async function historyPass(workspace:string){
 if(process.env.META_ENABLE_HISTORY_SYNC!=='true')return;
 try{
  const result=await runMetaHistoryWorkerOnce(workspace);
  console.log(JSON.stringify({worker:'meta.history.sync',workspace,...result}));
 }catch(error){
  // History failures must never abort dispatch for later workspaces.
  console.error(JSON.stringify({worker:'meta.history.sync',workspace,state:'failed',code:error instanceof HttpError?error.code:'META_HISTORY_ITERATION_FAILED'}));
 }
}
let stopping=false;const idle=new AbortController();
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{stopping=true;idle.abort();});
try{
 do{
  try{
   if(historyOnly){
    for(const workspace of (workspaces.length?workspaces:await resolveAllWorkspaces())) await historyPass(workspace);
   }else if(all){
    if(!dispatchOnly){
     const ingress=await runMetaIngressAll({after:ingressCursor,shouldStop:()=>stopping});
     ingressCursor=ingress.next;
     console.log(JSON.stringify({worker:'meta.ingress',...ingress}));
    }
    // Outbound provider calls remain an explicit allowlist even in --all
    // mode. Inbound routing may discover every active tenant; sending cannot.
    for(const workspace of (ingressOnly?[]:(workspaces.length?workspaces:await resolveAllWorkspaces()))){
     const profile=await runMetaProfileWorkerOnce(workspace);
     console.log(JSON.stringify({worker:'meta.profile.fetch',workspace,state:profile.state}));
     const result=await runMetaWorkerOnce(workspace);
     console.log(JSON.stringify({worker:'meta.message.send',workspace,state:result.state}));
    }
   }else for(const workspace of workspaces){
    const ingress=await runMetaIngressOnce(workspace);
    console.log(JSON.stringify({worker:'meta.ingress',workspace,state:ingress.state}));
    const profile=await runMetaProfileWorkerOnce(workspace);
    console.log(JSON.stringify({worker:'meta.profile.fetch',workspace,state:profile.state}));
    const result=await runMetaWorkerOnce(workspace);
    console.log(JSON.stringify({worker:'meta.message.send',workspace,state:result.state}));
   }
   // History-only mode is a separate process; the realtime worker never waits for it.
   if(historyOnly) { /* no realtime pass */ }
   for(const workspace of (historyOnly||ingressOnly?[]:(all&&!workspaces.length?await resolveAllWorkspaces():workspaces))){
    if(stopping)break;
    await historyPass(workspace);
   }
  }catch{
   // Do not log provider errors, payloads, workspace data, or credentials.
   console.error('META_WORKER_ITERATION_FAILED');
   if(once){process.exitCode=1;break;}
  }
  if(once||stopping)break;
  await delay(1000,undefined,{signal:idle.signal}).catch(error=>{if(error.name!=='AbortError')throw error;});
 }while(!stopping);
}finally{await closeMetaWorkerPool();await pool.end();}
