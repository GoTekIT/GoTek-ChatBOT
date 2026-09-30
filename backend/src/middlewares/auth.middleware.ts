import type {Request, Response} from 'express';
import type {PoolClient} from 'pg';
import {transaction, scope} from '../core/db';
import {digest, HttpError} from '../core/security';
import {isWorkspaceRole, requirePermission, type WorkspacePermission} from '../core/authorization';

export interface Identity {
  user_id: string;
  workspace_id: string;
  role: string;
  token_hash: string;
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/'
};

export function extractToken(req: Request): string | undefined {
  if (req.cookies?.gotek_session) {
    return req.cookies.gotek_session;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return undefined;
}

export async function identity(db: PoolClient, req: Request): Promise<Identity> {
  const raw = extractToken(req);
  if (!raw) {
    throw new HttpError(401, 'UNAUTHENTICATED');
  }

  const found = await db.query(
    `SELECT s.*, m.role 
     FROM sessions s 
     JOIN memberships m ON m.user_id = s.user_id AND m.workspace_id = s.workspace_id AND m.active 
     WHERE s.token_hash = $1 AND s.expires_at > now() 
     FOR UPDATE OF s FOR SHARE OF m`,
    [digest(raw)]
  );

  if (!found.rowCount) {
    throw new HttpError(401, 'UNAUTHENTICATED');
  }

  const i = found.rows[0] as Identity;
  if (!isWorkspaceRole(i.role)) throw new HttpError(403, 'FORBIDDEN');
  await scope(db, i.workspace_id);

  const activeWorkspace = await db.query(
    "SELECT 1 FROM workspaces WHERE id = $1 AND status = 'active'",
    [i.workspace_id]
  );
  if (!activeWorkspace.rowCount) {
    throw new HttpError(403, 'WORKSPACE_DISABLED');
  }

  return i;
}

export const authed = (fn: (db: PoolClient, i: Identity, req: Request) => Promise<unknown>, permission?: WorkspacePermission) => {
  return async (req: Request, res: Response) => {
    const result = await transaction(async db => {
      const id = await identity(db, req);
      if (permission) requirePermission(id.role, permission);
      return fn(db, id, req);
    });
    res.json(result);
  };
};
