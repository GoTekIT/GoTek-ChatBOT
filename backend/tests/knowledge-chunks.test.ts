import test from 'node:test';
import assert from 'node:assert/strict';
import {chunkKnowledgeText, rankKnowledgeChunks, selectChunkContext} from '../src/modules/knowledge/knowledge-chunks';

test('chunkKnowledgeText preserves bounded overlap and deterministic offsets', () => {
  const text = 'Đoạn đầu nói về bảo hành.\n\n' + 'Thông tin bảo hành và đổi trả của doanh nghiệp. '.repeat(30);
  const chunks = chunkKnowledgeText(text, {maxChars: 220, overlapChars: 40});
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(chunk => chunk.text.length <= 220));
  assert.equal(chunks[0].index, 0);
  assert.equal(chunks.at(-1)?.end, text.replace(/[ \t]+/g, ' ').trim().length);
  assert.ok(chunks.slice(1).every((chunk, i) => chunks[i].end - chunk.start === 40));
  const normalized = text.replace(/[ \t]+/g, ' ').trim();
  assert.ok(chunks.every(chunk => normalized.slice(chunk.start, chunk.end).trim() === chunk.text));
});

test('rankKnowledgeChunks favors an exact phrase and exposes matched terms', () => {
  const chunks = chunkKnowledgeText('Chính sách bảo hành sản phẩm là 12 tháng.\n\nĐịa chỉ liên hệ tại Hà Nội.', {maxChars: 200, overlapChars: 10});
  const ranked = rankKnowledgeChunks('chính sách bảo hành', chunks);
  assert.equal(ranked[0].index, 0);
  assert.ok(ranked[0].matchedTerms.includes('bảo') && ranked[0].matchedTerms.includes('hành'));
  assert.ok(ranked[0].score > 0);
});

test('selectChunkContext enforces a token budget', () => {
  const chunks = chunkKnowledgeText('thông tin '.repeat(500), {maxChars: 300, overlapChars: 0});
  const ranked = rankKnowledgeChunks('thông tin', chunks, 10);
  const selected = selectChunkContext(ranked, 80);
  assert.ok(selected.reduce((total, chunk) => total + chunk.tokenEstimate, 0) <= 80);
});

test('chunk boundaries preserve supplementary Unicode through UTF-8 storage',()=>{
 const input='a'.repeat(199)+'😀'+'b'.repeat(220);
 const chunks=chunkKnowledgeText(input,{maxChars:200,overlapChars:0});
 assert.equal(chunks.map(c=>Buffer.from(c.text).toString('utf8')).join(''),input);
 for(const chunk of chunkKnowledgeText(input.repeat(3),{maxChars:200,overlapChars:40}))assert.equal(Buffer.from(chunk.text).toString('utf8'),chunk.text);
});
