import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {pool,scope} from '../src/core/db';
import {beginFacebookOAuth,completeFacebookOAuth,facebookOAuthAccounts,selectFacebookOAuthAccount} from '../src/modules/meta/oauth';
import {resolveMetaCredential} from '../src/modules/meta/credential-vault';
after(()=>pool.end());
test('OAuth discovers and connects two distinct Pages with encrypted scoped credentials',{skip:process.env.META_HISTORY_DB_TEST!=='true'},async t=>{
 const db=await pool.connect(),workspace=randomUUID(),user=randomUUID();
 const pageA=BigInt('0x'+randomBytes(8).toString('hex')).toString(),pageB=BigInt('0x'+randomBytes(8).toString('hex')).toString();
 const keys=['META_APP_ID','META_APP_SECRET','META_OAUTH_REDIRECT_URI','META_CREDENTIAL_ENCRYPTION_KEY'];const previous=keys.map(k=>process.env[k]);
 Object.assign(process.env,{META_APP_ID:'123',META_APP_SECRET:'fake-app-secret',META_OAUTH_REDIRECT_URI:'http://localhost:3001/api/meta/oauth/callback',META_CREDENTIAL_ENCRYPTION_KEY:randomBytes(32).toString('base64')});
 const actor={workspace_id:workspace,user_id:user,role:'Owner',token_hash:'test-session'};
 let subscribed=0;
 t.mock.method(globalThis,'fetch',async(input:string|URL,init?:RequestInit)=>{
  const url=new URL(String(input));
  assert.equal(url.hostname,'graph.facebook.com');
  if(url.pathname.endsWith('/oauth/access_token'))return new Response(JSON.stringify({access_token:'user-test-secret'}));
  if(url.pathname.endsWith('/me/accounts'))return new Response(JSON.stringify({data:[{id:pageA,name:'Page A',access_token:'page-A-secret'},{id:pageB,name:'Page B',access_token:'page-B-secret'}]}));
  const page=url.pathname.split('/')[2];assert.ok([pageA,pageB].includes(page));
  assert.equal((init?.headers as Record<string,string>).authorization,`Bearer ${page===pageA?'page-A-secret':'page-B-secret'}`);
  if(url.pathname.endsWith('/subscribed_apps')){subscribed++;return new Response(JSON.stringify({success:true}));}
  return new Response(JSON.stringify({id:page}));
 });
 try{
  await db.query('BEGIN');await scope(db,workspace);
  await db.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspace,'Rollback OAuth']);
  await db.query("INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,'OAuth test','','not-a-password')",[user,`${user}@example.test`]);
  await db.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'Owner')",[workspace,user]);
  const start=await beginFacebookOAuth(db,actor);const state=new URL(start.authorizationUrl).searchParams.get('state');
  await assert.rejects(completeFacebookOAuth(db,{...actor,token_hash:'other'},{state,code:'test'}),/META_OAUTH_STATE_INVALID/);
  const completed=await completeFacebookOAuth(db,actor,{state,code:'test'});
  const offered=await facebookOAuthAccounts(db,actor,completed.sessionId);
  assert.equal(offered.accounts.length,2);assert.ok(!JSON.stringify(offered).includes('secret'));
  await assert.rejects(selectFacebookOAuthAccount(db,actor,completed.sessionId,{accountId:'999'}),/META_OAUTH_ACCOUNT_NOT_OFFERED/);
  const a=await selectFacebookOAuthAccount(db,actor,completed.sessionId,{accountId:pageA});
  const b=await selectFacebookOAuthAccount(db,actor,completed.sessionId,{accountId:pageB});
  assert.notEqual(a.connectionId,b.connectionId);assert.equal(subscribed,2);
  const connections=(await db.query('SELECT status,channel_id,webhook_subscribed_at FROM meta_connections WHERE workspace_id=$1',[workspace])).rows;
  assert.equal(new Set(connections.map(r=>r.channel_id)).size,2);
  assert.ok(connections.every(r=>r.status==='connected'&&r.webhook_subscribed_at));
  assert.equal(await resolveMetaCredential(db,workspace,a.connectionId,'unused'),'page-A-secret');
  assert.deepEqual((await facebookOAuthAccounts(db,actor,completed.sessionId)).accounts,[]);
  await scope(db,randomUUID());
  assert.equal((await db.query('SELECT id FROM meta_oauth_sessions WHERE workspace_id=$1',[workspace])).rowCount,0);
 }finally{await db.query('ROLLBACK');db.release();keys.forEach((key,i)=>{if(previous[i]===undefined)delete process.env[key];else process.env[key]=previous[i];});}
});
