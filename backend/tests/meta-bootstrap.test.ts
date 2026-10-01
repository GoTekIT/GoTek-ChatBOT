import {test} from 'node:test';
import assert from 'node:assert/strict';
import {metaBootstrapConfig} from '../src/modules/meta/bootstrap-config';
const env={META_WORKSPACE_ID:'11111111-1111-4111-8111-111111111111',META_WHATSAPP_PHONE_NUMBER_ID:'123',META_WHATSAPP_CHANNEL_ID:'22222222-2222-4222-8222-222222222222',META_WHATSAPP_TOKEN_REF:'META_WA_TEST_TOKEN',META_WA_TEST_TOKEN:'private-fixture'};
test('bootstrap keeps only credential references and requires a populated secret',()=>{
 assert.equal(JSON.stringify(metaBootstrapConfig(env)).includes('private-fixture'),false);
 assert.throws(()=>metaBootstrapConfig({...env,META_WA_TEST_TOKEN:''}),/META_BOOTSTRAP_TOKEN_MISSING/);
 assert.throws(()=>metaBootstrapConfig({...env,META_WHATSAPP_TOKEN_REF:undefined}),/META_BOOTSTRAP_CONFIG_INVALID/);
});
test('bootstrap rejects production, partial config and shared channel/account mappings',()=>{
 assert.throws(()=>metaBootstrapConfig({...env,NODE_ENV:'production'}),/PRODUCTION_DISABLED/);
 assert.throws(()=>metaBootstrapConfig({...env,META_PAGE_ID:'456'}),/CONFIG_INVALID/);
 const ig={META_INSTAGRAM_ACCOUNT_ID:'456',META_INSTAGRAM_CHANNEL_ID:env.META_WHATSAPP_CHANNEL_ID,META_INSTAGRAM_TOKEN_REF:'META_WA_TEST_TOKEN'};
 assert.throws(()=>metaBootstrapConfig({...env,...ig}),/DUPLICATE_MAPPING/);
 assert.throws(()=>metaBootstrapConfig({...env,...ig,META_INSTAGRAM_CHANNEL_ID:'33333333-3333-4333-8333-333333333333',META_INSTAGRAM_ACCOUNT_ID:'123'}),/DUPLICATE_MAPPING/);
});
