import test from 'node:test';
import assert from 'node:assert/strict';
import {sendMetaMedia} from '../src/modules/meta/send';
test('WhatsApp media maps document and keeps caption; invalid requests do not dispatch',async()=>{
 process.env.MEDIA_SEND_FIXTURE='fixture';
 let calls=0;
 const transport:typeof fetch=async(_url,init)=>{
  calls++;
  assert.equal(init?.redirect,'error');
  assert.deepEqual(JSON.parse(String(init?.body)),{messaging_product:'whatsapp',to:'123',type:'document',document:{link:'https://example.test/doc.pdf',caption:'Document'}});
  return new Response(JSON.stringify({messages:[{id:'wamid.media'}]}));
 };
 const base={recipientId:'123',mediaType:'file' as const,mediaUrl:'https://example.test/doc.pdf',caption:'Document',pageAccessTokenRef:'MEDIA_SEND_FIXTURE',channelKind:'whatsapp_business' as const,externalAccountId:'456',fetchImpl:transport};
 try{
  assert.deepEqual(await sendMetaMedia(base),{status:'accepted',providerMessageId:'wamid.media'});
  for(const override of [{mediaUrl:'https://user:pass@example.test/a'},{mediaUrl:'http://example.test/a'},{recipientId:''},{mediaType:'audio' as const},{mediaType:'bogus' as never}])assert.equal((await sendMetaMedia({...base,...override})).status,'failed');
  assert.equal(calls,1);
 }finally{delete process.env.MEDIA_SEND_FIXTURE;}
});

test('Facebook and Instagram media do not send unsupported captions',async()=>{
 process.env.META_FIXTURE_TOKEN='fixture';
 try {
  for(const channelKind of ['facebook_messenger','instagram_messaging'] as const){
   let payload:any;
   const result=await (await import('../src/modules/meta/send')).sendMetaMedia({channelKind,recipientId:'user',mediaType:'image',mediaUrl:'https://cdn.example.test/image.jpg',pageAccessTokenRef:'META_FIXTURE_TOKEN',fetchImpl:async(_url,init)=>{payload=JSON.parse(String(init?.body));return new Response(JSON.stringify({message_id:'mid'}));}});
   assert.equal(result.status,'accepted');
   assert.equal('caption' in payload.message.attachment.payload,false);
  }
 }finally{delete process.env.META_FIXTURE_TOKEN;}
});
