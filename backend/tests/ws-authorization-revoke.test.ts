import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import WebSocket from 'ws';
import { createApp } from '../src/app';
import { pool, scope, transaction } from '../src/core/db';
import { initWebSocketServer } from '../src/modules/chat/websocket';
import { realtimeHub } from '../src/modules/chat/realtime';

test('WebSocket stream termination on membership revoke and channel isolation for agents', async (t) => {
  t.after(async () => {
    await pool.end();
  });

  const app = createApp();
  const server = http.createServer(app);
  initWebSocketServer(server);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as any;
  const port = address.port;
  t.after(() => {
    server.close();
  });

  const password = 'StrongPassword!2026';
  const ownerEmail = `owner-${randomUUID()}@gotek.test`;
  const agentEmail = `agent-${randomUUID()}@gotek.test`;

  const ownerAgent = request.agent(app);
  const agentClient = request.agent(app);

  // 1. Signup Owner
  await ownerAgent.post('/api/auth/signup').set('X-Gotek-Request', '1').send({
    email: ownerEmail,
    password,
    fullName: 'Owner Test',
    business: 'GoTek Test Corp',
    phone: '0901234567',
  }).expect(202);

  await ownerAgent.post('/api/auth/login').set('X-Gotek-Request', '1').send({
    email: ownerEmail,
    password,
  }).expect(200);

  const ownerMe = (await ownerAgent.get('/api/me').expect(200)).body;
  const workspaceId = ownerMe.workspaceId;

  // 2. Signup Agent
  await agentClient.post('/api/auth/signup').set('X-Gotek-Request', '1').send({
    email: agentEmail,
    password,
    fullName: 'Agent Test',
    business: 'Agent Workspace Placeholder',
    phone: '0901234568',
  }).expect(202);

  await agentClient.post('/api/auth/login').set('X-Gotek-Request', '1').send({
    email: agentEmail,
    password,
  }).expect(200);

  const agentMe = (await agentClient.get('/api/me').expect(200)).body;
  const agentUserId = agentMe.user.id;

  // 3. Add Agent as Member in Owner's Workspace
  await transaction(async db => {
    await scope(db, workspaceId);
    await db.query(
      `INSERT INTO memberships (workspace_id, user_id, role, active)
       VALUES ($1, $2, 'Agent', true)`,
      [workspaceId, agentUserId]
    );
  });

  // Switch agent into Owner's workspace
  await agentClient.post('/api/workspace/switch').set('X-Gotek-Request', '1').send({
    workspaceId,
  }).expect(200);

  // We insert a known session token for testing WebSocket connection
  const testToken = `test-ws-token-${randomUUID()}`;
  const crypto = await import('node:crypto');
  const digest = crypto.createHash('sha256').update(testToken).digest('hex');
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, workspace_id, expires_at, created_at)
     VALUES ($1, $2, $3, now() + interval '1 day', now())`,
    [digest, agentUserId, workspaceId]
  );

  // 4. Create two channels in workspace: Channel A (assigned to agent) and Channel B (not assigned)
  let channelAId = '';
  let channelBId = '';
  let convAId = '';
  let convBId = '';

  await transaction(async db => {
    await scope(db, workspaceId);
    channelAId = randomUUID();
    channelBId = randomUUID();

    await db.query(
      `INSERT INTO channels (id, workspace_id, name, origin, greeting, color, public_key, request_id, request_payload)
       VALUES ($1, $2, 'Channel A', 'http://localhost', 'Hi', '#0057E1', $3, $4, '{}')`,
      [channelAId, workspaceId, `pub-${randomUUID()}`, randomUUID()]
    );
    await db.query(
      `INSERT INTO channels (id, workspace_id, name, origin, greeting, color, public_key, request_id, request_payload)
       VALUES ($1, $2, 'Channel B', 'http://localhost', 'Hi', '#0057E1', $3, $4, '{}')`,
      [channelBId, workspaceId, `pub-${randomUUID()}`, randomUUID()]
    );

    // Assign agent only to Channel A
    await db.query(
      `INSERT INTO channel_members (workspace_id, channel_id, user_id)
       VALUES ($1, $2, $3)`,
      [workspaceId, channelAId, agentUserId]
    );

    // Create visitors and conversations for both channels
    const visA = randomUUID();
    const visB = randomUUID();
    convAId = randomUUID();
    convBId = randomUUID();

    await db.query(
      `INSERT INTO visitors (id, workspace_id, channel_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '1 day')`,
      [visA, workspaceId, channelAId, `tok-${randomUUID()}`]
    );
    await db.query(
      `INSERT INTO visitors (id, workspace_id, channel_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '1 day')`,
      [visB, workspaceId, channelBId, `tok-${randomUUID()}`]
    );

    await db.query(
      `INSERT INTO conversations (id, workspace_id, channel_id, visitor_id, reply_owner, owner_version)
       VALUES ($1, $2, $3, $4, 'HUMAN_ACTIVE', 1)`,
      [convAId, workspaceId, channelAId, visA]
    );
    await db.query(
      `INSERT INTO conversations (id, workspace_id, channel_id, visitor_id, reply_owner, owner_version)
       VALUES ($1, $2, $3, $4, 'HUMAN_ACTIVE', 1)`,
      [convBId, workspaceId, channelBId, visB]
    );
  });

  // 5. Connect Agent via WebSocket
  const wsUrl = `ws://127.0.0.1:${port}/ws?role=staff&token=${testToken}`;
  const ws = new WebSocket(wsUrl);

  const receivedMessages: any[] = [];
  let closedWithCode: number | null = null;
  let closeReason: string | null = null;

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve());
    ws.on('error', reject);
    ws.on('message', (data) => {
      try {
        receivedMessages.push(JSON.parse(data.toString()));
      } catch (e) {}
    });
    ws.on('close', (code, reason) => {
      closedWithCode = code;
      closeReason = reason.toString();
    });
  });

  // Wait for system:ready
  await new Promise(r => setTimeout(r, 100));
  const readyMsg = receivedMessages.find(m => m.type === 'system:ready');
  assert.ok(readyMsg, 'system:ready must be received');
  assert.equal(readyMsg?.role, 'staff');
  assert.equal(readyMsg?.userId, agentUserId);

  // 6. Test Channel Isolation: Agent outside Channel B must not receive broadcast with { channelId: channelBId }
  realtimeHub.broadcastToWorkspace(workspaceId, 'inbox:visitor_message', {
    conversationId: convBId,
    messageSnippet: 'Secret message in Channel B',
  }, { channelId: channelBId! });

  // Broadcast in Channel A (Agent IS a member)
  realtimeHub.broadcastToWorkspace(workspaceId, 'inbox:visitor_message', {
    conversationId: convAId,
    messageSnippet: 'Allowed message in Channel A',
  }, { channelId: channelAId! });

  await new Promise(r => setTimeout(r, 150));

  const snippets = receivedMessages
    .filter(m => m.type === 'inbox:visitor_message')
    .map(m => m.data?.messageSnippet);

  assert.ok(!snippets.includes('Secret message in Channel B'), 'Agent outside Channel B must NOT receive Channel B broadcast');
  assert.ok(snippets.includes('Allowed message in Channel A'), 'Agent inside Channel A MUST receive Channel A broadcast');

  // 7. Test Frame Protection: Agent subscribing to convB (outside their channel) must receive FORBIDDEN error
  ws.send(JSON.stringify({
    type: 'subscribe',
    conversationId: convBId,
  }));

  await new Promise(r => setTimeout(r, 150));
  const forbiddenError = receivedMessages.find(m => m.type === 'error' && m.code === 'FORBIDDEN');
  assert.ok(forbiddenError, 'Agent must receive FORBIDDEN when subscribing to unauthorized channel conversation');

  // 8. Test Revocation Stream Disconnect:
  // Owner deactivates Agent via member service / PATCH /api/members/:agentUserId
  await ownerAgent.patch(`/api/members/${agentUserId}`).set('X-Gotek-Request', '1').send({
    role: 'Agent',
    active: false,
  }).expect(200);

  // Wait for revocation event and connection close
  await new Promise(r => setTimeout(r, 200));

  const revokedEvent = receivedMessages.find(m => m.type === 'system:revoked');
  assert.ok(revokedEvent, 'Client must receive system:revoked event');
  assert.equal(revokedEvent.reason, 'MEMBERSHIP_DEACTIVATED');
  assert.equal(closedWithCode, 4003, 'Socket must be closed with code 4003');

  // 9. Verify next HTTP request by revoked agent fails with 401
  await agentClient.get('/api/me').expect(401);
});
