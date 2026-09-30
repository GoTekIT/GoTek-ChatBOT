import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/app';
import {pool,transaction,scope} from '../src/core/db';
after(()=>pool.end());
test('knowledge archive preserves history, fences revisions and denies Agent/foreign workspace',async()=>{
  const app=createApp(),header={'X-Gotek-Request':'1'};
  async function account(){const agent=request.agent(app);const email=`archive-${randomUUID()}@example.test`;
    await agent.post('/api/auth/signup').set(header).send({email,password:'Archive-test-only-2026',fullName:'Archive fixture',business:'Archive fixture',phone:'0900000000'}).expect(202);
    await agent.post('/api/auth/login').set(header).send({email,password:'Archive-test-only-2026'}).expect(200);
    return {agent,me:(await agent.get('/api/me')).body};}
  const a=await account(),b=await account();
  const item=(await a.agent.post('/api/knowledge/items').set(header).send({requestId:randomUUID(),title:'Archive me',content:'Retain historical source'}).expect(200)).body;
  const path=`/api/knowledge/items/${item.id}/archive`;
  await b.agent.post(path).set(header).send({requestId:randomUUID(),expectedRevision:item.revision}).expect(404);
  await a.agent.post(path).set(header).send({requestId:randomUUID(),expectedRevision:item.revision+1}).expect(409);
  const payload={requestId:randomUUID(),expectedRevision:item.revision};
  const archived=(await a.agent.post(path).set(header).send(payload).expect(200)).body;
  assert.equal(archived.active,false);
  assert.deepEqual((await a.agent.post(path).set(header).send(payload).expect(200)).body,archived);
  await a.agent.post(path).set(header).send({...payload,expectedRevision:item.revision+1}).expect(409);
  assert.equal((await a.agent.get('/api/knowledge/items?active=true').expect(200)).body.items.length,0);
  const retained=(await a.agent.get(`/api/knowledge/items/${item.id}`).expect(200)).body;
  assert.equal(retained.versions[0].content,'Retain historical source');
  await transaction(async db=>{await scope(db,a.me.workspaceId);await db.query("UPDATE memberships SET role='Agent' WHERE workspace_id=$1 AND user_id=$2",[a.me.workspaceId,a.me.user.id]);});
  await a.agent.post(path).set(header).send({requestId:randomUUID(),expectedRevision:archived.revision}).expect(403);
});
