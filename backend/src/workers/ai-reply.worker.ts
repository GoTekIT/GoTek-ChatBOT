import {setTimeout as delay} from 'node:timers/promises';
import {defaultWorkspaceProviderInvoke, runAiWorkerAll} from '../modules/jobs/worker.js';

let isRunning = false;
let shouldStop = false;
let abortController: AbortController | null = null;

/**
 * Background AI Reply Worker
 * Automatically claims and processes queued 'ai.reply' jobs across all active tenants.
 */
export async function startAiReplyWorker(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  shouldStop = false;
  abortController = new AbortController();

  let invoke;
  try {
    invoke = defaultWorkspaceProviderInvoke();
  } catch (err: any) {
    console.warn('[Worker 🤖] AI Reply Background Worker could not initialize provider transport:', err?.message || err);
    isRunning = false;
    return;
  }

  let cursor: string | null = null;
  console.log('[Worker 🤖] AI Reply Background Worker started ✅ (Polling queue)');

  // Fire-and-forget background processing loop
  (async () => {
    while (!shouldStop) {
      try {
        const batch = await runAiWorkerAll(invoke, {
          after: cursor,
          shouldStop: () => shouldStop
        });
        cursor = batch.next;

        const hasSucceeded = batch.results.some(r => r.state === 'succeeded');
        const sleepMs = hasSucceeded ? 250 : 1500;
        await delay(sleepMs, undefined, {signal: abortController?.signal}).catch(() => {});
      } catch {
        if (!shouldStop) {
          await delay(2000, undefined, {signal: abortController?.signal}).catch(() => {});
        }
      }
    }
    isRunning = false;
    console.log('[Worker 🤖] AI Reply Background Worker stopped');
  })().catch(err => {
    isRunning = false;
    console.warn('[Worker 🤖] AI Reply Background Worker encountered an unexpected exit:', err);
  });
}

export function stopAiReplyWorker(): void {
  shouldStop = true;
  abortController?.abort();
}
