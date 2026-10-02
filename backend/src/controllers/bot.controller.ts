import type {Request} from 'express';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import type {Identity} from '../middlewares/auth.middleware';
import {BotService} from '../services/bot.service';

const createTemplateSchema = z.object({
  shortcut: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(150),
  content: z.string().trim().min(1).max(4000),
  category: z.string().trim().min(1).max(50).optional().default('General'),
  media_urls: z.array(z.string().url().max(2000)).max(10).optional().default([]),
}).strict();

const updateTemplateSchema = z.object({
  shortcut: z.string().trim().min(1).max(50).optional(),
  title: z.string().trim().min(1).max(150).optional(),
  content: z.string().trim().min(1).max(4000).optional(),
  category: z.string().trim().min(1).max(50).optional(),
  media_urls: z.array(z.string().url().max(2000)).max(10).optional(),
  is_active: z.boolean().optional(),
}).strict();

const createMediaSchema = z.object({
  title: z.string().trim().min(1).max(150),
  file_url: z.string().url().max(2000),
  mime_type: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']),
  byte_size: z.number().int().positive().max(10 * 1024 * 1024), // 10MB max
  tags: z.array(z.string().trim().min(1).max(50)).max(10).optional().default([]),
}).strict();

export class BotController {
  // === TEMPLATES ===

  static async listTemplates(db: PoolClient, i: Identity, req: Request): Promise<any> {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    return BotService.listTemplates(db, i.workspace_id, category);
  }

  static async createTemplate(db: PoolClient, i: Identity, req: Request): Promise<any> {
    const payload = createTemplateSchema.parse(req.body);
    return BotService.createTemplate(db, i.workspace_id, i.user_id, payload);
  }

  static async updateTemplate(db: PoolClient, i: Identity, req: Request): Promise<any> {
    const id = z.string().uuid().parse(req.params.id);
    const payload = updateTemplateSchema.parse(req.body);
    return BotService.updateTemplate(db, i.workspace_id, id, payload);
  }

  static async deleteTemplate(db: PoolClient, i: Identity, req: Request): Promise<any> {
    const id = z.string().uuid().parse(req.params.id);
    return BotService.deleteTemplate(db, i.workspace_id, id);
  }

  // === MEDIA ASSETS ===

  static async listMedia(db: PoolClient, i: Identity): Promise<any> {
    return BotService.listMediaAssets(db, i.workspace_id);
  }

  static async createMedia(db: PoolClient, i: Identity, req: Request): Promise<any> {
    const payload = createMediaSchema.parse(req.body);
    return BotService.createMediaAsset(db, i.workspace_id, i.user_id, payload);
  }

  static async deleteMedia(db: PoolClient, i: Identity, req: Request): Promise<any> {
    const id = z.string().uuid().parse(req.params.id);
    return BotService.deleteMediaAsset(db, i.workspace_id, id);
  }
}
