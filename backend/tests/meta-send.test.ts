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
