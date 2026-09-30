import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/core/db';
import {digest} from '../src/core/security';
import {realtimeAuthorization} from '../src/services/realtime-authorization.service';

const admin = new pg.Pool({host: process.env.PGHOST || '/tmp', port: Number(process.env.PGPORT) || 55432,
  user: process.env.PGUSER || 'gotek_migrator', password: process.env.PGPASSWORD || 'gotek_dev_password', database: 'gotek_chatbot'});
after(async () => {await pool.end(); await admin.end();});

test('SSE DB policy enforces channel scope, live roles, session expiry, revoke and workspace switch', async () => {
  const user=randomUUID(), ws=randomUUID(), foreign=randomUUID(), token=randomUUID();
  const channels=[randomUUID(),randomUUID()], visitors=[randomUUID(),randomUUID()], conversations=[randomUUID(),randomUUID()];
  try {
    await admin.query("INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,'SSE fixture','','unused')",[user,`${user}@example.test`]);
    for(const id of [ws,foreign]) await admin.query("INSERT INTO workspaces(id,name) VALUES($1,'SSE fixture')",[id]);
    for(const id of [ws,foreign]) await admin.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'Agent')",[id,user]);
    await admin.query("INSERT INTO sessions(token_hash,user_id,workspace_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[digest(token),user,ws]);
    for(let n=0;n<2;n++) {
      await admin.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'Fixture','https://example.test','Hello','#000000',$3,$4,'{}')",[channels[n],ws,randomUUID(),randomUUID()]);
      await admin.query("INSERT INTO visitors(id,workspace_id,channel_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 hour')",[visitors[n],ws,channels[n],randomUUID()]);
      await admin.query('INSERT INTO conversations(id,workspace_id,channel_id,visitor_id) VALUES($1,$2,$3,$4)',[conversations[n],ws,channels[n],visitors[n]]);
    }
    await admin.query('INSERT INTO channel_members(workspace_id,channel_id,user_id) VALUES($1,$2,$3)',[ws,channels[0],user]);
    const policy=realtimeAuthorization({cookies:{gotek_session:token},headers:{}} as any,ws);
    let delivered=0;
    const send=()=>{delivered++;};
    await policy(send,conversations[0]); assert.equal(delivered,1);
    await policy(send,conversations[1]); assert.equal(delivered,1);
    await admin.query("UPDATE memberships SET role='Admin' WHERE workspace_id=$1 AND user_id=$2",[ws,user]);
    await policy(send,conversations[1]); assert.equal(delivered,2);
    await admin.query("UPDATE memberships SET role='Agent' WHERE workspace_id=$1 AND user_id=$2",[ws,user]);
    await policy(send,conversations[1]); assert.equal(delivered,2);
    await admin.query('DELETE FROM channel_members WHERE user_id=$1',[user]);
    await policy(send,conversations[0]); assert.equal(delivered,2);
    const conversationPolicy = realtimeAuthorization({cookies:{gotek_session:token},headers:{}} as any,ws,true);
    await assert.rejects(conversationPolicy(send,conversations[0]), /NOT_FOUND/);
    assert.equal(delivered,2);
    await admin.query('UPDATE sessions SET workspace_id=$1 WHERE token_hash=$2',[foreign,digest(token)]);
    await assert.rejects(policy(send), /SESSION_CHANGED/);
    await admin.query("UPDATE sessions SET workspace_id=$1,expires_at=now()-interval '1 second' WHERE token_hash=$2",[ws,digest(token)]);
    await assert.rejects(policy(send), /UNAUTHENTICATED/);
    await admin.query("UPDATE sessions SET expires_at=now()+interval '1 hour' WHERE token_hash=$1",[digest(token)]);
    await admin.query('UPDATE memberships SET active=false WHERE user_id=$1',[user]);
    await assert.rejects(policy(send), /UNAUTHENTICATED/);
    await admin.query('UPDATE memberships SET active=true WHERE user_id=$1',[user]);
    await admin.query('DELETE FROM sessions WHERE user_id=$1',[user]);
    await assert.rejects(policy(send), /UNAUTHENTICATED/);
    assert.equal(delivered,2);
  } finally {
    await admin.query('DELETE FROM conversations WHERE workspace_id=$1',[ws]);
    await admin.query('DELETE FROM visitors WHERE workspace_id=$1',[ws]);
    await admin.query('DELETE FROM channel_members WHERE user_id=$1',[user]);
    await admin.query('DELETE FROM channels WHERE workspace_id=$1',[ws]);
    await admin.query('DELETE FROM sessions WHERE user_id=$1',[user]);
    await admin.query('DELETE FROM memberships WHERE user_id=$1',[user]);
    await admin.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[[ws,foreign]]);
    await admin.query('DELETE FROM users WHERE id=$1',[user]);
  }
});
