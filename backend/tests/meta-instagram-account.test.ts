import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discoverInstagramAccount} from '../src/modules/meta/instagram-account';
import type {MetaConfig} from '../src/modules/meta/config';
const config:MetaConfig={provider:'instagram',appId:'123',appSecret:'secret',redirectUri:'https://example.test/cb',graphVersion:'v25.0'};
const grant={token:'server-token',userId:'111',expiresIn:3600,scopes:['instagram_business_basic','instagram_business_manage_messages']};
test('Instagram asset identity comes from professional user_id, not OAuth ID or unrequested profile data',async()=>{
 const account=await discoverInstagramAccount(config,grant,async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.origin,'https://graph.instagram.com');assert.equal(url.pathname,'/v25.0/me');
  assert.equal(url.searchParams.get('fields'),'user_id,username');assert.equal(url.searchParams.has('access_token'),false);
  assert.equal(new Headers(init?.headers).get('authorization'),'Bearer server-token');
  return Response.json({data:[{id:'111',user_id:'222',username:'gotek',private_field:'omit'}]});
 });
 assert.deepEqual(account,{id:'222',username:'gotek'});
});
test('Instagram asset lookup rejects ambiguous and malformed account identities',async()=>{
 const account={user_id:'222',username:'gotek'};
 for(const payload of [{data:[]},{data:[account,account]},{data:[account],user_id:'other'},{data:[{...account,user_id:222}]},{data:[{...account,username:''}]}])
  await assert.rejects(discoverInstagramAccount(config,grant,async()=>Response.json(payload)),/META_RESPONSE_INVALID/);
});
