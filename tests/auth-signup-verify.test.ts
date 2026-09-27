import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server/app';
import {pool} from '../src/server/db';
const admin = new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
after(async()=>{await pool.end();await admin.end();});
test('H01 local verification consumes token once and rejects expired tokens',async()=>{
 const agent=request.agent(createApp()),email=`verify-${randomUUID()}@example.test`;
 const post=(path:string,body:any)=>agent.post('/api/auth/'+path).set('X-Gotek-Request','1').send(body);
 let uid:string|undefined;
 try {
  assert.equal((await post('signup',{email,password:'Local-verify-test-2026',fullName:'Verify Test',business:'Verify Workspace',phone:'0900000000'})).status,202);
  uid=(await admin.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id;
  const row=(await admin.query("SELECT payload FROM local_delivery WHERE user_id=$1 AND kind='verify' ORDER BY created_at DESC LIMIT 1",[uid])).rows[0];
  assert.ok(row);const token=row.payload.token;
  assert.equal((await post('verify',{token})).status,200);
  assert.ok((await admin.query('SELECT verified_at FROM users WHERE id=$1',[uid])).rows[0].verified_at);
  assert.equal((await post('verify',{token})).body.error,'INVALID_OR_EXPIRED_TOKEN');
  // Re-open the test challenge only to exercise expiry independently of used_at.
  await admin.query("UPDATE challenges SET used_at=NULL,expires_at=now()-interval '1 second' WHERE user_id=$1",[uid]);
  assert.equal((await post('verify',{token})).body.error,'INVALID_OR_EXPIRED_TOKEN');
 } finally {
  if(uid){const db=await admin.connect();try{await db.query('BEGIN');
   const workspaces=(await db.query('SELECT workspace_id FROM memberships WHERE user_id=$1',[uid])).rows.map(r=>r.workspace_id);
   for(const table of ['local_delivery','challenges','sessions','memberships'])await db.query(`DELETE FROM ${table} WHERE user_id=$1`,[uid]);
   await db.query('DELETE FROM audit_events WHERE actor_id=$1',[uid]);
   await db.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[workspaces]);
   await db.query('DELETE FROM users WHERE id=$1',[uid]);await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
 }
});
