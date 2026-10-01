import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discoverFacebookPages,publicFacebookAssets} from '../src/modules/meta/facebook-assets';
import type {MetaConfig} from '../src/modules/meta/config';
import type {MetaFetch} from '../src/modules/meta/http';
const config:MetaConfig={provider:'facebook',appId:'123',appSecret:'secret',redirectUri:'https://example.test/cb',graphVersion:'v25.0',loginConfigId:'456'};
test('Page discovery uses server credentials and returns only messaging-capable assets with safe UI projection',async()=>{
 let calls=0;
 const request:MetaFetch=async(input,init)=>{
  calls++;const url=new URL(String(input));
  assert.equal(url.hostname,'graph.facebook.com');assert.equal(url.searchParams.get('after'),'cursor-one');
  assert.equal(url.searchParams.has('access_token'),false);
  assert.equal(new Headers(init?.headers).get('authorization'),'Bearer user-secret');
  assert.match(url.searchParams.get('appsecret_proof')!,/^[a-f0-9]{64}$/);
  return Response.json({data:[
   {id:'1',name:'Page',access_token:'page-secret',tasks:['MESSAGING']},
   {id:'2',name:'Ads only',tasks:['ADVERTISE']}
  ],paging:{next:'https://evil.test/?access_token=page-secret',cursors:{after:'cursor-two'}}});
 };
 const batch=await discoverFacebookPages(config,'user-secret','cursor-one',request);
 assert.equal(calls,1);assert.equal(batch.after,'cursor-two');assert.equal(batch.assets.length,1);
 assert.deepEqual(publicFacebookAssets(batch.assets),[{id:'1',name:'Page'}]);
});
test('Page discovery rejects malformed assets and repeated pagination cursors',async()=>{
 for(const payload of [{data:null},{data:[{id:123,name:'bad',tasks:[]}]},{data:[{id:'1',name:'bad',tasks:['MESSAGING']}]},{data:[],paging:{next:'https://graph.facebook.com',cursors:{after:'same'}}}]) {
  await assert.rejects(discoverFacebookPages(config,'token','same',async()=>Response.json(payload)),/META_RESPONSE_INVALID/);
 }
 let calls=0;const request:MetaFetch=async()=>{calls++;return Response.json({data:[]});};
 await assert.rejects(discoverFacebookPages({...config,provider:'instagram'},'token',undefined,request),/PROVIDER_INVALID/);
 assert.equal(calls,0);
});
