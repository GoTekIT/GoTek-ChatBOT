import { PDFParse } from 'pdf-parse';
import { HttpError } from './security';

const MAX_BYTES = 2_000_000;
const MAX_TEXT = 120_000;

/** Extract bounded text from a PDF upload. Caller is responsible for auth and storage. */
export async function extractPdfText(filename: string, bytes: Buffer) {
  if (bytes.length > MAX_BYTES) throw new HttpError(413, 'DOCUMENT_TOO_LARGE');
  if (!filename.toLowerCase().endsWith('.pdf')) throw new HttpError(415, 'UNSUPPORTED_DOCUMENT_FORMAT');
  if (bytes.length < 5 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new HttpError(400, 'INVALID_DOCUMENT');
  }

  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    const content = result.text.replace(/\r\n?/g, '\n').replace(/\n-- \d+ of \d+ --\s*$/g, '').trim();
    if (!content) throw new HttpError(400, 'EMPTY_DOCUMENT');
    if (content.length > MAX_TEXT) throw new HttpError(413, 'DOCUMENT_TEXT_TOO_LARGE');
    return { filename, content, warnings: [] as string[] };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'INVALID_DOCUMENT');
  } finally {
    await parser.destroy();
  }
}
