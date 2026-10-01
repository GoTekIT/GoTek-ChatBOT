import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import {createApp} from '../src/app';
import {pool,transaction,scope} from '../src/core/db';
import {normalizeFacebookReceipt,normalizeInstagramReceipt} from '../src/modules/meta/normalize';
import {claimInstagramReply,claimFacebookReply,completeMetaReply} from '../src/modules/meta/outbox';
import {digest} from '../src/core/security';
const admin=new pg.Pool({host:process.env.PGHOST||'/tmp',port:Number(process.env.PGPORT)||55432,user:process.env.PGUSER||'gotek_migrator',password:process.env.PGPASSWORD||'gotek_dev_password',database:'gotek_chatbot'});
after(async()=>{await pool.end();await admin.end();});
test('Instagram callback stores only encrypted tenant-bound connection and rejects replay, foreign tenant and revoked session',async()=>{
 const ws=randomUUID(),other=randomUUID(),user=randomUUID(),token=randomUUID(),otherToken=randomUUID();
 const settings={META_INSTAGRAM_VERIFY_TOKEN:'ig-verify',META_INSTAGRAM_APP_ID:'123',META_INSTAGRAM_APP_SECRET:'fixture',META_INSTAGRAM_REDIRECT_URI:'https://example.test/ig/callback',META_GRAPH_VERSION:'v25.0',META_TOKEN_ENCRYPTION_KEY:'cd'.repeat(32)};
 const saved=Object.fromEntries(Object.keys(settings).map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
 Object.assign(process.env,settings);
 let calls=0,revoke=false,subscriptionConfirmed=false;
 globalThis.fetch=async(input,init)=>{
  calls++;const url=new URL(String(input));
  if(url.pathname==='/v25.0/222/subscribed_apps'){
   assert.equal(url.hostname,'graph.instagram.com');assert.equal(init?.method,'POST');
   assert.equal(new URLSearchParams(String(init?.body)).get('subscribed_fields'),'messages');
   return Response.json({success:subscriptionConfirmed});
  }
  if(url.hostname==='api.instagram.com')return Response.json({data:[{access_token:'short-private',user_id:'111',permissions:'instagram_business_basic,instagram_business_manage_messages'}]});
  if(url.pathname==='/access_token')return Response.json({access_token:'long-private',token_type:'bearer',expires_in:3600});
  if(url.pathname==='/v25.0/me'){
   if(revoke)await admin.query('DELETE FROM sessions WHERE token_hash=$1',[digest(token)]);
   return Response.json({data:[{user_id:'222',username:'test_business'}]});
  }
  throw new Error('Unexpected request');
 };
 const app=request(createApp()),base='/api/integrations/meta/instagram';
 const connect=(session=token)=>app.post(base+'/connect').set('Authorization','Bearer '+session).set('X-Gotek-Request','1');
 const callback=(state:string,session=token)=>app.get(base+'/callback').query({state,code:'fixture-code'}).set('Authorization','Bearer '+session);
 try{
  await admin.query("INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,'IG test','','unused')",[user,user+'@example.test']);
  for(const workspace of [ws,other]){
   await admin.query("INSERT INTO workspaces(id,name) VALUES($1,'IG test')",[workspace]);
   await admin.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'Owner')",[workspace,user]);
  }
  for(const [session,workspace] of [[token,ws],[otherToken,other]])await admin.query("INSERT INTO sessions(token_hash,user_id,workspace_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[digest(session),user,workspace]);
  await admin.query("UPDATE memberships SET role='Agent' WHERE workspace_id=$1",[ws]);
  assert.equal((await connect()).status,403);
  await admin.query("UPDATE memberships SET role='Owner' WHERE workspace_id=$1",[ws]);
  const start=await connect();assert.equal(start.status,200);
  const state=new URL(start.body.authorizationUrl).searchParams.get('state')!;
  assert.equal((await callback(state,otherToken)).status,400);assert.equal(calls,0);
  const result=await callback(state);assert.equal(result.status,200);assert.equal(result.body.status,'pending');assert.equal(result.body.assetId,'222');
  assert.equal(JSON.stringify(result.body).includes('private'),false);assert.equal(result.headers['cache-control'],'no-store');
  const stored=(await admin.query('SELECT m.*,c.transport,c.enabled FROM meta_connections m JOIN channels c ON c.id=m.channel_id WHERE m.id=$1',[result.body.id])).rows[0];
  assert.equal(stored.workspace_id,ws);assert.equal(stored.transport,'instagram');assert.equal(stored.enabled,false);
  assert.equal(stored.token_ciphertext.includes('long-private'),false);assert.ok(new Date(stored.token_expires_at).getTime()>Date.now());
  assert.equal((await callback(state)).status,400);assert.equal(calls,3);
  const webhook='/integrations/meta/instagram/webhook';
  assert.equal((await app.get(webhook).query({'hub.mode':'subscribe','hub.verify_token':'ig-verify','hub.challenge':'challenge'})).text,'challenge');
  assert.equal((await app.get(webhook).query({'hub.mode':'subscribe','hub.verify_token':'wrong','hub.challenge':'challenge'})).status,403);
  const raw=JSON.stringify({object:'instagram',entry:[{id:'222',workspace_id:other,messaging:[{sender:{id:'333'},recipient:{id:'222'},timestamp:Date.now(),message:{mid:'ig-1',text:'hello'}}]}]});
  const signature='sha256='+createHmac('sha256','fixture').update(raw).digest('hex');
  assert.equal((await app.post(webhook).set('Content-Type','application/json').send(raw)).status,403);
  assert.equal((await app.post(webhook).set('Content-Type','application/json').set('X-Hub-Signature-256',signature).send(raw+' ')).status,403);
  for(let i=0;i<2;i++)assert.equal((await app.post(webhook).set('Content-Type','application/json').set('X-Hub-Signature-256',signature).send(raw)).status,200);
  const receipts=await admin.query('SELECT workspace_id,connection_id FROM meta_webhook_receipts WHERE connection_id=$1',[result.body.id]);
  assert.equal(receipts.rowCount,1);assert.equal(receipts.rows[0].workspace_id,ws);
  assert.equal((await transaction(async db=>{await scope(db,ws);return normalizeFacebookReceipt(db,ws);})).state,'idle');
  const normalize=()=>transaction(async db=>{await scope(db,ws);return normalizeInstagramReceipt(db,ws);});
  assert.equal((await normalize()).state,'idle'); // Pending connections are excluded from runnable work.
  const activate=()=>app.post(base+'/connections/'+result.body.id+'/activate').set('Authorization','Bearer '+token).set('X-Gotek-Request','1');
  await admin.query("UPDATE memberships SET role='Agent' WHERE workspace_id=$1",[ws]);
  const beforeDenied=calls;assert.equal((await activate()).status,403);assert.equal(calls,beforeDenied);
  await admin.query("UPDATE memberships SET role='Owner' WHERE workspace_id=$1",[ws]);
  assert.equal((await activate()).body.error,'META_SUBSCRIPTION_UNCONFIRMED');
  assert.equal((await admin.query('SELECT enabled FROM channels WHERE id=$1',[result.body.channelId])).rows[0].enabled,false);
  subscriptionConfirmed=true;
  assert.equal((await activate()).status,200);
  const afterActivated=calls;assert.equal((await activate()).status,200);assert.equal(calls,afterActivated);
  assert.equal((await normalize()).inserted,1);
  const inbox=await app.get('/api/conversations').set('Authorization','Bearer '+token);
  assert.equal(inbox.status,200);assert.equal(inbox.body[0].transport,'instagram');
  const history=await app.get('/api/conversations/'+inbox.body[0].id+'/messages').set('Authorization','Bearer '+token);
  assert.equal(history.body[0].body,'hello');
  const repeated=raw.replace('"messaging":','"time":1,"messaging":');
  const repeatedSignature='sha256='+createHmac('sha256','fixture').update(repeated).digest('hex');
  assert.equal((await app.post(webhook).set('Content-Type','application/json').set('X-Hub-Signature-256',repeatedSignature).send(repeated)).status,200);
  assert.equal((await normalize()).duplicates,1);
  assert.equal((await admin.query('SELECT id FROM messages WHERE workspace_id=$1',[ws])).rowCount,1);
  const conversationId=inbox.body[0].id;
  await admin.query("UPDATE conversations SET reply_owner='HUMAN_ACTIVE',assigned_to=$1,owner_version=owner_version+1 WHERE id=$2",[user,conversationId]);
  const clientId=randomUUID(),sendPath='/api/conversations/'+conversationId+'/messages';
  const send=()=>app.post(sendPath).set('Authorization','Bearer '+token).set('X-Gotek-Request','1').send({clientId,body:'Instagram reply',visibility:'public'});
  await admin.query("UPDATE meta_connections SET token_expires_at=now()-interval '1 second' WHERE id=$1",[result.body.id]);
  const expired=await send();assert.equal(expired.status,409);assert.equal(expired.body.error,'META_RECONNECT_REQUIRED');
  assert.equal((await admin.query('SELECT id FROM meta_outbox WHERE workspace_id=$1',[ws])).rowCount,0);
  assert.equal((await admin.query("SELECT id FROM messages WHERE workspace_id=$1 AND author_type='agent'",[ws])).rowCount,0);
  await admin.query("UPDATE meta_connections SET token_expires_at=now()+interval '1 hour' WHERE id=$1",[result.body.id]);
  const queued=await send();assert.equal(queued.status,200);assert.equal(queued.body.delivery_status,'queued');
  assert.equal((await send()).body.id,queued.body.id);
  assert.equal(await transaction(async db=>{await scope(db,ws);return claimFacebookReply(db,ws);}),null);
  const claimed=await transaction(async db=>{await scope(db,ws);return claimInstagramReply(db,ws);});
  assert.equal(claimed?.state,'dispatching');assert.equal(claimed?.recipient_id,'333');
  await transaction(async db=>{await scope(db,ws);return completeMetaReply(db,ws,claimed!.id,{status:'unknown'});});
  assert.equal(await transaction(async db=>{await scope(db,ws);return claimInstagramReply(db,ws);}),null);
  const reconnectState=new URL((await connect()).body.authorizationUrl).searchParams.get('state')!;
  assert.equal((await callback(reconnectState)).body.id,result.body.id);
  assert.equal((await admin.query('SELECT generation FROM meta_connections WHERE id=$1',[result.body.id])).rows[0].generation,2);
  const foreignState=new URL((await connect(otherToken)).body.authorizationUrl).searchParams.get('state')!;
  assert.equal((await callback(foreignState,otherToken)).status,409);
  assert.equal((await admin.query('SELECT id FROM channels WHERE workspace_id=$1',[other])).rowCount,0);
  const deniedState=new URL((await connect()).body.authorizationUrl).searchParams.get('state')!;
  const denied=await app.get(base+'/callback').query({state:deniedState,error:'access_denied',error_description:'private-provider-detail'}).set('Authorization','Bearer '+token).set('Accept','text/html');
  assert.equal(denied.status,303);assert.equal(denied.headers.location,'/app/channels?meta_error=META_AUTHORIZATION_DENIED');
  assert.equal(denied.headers['cache-control'],'no-store');assert.equal(denied.text.includes('private-provider-detail'),false);
  assert.equal((await callback(deniedState)).status,400);
  const browserState=new URL((await connect()).body.authorizationUrl).searchParams.get('state')!;
  const browserCallback=await app.get(base+'/callback').query({state:browserState,code:'fixture-code'}).set('Authorization','Bearer '+token).set('Accept','text/html');
  assert.equal(browserCallback.status,303);assert.equal(browserCallback.headers.location,'/app/channels');
  const revokedState=new URL((await connect()).body.authorizationUrl).searchParams.get('state')!;revoke=true;
  assert.equal((await callback(revokedState)).status,401);
  assert.equal((await admin.query('SELECT generation FROM meta_connections WHERE id=$1',[result.body.id])).rows[0].generation,3);
 }finally{
  globalThis.fetch=originalFetch;
  for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  for(const workspace of [ws,other]){
   for(const table of ['meta_outbox','meta_inbound_messages','meta_contacts','messages','conversations','visitors','meta_webhook_receipts','meta_connections','channel_members','channels','audit_events','meta_oauth_attempts','sessions','memberships'])await admin.query(`DELETE FROM ${table} WHERE workspace_id=$1`,[workspace]);
   await admin.query('DELETE FROM workspaces WHERE id=$1',[workspace]);
  }
  await admin.query('DELETE FROM users WHERE id=$1',[user]);
 }
});
