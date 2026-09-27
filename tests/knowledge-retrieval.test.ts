import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {createApp} from '../src/server/app';
import {pool,transaction,scope} from '../src/server/db';
import {buildWidgetAiContext,assertWidgetSourcesCurrent} from '../src/server/knowledge-retrieval';
import {storeKnowledgeEmbedding} from '../src/server/knowledge-chunk-store';

test('knowledge retrieval uses active published versions with audience, tenant and role isolation',async t=>{
 t.after(()=>pool.end());
 const app=createApp();
 async function fixture(){
  const agent=request.agent(app),email=`retrieval-${randomUUID()}@example.test`,password='Local-retrieval-test-2026';
  await agent.post('/api/auth/signup').set('X-Gotek-Request','1').send({email,password,fullName:'Retrieval tester',business:'Retrieval test',phone:'0900000000'}).expect(202);
  await agent.post('/api/auth/login').set('X-Gotek-Request','1').send({email,password}).expect(200);
  return {agent,me:(await agent.get('/api/me').expect(200)).body};
 }
 const a=await fixture(),b=await fixture();
 const post=(path:string,body:object)=>a.agent.post(path).set('X-Gotek-Request','1').send(body);
 const retrieve=(audience='PUBLIC')=>a.agent.get('/api/knowledge/retrieve').query({query:'retrievalmarker',audience});
 const draft=(await post('/api/knowledge/items',{requestId:randomUUID(),title:'retrievalmarker public',content:'Published content'}).expect(200)).body;
 assert.deepEqual((await retrieve().expect(200)).body.items,[],'draft must not enter retrieval');
 async function publish(item:any,audience:string){
  const ready=(await post(`/api/knowledge/items/${item.id}/process`,{requestId:randomUUID(),expectedRevision:item.revision,versionId:item.draft_version_id}).expect(200)).body;
  assert.deepEqual((await retrieve().expect(200)).body.items,[],'processed unpublished version must remain excluded');
  return (await post(`/api/knowledge/items/${item.id}/publish`,{requestId:randomUUID(),expectedRevision:ready.revision,versionId:item.draft_version_id,audience}).expect(200)).body;
 }
 const published=await publish(draft,'PUBLIC');
 const embeddingInput=await transaction(async db=>{await scope(db,a.me.workspaceId);const chunk=(await db.query('SELECT content_hash FROM knowledge_chunks WHERE workspace_id=$1 AND version_id=$2 AND chunk_index=0',[a.me.workspaceId,draft.draft_version_id])).rows[0];return {versionId:draft.draft_version_id,chunkIndex:0,contentHash:chunk.content_hash,model:'fixture-model-v1',vector:[1,0]};});
 await transaction(async db=>{await scope(db,a.me.workspaceId);await storeKnowledgeEmbedding(db,a.me.workspaceId,embeddingInput);});
 const semantic=await transaction(async db=>{await scope(db,a.me.workspaceId);return buildWidgetAiContext(db,a.me.workspaceId,'different phrasing',5,{embedding:[1,0],embeddingModel:'fixture-model-v1'});});
 assert.equal(semantic.sources[0].content,'Published content');
 const otherModel=await transaction(async db=>{await scope(db,a.me.workspaceId);return buildWidgetAiContext(db,a.me.workspaceId,'different phrasing',5,{embedding:[1,0],embeddingModel:'another-model'});});
 assert.deepEqual(otherModel.sources,[]);
 await assert.rejects(transaction(async db=>{await scope(db,a.me.workspaceId);return storeKnowledgeEmbedding(db,a.me.workspaceId,{...embeddingInput,contentHash:'0'.repeat(64)});}),{code:'EMBEDDING_SOURCE_CHANGED'});
 await assert.rejects(transaction(async db=>{await scope(db,b.me.workspaceId);return storeKnowledgeEmbedding(db,b.me.workspaceId,embeddingInput);}),{code:'EMBEDDING_SOURCE_CHANGED'});
 const foreignSemantic=await transaction(async db=>{await scope(db,b.me.workspaceId);return buildWidgetAiContext(db,b.me.workspaceId,'different phrasing',5,{embedding:[1,0],embeddingModel:'fixture-model-v1'});});
 assert.deepEqual(foreignSemantic.sources,[]);
 const natural=await transaction(async db=>{await scope(db,a.me.workspaceId);return buildWidgetAiContext(db,a.me.workspaceId,'Cho tôi hỏi retrievalmarker được không?');});
 assert.equal(natural.sources.length,1,'natural question must retrieve matching published chunk without exact phrase');
 assert.equal(natural.sources[0].content,'Published content');
 const foreign=await transaction(async db=>{await scope(db,b.me.workspaceId);return buildWidgetAiContext(db,b.me.workspaceId,'retrievalmarker');});
 assert.deepEqual(foreign.sources,[]);

 const results=(await retrieve().expect(200)).body.items;
 assert.equal(results.length,1);
 assert.deepEqual((await a.agent.get('/api/knowledge/retrieve').query({query:'%',audience:'PUBLIC'}).expect(200)).body.items,[],'percent is literal text, not a wildcard');
 assert.equal(results[0].knowledgeItemId,draft.id);
 assert.equal(results[0].versionId,draft.draft_version_id);
 assert.equal(results[0].content,'Published content');
 assert.deepEqual(results[0].citation,{source:'knowledge',title:draft.title,versionId:draft.draft_version_id,audience:'PUBLIC'});
 const widgetContext=await transaction(async db=>{await scope(db,a.me.workspaceId);return buildWidgetAiContext(db,a.me.workspaceId,'retrievalmarker');});
 assert.equal(widgetContext.sources.length,1);
 assert.equal(widgetContext.sources[0].content,'Published content');
 assert.equal((widgetContext as any).workspaceId,undefined,'tenant identifiers must not enter provider context');
 assert.deepEqual((await b.agent.get('/api/knowledge/retrieve').query({query:'retrievalmarker',audience:'PUBLIC'}).expect(200)).body.items,[]);
 const edited=(await a.agent.patch(`/api/knowledge/items/${draft.id}/draft`).set('X-Gotek-Request','1').send({requestId:randomUUID(),expectedRevision:published.revision,title:'retrievalmarker revised',content:'Unpublished replacement'}).expect(200)).body;
 assert.notEqual(edited.draft_version_id,draft.draft_version_id);
 assert.equal((await retrieve().expect(200)).body.items[0].content,'Published content','draft edit must preserve published content');
 // Ranking must use question terms, not the PUBLIC audience parameter.
 for(const [title,content] of [['Ranking low','rankingmarker PUBLIC PUBLIC PUBLIC PUBLIC'],['Ranking high','rankingmarker rankingmarker rankingmarker rankingmarker']]){
  const entry=(await post('/api/knowledge/items',{requestId:randomUUID(),title,content}).expect(200)).body;
  const processed=(await post(`/api/knowledge/items/${entry.id}/process`,{requestId:randomUUID(),expectedRevision:entry.revision,versionId:entry.draft_version_id}).expect(200)).body;
  await post(`/api/knowledge/items/${entry.id}/publish`,{requestId:randomUUID(),expectedRevision:processed.revision,versionId:entry.draft_version_id,audience:'PUBLIC'}).expect(200);
 }
 const ranked=await transaction(async db=>{await scope(db,a.me.workspaceId);return buildWidgetAiContext(db,a.me.workspaceId,'rankingmarker',1);});
 assert.equal(ranked.sources[0].title,'Ranking high','top source must match question relevance rather than audience word frequency');
 // Simulate corruption through the permitted delete/insert pipeline, in a rolled-back transaction.
 await assert.rejects(transaction(async db=>{
  await scope(db,a.me.workspaceId);
  const version=ranked.sources[0].citation.versionId;
  await db.query('DELETE FROM knowledge_chunks WHERE workspace_id=$1 AND version_id=$2',[a.me.workspaceId,version]);
  await db.query("INSERT INTO knowledge_chunks(workspace_id,version_id,chunk_index,content,token_estimate,content_hash) VALUES($1,$2,0,$3,20,'wrong')",[a.me.workspaceId,version,'rankingmarker '.repeat(30)]);
  const valid=await buildWidgetAiContext(db,a.me.workspaceId,'rankingmarker',1);
  assert.equal(valid.sources.length,1,'corrupt top candidate must not consume the result limit');
  assert.equal(valid.sources[0].title,'Ranking low');
  throw new Error('ROLLBACK_CORRUPTION_FIXTURE');
 }),/ROLLBACK_CORRUPTION_FIXTURE/);

 const internal=(await post('/api/knowledge/items',{requestId:randomUUID(),title:'retrievalmarker internal',content:'Private content'}).expect(200)).body;
 const ready=(await post(`/api/knowledge/items/${internal.id}/process`,{requestId:randomUUID(),expectedRevision:internal.revision,versionId:internal.draft_version_id}).expect(200)).body;
 await post(`/api/knowledge/items/${internal.id}/publish`,{requestId:randomUUID(),expectedRevision:ready.revision,versionId:internal.draft_version_id,audience:'INTERNAL'}).expect(200);
 assert.deepEqual((await retrieve().expect(200)).body.items.map((x:any)=>x.knowledgeItemId),[draft.id]);
 assert.deepEqual((await retrieve('INTERNAL').expect(200)).body.items.map((x:any)=>x.knowledgeItemId),[internal.id]);
 const publicOnly=await transaction(async db=>{await scope(db,a.me.workspaceId);return buildWidgetAiContext(db,a.me.workspaceId,'Private content');});
 assert.deepEqual(publicOnly.sources,[],'widget context must exclude INTERNAL knowledge');
 await transaction(async db=>{await scope(db,a.me.workspaceId);await assertWidgetSourcesCurrent(db,a.me.workspaceId,[draft.draft_version_id,draft.draft_version_id]);});
 await assert.rejects(transaction(async db=>{await scope(db,b.me.workspaceId);await assertWidgetSourcesCurrent(db,b.me.workspaceId,[draft.draft_version_id]);}),{code:'AI_KNOWLEDGE_REVOKED'});
 await assert.rejects(transaction(async db=>{await scope(db,a.me.workspaceId);await assertWidgetSourcesCurrent(db,a.me.workspaceId,[internal.draft_version_id]);}),{code:'AI_KNOWLEDGE_REVOKED'});
 await transaction(async db=>{await scope(db,a.me.workspaceId);await db.query('UPDATE knowledge_items SET active=false WHERE workspace_id=$1 AND id=$2',[a.me.workspaceId,draft.id]);});
 assert.deepEqual((await retrieve().expect(200)).body.items,[],'inactive published source must be excluded');
 await assert.rejects(transaction(async db=>{await scope(db,a.me.workspaceId);await assertWidgetSourcesCurrent(db,a.me.workspaceId,[draft.draft_version_id]);}),{code:'AI_KNOWLEDGE_REVOKED'});
 await transaction(async db=>{await scope(db,a.me.workspaceId);await db.query("UPDATE memberships SET role='Agent' WHERE workspace_id=$1 AND user_id=$2",[a.me.workspaceId,a.me.user.id]);});
 await retrieve().expect(403);
 await retrieve('INTERNAL').expect(403);
 await request(app).get('/api/knowledge/retrieve').query({query:'retrievalmarker'}).expect(401);
});

test('semantic retrieval contract ranks only dimension-matched, integrity-ready embeddings', async()=>{
 const {rankEmbeddedKnowledge,cosineSimilarity}=await import('../src/server/knowledge-retrieval');
 assert.equal(cosineSimilarity([1,0],[1,0]),1);
 assert.equal(cosineSimilarity([1],[1,0]),0);
 const rows=rankEmbeddedKnowledge([
  {item_id:'b',embedding:[0,1],content:'B'},
  {item_id:'a',embedding:[1,0],content:'A'},
  {item_id:'bad',embedding:[1,0,0],content:'bad'},
  {item_id:'malformed',embedding:[1,'invalid',0]},
  {item_id:'zero',embedding:[0,0]},
 ],[1,0],5);
 assert.deepEqual(rows.map((row:any)=>row.item_id),['a','b']);
 assert.equal(rows[0].semanticScore,1);
});

test('semantic context path uses persisted public embeddings and remains bounded', async()=>{
 const calls:any[]=[];
 const db={query:async(sql:string,params:any[])=>{calls.push({sql,params});return {rows:[
  {item_id:'1',published_version_id:'v1',title:'Policy',content:'A'.repeat(5000),content_hash:'ok',chunk_index:0,embedding:[1,0],embedded_at:new Date(),audience:'PUBLIC'},
  {item_id:'2',published_version_id:'v2',title:'Other',content:'B',content_hash:'ok',chunk_index:0,embedding:[0,1],embedded_at:new Date(),audience:'PUBLIC'},
 ]}}};
 const {buildWidgetAiContext}=await import('../src/server/knowledge-retrieval');
 const result=await buildWidgetAiContext(db as any,'00000000-0000-0000-0000-000000000001','question',5,{embedding:[1,0],embeddingModel:'test-model-v1'});
 assert.equal(result.sources.length,2);
 assert.equal(result.sources[0].title,'Policy');
 assert.equal(result.sources[0].content.length,4000);
 assert.equal(result.sources[0].truncated,true);
 assert.match(calls[0].sql,/c\.embedded_at IS NOT NULL/);
 assert.match(calls[0].sql,/c\.embedding_model=\$2 AND c\.embedding_dimensions=\$3/);
 assert.deepEqual(calls[0].params,['00000000-0000-0000-0000-000000000001','test-model-v1',2]);
 await assert.rejects(buildWidgetAiContext(db as any,'tenant','question',5,{embedding:[1,0]}));
 await assert.rejects(buildWidgetAiContext(db as any,'tenant','question',5,{embedding:[0,0],embeddingModel:'test'}));
});
