import {test} from 'node:test';import assert from 'node:assert/strict';import {sendMetaText} from '../src/modules/meta/send';
test('Meta send fails closed when token reference is absent',async()=>{delete process.env.META_FIXTURE_TOKEN;assert.deepEqual(await sendMetaText({recipientId:'u',text:'x',pageAccessTokenRef:'META_FIXTURE_TOKEN'}),{status:'failed',errorCode:'META_TOKEN_NOT_CONFIGURED'});});
test('Meta send maps provider acceptance without exposing token',async()=>{process.env.META_FIXTURE_TOKEN='secret';const r=await sendMetaText({recipientId:'u',text:'x',pageAccessTokenRef:'META_FIXTURE_TOKEN',fetchImpl:async(_url,init)=>{assert.equal((init?.body as string).includes('secret'),false);assert.equal(new Headers(init?.headers).get('authorization'),'Bearer secret');assert.ok(init?.signal);return new Response(JSON.stringify({message_id:'mid'}),{status:200});}});assert.deepEqual(r,{status:'accepted',providerMessageId:'mid'});delete process.env.META_FIXTURE_TOKEN;});

test('Meta send preserves ambiguous provider outcomes',async()=>{
 process.env.META_FIXTURE_TOKEN='secret';
 try {
  for(const [status,body,expected] of [[200,{},'unknown'],[200,{message_id:''},'unknown'],[503,{},'unknown'],[400,{error:{}},'failed']] as const){
   const result=await sendMetaText({recipientId:'u',text:'hello',pageAccessTokenRef:'META_FIXTURE_TOKEN',fetchImpl:async()=>new Response(JSON.stringify(body),{status})});
   assert.equal(result.status,expected);assert.equal(result.providerMessageId,undefined);
  }
  const result=await sendMetaText({recipientId:'u',text:'hello',pageAccessTokenRef:'META_FIXTURE_TOKEN',fetchImpl:async()=>{throw new Error('timeout');}});
  assert.equal(result.status,'unknown');
 }finally{delete process.env.META_FIXTURE_TOKEN;}
});
test('WhatsApp send uses phone_number_id endpoint and Cloud API envelope',async()=>{process.env.META_FIXTURE_TOKEN='secret';let url='';let payload:any;const result=await sendMetaText({recipientId:'15550001',text:'hello',pageAccessTokenRef:'META_FIXTURE_TOKEN',channelKind:'whatsapp_business',externalAccountId:'15551111',fetchImpl:async(u,init)=>{url=String(u);payload=JSON.parse(String(init?.body));return new Response(JSON.stringify({messages:[{id:'wamid.test'}]}),{status:200});}});assert.equal(result.providerMessageId,'wamid.test');assert.equal(url,'https://graph.facebook.com/v20.0/15551111/messages');assert.deepEqual(payload,{messaging_product:'whatsapp',to:'15550001',type:'text',text:{body:'hello'}});delete process.env.META_FIXTURE_TOKEN;});

test('unsupported channels and missing WhatsApp account cannot dispatch to Messenger',async()=>{
 let calls=0;
 const transport:typeof fetch=async()=>{calls++;throw new Error('must not dispatch');};
 const base={recipientId:'user',text:'test',pageAccessTokenRef:'UNSET_TEST_TOKEN',fetchImpl:transport};
 for(const channelKind of ['threads','', 'unknown']){
  const result=await sendMetaText({...base,channelKind:channelKind as never});
  assert.deepEqual(result,{status:'failed',errorCode:'META_CHANNEL_UNSUPPORTED'});
 }
 for(const externalAccountId of [undefined,'',' ']){
  const result=await sendMetaText({...base,channelKind:'whatsapp_business',externalAccountId});
  assert.deepEqual(result,{status:'failed',errorCode:'META_ACCOUNT_REQUIRED'});
 }
 assert.equal(calls,0);
});

test('Threads publishing uses public post API and returns container receipt',async()=>{process.env.THREADS_FIXTURE_TOKEN='secret';let url='';const result=await (await import('../src/modules/meta/threads')).publishThreadsText({text:'hello Threads',tokenRef:'THREADS_FIXTURE_TOKEN',replyToId:'post-1',fetchImpl:async(u,init)=>{url=String(u);assert.equal(new Headers(init?.headers).get('authorization'),'Bearer secret');return new Response(JSON.stringify({id:'threads-post-1'}),{status:200});}});assert.equal(result.status,'accepted');assert.equal(result.providerPostId,'threads-post-1');assert.match(url,/reply_to_id=post-1/);delete process.env.THREADS_FIXTURE_TOKEN;});

test('Meta media resolver exchanges provider ID server-side without exposing token',async()=>{process.env.META_MEDIA_FIXTURE='secret';const result=await (await import('../src/modules/meta/media')).resolveMetaMedia({mediaId:'media-1',tokenRef:'META_MEDIA_FIXTURE',fetchImpl:async(url,init)=>{assert.match(String(url),/media-1/);assert.equal(new Headers(init?.headers).get('authorization'),'Bearer secret');return new Response(JSON.stringify({url:'https://cdn.example.test/media',mime_type:'image/jpeg'}),{status:200});}});assert.deepEqual(result,{status:'accepted',url:'https://cdn.example.test/media',mimeType:'image/jpeg'});delete process.env.META_MEDIA_FIXTURE;});
