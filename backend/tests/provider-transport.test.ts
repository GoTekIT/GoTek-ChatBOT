import {normalizeTokenUsage} from '../src/modules/ai/token-metering';
import test from 'node:test';
import assert from 'node:assert/strict';
import {invokeProvider,invokeProviderDetailed} from '../src/modules/ai/provider-transport';

test('shared provider transport preserves Gemini, Anthropic and OpenAI-compatible contracts', async () => {
  for (const adapter of ['gemini', 'anthropic', 'claude_code', 'openai', 'chatgpt', 'custom_llm']) {
    const fetch: typeof globalThis.fetch = async (url, options) => {
      const headers = options?.headers as Record<string, string>;
      const body = JSON.parse(options?.body as string);
      assert.equal(options?.method, 'POST');
      assert.equal(options?.redirect, 'error');
      assert.ok(options?.signal instanceof AbortSignal);
      if (adapter === 'gemini') {
        assert.equal(String(url), 'https://example.invalid/infer?version=1&key=test%2Bkey');
        assert.deepEqual(body, {contents: [{parts: [{text: 'grounded prompt'}]}]});
        assert.equal(headers.authorization, undefined);
        return Response.json({candidates: [{content: {parts: [{text: 'one'}, {inlineData: {}}, {text: 'two'}]}}]});
      }
      assert.equal(String(url), 'https://example.invalid/infer?version=1');
      assert.equal(body.model, 'model-id');
      assert.deepEqual(body.messages, [{role: 'user', content: 'grounded prompt'}]);
      if (adapter === 'anthropic' || adapter === 'claude_code') {
        assert.equal(headers['x-api-key'], 'test+key');
        assert.equal(headers['anthropic-version'], '2023-06-01');
        assert.equal(body.max_tokens, 2000);
        return Response.json({content: [{type: 'text', text: 'one'}, {type: 'tool_use'}, {type: 'text', text: 'two'}]});
      }
      assert.equal(headers.authorization, 'Bearer test+key');
      return Response.json({choices: [{message: {content: 'one\ntwo'}}]});
    };
    assert.equal(await invokeProvider(adapter, 'model-id', 'https://example.invalid/infer?version=1', 'test+key', 'grounded prompt', {fetch, timeoutMs: 20000}), 'one\ntwo');
  }
});

test('detailed provider transport preserves usage metadata without secrets', async () => {
 const result=await invokeProviderDetailed('openai','m',undefined,'key','prompt',{fetch:async()=>new Response(JSON.stringify({choices:[{message:{content:'ok'}}],usage:{prompt_tokens:11,completion_tokens:3,total_tokens:14}}),{status:200,headers:{'content-type':'application/json'}})});
 assert.equal(result.text,'ok'); assert.deepEqual(result.usage,{promptTokens:11,completionTokens:3,totalTokens:14});
});

test('shared transport rejects provider HTTP failure and unusable output without exposing response body', async () => {
  await assert.rejects(invokeProvider('openai', 'm', undefined, 'key', 'prompt', {
    fetch: async () => new Response('sensitive provider details', {status: 429}),
  }), /^Error: PROVIDER_HTTP_429$/);
  for (const data of [{}, {choices: [{message: {content: '  '}}]}, {choices: [{message: {content: []}}]}]) {
    await assert.rejects(invokeProvider('openai', 'm', undefined, 'key', 'prompt', {
      fetch: async () => Response.json(data),
    }), /PROVIDER_EMPTY_RESPONSE/);
  }
});

test('shared transport classifies timeout, network and malformed provider responses', async () => {
  await assert.rejects(invokeProvider('openai', 'm', undefined, 'key', 'prompt', {
    timeoutMs: 1,
    fetch: async (_url, options) => {
      await new Promise((_, reject) => options?.signal?.addEventListener('abort', () => reject(new DOMException('deadline', 'TimeoutError')), {once: true}));
      throw new Error('unreachable');
    },
  }), /^Error: PROVIDER_TIMEOUT$/);
  await assert.rejects(invokeProvider('openai', 'm', undefined, 'key', 'prompt', {
    fetch: async () => { throw new Error('dns lookup leaked?'); },
  }), /^Error: PROVIDER_NETWORK_ERROR$/);
  await assert.rejects(invokeProvider('openai', 'm', undefined, 'key', 'prompt', {
    fetch: async () => new Response('not-json', {status: 200}),
  }), /^Error: PROVIDER_INVALID_RESPONSE$/);
});

test('partial provider usage can be normalized without undefined fields',async()=>{
 for(const [adapter,data] of [
  ['anthropic',{content:[{type:'text',text:'Answer'}],usage:{input_tokens:20,output_tokens:5}}],
  ['gemini',{candidates:[{content:{parts:[{text:'Answer'}]}}],usageMetadata:{promptTokenCount:20,candidatesTokenCount:5}}],
 ] as const){
  const result=await invokeProviderDetailed(adapter,'model',null,'test-key','prompt',{fetch:async()=>new Response(JSON.stringify(data))});
  assert.equal(Object.hasOwn(result.usage!,'totalTokens'),false);
  assert.deepEqual(normalizeTokenUsage(result.usage),{promptTokens:20,completionTokens:5,totalTokens:25,estimated:false});
 }
});

 test('custom LLM requires explicit routing and unknown adapters never send data',async()=>{
 let calls=0;const fetch=async()=>{calls++;throw new Error('unexpected network');};
 for(const adapter of ['local','unknown'])await assert.rejects(invokeProvider(adapter,'m',null,'secret','private context',{fetch:fetch as typeof globalThis.fetch}),{message:'PROVIDER_ADAPTER_UNSUPPORTED'});
 for(const base of [null,undefined,'','   '])await assert.rejects(invokeProvider('custom_llm','m',base,'secret','private context',{fetch:fetch as typeof globalThis.fetch}),{message:'PROVIDER_ENDPOINT_REQUIRED'});
 assert.equal(calls,0);
 });
