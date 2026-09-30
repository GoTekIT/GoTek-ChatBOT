import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertModelGrantUsable} from '../src/modules/ai/model-grant-policy';

test('H28 grant policy rejects expired/revoked grants and accepts active unexpired grant',async()=>{
 const queries:string[]=[]; let mode='active';
 const db:any={query:async(sql:string)=>{queries.push(sql);return {rows:mode==='active'?[{id:'grant-1',expires_at:null}]:[]};}};
 await assert.doesNotReject(()=>assertModelGrantUsable(db,'workspace','model','chat'));
 mode='expired'; await assert.rejects(()=>assertModelGrantUsable(db,'workspace','model','chat'),(e:any)=>e.code==='MODEL_NOT_GRANTED');
 mode='revoked'; await assert.rejects(()=>assertModelGrantUsable(db,'workspace','model','chat'),(e:any)=>e.code==='MODEL_NOT_GRANTED');
 assert.match(queries[0],/expires_at IS NULL OR g\.expires_at>now\(\)/);
 assert.equal(queries.length,3);
});
