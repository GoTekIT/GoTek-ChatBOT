import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {RealtimeHub, type AuthorizeDelivery} from '../src/modules/chat/realtime';

const flush = () => new Promise(resolve => setImmediate(resolve));

test('SSE gates conversation and workspace payloads, isolates tenants and closes revoked sessions', async () => {
  const hub = new RealtimeHub();
  let active = true;
  function subscriber(id: string, workspace: string, allowed: string[], conversation?: string) {
    const chunks: string[] = [];
    let ended = false;
    const req = new EventEmitter();
    const res = {writeHead() {}, flushHeaders() {}, write(text: string) {chunks.push(text); return true;}, end() {ended = true;}};
    const authorize: AuthorizeDelivery = async (deliver, target) => {
      if (!active) throw new Error('session revoked');
      if (!target || allowed.includes(target)) deliver();
    };
    hub.register(id, workspace, res as any, req as any, authorize, conversation);
    return {chunks, ended: () => ended};
  }
  const a = subscriber('a', 'tenant', ['channel-a-conversation']);
  const b = subscriber('b', 'tenant', ['channel-b-conversation']);
  const other = subscriber('other', 'other-tenant', []);
  const specific = subscriber('specific', 'tenant', ['channel-a-conversation', 'channel-b-conversation'], 'channel-a-conversation');
  try {
    hub.broadcastToWorkspace('tenant', 'inbox:message_sent', {conversationId: 'channel-b-conversation', messageSnippet: 'PRIVATE_MARKER'});
    hub.broadcastToConversation('channel-b-conversation', 'message:new', {body: 'CONVERSATION_MARKER'});
    await flush();
    assert.ok(!a.chunks.join('').includes('PRIVATE_MARKER'));
    assert.ok(b.chunks.join('').includes('PRIVATE_MARKER'));
    assert.ok(!other.chunks.join('').includes('PRIVATE_MARKER'));
    assert.ok(!specific.chunks.join('').includes('PRIVATE_MARKER'));
    hub.broadcastToWorkspace('tenant', 'inbox:message_sent', {messageSnippet: 'UNSCOPED_MARKER'});
    await flush();
    assert.ok(!b.chunks.join('').includes('UNSCOPED_MARKER'));
    active = false;
    hub.broadcastToWorkspace('tenant', 'inbox:message_sent', {conversationId: 'channel-b-conversation', messageSnippet: 'AFTER_REVOKE'});
    await flush();
    assert.ok(!b.chunks.join('').includes('AFTER_REVOKE'));
    assert.equal(b.ended(), true);
  } finally {
    for (const id of ['a', 'b', 'other', 'specific']) hub.removeClient(id);
  }
});
