import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {pool,scope,transaction} from '../src/core/db';
import {exportAuditEvents} from '../src/modules/audit/audit-export';

const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
test.after(async()=>{await admin.end();await pool.end();});

test('audit export is bounded, tenant scoped, paginates and requires Owner/Admin',async()=>{
 const workspace=randomUUID(),other=randomUUID(),foreign=randomUUID();
 const ids=Array.from({length:4},()=>randomUUID());
 const actor={workspace_id:workspace,role:'Owner'};
 const run=(query:unknown,role='Owner')=>transaction(async db=>{
   await scope(db,workspace);return exportAuditEvents(db,{workspace_id:workspace,role},query);
 });
 await admin.query("INSERT INTO workspaces(id,name) VALUES($1,'Export test'),($2,'Other')",[workspace,other]);
 try{
   await admin.query(`INSERT INTO audit_events(id,workspace_id,action,object_id,created_at)
     SELECT id,$1,'export.fixture','fixture',now()-((row_number() over())::int||' seconds')::interval
       FROM unnest($2::uuid[]) AS id`,[workspace,ids]);
   await admin.query("INSERT INTO audit_events(id,workspace_id,action,object_id) VALUES($1,$2,'foreign','fixture')",[foreign,other]);
   const first=await run({limit:2});
   assert.equal(first.contentType,'application/x-ndjson; charset=utf-8');
   assert.equal(first.count,2);
   assert.equal(first.body.split('\n').filter(Boolean).length,2);
   assert.ok(first.nextCursor);
   const second=await run({limit:'1000',before:first.nextCursor},'Admin');
   assert.equal(second.count,2);
   assert.ok(!second.body.includes(foreign));
   await assert.rejects(run({limit:1001}),{name:'ZodError'});
   await assert.rejects(run({limit:0}),{name:'ZodError'});
   await assert.rejects(run({before:foreign}),{status:404,code:'NOT_FOUND'});
   await assert.rejects(run({},'Agent'),{status:403,code:'FORBIDDEN'});
   await assert.rejects(run({},'anonymous'),{status:403,code:'FORBIDDEN'});
   const parsed=JSON.parse(first.body.split('\n')[0]);
   assert.equal(parsed.action,'export.fixture');
   assert.equal(parsed.workspace_id,undefined);
 }finally{
   await admin.query('DELETE FROM audit_events WHERE workspace_id=ANY($1::uuid[])',[[workspace,other]]);
   await admin.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[[workspace,other]]);
 }
});
