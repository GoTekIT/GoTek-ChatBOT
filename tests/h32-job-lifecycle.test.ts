import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { pool, scope, transaction } from '../src/server/db';
import { enqueueJob, claimJob, finishJob, recoverStaleJobs } from '../src/server/jobs';
import { runWorkerOnce } from '../src/server/worker';

const admin = new pg.Pool({ host: '/tmp', port: 55432, user: 'gotek_migrator', database: 'gotek_chatbot' });
after(async () => { await pool.end(); await admin.end(); });

test('H32.02 stale lease becomes UNKNOWN for external work and cannot duplicate side effect', async () => {
  const workspace = randomUUID();
  let providerCalls = 0;
  try {
    await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)', [workspace, 'H32 lifecycle']);
    const run = <T>(fn: (db: pg.PoolClient) => Promise<T>) => transaction(async db => { await scope(db, workspace); return fn(db); });
    const job = await run(db => enqueueJob(db, workspace, {
      kind: 'provider.send', key: randomUUID(), payload: { message: 'once' }, external: true,
    }));
    const claimed = await run(db => claimJob(db, 30));
    assert.equal(claimed?.id, job.id);

    // A crashed worker may have performed an irreversible provider call before losing its lease.
    providerCalls++;
    await admin.query("UPDATE jobs SET lease_until=now()-interval '1 second' WHERE id=$1", [job.id]);
    const recovered = await run(recoverStaleJobs);
    assert.deepEqual(recovered, [{ id: job.id, state: 'unknown' }]);

    // Recovery must never make external work claimable again, so the replacement worker cannot resend.
    const replacement = await run(db => runWorkerOnce(workspace, {
      'provider.send': async () => { providerCalls++; return { receipt: 'must-not-send' }; },
    }));
    assert.equal(replacement.state, 'idle');
    assert.equal(providerCalls, 1);
    assert.deepEqual((await admin.query('SELECT state,error_code,lease_token,lease_until FROM jobs WHERE id=$1', [job.id])).rows[0], {
      state: 'unknown', error_code: 'LEASE_EXPIRED', lease_token: null, lease_until: null,
    });
  } finally {
    await admin.query('DELETE FROM jobs WHERE workspace_id=$1', [workspace]);
    await admin.query('DELETE FROM workspaces WHERE id=$1', [workspace]);
  }
});

test('H32.02 failed local work reaches dead-letter after bounded attempts', async () => {
  const workspace = randomUUID();
  try {
    await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)', [workspace, 'H32 dead letter']);
    const run = <T>(fn: (db: pg.PoolClient) => Promise<T>) => transaction(async db => { await scope(db, workspace); return fn(db); });
    const job = await run(db => enqueueJob(db, workspace, {
      kind: 'local.fail', key: randomUUID(), payload: {}, external: false, maxAttempts: 2,
    }));
    const first = await run(db => claimJob(db));
    assert.equal(first?.id, job.id);
    assert.equal((await run(db => finishJob(db, job.id, first!.lease_token, { state: 'failed', code: 'LOCAL_ERROR' }))).state, 'retry');
    await admin.query('UPDATE jobs SET available_at=now() WHERE id=$1', [job.id]);
    const second = await run(db => claimJob(db));
    assert.equal((await run(db => finishJob(db, job.id, second!.lease_token, { state: 'failed', code: 'LOCAL_ERROR' }))).state, 'dead');
    assert.equal((await run(db => claimJob(db))) , null);
  } finally {
    await admin.query('DELETE FROM jobs WHERE workspace_id=$1', [workspace]);
    await admin.query('DELETE FROM workspaces WHERE id=$1', [workspace]);
  }
});
