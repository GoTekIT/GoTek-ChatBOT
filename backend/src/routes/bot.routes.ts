import {Router} from 'express';
import {authed} from '../middlewares/auth.middleware';
import {BotController} from '../controllers/bot.controller';

export const botRouter = Router();

// Templates (Canned Responses / Mẫu câu cho bot & agent)
botRouter.get(
  '/bot/templates',
  authed((db, i, req) => BotController.listTemplates(db, i, req), 'inbox.use')
);

botRouter.post(
  '/bot/templates',
  authed((db, i, req) => BotController.createTemplate(db, i, req), 'knowledge.manage')
);

botRouter.patch(
  '/bot/templates/:id',
  authed((db, i, req) => BotController.updateTemplate(db, i, req), 'knowledge.manage')
);

botRouter.delete(
  '/bot/templates/:id',
  authed((db, i, req) => BotController.deleteTemplate(db, i, req), 'knowledge.manage')
);

// Media Assets (Hình ảnh cho phép đính kèm trong hội thoại / bot)
botRouter.get(
  '/bot/media',
  authed((db, i) => BotController.listMedia(db, i), 'inbox.use')
);

botRouter.post(
  '/bot/media',
  authed((db, i, req) => BotController.createMedia(db, i, req), 'knowledge.manage')
);

botRouter.delete(
  '/bot/media/:id',
  authed((db, i, req) => BotController.deleteMedia(db, i, req), 'knowledge.manage')
);
