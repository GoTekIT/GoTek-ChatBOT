import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';
import {pool,scope,transaction} from '../src/server/db';import {setSchedule,enqueueDue} from '../src/server/web-source-schedule';
const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
test.after(async()=>{await admin.end();await pool.end();});
test('schedule CAS, role and concurrent due claims preserve one tenant job',async()=>{
 const w=randomUUID(),u=randomUUID(),s=randomUUID();
 await admin.query("INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,'Schedule','000','fixture')",[u,u+'@test.invalid']);
 await admin.query("INSERT INTO workspaces(id,name) VALUES($1,'Schedule')",[w]);
 await admin.query("INSERT INTO web_sources(id,workspace_id,name,url,type,created_by) VALUES($1,$2,'Source','https://example.com','URL',$3)",[s,w,u]);
 const actor={workspace_id:w,user_id:u,role:'Owner'};
 const run=(fn:any)=>transaction(async db=>{await scope(db,w);return fn(db);});
 try{
  await assert.rejects(run((db:any)=>setSchedule(db,{...actor,role:'Agent'},s,{version:1,intervalMinutes:5})));
  await run((db:any)=>setSchedule(db,actor,s,{version:1,intervalMinutes:5}));
  await assert.rejects(run((db:any)=>setSchedule(db,actor,s,{version:1,intervalMinutes:null})),{code:'VERSION_CONFLICT'});
  await admin.query("UPDATE web_sources SET next_refresh_at=now()-interval '1 minute' WHERE id=$1",[s]);
  await admin.query("UPDATE web_sources SET status='PAUSED' WHERE id=$1",[s]);
  assert.deepEqual(await run((db:any)=>enqueueDue(db,w)),[]);
  await admin.query("UPDATE web_sources SET status='ACTIVE' WHERE id=$1",[s]);

  const results=await Promise.all([run((db:any)=>enqueueDue(db,w)),run((db:any)=>enqueueDue(db,w))]);
  assert.equal(results.flat().length,1);
  assert.equal((await admin.query('SELECT count(*) FROM jobs WHERE workspace_id=$1',[w])).rows[0].count,'1');
  const jobId=results.flat()[0];
  await admin.query("UPDATE web_sources SET next_refresh_at=now()-interval '2 minutes' WHERE id=$1",[s]);
  const dueBefore=(await admin.query('SELECT next_refresh_at FROM web_sources WHERE id=$1',[s])).rows[0].next_refresh_at;
  for(const state of ['queued','retry','running']){
   await admin.query('UPDATE jobs SET state=$2 WHERE id=$1',[jobId,state]);
   assert.deepEqual(await run((db:any)=>enqueueDue(db,w)),[],state+' must prevent scheduled accumulation');
  }
  assert.equal((await admin.query('SELECT count(*) FROM jobs WHERE workspace_id=$1',[w])).rows[0].count,'1');
  assert.deepEqual((await admin.query('SELECT next_refresh_at FROM web_sources WHERE id=$1',[s])).rows[0].next_refresh_at,dueBefore);
  await admin.query("UPDATE jobs SET state='dead' WHERE id=$1",[jobId]);
  await admin.query("UPDATE workspaces SET status='disabled' WHERE id=$1",[w]);
  assert.deepEqual(await run((db:any)=>enqueueDue(db,w)),[],'disabled workspace with due schedule must be skipped');
  await admin.query("UPDATE workspaces SET status='active' WHERE id=$1",[w]);
  assert.equal((await run((db:any)=>enqueueDue(db,w))).length,1,'terminal job permits next scheduled refresh');
  await run((db:any)=>setSchedule(db,actor,s,{version:2,intervalMinutes:null}));
  await admin.query("UPDATE workspaces SET status='disabled' WHERE id=$1",[w]);
  assert.deepEqual(await run((db:any)=>enqueueDue(db,w)),[]);

  assert.deepEqual(await run((db:any)=>enqueueDue(db,w)),[]);
 }finally{await admin.query('DELETE FROM jobs WHERE workspace_id=$1',[w]);await admin.query('DELETE FROM web_sources WHERE id=$1',[s]);await admin.query('DELETE FROM audit_events WHERE workspace_id=$1',[w]);await admin.query('DELETE FROM workspaces WHERE id=$1',[w]);await admin.query('DELETE FROM users WHERE id=$1',[u]);}
});
