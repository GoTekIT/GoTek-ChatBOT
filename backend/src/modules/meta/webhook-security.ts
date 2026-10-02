import {createHmac, timingSafeEqual} from 'node:crypto';
import {HttpError} from '../../core/security';

export function signatureValid(raw: Buffer | undefined, signature: string | undefined, secret = process.env.META_APP_SECRET || ''): boolean {
  if (!raw || !secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}

export function verifyMetaWebhook(mode: string | undefined, token: string | undefined, challenge: string | undefined): string {
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN || '';
  if (mode === 'subscribe' && expected && token && challenge && challenge.length <= 1024) {
    const actualBytes = Buffer.from(token);
    const expectedBytes = Buffer.from(expected);
    if (actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)) return challenge;
  }
  throw new HttpError(403, 'META_WEBHOOK_VERIFY_FAILED');
}
