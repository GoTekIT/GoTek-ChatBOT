import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {aiReplyHandler} from '../src/modules/ai/ai-reply-worker';
import {appendMessage} from '../src/modules/chat/chat-store';
import {pool,scope,transaction} from '../src/core/db';

const admin = new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});

test.after(async()=>{await pool.end(); await admin.end();});

test('AI commit keeps chat grant/model/provider FOR SHARE until the reply is committed', async()=>{
  const workspace=randomUUID(), channel=randomUUID(), visitor=randomUUID(), conversation=randomUUID();
  const provider=randomUUID(), model=randomUUID(), publicKey=randomUUID();
  await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspace,'AI grant lock regression']);
  await admin.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'Lock fixture','https://lock.test','Hi','#0057E1',$3,$4,'{}')",[channel,workspace,publicKey,randomUUID()]);
  await admin.query("INSERT INTO visitors(id,workspace_id,channel_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 day')",[visitor,workspace,channel,`lock-${visitor}`]);
  await admin.query("INSERT INTO conversations(id,workspace_id,channel_id,visitor_id,reply_owner) VALUES($1,$2,$3,$4,'AI_ACTIVE')",[conversation,workspace,channel,visitor]);
  await admin.query("INSERT INTO providers(id,name,adapter,secret_ref,enabled) VALUES($1,$2,'local','LOCK_TEST_KEY',true)",[provider,'Lock provider '+provider]);
  await admin.query("INSERT INTO models(id,provider_id,name,capabilities,enabled) VALUES($1,$2,'lock-model',ARRAY['chat'],true)",[model,provider]);
  await admin.query("INSERT INTO model_grants(id,workspace_id,model_id,capability,active) VALUES($1,$2,$3,'chat',true)",[randomUUID(),workspace,model]);

  let lockProbe: Promise<unknown>|undefined;
  let lockQuerySeen=false;
  try {
    const result=await transaction(async raw=>{
      await scope(raw,workspace);
      const source=await appendMessage(raw,{workspace,conversation,clientId:randomUUID(),author:'visitor',visibility:'public',body:'Lock check'});
      // The worker receives a tenant-scoped client. Wrap only query() so the
      // test can probe the lock immediately after the final registry SELECT.
      const originalQuery=(raw as any).query.bind(raw);
      const db:any={query:(...args:any[])=>{
        const sql=String(args[0]);
        const result=originalQuery(...args);
        if(sql.includes('FOR SHARE OF g,m,p')){
          lockQuerySeen=true;
          lockProbe=result.then(async()=>{
            try {
              await admin.query('SELECT id FROM models WHERE id=$1 FOR UPDATE NOWAIT',[model]);
              return false;
            } catch(error:any) {
              return error?.code==='55P03';
            }
          });
        }
        return result;
      }};
      const handler=aiReplyHandler(db,async()=> 'Lock-protected answer');
      const output=await handler({workspace_id:workspace,payload:{conversationId:conversation,messageId:source.id,ownerVersion:1}});
      return output;
    });
    assert.equal(result.receipt.startsWith(`ai:${conversation}:`),true);
    assert.equal(lockQuerySeen,true,'final registry lock query must execute');
    assert.equal(await lockProbe,true,'a concurrent FOR UPDATE NOWAIT must conflict with the held FOR SHARE lock');
    assert.equal((await admin.query("SELECT body FROM messages WHERE conversation_id=$1 AND author_type='ai'",[conversation])).rows[0].body,'Lock-protected answer');
  } finally {
    await admin.query('DELETE FROM messages WHERE workspace_id=$1',[workspace]);
    await admin.query('DELETE FROM conversations WHERE workspace_id=$1',[workspace]);
    await admin.query('DELETE FROM visitors WHERE workspace_id=$1',[workspace]);
    await admin.query('DELETE FROM channels WHERE workspace_id=$1',[workspace]);
    await admin.query('DELETE FROM model_grants WHERE workspace_id=$1',[workspace]);
    await admin.query('DELETE FROM models WHERE id=$1',[model]);
    await admin.query('DELETE FROM providers WHERE id=$1',[provider]);
    await admin.query('DELETE FROM workspaces WHERE id=$1',[workspace]);
  }
});
