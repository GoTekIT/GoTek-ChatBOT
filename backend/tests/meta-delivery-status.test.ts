import test from 'node:test';
import assert from 'node:assert/strict';
import {metaDeliveryStatus} from '../src/modules/meta/delivery-status';
test('terminal dispatcher failures and uncertain outcomes do not remain queued',()=>{
 assert.equal(metaDeliveryStatus(null,'dead'),'failed');
 assert.equal(metaDeliveryStatus(null,'cancelled'),'failed');
 assert.equal(metaDeliveryStatus(null,'unknown'),'unknown');
 assert.equal(metaDeliveryStatus(null,'succeeded'),'unknown');
 for(const state of ['queued','running','retry',undefined])assert.equal(metaDeliveryStatus(null,state),'queued');
});
test('provider receipt remains authoritative after a settlement failure',()=>{
 for(const receipt of ['accepted','delivered','read'])for(const state of ['dead','unknown','running'])assert.equal(metaDeliveryStatus(receipt,state),receipt);
});
