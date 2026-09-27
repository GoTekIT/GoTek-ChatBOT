import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {invokeProvider,invokeEmbedding} from '../src/server/provider-transport';

test('real HTTP transport does not follow provider redirects for chat or embeddings',async()=>{
 let redirects=0,targets=0;
 const server=createServer((req,res)=>{
  if(req.url==='/target'){targets++;res.end('{}');return;}
  redirects++;res.writeHead(307,{Location:'/target'});res.end();
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const address=server.address();assert.ok(address&&typeof address!=='string');
 const endpoint=`http://127.0.0.1:${address.port}/redirect`;
 try{
  await assert.rejects(invokeProvider('custom_llm','fixture',endpoint,'fixture-not-secret','test'),{message:'SSRF_BLOCKED'});
  await assert.rejects(invokeEmbedding('custom_llm','fixture',endpoint,'fixture-not-secret','test'),{message:'SSRF_BLOCKED'});
  assert.equal(redirects,0);assert.equal(targets,0);
 }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
