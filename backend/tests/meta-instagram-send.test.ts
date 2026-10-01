import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sendInstagramText} from '../src/modules/meta/instagram-send';
const input={version:'v25.0',accountId:'123',accountToken:'private-instagram-token',recipientId:'456',text:'Xin chào'};
test('Instagram Login send uses Instagram endpoint and validates matching provider receipt',async()=>{
 let calls=0;
 const result=await sendInstagramText(input,async(url,options)=>{
  calls++;assert.equal(String(url),'https://graph.instagram.com/v25.0/123/messages');
  assert.equal(new Headers(options?.headers).get('authorization'),'Bearer private-instagram-token');
  assert.equal(options?.method,'POST');assert.equal(options?.redirect,'error');
  assert.deepEqual(JSON.parse(String(options?.body)),{recipient:{id:'456'},message:{text:'Xin chào'}});
  return Response.json({recipient_id:'456',message_id:'ig-receipt'});
 });
 assert.deepEqual(result,{status:'accepted',messageId:'ig-receipt',recipientId:'456'});assert.equal(calls,1);
});
test('Instagram uncertain response does not retry or expose provider errors',async()=>{
 for(const response of [Response.json({recipient_id:'wrong',message_id:'id'}),Response.json({success:true}),new Response('private-token',{status:500})]){
  let calls=0;
  assert.deepEqual(await sendInstagramText(input,async()=>{calls++;return response;}),{status:'unknown'});
  assert.equal(calls,1);
 }
 assert.deepEqual(await sendInstagramText(input,async()=>{throw new Error('private-token');}),{status:'unknown'});
});
test('Instagram rejects malformed input before provider side effects',async()=>{
 let calls=0;
 for(const change of [{version:'../v25.0'},{accountId:'../me'},{recipientId:'abc'},{accountToken:'x\ny'},{text:''},{text:'x'.repeat(2001)}])
  await assert.rejects(sendInstagramText({...input,...change},async()=>{calls++;return Response.json({});}),/META_SEND_INVALID/);
 assert.equal(calls,0);
});
