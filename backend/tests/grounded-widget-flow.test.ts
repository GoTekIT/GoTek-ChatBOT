import {buildWidgetAiContext} from '../src/modules/knowledge/knowledge-retrieval';
import {scope,transaction} from '../src/core/db';
import {embedKnowledgeBatch,retrieveEmbeddedContext} from '../src/modules/knowledge/knowledge-embedding-worker';
import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/app';
import {pool} from '../src/core/db';
import {runAiWorkerOnce,defaultWorkspaceProviderInvoke} from '../src/modules/jobs/worker';

test('published enterprise data flows through granted adapter to widget, then human takeover',async t=>{
 const admin=new pg.Pool({host:'127.0.0.1',port:Number(process.env.PGPORT||55432),user:'gotek_migrator',database:'gotek_chatbot'});
 t.after(async()=>{await pool.end();await admin.end();});
 const email=randomUUID()+'@example.test';
 const app=createApp(),owner=request.agent(app),password='Local-grounded-fixture-2026';
 const post=(path:string,data:any)=>owner.post('/api'+path).set('X-Gotek-Request','1').send(data);
 await post('/auth/signup',{email,password,fullName:'Grounded test',business:'Grounded business',phone:'0900000000'}).expect(202);
 await post('/auth/login',{email,password}).expect(200);
 const me=(await owner.get('/api/me').expect(200)).body;
 await admin.query('INSERT INTO platform_admins(user_id) VALUES($1)',[me.user.id]);
 const prior=process.env.GOTEK_GROUNDED_TEST_KEY;process.env.GOTEK_GROUNDED_TEST_KEY='fixture-only';
 const oldFetch=globalThis.fetch;
 t.after(()=>{globalThis.fetch=oldFetch;if(prior===undefined)delete process.env.GOTEK_GROUNDED_TEST_KEY;else process.env.GOTEK_GROUNDED_TEST_KEY=prior;});
 const reason='Local grounded integration fixture';
 const provider=(await post('/platform/providers',{name:randomUUID(),adapter:'openai',secretRef:'GOTEK_GROUNDED_TEST_KEY',reason}).expect(200)).body;
 await owner.patch('/api/platform/providers/'+provider.id+'/state').set('X-Gotek-Request','1').send({enabled:true,reason}).expect(200);
 const model=(await post('/platform/models',{providerId:provider.id,name:'fixture-model',capabilities:['chat'],reason}).expect(200)).body;
 await post('/platform/grants',{workspaceId:me.workspaceId,modelId:model.id,capability:'chat',active:true,reason}).expect(200);
 const imported=(await post('/knowledge/import-file',{filename:'warranty.json',content:JSON.stringify([{title:'Warranty',content:'Warranty lasts 12 months.'}])}).expect(200)).body;
 const item=imported.items[0];
 const ready=(await post('/knowledge/items/'+item.id+'/process',{requestId:randomUUID(),versionId:item.draft_version_id,expectedRevision:item.revision}).expect(200)).body;
 await post('/knowledge/items/'+item.id+'/publish',{requestId:randomUUID(),versionId:item.draft_version_id,expectedRevision:ready.revision,audience:'PUBLIC'}).expect(200);
 const embeddingModel=(await post('/platform/models',{providerId:provider.id,name:'fixture-embedding',capabilities:['embedding'],reason}).expect(200)).body;
 await post('/platform/grants',{workspaceId:me.workspaceId,modelId:embeddingModel.id,capability:'embedding',active:true,reason}).expect(200);
 let embeddingCalls=0;
 const embeddingInvoke=async(_adapter:string,name:string,_base:any,_key:string,text:string)=>{embeddingCalls++;assert.equal(text,'Warranty lasts 12 months.');return {model:name,vector:[1,0]};};
 const embeddingInput={workspace:me.workspaceId,versionId:item.draft_version_id,modelId:embeddingModel.id};
 assert.equal((await embedKnowledgeBatch(embeddingInput,async(...args)=>{
  await assert.rejects(embedKnowledgeBatch(embeddingInput,async()=>{throw new Error('duplicate provider call');}),{code:'EMBEDDING_BATCH_BUSY'});
  return embeddingInvoke(...args.slice(0,5) as [string,string,any,string,string]);
 })).stored,1);
 const semantic=await transaction(async db=>{await scope(db,me.workspaceId);return buildWidgetAiContext(db,me.workspaceId,'different wording',5,{embedding:[1,0],embeddingModel:embeddingModel.id});});
 assert.equal(semantic.sources[0].content,'Warranty lasts 12 months.');
 const queryContext=await retrieveEmbeddedContext({workspace:me.workspaceId,modelId:embeddingModel.id,message:'How long is coverage?'},async(_adapter,name,_base,_key,text)=>{
  assert.equal(text,'How long is coverage?');return {model:name,vector:[1,0]};
 });
 assert.equal(queryContext.sources[0].content,'Warranty lasts 12 months.');
 let queryCalls=0;
 await assert.rejects(retrieveEmbeddedContext({workspace:me.workspaceId,modelId:embeddingModel.id,message:'Coverage?'},async(_adapter,name)=>{
  queryCalls++;
  await post('/platform/grants',{workspaceId:me.workspaceId,modelId:embeddingModel.id,capability:'embedding',active:false,reason}).expect(200);
  return {model:name,vector:[1,0]};
 }),{code:'MODEL_NOT_GRANTED'});
 await assert.rejects(retrieveEmbeddedContext({workspace:me.workspaceId,modelId:embeddingModel.id,message:'Coverage?'},async()=>{queryCalls++;throw new Error('must not invoke');}),{code:'MODEL_NOT_GRANTED'});
 assert.equal(queryCalls,1);
 await post('/platform/grants',{workspaceId:me.workspaceId,modelId:embeddingModel.id,capability:'embedding',active:true,reason}).expect(200);

 const nameOnly=await transaction(async db=>{await scope(db,me.workspaceId);return buildWidgetAiContext(db,me.workspaceId,'different wording',5,{embedding:[1,0],embeddingModel:'fixture-embedding'});});
 assert.deepEqual(nameOnly.sources,[],'provider name alone must not select registry-scoped vectors');
 assert.equal((await embedKnowledgeBatch(embeddingInput,embeddingInvoke)).stored,0);assert.equal(embeddingCalls,1);
 await admin.query('UPDATE knowledge_chunks SET embedding=NULL WHERE workspace_id=$1 AND version_id=$2',[me.workspaceId,item.draft_version_id]);
 await assert.rejects(embedKnowledgeBatch(embeddingInput,async(...args)=>{
  await post('/platform/grants',{workspaceId:me.workspaceId,modelId:embeddingModel.id,capability:'embedding',active:false,reason}).expect(200);
  return embeddingInvoke(...args.slice(0,5) as [string,string,any,string,string]);
 }),{code:'MODEL_NOT_GRANTED'});
 assert.equal((await admin.query('SELECT embedding FROM knowledge_chunks WHERE workspace_id=$1 AND version_id=$2',[me.workspaceId,item.draft_version_id])).rows[0].embedding,null);
 await post('/platform/grants',{workspaceId:me.workspaceId,modelId:embeddingModel.id,capability:'embedding',active:true,reason}).expect(200);
 await embedKnowledgeBatch(embeddingInput,embeddingInvoke);
 assert.deepEqual((await transaction(async db=>{await scope(db,me.workspaceId);return buildWidgetAiContext(db,me.workspaceId,'How long is coverage?');})).sources,[]);
 const channel=(await post('/channels',{requestId:randomUUID(),name:'Grounded widget',origin:'https://grounded.test',greeting:'Hello',color:'#0057E1',agents:[me.user.id]}).expect(200)).body;
 const key=(await owner.get('/api/channels/'+channel.id+'/installation').expect(200)).body.publicKey;
 const base='/widget-api/'+key,origin='https://grounded.test';
 const session=(await request(app).post(base+'/session').set('Origin',origin).send({}).expect(200)).body;
 const c=session.conversationId;
 await post('/conversations/'+c+'/resume-ai',{version:session.ownerVersion}).expect(200);
 const widgetPost=(path:string,data:any)=>request(app).post(base+path).set('Origin',origin).set('Authorization','Bearer '+session.token).send(data);
 const question={clientId:randomUUID(),body:'How long is coverage?'};
 await widgetPost('/messages',question).expect(200);
 let calls=0,queryEmbeddingCalls=0;
 globalThis.fetch=async(_url:any,options:any)=>{if(String(_url).endsWith('/embeddings')){queryEmbeddingCalls++;assert.equal(JSON.parse(options.body).input,question.body);return new Response(JSON.stringify({data:[{embedding:[1,0]}]}));}assert.equal(queryEmbeddingCalls,1);calls++;const prompt=JSON.parse(options.body).messages[0].content;assert.ok(prompt.includes('Warranty lasts 12 months.'));assert.ok(!prompt.includes('fixture-only'));return new Response(JSON.stringify({choices:[{message:{content:'Warranty lasts 12 months. [1]'}}],usage:{prompt_tokens:40,completion_tokens:10,total_tokens:50}}));};
 assert.equal((await runAiWorkerOnce(me.workspaceId,defaultWorkspaceProviderInvoke())).state,'succeeded');
 await widgetPost('/messages',question).expect(200);
 assert.equal((await runAiWorkerOnce(me.workspaceId,defaultWorkspaceProviderInvoke())).state,'idle');
 assert.equal(calls,1);assert.equal(queryEmbeddingCalls,1);
 await post('/platform/grants',{workspaceId:me.workspaceId,modelId:embeddingModel.id,capability:'embedding',active:false,reason}).expect(200);
 await post('/conversations/'+c+'/takeover',{version:session.ownerVersion+1}).expect(200);
 await post('/conversations/'+c+'/messages',{clientId:randomUUID(),body:'Nhân viên tiếp tục hỗ trợ',visibility:'public'}).expect(200);
 const visible=(await request(app).get(base+'/messages').set('Origin',origin).set('Authorization','Bearer '+session.token).expect(200)).body;
 assert.deepEqual(visible.map((m:any)=>m.body),[question.body,'Warranty lasts 12 months. [1]','Nhân viên tiếp tục hỗ trợ']);
 await widgetPost('/messages',{clientId:randomUUID(),body:'Follow-up for human'}).expect(200);
 assert.equal((await runAiWorkerOnce(me.workspaceId,defaultWorkspaceProviderInvoke())).state,'idle');assert.equal(calls,1);
 // Human takeover during question embedding must prevent even the chat request.
 await post('/platform/grants',{workspaceId:me.workspaceId,modelId:embeddingModel.id,capability:'embedding',active:true,reason}).expect(200);
 const raceState=(await request(app).get(base+'/state').set('Origin',origin).set('Authorization','Bearer '+session.token).expect(200)).body;
 await post('/conversations/'+c+'/resume-ai',{version:raceState.ownerVersion}).expect(200);
 await widgetPost('/messages',{clientId:randomUUID(),body:question.body}).expect(200);
 let raceEmbeddings=0,raceChats=0;
 globalThis.fetch=async(url:any)=>{
  if(String(url).endsWith('/embeddings')){
   raceEmbeddings++;
   await post('/conversations/'+c+'/takeover',{version:raceState.ownerVersion+1}).expect(200);
   return new Response(JSON.stringify({data:[{embedding:[1,0]}]}));
  }
  raceChats++;throw new Error('chat must not run after takeover');
 };
 assert.equal((await runAiWorkerOnce(me.workspaceId,defaultWorkspaceProviderInvoke())).state,'dead');
 assert.equal((await runAiWorkerOnce(me.workspaceId,defaultWorkspaceProviderInvoke())).state,'idle');
 assert.equal(raceEmbeddings,1);assert.equal(raceChats,0);
 assert.equal((await request(app).get(base+'/state').set('Origin',origin).set('Authorization','Bearer '+session.token).expect(200)).body.replyOwner,'HUMAN_ACTIVE');
 await post('/platform/grants',{workspaceId:me.workspaceId,modelId:embeddingModel.id,capability:'embedding',active:false,reason}).expect(200);
 for(const failure of ['timeout','network','http','invalid','empty']){
  const current=(await request(app).get(base+'/state').set('Origin',origin).set('Authorization','Bearer '+session.token).expect(200)).body;
  await post('/conversations/'+c+'/resume-ai',{version:current.ownerVersion}).expect(200);
  await widgetPost('/messages',{clientId:randomUUID(),body:'Warranty'}).expect(200);
  let attempts=0;
  globalThis.fetch=async()=>{
   attempts++;
   if(failure==='timeout')throw new DOMException('fixture','TimeoutError');
   if(failure==='network')throw new Error('secret transport detail');
   if(failure==='http')return new Response('secret body',{status:503});
   if(failure==='invalid')return new Response('not json');
   return new Response(JSON.stringify({choices:[]}));
  };
  assert.equal((await runAiWorkerOnce(me.workspaceId,defaultWorkspaceProviderInvoke())).state,'succeeded');
  assert.equal((await runAiWorkerOnce(me.workspaceId,defaultWorkspaceProviderInvoke())).state,'idle');
  assert.equal(attempts,1);
  const failedState=(await request(app).get(base+'/state').set('Origin',origin).set('Authorization','Bearer '+session.token).expect(200)).body;
  assert.equal(failedState.replyOwner,'HANDOFF_PENDING');
  const history=(await request(app).get(base+'/messages').set('Origin',origin).set('Authorization','Bearer '+session.token).expect(200)).body;
  assert.match(history.at(-1).body,/đang chờ nhân viên hỗ trợ/);
  assert.ok(!history.at(-1).body.includes('secret'));
 }
 const beforeRace=(await request(app).get(base+'/state').set('Origin',origin).set('Authorization','Bearer '+session.token).expect(200)).body;
 await post('/conversations/'+c+'/resume-ai',{version:beforeRace.ownerVersion}).expect(200);
 await widgetPost('/messages',{clientId:randomUUID(),body:'Warranty'}).expect(200);
 const beforeCount=(await admin.query('SELECT count(*) FROM messages WHERE conversation_id=$1',[c])).rows[0].count;
 globalThis.fetch=async()=>{
  await post('/conversations/'+c+'/takeover',{version:beforeRace.ownerVersion+1}).expect(200);
  throw new DOMException('fixture timeout after takeover','TimeoutError');
 };
 assert.equal((await runAiWorkerOnce(me.workspaceId,defaultWorkspaceProviderInvoke())).state,'dead');
 assert.equal((await runAiWorkerOnce(me.workspaceId,defaultWorkspaceProviderInvoke())).state,'idle');
 assert.equal((await admin.query('SELECT count(*) FROM messages WHERE conversation_id=$1',[c])).rows[0].count,beforeCount);
 const afterRace=(await request(app).get(base+'/state').set('Origin',origin).set('Authorization','Bearer '+session.token).expect(200)).body;
 assert.equal(afterRace.replyOwner,'HUMAN_ACTIVE');
 assert.equal(afterRace.ownerVersion,beforeRace.ownerVersion+2);
 const state=(await request(app).get(base+'/state').set('Origin',origin).set('Authorization','Bearer '+session.token).expect(200)).body;
 await post('/conversations/'+c+'/resume-ai',{version:state.ownerVersion}).expect(200);
 await widgetPost('/messages',{clientId:randomUUID(),body:'Warranty'}).expect(200);
 globalThis.fetch=async()=>{
  calls++;
  await post('/platform/grants',{workspaceId:me.workspaceId,modelId:model.id,capability:'chat',active:false,reason}).expect(200);
  return new Response(JSON.stringify({choices:[{message:{content:'Revoked model output must not appear'}}]}));
 };
 assert.equal((await runAiWorkerOnce(me.workspaceId,defaultWorkspaceProviderInvoke())).state,'succeeded');
 const revokedState=(await request(app).get(base+'/state').set('Origin',origin).set('Authorization','Bearer '+session.token).expect(200)).body;
 assert.equal(revokedState.replyOwner,'HANDOFF_PENDING');
 const afterRevoke=(await request(app).get(base+'/messages').set('Origin',origin).set('Authorization','Bearer '+session.token).expect(200)).body;
 assert.ok(!afterRevoke.some((m:any)=>m.body==='Revoked model output must not appear'));
 assert.match(afterRevoke.at(-1).body,/đang chờ nhân viên hỗ trợ/);
 await post('/platform/grants',{workspaceId:me.workspaceId,modelId:model.id,capability:'chat',active:true,reason}).expect(200);
 await post('/conversations/'+c+'/resume-ai',{version:revokedState.ownerVersion}).expect(200);
 await widgetPost('/messages',{clientId:randomUUID(),body:'Warranty'}).expect(200);
 globalThis.fetch=async()=>{
  await owner.patch('/api/platform/workspaces/'+me.workspaceId+'/state').set('X-Gotek-Request','1').send({status:'disabled',reason}).expect(200);
  return new Response(JSON.stringify({choices:[{message:{content:'Disabled tenant answer'}}]}));
 };
 assert.equal((await runAiWorkerOnce(me.workspaceId,defaultWorkspaceProviderInvoke())).state,'unknown');
 assert.equal((await admin.query("SELECT id FROM messages WHERE workspace_id=$1 AND body='Disabled tenant answer'",[me.workspaceId])).rowCount,0);
 assert.equal((await runAiWorkerOnce(me.workspaceId,defaultWorkspaceProviderInvoke())).state,'workspace_disabled');

});
