import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPdfText } from '../src/modules/extractors/pdf-extract';

import {fixturePdf} from './fixtures/pdf';

test('PDF extraction reads bounded text from a valid PDF', async () => {
  const result = await extractPdfText('faq.pdf', fixturePdf('GoTek PDF FAQ'));
  assert.equal(result.filename, 'faq.pdf');
  assert.equal(result.content, 'GoTek PDF FAQ');
  assert.deepEqual(result.warnings, []);
});

test('PDF extraction rejects invalid bytes before parser execution', async () => {
  await assert.rejects(extractPdfText('faq.pdf', Buffer.from('not a pdf')), { code: 'INVALID_DOCUMENT' });
});

test('PDF extraction rejects non-PDF extensions', async () => {
  await assert.rejects(extractPdfText('faq.docx', fixturePdf('text')), { code: 'UNSUPPORTED_DOCUMENT_FORMAT' });
});

test('PDF extraction rejects oversized input', async () => {
  await assert.rejects(extractPdfText('faq.pdf', Buffer.concat([fixturePdf('text'), Buffer.alloc(2_000_000)])), { code: 'DOCUMENT_TOO_LARGE' });
});
