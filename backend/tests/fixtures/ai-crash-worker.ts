import { runAiWorkerOnce } from '../../src/modules/jobs/worker';
import { pool } from '../../src/core/db';
import { setTimeout } from 'node:timers/promises';

const [workspace, mode] = process.argv.slice(2);
let providerCalls = 0;
const invoke = async () => {
  providerCalls++;
  if (mode === 'crash') {
    process.send?.({ event: 'provider_started' });
    await setTimeout(60000);
  }
  return 'Unexpected duplicate answer';
};
try {
  const first = await runAiWorkerOnce(workspace, invoke);
  if (mode === 'restart') {
    // Recovery sets the first-attempt retry backoff to two seconds.
    await setTimeout(2200);
    const second = await runAiWorkerOnce(workspace, invoke);
    process.send?.({ event: 'result', first: first.state, second: second.state, providerCalls });
  }
} finally {
  await pool.end();
  process.disconnect?.();
}
