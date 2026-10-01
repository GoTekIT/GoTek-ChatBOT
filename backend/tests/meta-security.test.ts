import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac, randomBytes} from 'node:crypto';
import {verifyMetaSignature, encryptMetaToken, decryptMetaToken} from '../src/modules/meta/security';

test('Meta webhook authenticates exact bytes and rejects missing/malformed/forged signatures', () => {
  const secret='test-only-secret', raw=Buffer.from('{"object":"page"}');
  const signature='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
  assert.equal(verifyMetaSignature(raw,signature,secret),true);
  for(const header of [undefined, [], '', 'sha256=00', signature.toUpperCase()]) assert.equal(verifyMetaSignature(raw,header,secret),false);
  assert.equal(verifyMetaSignature(Buffer.from('{ "object":"page"}'),signature,secret),false);
  assert.equal(verifyMetaSignature(raw,signature,'other'),false);
  assert.equal(verifyMetaSignature(raw,signature,''),false);
});

test('Meta token encryption binds tenant/asset and detects tampering, with unique nonces', () => {
  const key=randomBytes(32).toString('hex');
  const encrypted=encryptMetaToken('test-only-token',key,'tenant-a','page-a');
  assert.equal(decryptMetaToken(encrypted,key,'tenant-a','page-a'),'test-only-token');
  assert.notEqual(encrypted,encryptMetaToken('test-only-token',key,'tenant-a','page-a'));
  assert.equal(encrypted.includes('test-only-token'),false);
  assert.throws(()=>decryptMetaToken(encrypted,key,'tenant-b','page-a'));
  assert.throws(()=>decryptMetaToken(encrypted,key,'tenant-a','page-b'));
  assert.throws(()=>decryptMetaToken(encrypted,randomBytes(32).toString('hex'),'tenant-a','page-a'));
  const parts=encrypted.split('.');parts[2]='0'.repeat(32);
  assert.throws(()=>decryptMetaToken(parts.join('.'),key,'tenant-a','page-a'));
  assert.throws(()=>encryptMetaToken('token','bad','tenant-a','page-a'),/KEY_INVALID/);
});
