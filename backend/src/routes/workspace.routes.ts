import {Router} from 'express';
import {authed} from '../middlewares/auth.middleware';
import {WorkspaceController} from '../controllers/workspace.controller';

export const workspaceRouter = Router();

workspaceRouter.post('/workspaces',
  authed((db, identity, req) => WorkspaceController.createWorkspace(db, identity, req))
);

workspaceRouter.get(
  '/workspace',
  authed((db, identity) => WorkspaceController.getWorkspace(db, identity))
);

workspaceRouter.patch(
  '/workspace',
  authed((db, identity, req) => WorkspaceController.updateWorkspace(db, identity, req), 'workspace.manage')
);

workspaceRouter.post(
  '/workspace/switch',
  authed((db, identity, req) => WorkspaceController.switchWorkspace(db, identity, req))
);

workspaceRouter.get(
  '/usage/ai',
  authed((db, identity, req) => WorkspaceController.getAiUsage(db, identity, req), 'usage.read')
);

workspaceRouter.get(
  '/usage',
  authed((db, identity) => WorkspaceController.getUsage(db, identity), 'usage.read')
);
