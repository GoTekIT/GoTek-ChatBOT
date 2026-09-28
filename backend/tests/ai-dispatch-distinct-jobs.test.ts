import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { pool, scope, transaction } from '../src/core/db';
import { appendMessage } from '../src/modules/chat/chat-store';
import { enqueueJob } from '../src/modules/jobs/jobs';
import { runAiWorkerOnce } from '../src/modules/jobs/worker';
import { digest, opaque } from '../src/core/security';

const admin = new pg.Pool({ host: '/tmp', port: 55432, user: 'gotek_migrator', database: 'gotek_chatbot' });

test('distinct scheduler jobs for one visitor turn cannot both invoke provider', async () => {
  const workspace = randomUUID();
  const channel = randomUUID();
  const visitor = randomUUID();
  const conversation = randomUUID();
  const provider = randomUUID();
  const model = randomUUID();
  const budget = randomUUID();
  const websiteKey = opaque();
  const visitorToken = opaque();
  let firstProviderCall!: () => void;
  const providerStarted = new Promise<void>(resolve => { firstProviderCall = resolve; });
  let releaseProvider!: () => void;
  const providerRelease = new Promise<void>(resolve => { releaseProvider = resolve; });
  let calls = 0;
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
      await enqueueJob(db, workspace, { kind: 'ai.reply', key: `distinct-b:${workspace}`, external: false, payload: { conversationId: conversation, messageId: source.id, ownerVersion: 1 } });
    });
    const invoke = async () => {
      calls += 1;
      firstProviderCall();
      await providerRelease;
      return 'one provider answer';
    };
    const first = runAiWorkerOnce(workspace, invoke);
    await providerStarted;
    // The first worker has durably claimed the dispatch row but is still in provider I/O.
    const second = await runAiWorkerOnce(workspace, async () => {
      calls += 1;
      return 'duplicate provider answer';
    });
    assert.equal(second.state, 'unknown');
    assert.equal(calls, 1, 'a distinct scheduler job must not invoke the provider twice');
    releaseProvider();
    const firstResult = await first;
    assert.equal(firstResult.state, 'succeeded');
    const rows = (await admin.query('SELECT state FROM ai_reply_dispatches WHERE workspace_id=$1', [workspace])).rows;
    assert.deepEqual(rows.map(row => row.state), ['confirmed']);
    assert.equal((await admin.query("SELECT count(*) FROM messages WHERE workspace_id=$1 AND author_type='ai'", [workspace])).rows[0].count, '1');
  } finally {
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
