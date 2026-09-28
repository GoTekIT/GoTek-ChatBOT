import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/app';
import {pool} from '../src/core/db';

after(async()=>{await pool.end();});

test('H02 workspace resources stay tenant-bound and cross-tenant switch is denied',async()=>{
 const app=createApp();
 async function owner(label:string){
  const agent=request.agent(app), email=`h02-${label}-${randomUUID()}@example.test`, password='Local-h02-test-2026';
  await agent.post('/api/auth/signup').set('X-Gotek-Request','1').send({email,password,fullName:`H02 ${label}`,business:`H02 ${label} workspace`,phone:'0900000000'}).expect(202);
  await agent.post('/api/auth/login').set('X-Gotek-Request','1').send({email,password}).expect(200);
  return {agent,me:(await agent.get('/api/me').expect(200)).body};
 }
 const a=await owner('a'), b=await owner('b');
 assert.notEqual(a.me.workspaceId,b.me.workspaceId);
 assert.equal((await a.agent.get('/api/workspace').expect(200)).body.id,a.me.workspaceId);
 assert.equal((await b.agent.get('/api/workspace').expect(200)).body.id,b.me.workspaceId);
 await a.agent.post('/api/workspace/switch').set('X-Gotek-Request','1').send({workspaceId:b.me.workspaceId}).expect(403);
 assert.equal((await a.agent.get('/api/workspace').expect(200)).body.id,a.me.workspaceId);
 await a.agent.get('/api/members').expect(200).expect(res=>assert.equal(res.body.some((m:any)=>m.email===b.me.user.email),false));
 await a.agent.patch('/api/workspace').set('X-Gotek-Request','1').send({name:'A renamed',language:'vi'}).expect(200);
 assert.equal((await b.agent.get('/api/workspace').expect(200)).body.name,'H02 b workspace');
});
