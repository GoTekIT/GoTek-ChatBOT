import test from 'node:test';
import assert from 'node:assert/strict';
import {loadMessagePages} from '../src/utils/message-pages';
test('loads history past 100 messages using durable sequence', async () => {
  const rows = Array.from({length: 235}, (_, i) => ({id: String(i + 1), sequence: i + 1}));
  const cursors: number[] = [];
  const result = await loadMessagePages(async after => {cursors.push(after); return rows.slice(after, after + 100);}, () => true);
  assert.deepEqual(result, rows);
  assert.deepEqual(cursors, [0, 100, 200]);
});
test('workspace switch discards in-flight history and stops paging', async () => {
  let current = true;
  const result = await loadMessagePages(async () => {current = false; return [{id: 'old-tenant', sequence: 1}];}, () => current);
  assert.equal(result, undefined);
});
test('non-advancing cursor fails instead of looping forever', async () => {
  await assert.rejects(loadMessagePages(async () => Array.from({length:100}, () => ({id:'same', sequence:0})), () => true), /cursor/);
});
