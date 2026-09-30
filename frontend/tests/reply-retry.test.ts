import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replyRetryStore} from '../src/screens/inbox/reply-retry';
test('lost acknowledgement reuses identity after reload; scope and visibility stay distinct', () => {
  const values = new Map<string,string>();
  const storage = {getItem: (k:string) => values.get(k) ?? null, setItem: (k:string,v:string) => {values.set(k,v);}, removeItem: (k:string) => {values.delete(k);}};
  const first=replyRetryStore('user','tenant',storage).begin('conversation','internal','Nội bộ');
  const reloaded=replyRetryStore('user','tenant',storage);
  assert.equal(reloaded.begin('conversation','internal','Nội bộ'),first);
  assert.notEqual(reloaded.begin('conversation','public','Nội bộ'),first);
  assert.notEqual(replyRetryStore('other','tenant',storage).begin('conversation','internal','Nội bộ'),first);
  assert.notEqual(replyRetryStore('user','other',storage).begin('conversation','internal','Nội bộ'),first);
  reloaded.acknowledge('conversation','internal','Nội bộ','stale-response');
  assert.equal(reloaded.begin('conversation','internal','Nội bộ'),first);
  reloaded.acknowledge('conversation','internal','Nội bộ',first);
  assert.notEqual(reloaded.begin('conversation','internal','Nội bộ'),first);
});
test('unavailable persistent storage fails before an id can be used for sending', () => {
  const retry=replyRetryStore('u','w',{getItem:()=>null,setItem:()=>{throw new Error('quota');},removeItem:()=>{}});
  assert.throws(()=>retry.begin('c','public','body'),/quota/);
});
