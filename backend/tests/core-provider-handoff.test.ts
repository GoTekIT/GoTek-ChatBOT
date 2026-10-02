import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {pool,scope,transaction} from '../src/core/db';
import {appendMessage} from '../src/modules/chat/chat-store';
import {enqueueJob} from '../src/modules/jobs/jobs';
import {runAiWorkerOnce} from '../src/modules/jobs/worker';

const admin=new pg.Pool({host:'127.0.0.1',port:Number(process.env.PGPORT||55432),user:'gotek_migrator',database:'gotek_chatbot'});

test('AI worker hands off when provider configuration cannot be used',async()=>{
 const workspace=randomUUID(),channel=randomUUID(),visitor=randomUUID(),conversation=randomUUID(),provider=randomUUID(),model=randomUUID();
 try {
  await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspace,'Provider handoff fixture']);
  await admin.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'Provider handoff','https://example.test','Hi','#0057E1',$3,$4,'{}')",[channel,workspace,randomUUID(),randomUUID()]);
  await admin.query("INSERT INTO visitors(id,workspace_id,channel_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 hour')",[visitor,workspace,channel,randomUUID()]);
  await admin.query("INSERT INTO conversations(id,workspace_id,channel_id,visitor_id,reply_owner) VALUES($1,$2,$3,$4,'AI_ACTIVE')",[conversation,workspace,channel,visitor]);
  await admin.query("INSERT INTO providers(id,name,adapter,secret_ref,enabled) VALUES($1,$2,'local','TEST_UNUSED',true)",[provider,provider]);
  await admin.query("INSERT INTO models(id,provider_id,name,capabilities,enabled) VALUES($1,$2,'fixture',ARRAY['chat'],true)",[model,provider]);
  await admin.query("INSERT INTO model_grants(id,workspace_id,model_id,capability,active) VALUES($1,$2,$3,'chat',true)",[randomUUID(),workspace,model]);
  let ownerVersion=1;
  for(const code of ['PROVIDER_ENDPOINT_REQUIRED','PROVIDER_ADAPTER_UNSUPPORTED']){
   const jobId=randomUUID();
   await transaction(async db=>{await scope(db,workspace);const source=await appendMessage(db,{workspace:workspace,conversation:conversation,clientId:randomUUID(),author:'visitor',visibility:'public',body:`Question ${code}`});await enqueueJob(db,workspace,{kind:'ai.reply',key:jobId,payload:{conversationId:conversation,messageId:source.id,ownerVersion},external:false});});
   let calls=0;
   const result=await runAiWorkerOnce(workspace,async()=>{calls++;const error=new Error(code) as Error&{code:string};error.code=code;throw error;});
   assert.equal(result.state,'succeeded',code);assert.equal(calls,1);
   const row=(await admin.query('SELECT state,receipt_id FROM jobs WHERE idempotency_key=$1',[jobId])).rows[0];
   assert.equal(row.state,'succeeded',code);assert.match(row.receipt_id,/^handoff:/,code);
   assert.equal((await admin.query('SELECT reply_owner FROM conversations WHERE id=$1',[conversation])).rows[0].reply_owner,'HANDOFF_PENDING',code);
   const before=(await admin.query("SELECT count(*)::int AS count FROM messages WHERE conversation_id=$1 AND author_type='ai'",[conversation])).rows[0].count;
   assert.equal(before,ownerVersion);
   assert.equal((await runAiWorkerOnce(workspace,async()=>{throw new Error('must not reinvoke');})).state,'idle');
   assert.equal((await admin.query("SELECT count(*)::int AS count FROM messages WHERE conversation_id=$1 AND author_type='ai'",[conversation])).rows[0].count,before);
   ownerVersion+=1;
   await admin.query("UPDATE conversations SET reply_owner='AI_ACTIVE',owner_version=$2 WHERE id=$1",[conversation,ownerVersion]);
  }
  await transaction(async db=>{await scope(db,workspace);const source=await appendMessage(db,{workspace,conversation,clientId:randomUUID(),author:'visitor',visibility:'public',body:'Takeover race'});await enqueueJob(db,workspace,{kind:'ai.reply',key:randomUUID(),payload:{conversationId:conversation,messageId:source.id,ownerVersion},external:false});});
  const before=(await admin.query('SELECT count(*)::int AS count FROM messages WHERE conversation_id=$1',[conversation])).rows[0].count;
  const raced=await runAiWorkerOnce(workspace,async()=>{
   await admin.query("UPDATE conversations SET reply_owner='HUMAN_ACTIVE',owner_version=owner_version+1 WHERE id=$1",[conversation]);
   throw new Error('PROVIDER_ENDPOINT_REQUIRED');
  });
  assert.equal(raced.state,'dead');
  assert.equal((await runAiWorkerOnce(workspace,async()=>{throw new Error('cancelled reply must not retry');})).state,'idle');
  const cancelled=(await admin.query("SELECT state,error_code FROM jobs WHERE workspace_id=$1 AND error_code='STALE_REPLY_OWNER'",[workspace])).rows;
  assert.deepEqual(cancelled,[{state:'dead',error_code:'STALE_REPLY_OWNER'}]);
  assert.equal((await admin.query('SELECT count(*)::int AS count FROM messages WHERE conversation_id=$1',[conversation])).rows[0].count,before);
  assert.equal((await admin.query('SELECT reply_owner FROM conversations WHERE id=$1',[conversation])).rows[0].reply_owner,'HUMAN_ACTIVE');
 } finally {
  await admin.query('DELETE FROM model_grants WHERE workspace_id=$1',[workspace]);
  await admin.query('DELETE FROM models WHERE id=$1',[model]);
  await admin.query('DELETE FROM providers WHERE id=$1',[provider]);
  for(const table of ['jobs','messages','conversations','visitors','channels'])await admin.query(`DELETE FROM ${table} WHERE workspace_id=$1`,[workspace]);
  await admin.query('DELETE FROM workspaces WHERE id=$1',[workspace]);
 }
});

test.after(async()=>{await admin.end();await pool.end();});
