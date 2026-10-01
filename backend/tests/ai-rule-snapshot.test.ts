import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {pool,scope,transaction} from '../src/core/db';
import {loadAiRuleSnapshot,assertAiRuleSnapshotCurrent} from '../src/modules/ai/ai-rule-snapshot';
const admin=new pg.Pool({host:'127.0.0.1',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
after(async()=>{await pool.end();await admin.end();});

test('rule snapshot is tenant scoped, deterministic, complete and invalidated on active changes',async()=>{
 const workspace=randomUUID(),other=randomUUID(),user=randomUUID();
 await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2),($3,$4)',[workspace,'Snapshot',other,'Other snapshot']);
 await admin.query('INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,$3,$4,$5)',[user,`snapshot-${user}@example.test`,'Snapshot','0900000000','not-a-password']);
 const run=<T>(fn:(db:pg.PoolClient)=>Promise<T>,tenant=workspace)=>transaction(async db=>{await scope(db,tenant);return fn(db);});
 const insert=async(tenant:string,active=true,content='Use published sources')=>{
  const id=randomUUID();await admin.query('INSERT INTO ai_rules(id,workspace_id,title,content,active,created_by) VALUES($1,$2,$3,$4,$5,$6)',[id,tenant,'Rule',content,active,user]);return id;
 };
 try{
  const a=await insert(workspace),b=await insert(workspace),inactive=await insert(workspace,false);await insert(other);
  const snapshot=await run(db=>loadAiRuleSnapshot(db,workspace));
  assert.deepEqual(snapshot.rules.map(r=>r.id),[a,b].sort());
  await run(db=>assertAiRuleSnapshotCurrent(db,snapshot));
  await assert.rejects(run(db=>loadAiRuleSnapshot(db,other)),{code:'AI_RULE_SCOPE_MISMATCH'});
  assert.equal((await run(db=>loadAiRuleSnapshot(db,other),other)).rules.length,1);
  await admin.query('UPDATE ai_rules SET active=true,version=version+1 WHERE id=$1',[inactive]);
  await assert.rejects(run(db=>assertAiRuleSnapshotCurrent(db,snapshot)),{code:'AI_RULES_CHANGED'});
  const next=await run(db=>loadAiRuleSnapshot(db,workspace));
  await admin.query("UPDATE ai_rules SET content='Edited',version=version+1 WHERE id=$1",[a]);
  await assert.rejects(run(db=>assertAiRuleSnapshotCurrent(db,next)),{code:'AI_RULES_CHANGED'});
  const edited=await run(db=>loadAiRuleSnapshot(db,workspace));
  await admin.query('UPDATE ai_rules SET active=false,version=version+1 WHERE id=$1',[b]);
  await assert.rejects(run(db=>assertAiRuleSnapshotCurrent(db,edited)),{code:'AI_RULES_CHANGED'});
  for(let i=0;i<6;i++)await insert(workspace,true,'x'.repeat(2000));
  await assert.rejects(run(db=>loadAiRuleSnapshot(db,workspace)),{code:'AI_RULES_CONTEXT_LIMIT'});
  await admin.query('DELETE FROM ai_rules WHERE workspace_id=$1',[workspace]);
  for(let i=0;i<101;i++)await insert(workspace,true,'x');
  await assert.rejects(run(db=>loadAiRuleSnapshot(db,workspace)),{code:'AI_RULES_CONTEXT_LIMIT'});
 }finally{
  await admin.query('DELETE FROM ai_rules WHERE workspace_id=ANY($1::uuid[])',[[workspace,other]]);
  await admin.query('DELETE FROM users WHERE id=$1',[user]);
  await admin.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[[workspace,other]]);
 }
});

