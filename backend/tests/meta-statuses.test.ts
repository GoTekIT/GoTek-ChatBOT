import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMetaStatuses} from '../src/modules/meta/inbound';

test('Meta Messenger and Instagram delivery/read callbacks normalize to provider receipts',()=>{
 const result=normalizeMetaStatuses({object:'page',entry:[{id:'page-1',messaging:[{sender:{id:'customer'},recipient:{id:'page-1'},delivery:{mids:['mid-1','mid-2']}},{sender:{id:'customer'},recipient:{id:'page-1'},read:{mid:'mid-2'}}]}]});
 assert.deepEqual(result.map(({surface,providerMessageId,status,externalAccountId})=>({surface,providerMessageId,status,externalAccountId})),[{surface:'facebook_messenger',providerMessageId:'mid-1',status:'delivered',externalAccountId:'page-1'},{surface:'facebook_messenger',providerMessageId:'mid-2',status:'delivered',externalAccountId:'page-1'},{surface:'facebook_messenger',providerMessageId:'mid-2',status:'read',externalAccountId:'page-1'}]);
});

test('receipt status ordering is monotonic at the projection boundary',()=>{
 const statuses=normalizeMetaStatuses({object:'page',entry:[{id:'page-1',messaging:[{recipient:{id:'page-1'},delivery:{mids:['mid-1']}},{recipient:{id:'page-1'},read:{mid:'mid-1'}}]}]});
 assert.deepEqual(statuses.map(item=>item.status),['delivered','read']);
});
