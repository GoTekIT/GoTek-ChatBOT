import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {sealMetaSecret,openMetaSecret} from '../src/modules/meta/credential-vault';
test('credential encryption is randomized and bound to tenant, connection and purpose',()=>{
 const previous=process.env.META_CREDENTIAL_ENCRYPTION_KEY;
 process.env.META_CREDENTIAL_ENCRYPTION_KEY=randomBytes(32).toString('base64');
 try {
  const secret='test-page-secret',context='meta-page-token:workspace:connection';
  const first=sealMetaSecret(secret,context),second=sealMetaSecret(secret,context);
  assert.notEqual(first,second);assert.ok(!first.includes(secret));
  assert.equal(openMetaSecret(first,context),secret);
  for(const wrong of ['meta-page-token:other:connection','meta-page-token:workspace:other','oauth:workspace:connection'])assert.throws(()=>openMetaSecret(first,wrong),/META_CREDENTIAL_DECRYPT_FAILED/);
  const parts=first.split('.');parts[3]=Buffer.from('tampered').toString('base64');
  assert.throws(()=>openMetaSecret(parts.join('.'),context),/META_CREDENTIAL_DECRYPT_FAILED/);
  process.env.META_CREDENTIAL_ENCRYPTION_KEY=randomBytes(32).toString('base64');
  assert.throws(()=>openMetaSecret(first,context),/META_CREDENTIAL_DECRYPT_FAILED/);
  delete process.env.META_CREDENTIAL_ENCRYPTION_KEY;
  assert.throws(()=>sealMetaSecret(secret,context),/META_CREDENTIAL_KEY_NOT_CONFIGURED/);
 }finally{if(previous===undefined)delete process.env.META_CREDENTIAL_ENCRYPTION_KEY;else process.env.META_CREDENTIAL_ENCRYPTION_KEY=previous;}
});
