import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {pool,scope,transaction} from '../src/server/db';
import {listAuditEvents} from '../src/server/audit-log';

const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
test.after(async()=>{await admin.end();await pool.end();});
test('audit pagination preserves tenant, role, tied timestamp order and insertion stability',async()=>{
 const workspace=randomUUID(),other=randomUUID(),foreign=randomUUID();
 const ids=Array.from({length:105},()=>randomUUID()).sort().reverse();
 const actor={workspace_id:workspace,role:'Owner'};
 const run=(query:unknown,role='Owner')=>transaction(async db=>{
  await scope(db,workspace);return listAuditEvents(db,{...actor,role},query);
 });
 await admin.query("INSERT INTO workspaces(id,name) VALUES($1,'Audit test'),($2,'Other')",[workspace,other]);
 try{
  await admin.query(`INSERT INTO audit_events(id,workspace_id,action,object_id,created_at)
   SELECT id,$1,'audit.fixture','fixture','2026-01-01T00:00:00.123456Z' FROM unnest($2::uuid[]) AS id`,[workspace,ids]);
  await admin.query("INSERT INTO audit_events(id,workspace_id,action,object_id) VALUES($1,$2,'foreign','fixture')",[foreign,other]);
  assert.equal((await run({})).length,100);
  const first=await run({limit:'40'},'Admin');
  assert.deepEqual(first.map(x=>x.id),ids.slice(0,40));
  const newer=randomUUID();
  await admin.query("INSERT INTO audit_events(id,workspace_id,action,object_id) VALUES($1,$2,'newer','fixture')",[newer,workspace]);
  const second=await run({limit:40,before:first.at(-1).id});
  const third=await run({limit:40,before:second.at(-1).id});
  assert.deepEqual([...first,...second,...third].map(x=>x.id),ids);
  assert.deepEqual(await run({before:third.at(-1).id}),[]);
  await assert.rejects(run({before:foreign}),{status:404,code:'NOT_FOUND'});
  await assert.rejects(run({before:randomUUID()}),{status:404,code:'NOT_FOUND'});
  await assert.rejects(run({},'Agent'),{status:403,code:'FORBIDDEN'});
  for(const query of [{limit:0},{limit:101},{limit:1.5},{limit:'2x'},{limit:['2']},{before:'bad'},{workspace_id:other}]){
   await assert.rejects(run(query),{name:'ZodError'});
  }
  // Explicit tenant filter must also hold with a privileged connection without RLS.
  const db=await admin.connect();
  try{assert.ok((await listAuditEvents(db,actor,{})).every(row=>row.id!==foreign));}
  finally{db.release();}
 }finally{
  await admin.query('DELETE FROM audit_events WHERE workspace_id=ANY($1::uuid[])',[[workspace,other]]);
  await admin.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[[workspace,other]]);
 }
});
