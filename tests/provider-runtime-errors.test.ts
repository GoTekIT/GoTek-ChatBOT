import test from 'node:test';
import assert from 'node:assert/strict';
import {invokeProviderDetailed} from '../src/server/provider-transport';

const adapters = ['gemini','anthropic','claude_code','openai','chatgpt','custom_llm'] as const;
const secret = 'runtime-test-secret-do-not-leak';
const endpoint = 'https://provider.invalid/runtime-test';

for (const mode of ['timeout','network','invalid'] as const) {
  test(`provider transport ${mode} has stable redacted errors across adapters`, async () => {
    for (const adapter of adapters) {
      const fetcher = async () => {
        if (mode === 'timeout') throw new DOMException('upstream timed out', 'TimeoutError');
        if (mode === 'network') throw new Error(`socket failed for ${secret}`);
        return new Response('{not-json', {headers: {'content-type': 'application/json'}});
      };
      const invocation = invokeProviderDetailed(
        adapter, 'runtime-test-model', adapter === 'custom_llm' ? endpoint : undefined,
        secret, 'hello', {fetch: fetcher},
      );
      const expected = mode === 'timeout' ? 'PROVIDER_TIMEOUT'
        : mode === 'network' ? 'PROVIDER_NETWORK_ERROR' : 'PROVIDER_INVALID_RESPONSE';
      await assert.rejects(invocation, (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, expected);
        assert.ok(!error.message.includes(secret));
        assert.ok(!error.message.includes(endpoint));
        return true;
      });
    }
  });
}
