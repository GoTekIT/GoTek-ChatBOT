import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID,createHash} from 'node:crypto';
import {transactionalAiReplyHandler} from '../src/modules/ai/ai-reply-worker';
import {appendMessage} from '../src/modules/chat/chat-store';
import {pool,scope,transaction} from '../src/core/db';

const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
test.after(async()=>{await pool.end();await admin.end();});

test('embedding transport failures fall back only to existing grounded lexical context',async()=>{
 const workspace=randomUUID(),channel=randomUUID(),visitor=randomUUID(),conversation=randomUUID();
 const user=randomUUID(),provider=randomUUID(),chat=randomUUID(),embedding=randomUUID(),item=randomUUID(),version=randomUUID();
 const secretRef='PROVENANCE_TEST_'+randomUUID().replaceAll('-','_').toUpperCase();
 const originalFetch=globalThis.fetch;
 const content='Warranty lasts twelve months.';
 const hash=createHash('sha256').update(content).digest('hex');
 try{
  await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspace,'Provenance regression']);
  await admin.query("INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,'Fixture','0','unused')",[user,user+'@example.test']);
  await admin.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'Fixture','https://fixture.test','Hi','#0057E1',$3,$4,'{}')",[channel,workspace,randomUUID(),randomUUID()]);
  await admin.query("INSERT INTO visitors(id,workspace_id,channel_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 day')",[visitor,workspace,channel,randomUUID()]);
  await admin.query("INSERT INTO conversations(id,workspace_id,channel_id,visitor_id,reply_owner) VALUES($1,$2,$3,$4,'AI_ACTIVE')",[conversation,workspace,channel,visitor]);
  await admin.query("INSERT INTO providers(id,name,adapter,secret_ref,enabled) VALUES($1,$2,'openai',$3,true)",[provider,provider,secretRef]);
  for(const [id,cap] of [[chat,'chat'],[embedding,'embedding']]){
   await admin.query('INSERT INTO models(id,provider_id,name,capabilities,enabled) VALUES($1,$2,$3,$4,true)',[id,provider,cap,[cap]]);
   await admin.query('INSERT INTO model_grants(id,workspace_id,model_id,capability,active) VALUES($1,$2,$3,$4,true)',[randomUUID(),workspace,id,cap]);
  }
  await admin.query("INSERT INTO knowledge_items(id,workspace_id,audience,created_by) VALUES($1,$2,'PUBLIC',$3)",[item,workspace,user]);
  await admin.query("INSERT INTO knowledge_versions(id,workspace_id,item_id,version_no,title,content,content_hash,state,created_by) VALUES($1,$2,$3,1,'Warranty',$4,$5,'READY',$6)",[version,workspace,item,content,hash,user]);
  await admin.query('UPDATE knowledge_items SET published_version_id=$1 WHERE id=$2',[version,item]);
  process.env[secretRef]='fixture-only';
  for(const mode of ['http503','network','timeout','invalid-json','invalid-vector']){
   for(const lexical of [true,false]){
    let fetches=0,chatCalls=0;
    globalThis.fetch=async()=>{
     fetches++;
     if(mode==='http503')return new Response('',{status:503});
     if(mode==='network')throw new TypeError('fetch failed');
     if(mode==='timeout')throw new DOMException('timed out','TimeoutError');
     if(mode==='invalid-json')return new Response('invalid');
     return new Response(JSON.stringify({data:[{embedding:[0,0]}]}));
    };
    const source=await transaction(async db=>{await scope(db,workspace);return appendMessage(db,{workspace,conversation,clientId:randomUUID(),author:'visitor',visibility:'public',body:lexical?'Warranty':'Unrelated subject'});});
    const handler=transactionalAiReplyHandler(async input=>{
     chatCalls++;assert.equal(input.context?.[0].content,content);
     return 'Grounded answer '+mode;
    });
    const invocation=handler({workspace_id:workspace,payload:{conversationId:conversation,messageId:source.id,ownerVersion:1,requireGrounded:true}});
    if(mode==='invalid-vector')await assert.rejects(invocation,{message:'PROVIDER_INVALID_EMBEDDING'});
    else if(!lexical)await assert.rejects(invocation,{code:'AI_KNOWLEDGE_NOT_FOUND'});
    else assert.ok((await invocation).receipt.startsWith('ai:'));
    assert.equal(fetches,1);
    assert.equal(chatCalls,lexical&&mode!=='invalid-vector'?1:0);
   }
  }
  assert.equal(Number((await admin.query("SELECT count(*) FROM messages WHERE conversation_id=$1 AND author_type='ai'",[conversation])).rows[0].count),4);
  assert.equal(Number((await admin.query('SELECT count(*) FROM ai_usage_ledger WHERE workspace_id=$1',[workspace])).rows[0].count),4);

 }finally{
  globalThis.fetch=originalFetch;delete process.env[secretRef];
  await admin.query('DELETE FROM ai_usage_ledger WHERE workspace_id=$1',[workspace]);
  await admin.query('DELETE FROM messages WHERE workspace_id=$1',[workspace]);
  await admin.query('DELETE FROM conversations WHERE workspace_id=$1',[workspace]);
  await admin.query('DELETE FROM visitors WHERE workspace_id=$1',[workspace]);
  await admin.query('DELETE FROM channels WHERE workspace_id=$1',[workspace]);
  await admin.query('UPDATE knowledge_items SET published_version_id=NULL WHERE workspace_id=$1',[workspace]);
  await admin.query('DELETE FROM knowledge_versions WHERE workspace_id=$1',[workspace]);
  await admin.query('DELETE FROM knowledge_items WHERE workspace_id=$1',[workspace]);
  await admin.query('DELETE FROM model_grants WHERE workspace_id=$1',[workspace]);
  await admin.query('DELETE FROM models WHERE provider_id=$1',[provider]);
  await admin.query('DELETE FROM providers WHERE id=$1',[provider]);
  await admin.query('DELETE FROM workspaces WHERE id=$1',[workspace]);
  await admin.query('DELETE FROM users WHERE id=$1',[user]);
 }
});
