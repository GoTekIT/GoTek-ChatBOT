import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {storeMetaCredential,resolveMetaCredential} from '../src/modules/meta/credential-vault';
import {pool,scope} from '../src/core/db';
import {queueMetaBody,processNormalizedMetaStatus,processNormalizedMetaInbound} from '../src/modules/meta/messenger';
import {inboxMessages} from '../src/modules/chat/inbox';
import {syncMetaHistoryOnce} from '../src/modules/meta/history';
after(()=>pool.end());
test('database history records both sides, replay dedupes and tenant remains isolated',{skip:process.env.META_HISTORY_DB_TEST!=='true'},async()=>{
 const db=await pool.connect(); const w=randomUUID(),ch=randomUUID(),conn=randomUUID(),other=randomUUID();
 const oldKey=process.env.META_CREDENTIAL_ENCRYPTION_KEY;
 process.env.META_CREDENTIAL_ENCRYPTION_KEY=randomBytes(32).toString('base64');
 process.env.HISTORY_DB_TOKEN='fake-provider-only';
 try{
 await db.query('BEGIN');await scope(db,w);
 await db.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[w,'Rollback history test']);
 await db.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'History fixture','https://example.test','Hi','#0057E1',$3,$4,'{}')",[ch,w,randomUUID(),randomUUID()]);
 await db.query("INSERT INTO meta_connections(id,workspace_id,channel_id,external_page_id,page_name,page_access_token_ref,status,webhook_subscribed_at) VALUES($1,$2,$3,$4,'History fixture','HISTORY_DB_TOKEN','connected',now())",[conn,w,ch,conn]);
 await storeMetaCredential(db,w,conn,'encrypted-fake-provider');
 const receiptEnvelope={object:'page',entry:[{id:conn,messaging:[{sender:{id:'customer'},recipient:{id:conn},delivery:{mids:['receipt-test']}},{sender:{id:'customer'},recipient:{id:conn},read:{mid:'receipt-test'}}]}]};
 await queueMetaBody(db,receiptEnvelope);await queueMetaBody(db,receiptEnvelope);
 const queuedStatuses=(await db.query("SELECT payload->>'status' AS status FROM meta_webhook_ingress WHERE workspace_id=$1 AND event_kind='status' ORDER BY payload->>'status'",[w])).rows;
 assert.deepEqual(queuedStatuses,[{status:'delivered'},{status:'read'}]);

 assert.equal(await resolveMetaCredential(db,w,conn,'HISTORY_DB_TOKEN'),'encrypted-fake-provider');
 const response={data:[{participants:{data:[{id:conn,name:'Page'},{id:'customer',name:'Customer'}]},messages:{data:[{id:'outbound',from:{id:conn},message:'Reply',attachments:{data:[{image_data:{url:'https://cdn.example.test/reply.jpg'}}]},created_time:'2026-09-01T01:02:00Z'},{id:'inbound',from:{id:'customer',name:'Customer'},message:'Hello',attachments:{data:[{video_data:{url:'https://cdn.example.test/customer.mp4'}}]},created_time:'2026-09-01T01:01:00Z'}]}}]};
 const nestedUrl='https://graph.facebook.com/v26.0/thread/messages?after=older';
 Object.assign(response.data[0].messages,{paging:{next:nestedUrl+'&access_token=must-not-persist'}});
 const fetched:string[]=[];
 const transport:typeof fetch=async url=>{fetched.push(String(url));return new Response(JSON.stringify(String(url)===nestedUrl?{data:response.data[0].messages.data}:response));};
 await syncMetaHistoryOnce(db,w,conn,transport);
 const messages=(await db.query('SELECT author_type,body,created_at FROM messages WHERE workspace_id=$1 ORDER BY created_at',[w])).rows;
 assert.deepEqual(messages.map(m=>[m.author_type,m.body]),[['visitor','Hello'],['agent','Reply']]);
 assert.equal(messages[1].created_at.toISOString(),'2026-09-01T01:02:00.000Z');
 assert.equal((await db.query('SELECT id FROM jobs WHERE workspace_id=$1',[w])).rowCount,0);
 await db.query("UPDATE meta_history_sync SET last_synced_at=now()-interval '1 day' WHERE workspace_id=$1",[w]);
 await syncMetaHistoryOnce(db,w,conn,transport);
 assert.equal(fetched[1],nestedUrl);
 const checkpoint=(await db.query('SELECT state,pending_threads FROM meta_history_sync WHERE workspace_id=$1 AND connection_id=$2',[w,conn])).rows[0];
 assert.equal(checkpoint.state,'complete');assert.deepEqual(checkpoint.pending_threads,[]);
 assert.equal((await db.query('SELECT id FROM messages WHERE workspace_id=$1',[w])).rowCount,2);
 const ownership=(await db.query('SELECT reply_owner,owner_version,assigned_to FROM conversations WHERE workspace_id=$1',[w])).rows[0];
 assert.equal(ownership.reply_owner,'AI_ACTIVE');assert.equal(ownership.assigned_to,null);
 const conversation=(await db.query('SELECT id FROM conversations WHERE workspace_id=$1',[w])).rows[0].id;
 const actor={workspace_id:w,user_id:randomUUID(),role:'Owner'};
 const media=(await db.query('SELECT a.kind,a.url,m.author_type FROM message_attachments a JOIN messages m ON m.id=a.message_id AND m.workspace_id=a.workspace_id WHERE a.workspace_id=$1 ORDER BY a.kind',[w])).rows;
 assert.deepEqual(media,[{kind:'image',url:'https://cdn.example.test/reply.jpg',author_type:'agent'},{kind:'video',url:'https://cdn.example.test/customer.mp4',author_type:'visitor'}]);
 const mediaInbox=await inboxMessages(db,actor,conversation,0);
 assert.ok(JSON.stringify(mediaInbox.find(m=>m.content==='Reply')).includes('https://cdn.example.test/reply.jpg'));
 assert.ok(JSON.stringify(mediaInbox.find(m=>m.content==='Hello')).includes('https://cdn.example.test/customer.mp4'));

 const echo={surface:'facebook_messenger' as const,externalAccountId:conn,senderId:'customer',eventId:'live-echo',text:'Live Page reply',attachments:[],mediaReferences:[],createdAt:'2026-09-01T01:03:00Z',isPageReply:true};
 await processNormalizedMetaInbound(db,echo,{id:conn,workspace_id:w,channel_id:ch});
 await processNormalizedMetaInbound(db,echo,{id:conn,workspace_id:w,channel_id:ch});
 assert.equal((await db.query("SELECT id FROM messages WHERE workspace_id=$1 AND body='Live Page reply' AND author_type='agent'",[w])).rowCount,1);
 assert.equal((await db.query("SELECT id FROM jobs WHERE workspace_id=$1 AND kind IN ('ai.reply','meta.message.send')",[w])).rowCount,0);

 const route={id:conn,workspace_id:w,channel_id:ch};
 // A failed projection must not leave its dedupe event behind, otherwise retry
 // would be accepted as a duplicate without ever creating the message.
 await db.query('SAVEPOINT meta_ingress_processing');
 await assert.rejects(processNormalizedMetaInbound(db,{...echo,eventId:'failed-projection',createdAt:'invalid'},route));
 await db.query('ROLLBACK TO SAVEPOINT meta_ingress_processing');
 await db.query('RELEASE SAVEPOINT meta_ingress_processing');
 assert.equal((await db.query("SELECT id FROM meta_events WHERE workspace_id=$1 AND external_event_id='failed-projection'",[w])).rowCount,0);

 const watermark={surface:'facebook_messenger' as const,externalAccountId:conn,eventId:'watermark-read',providerMessageId:'',status:'read' as const,recipientId:'customer',watermarkAt:'2026-09-01T01:03:00.000Z'};
 await processNormalizedMetaStatus(db,watermark,route);
 assert.equal((await db.query("SELECT status FROM meta_message_deliveries WHERE workspace_id=$1 AND provider_message_id='live-echo'",[w])).rows[0].status,'read');
 await processNormalizedMetaStatus(db,{...watermark,eventId:'watermark-delivery',status:'delivered'},route);
 assert.equal((await db.query("SELECT status FROM meta_message_deliveries WHERE workspace_id=$1 AND provider_message_id='live-echo'",[w])).rows[0].status,'read');
 await processNormalizedMetaInbound(db,{...echo,eventId:'later-echo',createdAt:'2026-09-01T01:04:00Z'},route);
 assert.equal((await db.query("SELECT status FROM meta_message_deliveries WHERE workspace_id=$1 AND provider_message_id='later-echo'",[w])).rows[0].status,'accepted');
 await processNormalizedMetaInbound(db,{...echo,eventId:'delayed-echo',createdAt:'2026-09-01T01:02:30Z'},route);
 assert.equal((await db.query("SELECT status FROM meta_message_deliveries WHERE workspace_id=$1 AND provider_message_id='delayed-echo'",[w])).rows[0].status,'read');

 for(const status of ['accepted','sent','delivered','read','failed','unknown']){
   await db.query('UPDATE meta_message_deliveries SET status=$1 WHERE workspace_id=$2',[status,w]);
   const inbox=await inboxMessages(db,actor,conversation,0);
   assert.equal(inbox.find(m=>m.content==='Reply')?.status,status);
   assert.equal(inbox.find(m=>m.content==='Reply')?.senderName,'History fixture');
   assert.equal(inbox.find(m=>m.content==='Reply')?.senderRole,'Tin từ tài khoản nền tảng');
   assert.equal(inbox.find(m=>m.content==='Hello')?.senderType,'customer');
 }
 const unsent=randomUUID();
 await db.query("INSERT INTO messages(id,workspace_id,conversation_id,sequence,client_id,author_type,visibility,body) VALUES($1,$2,$3,99,$4,'agent','public','Unsent test')",[unsent,w,conversation,randomUUID()]);
 const jobId=randomUUID();
 await db.query("INSERT INTO jobs(id,workspace_id,kind,idempotency_key,payload,external_effect) VALUES($1,$2,'meta.message.send',$3,$4,true)",[jobId,w,randomUUID(),{conversationId:conversation,messageId:unsent}]);
 for(const [state,status] of [['queued','queued'],['dead','failed'],['unknown','unknown'],['succeeded','unknown']]){
  await db.query("UPDATE jobs SET state=$1,receipt_id=CASE WHEN $1='succeeded' THEN 'meta:unresolved' ELSE NULL END WHERE id=$2",[state,jobId]);
  assert.equal((await inboxMessages(db,actor,conversation,0)).find(m=>m.id===unsent)?.status,status);
 }
 assert.equal((await db.query('SELECT id FROM meta_message_deliveries WHERE workspace_id=$1',[w])).rowCount,4);
 await scope(db,other);
 assert.equal((await db.query('SELECT connection_id FROM meta_connection_credentials WHERE workspace_id=$1',[w])).rowCount,0);
 await assert.rejects(inboxMessages(db,{...actor,workspace_id:other},conversation,0),/NOT_FOUND/);
 assert.equal((await db.query('SELECT id FROM meta_message_deliveries WHERE workspace_id=$1',[w])).rowCount,0);
 await scope(db,other);assert.equal((await db.query('SELECT id FROM messages WHERE workspace_id=$1',[w])).rowCount,0);
 }finally{await db.query('ROLLBACK');db.release();delete process.env.HISTORY_DB_TOKEN;if(oldKey===undefined)delete process.env.META_CREDENTIAL_ENCRYPTION_KEY;else process.env.META_CREDENTIAL_ENCRYPTION_KEY=oldKey;}
});
