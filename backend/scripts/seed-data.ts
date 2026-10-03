import pg from 'pg';
import argon2 from 'argon2';
import {createHash, randomUUID} from 'node:crypto';

// Password hash generator matching backend security policy
async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
}

function sha256(val: string): string {
  return createHash('sha256').update(val).digest('hex');
}

async function runSeed() {
  console.log('🚀 Starting GoTek Chatbot database seeding...');

  // Connect as gotek_migrator to bypass tenant RLS during bootstrap seeding
  const client = new pg.Client({
    host: process.env.PGHOST || (process.platform === 'win32' ? '127.0.0.1' : '/tmp'),
    port: Number(process.env.PGPORT) || 55432,
    user: process.env.PGUSER || 'gotek_migrator',
    password: process.env.PGPASSWORD || 'gotek_dev_password',
    database: 'gotek_chatbot'
  });

  await client.connect();
  console.log(' Connected to PostgreSQL database: gotek_chatbot');

  // Shared master password for all seed accounts
  const DEFAULT_PASSWORD = 'Admin@12345678';
  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

  await client.query('BEGIN');

  try {
    // 1. Seed or Get Main Workspace
    console.log('🏢 Seeding Workspace (GoTek Solutions HQ)...');
    let workspaceId = 'a0000000-0000-0000-0000-000000000001';
    const wsRes = await client.query(
      `INSERT INTO workspaces (id, name, language, status, seat_limit)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         status = EXCLUDED.status,
         seat_limit = EXCLUDED.seat_limit
       RETURNING id`,
      [workspaceId, 'GoTek Solutions HQ', 'vi', 'active', 20]
    );
    workspaceId = wsRes.rows[0].id;

    // 2. Seed Users & Memberships
    console.log('👤 Seeding System Users & Credentials (Admin@12345678)...');
    const userDefinitions = [
      {
        preferredId: 'b0000000-0000-0000-0000-000000000001',
        email: 'admin@gotek.vn',
        fullName: 'GoTek Super Admin',
        phone: '0901234567',
        role: 'Owner',
        isPlatformAdmin: true
      },
      {
        preferredId: 'b0000000-0000-0000-0000-000000000002',
        email: 'alex.rivera@gotek.vn',
        fullName: 'Alex Rivera',
        phone: '0912345678',
        role: 'Admin',
        isPlatformAdmin: false
      },
      {
        preferredId: 'b0000000-0000-0000-0000-000000000003',
        email: 'nam.do@gotek.vn',
        fullName: 'Đỗ Hoàng Nam',
        phone: '0923456789',
        role: 'Agent',
        isPlatformAdmin: false
      },
      {
        preferredId: 'b0000000-0000-0000-0000-000000000004',
        email: 'sarah.jenkins@gotek.vn',
        fullName: 'Sarah Jenkins',
        phone: '0934567890',
        role: 'Agent',
        isPlatformAdmin: false
      }
    ];

    const seededUsers: Record<string, string> = {};

    for (const u of userDefinitions) {
      const uRes = await client.query(
        `INSERT INTO users (id, email, full_name, phone, password_hash, verified_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (email) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           phone = EXCLUDED.phone,
           password_hash = EXCLUDED.password_hash,
           verified_at = coalesce(users.verified_at, now())
         RETURNING id`,
        [u.preferredId, u.email, u.fullName, u.phone, hashedPassword]
      );

      const userId = uRes.rows[0].id;
      seededUsers[u.email] = userId;

      // Upsert membership
      await client.query(
        `INSERT INTO memberships (workspace_id, user_id, role, active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET
           role = EXCLUDED.role,
           active = true`,
        [workspaceId, userId, u.role]
      );

      // Upsert platform admin if specified
      if (u.isPlatformAdmin) {
        await client.query(
          `INSERT INTO platform_admins (user_id, active)
           VALUES ($1, true)
           ON CONFLICT (user_id) DO UPDATE SET active = true`,
          [userId]
        );
      }
    }

    const adminUserId = seededUsers['admin@gotek.vn'];
    const alexUserId = seededUsers['alex.rivera@gotek.vn'];
    const namUserId = seededUsers['nam.do@gotek.vn'];
    const sarahUserId = seededUsers['sarah.jenkins@gotek.vn'];

    // 3. Seed Channel
    console.log('📡 Seeding Public Widget Channel...');
    const channelId = 'c0000000-0000-0000-0000-000000000001';
    await client.query(
      `INSERT INTO channels (id, workspace_id, name, origin, greeting, color, public_key, enabled, request_id, request_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         origin = EXCLUDED.origin,
         greeting = EXCLUDED.greeting,
         color = EXCLUDED.color,
         public_key = EXCLUDED.public_key,
         enabled = true`,
      [
        channelId,
        workspaceId,
        'Website Widget - GoTek Portal',
        'http://localhost:3001',
        'Xin chào quý khách! Em là GoTek AI Copilot, em có thể hỗ trợ thông tin gì cho quý khách hôm nay ạ?',
        '#0057e1',
        'gotek_pub_live_token_seed_enterprise_production_2026',
        'c0000000-0000-0000-0000-000000000099',
        JSON.stringify({source: 'seed_init'})
      ]
    );

    // Channel members
    for (const memberId of [alexUserId, namUserId, sarahUserId]) {
      await client.query(
        `INSERT INTO channel_members (workspace_id, channel_id, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (workspace_id, channel_id, user_id) DO NOTHING`,
        [workspaceId, channelId, memberId]
      );
    }

    // 4. Seed AI Providers & Models
    console.log('🧠 Seeding AI Providers & Models...');
    const providerOpenAIId = 'd0000000-0000-0000-0000-000000000001';
    const providerLocalId = 'd0000000-0000-0000-0000-000000000002';
    const modelGpt4oId = 'e0000000-0000-0000-0000-000000000001';
    const modelEmbedId = 'e0000000-0000-0000-0000-000000000002';

    await client.query(
      `INSERT INTO providers (id, name, adapter, secret_ref, enabled)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (name) DO UPDATE SET
         adapter = EXCLUDED.adapter,
         secret_ref = EXCLUDED.secret_ref,
         enabled = true`,
      [providerOpenAIId, 'OpenAI Production', 'openai', 'OPENAI_API_KEY']
    );

    // Get current provider id
    const prov1Res = await client.query('SELECT id FROM providers WHERE name = $1', ['OpenAI Production']);
    const actualProv1Id = prov1Res.rows[0].id;

    await client.query(
      `INSERT INTO providers (id, name, adapter, secret_ref, enabled)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (name) DO UPDATE SET
         adapter = EXCLUDED.adapter,
         secret_ref = EXCLUDED.secret_ref,
         enabled = true`,
      [providerLocalId, 'Local On-Premises Ollama', 'local', 'LOCAL_LLM_KEY']
    );

    await client.query(
      `INSERT INTO models (id, provider_id, name, capabilities, enabled)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (provider_id, name) DO UPDATE SET
         capabilities = EXCLUDED.capabilities,
         enabled = true`,
      [modelGpt4oId, actualProv1Id, 'gpt-4o-mini', ['chat', 'vision']]
    );

    await client.query(
      `INSERT INTO models (id, provider_id, name, capabilities, enabled)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (provider_id, name) DO UPDATE SET
         capabilities = EXCLUDED.capabilities,
         enabled = true`,
      [modelEmbedId, actualProv1Id, 'text-embedding-3-small', ['embedding']]
    );

    const mGptRes = await client.query('SELECT id FROM models WHERE provider_id = $1 AND name = $2', [actualProv1Id, 'gpt-4o-mini']);
    const actualGptId = mGptRes.rows[0].id;

    const mEmbRes = await client.query('SELECT id FROM models WHERE provider_id = $1 AND name = $2', [actualProv1Id, 'text-embedding-3-small']);
    const actualEmbId = mEmbRes.rows[0].id;

    // Model Grants
    await client.query(
      `INSERT INTO model_grants (id, workspace_id, model_id, capability, active)
       VALUES
         ($1, $2, $3, 'chat', true)
       ON CONFLICT (workspace_id, model_id, capability) DO UPDATE SET active = true`,
      [randomUUID(), workspaceId, actualGptId]
    );

    await client.query(
      `INSERT INTO model_grants (id, workspace_id, model_id, capability, active)
       VALUES
         ($1, $2, $3, 'embedding', true)
       ON CONFLICT (workspace_id, model_id, capability) DO UPDATE SET active = true`,
      [randomUUID(), workspaceId, actualEmbId]
    );

    // 5. Seed Realistic Visitors & Conversations & Messages
    console.log('💬 Seeding Realistic Conversations & Messages...');
    const visitor1Id = 'f0000000-0000-0000-0000-000000000001';
    const visitor1Token = 'gotek_visitor_session_token_tuan_techcombank_9881';
    await client.query(
      `INSERT INTO visitors (id, workspace_id, channel_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '30 days')
       ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
      [visitor1Id, workspaceId, channelId, sha256(visitor1Token)]
    );

    const v1Row = await client.query('SELECT id FROM visitors WHERE token_hash = $1', [sha256(visitor1Token)]);
    const actualV1Id = v1Row.rows[0].id;

    const conv1Id = '10000000-0000-0000-0000-000000000001';
    await client.query(
      `INSERT INTO conversations (id, workspace_id, channel_id, visitor_id, status, reply_owner, owner_version, assigned_to, next_sequence)
       VALUES ($1, $2, $3, $4, 'open', 'HUMAN_ACTIVE', 2, $5, 6)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         reply_owner = EXCLUDED.reply_owner,
         assigned_to = EXCLUDED.assigned_to,
         next_sequence = EXCLUDED.next_sequence`,
      [conv1Id, workspaceId, channelId, actualV1Id, alexUserId]
    );

    const msgsConv1 = [
      {
        id: '20000000-0000-0000-0000-000000000001',
        clientId: '30000000-0000-0000-0000-000000000001',
        sequence: 1,
        authorType: 'visitor',
        actorId: null,
        visibility: 'public',
        body: 'Chào GoTek, bên Techcombank đang thẩm định giải pháp AI Agent để tích hợp vào hệ thống Contact Center nội bộ. Cho tôi hỏi kiến trúc GoTek hỗ trợ On-Premise / Private Cloud qua Kubernetes không? Và tiêu chuẩn mã hóa dữ liệu khách hàng tuân thủ quy định bảo mật nào?'
      },
      {
        id: '20000000-0000-0000-0000-000000000002',
        clientId: '30000000-0000-0000-0000-000000000002',
        sequence: 2,
        authorType: 'ai',
        actorId: null,
        visibility: 'public',
        body: 'Dạ chào anh Tuấn! GoTek hoàn toàn hỗ trợ triển khai Dedicated Private Cloud và On-Premises thông qua Helm Charts tiêu chuẩn trên cụm Kubernetes (EKS, OpenShift hoặc Bare-metal).\n\nVề quy chuẩn an toàn bảo mật cho khối tài chính - ngân hàng: Toàn bộ dữ liệu hội thoại và embedding vectors đều được mã hóa bằng thuật toán AES-256 (at-rest) và TLS 1.3 (in-transit), đạt chứng nhận tuân thủ PCI-DSS Level 1, ISO 27001:2022 và SOC 2 Type II.'
      },
      {
        id: '20000000-0000-0000-0000-000000000003',
        clientId: '30000000-0000-0000-0000-000000000003',
        sequence: 3,
        authorType: 'visitor',
        actorId: null,
        visibility: 'public',
        body: 'Thông tin rất rõ ràng. Nhờ đại diện kỹ thuật liên hệ trực tiếp ký thoả thuận bảo mật (NDA) và gửi báo giá chi tiết cho gói 250 tổng đài viên. Email của tôi: tuan.nm@techcombank.com.vn.'
      },
      {
        id: '20000000-0000-0000-0000-000000000004',
        clientId: '30000000-0000-0000-0000-000000000004',
        sequence: 4,
        authorType: 'agent',
        actorId: alexUserId,
        visibility: 'internal',
        body: '@Trần Thảo (Account Executive): Lead này rất tiềm năng từ Khối CNTT Techcombank. Tôi đã đẩy hồ sơ vào CRM HubSpot deal stage "Discovery Call". Tôi sẽ trực tiếp tiếp quản hội thoại để gửi mẫu NDA tiêu chuẩn FSI.'
      },
      {
        id: '20000000-0000-0000-0000-000000000005',
        clientId: '30000000-0000-0000-0000-000000000005',
        sequence: 5,
        authorType: 'agent',
        actorId: alexUserId,
        visibility: 'public',
        body: 'Kính chào anh Tuấn, em là Alex Rivera từ bộ phận Chuyên gia Giải pháp Enterprise của GoTek. Em đã nhận được yêu cầu NDA và dự toán hạ tầng cho 250 agent. Em đang chuyển file NDA trực tiếp qua hòm thư tuan.nm@techcombank.com.vn và sẽ liên hệ hỗ trợ anh ngay trong 15 phút tới ạ!'
      }
    ];

    for (const m of msgsConv1) {
      await client.query(
        `INSERT INTO messages (id, workspace_id, conversation_id, client_id, sequence, author_type, actor_id, visibility, body, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         ON CONFLICT (workspace_id, conversation_id, client_id) DO NOTHING`,
        [m.id, workspaceId, conv1Id, m.clientId, m.sequence, m.authorType, m.actorId, m.visibility, m.body]
      );
    }

    // Visitor 2: Sarah Jenkins (CloudFlow Systems)
    const visitor2Id = 'f0000000-0000-0000-0000-000000000002';
    const visitor2Token = 'gotek_visitor_session_token_sarah_cloudflow_7721';
    await client.query(
      `INSERT INTO visitors (id, workspace_id, channel_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '30 days')
       ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
      [visitor2Id, workspaceId, channelId, sha256(visitor2Token)]
    );

    const v2Row = await client.query('SELECT id FROM visitors WHERE token_hash = $1', [sha256(visitor2Token)]);
    const actualV2Id = v2Row.rows[0].id;

    const conv2Id = '10000000-0000-0000-0000-000000000002';
    await client.query(
      `INSERT INTO conversations (id, workspace_id, channel_id, visitor_id, status, reply_owner, owner_version, assigned_to, next_sequence)
       VALUES ($1, $2, $3, $4, 'open', 'AI_ACTIVE', 1, null, 3)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         reply_owner = EXCLUDED.reply_owner,
         next_sequence = EXCLUDED.next_sequence`,
      [conv2Id, workspaceId, channelId, actualV2Id]
    );

    const msgsConv2 = [
      {
        id: '20000000-0000-0000-0000-000000000006',
        clientId: '30000000-0000-0000-0000-000000000006',
        sequence: 1,
        authorType: 'visitor',
        actorId: null,
        visibility: 'public',
        body: 'Hello GoTek! We noticed our batch webhook ingestion from Stripe billing started throttling with HTTP 429. Is there an endpoint concurrency limit per API key?'
      },
      {
        id: '20000000-0000-0000-0000-000000000007',
        clientId: '30000000-0000-0000-0000-000000000007',
        sequence: 2,
        authorType: 'ai',
        actorId: null,
        visibility: 'public',
        body: 'Hello Sarah! Standard accounts have a default limit of 100 req/sec, but Enterprise accounts on CloudFlow have a burst cap of 2,500 req/sec with auto-scaling queues. Checking your tenant config now...'
      }
    ];

    for (const m of msgsConv2) {
      await client.query(
        `INSERT INTO messages (id, workspace_id, conversation_id, client_id, sequence, author_type, actor_id, visibility, body, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         ON CONFLICT (workspace_id, conversation_id, client_id) DO NOTHING`,
        [m.id, workspaceId, conv2Id, m.clientId, m.sequence, m.authorType, m.actorId, m.visibility, m.body]
      );
    }

    // 6. Seed Knowledge Base Items & Versions
    console.log('📚 Seeding Knowledge Base Documents...');
    const KNOWLEDGE_1_ID = '40000000-0000-0000-0000-000000000001';
    const KNOWLEDGE_1_VER_ID = '50000000-0000-0000-0000-000000000001';
    const k1Title = 'Chinh_sach_gia_va_trien_khai_Enterprise_v2';
    const k1Content = 'GoTek hỗ trợ triển khai Dedicated Private Cloud và On-Premises thông qua Helm Charts tiêu chuẩn trên cụm Kubernetes (EKS, OpenShift hoặc Bare-metal). Toàn bộ dữ liệu hội thoại và embedding vectors đều được mã hóa bằng thuật toán AES-256 (at-rest) và TLS 1.3 (in-transit), đạt chứng nhận tuân thủ PCI-DSS Level 1, ISO 27001:2022 và SOC 2 Type II.';

    await client.query(
      `INSERT INTO knowledge_items (id, workspace_id, source_type, active, audience, revision, created_by)
       VALUES ($1, $2, 'MANUAL', true, 'PUBLIC', 1, $3)
       ON CONFLICT (id) DO NOTHING`,
      [KNOWLEDGE_1_ID, workspaceId, adminUserId]
    );

    await client.query(
      `INSERT INTO knowledge_versions (id, workspace_id, item_id, version_no, title, content, content_hash, state, created_by)
       VALUES ($1, $2, $3, 1, $4, $5, $6, 'READY', $7)
       ON CONFLICT (id) DO NOTHING`,
      [KNOWLEDGE_1_VER_ID, workspaceId, KNOWLEDGE_1_ID, k1Title, k1Content, sha256(k1Content), adminUserId]
    );

    await client.query(
      `UPDATE knowledge_items
       SET published_version_id = $1, draft_version_id = $1
       WHERE id = $2`,
      [KNOWLEDGE_1_VER_ID, KNOWLEDGE_1_ID]
    );

    const KNOWLEDGE_2_ID = '40000000-0000-0000-0000-000000000002';
    const KNOWLEDGE_2_VER_ID = '50000000-0000-0000-0000-000000000002';
    const k2Title = 'Internal_Escalation_Runbook_v3';
    const k2Content = 'Quy trình xử lý sự cố Escalation nội bộ dành riêng cho Tier 2 và Tier 3 Support. Khi có yêu cầu ký kết NDA hoặc sự cố P1 ảnh hưởng đến hạ tầng ngân hàng, nhân viên trực ca phải gắn tag Handoff và liên hệ trực tiếp cho Lead qua số hotline khẩn cấp.';

    await client.query(
      `INSERT INTO knowledge_items (id, workspace_id, source_type, active, audience, revision, created_by)
       VALUES ($1, $2, 'MANUAL', true, 'INTERNAL', 1, $3)
       ON CONFLICT (id) DO NOTHING`,
      [KNOWLEDGE_2_ID, workspaceId, adminUserId]
    );

    await client.query(
      `INSERT INTO knowledge_versions (id, workspace_id, item_id, version_no, title, content, content_hash, state, created_by)
       VALUES ($1, $2, $3, 1, $4, $5, $6, 'READY', $7)
       ON CONFLICT (id) DO NOTHING`,
      [KNOWLEDGE_2_VER_ID, workspaceId, KNOWLEDGE_2_ID, k2Title, k2Content, sha256(k2Content), adminUserId]
    );

    await client.query(
      `UPDATE knowledge_items
       SET published_version_id = $1, draft_version_id = $1
       WHERE id = $2`,
      [KNOWLEDGE_2_VER_ID, KNOWLEDGE_2_ID]
    );

    await client.query('COMMIT');
    console.log('\n🎉 Seed database completed successfully with 100% realistic data!');
    console.log('------------------------------------------------------------');
    console.log('🔑 CREDENTIALS FOR LOGIN:');
    console.log('   Default Password: Admin@12345678');
    console.log('   1. Platform Super Admin & Owner: admin@gotek.vn');
    console.log('   2. Workspace Admin (Lead):       alex.rivera@gotek.vn');
    console.log('   3. Support Agent 1:              nam.do@gotek.vn');
    console.log('   4. Support Agent 2:              sarah.jenkins@gotek.vn');
    console.log('------------------------------------------------------------');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed, rolled back:', error);
    throw error;
  } finally {
    await client.end();
  }
}

runSeed().catch(err => {
  console.error(err);
  process.exit(1);
});
