import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inboxDraftKey,parseInboxDrafts} from '../src/web/inbox-drafts';
const id='11111111-1111-4111-8111-111111111111';
test('H02/H03 draft storage is distinct by workspace and user',()=>{
 assert.notEqual(inboxDraftKey('user','workspace-a'),inboxDraftKey('user','workspace-b'));
 assert.notEqual(inboxDraftKey('one','workspace'),inboxDraftKey('two','workspace'));
});
test('H03 draft parsing preserves Vietnamese text and rejects corrupt entries',()=>{
 const text='Nháp tiếng Việt\nChưa gửi';
 assert.deepEqual(parseInboxDrafts(JSON.stringify({[id]:text})),{[id]:text});
 for(const raw of [null,'{','null','[]','"string"'])assert.deepEqual(parseInboxDrafts(raw),{});
 for(const value of [1,{},['text'],'x'.repeat(10001)])assert.deepEqual(parseInboxDrafts(JSON.stringify({[id]:value})),{});
 assert.deepEqual(parseInboxDrafts('{"__proto__":{"polluted":true},"unknown":"text"}'),{});
});
test('H03 pending replies retain retry identity and internal visibility across serialization',async()=>{
 const {parsePendingReplies}=await import('../src/web/inbox-drafts');
 const payload={clientId:id,body:'Ghi chú riêng',visibility:'internal' as const};
 assert.deepEqual(parsePendingReplies(JSON.stringify({[id]:payload})),{[id]:payload});
 for(const value of [{...payload,clientId:'bad'},{...payload,body:''},{...payload,visibility:'other'},null])
  assert.deepEqual(parsePendingReplies(JSON.stringify({[id]:value})),{});
});
