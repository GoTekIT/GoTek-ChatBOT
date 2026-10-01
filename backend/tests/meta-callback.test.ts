import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import {createApp} from '../src/app';
import {pool} from '../src/core/db';
import {digest} from '../src/core/security';
const admin=new pg.Pool({host:process.env.PGHOST||'/tmp',port:Number(process.env.PGPORT)||55432,user:process.env.PGUSER||'gotek_migrator',password:process.env.PGPASSWORD||'gotek_dev_password',database:'gotek_chatbot'});
after(async()=>{await pool.end();await admin.end();});
test('Facebook HTTP callback consumes state once, hides tokens and rechecks revoked sessions',async()=>{
 const ws=randomUUID(),user=randomUUID(),token=randomUUID();
 const originalFetch=globalThis.fetch;
 const configured={META_FACEBOOK_APP_ID:'123',META_FACEBOOK_APP_SECRET:'fixture-secret',META_FACEBOOK_REDIRECT_URI:'https://example.test/api/integrations/meta/facebook/callback',META_FACEBOOK_LOGIN_CONFIG_ID:'456',META_GRAPH_VERSION:'v25.0',META_TOKEN_ENCRYPTION_KEY:'ab'.repeat(32)};
 const saved=Object.fromEntries(Object.keys(configured).map(k=>[k,process.env[k]]));
 Object.assign(process.env,configured);
 let calls=0, revoke=false;
 globalThis.fetch=async(input)=>{
  calls++;
  if(String(input).includes('/oauth/access_token')) {
   if(revoke)await admin.query('DELETE FROM sessions WHERE token_hash=$1',[digest(token)]);
   return Response.json({access_token:'private-user-token',expires_in:3600});
  }
  if(String(input).includes('/me/permissions'))return Response.json({data:['pages_show_list','pages_messaging','pages_manage_metadata','pages_read_engagement'].map(permission=>({permission,status:'granted'}))});
  if(String(input).includes('/me/accounts'))return Response.json({data:[{id:'789',name:'Test Page',tasks:['MESSAGING'],access_token:'private-page-token'}]});
  throw new Error('Unexpected provider request');
 };
 const app=request(createApp()),base='/api/integrations/meta/facebook';
 const connect=()=>app.post(base+'/connect').set('Authorization','Bearer '+token).set('X-Gotek-Request','1');
 const callback=(state:string)=>app.get(base+'/callback').query({state,code:'fixture-code'}).set('Authorization','Bearer '+token);
 try {
  await admin.query("INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,'Meta fixture','','unused')",[user,user+'@example.test']);
  await admin.query("INSERT INTO workspaces(id,name) VALUES($1,'Meta fixture')",[ws]);
  await admin.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'Owner')",[ws,user]);
  await admin.query("INSERT INTO sessions(token_hash,user_id,workspace_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[digest(token),user,ws]);
  const start=await connect();assert.equal(start.status,200);
  const state=new URL(start.body.authorizationUrl).searchParams.get('state')!;
  assert.equal((await callback('0'.repeat(64))).status,400);assert.equal(calls,0);
  const result=await callback(state);assert.equal(result.status,200);
  assert.equal(JSON.stringify(result.body).includes('private-'),false);
  assert.equal(result.headers['cache-control'],'no-store');
  assert.equal((await callback(state)).status,400);assert.equal(calls,2);
  const pages=await app.get(base+'/enrollments/'+result.body.enrollmentId+'/pages').set('Authorization','Bearer '+token);
  assert.equal(pages.status,200);assert.deepEqual(pages.body.assets,[{id:'789',name:'Test Page'}]);
  assert.equal(JSON.stringify(pages.body).includes('private-'),false);
  const selectionPath=base+'/enrollments/'+result.body.enrollmentId+'/select';
  assert.equal((await app.post(selectionPath).set('Authorization','Bearer '+token).set('X-Gotek-Request','1').send({assetId:'999'})).status,403);
  const selected=await app.post(selectionPath).set('Authorization','Bearer '+token).set('X-Gotek-Request','1').send({assetId:'789'});
  assert.equal(selected.status,201);assert.equal(selected.body.status,'pending');
  assert.equal((await app.post(selectionPath).set('Authorization','Bearer '+token).set('X-Gotek-Request','1').send({assetId:'789'})).status,400);
  const stored=(await admin.query('SELECT c.transport,c.enabled,m.token_ciphertext FROM channels c JOIN meta_connections m ON m.channel_id=c.id WHERE c.id=$1',[selected.body.channelId])).rows[0];
  assert.equal(stored.transport,'facebook');assert.equal(stored.enabled,false);assert.equal(stored.token_ciphertext.includes('private-page-token'),false);
  assert.equal((await app.get('/api/channels/'+selected.body.channelId+'/installation').set('Authorization','Bearer '+token)).status,409);
  const deniedState=new URL((await connect()).body.authorizationUrl).searchParams.get('state')!;
  assert.equal((await app.get(base+'/callback').query({state:deniedState,error:'access_denied'}).set('Authorization','Bearer '+token)).status,400);
  const before=calls;assert.equal((await callback(deniedState)).status,400);assert.equal(calls,before);
  const revokedState=new URL((await connect()).body.authorizationUrl).searchParams.get('state')!;
  revoke=true;assert.equal((await callback(revokedState)).status,401);
  assert.equal((await admin.query('SELECT id FROM meta_enrollments WHERE workspace_id=$1',[ws])).rowCount,0);
 } finally {
  globalThis.fetch=originalFetch;
  for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  for(const table of ['meta_connections','channel_members','channels','audit_events'])await admin.query(`DELETE FROM ${table} WHERE workspace_id=$1`,[ws]);
  for(const table of ['meta_enrollments','meta_oauth_attempts','sessions','memberships'])await admin.query(`DELETE FROM ${table} WHERE workspace_id=$1`,[ws]);
  await admin.query('DELETE FROM workspaces WHERE id=$1',[ws]);
  await admin.query('DELETE FROM users WHERE id=$1',[user]);
 }
});
