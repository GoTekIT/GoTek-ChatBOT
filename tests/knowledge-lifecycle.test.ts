import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {pool,transaction,scope} from '../src/server/db';
import {createKnowledge,getKnowledge,updateKnowledge} from '../src/server/knowledge';
import {processKnowledge,publishKnowledge,rollbackKnowledge} from '../src/server/knowledge-lifecycle';
import request from 'supertest';
import {createApp} from '../src/server/app';

test('H10 lifecycle: deterministic process, publish CAS, audience, tenant and role guards',async t=>{
 t.after(()=>pool.end());
 const app=createApp();
 async function owner(){const a=request.agent(app),email=`lifecycle-${randomUUID()}@example.test`,password='Local-lifecycle-2026';await a.post('/api/auth/signup').set('X-Gotek-Request','1').send({email,password,fullName:'Lifecycle test',business:'Lifecycle local',phone:'0900000000'}).expect(202);await a.post('/api/auth/login').set('X-Gotek-Request','1').send({email,password}).expect(200);const me=(await a.get('/api/me').expect(200)).body;return {agent:a,actor:{user_id:me.user.id,workspace_id:me.workspaceId,role:'Owner'}};}
 const first=await owner(), second=await owner();
 const run=(fn:any,a:any)=>transaction(async db=>{await scope(db,a.workspace_id);return fn(db,a);});
 const created:any=await run((db:any,a:any)=>createKnowledge(db,a,{requestId:randomUUID(),title:'Lifecycle',content:'Nội dung'}),first.actor);
 const processRequestId=randomUUID();
 const processed:any=await run((db:any,a:any)=>processKnowledge(db,a,created.id,{requestId:processRequestId,expectedRevision:created.revision,versionId:created.draft_version_id}),first.actor);
 assert.equal(processed.state,'READY');assert.equal(processed.revision,2);
 const replay:any=await run((db:any,a:any)=>processKnowledge(db,a,created.id,{requestId:processRequestId,expectedRevision:created.revision,versionId:created.draft_version_id}),first.actor);
 assert.equal(replay.state,'READY');
 const chunks:any=await run((db:any)=>db.query('SELECT * FROM knowledge_chunks WHERE version_id=$1 ORDER BY chunk_index',[created.draft_version_id]),first.actor);
 assert.equal(chunks.rows.length,1);assert.equal(chunks.rows[0].content,'Nội dung');
 assert.equal(chunks.rows[0].content_hash,createHash('sha256').update('Nội dung').digest('hex'));
 const foreign:any=await run((db:any)=>db.query('SELECT * FROM knowledge_chunks WHERE version_id=$1',[created.draft_version_id]),second.actor);
 assert.equal(foreign.rows.length,0);
 await assert.rejects(run((db:any,a:any)=>db.query("INSERT INTO knowledge_chunks(workspace_id,version_id,chunk_index,content,token_estimate,content_hash) VALUES($1,$2,0,'Forged',2,'fake')",[a.workspace_id,created.draft_version_id]),second.actor),(e:any)=>e.code==='23503');

 const published:any=await run((db:any,a:any)=>publishKnowledge(db,a,created.id,{requestId:randomUUID(),expectedRevision:2,versionId:created.draft_version_id,audience:'PUBLIC'}),first.actor);
 assert.equal(published.audience,'PUBLIC');assert.equal(published.revision,3);
 await assert.rejects(run((db:any,a:any)=>publishKnowledge(db,a,created.id,{requestId:randomUUID(),expectedRevision:2,versionId:created.draft_version_id,audience:'INTERNAL'}),first.actor),(e:any)=>e.code==='VERSION_CONFLICT');
 await assert.rejects(run((db:any,a:any)=>processKnowledge(db,a,created.id,{requestId:randomUUID(),expectedRevision:3,versionId:created.draft_version_id}),second.actor),(e:any)=>e.code==='NOT_FOUND');
 await assert.rejects(run((db:any,a:any)=>processKnowledge(db,{...a,role:'Agent'},created.id,{requestId:randomUUID(),expectedRevision:3,versionId:created.draft_version_id}),first.actor),(e:any)=>e.code==='FORBIDDEN');
 const edited:any=await run((db:any,a:any)=>updateKnowledge(db,a,created.id,{requestId:randomUUID(),expectedRevision:3,title:'Lifecycle v2',content:'Nội dung mới'}),first.actor);
 const detail:any=await run((db:any,a:any)=>getKnowledge(db,a,created.id),first.actor);
 assert.equal(detail.id,created.id);assert.equal(detail.versions.length,2);assert.equal(detail.versions[0].id,edited.draft_version_id);
 const rollbackRequest=randomUUID();
 const rolled:any=await run((db:any,a:any)=>rollbackKnowledge(db,a,created.id,{requestId:rollbackRequest,expectedRevision:edited.revision,versionId:created.draft_version_id}),first.actor);
 assert.equal(rolled.draft_version_id,created.draft_version_id);assert.equal(rolled.revision,edited.revision+1);
 const replayedRollback:any=await run((db:any,a:any)=>rollbackKnowledge(db,a,created.id,{requestId:rollbackRequest,expectedRevision:edited.revision,versionId:created.draft_version_id}),first.actor);
 assert.equal(replayedRollback.id,rolled.id);assert.equal(replayedRollback.draft_version_id,rolled.draft_version_id);assert.equal(replayedRollback.revision,rolled.revision);
 await assert.rejects(run((db:any,a:any)=>rollbackKnowledge(db,a,created.id,{requestId:randomUUID(),expectedRevision:rolled.revision,versionId:edited.draft_version_id}),second.actor),(e:any)=>e.code==='NOT_FOUND');
 await assert.rejects(run((db:any,a:any)=>rollbackKnowledge(db,{...a,role:'Agent'},created.id,{requestId:randomUUID(),expectedRevision:rolled.revision,versionId:edited.draft_version_id}),first.actor),(e:any)=>e.code==='FORBIDDEN');
});
