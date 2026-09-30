import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {ZodError} from 'zod';
import {createRule, listRules, setRuleState, updateRule} from '../src/modules/rules/rules';
import {HttpError} from '../src/core/security';

const actor = {
  role: 'Owner',
  workspace_id: '11111111-1111-4111-8111-111111111111',
  user_id: '22222222-2222-4222-8222-222222222222',
};
const ruleId = '33333333-3333-4333-8333-333333333333';
const validBody = {title: 'Quy tắc', content: 'Nội dung quy tắc'};
function forbiddenDatabase() {
  let calls = 0;
  const db = {query: async () => { calls++; throw new Error('Unexpected database query'); }} as unknown as PoolClient;
  return {db, assertUnused: () => assert.equal(calls, 0, 'Rejected requests must not query the database')};
}

for (const operation of ['list', 'create', 'update', 'state'] as const) {
  test(`H09 ${operation}: Agent is forbidden before database access`, async () => {
    const {db, assertUnused} = forbiddenDatabase();
    const agent = {...actor, role: 'Agent'};
    const invoke = {
      list: () => listRules(db, agent, {}),
      create: () => createRule(db, agent, validBody),
      update: () => updateRule(db, agent, ruleId, validBody),
      state: () => setRuleState(db, agent, ruleId, {active: false}),
    }[operation];
    await assert.rejects(invoke, error => error instanceof HttpError && error.status === 403 && error.code === 'FORBIDDEN');
    assertUnused();
  });
}

for (const [name, body] of [
  ['empty title', {...validBody, title: ''}],
  ['whitespace title', {...validBody, title: ' \t\n '}],
  ['title over 150 characters', {...validBody, title: 'a'.repeat(151)}],
  ['empty content', {...validBody, content: ''}],
  ['whitespace content', {...validBody, content: ' \t\n '}],
  ['content over 2000 characters', {...validBody, content: 'a'.repeat(2001)}],
] as const) {
  test(`H09 create: rejects ${name} before database access`, async () => {
    const {db, assertUnused} = forbiddenDatabase();
    await assert.rejects(() => createRule(db, actor, body), error => error instanceof ZodError);
    assertUnused();
  });
}
