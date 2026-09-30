import type {Request} from 'express';
import {transaction} from '../core/db';
import {HttpError} from '../core/security';
import {requirePermission} from '../core/authorization';
import {identity} from '../middlewares/auth.middleware';
import {access} from '../modules/chat/inbox';

/** Check current session and channel access for every delivery, not just connect. */
export function realtimeAuthorization(req: Request, workspaceId: string, closeOnConversationDenied = false) {
  return async (deliver: () => void, conversationId?: string): Promise<void> => {
    await transaction(async db => {
      const actor = await identity(db, req);
      if (actor.workspace_id !== workspaceId) throw new HttpError(401, 'SESSION_CHANGED');
      requirePermission(actor.role, 'inbox.use');
      if (conversationId) {
        try {
          await access(db, actor, conversationId);
        } catch (error) {
          // An inaccessible conversation does not invalidate a workspace subscription.
          if (error instanceof HttpError && error.status === 404 && !closeOnConversationDenied) return;
          throw error;
        }
      }
      // Keep membership/channel locks until the authorized write is complete.
      deliver();
    });
  };
}
