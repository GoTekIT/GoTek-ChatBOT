import type {PoolClient} from 'pg';
import {uuid} from '../core/security';

export interface BotTemplateRecord {
  id: string;
  workspace_id: string;
  shortcut: string;
  title: string;
  content: string;
  category: string;
  media_urls: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BotMediaRecord {
  id: string;
  workspace_id: string;
  title: string;
  file_url: string;
  mime_type: string;
  byte_size: number;
  tags: string[];
  created_by: string;
  created_at: string;
}

export class BotRepository {
  // === TEMPLATES / CANNED RESPONSES ===

  static async listTemplates(db: PoolClient, workspaceId: string, category?: string): Promise<BotTemplateRecord[]> {
    const params: any[] = [workspaceId];
    let query = 'SELECT * FROM bot_templates WHERE workspace_id = $1';
    if (category) {
      params.push(category);
      query += ' AND category = $2';
    }
    query += ' ORDER BY shortcut ASC';
    const {rows} = await db.query(query, params);
    return rows;
  }

  static async getTemplateById(db: PoolClient, workspaceId: string, id: string): Promise<BotTemplateRecord | null> {
    const {rows} = await db.query(
      'SELECT * FROM bot_templates WHERE workspace_id = $1 AND id = $2',
      [workspaceId, id]
    );
    return rows[0] || null;
  }

  static async getTemplateByShortcut(db: PoolClient, workspaceId: string, shortcut: string): Promise<BotTemplateRecord | null> {
    const {rows} = await db.query(
      'SELECT * FROM bot_templates WHERE workspace_id = $1 AND lower(shortcut) = lower($2)',
      [workspaceId, shortcut]
    );
    return rows[0] || null;
  }

  static async createTemplate(
    db: PoolClient,
    workspaceId: string,
    userId: string,
    data: {shortcut: string; title: string; content: string; category?: string; media_urls?: string[]}
  ): Promise<BotTemplateRecord> {
    const id = uuid();
    const {rows} = await db.query(
      `INSERT INTO bot_templates(id, workspace_id, shortcut, title, content, category, media_urls, created_by)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        workspaceId,
        data.shortcut,
        data.title,
        data.content,
        data.category || 'General',
        data.media_urls || [],
        userId,
      ]
    );
    return rows[0];
  }

  static async updateTemplate(
    db: PoolClient,
    workspaceId: string,
    id: string,
    data: Partial<{shortcut: string; title: string; content: string; category: string; media_urls: string[]; is_active: boolean}>
  ): Promise<BotTemplateRecord | null> {
    const fields: string[] = [];
    const params: any[] = [workspaceId, id];

    if (data.shortcut !== undefined) {
      params.push(data.shortcut);
      fields.push(`shortcut = $${params.length}`);
    }
    if (data.title !== undefined) {
      params.push(data.title);
      fields.push(`title = $${params.length}`);
    }
    if (data.content !== undefined) {
      params.push(data.content);
      fields.push(`content = $${params.length}`);
    }
    if (data.category !== undefined) {
      params.push(data.category);
      fields.push(`category = $${params.length}`);
    }
    if (data.media_urls !== undefined) {
      params.push(data.media_urls);
      fields.push(`media_urls = $${params.length}`);
    }
    if (data.is_active !== undefined) {
      params.push(data.is_active);
      fields.push(`is_active = $${params.length}`);
    }

    if (fields.length === 0) return this.getTemplateById(db, workspaceId, id);

    fields.push('updated_at = now()');
    const {rows} = await db.query(
      `UPDATE bot_templates SET ${fields.join(', ')} WHERE workspace_id = $1 AND id = $2 RETURNING *`,
      params
    );
    return rows[0] || null;
  }

  static async deleteTemplate(db: PoolClient, workspaceId: string, id: string): Promise<boolean> {
    const {rowCount} = await db.query(
      'DELETE FROM bot_templates WHERE workspace_id = $1 AND id = $2',
      [workspaceId, id]
    );
    return (rowCount ?? 0) > 0;
  }

  // === BOT MEDIA ASSETS ===

  static async listMediaAssets(db: PoolClient, workspaceId: string): Promise<BotMediaRecord[]> {
    const {rows} = await db.query(
      'SELECT * FROM bot_media_assets WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspaceId]
    );
    return rows;
  }

  static async createMediaAsset(
    db: PoolClient,
    workspaceId: string,
    userId: string,
    data: {title: string; file_url: string; mime_type: string; byte_size: number; tags?: string[]}
  ): Promise<BotMediaRecord> {
    const id = uuid();
    const {rows} = await db.query(
      `INSERT INTO bot_media_assets(id, workspace_id, title, file_url, mime_type, byte_size, tags, created_by)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        workspaceId,
        data.title,
        data.file_url,
        data.mime_type,
        data.byte_size,
        data.tags || [],
        userId,
      ]
    );
    return rows[0];
  }

  static async deleteMediaAsset(db: PoolClient, workspaceId: string, id: string): Promise<boolean> {
    const {rowCount} = await db.query(
      'DELETE FROM bot_media_assets WHERE workspace_id = $1 AND id = $2',
      [workspaceId, id]
    );
    return (rowCount ?? 0) > 0;
  }
}
