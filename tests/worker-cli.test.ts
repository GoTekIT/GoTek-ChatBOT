import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {transaction,scope,pool} from '../src/server/db';
import {appendMessage} from '../src/server/chat-store';
import {enqueueJob} from '../src/server/jobs';
const exec=promisify(execFile);
test('CLI consumes a real tenant job and commits unavailable-model handoff once',async()=>{
 const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
 const w=randomUUID(),ch=randomUUID(),v=randomUUID(),c=randomUUID();
 try{
  await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[w,'Disposable CLI test']);
  await admin.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'CLI','https://example.test','Hi','#0057E1',$3,$4,'{}')",[ch,w,randomUUID(),randomUUID()]);
  await admin.query("INSERT INTO visitors(id,workspace_id,channel_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 hour')",[v,w,ch,randomUUID()]);
  await admin.query("INSERT INTO conversations(id,workspace_id,channel_id,visitor_id,reply_owner) VALUES($1,$2,$3,$4,'AI_ACTIVE')",[c,w,ch,v]);
  await transaction(async db=>{await scope(db,w);const m=await appendMessage(db,{workspace:w,conversation:c,clientId:randomUUID(),author:'visitor',visibility:'public',body:'CLI support request'});await enqueueJob(db,w,{kind:'ai.reply',key:m.id,payload:{conversationId:c,messageId:m.id,ownerVersion:1,requireGrounded:true},external:false});});
  const run=()=>exec(process.execPath,['--import','tsx','scripts/ai-worker.ts','--once'],{env:{...process.env,NODE_ENV:'test',GOTEK_WORKER_WORKSPACE:w},timeout:15000});
  assert.equal(JSON.parse((await run()).stdout.trim()).state,'succeeded');
  assert.equal(JSON.parse((await run()).stdout.trim()).state,'idle');
  await new Promise<void>((resolve,reject)=>{
   const child=spawn(process.execPath,['--import','tsx','scripts/ai-worker.ts'],{env:{...process.env,NODE_ENV:'test',GOTEK_WORKER_WORKSPACE:w},stdio:['ignore','pipe','pipe']});
   let output='',signalled=false;
   const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('WORKER_SHUTDOWN_TIMEOUT'));},10000);
   child.on('error',error=>{clearTimeout(timeout);reject(error);});
   child.stdout.on('data',chunk=>{output+=chunk.toString();if(!signalled&&output.includes('"state":"idle"')){signalled=true;child.kill('SIGTERM');}});
   child.on('close',(code,signal)=>{clearTimeout(timeout);try{assert.equal(signalled,true);assert.equal(code,0);assert.equal(signal,null);resolve();}catch(error){reject(error);}});
  });

  const job=(await admin.query('SELECT state,attempts,receipt_id FROM jobs WHERE workspace_id=$1',[w])).rows[0];
  assert.equal(job.state,'succeeded');assert.equal(job.attempts,1);assert.match(job.receipt_id,/^handoff:/);
  assert.equal((await admin.query('SELECT reply_owner FROM conversations WHERE id=$1',[c])).rows[0].reply_owner,'HANDOFF_PENDING');
  const messages=(await admin.query("SELECT body FROM messages WHERE conversation_id=$1 AND author_type='ai'",[c])).rows;
  assert.equal(messages.length,1);assert.match(messages[0].body,/chưa sẵn sàng/);
 }finally{
  for(const table of ['jobs','messages','conversations','visitors','channels'])await admin.query(`DELETE FROM ${table} WHERE workspace_id=$1`,[w]);
  await admin.query('DELETE FROM workspaces WHERE id=$1',[w]);await admin.end();await pool.end();
 }
});
