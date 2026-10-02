import type {PoolClient} from 'pg';
import {transaction} from '../../core/db.js';

/**
 * Platform AI Registry Bootstrapper
 * Ensures primary providers (Gemini/OpenAI) and models exist, and grants chat/embedding
 * capabilities to active tenant workspaces so AI auto-reply works out-of-the-box.
 */
export async function bootstrapPlatformAiRegistry(): Promise<void> {
  try {
    await transaction(async db => {
      const prev = (await db.query("SELECT current_setting('app.platform',true) AS enabled")).rows[0]?.enabled || '';
      try {
        await db.query("SELECT set_config('app.platform','true',true)");

        // 1. Ensure Google Gemini provider is registered
        const geminiProviderId = '00000000-0000-4000-8000-000000000001';
        await db.query(`
          INSERT INTO providers (id, name, adapter, secret_ref, enabled)
          VALUES ($1, 'Google Gemini Cloud', 'gemini', 'GEMINI_API_KEY', true)
          ON CONFLICT (name) DO UPDATE SET enabled = true, adapter = 'gemini', secret_ref = 'GEMINI_API_KEY'
        `, [geminiProviderId]);

        const gemini = (await db.query("SELECT id FROM providers WHERE name = 'Google Gemini Cloud'")).rows[0];

        // 2. Ensure Gemini Chat Model (gemini-1.5-flash)
        const geminiChatModelId = '00000000-0000-4000-8000-000000000002';
        await db.query(`
          INSERT INTO models (id, provider_id, name, capabilities, enabled)
          VALUES ($1, $2, 'gemini-1.5-flash', ARRAY['chat']::text[], true)
          ON CONFLICT (provider_id, name) DO UPDATE SET enabled = true
        `, [geminiChatModelId, gemini.id]);

        // 3. Ensure Gemini Embedding Model (text-embedding-004)
        const geminiEmbedModelId = '00000000-0000-4000-8000-000000000003';
        await db.query(`
          INSERT INTO models (id, provider_id, name, capabilities, enabled)
          VALUES ($1, $2, 'text-embedding-004', ARRAY['embedding']::text[], true)
          ON CONFLICT (provider_id, name) DO UPDATE SET enabled = true
        `, [geminiEmbedModelId, gemini.id]);

        // 4. Find preferred active chat model
        const chatModel = (await db.query(`
          SELECT m.id FROM models m
          JOIN providers p ON p.id = m.provider_id
          WHERE m.enabled = true AND p.enabled = true AND 'chat' = ANY(m.capabilities)
          ORDER BY (p.adapter = 'gemini') DESC, m.id LIMIT 1
        `)).rows[0];

        // 5. Find preferred active embedding model
        const embedModel = (await db.query(`
          SELECT m.id FROM models m
          JOIN providers p ON p.id = m.provider_id
          WHERE m.enabled = true AND p.enabled = true AND 'embedding' = ANY(m.capabilities)
          ORDER BY (p.adapter = 'gemini') DESC, m.id LIMIT 1
        `)).rows[0];

        // 6. Grant models to all active workspaces
        if (chatModel) {
          await db.query(`
            INSERT INTO model_grants (id, workspace_id, model_id, capability, active)
            SELECT gen_random_uuid(), w.id, $1, 'chat', true
            FROM workspaces w
            WHERE w.status = 'active'
            ON CONFLICT (workspace_id, model_id, capability) DO UPDATE SET active = true
          `, [chatModel.id]);
        }

        if (embedModel) {
          await db.query(`
            INSERT INTO model_grants (id, workspace_id, model_id, capability, active)
            SELECT gen_random_uuid(), w.id, $1, 'embedding', true
            FROM workspaces w
            WHERE w.status = 'active'
            ON CONFLICT (workspace_id, model_id, capability) DO UPDATE SET active = true
          `, [embedModel.id]);
        }

        console.log('[Platform 🤖] AI Platform Registry & Model Grants initialized for active workspaces ✅');
      } finally {
        await db.query("SELECT set_config('app.platform',$1,true)", [prev]);
      }
    });
  } catch (err: any) {
    console.warn('[Platform 🤖] AI Platform bootstrap deferred or encountered non-fatal error:', err?.message || err);
  }
}

/**
 * Grant default AI models to a specific newly created workspace
 */
export async function grantDefaultAiModels(db: PoolClient, workspaceId: string): Promise<void> {
  const prev = (await db.query("SELECT current_setting('app.platform',true) AS enabled")).rows[0]?.enabled || '';
  try {
    await db.query("SELECT set_config('app.platform','true',true)");
    const chatModel = (await db.query(`
      SELECT m.id FROM models m
      JOIN providers p ON p.id = m.provider_id
      WHERE m.enabled = true AND p.enabled = true AND 'chat' = ANY(m.capabilities)
      ORDER BY (p.adapter = 'gemini') DESC, m.id LIMIT 1
    `)).rows[0];

    const embedModel = (await db.query(`
      SELECT m.id FROM models m
      JOIN providers p ON p.id = m.provider_id
      WHERE m.enabled = true AND p.enabled = true AND 'embedding' = ANY(m.capabilities)
      ORDER BY (p.adapter = 'gemini') DESC, m.id LIMIT 1
    `)).rows[0];

    if (chatModel) {
      await db.query(`
        INSERT INTO model_grants (id, workspace_id, model_id, capability, active)
        VALUES (gen_random_uuid(), $1, $2, 'chat', true)
        ON CONFLICT (workspace_id, model_id, capability) DO UPDATE SET active = true
      `, [workspaceId, chatModel.id]);
    }

    if (embedModel) {
      await db.query(`
        INSERT INTO model_grants (id, workspace_id, model_id, capability, active)
        VALUES (gen_random_uuid(), $1, $2, 'embedding', true)
        ON CONFLICT (workspace_id, model_id, capability) DO UPDATE SET active = true
      `, [workspaceId, embedModel.id]);
    }
  } finally {
    await db.query("SELECT set_config('app.platform',$1,true)", [prev]);
  }
}
