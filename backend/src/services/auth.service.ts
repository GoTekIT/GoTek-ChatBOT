import type {PoolClient} from 'pg';
import {scope} from '../core/db';
import {
  uuid,
  opaque,
  digest,
  hashPassword,
  verifyPassword,
  HttpError,
  audit,
  challenge
} from '../core/security';
import {UserRepository} from '../repositories/user.repository';
import {WorkspaceRepository} from '../repositories/workspace.repository';
import {MembershipRepository} from '../repositories/membership.repository';
import {SessionRepository} from '../repositories/session.repository';
import {ChallengeRepository} from '../repositories/challenge.repository';

export class AuthService {
  static async signup(
    db: PoolClient,
    data: {
      fullName: string;
      business: string;
      email: string;
      phone: string;
      referral?: string;
      password: string;
    }
  ): Promise<void> {
    const hash = await hashPassword(data.password);

    await UserRepository.lockEmail(db, data.email);
    const existing = await UserRepository.findByEmail(db, data.email);
    if (existing) {
      // Privacy protection: do not reveal user existence
      return;
    }

    const userId = uuid();
    const workspaceId = uuid();
    await scope(db, workspaceId);

    await UserRepository.create(db, {
      id: userId,
      email: data.email,
      fullName: data.fullName,
      phone: data.phone,
      passwordHash: hash
    });

    await WorkspaceRepository.create(db, workspaceId, data.business);

    const defaultAiQuota = Number.parseInt(process.env.GOTEK_DEFAULT_AI_RESPONSE_QUOTA || '1000', 10);
    if (!Number.isSafeInteger(defaultAiQuota) || defaultAiQuota < 0) {
      throw new HttpError(500, 'INVALID_DEFAULT_QUOTA');
    }

    await WorkspaceRepository.createDefaultAiQuota(db, workspaceId, defaultAiQuota);
    await MembershipRepository.create(db, workspaceId, userId, 'Owner');
    await challenge(db, userId, 'verify');
    await audit(db, workspaceId, userId, 'workspace.created', workspaceId);
  }

  static async login(
    db: PoolClient,
    data: {email: string; password: string; remember?: boolean}
  ): Promise<{token: string; maxAge: number}> {
    const user = await UserRepository.findByEmailForUpdate(db, data.email);
    if (!user) {
      await hashPassword('nonexistent-account-dummy');
      throw new HttpError(401, 'INVALID_CREDENTIALS');
    }

    const isValid = await verifyPassword(user.password_hash, data.password);
    if (!isValid) {
      throw new HttpError(401, 'INVALID_CREDENTIALS');
    }

    const memberships = await MembershipRepository.listActiveByUser(db, user.id);
    let activeWorkspaceId: string | undefined;

    for (const m of memberships) {
      await scope(db, m.workspace_id);
      if (await WorkspaceRepository.isActive(db, m.workspace_id)) {
        activeWorkspaceId = m.workspace_id;
        break;
      }
    }

    if (!activeWorkspaceId) {
      throw new HttpError(403, 'NO_MEMBERSHIP');
    }

    const token = opaque();
    const maxAge = (data.remember ? 30 : 1) * 24 * 60 * 60 * 1000;
    await SessionRepository.create(db, digest(token), user.id, activeWorkspaceId, `${maxAge} milliseconds`);
    await audit(db, activeWorkspaceId, user.id, 'auth.login', user.id);

    return {token, maxAge};
  }

  static async getMe(
    db: PoolClient,
    userId: string,
    currentWorkspaceId: string,
    currentRole: string
  ): Promise<any> {
    const user = await UserRepository.findById(db, userId);
    const memberships = await MembershipRepository.listActiveByUser(db, userId);

    const workspaces = [];
    for (const m of memberships) {
      await scope(db, m.workspace_id);
      const ws = await WorkspaceRepository.findById(db, m.workspace_id);
      if (ws) {
        workspaces.push({...ws, role: m.role});
      }
    }

    await scope(db, currentWorkspaceId);
    const isPlatform = await MembershipRepository.isPlatformAdmin(db, userId);

    return {
      user,
      workspaces,
      workspaceId: currentWorkspaceId,
      role: currentRole,
      platformAdmin: isPlatform
    };
  }

  static async logout(db: PoolClient, sessionToken?: string): Promise<void> {
    if (sessionToken) {
      await SessionRepository.deleteByTokenHash(db, digest(sessionToken));
    }
  }

  static async requestReset(db: PoolClient, email: string): Promise<void> {
    const user = await UserRepository.findByEmailForUpdate(db, email);
    if (!user) return;

    const hasRecent = await ChallengeRepository.hasRecent(db, user.id, 'reset', 60);
    if (hasRecent) return;

    await challenge(db, user.id, 'reset');
  }

  static async resetPassword(db: PoolClient, token: string, newPassword: string): Promise<void> {
    const tokenHash = digest(token);
    const candidate = await ChallengeRepository.findCandidate(db, tokenHash);
    if (!candidate) {
      throw new HttpError(400, 'INVALID_OR_EXPIRED_TOKEN');
    }

    await UserRepository.lockById(db, candidate.user_id);
    const consumed = await ChallengeRepository.consume(db, tokenHash, 'reset');
    if (!consumed) {
      throw new HttpError(400, 'INVALID_OR_EXPIRED_TOKEN');
    }

    const hash = await hashPassword(newPassword);
    await UserRepository.updatePassword(db, consumed.user_id, hash);
    await SessionRepository.deleteByUserId(db, consumed.user_id);
  }

  static async verifyEmail(db: PoolClient, token: string): Promise<void> {
    const tokenHash = digest(token);
    const candidate = await ChallengeRepository.findCandidate(db, tokenHash);
    if (!candidate) {
      throw new HttpError(400, 'INVALID_OR_EXPIRED_TOKEN');
    }

    await UserRepository.lockById(db, candidate.user_id);
    const consumed = await ChallengeRepository.consume(db, tokenHash, 'verify');
    if (!consumed) {
      throw new HttpError(400, 'INVALID_OR_EXPIRED_TOKEN');
    }

    await UserRepository.markVerified(db, consumed.user_id);
  }

  static async resendVerification(db: PoolClient, userId: string): Promise<boolean> {
    await UserRepository.lockById(db, userId);
    const user = await UserRepository.findById(db, userId);

    if (user?.verified_at) {
      return true; // Already verified
    }

    const hasRecent = await ChallengeRepository.hasRecent(db, userId, 'verify', 60);
    if (hasRecent) {
      throw new HttpError(429, 'RESEND_COOLDOWN');
    }

    await challenge(db, userId, 'verify');
    return false;
  }
}
