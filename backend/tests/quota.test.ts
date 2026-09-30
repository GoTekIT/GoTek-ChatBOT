import {test,after} from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {pool,scope,transaction} from '../src/core/db';import {reserveUsage,reserveAiResponse,settleUsage,usageSummary} from '../src/modules/ai/quota';
const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});after(async()=>{await pool.end();await admin.end();});
test('H23 quota concurrency, UNKNOWN holds, receipt idempotency and tenant isolation',async()=>{
 const workspace=randomUUID(),other=randomUUID(),budget=randomUUID();await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2),($3,$4)',[workspace,'Quota test',other,'Other']);await admin.query("INSERT INTO quota_budgets(id,workspace_id,meter,period_start,period_end,limit_units) VALUES($1,$2,'ai_response',now()-interval '1 day',now()+interval '1 day',1)",[budget,workspace]);
 const run=<T>(fn:(db:pg.PoolClient)=>Promise<T>,tenant=workspace)=>transaction(async db=>{await scope(db,tenant);return fn(db);});
 const results=await Promise.allSettled(['a','b'].map(key=>run(db=>reserveUsage(db,workspace,budget,key,1))));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.code,'QUOTA_EXCEEDED');const op=(results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>).value;
 assert.equal((await run(db=>reserveUsage(db,workspace,budget,op.operation_key,1))).id,op.id);
 await run(db=>settleUsage(db,workspace,op.id,'unknown'));await assert.rejects(run(db=>reserveUsage(db,workspace,budget,'c',1)),{code:'QUOTA_EXCEEDED'});
 assert.equal((await run(usageSummary))[0].unknown,'1');assert.equal((await run(usageSummary,other)).length,0);
 await assert.rejects(run(db=>settleUsage(db,other,op.id,'released',0,'no-charge'),other),{code:'NOT_FOUND'});
 await run(db=>settleUsage(db,workspace,op.id,'released',0,'no-charge'));await run(db=>settleUsage(db,workspace,op.id,'released',0,'no-charge'));
 await assert.rejects(run(db=>settleUsage(db,workspace,op.id,'confirmed',1,'different')),{code:'RECEIPT_CONFLICT'});
 const second=await run(db=>reserveUsage(db,workspace,budget,'c',1));await run(db=>settleUsage(db,workspace,second.id,'confirmed',2,'actual-provider-receipt'));
 assert.equal((await run(usageSummary))[0].confirmed,'2');await assert.rejects(run(db=>reserveUsage(db,workspace,budget,'d',1)),{code:'QUOTA_EXCEEDED'});
 await admin.query("UPDATE quota_budgets SET period_end=now()-interval '1 second' WHERE id=$1",[budget]);await assert.rejects(run(db=>reserveUsage(db,workspace,budget,'new-period',1)),{code:'QUOTA_PERIOD_CLOSED'});
 await assert.rejects(run(db=>reserveAiResponse(db,workspace,'ai-after-expiry')),{code:'QUOTA_PERIOD_CLOSED'});
});
test('AI response quota keeps legacy workspaces unlimited until provisioned',async()=>{
 const workspace=randomUUID();await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspace,'Legacy quota test']);
 try {
  const result=await transaction(async db=>{await scope(db,workspace);return reserveAiResponse(db,workspace,'legacy-ai-1');});
  assert.equal(result,undefined);
 } finally {await admin.query('DELETE FROM workspaces WHERE id=$1',[workspace]);}
});

test('AI quota retry retains its original reservation across period renewal',async()=>{
 const workspace=randomUUID(),oldBudget=randomUUID(),nextBudget=randomUUID();
 await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspace,'Renewal retry']);
 const run=(key:string)=>transaction(async db=>{await scope(db,workspace);return reserveAiResponse(db,workspace,key);});
 try {
  await admin.query("INSERT INTO quota_budgets(id,workspace_id,meter,period_start,period_end,limit_units) VALUES($1,$2,'ai_response',now()-interval '2 days',now()+interval '1 day',1)",[oldBudget,workspace]);
  const original=await run('same-request');
  await transaction(async db=>{await scope(db,workspace);await settleUsage(db,workspace,original.id,'unknown');});
  await admin.query("UPDATE quota_budgets SET period_end=now()-interval '1 second' WHERE id=$1",[oldBudget]);
  assert.equal((await run('same-request')).id,original.id);
  await assert.rejects(run('new-request'),{code:'QUOTA_PERIOD_CLOSED'});
  await admin.query("INSERT INTO quota_budgets(id,workspace_id,meter,period_start,period_end,limit_units) VALUES($1,$2,'ai_response',now(),now()+interval '1 day',1)",[nextBudget,workspace]);
  const retries=await Promise.all([run('same-request'),run('same-request')]);
  for(const retry of retries){assert.equal(retry.id,original.id);assert.equal(retry.budget_id,oldBudget);assert.equal(retry.state,'unknown');}
  assert.equal((await run('new-request')).budget_id,nextBudget);
  assert.equal((await admin.query('SELECT count(*) FROM usage_operations WHERE workspace_id=$1',[workspace])).rows[0].count,'2');
 } finally {
  await admin.query('DELETE FROM usage_operations WHERE workspace_id=$1',[workspace]);
  await admin.query('DELETE FROM workspaces WHERE id=$1',[workspace]);
 }
});
