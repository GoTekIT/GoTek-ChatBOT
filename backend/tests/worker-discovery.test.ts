import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {runAiWorkerAll} from '../src/modules/jobs/worker';
import {pool,transaction} from '../src/core/db';
test('scheduler discovery sees active tenants without granting workspace row access',async()=>{
 const admin=new pg.Pool({host:'127.0.0.1',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
 const prefix=randomUUID().replaceAll('-','').slice(0,12);
 const anchor='ffffffff-ffff-4fff-8fff-'+prefix;
 const fixtures=Array.from({length:105},(_,i)=>'ffffffff-ffff-4fff-9fff-'+i.toString(16).padStart(12,'0'));
 const a=randomUUID(),b=randomUUID(),disabled=randomUUID();
 try{
  await admin.query("INSERT INTO workspaces(id,name,status) VALUES($1,'a','active'),($2,'b','active'),($3,'c','disabled')",[a,b,disabled]);
  await admin.query("INSERT INTO workspaces(id,name,status) SELECT x,'scheduler page fixture','active' FROM unnest($1::uuid[]) x",[fixtures]);
  await transaction(async db=>{
   assert.equal((await db.query('SELECT id FROM workspaces WHERE id=ANY($1::uuid[])',[[a,b,disabled]])).rowCount,0);
   const seen:string[]=[];let cursor:string|null=null;
   for(;;){const page:pg.QueryResult<{id:string}>=await db.query('SELECT id FROM worker_active_tenants($1,100)',[cursor]);if(!page.rowCount)break;seen.push(...page.rows.map(r=>r.id));cursor=page.rows[page.rows.length-1].id;}
   assert.ok(seen.includes(a));assert.ok(seen.includes(b));assert.ok(!seen.includes(disabled));
   assert.equal(seen.length,new Set(seen).size);
   assert.equal((await db.query('SELECT id FROM workspaces WHERE id=$1',[a])).rowCount,0);
  });
  const invoke=async()=>{throw new Error('empty fixture must not call provider');};
  const stopped=await runAiWorkerAll(invoke,{after:anchor,shouldStop:()=>true});
  assert.deepEqual(stopped,{results:[],next:anchor});
  const first=await runAiWorkerAll(invoke,{after:anchor});
  assert.equal(first.results.length,100);assert.deepEqual(first.results.map(r=>r.workspace),fixtures.slice(0,100));
  assert.ok(first.results.every(r=>r.state==='idle'));
  let checks=0;
  const partial=await runAiWorkerAll(invoke,{after:first.next,shouldStop:()=>++checks>2});
  assert.deepEqual(partial.results.map(r=>r.workspace),fixtures.slice(100,102));
  const rest=await runAiWorkerAll(invoke,{after:partial.next});
  assert.deepEqual(rest.results.map(r=>r.workspace),fixtures.slice(102));
  assert.deepEqual(await runAiWorkerAll(invoke,{after:rest.next}),{results:[],next:null});
 }finally{await admin.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[[a,b,disabled,...fixtures]]);await admin.end();await pool.end();}
});
