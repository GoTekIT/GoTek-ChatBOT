import {transaction} from '../src/server/db';
import {resolveModel} from '../src/server/platform';
import {test,after} from 'node:test';import assert from 'node:assert/strict';import request from 'supertest';import pg from 'pg';import {randomUUID} from 'node:crypto';import {createApp} from '../src/server/app';import {pool} from '../src/server/db';
const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});after(async()=>{await pool.end();await admin.end();});
test('H28 platform role separate, capability grant, missing secret, metadata redaction and revoke',async()=>{
 const app=createApp(),agent=request.agent(app),email=`platform-${randomUUID()}@example.test`,password='Local-platform-test-2026';
 const post=(path:string,body:any)=>agent.post('/api'+path).set('X-Gotek-Request','1').send(body);
 await post('/auth/signup',{email,password,fullName:'Platform fixture',business:'Platform fixture',phone:'0900000000'});await post('/auth/login',{email,password});const me=(await agent.get('/api/me')).body;
 assert.equal((await agent.get('/api/platform/registry')).status,403);

 await admin.query('INSERT INTO platform_admins(user_id) VALUES($1)',[me.user.id]);
 assert.equal((await post('/platform/providers',{name:'private-'+randomUUID(),adapter:'custom_llm',secretRef:'GOTEK_CUSTOM_TEST_KEY',baseUrl:'http://127.0.0.1:9/',reason:'Reject private endpoint'})).body.error,'CUSTOM_LLM_HTTPS_REQUIRED');
 const custom=await post('/platform/providers',{name:'custom-'+randomUUID(),adapter:'custom_llm',secretRef:'GOTEK_CUSTOM_TEST_KEY',baseUrl:'https://example.com/llm',reason:'Allow public endpoint'});assert.equal(custom.status,200);
 await admin.query('DELETE FROM providers WHERE id=$1',[custom.body.id]);

 const provider=await post('/platform/providers',{name:randomUUID(),adapter:'openai',secretRef:'GOTEK_MISSING_TEST_KEY',reason:'Local registry test'});assert.equal(provider.status,200);
 assert.equal((await agent.patch(`/api/platform/providers/${provider.body.id}/state`).set('X-Gotek-Request','1').send({enabled:true,reason:'Local enable test'})).body.error,'PROVIDER_SECRET_MISSING');
 const model=await post('/platform/models',{providerId:provider.body.id,name:'test-model-not-live',capabilities:['chat'],reason:'Local capability test'});assert.equal(model.status,200);
 assert.equal((await post('/platform/grants',{workspaceId:me.workspaceId,modelId:model.body.id,capability:'embedding',active:true,reason:'Wrong capability test'})).body.error,'CAPABILITY_UNAVAILABLE');
 assert.equal((await post('/platform/grants',{workspaceId:me.workspaceId,modelId:model.body.id,capability:'chat',active:true,reason:'Correct capability test'})).status,200);
 assert.equal((await agent.patch(`/api/platform/models/${model.body.id}/state`).set('X-Gotek-Request','1').send({enabled:false,reason:'Model lifecycle test'})).body.enabled,false);
 await assert.rejects(resolveModel(me.workspaceId,model.body.id,'chat'),{code:'MODEL_NOT_GRANTED'});
 assert.equal((await agent.patch(`/api/platform/models/${model.body.id}/state`).set('X-Gotek-Request','1').send({enabled:true,reason:'Model lifecycle resume'})).body.enabled,true);
 await await assert.rejects(resolveModel(me.workspaceId,model.body.id,'chat'),{code:'MODEL_NOT_GRANTED'});
 const data=(await agent.get('/api/platform/registry')).body;assert.ok(!JSON.stringify(data).includes('GOTEK_MISSING_TEST_KEY'));assert.ok(!JSON.stringify(data).includes('secret_ref'));
 assert.equal((await pool.query('SELECT id FROM providers')).rowCount,0);
 const audit=(await admin.query("SELECT action,reason FROM platform_audit WHERE object_id=$1 AND action IN ('model.enabled','model.disabled') ORDER BY created_at",[model.body.id])).rows;
 assert.deepEqual(audit.map(x=>x.action),['model.disabled','model.enabled']);
 assert.equal(audit[0].reason,'Model lifecycle test');
 assert.equal((await agent.patch('/api/platform/models/'+randomUUID()+'/state').set('X-Gotek-Request','1').send({enabled:false,reason:'Missing model test'})).status,404);

 const target=request.agent(app),targetEmail=`lifecycle-${randomUUID()}@example.test`;
 await target.post('/api/auth/signup').set('X-Gotek-Request','1').send({email:targetEmail,password,fullName:'Lifecycle test',business:'Lifecycle data retained',phone:'0900000000'});
 await target.post('/api/auth/login').set('X-Gotek-Request','1').send({email:targetEmail,password});const targetMe=(await target.get('/api/me')).body;
 const endpoint=`/api/platform/workspaces/${targetMe.workspaceId}`;
 assert.equal((await target.get(endpoint)).status,403);
 assert.equal((await target.patch('/api/platform/models/'+model.body.id+'/state').set('X-Gotek-Request','1').send({enabled:false,reason:'Workspace admin denied'})).status,403);
 assert.equal((await admin.query('SELECT enabled FROM models WHERE id=$1',[model.body.id])).rows[0].enabled,true);
 assert.equal((await agent.get(endpoint)).body.name,'Lifecycle data retained');
 assert.equal((await agent.patch(endpoint+'/state').set('X-Gotek-Request','1').send({status:'disabled',reason:'Lifecycle test stop'})).status,200);
 assert.equal((await target.get('/api/me')).status,401);
 assert.equal((await target.post('/api/auth/login').set('X-Gotek-Request','1').send({email:targetEmail,password})).status,403);
 assert.equal((await agent.patch(endpoint+'/state').set('X-Gotek-Request','1').send({status:'active',reason:'Lifecycle test resume'})).status,200);
 assert.equal((await target.get('/api/me')).status,401);
 assert.equal((await target.post('/api/auth/login').set('X-Gotek-Request','1').send({email:targetEmail,password})).status,200);
 assert.equal((await target.get('/api/workspace')).body.name,'Lifecycle data retained');
 await admin.query('UPDATE platform_admins SET active=false WHERE user_id=$1',[me.user.id]);assert.equal((await agent.get('/api/platform/registry')).status,403);assert.equal((await agent.get('/api/workspace')).status,200);
});

test('H28 Platform Agent history is actor-scoped',async()=>{
 const app=createApp();const one=request.agent(app),two=request.agent(app);const password='Local-history-test-2026';
 async function fixture(agent:any,n:string){const email=`history-${n}-${randomUUID()}@example.test`;await agent.post('/api/auth/signup').set('X-Gotek-Request','1').send({email,password,fullName:'History fixture',business:'History workspace',phone:'0900000000'});await agent.post('/api/auth/login').set('X-Gotek-Request','1').send({email,password});return (await agent.get('/api/me')).body;}
 const a=await fixture(one,'a'),b=await fixture(two,'b');await admin.query('INSERT INTO platform_admins(user_id) VALUES($1),($2) ON CONFLICT DO NOTHING',[a.user.id,b.user.id]);
 const providerId=randomUUID(),modelId=randomUUID();
 await admin.query("INSERT INTO providers(id,name,adapter,secret_ref,enabled) VALUES($1,$2,'local','LOCAL_TEST_UNUSED',true)",[providerId,'Retry fixture '+providerId]);
 await admin.query("INSERT INTO models(id,provider_id,name,capabilities,enabled) VALUES($1,$2,'fixture',ARRAY['chat'],true)",[modelId,providerId]);
 await admin.query('UPDATE providers SET enabled=false WHERE id=$1',[providerId]);
 const blocked=await one.post(`/api/platform/providers/${providerId}/test`).set('X-Gotek-Request','1').send({}).expect(409);
 assert.equal(blocked.body.error,'PROVIDER_DISABLED');
 const blockedAudit=(await admin.query("SELECT actor_id,reason FROM platform_audit WHERE object_id=$1 AND action='provider.test.blocked'",[providerId])).rows;
 assert.deepEqual(blockedAudit,[{actor_id:a.user.id,reason:'PROVIDER_DISABLED'}]);
 await admin.query('UPDATE providers SET enabled=true WHERE id=$1',[providerId]);
 const payload={requestId:randomUUID(),message:'One request only',modelId};
 const chat=(body:any)=>one.post('/api/platform/agent/chat').set('X-Gotek-Request','1').send(body);
 const replies=await Promise.all([chat(payload),chat(payload)]);
 assert.equal(replies[0].status,200);assert.equal(replies[1].status,200);
 assert.deepEqual(replies[0].body,replies[1].body);
 assert.equal(replies[0].body.state,'not_configured');
 assert.equal((await admin.query('SELECT id FROM platform_agent_sessions WHERE actor_id=$1',[a.user.id])).rowCount,1);
 assert.equal((await chat({...payload,message:'Changed request'})).status,409);
 await transaction(async db=>{
  const settings=(await db.query("SELECT current_setting('app.platform',true) AS platform,current_setting('app.actor_id',true) AS actor,current_setting('app.workspace_id',true) AS workspace")).rows[0];
  assert.notEqual(settings.platform,'true','detached agent must not leak platform privilege into pool');
  assert.ok(!settings.actor,'detached actor must be cleared');
  assert.ok(!settings.workspace,'detached tenant must be cleared');
 });
 assert.equal((await one.get('/api/platform/agent/sessions/'+replies[0].body.sessionId+'/messages')).body.length,1);
 const originalFetch=globalThis.fetch,previousKey=process.env.GOTEK_AGENT_TEST_KEY;
 process.env.GOTEK_AGENT_TEST_KEY='fixture-only';
 await admin.query("UPDATE providers SET adapter='openai',secret_ref='GOTEK_AGENT_TEST_KEY',base_url=NULL WHERE id=$1",[providerId]);
 let calls=0;
 try{
  for(const [status,content] of [['confirmed','OK'],['failed',' ']]){
   globalThis.fetch=async()=>{
    assert.equal(pool.totalCount,pool.idleCount,'provider probe must release database connections before network I/O');
    return new Response(JSON.stringify({choices:[{message:{content}}]}));
   };
   const probe=await one.post(`/api/platform/providers/${providerId}/test`).set('X-Gotek-Request','1').send({}).expect(200);
   assert.equal(probe.body.status,status);
   const records=(await admin.query('SELECT actor_id,object_id,action,reason FROM platform_audit WHERE object_id=$1 AND action=$2',[providerId,`provider.test.${status}`])).rows;
   assert.equal(records.length,1);
   assert.deepEqual(records[0],{actor_id:a.user.id,object_id:providerId,action:`provider.test.${status}`,reason:'Platform provider connectivity probe'});
   assert.ok(!JSON.stringify(records).includes('fixture-only'));
  }

  globalThis.fetch=async(_url:any,options:any)=>{
   assert.equal(pool.totalCount,pool.idleCount,'agent inference must release all checked-out connections');
   calls++;const body=JSON.parse(options.body),prompt=body.messages[0].content;
   assert.equal(prompt.split('Unique current question').length-1,1);
   const parsed=JSON.parse(prompt.slice(prompt.indexOf('\n')+1));
   assert.deepEqual(parsed.sources[0],{source:'workspace',title:'Workspace context',content:'Workspace: History workspace\nStatus: active',truncated:false});
   return new Response(JSON.stringify({choices:[{message:{content:'Fixture answer'}}]}));
  };
  const remotePayload={...payload,requestId:randomUUID(),sessionId:replies[0].body.sessionId,message:'Unique current question',workspaceId:b.workspaceId};
  const missing=await chat({...remotePayload,requestId:randomUUID(),workspaceId:randomUUID()});
  assert.equal(missing.status,404);assert.equal(missing.body.error,'WORKSPACE_NOT_FOUND');assert.equal(calls,0);
  const confirmed=await Promise.all([chat(remotePayload),chat(remotePayload)]);
  assert.equal(confirmed[0].status,200);assert.equal(confirmed[1].status,200);
  assert.equal(confirmed[0].body.state,'confirmed');assert.deepEqual(confirmed[0].body,confirmed[1].body);
  assert.equal(confirmed[0].body.message.content,'Fixture answer');assert.equal(calls,1);
  assert.deepEqual((await chat(remotePayload)).body,confirmed[0].body);assert.equal(calls,1);
  assert.equal((await chat({...remotePayload,workspaceId:a.workspaceId})).status,409);assert.equal(calls,1);
  const messages=(await one.get('/api/platform/agent/sessions/'+remotePayload.sessionId+'/messages')).body;
  assert.equal(messages.filter((m:any)=>m.request_id===remotePayload.requestId).length,2);
  let enter!:()=>void,release!:()=>void;
  const entered=new Promise<void>(resolve=>{enter=resolve;});
  const gate=new Promise<void>(resolve=>{release=resolve;});
  let gatedCalls=0;
  globalThis.fetch=async()=>{gatedCalls++;enter();await gate;return new Response(JSON.stringify({choices:[{message:{content:'Gated answer'}}]}));};
  const gatedPayload={...remotePayload,requestId:randomUUID(),message:'Pending question'};
  const nextPayload={...remotePayload,requestId:randomUUID(),message:'Question after pending turn'};
  const pending=chat(gatedPayload).then(result=>result);
  try{
   await entered;
   const conflict=await chat({...gatedPayload,message:'Different pending question'});
   assert.equal(conflict.status,409);assert.equal(conflict.body.error,'IDEMPOTENCY_CONFLICT');
   const claim=(await admin.query('SELECT status,response FROM platform_agent_requests WHERE actor_id=$1 AND request_id=$2',[a.user.id,gatedPayload.requestId])).rows[0];
   assert.equal(claim.status,'pending');assert.equal(claim.response,null);
   assert.equal(gatedCalls,1);
   const busy=await chat(nextPayload);assert.equal(busy.status,409);assert.equal(busy.body.error,'SESSION_BUSY');
   assert.equal((await admin.query('SELECT 1 FROM platform_agent_requests WHERE actor_id=$1 AND request_id=$2',[a.user.id,nextPayload.requestId])).rowCount,0);
  }finally{release();}
  const settled=await pending;assert.equal(settled.body.state,'confirmed');
  const durable=(await admin.query('SELECT status,response FROM platform_agent_requests WHERE actor_id=$1 AND request_id=$2',[a.user.id,gatedPayload.requestId])).rows[0];
  assert.equal(durable.status,'confirmed');assert.deepEqual(durable.response,settled.body);
  const seen:any[]=[];
  globalThis.fetch=async(_url:any,options:any)=>{
   const prompt=JSON.parse(options.body).messages[0].content;
   const data=JSON.parse(prompt.slice(prompt.indexOf('\n')+1));seen.push(data);
   return new Response(JSON.stringify({choices:[{message:{content:'Answer '+data.question}}]}));
  };
  const retry=await chat(nextPayload);assert.equal(retry.status,200);assert.equal(retry.body.state,'confirmed');
  assert.equal(seen.length,1);
  const history=seen[0].history;
  const index=history.findIndex((h:any)=>h.role==='user'&&h.content==='Pending question');
  assert.ok(index>=0);assert.deepEqual(history[index+1],{role:'assistant',content:'Gated answer'});
  assert.equal(history.filter((h:any)=>h.content==='Gated answer').length,1);
  const activity=(await admin.query('SELECT updated_at>created_at AS advanced FROM platform_agent_sessions WHERE id=$1',[remotePayload.sessionId])).rows[0];
  assert.equal(activity.advanced,true);

  // An interrupted dispatch must release its session without sending that turn twice.
  let dispatchEntered!:()=>void,finishLate!:()=>void;
  const dispatchStarted=new Promise<void>(resolve=>{dispatchEntered=resolve;});
  const lateGate=new Promise<void>(resolve=>{finishLate=resolve;});
  const dispatchedQuestions:string[]=[];
  globalThis.fetch=async(_url:any,options:any)=>{
   const prompt=JSON.parse(options.body).messages[0].content;
   const data=JSON.parse(prompt.slice(prompt.indexOf('\n')+1));
   dispatchedQuestions.push(data.question);
   if(data.question==='Expired dispatched turn'){
    dispatchEntered();await lateGate;
    return new Response(JSON.stringify({choices:[{message:{content:'Late answer must be discarded'}}]}));
   }
   assert.ok(!data.history.some((message:any)=>message.content==='Expired dispatched turn'),'expired user turn must be excluded from later context');
   return new Response(JSON.stringify({choices:[{message:{content:'Recovered session answer'}}]}));
  };
  const expiredPayload={...remotePayload,requestId:randomUUID(),message:'Expired dispatched turn'};
  const successorPayload={...remotePayload,requestId:randomUUID(),message:'Session after expired turn'};
  const lateRequest=chat(expiredPayload).then(result=>result);
  let recoveredReceipt:any;
  try{
   await dispatchStarted;
   const dispatched=(await admin.query('SELECT status,dispatched_at,lease_expires_at FROM platform_agent_requests WHERE actor_id=$1 AND request_id=$2',[a.user.id,expiredPayload.requestId])).rows[0];
   assert.equal(dispatched.status,'pending');assert.ok(dispatched.dispatched_at);assert.ok(dispatched.lease_expires_at);
   await admin.query("UPDATE platform_agent_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE actor_id=$1 AND request_id=$2",[a.user.id,expiredPayload.requestId]);
   const replayWhilePending=await chat(expiredPayload).timeout({response:5000,deadline:6000});
   assert.equal(replayWhilePending.status,200);assert.equal(replayWhilePending.body.state,'unknown');
   assert.equal(replayWhilePending.body.error,'AGENT_REQUEST_EXPIRED');
   assert.deepEqual(dispatchedQuestions,['Expired dispatched turn']);
   const successor=await chat(successorPayload).timeout({response:5000,deadline:6000});
   assert.equal(successor.status,200);assert.equal(successor.body.state,'confirmed');
   assert.equal(successor.body.message.content,'Recovered session answer');
   const recovered=(await admin.query('SELECT status,response,completed_at FROM platform_agent_requests WHERE actor_id=$1 AND request_id=$2',[a.user.id,expiredPayload.requestId])).rows[0];
   assert.equal(recovered.status,'unknown');assert.equal(recovered.response.state,'unknown');assert.ok(recovered.completed_at);
   assert.equal(recovered.response.sessionId,remotePayload.sessionId);recoveredReceipt=recovered.response;
   assert.deepEqual(dispatchedQuestions,['Expired dispatched turn','Session after expired turn']);
   assert.equal((await admin.query("SELECT 1 FROM platform_agent_requests WHERE session_id=$1 AND status='pending'",[remotePayload.sessionId])).rowCount,0);
  }finally{finishLate();}
  const lateResponse=await lateRequest;
  assert.equal(lateResponse.status,200);assert.deepEqual(lateResponse.body,recoveredReceipt);
  const persisted=(await admin.query('SELECT status,response FROM platform_agent_requests WHERE actor_id=$1 AND request_id=$2',[a.user.id,expiredPayload.requestId])).rows[0];
  assert.equal(persisted.status,'unknown');assert.deepEqual(persisted.response,recoveredReceipt);
  assert.equal((await admin.query("SELECT 1 FROM platform_agent_messages WHERE session_id=$1 AND content='Late answer must be discarded'",[remotePayload.sessionId])).rowCount,0);
  assert.deepEqual((await chat(expiredPayload)).body,recoveredReceipt);
  assert.deepEqual(dispatchedQuestions,['Expired dispatched turn','Session after expired turn'],'recovery and replay must never resend an uncertain dispatch');
 }finally{globalThis.fetch=originalFetch;if(previousKey===undefined)delete process.env.GOTEK_AGENT_TEST_KEY;else process.env.GOTEK_AGENT_TEST_KEY=previousKey;}
 await admin.query('DELETE FROM platform_agent_requests WHERE actor_id=$1',[a.user.id]);
 await admin.query('DELETE FROM platform_agent_messages WHERE session_id=$1',[replies[0].body.sessionId]);
 await admin.query('DELETE FROM platform_agent_sessions WHERE id=$1',[replies[0].body.sessionId]);
 await admin.query('DELETE FROM models WHERE id=$1',[modelId]);await admin.query('DELETE FROM providers WHERE id=$1',[providerId]);
 const sid=randomUUID();await admin.query('INSERT INTO platform_agent_sessions(id,actor_id,title) VALUES($1,$2,$3)',[sid,a.user.id,'history test']);await admin.query("INSERT INTO platform_agent_messages(id,session_id,role,content,status,request_id) VALUES($1,$2,'user','hello','confirmed',$3)",[randomUUID(),sid,randomUUID()]);
 assert.equal((await one.get('/api/platform/agent/sessions')).status,200);assert.equal((await one.get(`/api/platform/agent/sessions/${sid}/messages`)).body.length,1);assert.equal((await two.get(`/api/platform/agent/sessions/${sid}/messages`)).status,404);
 await admin.query('DELETE FROM platform_agent_messages WHERE session_id=$1',[sid]);await admin.query('DELETE FROM platform_agent_sessions WHERE id=$1',[sid]);await admin.query('DELETE FROM platform_admins WHERE user_id IN ($1,$2)',[a.user.id,b.user.id]);
});
