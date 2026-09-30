import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { pool, scope, transaction } from '../src/core/db';
import { enqueueJob } from '../src/modules/jobs/jobs';
import { runWorkerOnce } from '../src/modules/jobs/worker';

// This is deliberately a scheduler-level fixture.  The AI handler is injected
// by the worker, so this proves the durable claim fence without provider keys.
const admin = new pg.Pool({ host: '127.0.0.1', port: 55432, user: 'gotek_migrator', database: 'gotek_chatbot' });

test('AI dispatch fence claims one queued source when workers race', async () => {
  const workspace = randomUUID();
  const key = `dispatch-fence-${workspace}`;
  try {
    await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)', [workspace, 'AI dispatch fence']);
    await transaction(async db => {
      await scope(db, workspace);
      await enqueueJob(db, workspace, {
        kind: 'ai.reply', key, external: false,
        payload: { conversationId: randomUUID(), messageId: randomUUID(), ownerVersion: 1 },
      });
    });
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const invoke = async () => { calls += 1; await gate; return { receipt: `ai:${workspace}` }; };
    const first = runWorkerOnce(workspace, { 'ai.reply': invoke });
    const second = runWorkerOnce(workspace, { 'ai.reply': invoke });
    await new Promise(resolve => setTimeout(resolve, 30));
    release();
    const results = await Promise.all([first, second]);
    assert.equal(calls, 1, 'SKIP LOCKED claim must invoke a source only once');
    assert.deepEqual(results.map(result => result.state).sort(), ['idle', 'succeeded']);
    const row = (await admin.query('SELECT state,attempts FROM jobs WHERE workspace_id=$1 AND idempotency_key=$2', [workspace, key])).rows[0];
    assert.equal(row.state, 'succeeded');
    assert.equal(Number(row.attempts), 1);
  } finally {
    await admin.query('DELETE FROM jobs WHERE workspace_id=$1', [workspace]);
    await admin.query('DELETE FROM workspaces WHERE id=$1', [workspace]);
  }
});

test('AI provider invocation error is terminal-unknown and is not immediately replayed', async () => {
  const workspace = randomUUID();
  const key = `dispatch-error-${workspace}`;
  try {
    await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)', [workspace, 'AI dispatch error fence']);
    await transaction(async db => {
      await scope(db, workspace);
      await enqueueJob(db, workspace, {
        kind: 'ai.reply', key, external: false,
        payload: { source: randomUUID() },
      });
    });
    let calls = 0;
    const first = await runWorkerOnce(workspace, {
      'ai.reply': async () => { calls += 1; throw new Error('provider invoke interrupted'); },
    });
    assert.equal(first.state, 'unknown');
    const second = await runWorkerOnce(workspace, {
      'ai.reply': async () => { calls += 1; return { receipt: 'must-not-replay' }; },
    });
    assert.equal(second.state, 'idle');
    assert.equal(calls, 1);
    const row = (await admin.query('SELECT state,error_code FROM jobs WHERE workspace_id=$1 AND idempotency_key=$2', [workspace, key])).rows[0];
    assert.equal(row.state, 'unknown');
    assert.equal(row.error_code, 'HANDLER_OUTCOME_UNKNOWN');
  } finally {
    await admin.query('DELETE FROM jobs WHERE workspace_id=$1', [workspace]);
    await admin.query('DELETE FROM workspaces WHERE id=$1', [workspace]);
  }
});

test.after(async () => { await admin.end(); await pool.end(); });
