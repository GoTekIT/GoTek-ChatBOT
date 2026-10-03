import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalizeRetainedFacebookStatuses,normalizeRetainedFacebookMessage} from '../src/modules/meta/replay-normalization';
const row={surface:'facebook_messenger',external_account_id:'page',external_event_id:'mid',payload:{sender:{id:'page'},recipient:{id:'customer'},timestamp:1700000000000,message:{mid:'mid',text:'reply',is_echo:true}}};
test('retained echo recovers customer direction and provider identity',()=>{
 const event=normalizeRetainedFacebookMessage(row);
 assert.equal(event?.isPageReply,true);assert.equal(event?.senderId,'customer');assert.equal(event?.eventId,'mid');
});
test('retained replay rejects changed route, identity and unsupported event',()=>{
 assert.equal(normalizeRetainedFacebookMessage({...row,external_event_id:'different'}),undefined);
 assert.equal(normalizeRetainedFacebookMessage({...row,external_account_id:'other'}),undefined);
 assert.equal(normalizeRetainedFacebookMessage({...row,surface:'instagram_messaging'}),undefined);
 assert.equal(normalizeRetainedFacebookMessage({...row,payload:{read:{watermark:1700000000000}}}),undefined);
});

test('retained watermark recovers only with matching route and immutable envelope hash',()=>{
 const payload={sender:{id:'customer'},recipient:{id:'page'},read:{watermark:1700000000000}};
 const external_event_id=createHash('sha256').update(`facebook_messenger:page:${JSON.stringify(payload)}`).digest('hex');
 const retained={...row,payload,external_event_id};
 assert.equal(normalizeRetainedFacebookStatuses(retained)[0]?.status,'read');
 assert.deepEqual(normalizeRetainedFacebookStatuses({...retained,external_account_id:'other'}),[]);
 assert.deepEqual(normalizeRetainedFacebookStatuses({...retained,external_event_id:'wrong'}),[]);
});
