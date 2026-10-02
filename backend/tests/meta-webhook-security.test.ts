import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {signatureValid, verifyMetaWebhook} from '../src/modules/meta/webhook-security';

test('Meta authenticates exact raw bytes and rejects tampered or malformed signatures', () => {
  const raw=Buffer.from('{"object":"page", "entry":[]}');
  const secret='fixture-only-secret';
  const signature='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
  assert.equal(signatureValid(raw,signature,secret),true);
  assert.equal(signatureValid(Buffer.from('{"object":"page","entry":[]}'),signature,secret),false);
  for(const invalid of [undefined,'','sha256=ab','sha256='+'g'.repeat(64),signature+'00']) {
    assert.equal(signatureValid(raw,invalid,secret),false);
  }
  assert.equal(signatureValid(raw,signature,''),false);
  assert.equal(signatureValid(raw,signature,'different-secret'),false);
});

test('Verification reads runtime configuration and fails closed without a token', () => {
  const before=process.env.META_WEBHOOK_VERIFY_TOKEN;
  try {
    delete process.env.META_WEBHOOK_VERIFY_TOKEN;
    assert.throws(()=>verifyMetaWebhook('subscribe','','123'));
    process.env.META_WEBHOOK_VERIFY_TOKEN='fixture-verify';
    assert.equal(verifyMetaWebhook('subscribe','fixture-verify','123'),'123');
    assert.throws(()=>verifyMetaWebhook('subscribe','wrong','123'));
    assert.throws(()=>verifyMetaWebhook('unsubscribe','fixture-verify','123'));
    assert.throws(()=>verifyMetaWebhook('subscribe','fixture-verify',undefined));
  } finally {
    if(before===undefined)delete process.env.META_WEBHOOK_VERIFY_TOKEN;
    else process.env.META_WEBHOOK_VERIFY_TOKEN=before;
  }
});
