import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {pool,scope,transaction} from '../src/core/db';
import {opaque,digest} from '../src/core/security';
import {appendMessage} from '../src/modules/chat/chat-store';
import {enqueueJob} from '../src/modules/jobs/jobs';
import {runAiWorkerOnce} from '../src/modules/jobs/worker';

const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
test.after(async()=>{await pool.end();await admin.end();});

async function fixture(opts:{model?:boolean;owner?:string;grounded?:boolean;revoked?:boolean}){
 const w=randomUUID(),u=randomUUID(),ch=randomUUID(),v=randomUUID(),c=randomUUID(),p=randomUUID(),m=randomUUID(),budget=randomUUID();
 const key=opaque(),token=opaque();
 await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[w,`quota matrix ${w}`]);
 await admin.query("INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,'Matrix','0','x')",[u,`${w}@matrix.test`]);
 await admin.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'matrix','https://matrix.test','Hi','#0057E1',$3,$4,'{}')",[ch,w,key,randomUUID()]);
 await admin.query("INSERT INTO visitors(id,workspace_id,channel_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 day')",[v,w,ch,digest(token)]);
 await admin.query("INSERT INTO conversations(id,workspace_id,channel_id,visitor_id,reply_owner) VALUES($1,$2,$3,$4,$5)",[c,w,ch,v,opts.owner??'AI_ACTIVE']);
 await admin.query("INSERT INTO providers(id,name,adapter,secret_ref,enabled) VALUES($1,$2,'local','MATRIX_KEY',true)",[p,`matrix provider ${p}`]);
 await admin.query("INSERT INTO models(id,provider_id,name,capabilities,enabled) VALUES($1,$2,'matrix-model',ARRAY['chat'],$3)",[m,p,opts.model!==false]);
 await admin.query("INSERT INTO model_grants(id,workspace_id,model_id,capability,active) VALUES($1,$2,$3,'chat',$4)",[randomUUID(),w,m,opts.model!==false]);
 await admin.query("INSERT INTO quota_budgets(id,workspace_id,meter,period_start,period_end,limit_units) VALUES($1,$2,'ai_response',now()-interval '1 minute',now()+interval '1 day',10)",[budget,w]);
 const source=await transaction(async db=>{await scope(db,w);return appendMessage(db,{workspace:w,conversation:c,clientId:randomUUID(),author:'visitor',visibility:'public',body:opts.grounded?'answer from revoked source':'question'});});
 if(opts.grounded){
  const item=randomUUID(),version=randomUUID();
  await admin.query("INSERT INTO knowledge_items(id,workspace_id,source_type,active,audience,created_by) VALUES($1,$2,'MANUAL',true,'PUBLIC',$3)",[item,w,u]);
  await admin.query("INSERT INTO knowledge_versions(id,workspace_id,item_id,version_no,title,content,content_hash,state,created_by) VALUES($1,$2,$3,1,'revoked','old','revoked','FAILED',$4)",[version,w,item,u]);
 }
 await transaction(async db=>{await scope(db,w);await enqueueJob(db,w,{kind:'ai.reply',key:`matrix:${randomUUID()}`,payload:{conversationId:c,messageId:source.id,ownerVersion:opts.owner==='HUMAN_ACTIVE'?1:1,requireGrounded:!!opts.grounded},external:false});});
 return {w,u,c,source};
}

async function assertNoReservation(w:string){
 const usage=(await admin.query('SELECT count(*)::int AS n FROM usage_operations WHERE workspace_id=$1',[w])).rows[0].n;
 const dispatch=(await admin.query("SELECT count(*)::int AS n FROM ai_reply_dispatches WHERE workspace_id=$1 AND state='unknown'",[w])).rows[0].n;
 assert.equal(usage,0,'pre-dispatch rejection must not reserve usage');
 assert.equal(dispatch,0,'pre-dispatch rejection must not leave unknown dispatch');
}

for(const [name,opts] of [
 ['missing model',{model:false}],
 ['stale owner',{owner:'HUMAN_ACTIVE'}],
 ['missing grounded knowledge',{grounded:true}],
 ['revoked source before provider',{grounded:true,model:true}]
] as const){
 test(`quota matrix: ${name}`,async()=>{
  const f=await fixture(opts); let calls=0;
  try {
   const result=await runAiWorkerOnce(f.w,async()=>{calls++;return 'must not call';});
   assert.ok(['succeeded','unknown'].includes(result.state));
   assert.equal(calls,0,'provider must not be invoked before validation');
   await assertNoReservation(f.w);
  } finally {
   await admin.query('DELETE FROM usage_operations WHERE workspace_id=$1',[f.w]);
   await admin.query('DELETE FROM ai_reply_dispatches WHERE workspace_id=$1',[f.w]);
   await admin.query('DELETE FROM jobs WHERE workspace_id=$1',[f.w]);
   await admin.query('DELETE FROM knowledge_versions WHERE workspace_id=$1',[f.w]);
   await admin.query('DELETE FROM knowledge_items WHERE workspace_id=$1',[f.w]);
   await admin.query('DELETE FROM quota_budgets WHERE workspace_id=$1',[f.w]);
   await admin.query('DELETE FROM model_grants WHERE workspace_id=$1',[f.w]);
   await admin.query('DELETE FROM model_grants WHERE model_id IN (SELECT id FROM models WHERE provider_id IN (SELECT id FROM providers WHERE name LIKE $1))',[`matrix provider %`]);
   await admin.query('DELETE FROM models WHERE provider_id IN (SELECT id FROM providers WHERE name LIKE $1)',[`matrix provider %`]);
   await admin.query('DELETE FROM providers WHERE name LIKE $1',[`matrix provider %`]);
   await admin.query('DELETE FROM messages WHERE workspace_id=$1',[f.w]);
   await admin.query('DELETE FROM conversations WHERE workspace_id=$1',[f.w]);
   await admin.query('DELETE FROM visitors WHERE workspace_id=$1',[f.w]);
   await admin.query('DELETE FROM channels WHERE workspace_id=$1',[f.w]);
   await admin.query('DELETE FROM workspaces WHERE id=$1',[f.w]);
   await admin.query('DELETE FROM users WHERE id=$1',[f.u]);
  }
 });
}
