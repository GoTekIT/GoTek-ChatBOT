import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import {createApp} from '../src/app';
import {pool} from '../src/core/db';

const admin = new pg.Pool({
  host: process.platform === 'win32' ? '127.0.0.1' : (process.env.PGHOST || '/tmp'),
  port: Number(process.env.PGPORT) || 55432,
  user: process.env.PGUSER || 'gotek_migrator',
  password: process.env.PGPASSWORD || 'gotek_dev_password',
  database: 'gotek_chatbot'
});
after(async () => {await pool.end(); await admin.end();});

test('H01/H02/H16/H28 authorization: roles, ownership, live changes, revoke and tenant isolation', async () => {
  const app=createApp();
  const password='Authorization-test-only-2026';
  const header={'X-Gotek-Request':'1'};
  async function account() {
    const agent=request.agent(app), email=`authz-${randomUUID()}@example.test`;
    await agent.post('/api/auth/signup').set(header).send({email,password,fullName:'Authorization tester',business:'Authorization fixture',phone:'0900000000'}).expect(202);
    await agent.post('/api/auth/login').set(header).send({email,password}).expect(200);
    const me=(await agent.get('/api/me').expect(200)).body;
    return {agent,email,me};
  }
  const owner=await account(), manager=await account(), staff=await account(), outsider=await account();
  const ws=owner.me.workspaceId;
  for(const [a,role] of [[manager,'Admin'],[staff,'Agent']] as const) {
    await admin.query('INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,$3)',[ws,a.me.user.id,role]);
    await a.agent.post('/api/workspace/switch').set(header).send({workspaceId:ws}).expect(200);
  }
  const me=(await staff.agent.get('/api/me').expect(200)).body;
  assert.equal(me.role,'Agent');
  assert.equal(me.permissions.includes('inbox.use'),true);
  assert.equal(me.permissions.includes('members.manage'),false);
  assert.equal('password_hash' in me.user,false);
  assert.equal(owner.me.platformAdmin,false);
  for(const path of ['/members','/invitations','/knowledge/items','/usage','/audit','/jobs'])
    await staff.agent.get('/api'+path).expect(403);
  await staff.agent.get('/api/conversations').expect(200);
  await staff.agent.patch('/api/workspace').set(header).send({name:'Forbidden',language:'vi'}).expect(403);
  await staff.agent.post('/api/channels').set(header).send({}).expect(403);
  await staff.agent.patch(`/api/members/${staff.me.user.id}`).set(header).send({role:'Admin',active:true}).expect(403);
  await staff.agent.post('/api/invitations').set(header).send({email:'nobody@example.test',role:'Admin'}).expect(403);
  await manager.agent.get('/api/members').expect(200);
  await manager.agent.patch(`/api/members/${owner.me.user.id}`).set(header).send({role:'Agent',active:true}).expect(403);
  await manager.agent.patch(`/api/members/${staff.me.user.id}`).set(header).send({role:'Owner',active:true}).expect(403);
  await owner.agent.patch(`/api/members/${owner.me.user.id}`).set(header).send({role:'Agent',active:true}).expect(409);
  await owner.agent.patch(`/api/members/${owner.me.user.id}`).set(header).send({role:'Owner',active:false}).expect(409);
  await owner.agent.patch(`/api/members/${outsider.me.user.id}`).set(header).send({role:'Admin',active:true}).expect(404);
  await outsider.agent.post('/api/workspace/switch').set(header).send({workspaceId:ws}).expect(403);

  // Platform Admin can operate the platform but retains Agent's workspace limits.
  await admin.query('INSERT INTO platform_admins(user_id) VALUES($1)',[staff.me.user.id]);
  await staff.agent.get('/api/platform/registry').expect(200);
  assert.equal((await staff.agent.get('/api/me')).body.platformAdmin,true);
  await staff.agent.get('/api/members').expect(403);
  await owner.agent.get('/api/platform/registry').expect(403);
  await admin.query('UPDATE platform_admins SET active=false WHERE user_id=$1',[staff.me.user.id]);
  await staff.agent.get('/api/platform/registry').expect(403);

  // Role changes affect the very next request using the SAME session.
  await manager.agent.patch(`/api/members/${staff.me.user.id}`).set(header).send({role:'Admin',active:true}).expect(200);
  await staff.agent.get('/api/members').expect(200);
  await owner.agent.patch(`/api/members/${staff.me.user.id}`).set(header).send({role:'Agent',active:true}).expect(200);
  await staff.agent.get('/api/members').expect(403);
  // A second workspace session must survive revocation in the first workspace.
  const otherSession=request.agent(app);
  await otherSession.post('/api/auth/login').set(header).send({email:staff.email,password}).expect(200);
  await otherSession.post('/api/workspace/switch').set(header).send({workspaceId:staff.me.workspaceId}).expect(200);
  await manager.agent.patch(`/api/members/${staff.me.user.id}`).set(header).send({role:'Agent',active:false}).expect(200);
  await staff.agent.get('/api/me').expect(401);
  await otherSession.get('/api/me').expect(200);
  await manager.agent.patch(`/api/members/${staff.me.user.id}`).set(header).send({role:'Agent',active:true}).expect(200);
  await staff.agent.get('/api/me').expect(401); // old session stays revoked
});
