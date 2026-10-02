import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createHmac,randomUUID} from 'node:crypto';
import {pool,scope,transaction} from '../src/core/db';
import {receiveMetaWebhook} from '../src/modules/meta/messenger';
import {runMetaIngressOnce,closeMetaWorkerPool} from '../src/modules/jobs/worker';
import {closeRabbitMQ} from '../src/core/rabbitmq';

const enabled=!!process.env.META_TEST_ADMIN_URL&&!!process.env.DB_RUNTIME_FILE;
const admin=enabled?new pg.Pool({connectionString:process.env.META_TEST_ADMIN_URL}):undefined;
after(async()=>{await closeMetaWorkerPool();await pool.end();await admin?.end();await closeRabbitMQ();});

test('durable Meta ingress splits a mixed envelope across workspaces and keeps unmapped events quarantined',{skip:!enabled},async()=>{
 const workspaceA=randomUUID(),workspaceB=randomUUID(),workspaceC=randomUUID(),channelA1=randomUUID(),channelA2=randomUUID(),channelB=randomUUID(),channelC=randomUUID();
 const pageA1='queue-page-a1-'+randomUUID(),pageA2='queue-page-a2-'+randomUUID(),pageB='queue-page-b-'+randomUUID(),pageC='queue-page-c-'+randomUUID();
 process.env.META_APP_SECRET='queue-fixture-secret';
 await admin!.query('INSERT INTO workspaces(id,name) VALUES($1,$2),($3,$4),($5,$6)',[workspaceA,'Queue A',workspaceB,'Queue B',workspaceC,'Queue C']);
 for(const [id,workspace,name] of [[channelA1,workspaceA,'A1'],[channelA2,workspaceA,'A2'],[channelB,workspaceB,'B'],[channelC,workspaceC,'C']]){
  await admin!.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,$3,'https://example.test','Hi','#0057E1',$4,$5,'{}')",[id,workspace,name,randomUUID(),randomUUID()]);
 }
 for(const [workspace,channel,page] of [[workspaceA,channelA1,pageA1],[workspaceA,channelA2,pageA2],[workspaceB,channelB,pageB],[workspaceC,channelC,pageC]]){
  await admin!.query("INSERT INTO meta_connections(id,workspace_id,channel_id,channel_kind,external_page_id,page_name,page_access_token_ref,status) VALUES($1,$2,$3,'facebook_messenger',$4,$5,'META_QUEUE_TOKEN','connected')",[randomUUID(),workspace,channel,page,page]);
 }
 const unmappedPage='queue-unmapped-'+randomUUID();
 const body={object:'page',entry:[
  {id:pageA1,messaging:[{sender:{id:'queue-user-a'},recipient:{id:pageA1},message:{mid:'queue-mid-a1',text:'A1'}}]},
  {id:pageA2,messaging:[{sender:{id:'queue-user-a'},recipient:{id:pageA2},message:{mid:'queue-mid-a2',text:'A2'}}]},
  {id:pageB,messaging:[{sender:{id:'queue-user-b'},recipient:{id:pageB},message:{mid:'queue-mid-b',text:'B'}}]},
  {id:pageC,messaging:[{sender:{id:'queue-user-c'},recipient:{id:pageC},message:{mid:'queue-mid-c',text:'C'}}]},
  {id:unmappedPage,messaging:[{sender:{id:'queue-user-x'},recipient:{id:unmappedPage},message:{mid:'queue-mid-x',text:'unmapped'}}]}
 ]};
 const raw=Buffer.from(JSON.stringify(body));
 const signature='sha256='+createHmac('sha256',process.env.META_APP_SECRET).update(raw).digest('hex');
 const accepted=await transaction(db=>receiveMetaWebhook(db,raw,signature));
 assert.equal(accepted.processed,0);
 assert.equal(accepted.queued,5);
 await transaction(async db=>{await scope(db,workspaceA);assert.equal((await db.query('SELECT id FROM meta_webhook_ingress')).rowCount,2);});
 await transaction(async db=>{await scope(db,workspaceB);assert.equal((await db.query('SELECT id FROM meta_webhook_ingress')).rowCount,1);});
 await transaction(async db=>{await scope(db,workspaceC);assert.equal((await db.query('SELECT id FROM meta_webhook_ingress')).rowCount,1);});
 assert.equal((await runMetaIngressOnce(workspaceA)).state,'succeeded');
 assert.equal((await runMetaIngressOnce(workspaceA)).state,'succeeded');
 assert.equal((await runMetaIngressOnce(workspaceB)).state,'succeeded');
 assert.equal((await runMetaIngressOnce(workspaceC)).state,'succeeded');
 await transaction(async db=>{
  await scope(db,workspaceA);
  assert.equal((await db.query('SELECT id FROM messages')).rowCount,2);
  assert.equal((await db.query('SELECT DISTINCT connection_id FROM conversations')).rowCount,2);
  await scope(db,workspaceB);
  assert.equal((await db.query('SELECT id FROM messages')).rowCount,1);
  assert.equal((await db.query('SELECT id FROM meta_webhook_ingress WHERE state=\'quarantined\'')).rowCount,0);
  await scope(db,workspaceC);
  assert.equal((await db.query('SELECT id FROM messages')).rowCount,1);
 });
 const quarantined=(await admin!.query("SELECT state,external_account_id FROM meta_webhook_ingress WHERE external_account_id=$1",[unmappedPage])).rows[0];
 assert.deepEqual(quarantined,{state:'quarantined',external_account_id:unmappedPage});
 const duplicate=await transaction(db=>receiveMetaWebhook(db,raw,signature));
 assert.equal(duplicate.queued,5);
 assert.equal((await admin!.query("SELECT count(*)::int AS count FROM meta_webhook_ingress WHERE external_account_id=ANY($1::text[])",[[pageA1,pageA2,pageB,pageC,unmappedPage]])).rows[0].count,5);
 await admin!.query('DELETE FROM meta_webhook_quarantine WHERE external_account_id=ANY($1::text[])',[[pageA1,pageA2,pageB,pageC,unmappedPage]]);
 await admin!.query('DELETE FROM meta_webhook_ingress WHERE external_account_id=ANY($1::text[])',[[pageA1,pageA2,pageB,pageC,unmappedPage]]);
 await admin!.query('DELETE FROM meta_events WHERE workspace_id IN($1,$2,$3)',[workspaceA,workspaceB,workspaceC]);
 await admin!.query('DELETE FROM jobs WHERE workspace_id IN($1,$2,$3)',[workspaceA,workspaceB,workspaceC]);
 await admin!.query('DELETE FROM messages WHERE workspace_id IN($1,$2,$3)',[workspaceA,workspaceB,workspaceC]);
 await admin!.query('DELETE FROM conversations WHERE workspace_id IN($1,$2,$3)',[workspaceA,workspaceB,workspaceC]);
 await admin!.query('DELETE FROM visitors WHERE workspace_id IN($1,$2,$3)',[workspaceA,workspaceB,workspaceC]);
 await admin!.query('DELETE FROM meta_identities WHERE workspace_id IN($1,$2,$3)',[workspaceA,workspaceB,workspaceC]);
 await admin!.query('DELETE FROM meta_connections WHERE workspace_id IN($1,$2,$3)',[workspaceA,workspaceB,workspaceC]);
 await admin!.query('DELETE FROM channels WHERE workspace_id IN($1,$2,$3)',[workspaceA,workspaceB,workspaceC]);
 await admin!.query('DELETE FROM workspaces WHERE id IN($1,$2,$3)',[workspaceA,workspaceB,workspaceC]);
});
