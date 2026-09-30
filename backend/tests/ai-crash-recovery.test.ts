import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { pool, scope, transaction } from '../src/core/db';
import { appendMessage } from '../src/modules/chat/chat-store';
import { enqueueJob } from '../src/modules/jobs/jobs';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { digest, opaque } from '../src/core/security';

const admin = new pg.Pool({ host: '127.0.0.1', port: 55432, user: 'gotek_migrator', database: 'gotek_chatbot' });

const fixture = fileURLToPath(new URL('./fixtures/ai-crash-worker.ts', import.meta.url));
function child(workspace: string, mode: string) {
  return fork(fixture, [workspace, mode], { execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
}
function message(proc: ChildProcess): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Worker IPC timeout')); }, 15000);
    const onMessage = (value: unknown) => { cleanup(); resolve(value); };
    const onExit = (code: number | null) => { cleanup(); reject(new Error(`Worker exited before IPC: ${code}`)); };
    const cleanup = () => { clearTimeout(timeout); proc.off('message', onMessage); proc.off('exit', onExit); };
    proc.once('message', onMessage); proc.once('exit', onExit);
  });
}

test('SIGKILL during provider invocation survives worker restart without duplicate dispatch', { timeout: 25000 }, async () => {
  const workspace = randomUUID(), channel = randomUUID(), visitor = randomUUID();
  const conversation = randomUUID(), provider = randomUUID(), model = randomUUID(), budget = randomUUID();
  const websiteKey = opaque(), visitorToken = opaque();
  let first: ChildProcess | undefined, restarted: ChildProcess | undefined;
  try {
    await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)', [workspace, 'dispatch distinct jobs']);
    await admin.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'dispatch fixture','https://example.test','Hi','#0057E1',$3,$4,'{}')", [channel, workspace, websiteKey, randomUUID()]);
    await admin.query('INSERT INTO visitors(id,workspace_id,channel_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval \'1 day\')', [visitor, workspace, channel, digest(visitorToken)]);
    await admin.query("INSERT INTO conversations(id,workspace_id,channel_id,visitor_id,reply_owner) VALUES($1,$2,$3,$4,'AI_ACTIVE')", [conversation, workspace, channel, visitor]);
    await admin.query("INSERT INTO providers(id,name,adapter,secret_ref,enabled) VALUES($1,$2,'local','LOCAL_AI_DISTINCT_KEY',true)", [provider, `dispatch provider ${provider}`]);
    await admin.query("INSERT INTO models(id,provider_id,name,capabilities,enabled) VALUES($1,$2,'local-test',ARRAY['chat'],true)", [model, provider]);
    await admin.query("INSERT INTO model_grants(id,workspace_id,model_id,capability,active) VALUES($1,$2,$3,'chat',true)", [randomUUID(), workspace, model]);
    await admin.query("INSERT INTO quota_budgets(id,workspace_id,meter,period_start,period_end,limit_units) VALUES($1,$2,'ai_response',now()-interval '1 minute',now()+interval '1 day',10)", [budget, workspace]);
    const source = await transaction(async db => {
      await scope(db, workspace);
      return appendMessage(db, { workspace, conversation, clientId: randomUUID(), author: 'visitor', visibility: 'public', body: 'same visitor turn' });
    });
    await transaction(async db => {
      await scope(db, workspace);
      await enqueueJob(db, workspace, { kind: 'ai.reply', key: `distinct-a:${workspace}`, external: false, payload: { conversationId: conversation, messageId: source.id, ownerVersion: 1 } });
    });
    first = child(workspace, 'crash');
    assert.deepEqual(await message(first), { event: 'provider_started' });
    assert.equal((await admin.query('SELECT state FROM ai_reply_dispatches WHERE workspace_id=$1', [workspace])).rows[0].state, 'unknown');
    const died = once(first, 'exit');
    first.kill('SIGKILL');
    const [, signal] = await died;
    assert.equal(signal, 'SIGKILL');
    // Advance the abandoned lease instead of waiting 30 seconds. Recovery itself runs in the new process.
    await admin.query("UPDATE jobs SET lease_until=now()-interval '1 second' WHERE workspace_id=$1 AND state='running'", [workspace]);
    restarted = child(workspace, 'restart');
    const restartedExit = once(restarted, 'exit');
    assert.deepEqual(await message(restarted), { event: 'result', first: 'idle', second: 'unknown', providerCalls: 0 });
    assert.equal((await restartedExit)[0], 0);
    const job = (await admin.query('SELECT state,attempts FROM jobs WHERE workspace_id=$1', [workspace])).rows[0];
    assert.deepEqual(job, { state: 'unknown', attempts: 2 });
    assert.equal((await admin.query('SELECT state FROM ai_reply_dispatches WHERE workspace_id=$1', [workspace])).rows[0].state, 'unknown');
    assert.equal((await admin.query("SELECT count(*) FROM messages WHERE workspace_id=$1 AND author_type='ai'", [workspace])).rows[0].count, '0');
  } finally {
    for (const proc of [first, restarted]) if (proc && proc.exitCode === null && proc.signalCode === null) { const exit = once(proc, 'exit'); proc.kill('SIGKILL'); await exit; }
    await admin.query('DELETE FROM usage_operations WHERE workspace_id=$1', [workspace]);
    await admin.query('DELETE FROM quota_budgets WHERE workspace_id=$1', [workspace]);
    await admin.query('DELETE FROM ai_reply_dispatches WHERE workspace_id=$1', [workspace]);
    await admin.query('DELETE FROM jobs WHERE workspace_id=$1', [workspace]);
    await admin.query('DELETE FROM messages WHERE workspace_id=$1', [workspace]);
    await admin.query('DELETE FROM conversations WHERE workspace_id=$1', [workspace]);
    await admin.query('DELETE FROM visitors WHERE workspace_id=$1', [workspace]);
    await admin.query('DELETE FROM channels WHERE workspace_id=$1', [workspace]);
    await admin.query('DELETE FROM model_grants WHERE workspace_id=$1', [workspace]);
    await admin.query('DELETE FROM models WHERE id=$1', [model]);
    await admin.query('DELETE FROM providers WHERE id=$1', [provider]);
    await admin.query('DELETE FROM workspaces WHERE id=$1', [workspace]);
  }
});

test.after(async () => { await admin.end(); await pool.end(); });
