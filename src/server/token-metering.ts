/**
 * Provider-neutral token accounting.  This module deliberately has no database
 * or provider imports so a worker can meter a response after the provider call
 * without leaking credentials or coupling accounting to transport details.
 */
export type TokenUsage = Readonly<{
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated: boolean;
}>;

export type TokenRate = Readonly<{
  promptMicrosPer1k: bigint;
  completionMicrosPer1k: bigint;
}>;

export type TokenMeterEvent = Readonly<{
  workspaceId: string;
  operationKey: string;
  provider: string;
  model: string;
  usage: TokenUsage;
  costMicros: bigint;
}>;

const integer = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return undefined;
};

/** Conservative deterministic estimate used when an adapter does not expose usage. */
export function estimateTokens(text: string): number {
  const chars = typeof text === 'string' ? text.length : 0;
  return chars === 0 ? 0 : Math.max(1, Math.ceil(chars / 4));
}

/** Accepts common OpenAI, Gemini and Anthropic usage shapes, without trusting totals. */
export function normalizeTokenUsage(raw: unknown, promptText = '', completionText = ''): TokenUsage {
  if (raw != null && (typeof raw !== 'object' || Array.isArray(raw))) throw new Error('INVALID_TOKEN_USAGE');
  const value = (raw ?? {}) as Record<string, unknown>;
  const read = (names: string[]): number | undefined => {
    let result: number | undefined;
    for (const name of names) {
      if (!Object.hasOwn(value, name)) continue;
      const parsed = integer(value[name]);
      if (parsed === undefined) throw new Error('INVALID_TOKEN_USAGE');
      if (result !== undefined && result !== parsed) throw new Error('INVALID_TOKEN_USAGE');
      result = parsed;
    }
    return result;
  };
  const prompt = read(['promptTokens', 'prompt_tokens', 'input_tokens', 'inputTokens']);
  const completion = read(['completionTokens', 'completion_tokens', 'output_tokens', 'outputTokens']);
  const total = read(['totalTokens', 'total_tokens']);
  const promptTokens = prompt ?? estimateTokens(promptText);
  const completionTokens = completion ?? estimateTokens(completionText);
  const sum = promptTokens + completionTokens;
  if (!Number.isSafeInteger(sum)) throw new Error('INVALID_TOKEN_USAGE');
  // Some providers include additional token classes in their total.
  const totalTokens = Math.max(total ?? sum, sum);
  return Object.freeze({promptTokens, completionTokens, totalTokens, estimated: prompt === undefined || completion === undefined});
}

function validateUsage(usage: TokenUsage): void {
  if (!usage || typeof usage !== 'object' ||
      ![usage.promptTokens, usage.completionTokens, usage.totalTokens].every(
        value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) ||
      typeof usage.estimated !== 'boolean' ||
      !Number.isSafeInteger(usage.promptTokens + usage.completionTokens) ||
      usage.totalTokens < usage.promptTokens + usage.completionTokens) {
    throw new Error('INVALID_TOKEN_USAGE');
  }
}

/** Prices are integer micro-units per 1,000 tokens to avoid floating point drift. */
export function costMicros(usage: TokenUsage, rate: TokenRate): bigint {
  validateUsage(usage);
  if (!rate || typeof rate.promptMicrosPer1k !== 'bigint' ||
      typeof rate.completionMicrosPer1k !== 'bigint' ||
      rate.promptMicrosPer1k < 0n || rate.completionMicrosPer1k < 0n) throw new Error('INVALID_TOKEN_RATE');
  const prompt = BigInt(usage.promptTokens) * rate.promptMicrosPer1k;
  const completion = BigInt(usage.completionTokens) * rate.completionMicrosPer1k;
  return (prompt + completion + 999n) / 1000n;
}

export function makeTokenMeterEvent(input: {
  workspaceId: string;
  operationKey: string;
  provider: string;
  model: string;
  usage: TokenUsage;
  rate: TokenRate;
}): TokenMeterEvent {
  if (!input || ['workspaceId', 'operationKey', 'provider', 'model'].some(
    name => typeof input[name as keyof typeof input] !== 'string' ||
      !(input[name as keyof typeof input] as string).trim())) throw new Error('INVALID_TOKEN_METER_EVENT');
  const cost = costMicros(input.usage, input.rate);
  const usage = Object.freeze({
    promptTokens: input.usage.promptTokens,
    completionTokens: input.usage.completionTokens,
    totalTokens: input.usage.totalTokens,
    estimated: input.usage.estimated,
  });
  return Object.freeze({workspaceId: input.workspaceId, operationKey: input.operationKey, provider: input.provider, model: input.model, usage, costMicros: cost});
}
