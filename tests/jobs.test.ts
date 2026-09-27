import {runWorkerOnce} from '../src/server/worker';
import {test,after} from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {pool,scope,transaction} from '../src/server/db';import {enqueueJob,claimJob,finishJob,recoverStaleJobs,jobMetadata} from '../src/server/jobs';
const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});after(async()=>{await pool.end();await admin.end();});
test('H32 bounded jobs: atomic enqueue, concurrent claim, stale/unknown recovery, tenant isolation',async()=>{
 const workspace=randomUUID(),other=randomUUID();await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2),($3,$4)',[workspace,'Jobs test',other,'Other jobs']);
 const run=<T>(fn:(db:pg.PoolClient)=>Promise<T>,tenant=workspace)=>transaction(async db=>{await scope(db,tenant);return fn(db);});
 const input={kind:'local.test',key:'first',payload:{fixture:'private-body'},external:false,maxAttempts:2};
 const [a,b]=await Promise.all([run(db=>enqueueJob(db,workspace,input)),run(db=>enqueueJob(db,workspace,input))]);assert.equal(a.id,b.id);
 await assert.rejects(run(db=>enqueueJob(db,workspace,{...input,payload:{changed:true}})),{code:'IDEMPOTENCY_CONFLICT'});
 const claims=await Promise.all([run(db=>claimJob(db)),run(db=>claimJob(db))]);assert.equal(claims.filter(Boolean).length,1);const first=claims.find(Boolean);
 await assert.rejects(run(db=>finishJob(db,first.id,randomUUID(),{state:'succeeded',receipt:'wrong'})),{code:'STALE_JOB_LEASE'});
 assert.equal((await run(db=>finishJob(db,first.id,first.lease_token,{state:'failed',code:'LOCAL_ERROR'}))).state,'retry');assert.equal(await run(db=>claimJob(db)),null);
 await admin.query('UPDATE jobs SET available_at=now() WHERE id=$1',[first.id]);const second=await run(db=>claimJob(db));assert.equal(second.attempts,2);
 assert.equal((await run(db=>finishJob(db,second.id,second.lease_token,{state:'failed',code:'LOCAL_ERROR'}))).state,'dead');assert.equal(await run(db=>claimJob(db)),null);
 await run(db=>enqueueJob(db,workspace,{...input,key:'external',external:true}));const external=await run(db=>claimJob(db));await admin.query("UPDATE jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[external.id]);assert.equal((await run(recoverStaleJobs))[0].state,'unknown');assert.equal(await run(db=>claimJob(db)),null);
 await assert.rejects(run(db=>finishJob(db,external.id,external.lease_token,{state:'succeeded',receipt:'late'})),{code:'STALE_JOB_LEASE'});
 await run(db=>enqueueJob(db,workspace,{...input,key:'success'}));const success=await run(db=>claimJob(db));assert.equal((await run(db=>finishJob(db,success.id,success.lease_token,{state:'succeeded',receipt:'local-receipt'}))).state,'succeeded');
 assert.equal((await transaction(async db=>{await scope(db,other);return jobMetadata(db,other);})).length,0);assert.equal((await transaction(async db=>{await scope(db,workspace);return jobMetadata(db,workspace);})).some((row:any)=>row.kind==='local.test'),true);assert.equal(await run(db=>claimJob(db),other),null);assert.ok(!JSON.stringify(await run(jobMetadata)).includes('private-body'));
 const unrelated=await run(db=>enqueueJob(db,workspace,{...input,kind:'crawl.refresh',key:'unrelated'}));
 assert.equal((await runWorkerOnce(workspace,{'ai.reply':async()=>{throw Error('must not claim crawler');}})).state,'idle');
 assert.deepEqual((await admin.query('SELECT state,attempts FROM jobs WHERE id=$1',[unrelated.id])).rows[0],{state:'queued',attempts:0});
 await admin.query('DELETE FROM jobs WHERE id=$1',[unrelated.id]);
 await run(db=>enqueueJob(db,workspace,{...input,key:'worker-local'}));
 let called=0;assert.equal((await runWorkerOnce(workspace,{'local.test':async()=>{called++;return {receipt:'test-only-local-worker'};}})).state,'succeeded');assert.equal(called,1);
 await run(db=>enqueueJob(db,workspace,{...input,key:'worker-external',external:true}));
 assert.equal((await runWorkerOnce(workspace,{'local.test':async()=>{called++;return {receipt:'must-not-send'};}})).state,'disabled');assert.equal(called,1);
 await run(db=>enqueueJob(db,workspace,{...input,key:'worker-uncertain'}));
 assert.equal((await runWorkerOnce(workspace,{'local.test':async()=>{throw new Error('uncertain outcome');}})).state,'unknown');
 await admin.query("UPDATE workspaces SET status='disabled' WHERE id=$1",[workspace]);
 assert.equal((await runWorkerOnce(workspace,{})).state,'workspace_disabled');
 await admin.query("UPDATE workspaces SET status='active' WHERE id=$1",[workspace]);
 const stopper=await admin.connect();await stopper.query('BEGIN');
 try{
  await stopper.query("UPDATE workspaces SET status='disabled' WHERE id=$1",[workspace]);
  const pending=runWorkerOnce(workspace,{});
  await stopper.query('COMMIT');assert.equal((await pending).state,'workspace_disabled');
 }finally{await stopper.query('ROLLBACK');stopper.release();}
 await admin.query("UPDATE workspaces SET status='active' WHERE id=$1",[workspace]);

 await assert.rejects(run(async db=>{await enqueueJob(db,workspace,{...input,key:'rolled-back'});throw new Error('abort business write');}));assert.equal(await run(db=>claimJob(db)),null);
});
