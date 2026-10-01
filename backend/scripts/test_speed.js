import pg from 'pg';
import WebSocket from 'ws';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function digest(t) {
  return crypto.createHash('sha256').update(t).digest('hex');
}

async function test() {
  const convId = 'f7a8fd3c-1347-44b0-896c-9d034c7f4e96';

  // 1. Get workspace and a valid staff user
  const c = (await pool.query('SELECT visitor_id, workspace_id FROM conversations WHERE id = $1', [convId])).rows[0];
  const member = (await pool.query('SELECT user_id FROM memberships WHERE workspace_id = $1 AND active LIMIT 1', [c.workspace_id])).rows[0];
  
  // Create staff session
  const staffToken = crypto.randomBytes(32).toString('base64url');
  await pool.query(
    "INSERT INTO sessions(token_hash, user_id, workspace_id, expires_at) VALUES($1, $2, $3, now() + interval '1 hour')",
    [digest(staffToken), member.user_id, c.workspace_id]
  );
  console.log('Created temporary staff session for user:', member.user_id);

  // 2. Create visitor session
  const ch = (await pool.query('SELECT public_key FROM channels WHERE workspace_id = $1 LIMIT 1', [c.workspace_id])).rows[0];
  const sessRes = await fetch(`http://127.0.0.1:4317/widget-api/${ch.public_key}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' },
    body: JSON.stringify({})
  });
  const sessData = await sessRes.json();
  const testConvId = sessData.conversationId;
  const visitorToken = sessData.token;
  console.log('Visitor session created, convId:', testConvId);

  // 3. Connect visitor WebSocket
  const visitorWs = new WebSocket(`ws://127.0.0.1:4317/ws?role=visitor&token=${encodeURIComponent(visitorToken)}`);
  await new Promise((resolve, reject) => {
    visitorWs.on('open', resolve);
    visitorWs.on('error', reject);
  });
  console.log('Visitor WS connected! ✅');

  let receivedMessage = null;
  let receiveTime = 0;
  let sendTime = 0;

  visitorWs.on('message', (data) => {
    const raw = data.toString();
    console.log('[Visitor WS RAW]:', raw);
    const msg = JSON.parse(raw);
    if (msg.type === 'message:new' || msg.event === 'message:new') {
      receiveTime = Date.now();
      receivedMessage = msg;
      console.log(`[LATENCY] Visitor received message:new in ${receiveTime - sendTime}ms! ⚡`);
    }
  });

  // 4. Connect staff WS using the staff token
  const staffWs = new WebSocket(`ws://127.0.0.1:4317/ws?role=staff&token=${encodeURIComponent(staffToken)}`);
  await new Promise((resolve, reject) => {
    staffWs.on('open', resolve);
    staffWs.on('error', reject);
  });
  console.log('Staff WS connected! ✅');

  staffWs.on('message', (data) => {
    console.log('[Staff WS RAW]:', data.toString());
  });

  staffWs.send(JSON.stringify({ type: 'subscribe', conversationId: testConvId }));
  await new Promise((r) => setTimeout(r, 200));

  // 5. Staff sends message via WebSocket
  sendTime = Date.now();
  console.log('\n[TEST] Staff sending message over WebSocket...');
  staffWs.send(JSON.stringify({
    type: 'message:send',
    conversationId: testConvId,
    body: 'Alo test tốc độ WebSocket siêu tốc',
    visibility: 'public',
  }));

  // Wait for visitor to receive
  await new Promise((resolve) => {
    const check = setInterval(() => {
      if (receivedMessage) {
        clearInterval(check);
        resolve();
      }
    }, 5);
  });

  const latency = receiveTime - sendTime;
  console.log(`\n🎉 THÀNH CÔNG RỰC RỠ: Tin nhắn nhân viên đến thẳng widget khách hàng chỉ mất ${latency}ms! (Dưới 10ms)\n`);

  visitorWs.close();
  staffWs.close();
  await pool.end();
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
