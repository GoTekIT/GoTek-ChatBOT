import test from 'node:test';
import assert from 'node:assert/strict';
import {invokeProviderDetailed} from '../src/modules/ai/provider-transport';
import {normalizeTokenUsage} from '../src/modules/ai/token-metering';

/**
 * Provider adapters have different wire formats, but the metering boundary
 * must receive one stable receipt shape.  This test deliberately exercises
 * every supported remote adapter, including the custom OpenAI-compatible
 * route, without making a network call or exposing a provider response body.
 */
test('provider receipt contract maps usage and text for every remote adapter', async () => {
  const fixtures: Record<string, unknown> = {
    gemini: {
      candidates: [{content: {parts: [{text: 'gemini answer'}]}}],
      usageMetadata: {promptTokenCount: 12, candidatesTokenCount: 4, totalTokenCount: 16},
    },
    anthropic: {
      content: [{type: 'text', text: 'anthropic answer'}],
      usage: {input_tokens: 12, output_tokens: 4},
    },
    claude_code: {
      content: [{type: 'text', text: 'claude answer'}],
      usage: {input_tokens: 12, output_tokens: 4},
    },
    openai: {
      choices: [{message: {content: 'openai answer'}}],
      usage: {prompt_tokens: 12, completion_tokens: 4, total_tokens: 16},
    },
    chatgpt: {
      choices: [{message: {content: 'chatgpt answer'}}],
      usage: {prompt_tokens: 12, completion_tokens: 4, total_tokens: 16},
    },
    custom_llm: {
      choices: [{message: {content: 'custom answer'}}],
      usage: {prompt_tokens: 12, completion_tokens: 4, total_tokens: 16},
    },
  };

  for (const [adapter, payload] of Object.entries(fixtures)) {
    const result = await invokeProviderDetailed(
      adapter,
      'fixture-model',
      adapter === 'custom_llm' ? 'https://example.invalid/custom' : 'https://example.invalid/infer',
      'secret-is-never-a-receipt',
      'grounded prompt',
      {fetch: async () => Response.json(payload)},
    );
    assert.match(result.text, /answer$/);
    const usage = normalizeTokenUsage(result.usage, 'grounded prompt', result.text);
    assert.deepEqual(usage, {
      promptTokens: 12,
      completionTokens: 4,
      totalTokens: 16,
      estimated: false,
    });
  }
});

test('provider receipt errors use stable codes and never include secret or response body', async () => {
  const secret = 'super-secret-provider-key';
  const responseBody = `upstream diagnostic ${secret}`;
  for (const status of [401, 429, 500]) {
    await assert.rejects(
      invokeProviderDetailed('openai', 'fixture-model', undefined, secret, 'prompt', {
        fetch: async () => new Response(responseBody, {status}),
      }),
      (error: unknown) => {
        assert.equal((error as Error).message, `PROVIDER_HTTP_${status}`);
        assert.equal((error as Error).message.includes(secret), false);
        assert.equal((error as Error).message.includes('upstream diagnostic'), false);
        return true;
      },
    );
  }
});

test('malformed provider JSON returns stable errors instead of parser exceptions', async () => {
  for (const adapter of ['gemini','anthropic','claude_code','openai','chatgpt','custom_llm']) {
    for (const payload of [null, [], 'invalid']) {
      await assert.rejects(invokeProviderDetailed(adapter,'fixture-model','https://example.invalid/infer','key','prompt',{
        fetch:async()=>Response.json(payload),
      }), {message:'PROVIDER_INVALID_RESPONSE'});
    }
  }
  for (const [adapter,payload] of [
    ['gemini',{candidates:{}}],
    ['gemini',{candidates:[{content:{parts:{}}}]}],
    ['anthropic',{content:{}}],
  ] as const) {
    await assert.rejects(invokeProviderDetailed(adapter,'fixture-model',undefined,'key','prompt',{
      fetch:async()=>Response.json(payload),
    }), {message:'PROVIDER_INVALID_RESPONSE'});
  }
});
