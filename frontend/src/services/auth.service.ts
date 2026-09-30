import {api, getStoredToken, setStoredToken, removeStoredToken} from '../api/api';

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  verifiedAt?: string | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: string;
  status: string;
}

export interface MeResponse {
  user: UserProfile;
  workspaces: WorkspaceSummary[];
  workspaceId: string;
  role: string;
  platformAdmin: boolean;
}

export interface LoginParams {
  email: string;
  password: string;
  remember?: boolean;
}

export interface LoginResponse {
  ok: boolean;
  token?: string;
  user?: UserProfile;
  workspaceId?: string;
}

export interface SignupParams {
  fullName: string;
  business: string;
  email: string;
  phone: string;
  password: string;
  referral?: string;
}

export interface ChangePasswordParams {
  currentPassword: string;
  newPassword: string;
}

const USER_KEY = 'gotek_user_profile';

export class AuthService {
  /**
   * Đăng nhập người dùng vào workspace
   */
  static async login(params: LoginParams): Promise<LoginResponse> {
    const res = await api('/auth/login', 'POST', {
      email: params.email.trim(),
      password: params.password,
      remember: Boolean(params.remember)
    });

    if (res.token) {
      setStoredToken(res.token);
    }
    if (res.user) {
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      } catch {
        // Ignore storage error
      }
    }

    return res;
  }

  /**
   * Đăng ký tài khoản doanh nghiệp mới
   */
  static async signup(params: SignupParams): Promise<{ok: boolean; message?: string}> {
    return api('/auth/signup', 'POST', {
      fullName: params.fullName.trim(),
      business: params.business.trim(),
      email: params.email.trim(),
      phone: params.phone.trim(),
      password: params.password,
      referral: params.referral?.trim() || undefined
    });
  }

  /**
   * Đăng xuất phiên làm việc hiện tại
   */
  static async logout(): Promise<void> {
    try {
      await api('/auth/logout', 'POST', {});
    } catch {
      // Ignore network errors on logout
    } finally {
      this.clearSession();
    }
  }

  /**
   * Lấy thông tin phiên làm việc hiện tại (me, workspaces, role)
   */
  static async getMe(): Promise<MeResponse> {
    const res = await api('/me');
    if (res?.user) {
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      } catch {
        // Ignore
      }
    }
    return res;
  }

  /**
   * Đổi mật khẩu tài khoản
   */
  static async changePassword(params: ChangePasswordParams): Promise<{ok: boolean}> {
    return api('/auth/change-password', 'POST', {
      currentPassword: params.currentPassword,
      newPassword: params.newPassword
    });
  }

  /**
   * Yêu cầu gửi email đặt lại mật khẩu
   */
  static async requestReset(email: string): Promise<{ok: boolean; message?: string; token?: string}> {
    return api('/auth/request-reset', 'POST', {
      email: email.trim()
    });
  }

  /**
   * Đặt lại mật khẩu với token khôi phục
   */
  static async resetPassword(token: string, newPassword: string): Promise<{ok: boolean}> {
    const res = await api('/auth/reset', 'POST', {
      token: token.trim(),
      password: newPassword
    });
    this.clearSession();
    return res;
  }

  /**
   * Xác thực tài khoản email
   */
  static async verifyEmail(token: string): Promise<{ok: boolean}> {
    return api('/auth/verify', 'POST', {
      token: token.trim()
    });
  }

  /**
   * Gửi lại mã/liên kết xác thực email
   */
  static async resendVerification(): Promise<{ok: boolean}> {
    return api('/auth/resend', 'POST', {});
  }

  /**
   * Chuyển đổi workspace đang hoạt động
   */
  static async switchWorkspace(workspaceId: string): Promise<{ok: boolean}> {
    return api('/workspace/switch', 'POST', {workspaceId});
  }

  /**
   * Kiểm tra xem đang có token đăng nhập hay không
   */
  static isAuthenticated(): boolean {
    return Boolean(getStoredToken());
  }

  /**
   * Lấy thông tin user đã lưu trong localStorage (cached)
   */
  static getCachedUser(): UserProfile | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Dọn dẹp session ở client
   */
  static clearSession(): void {
    removeStoredToken();
    try {
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem('gotek_session_token');
    } catch {
      // Ignore
    }
  }
}
