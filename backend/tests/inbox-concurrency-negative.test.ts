import test from 'node:test';
import assert from 'node:assert/strict';
import { realtimeHub } from '../src/modules/chat/realtime';
import { inboxAssign, inboxAssignees } from '../src/modules/chat/inbox';
import { appendMessage, takeover } from '../src/modules/chat/chat-store';

const id = '11111111-1111-4111-8111-111111111111';
const convId = '22222222-2222-4222-8222-222222222222';
const clientId = '33333333-3333-4333-8333-333333333333';

test('UC-031 Zero Leakage: RealtimeHub strictly prevents internal notes from leaking to visitor stream', () => {
  const visitorReceived: any[] = [];
  const staffReceived: any[] = [];

  const mockVisitorRes: any = {
    writeHead: () => {},
    flushHeaders: () => {},
    write: (chunk: string) => visitorReceived.push(chunk),
    end: () => {},
  };
  const mockStaffRes: any = {
    writeHead: () => {},
    flushHeaders: () => {},
    write: (chunk: string) => staffReceived.push(chunk),
    end: () => {},
  };
  const mockReq: any = {
    get: () => 'http://localhost',
    on: () => {},
  };

  // Register 1 visitor and 1 staff client
  realtimeHub.register('visitor-client-1', id, mockVisitorRes, mockReq, convId, true);
  realtimeHub.register('staff-client-1', id, mockStaffRes, mockReq, convId, false);

  // Clear connection comments
  visitorReceived.length = 0;
  staffReceived.length = 0;

  // 1. Broadcast an internal staff note
  realtimeHub.broadcastToConversation(convId, 'message:new', {
    id: 'msg-note-1',
    visibility: 'internal',
    author_type: 'agent',
    body: 'Ghi chú mật của nhân viên (Khách không được xem)',
  });

  // Verify visitor received NOTHING (Zero Leakage)
  assert.equal(visitorReceived.length, 0, 'Visitor must not receive any internal note frame');
  assert.equal(staffReceived.length, 1, 'Staff must receive the internal note');

  // 2. Broadcast a public reply
  realtimeHub.broadcastToConversation(convId, 'message:new', {
    id: 'msg-public-1',
    visibility: 'public',
    author_type: 'agent',
    body: 'Kính chào Quý khách hàng GoTek',
  });

  // Verify both received public message
  assert.equal(visitorReceived.length, 1, 'Visitor must receive public reply');
  assert.equal(staffReceived.length, 2, 'Staff must receive public reply');

  // Cleanup
  realtimeHub.removeClient('visitor-client-1');
  realtimeHub.removeClient('staff-client-1');
});

test('UC-027 Reassign validation: rejects non-members and validates target agent', async () => {
  const mockDb: any = {
    query: async (sql: string, params: any[]) => {
      if (sql.startsWith('SELECT * FROM conversations')) {
        return { rows: [{ id: convId, channel_id: id, workspace_id: id, reply_owner: 'AI_ACTIVE', owner_version: 1 }] };
      }
      if (sql.includes('FROM channels WHERE')) {
        return { rows: [{ id }], rowCount: 1 };
      }
      if (sql.includes('FROM channel_members WHERE')) {
        return { rows: [{ user_id: 'actor' }], rowCount: 1 };
      }
      if (sql.includes('FROM memberships m WHERE')) {
        // Valid if target is valid-agent-id
        if (params[1] === id) {
          return { rows: [{ user_id: id, email: 'agent@gotek.vn' }] };
        }
        return { rows: [] };
      }
      if (sql.startsWith('UPDATE conversations SET assigned_to')) {
        return {
          rows: [{
            id: convId,
            assigned_to: params[0],
            reply_owner: 'HUMAN_ACTIVE',
            owner_version: 2,
            updated_at: new Date().toISOString(),
          }]
        };
      }
      if (sql.includes('INSERT INTO audit')) {
        return { rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
  };

  const actor = { workspace_id: id, user_id: 'actor', role: 'Owner' };

  // Negative test: invalid non-member
  await assert.rejects(
    () => inboxAssign(mockDb, actor, convId, { assignedTo: '00000000-0000-4000-8000-000000000000' }),
    { code: 'INVALID_ASSIGNEE' }
  );

  // Positive test: valid agent assignment
  const reassigned = await inboxAssign(mockDb, actor, convId, { assignedTo: id });
  assert.equal(reassigned.assigned_to, id);
  assert.equal(reassigned.reply_owner, 'HUMAN_ACTIVE');
  assert.equal(reassigned.owner_version, 2);
});

test('UC-027 Assignees listing: returns channel agents with open count', async () => {
  const mockDb: any = {
    query: async (sql: string) => {
      if (sql.startsWith('SELECT * FROM conversations')) {
        return { rows: [{ id: convId, channel_id: id, workspace_id: id }] };
      }
      if (sql.includes('FROM channels WHERE')) {
        return { rows: [{ id }], rowCount: 1 };
      }
      if (sql.includes('FROM channel_members WHERE')) {
        return { rows: [{ user_id: 'actor' }], rowCount: 1 };
      }
      if (sql.includes('FROM memberships m')) {
        return {
          rows: [
            { user_id: id, email: 'alex@gotek.vn', role: 'Agent', open_count: 2 },
            { user_id: '44444444-4444-4444-8444-444444444444', email: 'nguyen@gotek.vn', role: 'Agent', open_count: 0 }
          ]
        };
      }
      return { rows: [], rowCount: 0 };
    }
  };

  const actor = { workspace_id: id, user_id: 'actor', role: 'Owner' };
  const assignees = await inboxAssignees(mockDb, actor, convId);
  assert.equal(assignees.length, 2);
  assert.equal(assignees[0].displayName, 'alex');
  assert.equal(assignees[0].openCount, 2);
  assert.equal(assignees[1].displayName, 'nguyen');
  assert.equal(assignees[1].openCount, 0);
});

test('UC-029 Takeover concurrency: stale owner_version throws 409 STALE_REPLY_OWNER', async () => {
  let currentDbVersion = 1;
  const mockDb: any = {
    query: async (sql: string, params: any[]) => {
      if (sql.startsWith("UPDATE conversations SET reply_owner='HUMAN_ACTIVE'")) {
        // Only succeeds if passed version matches current DB version
        if (params[3] === currentDbVersion) {
          currentDbVersion++;
          return { rows: [{ id: convId, owner_version: currentDbVersion, assigned_to: params[0], status: 'open', reply_owner: 'HUMAN_ACTIVE' }] };
        }
        return { rows: [] }; // Stale version returns 0 rows -> HttpError 409
      }
      return { rows: [] };
    }
  };

  // Agent 1 takes over with version 1 -> succeeds, increments DB version to 2
  const t1 = await takeover(mockDb, id, convId, 'agent-1', 1);
  assert.equal(t1.owner_version, 2);

  // Agent 2 attempts to take over with stale version 1 -> throws STALE_REPLY_OWNER (409)
  await assert.rejects(
    () => takeover(mockDb, id, convId, 'agent-2', 1),
    (err: any) => err.status === 409 || err.message === 'STALE_REPLY_OWNER'
  );
});

test('UC-032 Idempotency: exact same clientId returns existing message without duplicate row', async () => {
  const existingMessage = {
    id: 'msg-1',
    conversation_id: convId,
    client_id: clientId,
    sequence: 5,
    author_type: 'agent',
    actor_id: 'actor',
    visibility: 'public',
    body: 'Nội dung tin nhắn',
  };

  const mockDb: any = {
    query: async (sql: string, params: any[]) => {
      if (sql.startsWith('SELECT * FROM conversations')) {
        return { rows: [{ id: convId, workspace_id: id, next_sequence: 6, reply_owner: 'HUMAN_ACTIVE', assigned_to: 'actor' }] };
      }
      if (sql.startsWith('SELECT * FROM messages WHERE conversation_id=$1 AND client_id=$2')) {
        if (params[1] === clientId) {
          return { rows: [existingMessage] };
        }
        return { rows: [] };
      }
      return { rows: [] };
    }
  };

  // Re-sending with same clientId returns the identical message object (No duplication)
  const result = await appendMessage(mockDb, {
    workspace: id,
    conversation: convId,
    clientId,
    author: 'agent',
    actor: 'actor',
    visibility: 'public',
    body: 'Nội dung tin nhắn',
  });

  assert.equal(result.id, 'msg-1');
  assert.equal(result.client_id, clientId);
  assert.equal(result.sequence, 5);

  // Negative test: Idempotency conflict if body differs
  await assert.rejects(
    () => appendMessage(mockDb, {
      workspace: id,
      conversation: convId,
      clientId,
      author: 'agent',
      actor: 'actor',
      visibility: 'public',
      body: 'Nội dung khác hoàn toàn',
    }),
    { code: 'IDEMPOTENCY_CONFLICT' }
  );
});
