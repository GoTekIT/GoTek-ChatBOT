import {realtimeAuthorization} from '../services/realtime-authorization.service';
import {Router} from 'express';
import {authed, identity, Identity} from '../middlewares/auth.middleware';
import {transaction} from '../core/db';
import {uuid} from '../core/security';
import {realtimeHub} from '../modules/chat/realtime';
import {
  inboxResumeAi,
  inboxList,
  inboxMessages,
  inboxTakeover,
  inboxSend,
  inboxSetStatus,
  inboxTyping,
  access
} from '../modules/chat/inbox';

export const inboxRouter = Router();

inboxRouter.get(
  '/conversations',
  authed((db, i, req) => inboxList(db, i, req.query))
);

inboxRouter.get(
  '/conversations/:id/messages',
  authed((db, i, req) => inboxMessages(db, i, String(req.params.id), req.query.after))
);

inboxRouter.post(
  '/conversations/:id/resume-ai',
  authed((db, i, req) => inboxResumeAi(db, i, String(req.params.id), req.body))
);

inboxRouter.post(
  '/conversations/:id/takeover',
  authed((db, i, req) => inboxTakeover(db, i, String(req.params.id), req.body))
);

inboxRouter.post(
  '/conversations/:id/messages',
  authed((db, i, req) => inboxSend(db, i, String(req.params.id), req.body))
);

inboxRouter.patch(
  '/conversations/:id/status',
  authed((db, i, req) => inboxSetStatus(db, i, String(req.params.id), req.body))
);

inboxRouter.post(
  '/conversations/:id/typing',
  authed((db, i, req) => inboxTyping(db, i, String(req.params.id), req.body))
);

/**
 * Realtime Server-Sent Events (SSE) Stream for a single conversation.
 * Streams: message:new, typing, conversation:takeover, conversation:status, ai:token
 */
inboxRouter.get('/conversations/:id/stream', async (req, res, next) => {
  try {
    let actor: Identity;
    await transaction(async db => {
      actor = await identity(db, req);
      await access(db, actor, String(req.params.id));
    });
    realtimeHub.register(uuid(), actor!.workspace_id, res, req, realtimeAuthorization(req, actor!.workspace_id), String(req.params.id));
  } catch (e) {
    next(e);
  }
});

/**
 * Realtime Server-Sent Events (SSE) Stream for the whole workspace inbox.
 * Streams: inbox:message_sent, inbox:takeover, inbox:status_changed, inbox:ai_resumed
 */
inboxRouter.get('/stream', async (req, res, next) => {
  try {
    let actor: Identity;
    await transaction(async db => {
      actor = await identity(db, req);
    });
    realtimeHub.register(uuid(), actor!.workspace_id, res, req, realtimeAuthorization(req, actor!.workspace_id));
  } catch (e) {
    next(e);
  }
});

