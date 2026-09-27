import test from 'node:test';import assert from 'node:assert/strict';import {extractDocumentText} from '../src/server/document-extract';
import {readFile} from 'node:fs/promises';
test('document extraction preserves Vietnamese enterprise FAQ text from DOCX',async()=>{
 const bytes=await readFile(new URL('./fixtures/enterprise-faq.docx',import.meta.url));
 const result=await extractDocumentText('enterprise-faq.docx',bytes);
 assert.equal(result.filename,'enterprise-faq.docx');
 assert.equal(result.content,'Chính sách bảo hành: 12 tháng.');
 assert.deepEqual(result.warnings,[]);
});
test('document extraction rejects invalid DOCX with a stable API error',async()=>{
 await assert.rejects(extractDocumentText('broken.docx',Buffer.from('not a ZIP document')),{code:'INVALID_DOCUMENT'});
});
test('document extraction rejects malformed PDF',async()=>{await assert.rejects(extractDocumentText('file.pdf',Buffer.from('x')),{code:'INVALID_DOCUMENT'});});
test('document extraction bounds unknown formats before parsing',async()=>{await assert.rejects(extractDocumentText('file.doc',Buffer.from('x')),{code:'UNSUPPORTED_DOCUMENT_FORMAT'});});
