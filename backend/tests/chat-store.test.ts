import {inboxDetail,inboxList,inboxMessages,inboxTakeover,inboxSend,inboxSetStatus} from '../src/modules/chat/inbox';
import {test,after} from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {pool,scope,transaction} from '../src/core/db';import {appendMessage,takeover} from '../src/modules/chat/chat-store';
const admin=new pg.Pool({host:'127.0.0.1',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});after(async()=>{await pool.end();await admin.end();});
test('H03 message ordering/idempotency, takeover fencing, note boundary and tenant isolation',async()=>{
 const w=randomUUID(),ch=randomUUID(),v=randomUUID(),c=randomUUID(),agent=randomUUID(),other=randomUUID();
 await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2),($3,$4)',[w,'Chat fixture',other,'Other fixture']);
 await admin.query('INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,$3,$4,$5)',[agent,`${agent}@example.test`,'Test agent','0900000000','disabled-test-identity']);await admin.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'Agent')",[w,agent]);
 await admin.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'Fixture','https://example.test','Hello','#0057E1',$3,$4,'{}')",[ch,w,randomUUID(),randomUUID()]);
 await admin.query("INSERT INTO visitors(id,workspace_id,channel_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 day')",[v,w,ch,randomUUID()]);await admin.query("INSERT INTO conversations(id,workspace_id,channel_id,visitor_id,reply_owner) VALUES($1,$2,$3,$4,'AI_ACTIVE')",[c,w,ch,v]);
 const run=<T>(fn:(db:pg.PoolClient)=>Promise<T>,workspace=w)=>transaction(async db=>{await scope(db,workspace);return fn(db);});
 const input={workspace:w,conversation:c,clientId:randomUUID(),author:'visitor' as const,visibility:'public' as const,body:'Hello'};
 const copies=await Promise.all([run(db=>appendMessage(db,input)),run(db=>appendMessage(db,input))]);assert.equal(copies[0].id,copies[1].id);assert.equal(copies[0].sequence,1);
 await assert.rejects(run(db=>appendMessage(db,{...input,body:'Changed'})),{code:'IDEMPOTENCY_CONFLICT'});
 await assert.rejects(run(db=>appendMessage(db,{...input,clientId:randomUUID(),author:'agent',actor:agent})),{code:'TAKEOVER_REQUIRED'});
 const wins=await Promise.allSettled([run(db=>takeover(db,w,c,agent,1)),run(db=>takeover(db,w,c,agent,1))]);assert.equal(wins.filter(x=>x.status==='fulfilled').length,1);
 await assert.rejects(run(db=>appendMessage(db,{...input,clientId:randomUUID(),author:'ai',ownerVersion:1})),{code:'STALE_REPLY_OWNER'});
 const reply=await run(db=>appendMessage(db,{...input,clientId:randomUUID(),author:'agent',actor:agent,body:'Reply'}));assert.equal(reply.sequence,2);assert.equal(reply.visitor_received_at,null);
 const note=await run(db=>appendMessage(db,{...input,clientId:randomUUID(),author:'agent',actor:agent,visibility:'internal',body:'Private note'}));assert.equal(note.sequence,3);
 await assert.rejects(run(db=>appendMessage(db,{...input,clientId:randomUUID(),visibility:'internal'})),{code:'INVALID_VISIBILITY'});
 const actor={workspace_id:w,user_id:agent,role:'Agent'};
 assert.equal((await run(db=>inboxList(db,actor))).length,0);
 await assert.rejects(run(db=>inboxMessages(db,actor,c,0)),{code:'NOT_FOUND'});
 await admin.query('INSERT INTO channel_members(workspace_id,channel_id,user_id) VALUES($1,$2,$3)',[w,ch,agent]);
 assert.equal((await run(db=>inboxList(db,actor))).length,1);
 assert.equal((await run(db=>inboxMessages(db,actor,c,2)))[0].visibility,'internal');
 const sent=await run(db=>inboxSend(db,actor,c,{clientId:randomUUID(),body:'Scoped reply',visibility:'public'}));assert.equal(sent.sequence,4);

 const replacement=randomUUID();
 await admin.query('INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,$3,$4,$5)',[replacement,replacement+'@example.test','Replacement','0900000000','disabled-test-identity']);
 await admin.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'Agent')",[w,replacement]);
 await run(db=>takeover(db,w,c,replacement,2));
 const retry={clientId:sent.client_id,body:'Scoped reply',visibility:'public'};
 assert.equal((await run(db=>inboxSend(db,actor,c,retry))).id,sent.id);
 await assert.rejects(run(db=>inboxSend(db,actor,c,{...retry,clientId:randomUUID()})),{code:'TAKEOVER_REQUIRED'});
 await assert.rejects(run(db=>inboxSend(db,actor,c,{...retry,body:'Changed retry'})),{code:'IDEMPOTENCY_CONFLICT'});
 assert.equal(Number((await run(db=>db.query('SELECT count(*) FROM messages WHERE conversation_id=$1',[c]))).rows[0].count),4);
 const resolved=await run(db=>inboxSetStatus(db,actor,c,{status:'resolved'}));
 assert.equal(resolved.status,'resolved');assert.equal(resolved.previousStatus,'open');
 const reopened=await run(db=>appendMessage(db,{...input,clientId:randomUUID(),body:'Khách nhắn lại'}));
 assert.equal(reopened.author_type,'visitor');
 assert.equal((await run(db=>db.query('SELECT status FROM conversations WHERE id=$1',[c]))).rows[0].status,'open');
 // Historic source must survive disconnect/re-auth in both inbox surfaces.
 const connection=randomUUID();
 await run(db=>db.query("INSERT INTO meta_connections(id,workspace_id,channel_id,external_page_id,page_name,page_access_token_ref) VALUES($1,$2,$3,$4,'Test Page','META_TEST_ONLY')",[connection,w,ch,randomUUID()]));
 for(const [kind,label] of [['facebook_messenger','Facebook Messenger'],['instagram_messaging','Instagram'],['whatsapp_business','WhatsApp']]){
  for(const status of ['connected','disconnected','reauth_required']){
   await run(db=>db.query('UPDATE meta_connections SET channel_kind=$1,status=$2 WHERE id=$3',[kind,status,connection]));
   const list=await run(db=>inboxList(db,actor));
   const detail=await run(db=>inboxDetail(db,actor,c));
   for(const item of [list[0],detail]){
    assert.equal(item.channel,label,`${kind}/${status} source`);
    assert.equal(item.websiteUrl,'',`${kind}/${status} must not expose placeholder website`);
   }
  }
 }
 await admin.query('DELETE FROM channel_members WHERE workspace_id=$1 AND user_id=$2',[w,agent]);
 await assert.rejects(run(db=>inboxTakeover(db,actor,c,{version:2})),{code:'NOT_FOUND'});
 await assert.rejects(run(db=>inboxSend(db,actor,c,retry)),{code:'NOT_FOUND'});
 assert.equal((await run(db=>db.query('SELECT id FROM messages'),other)).rowCount,0);
 await assert.rejects(run(db=>appendMessage(db,{...input,workspace:other,clientId:randomUUID()}),other),{code:'NOT_FOUND'});
});
