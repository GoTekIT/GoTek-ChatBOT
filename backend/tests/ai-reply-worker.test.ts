import request from 'supertest';
import {createApp} from '../src/app';
import {opaque,digest} from '../src/core/security';
import test from 'node:test';import assert from 'node:assert/strict';import {aiReplyHandler,transactionalAiReplyHandler} from '../src/modules/ai/ai-reply-worker';import {runAiWorkerOnce,defaultWorkspaceProviderInvoke} from '../src/modules/jobs/worker';import pg from 'pg';import {randomUUID} from 'node:crypto';import {pool,scope,transaction} from '../src/core/db';import {appendMessage} from '../src/modules/chat/chat-store';import {enqueueJob} from '../src/modules/jobs/jobs';
const admin=new pg.Pool({host:'127.0.0.1',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
test.after(async()=>{await pool.end();await admin.end();});
test('AI worker boundary refuses stale ownership and missing model before invocation',async()=>{let calls=0;const db:any={query:async(sql:string)=>({rows:sql.includes('SELECT c.reply_owner')?[{reply_owner:'HUMAN_ACTIVE',owner_version:2,body:'hello'}]:[]})};const h=aiReplyHandler(db,async()=>{calls++;return 'answer';});await assert.rejects(()=>h({workspace_id:'w',payload:{conversationId:'c',messageId:'m',ownerVersion:2}}),(e:any)=>e.code==='STALE_REPLY_OWNER');assert.equal(calls,0);});
test('AI worker invokes an enabled workspace model and appends a public reply',async()=>{
 const websiteKey=opaque(),visitorToken=opaque(),app=createApp();
 const w=randomUUID(),ch=randomUUID(),v=randomUUID(),c=randomUUID(),p=randomUUID(),m=randomUUID(),budget=randomUUID();
 await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[w,'AI worker success']);
 await admin.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'AI fixture','https://example.test','Hi','#0057E1',$3,$4,'{}')",[ch,w,websiteKey,randomUUID()]);
 await admin.query("INSERT INTO visitors(id,workspace_id,channel_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 day')",[v,w,ch,digest(visitorToken)]);
 await admin.query("INSERT INTO conversations(id,workspace_id,channel_id,visitor_id,reply_owner) VALUES($1,$2,$3,$4,'AI_ACTIVE')",[c,w,ch,v]);
 await admin.query("INSERT INTO providers(id,name,adapter,secret_ref,enabled) VALUES($1,$2,'local','LOCAL_AI_TEST_KEY',true)",[p,'AI worker provider '+p]);
 await admin.query("INSERT INTO models(id,provider_id,name,capabilities,enabled) VALUES($1,$2,'local-test',ARRAY['chat'],true)",[m,p]);
 await admin.query("INSERT INTO model_grants(id,workspace_id,model_id,capability,active) VALUES($1,$2,$3,'chat',true)",[randomUUID(),w,m]);
 await admin.query("INSERT INTO quota_budgets(id,workspace_id,meter,period_start,period_end,limit_units) VALUES($1,$2,'ai_response',now()-interval '1 minute',now()+interval '1 day',10)",[budget,w]);
 try {
  const result=await transaction(async db=>{await scope(db,w);const source=await appendMessage(db,{workspace:w,conversation:c,clientId:randomUUID(),author:'visitor',visibility:'public',body:'Need help'});assert.equal((await db.query("SELECT count(*) FROM model_grants g JOIN models m ON m.id=g.model_id JOIN providers p ON p.id=m.provider_id WHERE g.workspace_id=$1",[w])).rows[0].count,'0');let received:any;const h=aiReplyHandler(db,async input=>{received=input;assert.notEqual((await db.query("SELECT current_setting('app.platform',true) AS enabled")).rows[0].enabled,'true');return 'AI answer';});const out=await h({workspace_id:w,payload:{conversationId:c,messageId:source.id,ownerVersion:1}});return {out,received,sourceId:source.id,messages:(await db.query("SELECT author_type,visibility,body FROM messages WHERE conversation_id=$1 ORDER BY sequence",[c])).rows};});
  assert.equal(result.out.receipt.startsWith(`ai:${c}:`),true);assert.deepEqual(result.received,{workspace:w,conversation:c,message: 'Need help',modelId:m});assert.deepEqual(result.messages.map(x=>[x.author_type,x.visibility,x.body]),[['visitor','public','Need help'],['ai','public','AI answer']]);
  assert.equal((await transaction(async db=>{await scope(db,w);const h=aiReplyHandler(db,async()=>{throw new Error('provider should not be called on retry');});return h({workspace_id:w,payload:{conversationId:c,messageId:result.sourceId,ownerVersion:1}});})).receipt,result.out.receipt);

  const note=await transaction(async db=>{await scope(db,w);return appendMessage(db,{workspace:w,conversation:c,clientId:randomUUID(),author:'agent',visibility:'internal',body:'Private staff note'});});
  const aiSource=(await admin.query("SELECT id FROM messages WHERE conversation_id=$1 AND author_type='ai'",[c])).rows[0].id;
  let forbiddenInvokes=0;
  const rejectSource=transactionalAiReplyHandler(async()=>{forbiddenInvokes++;return 'Must never be generated';});
  for(const sourceId of [note.id,aiSource]){
   await assert.rejects(rejectSource({workspace_id:w,payload:{conversationId:c,messageId:sourceId,ownerVersion:1}}),{code:'AI_SOURCE_NOT_FOUND'});
  }
  assert.equal(forbiddenInvokes,0);
  const next=await transaction(async db=>{await scope(db,w);return appendMessage(db,{workspace:w,conversation:c,clientId:randomUUID(),author:'visitor',visibility:'public',body:'Second question'});});
  const handler=transactionalAiReplyHandler(async()=>{
   // Real visitor API commits handoff while the injected provider is in flight.
   const handoff=await request(app).post(`/widget-api/${websiteKey}/handoff`).set('Origin','https://example.test').set('Authorization',`Bearer ${visitorToken}`).send({}).expect(200);
   assert.deepEqual(handoff.body,{replyOwner:'HANDOFF_PENDING',ownerVersion:2});
   return 'Must not be published';
  });
  await assert.rejects(handler({workspace_id:w,payload:{conversationId:c,messageId:next.id,ownerVersion:1}}),{code:'STALE_REPLY_OWNER'});
  assert.equal((await admin.query("SELECT count(*) FROM messages WHERE conversation_id=$1 AND body='Must not be published'",[c])).rows[0].count,'0');
  let third=await transaction(async db=>{await scope(db,w);return appendMessage(db,{workspace:w,conversation:c,clientId:randomUUID(),author:'visitor',visibility:'public',body:'Third question'});});
  await admin.query("UPDATE conversations SET reply_owner='AI_ACTIVE',owner_version=owner_version+1 WHERE id=$1",[c]);
  const runtimeSource=await transaction(async db=>{await scope(db,w);return appendMessage(db,{workspace:w,conversation:c,clientId:randomUUID(),author:'visitor',visibility:'public',body:'Runtime question'});});
  await transaction(async db=>{await scope(db,w);await enqueueJob(db,w,{kind:'ai.reply',key:`runtime:${runtimeSource.id}`,payload:{conversationId:c,messageId:runtimeSource.id,ownerVersion:3},external:false});});
  const runtime=await runAiWorkerOnce(w,async input=>{assert.equal(input.workspace,w);assert.equal(input.conversation,c);assert.equal(input.message,'Runtime question');assert.equal(input.modelId,m);assert.deepEqual(input.history?.map(x=>[x.role,x.content]),[['visitor','Need help'],['ai','AI answer'],['visitor','Second question'],['visitor','Third question']]);return 'Runtime answer';});
  assert.equal(runtime.state,'succeeded');
  assert.equal((await admin.query("SELECT count(*) FROM messages WHERE conversation_id=$1 AND body='Runtime answer'",[c])).rows[0].count,'1');
  assert.equal((await admin.query("SELECT count(*) FROM jobs WHERE workspace_id=$1 AND kind='ai.reply' AND state='succeeded'",[w])).rows[0].count,'1');
  const quotaOp=(await admin.query("SELECT state,reserved_units,actual_units,receipt_id FROM usage_operations WHERE workspace_id=$1 AND operation_key=$2",[w,(await admin.query("SELECT client_id FROM messages WHERE conversation_id=$1 AND body='Runtime answer'",[c])).rows[0].client_id])).rows[0];
  assert.equal(quotaOp.state,'confirmed'); assert.equal(Number(quotaOp.reserved_units),1); assert.equal(Number(quotaOp.actual_units),1); assert.ok(quotaOp.receipt_id.startsWith('ai:')); 
  const usage=(await admin.query('SELECT provider,model,prompt_tokens,completion_tokens,total_tokens,estimated FROM ai_usage_ledger WHERE workspace_id=$1 AND operation_key=$2',[w, (await admin.query("SELECT client_id FROM messages WHERE conversation_id=$1 AND body='Runtime answer'",[c])).rows[0].client_id])).rows[0];
  assert.equal(usage.provider,p); assert.equal(usage.model,m); assert.equal(Number(usage.total_tokens),Number(usage.prompt_tokens)+Number(usage.completion_tokens)); assert.equal(usage.estimated,true);
  await transaction(async db=>{await scope(db,w);await enqueueJob(db,w,{kind:'ai.reply',key:'expire-during-inference',payload:{conversationId:c,messageId:third.id,ownerVersion:3},external:false});});
  const expired=await runAiWorkerOnce(w,async()=>{
   await admin.query("UPDATE jobs SET lease_until=now()-interval '1 second' WHERE workspace_id=$1 AND state='running'",[w]);
   return 'Expired output';
  });
  assert.equal(expired.state,'lease_expired');
  assert.equal((await admin.query("SELECT count(*) FROM messages WHERE conversation_id=$1 AND body='Expired output'",[c])).rows[0].count,'0');
  let duplicateCalls=0;
  const duplicate=transactionalAiReplyHandler(async()=>{duplicateCalls++;return 'Duplicate';});
  await assert.rejects(duplicate({workspace_id:w,payload:{conversationId:c,messageId:third.id,ownerVersion:3}}),{code:'AI_DISPATCH_UNKNOWN'});
  assert.equal(duplicateCalls,0);
  const uncertain=(await admin.query("SELECT o.state FROM usage_operations o JOIN ai_reply_dispatches d ON d.workspace_id=o.workspace_id AND d.client_id::text=o.operation_key WHERE o.workspace_id=$1 AND d.state='unknown'",[w])).rows;
  assert.ok(uncertain.length>0);assert.ok(uncertain.every(row=>row.state==='unknown'),'post-dispatch errors preserve unknown quota');
  third=await transaction(async db=>{await scope(db,w);return appendMessage(db,{workspace:w,conversation:c,clientId:randomUUID(),author:'visitor',visibility:'public',body:'Fresh grounded question'});});
  const quotaBefore=(await admin.query('SELECT count(*) FROM usage_operations WHERE workspace_id=$1',[w])).rows[0].count;
  let ungroundedCalls=0;
  const grounded=transactionalAiReplyHandler(async()=>{ungroundedCalls++;return 'Unsupported answer';});
  await assert.rejects(grounded({workspace_id:w,payload:{conversationId:c,messageId:third.id,ownerVersion:3,requireGrounded:true}}),{code:'AI_KNOWLEDGE_NOT_FOUND'});
  assert.equal(ungroundedCalls,0,'no provider cost when published sources are absent');
  assert.equal((await admin.query('SELECT count(*) FROM usage_operations WHERE workspace_id=$1',[w])).rows[0].count,quotaBefore,'grounding failure must not reserve quota');
  assert.equal((await admin.query("SELECT count(*) FROM messages WHERE conversation_id=$1 AND body='Unsupported answer'",[c])).rows[0].count,'0');
  await transaction(async db=>{await scope(db,w);await enqueueJob(db,w,{kind:'ai.reply',key:'grounded-handoff',payload:{conversationId:c,messageId:third.id,ownerVersion:3,requireGrounded:true},external:false});});
  // Keep the deliberately expired fixture from being reclaimed in this assertion.
  await admin.query("UPDATE jobs SET state='unknown',lease_token=NULL,lease_until=NULL WHERE workspace_id=$1 AND state='running'",[w]);
  assert.equal((await runAiWorkerOnce(w,async()=>{throw Error('No provider call allowed');})).state,'succeeded');
  assert.equal((await admin.query('SELECT reply_owner FROM conversations WHERE id=$1',[c])).rows[0].reply_owner,'HANDOFF_PENDING');
  assert.equal((await admin.query("SELECT count(*) FROM messages WHERE conversation_id=$1 AND body LIKE 'Tôi chưa tìm thấy%'",[c])).rows[0].count,'1');
  await admin.query("UPDATE conversations SET reply_owner='AI_ACTIVE',owner_version=3 WHERE id=$1",[c]);
  await admin.query("UPDATE providers SET adapter='custom_llm' WHERE id=$1",[p]);
  process.env.LOCAL_AI_TEST_KEY='local-test-secret';
  let registryPid:number|undefined;
  const captureRegistryConnection=(client:pg.PoolClient)=>{registryPid=(client as pg.PoolClient&{processID:number}).processID;};
  pool.once('acquire',captureRegistryConnection);
  try {
   const realBoundary=defaultWorkspaceProviderInvoke(async(_adapter,_model,_base,key,prompt)=>{
    assert.equal(key,'local-test-secret');assert.ok(prompt.includes('Chỉ trả lời'));assert.ok(!prompt.includes(w));
    // Observe the connection used by this invocation, not unrelated parallel tests.
    assert.ok(registryPid,'registry connection must have been acquired');
    const activity=(await admin.query('SELECT state,xact_start,query FROM pg_stat_activity WHERE pid=$1',[registryPid])).rows[0];
    assert.ok(activity,'registry connection must be observable');
    assert.equal(activity.state,'idle','provider must run after registry transaction commits');
    assert.equal(activity.xact_start,null,'provider must not retain an open registry transaction');
    assert.equal(activity.query,'COMMIT','registry transaction must commit before provider invocation');
    return 'Transport boundary verified';
   });
   assert.equal(await realBoundary({workspace:w,conversation:c,message:'Test',modelId:m,context:[{source:'knowledge',title:'Test source',content:'Test answer',citation:{}}]}),'Transport boundary verified');
  } finally {pool.removeListener('acquire',captureRegistryConnection);delete process.env.LOCAL_AI_TEST_KEY;}
  await admin.query('UPDATE model_grants SET active=false WHERE workspace_id=$1',[w]);
  await transaction(async db=>{await scope(db,w);await enqueueJob(db,w,{kind:'ai.reply',key:'missing-model-handoff',payload:{conversationId:c,messageId:third.id,ownerVersion:3,requireGrounded:true},external:false});});
  let missingModelCalls=0;
  assert.equal((await runAiWorkerOnce(w,async()=>{missingModelCalls++;return 'Must not call';})).state,'succeeded');
  assert.equal(missingModelCalls,0);
  assert.equal((await admin.query('SELECT reply_owner FROM conversations WHERE id=$1',[c])).rows[0].reply_owner,'HANDOFF_PENDING');
  const fallback=(await admin.query("SELECT body FROM messages WHERE conversation_id=$1 AND body LIKE 'Trợ lý tự động%'",[c])).rows;
  assert.equal(fallback.length,1);assert.ok(!fallback[0].body.includes('LOCAL_AI_TEST_KEY'));
  await admin.query('UPDATE model_grants SET active=true WHERE workspace_id=$1',[w]);
  await admin.query("UPDATE conversations SET reply_owner='AI_ACTIVE',owner_version=3 WHERE id=$1",[c]);
  for(const ruleError of ['AI_RULES_CHANGED','AI_RULES_CONTEXT_LIMIT']){
   third=await transaction(async db=>{await scope(db,w);return appendMessage(db,{workspace:w,conversation:c,clientId:randomUUID(),author:'visitor',visibility:'public',body:'Independent failure case'});});

   await admin.query("UPDATE conversations SET reply_owner='AI_ACTIVE',owner_version=3 WHERE id=$1",[c]);
   await transaction(async db=>{await scope(db,w);await enqueueJob(db,w,{kind:'ai.reply',key:ruleError,payload:{conversationId:c,messageId:third.id,ownerVersion:3},external:false});});
   const result=await runAiWorkerOnce(w,async()=>{throw new Error(ruleError);});
   assert.equal(result.state,'succeeded');
   assert.equal((await admin.query('SELECT reply_owner FROM conversations WHERE id=$1',[c])).rows[0].reply_owner,'HANDOFF_PENDING');
   const visible=(await admin.query('SELECT body FROM messages WHERE conversation_id=$1 ORDER BY sequence DESC LIMIT 1',[c])).rows[0].body;
   assert.ok(visible.includes('nhân viên hỗ trợ'));assert.ok(!visible.includes(ruleError));
  }
  await admin.query("UPDATE conversations SET reply_owner='AI_ACTIVE',owner_version=3 WHERE id=$1",[c]);
   third=await transaction(async db=>{await scope(db,w);return appendMessage(db,{workspace:w,conversation:c,clientId:randomUUID(),author:'visitor',visibility:'public',body:'Independent failure case'});});
  const revoke=transactionalAiReplyHandler(async()=>{await admin.query('UPDATE models SET enabled=false WHERE id=$1',[m]);return 'Must not publish revoked';});
  await assert.rejects(revoke({workspace_id:w,payload:{conversationId:c,messageId:third.id,ownerVersion:3}}),{code:'AI_MODEL_REVOKED'});
  assert.equal((await admin.query("SELECT count(*) FROM messages WHERE conversation_id=$1 AND body='Must not publish revoked'",[c])).rows[0].count,'0');
 } finally {await admin.query('DELETE FROM usage_operations WHERE workspace_id=$1',[w]);await admin.query('DELETE FROM quota_budgets WHERE workspace_id=$1',[w]);await admin.query('DELETE FROM jobs WHERE workspace_id=$1',[w]);await admin.query('DELETE FROM model_grants WHERE workspace_id=$1',[w]);await admin.query('DELETE FROM models WHERE id=$1',[m]);await admin.query('DELETE FROM messages WHERE workspace_id=$1',[w]);await admin.query('DELETE FROM conversations WHERE workspace_id=$1',[w]);await admin.query('DELETE FROM visitors WHERE workspace_id=$1',[w]);await admin.query('DELETE FROM channels WHERE workspace_id=$1',[w]);await admin.query('DELETE FROM providers WHERE id=$1',[p]);await admin.query('DELETE FROM workspaces WHERE id=$1',[w]);}
});
