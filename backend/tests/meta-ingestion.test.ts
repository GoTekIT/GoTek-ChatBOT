import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID,createHmac} from 'node:crypto';
import {pool,scope,transaction} from '../src/core/db';
import {receiveMetaWebhook} from '../src/modules/meta/messenger';
import {aiReplyHandler} from '../src/modules/ai/ai-reply-worker';
import {runMetaWorkerOnce,runMetaProfileWorkerOnce,runAiWorkerOnce} from '../src/modules/jobs/worker';
import {enqueueJob} from '../src/modules/jobs/jobs';
import {appendMessage} from '../src/modules/chat/chat-store';
const enabled=!!process.env.META_TEST_ADMIN_URL && !!process.env.DB_RUNTIME_FILE;
const admin=enabled?new pg.Pool({connectionString:process.env.META_TEST_ADMIN_URL}):undefined;
after(async()=>{await pool.end();await admin?.end();});
test('Messenger signed inbound persists once under concurrent redelivery and isolates tenant reads',{skip:!enabled},async()=>{
 const workspace=randomUUID(),other=randomUUID(),channel=randomUUID(),connection=randomUUID(),page=randomUUID();
 process.env.META_PAGE_ID=page;process.env.META_WORKSPACE_ID=workspace;process.env.META_APP_SECRET='local-fixture-only';
 await admin!.query('INSERT INTO workspaces(id,name) VALUES($1,$2),($3,$4)',[workspace,'Meta fixture',other,'Other fixture']);
 await admin!.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'Messenger fixture','https://example.test','Hello','#0057E1',$3,$4,'{}')",[channel,workspace,randomUUID(),randomUUID()]);
 await admin!.query("INSERT INTO meta_connections(id,workspace_id,channel_id,external_page_id,page_name,page_access_token_ref) VALUES($1,$2,$3,$4,'Fixture','META_FIXTURE_TOKEN')",[connection,workspace,channel,page]);
 const raw=Buffer.from(JSON.stringify({object:'page',entry:[{id:page,messaging:[{sender:{id:'fixture-user'},recipient:{id:page},message:{mid:'fixture-mid',text:'Messenger integration fixture'}}]}]}));
 const signature='sha256='+createHmac('sha256',process.env.META_APP_SECRET).update(raw).digest('hex');
 const effects:Array<()=>void>=[];
 await assert.rejects(transaction(async db=>{
  await receiveMetaWebhook(db,raw,signature,effects);
  assert.equal(effects.length,1);
  throw new Error('fixture rollback');
 }),/fixture rollback/);
 // Rolled-back notifications are discarded rather than published.
 effects.length=0;
 const results=await Promise.all([transaction(db=>receiveMetaWebhook(db,raw,signature)),transaction(db=>receiveMetaWebhook(db,raw,signature))]);
 assert.equal(results.reduce((n,r)=>n+r.processed,0),1);
 await transaction(async db=>{await scope(db,workspace);assert.equal((await db.query('SELECT * FROM messages')).rowCount,1);assert.equal((await db.query("SELECT * FROM jobs WHERE kind='ai.reply'")).rowCount,1);assert.equal((await db.query('SELECT * FROM meta_events WHERE processed_at IS NOT NULL')).rowCount,1);});
 await transaction(async db=>{await scope(db,other);for(const table of ['messages','meta_events','meta_connections','meta_identities'])assert.equal((await db.query(`SELECT * FROM ${table}`)).rowCount,0);});
 await transaction(async db=>{await scope(db,workspace);assert.equal((await db.query("SELECT id FROM jobs WHERE kind='meta.profile.fetch'")).rowCount,1);});
 assert.equal((await runMetaProfileWorkerOnce(workspace,async(user,ref)=>{
  assert.equal(user,'fixture-user');assert.equal(ref,'META_FIXTURE_TOKEN');
  return {name:'Fixture Name',avatarUrl:'https://example.test/avatar'};
 })).state,'succeeded');
 await transaction(async db=>{await scope(db,workspace);
  const visitor=(await db.query('SELECT profile FROM visitors')).rows[0];
  assert.equal(visitor.profile.name,'Fixture Name');assert.equal(visitor.profile.avatarUrl,'https://example.test/avatar');
  assert.equal(visitor.profile.email,undefined);
 });
 const provider=randomUUID(),model=randomUUID();
 await admin!.query("INSERT INTO providers(id,name,adapter,secret_ref,enabled) VALUES($1,$2,'local','FIXTURE_AI',true)",[provider,provider]);
 await admin!.query("INSERT INTO models(id,provider_id,name,capabilities,enabled) VALUES($1,$2,'fixture',ARRAY['chat'],true)",[model,provider]);
 await admin!.query("INSERT INTO model_grants(id,workspace_id,model_id,capability,active) VALUES($1,$2,$3,'chat',true)",[randomUUID(),workspace,model]);
 await admin!.query("INSERT INTO quota_budgets(id,workspace_id,meter,period_start,period_end,limit_units) VALUES($1,$2,'ai_response',now()-interval '1 minute',now()+interval '1 day',10)",[randomUUID(),workspace]);
 await transaction(async db=>{
  await scope(db,workspace);
  const source=(await db.query("SELECT id,conversation_id FROM messages WHERE author_type='visitor'")).rows[0];
  const job={workspace_id:workspace,payload:{conversationId:source.conversation_id,messageId:source.id,ownerVersion:1}};
  const reply=aiReplyHandler(db,async()=>'Generated Messenger fixture');
  await reply(job);await reply(job);
  assert.equal((await db.query("SELECT * FROM jobs WHERE kind='meta.message.send'")).rowCount,1);
  // Keep the following dispatch cases isolated from this generated fixture job.
  await db.query("UPDATE jobs SET state='succeeded',receipt_id='fixture-only' WHERE kind='meta.message.send'");
 });
 let conversation='',message='';
 await transaction(async db=>{
  await scope(db,workspace);
  conversation=(await db.query('SELECT id FROM conversations')).rows[0].id;
  message=(await appendMessage(db,{workspace,conversation,clientId:randomUUID(),author:'ai',visibility:'public',ownerVersion:1,body:'AI fixture reply'})).id;
  await enqueueJob(db,workspace,{kind:'meta.message.send',key:randomUUID(),payload:{conversationId:conversation,messageId:message,ownerVersion:1,recipientId:'untrusted',tokenRef:'untrusted'},external:true,maxAttempts:1});
 });
 let sends=0;
 const accepted=await runMetaWorkerOnce(workspace,async input=>{
  sends++;assert.equal(input.recipientId,'fixture-user');assert.equal(input.pageAccessTokenRef,'META_FIXTURE_TOKEN');
  return {status:'accepted',providerMessageId:'fixture-receipt'};
 });
 assert.equal(accepted.state,'succeeded');assert.equal(sends,1);
 // Multiple connected accounts must never choose a token by recency.
 const ambiguous=randomUUID();
 await admin!.query("INSERT INTO meta_connections(id,workspace_id,channel_id,external_page_id,page_name,page_access_token_ref) VALUES($1,$2,$3,$4,'Ambiguous','META_OTHER_TOKEN')",[ambiguous,workspace,channel,randomUUID()]);
 await transaction(async db=>{await scope(db,workspace);await enqueueJob(db,workspace,{kind:'meta.message.send',key:randomUUID(),payload:{conversationId:conversation,messageId:message,ownerVersion:1},external:true,maxAttempts:1});});
 const blocked=await runMetaWorkerOnce(workspace,async()=>{sends++;throw new Error('Ambiguous mapping must not dispatch');});
 assert.equal(blocked.state,'dead');assert.equal(sends,1);
 await transaction(async db=>{await scope(db,workspace);assert.equal((await db.query("SELECT id FROM jobs WHERE kind='meta.message.send' AND error_code='META_DISPATCH_INVALID'")).rowCount,1);});
 await admin!.query('DELETE FROM meta_connections WHERE id=$1',[ambiguous]);

 await transaction(async db=>{
  await scope(db,workspace);
  await enqueueJob(db,workspace,{kind:'meta.message.send',key:randomUUID(),payload:{conversationId:conversation,messageId:message,ownerVersion:1},external:true,maxAttempts:1});
  await db.query("UPDATE conversations SET reply_owner='HUMAN_ACTIVE',owner_version=owner_version+1 WHERE id=$1",[conversation]);
 });
 const stale=await runMetaWorkerOnce(workspace,async()=>{sends++;throw new Error('stale AI must never send');});
 assert.equal(stale.state,'dead');assert.equal(sends,1);
 await transaction(async db=>{await scope(db,workspace);assert.equal((await db.query("SELECT error_code FROM jobs WHERE state='dead' AND kind='meta.message.send' AND error_code='STALE_REPLY_OWNER'")).rows[0].error_code,'STALE_REPLY_OWNER');});

 assert.equal((await runAiWorkerOnce(workspace,async()=>{throw new Error('Stale AI must never invoke provider');})).state,'dead');
 // A takeover must wait until an already-started dispatch releases its lock.
 await transaction(async db=>{
  await scope(db,workspace);
  await db.query("UPDATE conversations SET reply_owner='AI_ACTIVE' WHERE id=$1",[conversation]);
  const version=(await db.query('SELECT owner_version FROM conversations WHERE id=$1',[conversation])).rows[0].owner_version;
  await enqueueJob(db,workspace,{kind:'meta.message.send',key:randomUUID(),payload:{conversationId:conversation,messageId:message,ownerVersion:version},external:true,maxAttempts:1});
 });
 let release!:()=>void,entered!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const started=new Promise<void>(resolve=>{entered=resolve;});
 const dispatch=runMetaWorkerOnce(workspace,async()=>{entered();await gate;return {status:'accepted',providerMessageId:'race-receipt'};});
 await started;
 try{
  await assert.rejects(transaction(async db=>{
   await scope(db,workspace);
   await db.query("SET LOCAL lock_timeout='100ms'");
   await db.query("UPDATE conversations SET reply_owner='HUMAN_ACTIVE',owner_version=owner_version+1 WHERE id=$1",[conversation]);
  }),{code:'55P03'});
 }finally{release();}
 assert.equal((await dispatch).state,'succeeded');
 await transaction(async db=>{
  await scope(db,workspace);
  assert.equal((await db.query("UPDATE conversations SET reply_owner='HUMAN_ACTIVE',owner_version=owner_version+1 WHERE id=$1 RETURNING id",[conversation])).rowCount,1);
 });
 const media=Buffer.from(JSON.stringify({object:'page',entry:[{id:page,messaging:[{sender:{id:'fixture-user'},recipient:{id:page},message:{mid:'media-fixture',attachments:[{type:'image',payload:{url:'https://example.test/image.jpg'}},{type:'video',payload:{url:'https://example.test/video.mp4'}}]}}]}]}));
 const mediaSignature='sha256='+createHmac('sha256',process.env.META_APP_SECRET!).update(media).digest('hex');
 assert.equal((await transaction(db=>receiveMetaWebhook(db,media,mediaSignature))).processed,1);
 assert.equal((await transaction(db=>receiveMetaWebhook(db,media,mediaSignature))).processed,0);
 await transaction(async db=>{
  await scope(db,workspace);
  const rows=(await db.query('SELECT kind FROM message_attachments ORDER BY kind')).rows;
  assert.deepEqual(rows.map(r=>r.kind),['image','video']);
 });
 await transaction(async db=>{await scope(db,other);assert.equal((await db.query('SELECT * FROM message_attachments')).rowCount,0);});
 const mediaClient=randomUUID();
 const mediaInput={workspace,conversation,clientId:mediaClient,author:'visitor' as const,visibility:'public' as const,body:'Media retry',attachments:[{type:'image' as const,url:'https://example.test/retry.jpg'}]};
 await transaction(async db=>{await scope(db,workspace);const first=await appendMessage(db,mediaInput);const second=await appendMessage(db,mediaInput);assert.equal(first.id,second.id);assert.deepEqual(second.attachments,mediaInput.attachments);});
 await assert.rejects(transaction(async db=>{await scope(db,workspace);return appendMessage(db,{...mediaInput,attachments:[{type:'image',url:'https://example.test/changed.jpg'}]});}),{code:'IDEMPOTENCY_CONFLICT'});
 const providerInput={workspace,conversation,clientId:randomUUID(),author:'visitor' as const,visibility:'public' as const,body:'WhatsApp media',providerMedia:[{type:'video' as const,id:'media-fixture-1'}]};
 await transaction(async db=>{await scope(db,workspace);
  const first=await appendMessage(db,providerInput);const replay=await appendMessage(db,providerInput);
  assert.equal(first.id,replay.id);
  assert.equal((await db.query('SELECT id FROM meta_media_references WHERE message_id=$1',[first.id])).rowCount,1);
 });
 for(const providerMedia of [[],[{type:'video' as const,id:'media-fixture-2'}],[{type:'image' as const,id:'media-fixture-1'}]]){
  await assert.rejects(transaction(async db=>{await scope(db,workspace);return appendMessage(db,{...providerInput,providerMedia});}),{code:'IDEMPOTENCY_CONFLICT'});
 }
 await transaction(async db=>{await scope(db,other);assert.equal((await db.query('SELECT id FROM meta_media_references')).rowCount,0);});
 await assert.rejects(transaction(db=>receiveMetaWebhook(db,Buffer.from('{}'),signature)),{code:'META_SIGNATURE_INVALID'});
});

test('Instagram and WhatsApp persist independently with signed redelivery and tenant isolation',{skip:!enabled},async()=>{
 const workspace=randomUUID(),other=randomUUID();
 process.env.META_WORKSPACE_ID=workspace;process.env.META_APP_SECRET='multichannel-fixture';
 await admin!.query('INSERT INTO workspaces(id,name) VALUES($1,$2),($3,$4)',[workspace,'Multi Meta fixture',other,'Other Meta fixture']);
 const cases=[{kind:'instagram_messaging',account:'100001',body:{object:'instagram',entry:[{id:'100001',messaging:[{sender:{id:'shared-user'},recipient:{id:'100001'},message:{mid:'same-mid',text:'Instagram fixture'}}]}]}},{kind:'whatsapp_business',account:'100002',body:{object:'whatsapp_business_account',entry:[{id:'waba-id-not-phone-id',changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:'100002'},messages:[{from:'shared-user',id:'same-mid',type:'text',text:{body:'WhatsApp fixture'}}]}}]}]}}];
 for(const fixture of cases){
  const channel=randomUUID(),connection=randomUUID();
  await admin!.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'Meta fixture','https://example.test','Hello','#0057E1',$3,$4,'{}')",[channel,workspace,randomUUID(),randomUUID()]);
  await admin!.query("INSERT INTO meta_connections(id,workspace_id,channel_id,channel_kind,external_page_id,page_name,page_access_token_ref) VALUES($1,$2,$3,$4,$5,'Fixture','META_FIXTURE_TOKEN')",[connection,workspace,channel,fixture.kind,fixture.account]);
  const raw=Buffer.from(JSON.stringify(fixture.body));
  const signature:string='sha256='+createHmac('sha256',process.env.META_APP_SECRET!).update(raw).digest('hex');
  const effects:Array<()=>void>=[];
  const received:Array<{accepted:boolean;processed:number}>=await Promise.all([transaction(db=>receiveMetaWebhook(db,raw,signature,effects)),transaction(db=>receiveMetaWebhook(db,raw,signature,effects))]);
  assert.equal(received.reduce((sum,r)=>sum+r.processed,0),1);
  assert.equal(effects.length,1);
  await transaction(async db=>{await scope(db,workspace);
   const rows=(await db.query('SELECT m.body,v.profile FROM messages m JOIN conversations c ON c.id=m.conversation_id JOIN visitors v ON v.id=c.visitor_id WHERE c.channel_id=$1',[channel])).rows;
   assert.equal(rows.length,1);assert.equal(rows[0].profile.source,fixture.kind);
   assert.equal(rows[0].body,fixture.kind==='instagram_messaging'?'Instagram fixture':'WhatsApp fixture');
  });
 }
 await transaction(async db=>{await scope(db,workspace);
  assert.equal((await db.query('SELECT id FROM conversations')).rowCount,2);
  assert.equal((await db.query('SELECT id FROM meta_identities')).rowCount,2);
  assert.equal((await db.query("SELECT id FROM jobs WHERE kind='ai.reply'")).rowCount,2);
 });
 const mediaBody={object:'whatsapp_business_account',entry:[{id:'waba-id-not-phone-id',changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:'100002'},messages:[{from:'shared-user',id:'wa-image',type:'image',image:{id:'image-id'}},{from:'shared-user',id:'wa-video',type:'video',video:{id:'video-id'}}]}}]}]};
 const rawMedia=Buffer.from(JSON.stringify(mediaBody));
 const mediaSig='sha256='+createHmac('sha256',process.env.META_APP_SECRET!).update(rawMedia).digest('hex');
 assert.equal((await transaction(db=>receiveMetaWebhook(db,rawMedia,mediaSig))).processed,2);
 assert.equal((await transaction(db=>receiveMetaWebhook(db,rawMedia,mediaSig))).processed,0);
 await transaction(async db=>{await scope(db,workspace);
  const refs=(await db.query('SELECT media_type,external_media_id FROM meta_media_references ORDER BY media_type')).rows;
  assert.deepEqual(refs,[{media_type:'image',external_media_id:'image-id'},{media_type:'video',external_media_id:'video-id'}]);
  assert.equal((await db.query('SELECT id FROM messages')).rowCount,4);
  assert.equal((await db.query("SELECT id FROM jobs WHERE kind='ai.reply'")).rowCount,2);
  assert.equal((await db.query('SELECT message_id FROM message_attachments')).rowCount,0);
 });
 await transaction(async db=>{await scope(db,other);for(const table of ['messages','conversations','meta_identities','meta_events','meta_media_references'])assert.equal((await db.query(`SELECT id FROM ${table}`)).rowCount,0);});
});
