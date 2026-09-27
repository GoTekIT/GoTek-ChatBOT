import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';

type RestoreReport = {
  status: string;
  source: string;
  target: string;
  backupSha256: string;
  contentHashes: Record<string, string>;
  policies: Array<{tablename: string; policyname: string}>;
  quarantine: Record<string, boolean>;
};

test('restore drill report has complete integrity metadata and disposable target is gone', async () => {
  const report = JSON.parse(readFileSync('delivery/evidence/p1-restore-drill.json', 'utf8')) as RestoreReport;

  assert.equal(report.status, 'PASS');
  assert.equal(report.source, 'gotek_chatbot');
  assert.match(report.target, /^gotek_restore_[0-9a-f]{32}$/);
  assert.match(report.backupSha256, /^[0-9a-f]{64}$/);

  const hashEntries = Object.entries(report.contentHashes);
  assert.equal(hashEntries.length, 55, 'restore report must hash every restored table');
  for (const [table, hash] of hashEntries) {
    assert.match(table, /^[a-z][a-z0-9_]*$/);
    assert.match(hash, /^[0-9a-f]{64}$/, `invalid content hash for ${table}`);
  }

  assert.ok(report.policies.length >= 50, 'restore report must retain policy metadata');
  for (const policy of report.policies) {
    assert.ok(Object.hasOwn(report.contentHashes, policy.tablename), `policy table not in table hash set: ${policy.tablename}`);
    assert.match(policy.policyname, /^[a-z][a-z0-9_]*$/);
  }

  assert.deepEqual(report.quarantine, {
    serverStarted: false,
    workerStarted: false,
    sessionsCleared: true,
    challengesCleared: true,
    deliveryCleared: true,
    invitationsRevoked: true,
    jobsQuarantined: true,
    providersDisabled: true,
    modelGrantsRevoked: true,
    supportGrantsRevoked: true,
    visitorSessionsExpired: true,
  });

  const root = new pg.Client({host: '/tmp', port: 55432, user: 'gotek_migrator', database: 'postgres'});
  await root.connect();
  try {
    const result = await root.query('SELECT 1 FROM pg_database WHERE datname=$1', [report.target]);
    assert.equal(result.rowCount, 0, 'disposable restore database must be dropped after the drill');
  } finally {
    await root.end();
  }
});
