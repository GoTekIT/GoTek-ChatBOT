import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {pool, transaction, scope} from '../src/core/db';
import {BotService} from '../src/services/bot.service';
import {AiPipelineService} from '../src/services/ai-pipeline.service';
import {createKnowledge} from '../src/modules/knowledge/knowledge';
import {processKnowledge, publishKnowledge, unpublishKnowledge} from '../src/modules/knowledge/knowledge-lifecycle';
import {retrieveKnowledge} from '../src/modules/knowledge/knowledge-retrieval';

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

test('Knowledge Core UC-036 to UC-050: FAQ steps, Bot templates, Media and Unpublish lifecycle', async () => {
  const workspaceId = randomUUID();
  const userId = randomUUID();
  const actor = {workspace_id: workspaceId, user_id: userId, role: 'Owner'};

  await admin.query(
    `INSERT INTO workspaces (id, name, status) VALUES ($1, 'Knowledge Core Test Workspace', 'active')`,
    [workspaceId]
  );
  await admin.query(
    `INSERT INTO users (id, email, password_hash, full_name, phone)
     VALUES ($1, $2, 'dummy-hash', 'Knowledge Tester', '0900000000')`,
    [userId, `know-test-${randomUUID()}@gotek.vn`]
  );
  await admin.query(
    `INSERT INTO memberships (workspace_id, user_id, role, active)
     VALUES ($1, $2, 'Owner', true)`,
    [workspaceId, userId]
  );

  try {
    // 1. UC-038: Bot Templates & Media Assets
    await transaction(async db => {
      await scope(db, workspaceId);

      // Create bot template
      const tpl = await BotService.createTemplate(db, workspaceId, userId, {
        shortcut: 'chao',
        title: 'Lời chào ban đầu',
        content: 'Chào mừng quý khách đến với GoTek!',
        category: 'Chăm sóc',
        media_urls: ['https://example.com/banner.png'],
      });
      assert.equal(tpl.shortcut, '/chao');
      assert.equal(tpl.media_urls.length, 1);

      // Reject duplicate shortcut
      await assert.rejects(
        BotService.createTemplate(db, workspaceId, userId, {
          shortcut: '/chao',
          title: 'Trùng phím tắt',
          content: 'Nội dung khác',
        }),
        {code: 'SHORTCUT_EXISTS'}
      );

      // List templates
      const list = await BotService.listTemplates(db, workspaceId);
      assert.equal(list.length, 1);
      assert.equal(list[0].id, tpl.id);

      // Create media asset
      const media = await BotService.createMediaAsset(db, workspaceId, userId, {
        title: 'Logo công ty',
        file_url: 'https://example.com/logo.png',
        mime_type: 'image/png',
        byte_size: 15420,
        tags: ['branding', 'logo'],
      });
      assert.equal(media.title, 'Logo công ty');

      const mediaList = await BotService.listMediaAssets(db, workspaceId);
      assert.equal(mediaList.length, 1);
      assert.equal(mediaList[0].id, media.id);

      // Delete media
      await BotService.deleteMediaAsset(db, workspaceId, media.id);
      const afterDel = await BotService.listMediaAssets(db, workspaceId);
      assert.equal(afterDel.length, 0);
    });

    // 2. UC-037: Multi-step FAQ with allowed images
    await transaction(async db => {
      await scope(db, workspaceId);

      const faqResult = await AiPipelineService.teachFaq(db, workspaceId, userId, {
        question: 'Làm thế nào để đổi mật khẩu?',
        answer: 'Bạn có thể đổi mật khẩu qua 2 bước sau',
        steps: [
          {stepNumber: 1, title: 'Vào cài đặt tài khoản', description: 'Bấm biểu tượng hồ sơ ở góc trên', imageUrl: 'https://example.com/step1.png'},
          {stepNumber: 2, title: 'Nhập mật khẩu mới', description: 'Gõ mật khẩu mới và bấm Lưu'},
        ],
        allowedImages: ['https://example.com/step1.png'],
        audience: 'PUBLIC',
      });

      assert.ok(faqResult.itemId);
      assert.equal(faqResult.chunksCount > 0, true);

      // Retrieve and verify step text is embedded
      const retrieved = await retrieveKnowledge(db, workspaceId, {
        query: 'đổi mật khẩu',
        audience: 'PUBLIC',
        limit: 5,
      });

      assert.equal(retrieved.items.length > 0, true);
      assert.ok(retrieved.items[0].content.includes('Bước 1: Vào cài đặt tài khoản'));
      assert.ok(retrieved.items[0].content.includes('https://example.com/step1.png'));
    });

    // 3. UC-042 & UC-045: Knowledge Publish and Unpublish
    await transaction(async db => {
      await scope(db, workspaceId);

      // Create item
      const item = await createKnowledge(db, actor, {
        title: 'Tài liệu thử nghiệm thu hồi',
        content: 'Nội dung tài liệu sẽ được xuất bản rồi thu hồi lại để kiểm tra bảo mật.',
        active: true,
        requestId: randomUUID(),
      });

      // Process draft -> READY
      const processed = await processKnowledge(db, actor, item.id, {
        versionId: item.draft_version_id,
        expectedRevision: item.revision,
        requestId: randomUUID(),
      });
      assert.equal(processed.state, 'READY');

      // Publish -> PUBLIC
      const published = await publishKnowledge(db, actor, item.id, {
        versionId: item.draft_version_id,
        expectedRevision: processed.revision,
        audience: 'PUBLIC',
        requestId: randomUUID(),
      });
      assert.ok(published.published_version_id);

      // Verify searchable by public retrieval
      const searchBefore = await retrieveKnowledge(db, workspaceId, {
        query: 'thu hồi',
        audience: 'PUBLIC',
        limit: 5,
      });
      assert.equal(searchBefore.items.length, 1);
      assert.equal(searchBefore.items[0].knowledgeItemId, item.id);

      // Unpublish (Revoke)
      const unpublished = await unpublishKnowledge(db, actor, item.id, {
        expectedRevision: published.revision,
        requestId: randomUUID(),
      });
      assert.equal(unpublished.published_version_id, null);

      // Verify NO LONGER returned by public retrieval
      const searchAfter = await retrieveKnowledge(db, workspaceId, {
        query: 'thu hồi',
        audience: 'PUBLIC',
        limit: 5,
      });
      assert.equal(searchAfter.items.length, 0);
    });
  } finally {
    // Cleanup
    for (const table of [
      'audit_events',
      'jobs',
      'bot_templates',
      'bot_media_assets',
      'knowledge_chunks',
    ]) {
      await admin.query(`DELETE FROM ${table} WHERE workspace_id = $1`, [workspaceId]);
    }
    await admin.query(
      `UPDATE knowledge_items SET draft_version_id = NULL, published_version_id = NULL WHERE workspace_id = $1`,
      [workspaceId]
    );
    for (const table of [
      'knowledge_versions',
      'knowledge_items',
      'knowledge_mutations',
      'memberships',
    ]) {
      await admin.query(`DELETE FROM ${table} WHERE workspace_id = $1`, [workspaceId]);
    }
    await admin.query(`DELETE FROM workspaces WHERE id = $1`, [workspaceId]);
    await admin.query(`DELETE FROM users WHERE id = $1`, [userId]);
  }
});
