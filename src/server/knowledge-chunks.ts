import {z} from 'zod';

/** A bounded unit suitable for indexing or sending as grounded context. */
export type KnowledgeChunk = {
  index: number;
  text: string;
  start: number;
  end: number;
  tokenEstimate: number;
};

const optionsSchema = z.object({
  maxChars: z.number().int().min(200).max(8000).default(900),
  overlapChars: z.number().int().min(0).max(1200).default(120),
}).strict();

const clean = (value: string) => value.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const estimateTokens = (value: string) => Math.max(1, Math.ceil(value.length / 4));

/**
 * Split a knowledge document on paragraph/sentence boundaries where possible.
 * Offsets refer to the normalized text, making chunks deterministic and easy to
 * re-index. Overlap keeps an answer from losing context at a boundary.
 */
export function chunkKnowledgeText(input: string, options: unknown = {}): KnowledgeChunk[] {
  const text = z.string().trim().min(1).max(200_000).parse(input);
  const {maxChars, overlapChars} = optionsSchema.parse(options);
  if (overlapChars >= maxChars) throw new z.ZodError([{code: 'custom', path: ['overlapChars'], message: 'overlapChars must be smaller than maxChars'}]);
  const normalized = clean(text);
  const chunks: KnowledgeChunk[] = [];
  let start = 0;
  while (start < normalized.length) {
    let hardEnd = Math.min(normalized.length, start + maxChars);
    if (hardEnd < normalized.length && /[\uD800-\uDBFF]/.test(normalized[hardEnd - 1]) && /[\uDC00-\uDFFF]/.test(normalized[hardEnd])) hardEnd--;
    let end = hardEnd;
    if (hardEnd < normalized.length) {
      const window = normalized.slice(start, hardEnd);
      const boundary = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('。'), window.lastIndexOf('! '), window.lastIndexOf('? '));
      if (boundary >= Math.floor(maxChars * 0.55)) end = start + boundary + (window[boundary] === '.' || window[boundary] === '!' || window[boundary] === '?' ? 1 : 0);
    }
    if (end <= start) end = hardEnd;
    const value = normalized.slice(start, end).trim();
    if (value) chunks.push({index: chunks.length, text: value, start, end, tokenEstimate: estimateTokens(value)});
    if (end >= normalized.length) break;
    let next = Math.max(start + 1, end - overlapChars);
    if (/[\uDC00-\uDFFF]/.test(normalized[next]) && /[\uD800-\uDBFF]/.test(normalized[next - 1])) next++;
    start = next;
  }
  return chunks;
}

export type RankedKnowledgeChunk = KnowledgeChunk & {score: number; matchedTerms: string[]};

const terms = (value: string) => Array.from(new Set((value.toLocaleLowerCase('vi-VN').match(/[\p{L}\p{N}]+/gu) ?? []).filter(x => x.length > 1)));

/** Deterministic lexical baseline for later replacement by embeddings. */
export function rankKnowledgeChunks(query: string, chunks: KnowledgeChunk[], limit = 8): RankedKnowledgeChunk[] {
  const q = z.string().trim().min(1).max(500).parse(query);
  const count = z.number().int().min(1).max(50).parse(limit);
  const queryTerms = terms(q);
  const phrase = q.toLocaleLowerCase('vi-VN');
  return chunks.map(chunk => {
    const haystack = chunk.text.toLocaleLowerCase('vi-VN');
    const matchedTerms = queryTerms.filter(term => haystack.includes(term));
    const frequency = matchedTerms.reduce((sum, term) => sum + haystack.split(term).length - 1, 0);
    const score = matchedTerms.length * 2 + frequency + (haystack.includes(phrase) ? 5 : 0);
    return {...chunk, score, matchedTerms};
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, count);
}

/** Select ranked chunks without exceeding a provider context budget. */
export function selectChunkContext(chunks: RankedKnowledgeChunk[], maxTokens = 4000): RankedKnowledgeChunk[] {
  const budget = z.number().int().min(1).max(32_000).parse(maxTokens);
  let remaining = budget;
  return chunks.filter(chunk => {
    if (chunk.tokenEstimate > remaining) return false;
    remaining -= chunk.tokenEstimate;
    return true;
  });
}
