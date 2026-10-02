import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {resolveConnectionRoute} from '../src/modules/meta/connection-route';

test('route preserves connection identity and switches scope for each account', async () => {
  const calls: unknown[][] = [];
  const db = {query: async (sql: string, values: string[]) => {
    calls.push([sql, values]);
    return {rows: sql.startsWith('SELECT *') ? [{connection_id: 'connection-'+values[1],
      workspace_id: 'workspace-'+values[1], channel_id: 'channel-'+values[1]}] : []};
  }} as unknown as PoolClient;
  for (const page of ['a','b']) {
    assert.deepEqual(await resolveConnectionRoute(db,'facebook_messenger',page), {
      id: 'connection-'+page, workspace_id: 'workspace-'+page, channel_id: 'channel-'+page,
    });
  }
  assert.deepEqual(calls[1][1], ['workspace-a']);
  assert.deepEqual(calls[3][1], ['workspace-b']);
});

test('unmapped account does not acquire tenant scope', async () => {
  let queries = 0;
  const db = {query: async () => { queries++; return {rows: []}; }} as unknown as PoolClient;
  assert.equal(await resolveConnectionRoute(db,'instagram','unknown'), undefined);
  assert.equal(queries, 1);
});
