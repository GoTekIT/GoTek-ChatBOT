import test from 'node:test';
import assert from 'node:assert/strict';
import {mapMessage} from '../src/services/inbox.service';
import {metaDeliveryLabel} from '../src/screens/inbox/meta-delivery';
test('Meta receipt is not represented as customer delivery or read confirmation',()=>{
 const row={id:'m',client_id:'c',sequence:1,author_type:'agent',visibility:'public',body:'Reply',created_at:'2026-10-01T00:00:00Z'};
 for(const status of ['queued','dispatching','accepted','unknown','cancelled'] as const) {
  assert.equal(mapMessage({...row,delivery_status:status}).deliveryStatus,status);
  assert.ok(metaDeliveryLabel(status));
 }
 assert.match(metaDeliveryLabel('accepted'),/chưa xác nhận khách/);
 assert.match(metaDeliveryLabel('unknown'),/không tự gửi lại/);
 assert.equal(mapMessage(row).deliveryStatus,undefined);
});
