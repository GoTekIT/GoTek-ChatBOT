import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exchangeFacebookCode} from '../src/modules/meta/facebook-oauth';
import type {MetaConfig} from '../src/modules/meta/config';
import type {MetaFetch} from '../src/modules/meta/http';
const config:MetaConfig={provider:'facebook',appId:'123',appSecret:'server-secret',redirectUri:'https://example.test/cb',graphVersion:'v25.0',loginConfigId:'456'};
const scopes=['pages_show_list','pages_messaging','pages_manage_metadata','pages_read_engagement'];
test('Facebook exchange sends credentials in body and validates actual granted permissions',async()=>{
 let calls=0;
 const request:MetaFetch=async(input,init)=>{
  calls++;const url=new URL(String(input));
  assert.equal(url.searchParams.has('client_secret'),false);
  if(calls===1){
   assert.equal(init?.method,'POST');const body=new URLSearchParams(String(init?.body));
   assert.equal(body.get('code'),'one-time-code');assert.equal(body.get('client_secret'),'server-secret');
   assert.equal(body.get('redirect_uri'),config.redirectUri);
   return Response.json({access_token:'private-token',expires_in:3600});
  }
  assert.equal(url.pathname,'/v25.0/me/permissions');
  assert.equal(new Headers(init?.headers).get('authorization'),'Bearer private-token');
  return Response.json({data:scopes.map(permission=>({permission,status:'granted'}))});
 };
 const grant=await exchangeFacebookCode(config,'one-time-code',request);
 assert.equal(calls,2);assert.equal(grant.expiresIn,3600);assert.deepEqual(grant.scopes,scopes);
});
test('Facebook exchange rejects declined permissions and malformed token responses',async()=>{
 let calls=0;
 const declined:MetaFetch=async()=>++calls===1?Response.json({access_token:'token'}):Response.json({data:scopes.map(permission=>({permission,status:permission==='pages_messaging'?'declined':'granted'}))});
 await assert.rejects(exchangeFacebookCode(config,'code',declined),/META_PERMISSIONS_REQUIRED/);
 for(const payload of [{access_token:''},{access_token:'token',expires_in:-1},{access_token:123}]) {
  await assert.rejects(exchangeFacebookCode(config,'code',async()=>Response.json(payload)),/META_RESPONSE_INVALID/);
 }
});
