import {createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';

/** Verify the original HTTP bytes, before any JSON parser changes the payload. */
export function verifyMetaSignature(raw: Buffer, signature: unknown, appSecret: string): boolean {
  if (!appSecret || typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', appSecret).update(raw).digest();
  const actual = Buffer.from(signature.slice(7), 'hex');
  return timingSafeEqual(expected, actual);
}

function encryptionKey(encoded: string): Buffer {
  if (!/^[a-f0-9]{64}$/i.test(encoded)) throw new Error('META_ENCRYPTION_KEY_INVALID');
  return Buffer.from(encoded, 'hex');
}

/** Bind ciphertext to its tenant and asset; moving it to another row cannot decrypt it. */
export function encryptMetaToken(token: string, key: string, workspaceId: string, assetId: string): string {
  if (!token || !workspaceId || !assetId) throw new Error('META_TOKEN_CONTEXT_REQUIRED');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv);
  cipher.setAAD(Buffer.from(JSON.stringify([workspaceId, assetId])));
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join('.');
}

export function decryptMetaToken(value: string, key: string, workspaceId: string, assetId: string): string {
  const parts = value.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1' || !/^[a-f0-9]{24}$/.test(parts[1]) ||
      !/^[a-f0-9]{32}$/.test(parts[2]) || !/^(?:[a-f0-9]{2})+$/.test(parts[3])) throw new Error('META_TOKEN_INVALID');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(key), Buffer.from(parts[1], 'hex'));
  decipher.setAAD(Buffer.from(JSON.stringify([workspaceId, assetId])));
  decipher.setAuthTag(Buffer.from(parts[2], 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(parts[3], 'hex')), decipher.final()]).toString('utf8');
}
