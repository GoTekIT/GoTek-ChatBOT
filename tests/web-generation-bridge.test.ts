import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server/app';
import {pool,scope,transaction} from '../src/server/db';
import {runWebRefreshOnce} from '../src/server/web-refresh-worker';

test('HTTP web generation preserves every imported part and retires removed parts on refresh',async(t)=>{
 t.after(async()=>{await pool.end();});
 const agent=request.agent(createApp()),email=`bridge-${randomUUID()}@example.test`,password='Local-bridge-test-2026';
 await agent.post('/api/auth/signup').set('X-Gotek-Request','1').send({email,password,fullName:'Bridge tester',business:'Bridge company',phone:'0900000000'}).expect(202);
 await agent.post('/api/auth/login').set('X-Gotek-Request','1').send({email,password}).expect(200);
 const ws=(await agent.get('/api/me').expect(200)).body.workspaceId;
 const source=(await agent.post('/api/web-sources').set('X-Gotek-Request','1').send({name:'Multipart guide',url:'https://example.com/guide',type:'URL'}).expect(200)).body.id;
 const query=async(sql:string,args:unknown[]=[])=>transaction(async db=>{await scope(db,ws);return (await db.query(sql,args)).rows;});
 async function refresh(text:string){
  const job=(await agent.post(`/api/web-sources/${source}/refresh`).set('X-Gotek-Request','1').send({requestId:randomUUID()}).expect(200)).body.jobId;
  await runWebRefreshOnce(ws,async()=>({url:'https://example.com/guide',status:200,contentType:'text/html',body:Buffer.from(`<html><body><p>${text}</p></body></html>`)}));
  const history=(await agent.get(`/api/web-sources/${source}/snapshots`).expect(200)).body;
  const snapshot=history.find((s:any)=>s.job_id===job);assert.ok(snapshot,'worker persisted the requested snapshot');return snapshot.id;
 }
 async function stage(snapshot:string){return (await agent.post(`/api/web-sources/${source}/snapshots/${snapshot}/generation-draft`).set('X-Gotek-Request','1').send({requestId:randomUUID(),itemIndex:0,title:'Guide'}).expect(200)).body;}
 const parts=(id:string)=>query('SELECT part_index,action,knowledge_item_id,version_id FROM web_source_generation_parts WHERE workspace_id=$1 AND generation_id=$2 ORDER BY part_index',[ws,id]);
 async function processParts(manifest:any[]){for(const part of manifest.filter(p=>p.action==='UPSERT')){
  const [item]=await query('SELECT revision FROM knowledge_items WHERE workspace_id=$1 AND id=$2',[ws,part.knowledge_item_id]);
  await agent.post(`/api/knowledge/items/${part.knowledge_item_id}/process`).set('X-Gotek-Request','1').send({requestId:randomUUID(),expectedRevision:item.revision,versionId:part.version_id}).expect(200);
 }}
 async function publish(id:string,parent:string|null){await agent.post(`/api/web-sources/generations/${id}/publish`).set('X-Gotek-Request','1').send({requestId:randomUUID(),expectedParentId:parent}).expect(200);}
 const content='Warranty coverage and support requirements. '.repeat(130);
 const firstSnapshot=await refresh(content),first=await stage(firstSnapshot),firstParts=await parts(first.generationId);
 const imported=await query('SELECT part_index,knowledge_item_id,draft_version_id FROM web_snapshot_knowledge WHERE workspace_id=$1 AND snapshot_id=$2 ORDER BY part_index',[ws,firstSnapshot]);
 assert.ok(imported.length>=3,'fixture exercises more than one 2000-character imported part');
 assert.deepEqual(firstParts,imported.map(p=>({part_index:p.part_index,action:'UPSERT',knowledge_item_id:p.knowledge_item_id,version_id:p.draft_version_id})));
 await processParts(firstParts);await publish(first.generationId,null);
 const shortSnapshot=await refresh('Updated warranty lasts twelve months.'),second=await stage(shortSnapshot),secondParts=await parts(second.generationId);
 assert.equal(second.groupId,first.groupId);
 assert.equal(secondParts.length,firstParts.length);
 assert.equal(secondParts[0].action,'UPSERT');
 assert.ok(secondParts.slice(1).every(p=>p.action==='RETIRE'&&p.knowledge_item_id===null&&p.version_id===null));
 await processParts(secondParts);await publish(second.generationId,first.generationId);
 const prior=await query('SELECT active FROM knowledge_items WHERE workspace_id=$1 AND id=ANY($2::uuid[])',[ws,firstParts.map(p=>p.knowledge_item_id)]);
 assert.equal(prior.length,firstParts.length);assert.ok(prior.every(p=>p.active===false),'superseded knowledge cannot remain active');
 const [current]=await query('SELECT active,published_version_id FROM knowledge_items WHERE workspace_id=$1 AND id=$2',[ws,secondParts[0].knowledge_item_id]);
 assert.equal(current.active,true);assert.equal(current.published_version_id,secondParts[0].version_id);
});
