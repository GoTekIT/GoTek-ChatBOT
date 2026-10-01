import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exchangeInstagramCode} from '../src/modules/meta/instagram-oauth';
import type {MetaConfig} from '../src/modules/meta/config';
const config:MetaConfig={provider:'instagram',appId:'123',appSecret:'fixture-secret',redirectUri:'https://example.test/ig/callback',graphVersion:'v25.0'};
const entry={access_token:'short-token',user_id:'456',permissions:'instagram_business_basic,instagram_business_manage_messages'};
test('Instagram exchanges code using multipart form and checks scopes before long-lived exchange',async()=>{
 let calls=0;
 const result=await exchangeInstagramCode(config,'one-time-code',async(input,init)=>{
  const url=new URL(String(input));calls++;
  if(calls===1){
   assert.equal(url.href,'https://api.instagram.com/oauth/access_token');assert.equal(init?.method,'POST');
   assert.ok(init?.body instanceof FormData);assert.equal(init.body.get('grant_type'),'authorization_code');
   assert.equal(init.body.get('redirect_uri'),config.redirectUri);assert.equal(init.body.get('code'),'one-time-code');
   return Response.json({data:[entry]});
  }
  assert.equal(url.origin,'https://graph.instagram.com');assert.equal(url.pathname,'/access_token');
  assert.equal(url.searchParams.get('grant_type'),'ig_exchange_token');assert.equal(url.searchParams.get('access_token'),'short-token');
  assert.equal(url.searchParams.get('client_secret'),config.appSecret);
  return Response.json({access_token:'long-token',token_type:'bearer',expires_in:5184000});
 });
 assert.equal(calls,2);assert.equal(result.userId,'456');assert.equal(result.token,'long-token');assert.equal(result.expiresIn,5184000);
});
test('Instagram rejects ambiguous accounts and missing permissions before token upgrade',async()=>{
 for(const payload of [{data:[]},{data:[entry,entry]},{data:[entry],access_token:'other'},{data:[{...entry,user_id:456}]},{data:[{...entry,permissions:'instagram_business_basic'}]}]){
  let calls=0;await assert.rejects(exchangeInstagramCode(config,'code',async()=>{calls++;return Response.json(payload);}),/META_(RESPONSE_INVALID|PERMISSIONS_REQUIRED)/);assert.equal(calls,1);
 }
});
test('Instagram rejects invalid long-lived expiry and sanitizes transport errors',async()=>{
 let calls=0;
 await assert.rejects(exchangeInstagramCode(config,'code',async()=>++calls===1?Response.json({data:[entry]}):Response.json({access_token:'long',token_type:'bearer',expires_in:0})),/META_RESPONSE_INVALID/);
 await assert.rejects(exchangeInstagramCode(config,'code',async()=>{throw new Error('fixture-secret');}),/META_REQUEST_FAILED/);
});
