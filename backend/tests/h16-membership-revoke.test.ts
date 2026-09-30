import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app';
import { pool, scope, transaction } from '../src/core/db';

test('H16 membership revoke is live for an existing session and cannot cross tenants', async (t) => {
  t.after(async () => { await pool.end(); });
  const app = createApp();
  const password = 'Local-H16-membership-2026';
  const a = request.agent(app);
  const b = request.agent(app);
  const emailA = `h16-a-${randomUUID()}@example.test`;
  const emailB = `h16-b-${randomUUID()}@example.test`;
  const signup = async (agent: any, email: string, business: string) => {
    await agent.post('/api/auth/signup').set('X-Gotek-Request', '1').send({
      email, password, fullName: 'H16 tester', business, phone: '0900000000',
    }).expect(202);
    await agent.post('/api/auth/login').set('X-Gotek-Request', '1').send({ email, password }).expect(200);
    return (await agent.get('/api/me').expect(200)).body;
  };
  const meA = await signup(a, emailA, `H16 workspace A ${randomUUID()}`);
  const meB = await signup(b, emailB, `H16 workspace B ${randomUUID()}`);
  try {
    // The cookie/session is intentionally retained while membership is revoked.
    await transaction(async db => {
      await scope(db, meA.workspaceId);
      await db.query('UPDATE memberships SET active=false WHERE workspace_id=$1 AND user_id=$2', [meA.workspaceId, meA.user.id]);
    });
    await a.get('/api/me').expect(401);
    await a.get('/api/members').expect(401);

    // A session from another tenant cannot switch into the revoked workspace.
    await b.post('/api/workspace/switch').set('X-Gotek-Request', '1')
      .send({ workspaceId: meA.workspaceId }).expect(403);
    assert.equal((await b.get('/api/me').expect(200)).body.workspaceId, meB.workspaceId);
  } finally {
    await transaction(async db => {
      await scope(db, meA.workspaceId);
      await db.query('DELETE FROM sessions WHERE user_id IN ($1,$2)', [meA.user.id, meB.user.id]);
    });
  }
});
