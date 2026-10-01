import type {PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import type {KnowledgeChunk} from '../modules/knowledge/knowledge-chunks';

export interface PublishedChunkRow {
  chunk_index: number;
  version_id: string;
  title: string;
  content: string;
  item_id: string;
}

export interface ModelGrantRow {
  id: string;
  provider_id: string;
  adapter: string;
}

/**
 * Repository layer for AI Pipeline and Knowledge RAG operations.
 * Isolates SQL queries and ensures strict compliance with Clean Architecture and RLS.
 */
export class AiPipelineRepository {
  /**
   * Persists an ingested knowledge item and version, setting it as published.
   */
  static async insertIngestedDocument(
    db: PoolClient,
    workspaceId: string,
    userId: string,
    params: {
      itemId: string;
      versionId: string;
      title: string;
      content: string;
      contentHash: string;
      audience: 'PUBLIC' | 'INTERNAL';
      categoryId: string | null;
    }
  ): Promise<void> {
    await db.query(
      `INSERT INTO knowledge_items (id, workspace_id, active, audience, category_id, revision, created_by)
       VALUES ($1, $2, true, $3, $4, 1, $5)`,
      [params.itemId, workspaceId, params.audience, params.categoryId, userId]
    );

    await db.query(
      `INSERT INTO knowledge_versions (id, workspace_id, item_id, version_no, state, title, content, content_hash, created_by)
       VALUES ($1, $2, $3, 1, 'READY', $4, $5, $6, $7)`,
      [params.versionId, workspaceId, params.itemId, params.title, params.content, params.contentHash, userId]
    );

    await db.query(
      `UPDATE knowledge_items SET published_version_id = $1, draft_version_id = $1 WHERE id = $2 AND workspace_id = $3`,
      [params.versionId, params.itemId, workspaceId]
    );
  }

  /**
   * Inserts chunk records into knowledge_chunks.
   */
  static async insertKnowledgeChunks(
    db: PoolClient,
    workspaceId: string,
    versionId: string,
    chunks: KnowledgeChunk[]
  ): Promise<void> {
    for (const chunk of chunks) {
      const chunkHash = createHash('sha256').update(chunk.text).digest('hex');
      await db.query(
        `INSERT INTO knowledge_chunks (workspace_id, version_id, chunk_index, content, token_estimate, content_hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workspaceId, versionId, chunk.index, chunk.text, chunk.tokenEstimate, chunkHash]
      );
    }
  }

  /**
   * Retrieves active chunks belonging strictly to published versions in the scoped workspace.
   * Guarantees draft versions or rolled-back versions are never returned.
   */
  static async findPublishedChunks(
    db: PoolClient,
    workspaceId: string,
    audience: 'PUBLIC' | 'INTERNAL',
    maxFetch = 200
  ): Promise<PublishedChunkRow[]> {
    const res = await db.query<PublishedChunkRow>(
      `SELECT c.chunk_index, c.version_id, v.title, c.content, i.id as item_id
       FROM knowledge_chunks c
       JOIN knowledge_versions v ON v.id = c.version_id AND v.workspace_id = c.workspace_id AND v.state = 'READY'
       JOIN knowledge_items i ON i.id = v.item_id AND i.workspace_id = c.workspace_id AND i.active AND i.published_version_id = v.id
       WHERE c.workspace_id = $1 AND i.audience = $2
       ORDER BY c.chunk_index ASC
       LIMIT $3`,
      [workspaceId, audience, maxFetch]
    );
    return res.rows;
  }

  /**
   * Queries active chat model grants for the workspace under temporary platform configuration.
   */
  static async findChatModelGrant(
    db: PoolClient,
    workspaceId: string
  ): Promise<ModelGrantRow | undefined> {
    const previous =
      (await db.query("SELECT current_setting('app.platform', true) AS val")).rows[0]?.val || '';
    try {
      await db.query("SELECT set_config('app.platform', 'true', true)");
      const res = await db.query<ModelGrantRow>(
        `SELECT m.id, m.provider_id, p.adapter
         FROM model_grants g
         JOIN models m ON m.id = g.model_id
         JOIN providers p ON p.id = m.provider_id
         WHERE g.workspace_id = $1 AND g.capability = 'chat' AND g.active AND m.enabled AND p.enabled
         ORDER BY m.id LIMIT 1`,
        [workspaceId]
      );
      return res.rows[0];
    } finally {
      await db.query("SELECT set_config('app.platform', $1, true)", [previous]);
    }
  }
}
