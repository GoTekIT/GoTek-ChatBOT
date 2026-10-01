import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sendFacebookText} from '../src/modules/meta/facebook-send';
const input={version:'v25.0',appSecret:'secret',pageId:'123',pageToken:'private-token',recipientId:'456',text:'Xin chào'};
test('Facebook text dispatch returns acceptance only with matching recipient and message receipt',async()=>{
 let calls=0;
 const result=await sendFacebookText(input,async(url,options)=>{
  calls++;assert.equal(String(url),'https://graph.facebook.com/v25.0/123/messages');
  assert.equal(new Headers(options?.headers).get('authorization'),'Bearer private-token');
  const body=JSON.parse(String(options?.body));
  assert.equal(body.messaging_type,'RESPONSE');assert.deepEqual(body.recipient,{id:'456'});assert.deepEqual(body.message,{text:'Xin chào'});
  assert.equal(String(options?.body).includes('private-token'),false);
  return Response.json({message_id:'mid.1',recipient_id:'456'});
 });
 assert.deepEqual(result,{status:'accepted',messageId:'mid.1',recipientId:'456'});assert.equal(calls,1);
});
test('Facebook uncertain dispatch outcomes are quarantined with no retry',async()=>{
 for(const outcome of [Response.json({message_id:'mid',recipient_id:'wrong'}),Response.json({success:true}),new Response('bad',{status:500})]) {
  let calls=0;assert.deepEqual(await sendFacebookText(input,async()=>{calls++;return outcome;}),{status:'unknown'});assert.equal(calls,1);
 }
 let calls=0;assert.deepEqual(await sendFacebookText(input,async()=>{calls++;throw new Error('secret upstream details');}),{status:'unknown'});assert.equal(calls,1);
});
test('Facebook invalid send input fails before contacting provider',async()=>{
 let calls=0;
 for(const change of [{text:''},{text:'x'.repeat(2001)},{pageId:'../me'},{recipientId:'abc'},{pageToken:'x\ny'}])
  await assert.rejects(sendFacebookText({...input,...change},async()=>{calls++;return Response.json({});}),/META_SEND_INVALID/);
 assert.equal(calls,0);
});
