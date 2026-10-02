import type {Request} from 'express';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {requireRole} from '../core/security';
import {MemberService} from '../services/member.service';
import {emailSchema, uidSchema, successResponse} from './auth.controller';
import type {Identity} from '../middlewares/auth.middleware';

export class MemberController {
  static async listMembers(db: PoolClient, i: Identity): Promise<any> {
    requireRole(i.role);
    return MemberService.listMembers(db, i.workspace_id);
  }

  static async updateMember(db: PoolClient, i: Identity, req: Request): Promise<any> {
    requireRole(i.role);
    const targetUserId = uidSchema.parse(req.params.id);
    const data = z
      .object({
        role: z.enum(['Owner', 'Admin', 'Agent']),
        active: z.boolean()
      })
      .strict()
      .parse(req.body);

    await MemberService.updateMember(db, i.workspace_id, i.user_id, i.role, targetUserId, data);
    return successResponse;
  }

  static async listInvitations(db: PoolClient, i: Identity): Promise<any> {
    requireRole(i.role);
    return MemberService.listInvitations(db);
  }

  /** Any authenticated user can query their own pending invitations */
  static async listPendingInvitations(db: PoolClient, i: Identity): Promise<any> {
    return MemberService.listPendingForUser(db, i.user_id);
  }

  static async createInvitation(db: PoolClient, i: Identity, req: Request): Promise<any> {
    requireRole(i.role);
    const data = z
      .object({
        email: emailSchema,
        role: z.enum(['Admin', 'Agent'])
      })
      .strict()
      .parse(req.body);

    return MemberService.createInvitation(db, i.workspace_id, i.user_id, data);
  }

  static async revokeInvitation(db: PoolClient, i: Identity, req: Request): Promise<any> {
    requireRole(i.role);
    const inviteId = uidSchema.parse(req.params.id);
    await MemberService.revokeInvitation(db, i.workspace_id, i.user_id, inviteId);
    return successResponse;
  }

  static async acceptInvitation(db: PoolClient, i: Identity, req: Request): Promise<any> {
    const data = z
      .object({
        workspaceId: uidSchema,
        token: z.string().min(30).max(100)
      })
      .strict()
      .parse(req.body);

    await MemberService.acceptInvitation(db, i.user_id, data.workspaceId, data.token);
    return successResponse;
  }

  /** In-app accept: uses invitation ID — no raw token required, email ownership enforced in service */
  static async acceptInvitationInApp(db: PoolClient, i: Identity, req: Request): Promise<any> {
    const { invitationId } = z.object({ invitationId: uidSchema }).strict().parse(req.body);
    await MemberService.acceptInvitationById(db, i.user_id, invitationId);
    return successResponse;
  }
}
