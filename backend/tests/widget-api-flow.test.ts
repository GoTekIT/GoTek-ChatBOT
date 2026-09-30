import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import pg from 'pg';
import {randomUUID,randomBytes} from 'node:crypto';
import {digest} from '../src/core/security';
import {createApp} from '../src/app';
import {pool,transaction,scope} from '../src/core/db';
import {inboxTakeover,inboxSend} from '../src/modules/chat/inbox';
const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
after(async()=>{await pool.end();await admin.end();});
test('widget config/prechat/message/human reply/resume enforce origin and private-note boundary',async()=>{
 const w=randomUUID(),ch=randomUUID(),u=randomUUID(),key=randomBytes(32).toString('base64url');
 const app=createApp(),origin='https://widget-fixture.test',base='/widget-api/'+key;
 await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[w,'Widget flow test']);
 await admin.query('INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,$3,$4,$5)',[u,u+'@example.test','Test agent','0900000000','disabled']);
 await admin.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'Agent')",[w,u]);
 await admin.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload,prechat) VALUES($1,$2,'Widget',$3,'Hello','#0057E1',$4,$5,'{}',$6)",[ch,w,origin,key,randomUUID(),{enabled:true,fields:[{key:'fullName',label:'Tên',enabled:true,required:true}]}]);
 await admin.query('INSERT INTO channel_members(workspace_id,channel_id,user_id) VALUES($1,$2,$3)',[w,ch,u]);
 try{
  assert.equal((await request(app).get(base+'/config').set('Origin','https://wrong.test')).status,403);
  const config=await request(app).get(base+'/config').set('Origin',origin);assert.equal(config.status,200);assert.equal(config.body.prechat.fields[0].key,'fullName');assert.equal(config.body.workspace_id,undefined);
  assert.equal((await request(app).post(base+'/session').set('Origin',origin).send({profile:{}})).body.error,'PRECHAT_REQUIRED');
  const session=await request(app).post(base+'/session').set('Origin',origin).send({profile:{fullName:'Visitor'}});assert.equal(session.status,200);
  const token=session.body.token,c=session.body.conversationId;assert.equal(session.body.replyOwner,'HANDOFF_PENDING');assert.equal(session.body.ownerVersion,1);
  const state=()=>request(app).get(base+'/state').set('Origin',origin).set('Authorization','Bearer '+token);
  assert.equal((await request(app).get(base+'/state').set('Origin',origin)).status,401);
  assert.equal((await request(app).get(base+'/state').set('Origin','https://wrong.test').set('Authorization','Bearer '+token)).status,403);
  const post=(suffix:string,body:object)=>request(app).post(base+suffix).set('Origin',origin).set('Authorization','Bearer '+token).send(body);
  const payload={clientId:randomUUID(),body:'Xin chào'};const sent=await post('/messages',payload);assert.equal(sent.status,200);assert.equal((await post('/messages',payload)).body.id,sent.body.id);
  const actor={workspace_id:w,user_id:u,role:'Agent'};
  const run=(fn:any)=>transaction(async db=>{await scope(db,w);return fn(db);});
  await run((db:any)=>inboxTakeover(db,actor,c,{version:1}));
  const current=await state();assert.equal(current.status,200);assert.deepEqual(current.body,{replyOwner:'HUMAN_ACTIVE',ownerVersion:2});
  await run((db:any)=>inboxSend(db,actor,c,{clientId:randomUUID(),body:'Phản hồi nhân viên',visibility:'public'}));
  await run((db:any)=>inboxSend(db,actor,c,{clientId:randomUUID(),body:'Ghi chú bí mật',visibility:'internal'}));
  const messages=await request(app).get(base+'/messages').set('Origin',origin).set('Authorization','Bearer '+token);
  assert.equal(messages.status,200);assert.deepEqual(messages.body.map((m:any)=>m.body),['Xin chào','Phản hồi nhân viên']);
  const resume=await request(app).post(base+'/session').set('Origin',origin).send({resumeToken:token});assert.equal(resume.body.replyOwner,'HUMAN_ACTIVE');assert.equal(resume.body.ownerVersion,2);
  assert.equal((await admin.query('SELECT id FROM jobs WHERE workspace_id=$1',[w])).rowCount,0);
  const sessionToken=randomBytes(32).toString('base64url');
  await admin.query("INSERT INTO sessions(token_hash,user_id,workspace_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[digest(sessionToken),u,w]);
  const resumeAi=(version:number)=>request(app).post(`/api/conversations/${c}/resume-ai`).set('Cookie',`gotek_session=${sessionToken}`).set('X-Gotek-Request','1').send({version});
  await request(app).post(`/api/conversations/${c}/resume-ai`).set('X-Gotek-Request','1').send({version:2}).expect(401);
  const transitions=await Promise.all([resumeAi(2),resumeAi(2)]);
  assert.deepEqual(transitions.map(r=>r.status).sort(),[200,409]);
  assert.deepEqual((await state()).body,{replyOwner:'AI_ACTIVE',ownerVersion:3});
  assert.equal((await admin.query("SELECT count(*) FROM audit_events WHERE workspace_id=$1 AND action='conversation.ai_resumed'",[w])).rows[0].count,'1');
  assert.equal((await admin.query('SELECT id FROM jobs WHERE workspace_id=$1',[w])).rowCount,0,'resume must not enqueue old visitor messages');
  await assert.rejects(run((db:any)=>inboxSend(db,actor,c,{clientId:randomUUID(),body:'Late staff reply',visibility:'public'})),{code:'TAKEOVER_REQUIRED'});
  assert.equal((await post('/messages',payload)).body.id,sent.body.id,'retry from human phase keeps original receipt');
  assert.equal((await admin.query('SELECT id FROM jobs WHERE workspace_id=$1',[w])).rowCount,0,'replayed old turn must not trigger newly resumed AI');
  const followup={clientId:randomUUID(),body:'Câu hỏi sau khi tiếp tục AI'};
  const next=await post('/messages',followup);assert.equal(next.status,200);
  assert.equal((await post('/messages',followup)).body.id,next.body.id);
  const queued=(await admin.query("SELECT payload FROM jobs WHERE workspace_id=$1 AND kind='ai.reply'",[w])).rows;
  assert.equal(queued.length,1);assert.equal(queued[0].payload.ownerVersion,3);assert.equal(queued[0].payload.messageId,next.body.id);
  await run((db:any)=>inboxTakeover(db,actor,c,{version:3}));
  await resumeAi(4).expect(200);
  const repeated=await post('/messages',followup);
  assert.equal(repeated.status,200,'retry across another ownership cycle must not conflict with old job payload');
  assert.equal(repeated.body.id,next.body.id);
  assert.equal((await admin.query('SELECT id FROM jobs WHERE workspace_id=$1',[w])).rowCount,1);
  const beforeHandoff=(await state()).body.ownerVersion;
  await request(app).post(base+'/handoff').set('Origin',origin).send({}).expect(401);
  await request(app).post(base+'/handoff').set('Origin','https://wrong.test').set('Authorization','Bearer '+token).send({}).expect(403);
  await post('/handoff',{assignedTo:u}).expect(400);
  const handoffs=await Promise.all([post('/handoff',{}),post('/handoff',{})]);
  for(const result of handoffs){assert.equal(result.status,200);assert.deepEqual(result.body,{replyOwner:'HANDOFF_PENDING',ownerVersion:beforeHandoff+1});}
  await post('/messages',{clientId:randomUUID(),body:'Tôi đang chờ nhân viên'}).expect(200);
  assert.equal((await admin.query('SELECT id FROM jobs WHERE workspace_id=$1',[w])).rowCount,1,'handoff prevents further AI jobs');
  for(const status of ['resolved','snoozed']){
   await admin.query('UPDATE conversations SET status=$1 WHERE id=$2',[status,c]);
   const reopened=await post('/handoff',{}).expect(200);
   assert.equal(reopened.body.ownerVersion,beforeHandoff+1);
   assert.equal((await admin.query('SELECT status FROM conversations WHERE id=$1',[c])).rows[0].status,'open');
  }
  await run((db:any)=>inboxTakeover(db,actor,c,{version:beforeHandoff+1}));
  await admin.query("UPDATE conversations SET status='resolved' WHERE id=$1",[c]);
  await post('/handoff',{}).expect(200);
  const preserved=(await admin.query('SELECT status,reply_owner,assigned_to,owner_version FROM conversations WHERE id=$1',[c])).rows[0];
  assert.deepEqual(preserved,{status:'open',reply_owner:'HUMAN_ACTIVE',assigned_to:u,owner_version:beforeHandoff+2});
  await admin.query('DELETE FROM sessions WHERE token_hash=$1',[digest(sessionToken)]);

 }finally{
  const db=await admin.connect();try{await db.query('BEGIN');for(const table of ['sessions','jobs','messages','conversations','visitors','channel_members','channels','audit_events','memberships'])await db.query(`DELETE FROM ${table} WHERE workspace_id=$1`,[w]);await db.query('DELETE FROM workspaces WHERE id=$1',[w]);await db.query('DELETE FROM users WHERE id=$1',[u]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
});
