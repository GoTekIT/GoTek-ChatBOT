import test from 'node:test';
import assert from 'node:assert/strict';
import {ApiError, api} from '../src/api/api';

test('H10/H11 Knowledge ApiError maps domain codes to readable Vietnamese messages', () => {
  const errDocTooLarge = new ApiError('DOCUMENT_TOO_LARGE');
  assert.equal(errDocTooLarge.message, 'Tập tin vượt quá giới hạn 2MB.');

  const errDocText = new ApiError('DOCUMENT_TEXT_TOO_LARGE');
  assert.equal(errDocText.message, 'Nội dung văn bản vượt quá 120.000 ký tự.');

  const errInvalidDoc = new ApiError('INVALID_DOCUMENT');
  assert.equal(errInvalidDoc.message, 'Tập tin không hợp lệ hoặc bị hỏng.');

  const errEmpty = new ApiError('EMPTY_DOCUMENT');
  assert.equal(errEmpty.message, 'Tập tin không có nội dung văn bản.');

  const errFormat = new ApiError('UNSUPPORTED_DOCUMENT_FORMAT');
  assert.equal(errFormat.message, 'Chỉ hỗ trợ tập tin văn bản .pdf hoặc .docx.');

  const errRollback = new ApiError('ROLLBACK_UNAVAILABLE');
  assert.equal(errRollback.message, 'Chỉ có thể khôi phục phiên bản đã từng được xuất bản.');

  const errDraft = new ApiError('ALREADY_DRAFT');
  assert.equal(errDraft.message, 'Phiên bản này đã là bản nháp hiện tại.');

  const errNoPublished = new ApiError('NO_PUBLISHED_SOURCE');
  assert.equal(errNoPublished.message, 'Chưa có phiên bản nào được xuất bản.');

  const errConflict = new ApiError('VERSION_CONFLICT');
  assert.equal(errConflict.message, 'Quy tắc đã được thay đổi ở phiên khác. Tải lại danh sách trước khi thử lại.');
});

test('H11 Knowledge api handles FormData without forcing application/json Content-Type', async () => {
  let capturedHeaders: Record<string, string> = {};
  let capturedBody: unknown = null;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    capturedBody = init?.body;
    return new Response(JSON.stringify({ok: true, imported: 1}), {
      status: 200,
      headers: {'content-type': 'application/json'}
    });
  }) as typeof globalThis.fetch;

  try {
    const formData = new FormData();
    formData.append('title', 'Test');
    const result = await api('/knowledge/import-document', 'POST', formData);
    assert.equal(result.imported, 1);
    assert.equal(capturedHeaders['X-Gotek-Request'], '1');
    assert.equal(capturedHeaders['Content-Type'], undefined);
    assert.ok(capturedBody instanceof FormData);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
