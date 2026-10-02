import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {pool, transaction} from '../src/core/db';
import {AIPipeline} from '../src/modules/ai/ai-pipeline';

const admin = new pg.Pool({
  host: process.platform === 'win32' ? '127.0.0.1' : (process.env.PGHOST || '/tmp'),
  port: Number(process.env.PGPORT) || 55432,
  user: process.env.PGUSER || 'gotek_migrator',
  password: process.env.PGPASSWORD || 'gotek_dev_password',
  database: 'gotek_chatbot',
});

after(async () => {
  await pool.end();
  await admin.end();
});

test('AIPipeline: Ingestion, Chunking, Retrieval, Guardrails and Handoff Triggers', async () => {
  const workspaceId = randomUUID();
  const userId = randomUUID();

  // Create isolated test workspace and user
  await admin.query(
    `INSERT INTO workspaces (id, name, status) VALUES ($1, 'AI Pipeline Test Workspace', 'active')`,
    [workspaceId]
  );
  await admin.query(
    `INSERT INTO users (id, email, password_hash, full_name, phone)
     VALUES ($1, $2, 'dummy-hash', 'AI Tester', '0900000000')`,
    [userId, `ai-test-${randomUUID()}@gotek.vn`]
  );
  await admin.query(
    `INSERT INTO memberships (workspace_id, user_id, role, active)
     VALUES ($1, $2, 'Owner', true)`,
    [workspaceId, userId]
  );

  await transaction(async db => {
    // 1. Ingest Knowledge Document
    const rawContent = `CHÍNH SÁCH BẢO HÀNH GOTEK
1. Thời hạn bảo hành: Mọi sản phẩm phần cứng được bảo hành chính hãng 12 tháng kể từ ngày kích hoạt.
2. Điều kiện bảo hành: Thiết bị còn nguyên tem, không bị rơi vỡ, vào nước hoặc can thiệp sửa chữa trái phép.
3. Chi phí vận chuyển: Trong 30 ngày đầu, công ty chi trả 100% cước phí vận chuyển bảo hành hai chiều.
4. Đổi mới: Đổi mới 1-1 trong 15 ngày đầu nếu phát sinh lỗi kỹ thuật từ nhà sản xuất.`;

    const ingestResult = await AIPipeline.ingestDocument(db, workspaceId, userId, {
      title: 'Chính sách bảo hành GoTek 2026',
      content: rawContent,
      audience: 'PUBLIC',
    });

    assert.ok(ingestResult.itemId);
    assert.ok(ingestResult.versionId);
    assert.ok(ingestResult.chunksCount >= 1);
    assert.ok(ingestResult.totalTokens > 0);

    // 2. Retrieve Context via Semantic/Lexical Matching
    const retrieved = await AIPipeline.retrieveContext(db, workspaceId, {
      query: 'thời hạn bảo hành phần cứng bao lâu',
      limit: 3,
    });

    assert.ok(retrieved.length >= 1);
    assert.equal(retrieved[0].title, 'Chính sách bảo hành GoTek 2026');
    assert.ok(retrieved[0].text.includes('12 tháng'));
    assert.ok(retrieved[0].similarity > 0);

    // 3. Grounded Answer Generation
    const answerResult = await AIPipeline.generateAnswer(db, workspaceId, {
      message: 'Sản phẩm bên mình được bảo hành bao lâu?',
      requireGrounded: true,
    });

    assert.ok(answerResult.answer.length > 0);
    assert.equal(answerResult.isHandoff, false);
    assert.ok(answerResult.citations.length >= 1);
    assert.ok(answerResult.confidence > 0);

    // 4. Guardrail Handoff Trigger (Customer asks for Human)
    const handoffResult = await AIPipeline.generateAnswer(db, workspaceId, {
      message: 'Tôi muốn gặp nhân viên tư vấn ngay bây giờ!',
    });

    assert.equal(handoffResult.isHandoff, true);
    assert.equal(handoffResult.handoffReason, 'EXPLICIT_HUMAN_REQUEST');
    assert.ok(handoffResult.answer.includes('kết nối'));

    // 5. AI Playground Simulation
    const playgroundResult = await AIPipeline.testInPlayground(
      db,
      workspaceId,
      'Điều kiện đổi mới 1-1 là gì?'
    );

    assert.ok(playgroundResult.answer.length > 0);
    assert.ok(playgroundResult.groundedPromptPreview.length > 0);
    assert.ok(playgroundResult.groundedPromptPreview.includes('Điều kiện'));

    // 6. 1-Click Teach FAQ
    const faqResult = await AIPipeline.teachFaq(db, workspaceId, userId, {
      question: 'Cửa hàng có mở cửa Chủ Nhật không?',
      answer: 'Dạ cửa hàng mở cửa cả Chủ Nhật từ 8h30 đến 21h30 ạ!',
    });

    assert.ok(faqResult.itemId);

    // Verify FAQ immediately retrievable
    const faqSearch = await AIPipeline.retrieveContext(db, workspaceId, {
      query: 'Chủ Nhật có mở cửa không',
    });
    assert.ok(faqSearch.some(s => s.text.includes('Chủ Nhật')));
  });
});

test('AIPipeline: HTTP API endpoints, RBAC permissions and validation', async () => {
  const {createApp} = await import('../src/app');
  const request = (await import('supertest')).default;
  const app = createApp();
  const header = {'X-Gotek-Request': '1'};
  const password = 'Ai-pipeline-test-pass-2026';

  // 1. Create Owner account
  const ownerAgent = request.agent(app);
  const ownerEmail = `ai-owner-${randomUUID()}@example.test`;
  await ownerAgent
    .post('/api/auth/signup')
    .set(header)
    .send({
      email: ownerEmail,
      password,
      fullName: 'AI Owner',
      business: 'AI Automation Corp',
      phone: '0901234567',
    })
    .expect(202);

  await ownerAgent
    .post('/api/auth/login')
    .set(header)
    .send({email: ownerEmail, password})
    .expect(200);

  const meOwner = (await ownerAgent.get('/api/me').expect(200)).body;
  const ws = meOwner.workspaceId;

  // 2. Create Agent account in same workspace
  const staffAgent = request.agent(app);
  const staffEmail = `ai-staff-${randomUUID()}@example.test`;
  await staffAgent
    .post('/api/auth/signup')
    .set(header)
    .send({
      email: staffEmail,
      password,
      fullName: 'AI Staff',
      business: 'Temp Corp',
      phone: '0907654321',
    })
    .expect(202);

  await staffAgent
    .post('/api/auth/login')
    .set(header)
    .send({email: staffEmail, password})
    .expect(200);

  const meStaff = (await staffAgent.get('/api/me').expect(200)).body;
  await admin.query('INSERT INTO memberships(workspace_id, user_id, role) VALUES($1, $2, $3)', [
    ws,
    meStaff.user.id,
    'Agent',
  ]);
  await staffAgent.post('/api/workspace/switch').set(header).send({workspaceId: ws}).expect(200);

  // 3. Owner ingests knowledge document -> 200
  const ingestRes = await ownerAgent
    .post('/api/ai/pipeline/ingest')
    .set(header)
    .send({
      title: 'Quy chế giao hàng hỏa tốc',
      content: 'Giao hàng hỏa tốc trong 2 giờ nội thành Hà Nội và TP Hồ Chí Minh. Miễn phí cho đơn trên 500k.',
      audience: 'PUBLIC',
    })
    .expect(200);

  assert.ok(ingestRes.body.itemId);
  assert.ok(ingestRes.body.chunksCount >= 1);

  // 4. Staff cannot ingest (requires knowledge.manage) -> 403
  await staffAgent
    .post('/api/ai/pipeline/ingest')
    .set(header)
    .send({
      title: 'Hack attempt',
      content: 'Unauthorized content',
    })
    .expect(403);

  // 5. Staff retrieves context (has inbox.use) -> 200
  const retrieveRes = await staffAgent
    .post('/api/ai/pipeline/retrieve')
    .set(header)
    .send({query: 'giao hàng hỏa tốc bao lâu'})
    .expect(200);

  assert.ok(Array.isArray(retrieveRes.body));
  assert.ok(retrieveRes.body.length >= 1);
  assert.ok(retrieveRes.body[0].text.includes('2 giờ'));

  // 6. Staff generates answer with citations -> 200
  const genRes = await staffAgent
    .post('/api/ai/pipeline/generate')
    .set(header)
    .send({message: 'Bên mình có giao hàng 2h không?'})
    .expect(200);

  assert.ok(genRes.body.answer);
  assert.equal(genRes.body.isHandoff, false);
  assert.ok(genRes.body.citations.length >= 1);

  // 7. Owner tests in Playground -> 200
  const playgroundRes = await ownerAgent
    .post('/api/ai/pipeline/playground')
    .set(header)
    .send({question: 'Đơn bao nhiêu được freeship hỏa tốc?'})
    .expect(200);

  assert.ok(playgroundRes.body.answer);
  assert.ok(playgroundRes.body.groundedPromptPreview);

  // 8. Staff cannot access Playground -> 403
  await staffAgent
    .post('/api/ai/pipeline/playground')
    .set(header)
    .send({question: 'Test question'})
    .expect(403);

  // 9. Owner teaches 1-Click FAQ -> 200
  const faqRes = await ownerAgent
    .post('/api/ai/pipeline/faq')
    .set(header)
    .send({
      question: 'Phí ship ngoại thành là bao nhiêu?',
      answer: 'Phí ship ngoại thành cố định là 30.000 VNĐ trên toàn quốc.',
    })
    .expect(200);

  assert.ok(faqRes.body.itemId);

  // 10. Staff cannot teach FAQ -> 403
  await staffAgent
    .post('/api/ai/pipeline/faq')
    .set(header)
    .send({
      question: 'Unauthorized question',
      answer: 'Unauthorized answer',
    })
    .expect(403);
});
