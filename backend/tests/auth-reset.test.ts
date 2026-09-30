import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/app';
import {pool} from '../src/core/db';
import {digest} from '../src/core/security';

const admin = new pg.Pool({host:process.env.PGHOST || '/tmp',port:Number(process.env.PGPORT) || 55432,user:process.env.PGUSER || 'gotek_migrator',password:process.env.PGPASSWORD || 'gotek_dev_password',database:'gotek_chatbot'});
after(async()=>{await pool.end();await admin.end();});

test('H01 reset challenge is single-use, expires, and revokes existing sessions', async()=>{
  const agent=request.agent(createApp());
  const email=`reset-${randomUUID()}@example.test`, oldPassword='Old-reset-password-2026', newPassword='New-reset-password-2026';
  let uid:string|undefined;
  try {
    assert.equal((await agent.post('/api/auth/signup').set('X-Gotek-Request','1').send({email,password:oldPassword,fullName:'Reset Test',business:'Reset Workspace',phone:'0900000000'})).status,202);
    uid=(await admin.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id;
    assert.equal((await agent.post('/api/auth/login').set('X-Gotek-Request','1').send({email,password:oldPassword})).status,200);
    const requested = await agent.post('/api/auth/request-reset').set('X-Gotek-Request','1').send({email});
    assert.equal(requested.status,202);
    assert.equal('token' in requested.body, false);
    assert.equal('devOtp' in requested.body, false);
    const first=(await admin.query("SELECT payload FROM local_delivery WHERE user_id=$1 AND kind='reset' ORDER BY created_at DESC LIMIT 1",[uid])).rows[0];
    const token=(typeof first.payload==='string'?JSON.parse(first.payload):first.payload).token;
    assert.equal((await agent.post('/api/auth/reset').set('X-Gotek-Request','1').send({token,password:newPassword})).status,200);
    assert.equal((await agent.get('/api/me')).body.error,'UNAUTHENTICATED');
    assert.equal((await agent.post('/api/auth/reset').set('X-Gotek-Request','1').send({token,password:'Replay-reset-password-2026'})).body.error,'INVALID_OR_EXPIRED_TOKEN');
    assert.equal((await agent.post('/api/auth/login').set('X-Gotek-Request','1').send({email,password:newPassword})).status,200);

    // Re-open cooldown only to exercise expiry on a fresh reset challenge.
    await admin.query("UPDATE challenges SET created_at=now()-interval '2 minutes',expires_at=now()-interval '1 second' WHERE user_id=$1 AND kind='reset'",[uid]);
    assert.equal((await agent.post('/api/auth/request-reset').set('X-Gotek-Request','1').send({email})).status,202);
    const second=(await admin.query("SELECT payload FROM local_delivery WHERE user_id=$1 AND kind='reset' ORDER BY created_at DESC LIMIT 1",[uid])).rows[0];
    const expiredToken=(typeof second.payload==='string'?JSON.parse(second.payload):second.payload).token;
    await admin.query("UPDATE challenges SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[digest(expiredToken)]);
    assert.equal((await agent.post('/api/auth/reset').set('X-Gotek-Request','1').send({token:expiredToken,password:'Expired-reset-password-2026'})).body.error,'INVALID_OR_EXPIRED_TOKEN');
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
