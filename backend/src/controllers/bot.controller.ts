import {uidSchema} from '../dtos/common.dto';
import {createTemplateSchema,updateTemplateSchema,createMediaSchema} from '../dtos/bot.dto';
import type {Request} from 'express';
import type {PoolClient} from 'pg';
import type {Identity} from '../middlewares/auth.middleware';
import {BotService} from '../services/bot.service';

export class BotController {
  // === TEMPLATES ===

  static async listTemplates(db: PoolClient, i: Identity, req: Request): ReturnType<typeof BotService.listTemplates> {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    return BotService.listTemplates(db, i.workspace_id, category);
  }

  static async createTemplate(db: PoolClient, i: Identity, req: Request): ReturnType<typeof BotService.createTemplate> {
    const payload = createTemplateSchema.parse(req.body);
    return BotService.createTemplate(db, i.workspace_id, i.user_id, payload);
  }

  static async updateTemplate(db: PoolClient, i: Identity, req: Request): ReturnType<typeof BotService.updateTemplate> {
    const id = uidSchema.parse(req.params.id);
    const payload = updateTemplateSchema.parse(req.body);
    return BotService.updateTemplate(db, i.workspace_id, id, payload);
  }

  static async deleteTemplate(db: PoolClient, i: Identity, req: Request): ReturnType<typeof BotService.deleteTemplate> {
    const id = uidSchema.parse(req.params.id);
    return BotService.deleteTemplate(db, i.workspace_id, id);
  }

  // === MEDIA ASSETS ===

  static async listMedia(db: PoolClient, i: Identity): ReturnType<typeof BotService.listMediaAssets> {
    return BotService.listMediaAssets(db, i.workspace_id);
  }

  static async createMedia(db: PoolClient, i: Identity, req: Request): ReturnType<typeof BotService.createMediaAsset> {
    const payload = createMediaSchema.parse(req.body);
    return BotService.createMediaAsset(db, i.workspace_id, i.user_id, payload);
  }

  static async deleteMedia(db: PoolClient, i: Identity, req: Request): ReturnType<typeof BotService.deleteMediaAsset> {
    const id = uidSchema.parse(req.params.id);
    return BotService.deleteMediaAsset(db, i.workspace_id, id);
  }
}
