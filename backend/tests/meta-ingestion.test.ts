import {reconcileMetaReceipt} from '../src/modules/meta/receipts';
import {inboxList,inboxDetail} from '../src/modules/chat/inbox';
import {createMetaConnection,listMetaConnections,disconnectMetaConnection,listInboxSources,verifyMetaConnection} from '../src/modules/meta/connections';
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
 const mixed=Buffer.from(JSON.stringify({object:'page',entry:[{id:page,messaging:[{sender:{id:'fixture-user'},recipient:{id:page},message:{mid:'fixture-mid',text:'Messenger integration fixture'}}]},{id:'unrelated-page',messaging:[{sender:{id:'private-other-user'},recipient:{id:'unrelated-page'},message:{mid:'other-mid',text:'must-not-be-retained'}}]}]}));
 // Fresh event, same sender: isolate persisted payload even for batched accounts.
 const mixedBody=JSON.parse(mixed.toString());mixedBody.entry[0].messaging[0].message.mid='mixed-mid';
 const mixedRaw=Buffer.from(JSON.stringify(mixedBody));
 await assert.rejects(transaction(async db=>{
  await receiveMetaWebhook(db,mixedRaw,'sha256='+createHmac('sha256',process.env.META_APP_SECRET!).update(mixedRaw).digest('hex'));
  const payload=(await db.query("SELECT payload FROM meta_events WHERE external_event_id='mixed-mid'")).rows[0].payload;
  assert.equal(payload.externalAccountId,page);
  assert.equal(payload.text,'Messenger integration fixture');
  assert.equal(JSON.stringify(payload).includes('must-not-be-retained'),false);
  assert.equal(payload.entry,undefined);
  throw new Error('isolated payload fixture rollback');
 }),/isolated payload fixture rollback/);
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
 const boundSend=await runMetaWorkerOnce(workspace,async input=>{
  assert.equal(input.pageAccessTokenRef,'META_FIXTURE_TOKEN');
  assert.equal(input.recipientId,'fixture-user');
  return {status:'accepted',providerMessageId:'bound-source-receipt'};
 });
 assert.equal(boundSend.state,'succeeded');
 await admin!.query("UPDATE meta_connections SET status='disconnected' WHERE id=$1",[connection]);
 await transaction(async db=>{await scope(db,workspace);await enqueueJob(db,workspace,{kind:'meta.message.send',key:randomUUID(),payload:{conversationId:conversation,messageId:message,ownerVersion:1},external:true,maxAttempts:1});});
 const switched=await runMetaWorkerOnce(workspace,async()=>{sends++;throw new Error('Replacement account must not dispatch old conversation');});
 assert.equal(switched.state,'dead');assert.equal(sends,1);
 await admin!.query("UPDATE meta_connections SET status='connected' WHERE id=$1",[connection]);
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
  const uniqueAccount=randomUUID();
  fixture.body=JSON.parse(JSON.stringify(fixture.body).replaceAll(fixture.account,uniqueAccount));
  fixture.account=uniqueAccount;
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
 const sendNamed=async(name:string,id:string)=>{
  const raw=Buffer.from(JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:cases[1].account},contacts:[{wa_id:'shared-user',profile:{name}}],messages:[{from:'shared-user',id,type:'text',text:{body:'Name refresh'}}]}}]}]}));
  const sig='sha256='+createHmac('sha256',process.env.META_APP_SECRET!).update(raw).digest('hex');
  return transaction(db=>receiveMetaWebhook(db,raw,sig));
 };
 await sendNamed('Nguyễn An','name-refresh-1');
 await transaction(async db=>{await scope(db,workspace);
  assert.equal((await db.query("SELECT profile->>'name' AS name FROM visitors WHERE profile->>'source'='whatsapp_business'")).rows[0].name,'Nguyễn An');
  await db.query("UPDATE visitors SET profile=jsonb_set(profile,'{name}','\"Staff label\"'::jsonb) WHERE profile->>'source'='whatsapp_business'");
 });
 await sendNamed('Provider new name','name-refresh-2');
 await transaction(async db=>{await scope(db,workspace);assert.equal((await db.query("SELECT profile->>'name' AS name FROM visitors WHERE profile->>'source'='whatsapp_business'")).rows[0].name,'Staff label');});
 const mediaBody={object:'whatsapp_business_account',entry:[{id:'waba-id-not-phone-id',changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:cases[1].account},messages:[{from:'shared-user',id:'wa-image',type:'image',image:{id:'image-id'}},{from:'shared-user',id:'wa-video',type:'video',video:{id:'video-id'}}]}}]}]};
 const rawMedia=Buffer.from(JSON.stringify(mediaBody));
 const mediaSig='sha256='+createHmac('sha256',process.env.META_APP_SECRET!).update(rawMedia).digest('hex');
 assert.equal((await transaction(db=>receiveMetaWebhook(db,rawMedia,mediaSig))).processed,2);
 assert.equal((await transaction(db=>receiveMetaWebhook(db,rawMedia,mediaSig))).processed,0);
 await transaction(async db=>{await scope(db,workspace);
  const refs=(await db.query('SELECT media_type,external_media_id FROM meta_media_references ORDER BY media_type')).rows;
  assert.deepEqual(refs,[{media_type:'image',external_media_id:'image-id'},{media_type:'video',external_media_id:'video-id'}]);
  assert.equal((await db.query('SELECT id FROM messages')).rowCount,6);
  assert.equal((await db.query("SELECT id FROM jobs WHERE kind='ai.reply'")).rowCount,4);
  assert.equal((await db.query('SELECT message_id FROM message_attachments')).rowCount,0);
 });
 await transaction(async db=>{await scope(db,other);for(const table of ['messages','conversations','meta_identities','meta_events','meta_media_references'])assert.equal((await db.query(`SELECT id FROM ${table}`)).rowCount,0);});
});

test('WhatsApp persists each receipt transition once, including reverse arrival order',{skip:!enabled},async()=>{
 const workspace=randomUUID(),channel=randomUUID(),connection=randomUUID(),phone=randomUUID();
 process.env.META_WORKSPACE_ID=workspace;process.env.META_APP_SECRET='local-fixture-only';
 await admin!.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspace,'Receipt fixture']);
 await admin!.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'Receipt fixture','https://example.test','Hi','#0057E1',$3,$4,'{}')",[channel,workspace,randomUUID(),randomUUID()]);
 await admin!.query("INSERT INTO meta_connections(id,workspace_id,channel_id,external_page_id,page_name,page_access_token_ref,channel_kind) VALUES($1,$2,$3,$4,'Fixture','META_FIXTURE_TOKEN','whatsapp_business')",[connection,workspace,channel,phone]);
 await transaction(async db=>{
  await scope(db,workspace);
  const view=await listMetaConnections(db,{workspace_id:workspace,role:'Owner'});
  assert.equal(view.connections.length,1);
  assert.equal(view.connections[0].id,connection);
  assert.equal('page_access_token_ref' in view.connections[0],false);
  await assert.rejects(listMetaConnections(db,{workspace_id:workspace,role:'Agent'}),{code:'FORBIDDEN'});
  const other=randomUUID();await scope(db,other);
  assert.equal((await listMetaConnections(db,{workspace_id:other,role:'Owner'})).connections.length,0);
 });
 const inbound=Buffer.from(JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:phone},messages:[{from:'fixture-recipient',id:'receipt-source-inbound',type:'text',text:{body:'Fixture'}}]}}]}]}));
 await transaction(db=>receiveMetaWebhook(db,inbound,'sha256='+createHmac('sha256',process.env.META_APP_SECRET!).update(inbound).digest('hex')));
 for(const status of ['read','delivered','sent','sent','read']){
  const raw=Buffer.from(JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:phone},statuses:[{id:'same-mid',status,recipient_id:'fixture-recipient'}]}}]}]}));
  const signature='sha256='+createHmac('sha256',process.env.META_APP_SECRET).update(raw).digest('hex');
  await transaction(db=>receiveMetaWebhook(db,raw,signature));
 }
 await admin!.query(`INSERT INTO meta_message_deliveries(id,workspace_id,message_id,connection_id,provider_message_id,status)
 SELECT $1,$2,m.id,$3,'same-mid','accepted' FROM messages m WHERE m.workspace_id=$2 LIMIT 1`,[randomUUID(),workspace,connection]);
 const sibling=randomUUID(),siblingPhone=randomUUID();
 await admin!.query("INSERT INTO meta_connections(id,workspace_id,channel_id,external_page_id,page_name,page_access_token_ref,channel_kind) VALUES($1,$2,$3,$4,'Sibling','META_FIXTURE_TOKEN','whatsapp_business')",[sibling,workspace,channel,siblingPhone]);
 const siblingRaw=Buffer.from(inbound.toString().replaceAll(phone,siblingPhone));
 await transaction(db=>receiveMetaWebhook(db,siblingRaw,'sha256='+createHmac('sha256',process.env.META_APP_SECRET!).update(siblingRaw).digest('hex')));
 await admin!.query(`INSERT INTO meta_message_deliveries(id,workspace_id,message_id,connection_id,provider_message_id,status)
 SELECT $1,$2,m.id,$3,'same-mid','accepted' FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.connection_id=$3 LIMIT 1`,[randomUUID(),workspace,sibling]);
 await assert.rejects(admin!.query('UPDATE meta_message_deliveries SET connection_id=$1 WHERE workspace_id=$2 AND connection_id=$3',[sibling,workspace,connection]),{code:'23514'});
 await assert.rejects(admin!.query('UPDATE conversations SET connection_id=$1 WHERE workspace_id=$2 AND connection_id=$3',[sibling,workspace,connection]),{code:'23514'});
 await transaction(async db=>{await scope(db,workspace);await reconcileMetaReceipt(db,workspace,connection,'same-mid');});
 await transaction(async db=>{
  await scope(db,workspace);
  assert.equal((await db.query('SELECT status FROM meta_message_deliveries WHERE connection_id=$1',[connection])).rows[0].status,'read');
  assert.equal((await db.query('SELECT status FROM meta_message_deliveries WHERE connection_id=$1',[sibling])).rows[0].status,'accepted');
  const receipts=(await db.query("SELECT event_kind,payload FROM meta_events WHERE connection_id=$1 AND event_kind LIKE 'status:%' ORDER BY event_kind",[connection])).rows;
  assert.deepEqual(receipts.map(r=>r.event_kind),['status:delivered','status:read','status:sent']);
  assert.ok(receipts.every(r=>r.payload.providerMessageId==='same-mid'&&!r.payload.entry));
  assert.equal((await db.query('SELECT id FROM messages')).rowCount,2);
 });
});

test('disconnect is scoped, audited once and preserves connection history',{skip:!enabled},async()=>{
 const workspace=randomUUID(),other=randomUUID(),channel=randomUUID(),connection=randomUUID(),user=randomUUID();
 await admin!.query("INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,'Fixture','','unused')",[user,user+'@example.test']);
 await admin!.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspace,'Disconnect fixture']);
 await admin!.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'Fixture','https://example.test','Hi','#0057E1',$3,$4,'{}')",[channel,workspace,randomUUID(),randomUUID()]);
 await admin!.query("INSERT INTO meta_connections(id,workspace_id,channel_id,external_page_id,page_name,page_access_token_ref) VALUES($1,$2,$3,$4,'Fixture','META_FIXTURE_TOKEN')",[connection,workspace,channel,randomUUID()]);
 const actor={workspace_id:workspace,user_id:user,role:'Owner'};
 await assert.rejects(transaction(async db=>{await scope(db,workspace);return disconnectMetaConnection(db,{...actor,role:'Agent'},connection);}),{code:'FORBIDDEN'});
 await assert.rejects(transaction(async db=>{await scope(db,other);return disconnectMetaConnection(db,{...actor,workspace_id:other},connection);}),{code:'META_CONNECTION_NOT_FOUND'});
 await transaction(async db=>{await scope(db,workspace);
  for(let i=0;i<2;i++)assert.equal((await disconnectMetaConnection(db,actor,connection)).status,'disconnected');
  assert.equal((await db.query('SELECT id FROM meta_connections WHERE id=$1',[connection])).rowCount,1);
  assert.equal((await db.query("SELECT id FROM audit_events WHERE object_id=$1 AND action='meta.connection_disconnected'",[connection])).rowCount,1);
 });
});

test('one signed envelope routes three Pages across two workspaces without configured tenant',{skip:!enabled},async()=>{
 delete process.env.META_WORKSPACE_ID;
 process.env.META_APP_SECRET='mixed-workspace-fixture';
 const workspaces=[randomUUID(),randomUUID()];
 const pages=[randomUUID(),randomUUID(),randomUUID()];
 for(const workspace of workspaces) await admin!.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspace,'Routing fixture']);
 for(let i=0;i<pages.length;i++){
  const workspace=workspaces[i===2?1:0],channel=randomUUID();
  await admin!.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'Route','https://example.test','Hello','#0057E1',$3,$4,'{}')",[channel,workspace,randomUUID(),randomUUID()]);
  await admin!.query("INSERT INTO meta_connections(id,workspace_id,channel_id,external_page_id,page_name,page_access_token_ref) VALUES($1,$2,$3,$4,'Route','META_FIXTURE_TOKEN')",[randomUUID(),workspace,channel,pages[i]]);
 }
 const raw=Buffer.from(JSON.stringify({object:'page',entry:[...pages.map(page=>({id:page,messaging:[{sender:{id:'same-person'},recipient:{id:page},message:{mid:'mid-'+page,text:'From '+page}}]})),{id:'unrelated-page',messaging:[{sender:{id:'unknown'},recipient:{id:'unrelated-page'},message:{mid:'unknown-mid',text:'quarantine'}}]}]}));
 const signature='sha256='+createHmac('sha256',process.env.META_APP_SECRET).update(raw).digest('hex');
 assert.equal((await transaction(db=>receiveMetaWebhook(db,raw,signature))).processed,3);
 await transaction(async db=>{await db.query("SELECT set_config('app.meta_worker','true',true)"); assert.equal((await db.query("SELECT external_account_id,reason FROM meta_webhook_quarantine WHERE external_account_id='unrelated-page'")).rows[0].reason,'NO_CONNECTION_MAPPING');});
 assert.equal((await transaction(db=>receiveMetaWebhook(db,raw,signature))).processed,0);
 for(let i=0;i<workspaces.length;i++) await transaction(async db=>{
  await scope(db,workspaces[i]);
  const expected=i===0?2:1;
  const actor={workspace_id:workspaces[i],user_id:randomUUID(),role:'Owner'};
  const bound=(await db.query('SELECT connection_id FROM conversations')).rows;
  assert.ok(bound.every(row=>row.connection_id));
  const sources=await listInboxSources(db,actor);
  assert.equal(sources.length,expected);
  assert.equal((await listInboxSources(db,{...actor,role:'Agent'})).length,0);
  assert.equal(JSON.stringify(sources).includes('META_FIXTURE_TOKEN'),false);
  const inbox=await inboxList(db,actor);
  assert.equal(inbox.length,expected);
  for(const conversation of inbox){
   assert.equal(conversation.accountName,'Route');
   assert.equal(conversation.platform,'facebook_messenger');
   assert.ok(conversation.connectionId);
   const detail=await inboxDetail(db,actor,conversation.id);
   assert.equal(detail.connectionId,conversation.connectionId);
   assert.equal(detail.externalAccountId,conversation.externalAccountId);
  }
  assert.equal((await inboxList(db,actor,{connectionIds:[inbox[0].connectionId]})).length,1);
  assert.equal((await inboxList(db,actor,{platforms:['whatsapp_business']})).length,0);
  for(const table of ['conversations','visitors','messages','meta_identities','meta_events'])
   assert.equal((await db.query(`SELECT id FROM ${table}`)).rowCount,expected,table);
 });
 const source=(await admin!.query('SELECT * FROM meta_connections WHERE external_page_id=$1',[pages[0]])).rows[0];
 await assert.rejects(admin!.query("INSERT INTO meta_connections(id,workspace_id,channel_id,external_page_id,page_name,page_access_token_ref) SELECT $1,workspace_id,channel_id,$2,'Conflict','META_FIXTURE_TOKEN' FROM meta_connections WHERE external_page_id=$3",[randomUUID(),source.external_page_id,pages[2]]),{code:'23505'});
});


test('concurrent account linking permits only one active connection on a channel',{skip:!enabled},async()=>{
 const workspace=randomUUID(),channel=randomUUID(),user=randomUUID();
 const ref='META_CONCURRENT_LINK_TEST';process.env[ref]='fixture-only';
 await admin!.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspace,'Concurrent linking fixture']);
 await admin!.query("INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,'Fixture','','unused')",[user,user+'@example.test']);
 await admin!.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'Fixture','https://example.test','Hi','#0057E1',$3,$4,'{}')",[channel,workspace,randomUUID(),randomUUID()]);
 const actor={workspace_id:workspace,user_id:user,role:'Owner'};
 const account=BigInt('0x'+randomUUID().replaceAll('-','')).toString();
 try{
  const outcomes=await Promise.allSettled([account,account+'1'].map(externalAccountId=>transaction(async db=>{
   await scope(db,workspace);
   return createMetaConnection(db,actor,{channelId:channel,platform:'facebook_messenger',externalAccountId,accountName:'Test',tokenRef:ref});
  })));
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  const rejected=outcomes.find(r=>r.status==='rejected') as PromiseRejectedResult;
  assert.equal(rejected.reason.code,'META_CHANNEL_ALREADY_BOUND');
  assert.equal((await admin!.query('SELECT id FROM meta_connections WHERE channel_id=$1',[channel])).rowCount,1);
 }finally{delete process.env[ref];}
});

test('reconnect rejects a disconnected connection when its channel is occupied',{skip:!enabled},async()=>{
 const workspace=randomUUID(),channel=randomUUID(),user=randomUUID(),first=randomUUID(),second=randomUUID();
 const ref='META_RECONNECT_LINK_TEST';process.env[ref]='fixture-only';
 await admin!.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspace,'Reconnect linking fixture']);
 await admin!.query("INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,'Fixture','','unused')",[user,user+'@example.test']);
 await admin!.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'Fixture','https://example.test','Hi','#0057E1',$3,$4,'{}')",[channel,workspace,randomUUID(),randomUUID()]);
 await admin!.query("INSERT INTO meta_connections(id,workspace_id,channel_id,channel_kind,external_page_id,page_name,page_access_token_ref,status) VALUES($1,$2,$3,'facebook_messenger',$4,'First',$5,'disconnected'),($6,$2,$3,'facebook_messenger',$7,'Second',$5,'pending')",[first,workspace,channel,randomUUID(),ref,second,randomUUID()]);
 const actor={workspace_id:workspace,user_id:user,role:'Owner'};
 const originalFetch=globalThis.fetch;let calls=0;globalThis.fetch=async(input)=>{calls++;const account=String(input).split('?')[0].split('/').pop();return new Response(JSON.stringify({id:account}),{status:200,headers:{'content-type':'application/json'}})};
 try{await assert.rejects(transaction(async db=>{await scope(db,workspace);return verifyMetaConnection(db,actor,first)}),error=>(error as any)?.code==='META_CHANNEL_ALREADY_BOUND');assert.equal(calls,0);
  await admin!.query("UPDATE meta_connections SET status='disconnected' WHERE id=$1",[second]);
  const result=await transaction(async db=>{await scope(db,workspace);return verifyMetaConnection(db,actor,first)});assert.equal(result.status,'connected');assert.equal(calls,1);
 }finally{globalThis.fetch=originalFetch;delete process.env[ref];}
});
