import test from 'node:test';import assert from 'node:assert/strict';import {invokeEmbedding} from '../src/modules/ai/provider-transport';
test('embedding transport supports OpenAI-compatible and Gemini response shapes without leaking secrets',async()=>{
 const old=globalThis.fetch;try{
  globalThis.fetch=async(_u:any,o:any)=>{assert.equal(o.redirect,'error');const b=JSON.parse(o.body);assert.equal(b.model,'embed-v1');return new Response(JSON.stringify({data:[{embedding:[.1,.2]}]}));};
  assert.deepEqual(await invokeEmbedding('custom_llm','embed-v1','https://provider.test/embed','secret','hello',{resolveHost:async()=>['93.184.216.34']}),{vector:[.1,.2],model:'embed-v1'});
  globalThis.fetch=async(_u,o)=>{assert.equal(o?.redirect,'error');return new Response(JSON.stringify({embedding:{values:[.3,.4]}}));};
  assert.deepEqual(await invokeEmbedding('gemini','text-embedding-004',undefined,'secret','hello'),{vector:[.3,.4],model:'text-embedding-004'});
  globalThis.fetch=async()=>new Response(JSON.stringify({data:[{embedding:[0,0]}]}));
  await assert.rejects(invokeEmbedding('openai','embed-v1',undefined,'secret','hello'),{message:'PROVIDER_INVALID_EMBEDDING'});
 }finally{globalThis.fetch=old;}
});
test('embedding rejects unsupported routing and malformed vectors before persistence',async()=>{
 let calls=0;
 const fetch:typeof globalThis.fetch=async()=>{calls++;return new Response('null');};
 for(const adapter of ['anthropic','claude_code','local','unknown'])await assert.rejects(invokeEmbedding(adapter,'m',null,'k','q',{fetch}),{message:'EMBEDDING_ADAPTER_UNSUPPORTED'});
 await assert.rejects(invokeEmbedding('custom_llm','m',null,'k','q',{fetch}),{message:'EMBEDDING_ENDPOINT_REQUIRED'});
 await assert.rejects(invokeEmbedding('openai','m',null,'k',' ',{fetch}),{message:'EMBEDDING_INPUT_INVALID'});
 assert.equal(calls,0);
 await assert.rejects(invokeEmbedding('openai','m',null,'k','q',{fetch}),{message:'PROVIDER_INVALID_EMBEDDING'});
 for(const vector of [[1,'bad'],Array(4097).fill(1)]){
  await assert.rejects(invokeEmbedding('openai','m',null,'k','q',{fetch:async()=>new Response(JSON.stringify({data:[{embedding:vector}]}))}),{message:'PROVIDER_INVALID_EMBEDDING'});
 }
});
