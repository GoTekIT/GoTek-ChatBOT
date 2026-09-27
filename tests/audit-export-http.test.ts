import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {createApp} from '../src/server/app';
import {pool,scope,transaction} from '../src/server/db';

test('H22 audit export HTTP envelope paginates and enforces session, role and tenant',async(t)=>{
 t.after(async()=>{await pool.end();});
 const app=createApp();
 async function owner(){
  const agent=request.agent(app),email=`audit-http-${randomUUID()}@example.test`,password='Local-audit-export-2026';
  await agent.post('/api/auth/signup').set('X-Gotek-Request','1').send({email,password,fullName:'Audit tester',business:'Audit fixture',phone:'0900000000'}).expect(202);
  await agent.post('/api/auth/login').set('X-Gotek-Request','1').send({email,password}).expect(200);
  return {agent,me:(await agent.get('/api/me').expect(200)).body};
 }
 const a=await owner(),b=await owner();
 const ids=[randomUUID(),randomUUID(),randomUUID()],foreign=randomUUID();
 async function seed(workspace:string,eventIds:string[]){
  await transaction(async db=>{
   await scope(db,workspace);
   for(let i=0;i<eventIds.length;i++)await db.query(
    "INSERT INTO audit_events(id,workspace_id,action,object_id,created_at) VALUES($1,$2,'audit.http_fixture',$3,'2099-01-01'::timestamptz-($4::int*interval '1 second'))",
    [eventIds[i],workspace,`fixture-${i}`,i]);
  });
 }
 await seed(a.me.workspaceId,ids);await seed(b.me.workspaceId,[foreign]);
 const first=await a.agent.get('/api/audit/export?limit=2').expect(200).expect('Content-Type',/application\/json/);
 assert.equal(first.body.contentType,'application/x-ndjson; charset=utf-8');
 assert.equal(first.body.count,2);assert.equal(first.body.nextCursor,ids[1]);
 assert.ok(first.body.body.endsWith('\n'));
 const rows=first.body.body.trimEnd().split('\n').map((line:string)=>JSON.parse(line));
 assert.deepEqual(rows.map((row:any)=>row.id),ids.slice(0,2));
 assert.equal(rows[0].action,'audit.http_fixture');assert.equal(rows[0].workspace_id,undefined);
 const second=await a.agent.get(`/api/audit/export?limit=1&before=${first.body.nextCursor}`).expect(200);
 assert.equal(second.body.count,1);assert.equal(JSON.parse(second.body.body).id,ids[2]);
 assert.equal(second.body.nextCursor,ids[2]);
 assert.ok(!first.body.body.includes(foreign));
 await a.agent.get(`/api/audit/export?before=${foreign}`).expect(404);
 await b.agent.get(`/api/audit/export?before=${ids[0]}`).expect(404);
 await a.agent.get(`/api/audit/export?before=${randomUUID()}`).expect(404);
 await a.agent.get('/api/audit/export?limit=1001').expect(400);
 await a.agent.get('/api/audit/export?before=invalid').expect(400);
 await request(app).get('/api/audit/export').expect(401);
 await transaction(async db=>{await scope(db,a.me.workspaceId);await db.query("UPDATE memberships SET role='Agent' WHERE workspace_id=$1 AND user_id=$2",[a.me.workspaceId,a.me.user.id]);});
 await a.agent.get('/api/audit/export').expect(403);
});
