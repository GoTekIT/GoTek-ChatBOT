import {HttpError} from '../../core/security';

export type MetaFetch = typeof fetch;
/** Bounded provider transport. Never forwards provider bodies/errors (which may contain tokens). */
export async function metaJsonRequest(
  url: URL,
  init: RequestInit,
  request: MetaFetch = fetch,
  timeoutMs = 10_000
): Promise<Record<string, unknown>> {
  if (url.protocol !== 'https:' || url.username || url.password
      || !['graph.facebook.com','graph.instagram.com','api.instagram.com'].includes(url.hostname)
      || (url.port && url.port !== '443')) {
    throw new HttpError(500,'META_ENDPOINT_INVALID');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await request(url, {...init,redirect:'error',signal:controller.signal});
    if (!response.ok) {
      await response.body?.cancel();
      throw new HttpError(502,'META_REQUEST_FAILED');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new HttpError(502,'META_RESPONSE_INVALID');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const {done,value} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1_048_576) {
          await reader.cancel();
          throw new HttpError(502,'META_RESPONSE_TOO_LARGE');
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let data: unknown;
    try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new HttpError(502,'META_RESPONSE_INVALID'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(502,'META_RESPONSE_INVALID');
    if ('error' in data) throw new HttpError(502,'META_REQUEST_FAILED');
    return data as Record<string,unknown>;
  } catch(error) {
    if (controller.signal.aborted) throw new HttpError(504,'META_REQUEST_TIMEOUT');
    if (error instanceof HttpError) throw error;
    throw new HttpError(502,'META_REQUEST_FAILED');
  } finally { clearTimeout(timeout); }
}
