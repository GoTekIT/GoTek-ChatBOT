import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { pool, scope, transaction } from '../src/core/db';
import { enqueueJob, claimJob, recoverStaleJobs } from '../src/modules/jobs/jobs';

const admin = new pg.Pool({ host: '/tmp', port: 55432, user: 'gotek_migrator', database: 'gotek_chatbot' });

test('recovery reclaims a running row with a missing lease inside its tenant scope', async () => {
  const workspace = randomUUID();
  const otherWorkspace = randomUUID();
  try {
    await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2),($3,$4)', [workspace, 'Null lease recovery', otherWorkspace, 'Other tenant']);
    const run = <T>(fn: (db: pg.PoolClient) => Promise<T>, tenant = workspace) => transaction(async db => {
      await scope(db, tenant);
      return fn(db);
    });
    const local = await run(db => enqueueJob(db, workspace, {
      kind: 'local.recovery', key: randomUUID(), payload: { fixture: 'lease-null' }, external: false, maxAttempts: 3,
    }));
    const foreign = await run(db => enqueueJob(db, otherWorkspace, {
      kind: 'local.recovery', key: randomUUID(), payload: { fixture: 'foreign' }, external: false, maxAttempts: 3,
    }), otherWorkspace);
    assert.equal((await run(db => claimJob(db)))?.id, local.id);
    assert.equal((await run(db => claimJob(db), otherWorkspace))?.id, foreign.id);

    // A malformed/legacy running row can have no lease. It must not remain stuck forever.
    await admin.query('UPDATE jobs SET lease_token=NULL, lease_until=NULL WHERE id IN ($1,$2)', [local.id, foreign.id]);
    assert.deepEqual(await run(recoverStaleJobs), [{ id: local.id, state: 'retry' }]);
    assert.deepEqual((await admin.query('SELECT state,attempts,lease_token,lease_until FROM jobs WHERE id=$1', [local.id])).rows[0], {
      state: 'retry', attempts: 1, lease_token: null, lease_until: null,
    });
    assert.deepEqual((await admin.query('SELECT state,attempts FROM jobs WHERE id=$1', [foreign.id])).rows[0], {
      state: 'running', attempts: 1,
    });
  } finally {
    await admin.query('DELETE FROM jobs WHERE workspace_id IN ($1,$2)', [workspace, otherWorkspace]);
    await admin.query('DELETE FROM workspaces WHERE id IN ($1,$2)', [workspace, otherWorkspace]);
  }
});

after(async () => { await admin.end(); await pool.end(); });
