import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {createApp} from '../src/app';
import {pool} from '../src/core/db';
import {realtimeHub} from '../src/modules/chat/realtime';

// HTTP contract test; database transport is mocked, not tenant-RLS acceptance.
test('worker refresh authenticates, validates mapping and publishes only after commit',async t=>{
 const workspace='11111111-1111-4111-8111-111111111111';
 const connection='22222222-2222-4222-8222-222222222222';
 const oldSecret=process.env.META_REALTIME_INTERNAL_SECRET;
 process.env.META_REALTIME_INTERNAL_SECRET='local-test-only';
 const queries:{sql:string,args?:unknown[]}[]=[];
 let mapped=true;
 const broadcasts:unknown[][]=[];
 t.mock.method(pool,'connect',async()=>({query:async(sql:string,args?:unknown[])=>{
  queries.push({sql,args});return {rows:sql.startsWith('SELECT channel_id')&&mapped?[{channel_id:'allowed-channel'}]:[]};
 },release:()=>{}}));
 t.mock.method(realtimeHub,'broadcastToWorkspace',(...args:unknown[])=>{
  assert.equal(queries.at(-1)?.sql,'COMMIT');broadcasts.push(args);
 });
 try {
  const app=createApp();
  await request(app).post('/internal/meta/realtime').send({workspaceId:workspace,connectionId:connection}).expect(404);
  assert.equal(queries.length,0);
  for(const body of [{},{workspaceId:[],connectionId:connection},{workspaceId:workspace,connectionId:'invalid'}]){
   await request(app).post('/internal/meta/realtime').set('x-gotek-worker-secret','local-test-only').send(body).expect(400);
  }
  assert.equal(queries.length,0);
  mapped=false;
  await request(app).post('/internal/meta/realtime').set('x-gotek-worker-secret','local-test-only').send({workspaceId:workspace,connectionId:connection}).expect(404);
  assert.equal(broadcasts.length,0);
  queries.length=0;mapped=true;
  await request(app).post('/internal/meta/realtime').set('x-gotek-worker-secret','local-test-only').send({workspaceId:workspace,connectionId:connection}).expect(204);
  assert.deepEqual(queries[1],{sql:"SELECT set_config('app.workspace_id', $1, true)",args:[workspace]});
  assert.deepEqual(queries[2].args,[workspace,connection]);
  assert.equal(broadcasts.length,1);
  assert.equal(broadcasts[0][0],workspace);
  assert.deepEqual(broadcasts[0][3],{channelId:'allowed-channel'});
 }finally{
  if(oldSecret===undefined)delete process.env.META_REALTIME_INTERNAL_SECRET;
  else process.env.META_REALTIME_INTERNAL_SECRET=oldSecret;
 }
});
