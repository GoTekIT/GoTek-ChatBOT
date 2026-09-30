import type {Request} from 'express';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {requireRole} from '../core/security';
import {WorkspaceService} from '../services/workspace.service';
import {uidSchema, successResponse} from './auth.controller';
import type {Identity} from '../middlewares/auth.middleware';

export class WorkspaceController {
  static async getWorkspace(db: PoolClient, i: Identity): Promise<any> {
    return WorkspaceService.getWorkspace(db, i.workspace_id);
  }

  static async updateWorkspace(db: PoolClient, i: Identity, req: Request): Promise<any> {
    requireRole(i.role);
    const data = z
      .object({
        name: z.string().trim().min(2).max(160),
        language: z.enum(['vi', 'en'])
      })
      .strict()
      .parse(req.body);

    return WorkspaceService.updateWorkspace(db, i.workspace_id, i.user_id, data);
  }

  static async switchWorkspace(db: PoolClient, i: Identity, req: Request): Promise<any> {
    const {workspaceId} = z.object({workspaceId: uidSchema}).strict().parse(req.body);
    await WorkspaceService.switchWorkspace(db, i.user_id, workspaceId, i.token_hash);
    return successResponse;
  }

  static async getAiUsage(db: PoolClient, i: Identity, req: Request): Promise<any> {
    requireRole(i.role);
    const filter = z
      .object({
        from: z.string().datetime({offset: true}).optional(),
        to: z.string().datetime({offset: true}).optional()
      })
      .strict()
      .parse({from: req.query.from, to: req.query.to});

    return WorkspaceService.getAiUsage(db, i.workspace_id, filter);
  }

  static async getUsage(db: PoolClient, i: Identity): Promise<any> {
    requireRole(i.role);
    return WorkspaceService.getUsage(db);
  }
}
