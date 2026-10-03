import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import type {PoolClient} from 'pg';
import {beginFacebookOAuth,completeFacebookOAuth,facebookOAuthAccounts} from '../src/modules/meta/oauth';
const actor={user_id:'11111111-1111-4111-8111-111111111111',workspace_id:'22222222-2222-4222-8222-222222222222',role:'Owner',token_hash:'session-hash'};
test('OAuth binds callback to initiating identity and returns no Page secrets',async()=>{
 const keys=['META_APP_ID','META_APP_SECRET','META_OAUTH_REDIRECT_URI','META_CREDENTIAL_ENCRYPTION_KEY'];
 const previous=keys.map(k=>process.env[k]);
 Object.assign(process.env,{META_APP_ID:'123',META_APP_SECRET:'fake-app-secret',META_OAUTH_REDIRECT_URI:'http://localhost:3001/api/meta/oauth/callback',META_CREDENTIAL_ENCRYPTION_KEY:randomBytes(32).toString('base64')});
 let row:any;let encrypted='';
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.startsWith('INSERT INTO meta_oauth_sessions'))row={id:args[0],workspace:args[1],user:args[2],session:args[3],state:args[4],redirect_uri:args[5],status:'pending'};
  if(sql.startsWith('SELECT id,redirect_uri'))return {rows:row&&row.workspace===args[0]&&row.user===args[1]&&row.session===args[2]&&row.state===args[3]&&row.status==='pending'?[row]:[]};
  if(sql.startsWith('UPDATE meta_oauth_sessions')){encrypted=args[0];row.status='ready';}
  if(sql.startsWith('SELECT encrypted_accounts'))return {rows:row&&row.id===args[0]&&row.workspace===args[1]&&row.user===args[2]&&row.session===args[3]?[{encrypted_accounts:encrypted}]:[]};
  return {rows:[]};
 }} as unknown as PoolClient;
 try {
  const started=await beginFacebookOAuth(db,actor);const url=new URL(started.authorizationUrl);const state=url.searchParams.get('state')!;
  assert.notEqual(row.state,state);assert.equal(url.searchParams.get('redirect_uri'),process.env.META_OAUTH_REDIRECT_URI);
  let calls=0;
  const transport:typeof fetch=async()=>{calls++;return new Response(JSON.stringify(calls===1?{access_token:'user-secret'}:{data:[{id:'456',name:'Page',access_token:'page-secret'}]}));};
  for(const changed of [{...actor,token_hash:'other-session'},{...actor,workspace_id:'other-workspace'},{...actor,user_id:'other-user'}])await assert.rejects(completeFacebookOAuth(db,changed,{state,code:'code'},transport),/META_OAUTH_STATE_INVALID/);
  assert.equal(calls,0);
  const result=await completeFacebookOAuth(db,actor,{state,code:'code'},transport);
  assert.equal(calls,2);assert.ok(!encrypted.includes('page-secret'));
  assert.deepEqual(await facebookOAuthAccounts(db,actor,result.sessionId),{sessionId:result.sessionId,accounts:[{id:'456',name:'Page'}]});
  await assert.rejects(completeFacebookOAuth(db,actor,{state,code:'code'},transport),/META_OAUTH_STATE_INVALID/);
  assert.equal(calls,2);
 }finally{keys.forEach((key,i)=>{if(previous[i]===undefined)delete process.env[key];else process.env[key]=previous[i];});}
});
