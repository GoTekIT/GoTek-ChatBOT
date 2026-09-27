import test from 'node:test';import assert from 'node:assert/strict';
import {invokeProvider} from '../src/server/provider-transport';
import {resolveProviderTarget} from '../src/server/web-source-security';
test('provider endpoint validation blocks private DNS and non-HTTPS',async()=>{
 await assert.rejects(resolveProviderTarget('https://internal.example.test/api',async()=>['10.0.0.7']),(e:any)=>e.code==='SSRF_BLOCKED');
 await assert.rejects(resolveProviderTarget('http://example.com/api',async()=>['8.8.8.8']),(e:any)=>e.code==='PROVIDER_HTTPS_REQUIRED');
 await assert.rejects(invokeProvider('custom_llm','m','https://internal.example.test/api','k','q',{resolveHost:async()=>['192.168.1.5'],fetch:async()=>new Response('{}')}),{message:'SSRF_BLOCKED'});
});
