import type {PoolClient} from 'pg';
import {scope} from '../core/db';
import {uuid, opaque, digest, HttpError, audit} from '../core/security';
import {WorkspaceRepository} from '../repositories/workspace.repository';
import {MembershipRepository} from '../repositories/membership.repository';
import {InvitationRepository} from '../repositories/invitation.repository';
import {UserRepository} from '../repositories/user.repository';
import {requirePermission} from '../core/authorization';

export class MemberService {
  static async listMembers(db: PoolClient, workspaceId: string): Promise<any[]> {
    return MembershipRepository.listMembersByWorkspace(db, workspaceId);
  }

  static async updateMember(
    db: PoolClient,
    workspaceId: string,
    operatorId: string,
    operatorRole: string,
    targetUserId: string,
    data: {role: 'Owner' | 'Admin' | 'Agent'; active: boolean}
  ): Promise<void> {
    requirePermission(operatorRole, 'members.manage');
    await WorkspaceRepository.lockById(db, workspaceId);

    const current = await MembershipRepository.find(db, workspaceId, targetUserId);
    if (!current) throw new HttpError(404, 'NOT_FOUND');

    if ((current.role === 'Owner' || data.role === 'Owner') && operatorRole !== 'Owner') {
      throw new HttpError(403, 'FORBIDDEN');
    }

    if (
      current.role === 'Owner' &&
      current.active &&
      (data.role !== 'Owner' || !data.active) &&
      (await MembershipRepository.countActiveOwnersExcept(db, workspaceId, targetUserId)) === 0
    ) {
      throw new HttpError(409, 'LAST_OWNER');
    }

    if (!current.active && data.active) {
      const ws = await WorkspaceRepository.findById(db, workspaceId);
      const limit = ws?.seat_limit ?? 5;
      const count = await MembershipRepository.countActive(db, workspaceId);
      if (count >= limit) throw new HttpError(409, 'SEAT_LIMIT');
    }

    await MembershipRepository.update(db, workspaceId, targetUserId, data);
    await audit(db, workspaceId, operatorId, 'membership.updated', targetUserId);
  }

  static async listInvitations(db: PoolClient): Promise<any[]> {
    return InvitationRepository.listRecent(db);
  }

  static async createInvitation(
    db: PoolClient,
    workspaceId: string,
    operatorId: string,
    data: {email: string; role: 'Admin' | 'Agent'}
  ): Promise<{id: string; status: string}> {
    const ws = await WorkspaceRepository.lockById(db, workspaceId);
    const seatLimit = ws?.seat_limit ?? 5;

    await InvitationRepository.revokeExpired(db);

    const activeMembers = await MembershipRepository.countActive(db, workspaceId);
    const activeInvites = await InvitationRepository.countActive(db, workspaceId);

    if (activeMembers + activeInvites >= seatLimit) {
      throw new HttpError(409, 'SEAT_LIMIT');
    }

    const alreadyMember = await MembershipRepository.hasActiveMembership(db, workspaceId, data.email);
    if (alreadyMember) {
      throw new HttpError(409, 'ALREADY_MEMBER');
    }

    const id = uuid();
    const token = opaque();
    await InvitationRepository.create(db, {
      id,
      workspaceId,
      email: data.email,
      role: data.role,
      tokenHash: digest(token)
    });

    await db.query("INSERT INTO local_delivery(id, user_id, kind, payload) VALUES($1, $2, 'invite', $3)", [
      uuid(),
      operatorId,
      JSON.stringify({token, workspaceId, email: data.email})
    ]);

    await audit(db, workspaceId, operatorId, 'invitation.created', id);
    return {id, status: 'local_delivery'};
  }

  static async revokeInvitation(db: PoolClient, workspaceId: string, operatorId: string, inviteId: string): Promise<void> {
    const revoked = await InvitationRepository.revoke(db, inviteId);
    if (!revoked) throw new HttpError(404, 'NOT_FOUND');
    await audit(db, workspaceId, operatorId, 'invitation.revoked', inviteId);
  }

  static async acceptInvitation(db: PoolClient, userId: string, workspaceId: string, token: string): Promise<void> {
    await scope(db, workspaceId);
    const ws = await WorkspaceRepository.lockById(db, workspaceId);
    if (!ws || ws.status !== 'active') {
      throw new HttpError(400, 'INVALID_OR_EXPIRED_TOKEN');
    }

    const invite = await InvitationRepository.findValidForUpdate(db, digest(token));
    const user = await UserRepository.findById(db, userId);

    if (!invite || invite.email !== user?.email || !user?.verified_at) {
      throw new HttpError(400, 'INVALID_OR_EXPIRED_TOKEN');
    }

    const existing = await MembershipRepository.find(db, workspaceId, userId);
    if (existing?.active) {
      throw new HttpError(409, 'ALREADY_MEMBER');
    }

    const activeCount = await MembershipRepository.countActive(db, workspaceId);
    if (activeCount >= ws.seat_limit) {
      throw new HttpError(409, 'SEAT_LIMIT');
    }

    await MembershipRepository.upsert(db, workspaceId, userId, invite.role);
    await InvitationRepository.markAccepted(db, invite.id);
    await audit(db, workspaceId, userId, 'invitation.accepted', invite.id);
  }
}
