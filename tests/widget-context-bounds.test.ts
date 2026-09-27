import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWidgetAiContext} from '../src/server/knowledge-retrieval';
test('widget AI context bounds message, individual sources and total content',async()=>{
 const db:any={query:async(_sql:string,args:any[])=>{
  assert.equal(args[1],'PUBLIC');assert.equal(args[2].length,500);
  return {rows:Array.from({length:20},(_,i)=>({item_id:String(i),published_version_id:String(i),title:'Source',content:'x'.repeat(8000),audience:'PUBLIC'}))};
 }};
 const result=await buildWidgetAiContext(db,'tenant','q'.repeat(10000),20);
 assert.equal(result.sources.length,4);
 assert.equal(result.sources.reduce((n,s)=>n+s.content.length,0),16000);
 assert.ok(result.sources.every(s=>s.content.length===4000&&s.truncated));
 await assert.rejects(buildWidgetAiContext(db,'tenant','q'.repeat(10001)));
});

test('widget excludes corrupted stored chunks from provider context',async()=>{
 const db:any={query:async()=>({rows:[{published_version_id:'v',title:'Warranty',content:'Injected warranty',chunk_index:0,content_hash:'mismatched',audience:'PUBLIC'}]})};
 assert.deepEqual((await buildWidgetAiContext(db,'tenant','warranty')).sources,[]);
});
