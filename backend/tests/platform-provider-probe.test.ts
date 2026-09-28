import test from 'node:test';
import assert from 'node:assert/strict';
import {testProvider} from '../src/modules/ai/platform-agent';

test('provider probe requires a configured chat model and valid nonempty inference',async()=>{
 const original=globalThis.fetch;process.env.GOTEK_PROBE_TEST_KEY='local-test-only';
 let adapter='openai',models:any[]=[{name:'configured-model'}],calls=0;
 const db:any={query:async(sql:string)=>({rows:sql.includes('FROM providers')?[{adapter,secret_ref:'GOTEK_PROBE_TEST_KEY',base_url:null,enabled:true}]:models})};
 try{
 globalThis.fetch=async(_url:any,options:any)=>{calls++;assert.equal(JSON.parse(options.body).model,'configured-model');return new Response(JSON.stringify({choices:[{message:{content:'OK'}}]}));};
 assert.deepEqual(await testProvider(db,'test'),{status:'confirmed'});assert.equal(calls,1);
 globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:' '}}]}));
 assert.deepEqual(await testProvider(db,'test'),{status:'failed',error:'PROVIDER_EMPTY_RESPONSE'});
 models=[];await assert.rejects(()=>testProvider(db,'test'),(e:any)=>e.code==='CHAT_MODEL_REQUIRED');
 adapter='local';assert.equal((await testProvider(db,'test')).status,'not_configured');
 }finally{globalThis.fetch=original;delete process.env.GOTEK_PROBE_TEST_KEY;}
});
