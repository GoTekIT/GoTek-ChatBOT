import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server/app';
import {pool,transaction,scope} from '../src/server/db';
import {createRule} from '../src/server/rules';

test('H09 concurrent transactions share request identity and audit only once',async(t)=>{
 t.after(()=>pool.end());
 const app=createApp(),a=request.agent(app),email=`idem-${randomUUID()}@example.test`,password='Local-idempotency-test-2026';
 await a.post('/api/auth/signup').set('X-Gotek-Request','1').send({email,password,fullName:'Idempotency test',business:'Local test',phone:'0900000000'}).expect(202);
 await a.post('/api/auth/login').set('X-Gotek-Request','1').send({email,password}).expect(200);
 const me=(await a.get('/api/me').expect(200)).body;
 const actor={user_id:me.user.id,workspace_id:me.workspaceId,role:'Owner'};
 const body={title:'Concurrent',content:'One rule',requestId:randomUUID()};
 // Separate DB transactions bypass session-row locking, exercising the actual create race.
 const run=(value:unknown)=>transaction(async db=>{await scope(db,actor.workspace_id);return createRule(db,actor,value);});
 const results=await Promise.all(Array.from({length:6},()=>run(body)));
 assert.equal(new Set(results.map(r=>r.id)).size,1);
 await assert.rejects(run({...body,content:'Changed'}),(e:any)=>e.code==='IDEMPOTENCY_CONFLICT');
 await transaction(async db=>{await scope(db,actor.workspace_id);
 assert.equal(Number((await db.query('SELECT count(*) FROM ai_rules WHERE request_id=$1',[body.requestId])).rows[0].count),1);
 assert.equal(Number((await db.query("SELECT count(*) FROM audit_events WHERE object_id=$1 AND action='ai_rule.created'",[results[0].id])).rows[0].count),1);
 });
});
