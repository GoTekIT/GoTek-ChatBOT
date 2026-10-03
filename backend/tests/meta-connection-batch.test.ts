import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {createMetaConnectionsBatch} from '../src/modules/meta/connections';
const actor={workspace_id:'11111111-1111-4111-8111-111111111111',user_id:'22222222-2222-4222-8222-222222222222',role:'Owner'};
const account={platform:'facebook_messenger',externalAccountId:'1234',accountName:'Test Page',tokenRef:'META_BATCH_TEST_TOKEN'};
function noQueries(){return {query:async()=>{assert.fail('Rejected batch must not reach SQL');}} as unknown as PoolClient;}
test('Agent cannot create connections in batch',async()=>{
 await assert.rejects(createMetaConnectionsBatch(noQueries(),{...actor,role:'Agent'},{connections:[account]}),/FORBIDDEN/);
});
test('invalid later item is rejected before writing earlier item',async()=>{
 await assert.rejects(createMetaConnectionsBatch(noQueries(),actor,{connections:[account,{...account,externalAccountId:'invalid'}]}));
});
test('batch rejects duplicate account and duplicate channel before SQL',async()=>{
 const previous=process.env.META_BATCH_TEST_TOKEN; process.env.META_BATCH_TEST_TOKEN='test-only';
 try {
  await assert.rejects(createMetaConnectionsBatch(noQueries(),actor,{connections:[account,account]}),/META_ACCOUNT_ALREADY_CONNECTED/);
  const channelId='33333333-3333-4333-8333-333333333333';
  await assert.rejects(createMetaConnectionsBatch(noQueries(),actor,{connections:[{...account,channelId},{...account,channelId,externalAccountId:'5678'}]}),/META_CHANNEL_ALREADY_BOUND/);
 } finally {if(previous===undefined)delete process.env.META_BATCH_TEST_TOKEN;else process.env.META_BATCH_TEST_TOKEN=previous;}
});
test('empty and oversized batches are rejected before SQL',async()=>{
 for(const connections of [[],Array(51).fill(account)])await assert.rejects(createMetaConnectionsBatch(noQueries(),actor,{connections}));
});
