import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import pg from 'pg';
import {randomUUID,randomBytes} from 'node:crypto';
import {createApp} from '../src/app';
import {takeover} from '../src/modules/chat/chat-store';
import {transaction,scope,pool} from '../src/core/db';

const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
after(async()=>{await pool.end();await admin.end();});

test('H05 assignment capacity serializes concurrent widget sessions and takeover rejects stale owner',async()=>{
 const w=randomUUID(),ch=randomUUID(),a=randomUUID(),b=randomUUID(),origin='https://capacity-fixture.test';
 const key=randomBytes(32).toString('base64url'),app=createApp(),base='/widget-api/'+key;
 await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[w,'H05 capacity']);
 for(const [id,email] of [[a,'a'],[b,'b']] as const){
  await admin.query('INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,$3,$4,$5)',[id,`${email}-${w}@example.test`,email,'0900000000','disabled']);
  await admin.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'Agent')",[w,id]);
 }
 await admin.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload,assignment_enabled,assignment_limit) VALUES($1,$2,'Capacity',$3,'Hi','#0057E1',$4,$5,'{}',true,1)",[ch,w,origin,key,randomUUID()]);
 await admin.query('INSERT INTO channel_members(workspace_id,channel_id,user_id) VALUES($1,$2,$3),($1,$2,$4)',[w,ch,a,b]);
 try{
  const sessions=await Promise.all([1,2,3].map(()=>request(app).post(base+'/session').set('Origin',origin).send({}).expect(200)));
  const conversations=sessions.map(s=>s.body.conversationId);
  const assigned=(await admin.query('SELECT assigned_to FROM conversations WHERE id=ANY($1::uuid[]) ORDER BY id',[conversations])).rows.map(r=>r.assigned_to).filter(Boolean);
  assert.equal(assigned.length,2,'per-agent capacity=1 must leave the third concurrent conversation unassigned');
  assert.equal(new Set(assigned).size,2,'load balancing must use both eligible agents before leaving work unassigned');
  assert.ok([a,b].includes(assigned[0]),'assignment must target an active channel member');
  const conversation=conversations[0];
  const current=(await admin.query('SELECT owner_version FROM conversations WHERE id=$1',[conversation])).rows[0].owner_version;
  const run=(actor:string)=>transaction(async db=>{await scope(db,w);return takeover(db,w,conversation,actor,current);});
  const results=await Promise.allSettled([run(a),run(b)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1,'only one takeover may win the owner-version race');
  assert.equal(results.filter(x=>x.status==='rejected' && (x.reason as any).code==='STALE_REPLY_OWNER').length,1);
 }finally{
  const db=await admin.connect();try{await db.query('BEGIN');for(const table of ['messages','jobs','conversations','visitors','channel_members','channels','memberships'])await db.query(`DELETE FROM ${table} WHERE workspace_id=$1`,[w]);await db.query('DELETE FROM workspaces WHERE id=$1',[w]);await db.query('DELETE FROM users WHERE id IN ($1,$2)',[a,b]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
});
