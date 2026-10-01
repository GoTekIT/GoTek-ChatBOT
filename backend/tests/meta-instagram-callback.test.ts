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
test('Instagram callback stores only encrypted tenant-bound connection and rejects replay, foreign tenant and revoked session',async()=>{
 const ws=randomUUID(),other=randomUUID(),user=randomUUID(),token=randomUUID(),otherToken=randomUUID();
 const settings={META_INSTAGRAM_APP_ID:'123',META_INSTAGRAM_APP_SECRET:'fixture',META_INSTAGRAM_REDIRECT_URI:'https://example.test/ig/callback',META_GRAPH_VERSION:'v25.0',META_TOKEN_ENCRYPTION_KEY:'cd'.repeat(32)};
 const saved=Object.fromEntries(Object.keys(settings).map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
 Object.assign(process.env,settings);
 let calls=0,revoke=false;
 globalThis.fetch=async(input)=>{
  calls++;const url=new URL(String(input));
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
  const reconnectState=new URL((await connect()).body.authorizationUrl).searchParams.get('state')!;
  assert.equal((await callback(reconnectState)).body.id,result.body.id);
  assert.equal((await admin.query('SELECT generation FROM meta_connections WHERE id=$1',[result.body.id])).rows[0].generation,2);
  const foreignState=new URL((await connect(otherToken)).body.authorizationUrl).searchParams.get('state')!;
  assert.equal((await callback(foreignState,otherToken)).status,409);
  assert.equal((await admin.query('SELECT id FROM channels WHERE workspace_id=$1',[other])).rowCount,0);
  const revokedState=new URL((await connect()).body.authorizationUrl).searchParams.get('state')!;revoke=true;
  assert.equal((await callback(revokedState)).status,401);
  assert.equal((await admin.query('SELECT generation FROM meta_connections WHERE id=$1',[result.body.id])).rows[0].generation,2);
 }finally{
  globalThis.fetch=originalFetch;
  for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  for(const workspace of [ws,other]){
   for(const table of ['meta_connections','channel_members','channels','audit_events','meta_oauth_attempts','sessions','memberships'])await admin.query(`DELETE FROM ${table} WHERE workspace_id=$1`,[workspace]);
   await admin.query('DELETE FROM workspaces WHERE id=$1',[workspace]);
  }
  await admin.query('DELETE FROM users WHERE id=$1',[user]);
 }
});
