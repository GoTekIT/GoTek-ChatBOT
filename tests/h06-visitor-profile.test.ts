import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import pg from 'pg';
import { randomUUID, randomBytes } from 'node:crypto';
import { createApp } from '../src/server/app';
import { pool } from '../src/server/db';

const admin = new pg.Pool({host:'/tmp', port:55432, user:'gotek_migrator', database:'gotek_chatbot'});

test('H06 visitor prechat profile persists and remains channel/tenant scoped', async () => {
  const app = createApp();
  const w1 = randomUUID(), w2 = randomUUID(), c1 = randomUUID(), c2 = randomUUID();
  const k1 = randomBytes(32).toString('base64url'), k2 = randomBytes(32).toString('base64url');
  const o1 = 'https://h06-one.example.test', o2 = 'https://h06-two.example.test';
  const prechat = {enabled:true, fields:[
    {key:'fullName', label:'Full name', enabled:true, required:true},
    {key:'emailAddress', label:'Email', enabled:true, required:false},
  ]};
  await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2),($3,$4)', [w1,'H06 one',w2,'H06 two']);
  await admin.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload,prechat) VALUES($1,$2,'One',$3,'Hi','#0057E1',$4,$5,'{}',$6),($7,$8,'Two',$9,'Hi','#0057E1',$10,$11,'{}',$12)", [c1,w1,o1,k1,randomUUID(),prechat,c2,w2,o2,k2,randomUUID(),prechat]);
  try {
    const s = await request(app).post(`/widget-api/${k1}/session`).set('Origin',o1)
      .send({profile:{fullName:'Initial', emailAddress:'initial@example.test'}}).expect(200);
    const auth = {Origin:o1, Authorization:`Bearer ${s.body.token}`};
    const updated = await request(app).post(`/widget-api/${k1}/profile`).set(auth)
      .send({profile:{fullName:'Updated', emailAddress:'updated@example.test'}}).expect(200);
    assert.deepEqual(updated.body.profile, {fullName:'Updated', emailAddress:'updated@example.test'});
    const row = (await admin.query('SELECT profile,workspace_id,channel_id FROM visitors WHERE id=(SELECT visitor_id FROM conversations WHERE id=$1)', [s.body.conversationId])).rows[0];
    assert.deepEqual(row.profile, {fullName:'Updated', emailAddress:'updated@example.test'});
    assert.equal(row.workspace_id, w1); assert.equal(row.channel_id, c1);
    await request(app).post(`/widget-api/${k1}/profile`).set(auth)
      .send({profile:{fullName:'Updated', secret:'leak'}}).expect(400);
    await request(app).post(`/widget-api/${k1}/profile`).set(auth)
      .send({profile:{fullName:'Updated', emailAddress:'bad'}}).expect(400);
    await request(app).post(`/widget-api/${k1}/profile`).set(auth)
      .send({profile:{emailAddress:'missing-name@example.test'}}).expect(400);
    await request(app).post(`/widget-api/${k1}/profile`).set({...auth, Origin:'https://wrong.example.test'})
      .send({profile:{fullName:'Wrong origin'}}).expect(403);
    await request(app).get(`/widget-api/${k2}/messages`).set({Origin:o2, Authorization:`Bearer ${s.body.token}`}).expect(401);
  } finally {
    await admin.query('DELETE FROM conversations WHERE workspace_id=$1 OR workspace_id=$2', [w1,w2]);
    await admin.query('DELETE FROM visitors WHERE workspace_id=$1 OR workspace_id=$2', [w1,w2]);
    await admin.query('DELETE FROM channels WHERE workspace_id=$1 OR workspace_id=$2', [w1,w2]);
    await admin.query('DELETE FROM workspaces WHERE id=$1 OR id=$2', [w1,w2]);
  }
});

test.after(async () => { await pool.end(); await admin.end(); });
