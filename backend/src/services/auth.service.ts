import {randomInt} from 'node:crypto';
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
import {publishTask, QUEUES} from '../core/rabbitmq.js';
import {workspacePermissions} from '../core/authorization';

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
  ): Promise<{token: string; maxAge: number; user: any; workspaceId: string}> {
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

    const safeUser = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      verifiedAt: user.verified_at
    };

    return {token, maxAge, user: safeUser, workspaceId: activeWorkspaceId};
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
      user: user ? {id: user.id, email: user.email, fullName: user.full_name,
        full_name: user.full_name, phone: user.phone, verifiedAt: user.verified_at,
        verified_at: user.verified_at} : null,
      workspaces,
      workspaceId: currentWorkspaceId,
      role: currentRole,
      permissions: workspacePermissions(currentRole),
      platformAdmin: isPlatform
    };
  }

  static async logout(db: PoolClient, sessionToken?: string): Promise<void> {
    if (sessionToken) {
      await SessionRepository.deleteByTokenHash(db, digest(sessionToken));
    }
  }

  static async changePassword(
    db: PoolClient,
    userId: string,
    data: {currentPassword: string; newPassword: string},
    currentSessionToken?: string
  ): Promise<void> {
    await UserRepository.lockById(db, userId);
    const user = await UserRepository.findById(db, userId);
    if (!user) {
      throw new HttpError(404, 'USER_NOT_FOUND');
    }

    const isValid = await verifyPassword(user.password_hash, data.currentPassword);
    if (!isValid) {
      throw new HttpError(400, 'INCORRECT_CURRENT_PASSWORD');
    }

    const hash = await hashPassword(data.newPassword);
    await UserRepository.updatePassword(db, userId, hash);

    if (currentSessionToken) {
      const currentHash = digest(currentSessionToken);
      await db.query('DELETE FROM sessions WHERE user_id = $1 AND token_hash != $2', [userId, currentHash]);
    } else {
      await SessionRepository.deleteByUserId(db, userId);
    }
  }

  static async requestReset(db: PoolClient, email: string): Promise<string | undefined> {
    const user = await UserRepository.findByEmailForUpdate(db, email);
    if (!user) return undefined;

    const hasRecent = await ChallengeRepository.hasRecent(db, user.id, 'reset', 60);
    if (hasRecent) return undefined;

    const token = opaque();
    await db.query('UPDATE challenges SET used_at=now() WHERE user_id=$1 AND kind=$2 AND used_at IS NULL', [user.id, 'reset']);
    await db.query("INSERT INTO challenges(id,user_id,kind,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+'30 minutes'::interval)", [uuid(), user.id, 'reset', digest(token)]);
    await db.query('INSERT INTO local_delivery(id,user_id,kind,payload) VALUES($1,$2,$3,$4)', [uuid(), user.id, 'reset', JSON.stringify({token})]);

    return token;
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

  /**
   * Sinh mã OTP 6 số ngẫu nhiên, lưu hash vào challenges và đẩy task vào RabbitMQ queue
   */
  static async sendOtp(
    db: PoolClient,
    email: string,
    purpose: 'reset' | 'login' | 'verify' = 'reset'
  ): Promise<{ok: boolean; message: string}> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await UserRepository.findByEmailForUpdate(db, normalizedEmail);

    if (!user) {
      // Bảo mật chống dò email nhưng nếu purpose là login/reset có thể báo rõ ở dev
      throw new HttpError(404, 'USER_NOT_FOUND');
    }

    // Cooldown 60s
    const hasRecent = await ChallengeRepository.hasRecent(db, user.id, 'otp', 60);
    if (hasRecent) {
      throw new HttpError(429, 'RESEND_COOLDOWN');
    }

    // Sinh mã OTP 6 chữ số
    const otp = randomInt(100000, 1000000).toString();
    const tokenHash = digest(normalizedEmail + ':' + otp);

    // Vô hiệu hóa OTP cũ
    await db.query(
      'UPDATE challenges SET used_at = now() WHERE user_id = $1 AND kind = $2 AND used_at IS NULL',
      [user.id, 'otp']
    );

    // Lưu challenge OTP mới (hết hạn trong 5 phút)
    await db.query(
      "INSERT INTO challenges (id, user_id, kind, token_hash, expires_at) VALUES ($1, $2, 'otp', $3, now() + '5 minutes'::interval)",
      [uuid(), user.id, tokenHash]
    );

    // BẮN TASK VÀO RABBITMQ QUEUE 'gotek.notifications'
    const published = await publishTask(QUEUES.NOTIFICATIONS, {
      type: 'EMAIL_OTP',
      email: normalizedEmail,
      code: otp,
      purpose,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });

    if (!published) {
      throw new HttpError(503, 'OTP_DELIVERY_UNAVAILABLE');
    }

    return {
      ok: true,
      message: 'Mã OTP đã được gửi đến email của bạn.'
    };
  }

  /**
   * Xác thực mã OTP 6 số và đặt lại mật khẩu hoặc đăng nhập
   */
  static async verifyOtp(
    db: PoolClient,
    data: {
      email: string;
      otp: string;
      newPassword?: string;
    }
  ): Promise<{ok: boolean; message?: string; token?: string; user?: any; workspaceId?: string}> {
    const normalizedEmail = data.email.trim().toLowerCase();
    const tokenHash = digest(normalizedEmail + ':' + data.otp.trim());

    const result = await db.query(
      `SELECT c.*, u.id as user_id, u.email, u.full_name, u.phone 
       FROM challenges c 
       JOIN users u ON u.id = c.user_id 
       WHERE c.token_hash = $1 AND c.kind = 'otp' AND c.used_at IS NULL AND c.expires_at > now() 
       FOR UPDATE OF c`,
      [tokenHash]
    );

    if (!result.rowCount) {
      throw new HttpError(400, 'INVALID_OR_EXPIRED_TOKEN');
    }

    const row = result.rows[0];
    await db.query('UPDATE challenges SET used_at = now() WHERE id = $1', [row.id]);

    if (data.newPassword) {
      // Đặt lại mật khẩu với OTP
      const hash = await hashPassword(data.newPassword);
      await UserRepository.updatePassword(db, row.user_id, hash);
      await SessionRepository.deleteByUserId(db, row.user_id);
      return {ok: true, message: 'Đặt lại mật khẩu thành công!'};
    }

    // Đăng nhập trực tiếp bằng OTP
    const memberships = await MembershipRepository.listActiveByUser(db, row.user_id);
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
    const maxAge = 24 * 60 * 60 * 1000;
    await SessionRepository.create(db, digest(token), row.user_id, activeWorkspaceId, `${maxAge} milliseconds`);
    await audit(db, activeWorkspaceId, row.user_id, 'auth.login_otp', row.user_id);

    return {
      ok: true,
      token,
      workspaceId: activeWorkspaceId,
      user: {
        id: row.user_id,
        email: row.email,
        fullName: row.full_name,
        phone: row.phone
      }
    };
  }

  /**
   * Đăng nhập hoặc Khởi tạo tài khoản tự động bằng Google SSO
   */
  static async googleAuth(
    db: PoolClient,
    data: {
      email: string;
      name: string;
      googleId: string;
      picture?: string;
    }
  ): Promise<{token: string; maxAge: number; user: any; workspaceId: string}> {
    const normalizedEmail = data.email.trim().toLowerCase();
    let user = await UserRepository.findByEmailForUpdate(db, normalizedEmail);

    let userId: string;
    let activeWorkspaceId: string | undefined;

    if (!user) {
      // Tạo user mới nếu chưa tồn tại
      userId = uuid();
      const workspaceId = uuid();
      await scope(db, workspaceId);

      const dummyHash = await hashPassword('oauth-google-' + uuid());
      await UserRepository.create(db, {
        id: userId,
        email: normalizedEmail,
        fullName: data.name || normalizedEmail.split('@')[0],
        phone: '+84000000000',
        passwordHash: dummyHash
      });

      // Đánh dấu verified luôn vì email từ Google đã được xác thực
      await UserRepository.markVerified(db, userId);

      const workspaceName = `${data.name || normalizedEmail.split('@')[0]}'s Workspace`;
      await WorkspaceRepository.create(db, workspaceId, workspaceName);

      const defaultAiQuota = Number.parseInt(process.env.GOTEK_DEFAULT_AI_RESPONSE_QUOTA || '1000', 10);
      await WorkspaceRepository.createDefaultAiQuota(db, workspaceId, defaultAiQuota);
      await MembershipRepository.create(db, workspaceId, userId, 'Owner');

      activeWorkspaceId = workspaceId;
    } else {
      userId = user.id;
      const memberships = await MembershipRepository.listActiveByUser(db, userId);
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
    }

    // Ghi nhận liên kết oauth_identities
    await db.query(
      `INSERT INTO oauth_identities (id, user_id, provider, provider_user_id, email)
       VALUES ($1, $2, 'google', $3, $4)
       ON CONFLICT (provider, provider_user_id) DO NOTHING`,
      [uuid(), userId, data.googleId, normalizedEmail]
    );

    const token = opaque();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 ngày
    await SessionRepository.create(db, digest(token), userId, activeWorkspaceId, `${maxAge} milliseconds`);
    await audit(db, activeWorkspaceId, userId, 'auth.google_login', userId);

    const safeUser = {
      id: userId,
      email: normalizedEmail,
      fullName: data.name || normalizedEmail.split('@')[0],
      phone: user?.phone || '+84000000000',
      picture: data.picture
    };

    return {token, maxAge, user: safeUser, workspaceId: activeWorkspaceId};
  }
}
