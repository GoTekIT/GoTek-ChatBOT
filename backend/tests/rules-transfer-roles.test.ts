import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {createApp} from '../src/app';
import {pool, scope, transaction} from '../src/core/db';

test('H09 transfer uses current Owner/Admin/Agent role and denied imports leave no writes', async (t) => {
  t.after(async () => { await pool.end(); });
  const agent = request.agent(createApp());
  const email = `transfer-roles-${randomUUID()}@example.test`;
  const password = 'Local-transfer-roles-2026';
  await agent.post('/api/auth/signup').set('X-Gotek-Request', '1').send({
    email, password, fullName: 'Transfer role tester', business: 'Transfer role fixture', phone: '0900000000',
  }).expect(202);
  await agent.post('/api/auth/login').set('X-Gotek-Request', '1').send({email, password}).expect(200);
  const me = (await agent.get('/api/me').expect(200)).body;
  async function role(value: 'Owner' | 'Admin' | 'Agent') {
    await transaction(async db => {
      await scope(db, me.workspaceId);
      await db.query('UPDATE memberships SET role=$1 WHERE workspace_id=$2 AND user_id=$3',
        [value, me.workspaceId, me.user.id]);
    });
  }
  async function persisted() {
    return transaction(async db => {
      await scope(db, me.workspaceId);
      return {
        rules: (await db.query('SELECT * FROM ai_rules WHERE workspace_id=$1 ORDER BY id', [me.workspaceId])).rows,
        audit: (await db.query("SELECT * FROM audit_events WHERE workspace_id=$1 AND action='ai_rule.imported' ORDER BY id", [me.workspaceId])).rows,
      };
    });
  }
  try {
    for (const allowedRole of ['Owner', 'Admin'] as const) {
      await role(allowedRole);
      const title = `${allowedRole} import`;
      const result = await agent.post('/api/ai/rules/import').set('X-Gotek-Request', '1')
        .send({rules: [{title, content: 'Allowed role content'}]}).expect(200);
      assert.equal(result.body.imported, 1);
      const exported = await agent.get('/api/ai/rules/export').expect(200);
      assert.ok(exported.body.rules.some((rule: any) => rule.title === title));
    }
    const before = await persisted();
    assert.equal(before.rules.length, 2);
    assert.equal(before.audit.length, 2);
    await role('Agent');
    const deniedExport = await agent.get('/api/ai/rules/export').expect(403);
    assert.equal(deniedExport.body.error, 'FORBIDDEN');
    assert.equal(deniedExport.body.rules, undefined);
    const deniedImport = await agent.post('/api/ai/rules/import').set('X-Gotek-Request', '1')
      .send({rules: [{title: 'Must not persist', content: 'Denied content'}]}).expect(403);
    assert.equal(deniedImport.body.error, 'FORBIDDEN');
    assert.deepEqual(await persisted(), before);
    // The same authenticated session must regain access after its role changes.
    await role('Owner');
    assert.equal((await agent.get('/api/ai/rules/export').expect(200)).body.rules.length, 2);
  } finally {
    await role('Owner');
  }
});
