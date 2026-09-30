import test from 'node:test';
import assert from 'node:assert/strict';
import {AuthService} from '../src/services/auth.service';

test('logout retains local identity on network failure and clears it only after server success', async () => {
  const originalFetch = globalThis.fetch;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map([['gotek_session_token', 'fixture'], ['gotek_user_profile', '{}']]);
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value)
  }});
  try {
    globalThis.fetch = async () => {throw new Error('offline');};
    await assert.rejects(AuthService.logout());
    assert.equal(values.get('gotek_session_token'), 'fixture');
    assert.ok(values.has('gotek_user_profile'));
    globalThis.fetch = async () => new Response(JSON.stringify({ok: true}), {status: 200});
    await AuthService.logout();
    assert.equal(values.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
