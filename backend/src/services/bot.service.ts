import type {PoolClient} from 'pg';
import {BotRepository, type BotTemplateRecord, type BotMediaRecord} from '../repositories/bot.repository';
import {HttpError} from '../core/security';

export class BotService {
  // === TEMPLATES ===

  static async listTemplates(db: PoolClient, workspaceId: string, category?: string): Promise<BotTemplateRecord[]> {
    return BotRepository.listTemplates(db, workspaceId, category);
  }

  static async createTemplate(
    db: PoolClient,
    workspaceId: string,
    userId: string,
    input: {shortcut: string; title: string; content: string; category?: string; media_urls?: string[]}
  ): Promise<BotTemplateRecord> {
    const cleanShortcut = input.shortcut.trim().toLowerCase().startsWith('/')
      ? input.shortcut.trim().toLowerCase()
      : `/${input.shortcut.trim().toLowerCase()}`;

    const existing = await BotRepository.getTemplateByShortcut(db, workspaceId, cleanShortcut);
    if (existing) {
      throw new HttpError(409, 'SHORTCUT_EXISTS');
    }

    return BotRepository.createTemplate(db, workspaceId, userId, {
      ...input,
      shortcut: cleanShortcut,
    });
  }

  static async updateTemplate(
    db: PoolClient,
    workspaceId: string,
    id: string,
    input: Partial<{shortcut: string; title: string; content: string; category: string; media_urls: string[]; is_active: boolean}>
  ): Promise<BotTemplateRecord> {
    if (input.shortcut) {
      const cleanShortcut = input.shortcut.trim().toLowerCase().startsWith('/')
        ? input.shortcut.trim().toLowerCase()
        : `/${input.shortcut.trim().toLowerCase()}`;

      const existing = await BotRepository.getTemplateByShortcut(db, workspaceId, cleanShortcut);
      if (existing && existing.id !== id) {
        throw new HttpError(409, 'SHORTCUT_EXISTS');
      }
      input.shortcut = cleanShortcut;
    }

    const updated = await BotRepository.updateTemplate(db, workspaceId, id, input);
    if (!updated) {
      throw new HttpError(404, 'TEMPLATE_NOT_FOUND');
    }
    return updated;
  }

  static async deleteTemplate(db: PoolClient, workspaceId: string, id: string): Promise<{ok: true}> {
    const success = await BotRepository.deleteTemplate(db, workspaceId, id);
    if (!success) {
      throw new HttpError(404, 'TEMPLATE_NOT_FOUND');
    }
    return {ok: true};
  }

  // === MEDIA ASSETS ===

  static async listMediaAssets(db: PoolClient, workspaceId: string): Promise<BotMediaRecord[]> {
    return BotRepository.listMediaAssets(db, workspaceId);
  }

  static async createMediaAsset(
    db: PoolClient,
    workspaceId: string,
    userId: string,
    input: {title: string; file_url: string; mime_type: string; byte_size: number; tags?: string[]}
  ): Promise<BotMediaRecord> {
    return BotRepository.createMediaAsset(db, workspaceId, userId, input);
  }

  static async deleteMediaAsset(db: PoolClient, workspaceId: string, id: string): Promise<{ok: true}> {
    const success = await BotRepository.deleteMediaAsset(db, workspaceId, id);
    if (!success) {
      throw new HttpError(404, 'MEDIA_NOT_FOUND');
    }
    return {ok: true};
  }
}
