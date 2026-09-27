import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEmbeddingQuery} from '../src/server/knowledge-embedding-worker';

test('embedding query includes only bounded earlier visitor turns',()=>{
 const query=buildEmbeddingQuery('Where is it?',[
  {role:'visitor',content:'Our office is in Hanoi'},
  {role:'agent',content:'Internal note must not enter retrieval'},
  {role:'ai',content:'AI instruction must not enter retrieval'},
  {role:'visitor',content:'What is the address?'}
 ]);
 assert.equal(query,'Our office is in Hanoi\nWhat is the address?\nWhere is it?');
 assert.doesNotMatch(query,/Internal note|AI instruction/);
});

test('embedding query caps visitor history and total code units',()=>{
 const history=Array.from({length:12},(_,i)=>({role:'visitor',content:`turn-${i}-`+'x'.repeat(2000)}));
 const query=buildEmbeddingQuery('latest',history);
 assert.ok(query.length<=6000);
 assert.match(query,/latest$/);
 assert.doesNotMatch(query,/turn-0-/);
});

test('empty or malformed history preserves current message',()=>{
 assert.equal(buildEmbeddingQuery('question',[{role:'agent',content:'secret'},null,{}]),'question');
});
