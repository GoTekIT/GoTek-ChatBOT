import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMetaStatuses} from '../src/modules/meta/inbound';

test('Meta Messenger and Instagram delivery/read callbacks normalize to provider receipts',()=>{
 const result=normalizeMetaStatuses({object:'page',entry:[{id:'page-1',messaging:[{sender:{id:'customer'},recipient:{id:'page-1'},delivery:{mids:['mid-1','mid-2']}},{sender:{id:'customer'},recipient:{id:'page-1'},read:{mid:'mid-2'}}]}]});
 assert.deepEqual(result.map(({surface,providerMessageId,status,externalAccountId})=>({surface,providerMessageId,status,externalAccountId})),[{surface:'facebook_messenger',providerMessageId:'mid-1',status:'delivered',externalAccountId:'page-1'},{surface:'facebook_messenger',providerMessageId:'mid-2',status:'delivered',externalAccountId:'page-1'},{surface:'facebook_messenger',providerMessageId:'mid-2',status:'read',externalAccountId:'page-1'}]);
});

test('delivery and read event order is preserved during normalization',()=>{
 const statuses=normalizeMetaStatuses({object:'page',entry:[{id:'page-1',messaging:[{sender:{id:'customer'},recipient:{id:'page-1'},delivery:{mids:['mid-1']}},{sender:{id:'customer'},recipient:{id:'page-1'},read:{mid:'mid-1'}}]}]});
 assert.deepEqual(statuses.map(item=>item.status),['delivered','read']);
});


test('watermark-only callbacks retain customer, provider time and stable event identity',()=>{
 const payload={object:'page',entry:[{id:'page-1',messaging:[{sender:{id:'customer'},recipient:{id:'page-1'},read:{watermark:1700000000000}}]}]};
 const [status]=normalizeMetaStatuses(payload);
 assert.equal(status.watermarkAt,'2023-11-14T22:13:20.000Z');
 assert.equal(status.recipientId,'customer');
 assert.equal(status.providerMessageId,'');
 assert.equal(status.status,'read');
 assert.deepEqual(normalizeMetaStatuses(payload),[status]);
});

test('invalid watermark and callbacks addressed to another Page are rejected',()=>{
 for(const watermark of [0,-1,'invalid',Infinity])assert.equal(normalizeMetaStatuses({object:'page',entry:[{id:'page',messaging:[{sender:{id:'customer'},recipient:{id:'page'},read:{watermark}}]}]}).length,0);
 assert.equal(normalizeMetaStatuses({object:'page',entry:[{id:'page',messaging:[{sender:{id:'customer'},recipient:{id:'other'},read:{watermark:1700000000000}}]}]}).length,0);
});


test('watermark callback queues once without a duplicate unknown event',async()=>{
 const {queueMetaBody}=await import('../src/modules/meta/messenger');
 const calls:unknown[][]=[];
 const db={query:async(_sql:string,values:unknown[])=>{calls.push(values);return {rows:[{ingressId:'fixture',state:'queued'}]};}};
 const result=await queueMetaBody(db as never,{object:'page',entry:[{id:'page',messaging:[{sender:{id:'customer'},recipient:{id:'page'},read:{watermark:1700000000000}}]}]});
 assert.equal(result.queued,1);
 assert.equal(calls[0][3],'status');
});


test('delivery and read for one message survive queue dedupe; repeated callbacks retain their key',async()=>{
 const {queueMetaBody}=await import('../src/modules/meta/messenger');
 const keys:string[]=[];
 const db={query:async(_sql:string,args:unknown[])=>{keys.push(String(args[2]));return {rows:[{ingressId:'fixture',state:'queued'}]};}};
 const body={object:'page',entry:[{id:'page',messaging:[
  {sender:{id:'customer'},recipient:{id:'page'},delivery:{mids:['same-mid']}},
  {sender:{id:'customer'},recipient:{id:'page'},read:{mid:'same-mid'}}
 ]}]};
 await queueMetaBody(db as never,body);await queueMetaBody(db as never,body);
 assert.notEqual(keys[0],keys[1]);assert.equal(keys[0],keys[2]);assert.equal(keys[1],keys[3]);
});
