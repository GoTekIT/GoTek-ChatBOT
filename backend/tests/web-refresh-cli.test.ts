import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const exec=promisify(execFile);
const args=['--import','tsx','scripts/web-refresh-worker.ts'];
const cleanExit=(code:number|null,signal:NodeJS.Signals|null)=>code===0||(process.platform==='win32'&&code===null);
test('web refresh CLI rejects production, missing/invalid tenant and unsupported all mode with redacted logs',async()=>{
 for(const [mode,workspace,extra,code] of [
  ['production',randomUUID(),'','PRODUCTION_NOT_APPROVED'],
  ['test','','','INVALID_WORKER_CONFIGURATION'],
  ['test','secret-invalid-workspace','','INVALID_WORKER_CONFIGURATION'],
  ['test',randomUUID(),'--all','INVALID_WORKER_CONFIGURATION'],
 ]){
  try{await exec(process.execPath,[...args,...(extra?[extra]:[])],{env:{...process.env,NODE_ENV:mode,GOTEK_WORKER_WORKSPACE:workspace},timeout:10000});assert.fail('must reject');}
  catch(error:any){assert.equal(error.code,1);assert.equal(error.stdout,'');assert.deepEqual(JSON.parse(error.stderr),{worker:'web.refresh',state:'failed',code});}
 }
});
test('web refresh CLI --once exits idle and SIGTERM stops an idle real database loop cleanly',async()=>{
 const admin=new pg.Pool({host:'127.0.0.1',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
 const workspace=randomUUID();
 const env={...process.env,NODE_ENV:'test',GOTEK_WORKER_WORKSPACE:workspace};
 try{
  await admin.query("INSERT INTO workspaces(id,name) VALUES($1,'Disposable web CLI fixture')",[workspace]);
  const result=await exec(process.execPath,[...args,'--once'],{env,timeout:10000});
  assert.equal(result.stderr,'');assert.deepEqual(JSON.parse(result.stdout),{worker:'web.refresh',state:'idle'});
  await new Promise<void>((resolve,reject)=>{
   const child=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe']});
   let output='',errors='',signalled=false;
   const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('WEB_WORKER_SHUTDOWN_TIMEOUT'));},10000);
   child.on('error',error=>{clearTimeout(timeout);reject(error);});
   child.stderr.on('data',chunk=>{errors+=chunk.toString();});
   child.stdout.on('data',chunk=>{output+=chunk.toString();if(!signalled&&output.includes('"state":"idle"')){signalled=true;child.kill('SIGTERM');}});
   child.on('close',(code,signal)=>{clearTimeout(timeout);try{assert.ok(signalled);assert.equal(cleanExit(code,signal),true);assert.equal(errors,'');assert.deepEqual(JSON.parse(output),{worker:'web.refresh',state:'idle'});resolve();}catch(error){reject(error);}});
  });
  const failedJob=randomUUID();
  await admin.query("INSERT INTO jobs(id,workspace_id,kind,idempotency_key,payload,external_effect,max_attempts) VALUES($1,$2,'web.refresh',$3,'{}',false,3)",[failedJob,workspace,failedJob]);
  await assert.rejects(exec(process.execPath,[...args,'--once'],{env,timeout:10000}),(error:any)=>{
   assert.equal(error.code,1);assert.deepEqual(JSON.parse(error.stdout),{worker:'web.refresh',state:'unknown'});return true;
  });
  await admin.query('DELETE FROM jobs WHERE workspace_id=$1',[workspace]);
 }finally{await admin.query('DELETE FROM workspaces WHERE id=$1',[workspace]);await admin.end();}
});
