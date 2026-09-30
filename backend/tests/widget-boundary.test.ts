import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/app';
import {pool} from '../src/core/db';

test('H04 widget public token is channel scoped and origin/rate boundaries are enforced',async t=>{
 const app=createApp();
 t.after(async()=>{await pool.end();});
 const owner=request.agent(app), password='Local-widget-boundary-2026', email=`widget-boundary-${randomUUID()}@example.test`;
 await owner.post('/api/auth/signup').set('X-Gotek-Request','1').send({email,password,fullName:'Widget boundary',business:'Widget boundary business',phone:'0900000000'}).expect(202);
 await owner.post('/api/auth/login').set('X-Gotek-Request','1').send({email,password}).expect(200);
 const me=(await owner.get('/api/me').expect(200)).body;
 const create=(origin:string)=>owner.post('/api/channels').set('X-Gotek-Request','1').send({requestId:randomUUID(),name:`Widget ${randomUUID()}`,origin,greeting:'Hello',color:'#0057E1',agents:[me.user.id]});
 const a=(await create('https://widget-a.example.test').expect(200)).body;
 const b=(await create('https://widget-b.example.test').expect(200)).body;
 const keyA=(await owner.get(`/api/channels/${a.id}/installation`).expect(200)).body.publicKey;
 const keyB=(await owner.get(`/api/channels/${b.id}/installation`).expect(200)).body.publicKey;
 const sessionA=(await request(app).post(`/widget-api/${keyA}/session`).set('Origin','https://widget-a.example.test').send({}).expect(200)).body;
 assert.notEqual(sessionA.token,keyA,'visitor session token must not equal public installation key');
 await request(app).get(`/widget-api/${keyA}/config`).set('Origin','https://widget-b.example.test').expect(403);
 await request(app).get(`/widget-api/${keyB}/messages`).set('Origin','https://widget-b.example.test').set('Authorization',`Bearer ${sessionA.token}`).expect(401);
 await request(app).get(`/widget-api/${keyA}/messages`).set('Origin','https://widget-a.example.test').set('Authorization',`Bearer ${sessionA.token}`).expect(200);
 // The limiter is keyed by (client IP, public key), so a noisy malformed key
 // cannot consume another widget's budget; after 180 requests it is rejected.
 const noisy='A'.repeat(40), origin='https://widget-a.example.test';
 let limited=false;
 for(let i=0;i<181;i++){
  const response=await request(app).options(`/widget-api/${noisy}/config`).set('Origin',origin);
  if(response.status===429){limited=true;break;}
  assert.equal(response.status,403);
 }
 assert.equal(limited,true,'widget requests must receive 429 after the per-key budget');
});
