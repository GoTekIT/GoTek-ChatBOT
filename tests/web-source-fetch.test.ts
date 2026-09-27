import test from 'node:test';import assert from 'node:assert/strict';import {fetchWebSource} from '../src/server/web-source-fetch';

test('H11 fetch rejects private approved addresses before opening a socket',async()=>{
 const resolve=async(host:string)=>host==='local.test'?['127.0.0.1']:[];
 await assert.rejects(fetchWebSource('http://local.test/',{maxBytes:4},resolve),(e:any)=>e.code==='SSRF_BLOCKED');
 await assert.rejects(fetchWebSource('http://local.test/',{maxRedirects:0},async()=>['10.0.0.1']),(e:any)=>e.code==='SSRF_BLOCKED');
});

test('H11 absolute deadline also bounds a stalled DNS resolution',async()=>{
 const started=Date.now();
 await assert.rejects(fetchWebSource('https://stalled.example/',{timeoutMs:100},()=>new Promise(()=>{})),(e:any)=>e.code==='SOURCE_TIMEOUT');
 assert.ok(Date.now()-started<2000,'DNS timeout must not wait for resolver completion');
});
