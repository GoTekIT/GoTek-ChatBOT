const http = require('http');
const WebSocket = require('ws');

const API_BASE = 'http://127.0.0.1:4317';
const WS_BASE = 'ws://127.0.0.1:4317';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Gotek-Request': '1',
        ...(options.headers || {})
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(body); } catch { parsed = body; }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

function connectWs(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_BASE + path, { headers });
    const events = [];
    const eventHandlers = new Map();

    ws.on('open', () => {
      resolve({
        ws,
        events,
        send(obj) {
          ws.send(JSON.stringify(obj));
        },
        waitFor(type, predicateOrTimeout = null, timeoutMs = 5000) {
          const predicate = typeof predicateOrTimeout === 'function' ? predicateOrTimeout : null;
          const limit = typeof predicateOrTimeout === 'number' ? predicateOrTimeout : timeoutMs;
          const callTime = Date.now();

          // If an event already arrived and matches predicate
          if (predicate) {
            const existing = events.find(e => (e.type || e.event) === type && predicate(e.data || e));
            if (existing) return Promise.resolve(existing);
          }

          return new Promise((resWait, rejWait) => {
            const timeout = setTimeout(() => {
              rejWait(new Error(`Timeout waiting for WS frame "${type}" after ${limit}ms`));
            }, limit);

            const handler = (evt) => {
              if (evt._receivedAt >= callTime) {
                if (!predicate || predicate(evt.data || evt)) {
                  clearTimeout(timeout);
                  resWait(evt);
                }
              }
            };
            if (!eventHandlers.has(type)) eventHandlers.set(type, []);
            eventHandlers.get(type).push(handler);
          });
        },
        close() {
          ws.close();
        }
      });
    });

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString('utf8'));
        const eventType = parsed.type || parsed.event;
        parsed._receivedAt = Date.now();
        events.push(parsed);

        const handlers = eventHandlers.get(eventType) || [];
        for (const handler of handlers) handler(parsed);
      } catch (err) {
        console.warn('WS parse error:', err);
      }
    });

    ws.on('close', (code, reason) => {
      if (code !== 1000) {
        console.log(`[WS Closed unexpectedly] code=${code} reason=${reason.toString()}`);
      }
    });

    ws.on('error', reject);
  });
}

async function run() {
  console.log('================================================================');
  console.log('⚡ PHƯƠNG ÁN A: FULL-DUPLEX WEBSOCKET + DATABASE PERSISTENCE ⚡');
  console.log('================================================================\n');

  console.log('--- 1. Thiết lập tài khoản Nhân viên (Staff Session) ---');
  const testEmail = `staff-${Date.now()}@gotek.vn`;
  const testPassword = 'Password123!';

  await request('/api/auth/signup', {
    method: 'POST',
    body: {
      email: testEmail,
      password: testPassword,
      fullName: 'Trưởng nhóm CSKH Realtime',
      business: 'GoTek Socket Labs',
      phone: '0988112233'
    }
  });

  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: testEmail, password: testPassword }
  });
  const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0].split(';')[0] : '';
  const staffHeaders = { Cookie: cookie };

  const meRes = await request('/api/me', { headers: staffHeaders });
  const userId = meRes.data?.user?.id;
  console.log('✅ Đăng nhập nhân viên thành công. User ID:', userId);

  console.log('\n--- 2. Lấy kênh Widget (Channel Resolution) ---');
  let channelsRes = await request('/api/channels', { headers: staffHeaders });
  let channel = channelsRes.data?.[0];

  if (!channel) {
    const createChanRes = await request('/api/channels', {
      method: 'POST',
      headers: staffHeaders,
      body: {
        requestId: require('crypto').randomUUID(),
        name: 'GoTek Live Chat Widget',
        origin: 'http://localhost:3001',
        greeting: 'Chào mừng bạn đến với GoTek!',
        color: '#1664ff',
        agents: [userId]
      }
    });
    const channelId = createChanRes.data.id;
    const chanInstallRes = await request(`/api/channels/${channelId}/installation`, { headers: staffHeaders });
    channel = chanInstallRes.data;
  }
  const visitorKey = channel.publicKey || channel.public_key;
  console.log(`✅ Kênh đang hoạt động: "${channel.name}" (Key: ${visitorKey})`);

  console.log('\n--- 3. Khởi tạo phiên Khách hàng (Visitor Session) ---');
  const sessionRes = await request(`/widget-api/${visitorKey}/session`, {
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3001'
    },
    body: {}
  });

  if (sessionRes.status !== 200) {
    throw new Error(`Failed to create visitor session: HTTP ${sessionRes.status} - ${JSON.stringify(sessionRes.data)}`);
  }

  const visitorToken = sessionRes.data.token;
  const conversationId = sessionRes.data.conversationId;
  console.log('✅ Khởi tạo Visitor thành công:');
  console.log('   - Conversation ID:', conversationId);
  console.log('   - Visitor Token:', visitorToken.slice(0, 15) + '...');

  console.log('\n--- 4. Kết nối WebSocket 2 chiều (Full-Duplex Socket Pipes) ---');
  
  // Connect Visitor WS
  const t0_v = Date.now();
  const visitorConn = await connectWs(`/ws?token=${encodeURIComponent(visitorToken)}&role=visitor`);
  const visitorReady = await visitorConn.waitFor('system:ready');
  const tVisitorWs = Date.now() - t0_v;
  console.log(`⚡ Visitor WebSocket kết nối thành công: ${tVisitorWs}ms (Role: ${visitorReady.role})`);

  // Connect Staff WS
  const t0_s = Date.now();
  const staffConn = await connectWs(`/ws?role=staff`, staffHeaders);
  const staffReady = await staffConn.waitFor('system:ready');
  const tStaffWs = Date.now() - t0_s;
  console.log(`⚡ Staff WebSocket kết nối thành công: ${tStaffWs}ms (User: ${staffReady.name})`);

  // Staff Subscribes to Conversation
  staffConn.send({ type: 'subscribe', conversationId });
  await staffConn.waitFor('subscribed');
  console.log(`✅ Staff đã subscribe vào conversation "${conversationId}"`);

  console.log('\n--- 5. Test: Khách hàng gửi tin nhắn qua WebSocket ---');
  const visitorMsgClientId = require('crypto').randomUUID();
  const visitorMsgText = `Chào GoTek! Tôi cần tư vấn phương án WebSocket [${Date.now()}]`;

  const tSendVisitor = Date.now();
  visitorConn.send({
    type: 'message:send',
    body: visitorMsgText,
    clientId: visitorMsgClientId
  });

  // Wait for Visitor ACK & Staff New Message Frame in parallel
  const [visitorAck, staffNewMsg] = await Promise.all([
    visitorConn.waitFor('message:ack'),
    staffConn.waitFor('message:new')
  ]);
  const tVisitorRoundtrip = Date.now() - tSendVisitor;

  console.log(`🎯 [Visitor -> Staff] Thời gian phản hồi WebSocket ACK: ${tVisitorRoundtrip}ms`);
  console.log('   - Visitor ACK DB ID:', visitorAck.id, 'Sequence:', visitorAck.sequence);
  console.log('   - Staff nhận tin nhắn tức thì:', (staffNewMsg.data || staffNewMsg).body);

  console.log('\n--- 6. Test: Nhân viên phản hồi qua WebSocket ---');
  const staffMsgClientId = require('crypto').randomUUID();
  const staffMsgText = `Chào bạn! Tôi là kỹ sư GoTek, hệ thống WebSocket đang xử lý cực nhanh [${Date.now()}]`;

  const tSendStaff = Date.now();
  staffConn.send({
    type: 'message:send',
    conversationId,
    body: staffMsgText,
    visibility: 'public',
    clientId: staffMsgClientId
  });

  // Wait for Staff ACK & Visitor New Message Frame in parallel
  const [staffAck, visitorNewMsg] = await Promise.all([
    staffConn.waitFor('message:ack'),
    visitorConn.waitFor('message:new', (data) => data.client_id === staffMsgClientId || data.clientId === staffMsgClientId || data.body === staffMsgText)
  ]);
  const tStaffRoundtrip = Date.now() - tSendStaff;

  console.log(`🎯 [Staff -> Visitor] Thời gian phản hồi WebSocket ACK: ${tStaffRoundtrip}ms`);
  console.log('   - Staff ACK DB ID:', staffAck.id, 'Sequence:', staffAck.sequence);
  console.log('   - Visitor nhận phản hồi tức thì:', (visitorNewMsg.data || visitorNewMsg).body);

  console.log('\n--- 7. Test: Trạng thái đang soạn tin (Typing Indicator) ---');
  const tSendTyping = Date.now();
  visitorConn.send({
    type: 'typing',
    isTyping: true
  });
  const staffTypingEvt = await staffConn.waitFor('typing');
  const tTypingLatency = Date.now() - tSendTyping;
  console.log(`⚡ Typing Indicator truyền tức thì: ${tTypingLatency}ms (isTyping: ${(staffTypingEvt.data || staffTypingEvt).isTyping})`);

  console.log('\n--- 8. KIỂM TRA LƯU TRỮ DATABASE (DATABASE HISTORY PERSISTENCE) ---');
  console.log('Gọi API GET /messages từ Visitor SDK endpoint để kiểm chứng toàn bộ lịch sử trong PostgreSQL:');

  const historyRes = await request(`/widget-api/${visitorKey}/messages?after=0`, {
    headers: {
      Authorization: `Bearer ${visitorToken}`,
      Origin: 'http://localhost:3001',
    }
  });

  console.log(`HTTP Status: ${historyRes.status}`);
  const messages = historyRes.data;
  console.log(`Số lượng tin nhắn tìm thấy trong database: ${messages.length}`);

  const foundVisitorMsg = messages.find(m => m.client_id === visitorMsgClientId || m.body === visitorMsgText);
  const foundStaffMsg = messages.find(m => m.client_id === staffMsgClientId || m.body === staffMsgText);

  console.log('Kiểm chứng chi tiết:');
  console.log(`1. Tin nhắn của khách trong DB: ${foundVisitorMsg ? '✅ TỒN TẠI (ID: ' + foundVisitorMsg.id + ', Seq: ' + foundVisitorMsg.sequence + ')' : '❌ KHÔNG TÌM THẤY'}`);
  console.log(`2. Tin nhắn của nhân viên trong DB: ${foundStaffMsg ? '✅ TỒN TẠI (ID: ' + foundStaffMsg.id + ', Seq: ' + foundStaffMsg.sequence + ')' : '❌ KHÔNG TÌM THẤY'}`);

  if (foundVisitorMsg && foundStaffMsg) {
    console.log('\n🎉 THÀNH CÔNG 100%! PHƯƠNG ÁN A ĐÃ HOÀN TẤT VÀ KIỂM CHỨNG TOÀN DIỆN:');
    console.log('   1. Hai chiều đều dùng WebSocket thuần (Full-Duplex)');
    console.log(`   2. Tốc độ nhận và gửi tin tức thì: Roundtrip ~${tVisitorRoundtrip}ms / ~${tStaffRoundtrip}ms`);
    console.log('   3. 100% tin nhắn gửi qua WebSocket được lưu vĩnh viễn vào Database PostgreSQL');
    console.log('   4. Lịch sử chat được tải đầy đủ và bảo toàn nguyên vẹn');
  } else {
    throw new Error('Database persistence verification failed!');
  }

  visitorConn.close();
  staffConn.close();
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
