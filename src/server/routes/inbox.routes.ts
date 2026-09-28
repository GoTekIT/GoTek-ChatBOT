import {Router} from 'express';
import {authed} from '../middlewares/auth.middleware';
import {
  inboxResumeAi,
  inboxList,
  inboxMessages,
  inboxTakeover,
  inboxSend,
  inboxSetStatus
} from '../inbox';

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
