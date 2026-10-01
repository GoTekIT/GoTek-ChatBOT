import {test} from 'node:test';
import assert from 'node:assert/strict';
import {metaJsonRequest,type MetaFetch} from '../src/modules/meta/http';
const endpoint = new URL('https://graph.facebook.com/v25.0/me');
const returning = (value: Response): MetaFetch => async()=>value;
test('Meta transport blocks arbitrary hosts and redirects, and returns validated JSON',async()=>{
 let calls=0;
 const request:MetaFetch=async(_url,init)=>{calls++;assert.equal(init?.redirect,'error');assert.ok(init?.signal);return Response.json({id:'123'});};
 for(const url of ['https://evil.test/','http://graph.facebook.com/','https://graph.facebook.com:444/','https://user:secret@graph.facebook.com/']) {
  await assert.rejects(metaJsonRequest(new URL(url),{},request),/META_ENDPOINT_INVALID/);
 }
 assert.equal(calls,0);
 assert.deepEqual(await metaJsonRequest(endpoint,{},request),{id:'123'});
});
test('Meta transport bounds response size and suppresses sensitive upstream errors',async()=>{
 for(const response of [new Response('secret-token',{status:400}),Response.json({error:{message:'secret-token'}}),new Response('secret-token'),Response.json([])]) {
  await assert.rejects(metaJsonRequest(endpoint,{},returning(response)),error=>{
   assert.ok(error instanceof Error);assert.equal(error.message.includes('secret-token'),false);return true;
  });
 }
 await assert.rejects(metaJsonRequest(endpoint,{},returning(new Response('x'.repeat(1_048_577)))),/META_RESPONSE_TOO_LARGE/);
 const leaking:MetaFetch=async()=>{throw new Error('secret-token in URL');};
 await assert.rejects(metaJsonRequest(endpoint,{},leaking),/META_REQUEST_FAILED/);
});
test('Meta transport aborts slow upstream requests without retrying',async()=>{
 let calls=0;
 const slow:MetaFetch=async(_url,init)=>{calls++;return new Promise((_resolve,reject)=>{
  init?.signal?.addEventListener('abort',()=>reject(new Error('abort')),{once:true});
 });};
 await assert.rejects(metaJsonRequest(endpoint,{},slow,10),/META_REQUEST_TIMEOUT/);
 assert.equal(calls,1);
});
