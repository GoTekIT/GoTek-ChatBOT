import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/server/db';
import {defaultWorkspaceProviderInvoke} from '../src/server/worker';

const admin = new pg.Pool({host:'/tmp', port:55432, user:'gotek_migrator', database:'gotek_chatbot'});
test.after(async () => { await pool.end(); await admin.end(); });

test('workspace provider boundary refuses an expired grant before provider I/O', async () => {
  const workspace = randomUUID();
  const provider = randomUUID();
  const model = randomUUID();
  const grant = randomUUID();
  const secretRef = `GOTEK_PROVIDER_GRANT_TEST_${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  process.env[secretRef] = 'fixture-secret';
  let calls = 0;
  const transport = async () => { calls++; return 'should not run'; };
  try {
    await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2)', [workspace, 'provider grant expiry']);
    await admin.query("INSERT INTO providers(id,name,adapter,secret_ref,base_url,enabled) VALUES($1,$2,'custom_llm',$3,'https://provider.example.test/v1',true)", [provider, 'grant expiry provider', secretRef]);
    await admin.query("INSERT INTO models(id,provider_id,name,capabilities,enabled) VALUES($1,$2,'grant-expiry-model',ARRAY['chat'],true)", [model, provider]);
    await admin.query("INSERT INTO model_grants(id,workspace_id,model_id,capability,active,expires_at) VALUES($1,$2,$3,'chat',true,clock_timestamp()-interval '1 second')", [grant, workspace, model]);

    const invoke = defaultWorkspaceProviderInvoke(transport as any);
    await assert.rejects(
      invoke({workspace, conversation: randomUUID(), message: 'hello', modelId: model}),
      {code: 'AI_MODEL_REVOKED'},
    );
    assert.equal(calls, 0, 'an expired grant must not reach provider transport');

    await admin.query("UPDATE model_grants SET expires_at=clock_timestamp()+interval '1 minute' WHERE id=$1", [grant]);
    assert.equal(
      await invoke({workspace, conversation: randomUUID(), message: 'hello', modelId: model, context: [{source: 'fixture', title: 'fixture', content: 'answer', citation: {}}]}),
      'should not run',
    );
    assert.equal(calls, 1);
  } finally {
    delete process.env[secretRef];
    await admin.query('DELETE FROM model_grants WHERE id=$1', [grant]);
    await admin.query('DELETE FROM models WHERE id=$1', [model]);
    await admin.query('DELETE FROM providers WHERE id=$1', [provider]);
    await admin.query('DELETE FROM workspaces WHERE id=$1', [workspace]);
  }
});
