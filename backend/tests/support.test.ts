import {test,after} from 'node:test';import assert from 'node:assert/strict';import request from 'supertest';import pg from 'pg';import {randomUUID} from 'node:crypto';import {createApp} from '../src/app';import {pool} from '../src/core/db';
const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});after(async()=>{await pool.end();await admin.end();});
test('H28 support grant requires tenant approval, correct subject, scope, expiry and audit',async()=>{
 const app=createApp();const post=(agent:any,path:string,data:any)=>agent.post('/api'+path).set('X-Gotek-Request','1').send(data);
 async function fixture(){const agent=request.agent(app),email=`support-${randomUUID()}@example.test`,password='Local-support-test-2026';assert.equal((await post(agent,'/auth/signup',{email,password,fullName:'Support test',business:'Support workspace',phone:'0900000000'})).status,202);await post(agent,'/auth/login',{email,password});return {agent,me:(await agent.get('/api/me')).body};}
 const owner=await fixture(),support=await fixture(),other=await fixture();await admin.query('INSERT INTO platform_admins(user_id) VALUES($1),($2)',[support.me.user.id,other.me.user.id]);
 const body={subjectId:support.me.user.id,scope:'operational_metadata',reason:'Local support test approval',minutes:5};
 assert.equal((await post(owner.agent,'/support-grants',{...body,scope:'chat_content'})).status,400);
 const grant=await post(owner.agent,'/support-grants',body);assert.equal(grant.status,200);
 assert.equal((await other.agent.get(`/api/platform/support/${grant.body.id}`)).status,403);
 const result=await support.agent.get(`/api/platform/support/${grant.body.id}`);assert.equal(result.status,200);assert.equal(result.body.workspace.id,owner.me.workspaceId);assert.deepEqual(Object.keys(result.body).sort(),['expiresAt','jobs','scope','workspace']);
 assert.equal((await support.agent.get('/api/workspace')).body.id,support.me.workspaceId);
 const audit=(await owner.agent.get('/api/audit')).body;assert.ok(audit.some((a:any)=>a.action==='support.metadata_viewed'));
 assert.equal((await post(other.agent,`/support-grants/${grant.body.id}/revoke`,{})).status,404);
 assert.equal((await post(owner.agent,`/support-grants/${grant.body.id}/revoke`,{})).status,200);assert.equal((await support.agent.get(`/api/platform/support/${grant.body.id}`)).status,403);
 const expired=await post(owner.agent,'/support-grants',body);await admin.query("UPDATE support_grants SET created_at=now()-interval '10 minutes',expires_at=now()-interval '1 minute' WHERE id=$1",[expired.body.id]);assert.equal((await support.agent.get(`/api/platform/support/${expired.body.id}`)).status,403);
 const active=await post(owner.agent,'/support-grants',body);await admin.query('UPDATE platform_admins SET active=false WHERE user_id=$1',[support.me.user.id]);assert.equal((await support.agent.get(`/api/platform/support/${active.body.id}`)).status,403);
 assert.equal((await pool.query('SELECT id FROM support_grants')).rowCount,0);
});
