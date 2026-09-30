import React, {useState, type FormEvent} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {api, ApiError} from '@/api/api';
import {navigate} from '../../hooks/usePath';
import {Link} from '../../components/common/Link';
import {
  Mail,
  Lock,
  User,
  Building2,
  Phone,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Zap,
  Bot,
  Users,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Star,
  Check,
  KeyRound
} from 'lucide-react';
import './auth.css';

interface AuthProps {
  path: string;
  onLogin: () => void;
}

export function Auth({path, onLogin}: AuthProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form values
  const [emailValue, setEmailValue] = useState('admin@gotek.vn');
  const [passwordValue, setPasswordValue] = useState('Admin@12345678');

  // Route state
  const isSignup = path === '/app/auth/signup';
  const isReset = path === '/app/auth/reset';
  const isVerify = path === '/app/auth/verify';
  const token = new URLSearchParams(location.search).get('token');

  const handleTabSwitch = (target: 'login' | 'signup') => {
    setError(null);
    setMessage('');
    if (target === 'signup') {
      navigate('/app/auth/signup');
    } else {
      navigate('/app/auth/login');
    }
  };

  // Submit Handler for Login
  async function handleLoginSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage('');
    const form = new FormData(e.currentTarget);

    try {
      await api('/auth/login', 'POST', {
        email: form.get('email'),
        password: form.get('password'),
        remember: form.get('remember') === 'on'
      });
      onLogin();
      const pending = sessionStorage.getItem('gotek.pending-invite');
      sessionStorage.removeItem('gotek.pending-invite');
      navigate(pending && pending.startsWith('/app/invitation#') ? pending : '/app/inbox');
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  }

  // Submit Handler for Signup
  async function handleSignupSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage('');
    const form = new FormData(e.currentTarget);

    try {
      await api('/auth/signup', 'POST', Object.fromEntries(form));
      setMessage('Đã nhận yêu cầu đăng ký. Vui lòng kiểm tra hướng dẫn xác thực rồi đăng nhập.');
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  }

  // Submit Handler for Reset / Verify
  async function handleResetOrVerifySubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage('');
    const form = new FormData(e.currentTarget);

    try {
      if (isVerify) {
        await api('/auth/verify', 'POST', {token});
        setMessage('Email đã được xác thực thành công. Bạn có thể đăng nhập ngay.');
      } else if (isReset) {
        if (token) {
          await api('/auth/reset', 'POST', {token, password: form.get('password')});
          setMessage('Mật khẩu đã được cập nhật thành công. Vui lòng đăng nhập lại.');
        } else {
          const r = await api('/auth/request-reset', 'POST', {email: form.get('email')});
          setMessage(r.message || 'Hướng dẫn khôi phục mật khẩu đã được gửi đến email của bạn.');
        }
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  }

  const fields = error instanceof ApiError ? (error.fields as Record<string, string[]>) : {};

  return (
    <div className="auth-page-container">
      {/* ====================================================================
          LEFT COLUMN: FORM PANEL (Clean, Modern SaaS Form)
          ==================================================================== */}
      <div className="auth-form-column">
        {/* Brand Header */}
        <div className="auth-form-header">
          <Link to="/app/auth/login" className="auth-brand-link">
            <img src="/gotek-logo.png" alt="GoTek" className="auth-brand-logo" />
            <span className="auth-brand-name">GoTek Solutions</span>
          </Link>
          <span className="auth-badge-pill">
            <ShieldCheck size={13} />
            Enterprise Tier
          </span>
        </div>

        {/* Central Form Container */}
        <div className="auth-form-body">
          <h1 className="auth-heading-title">
            {isReset
              ? 'Khôi phục mật khẩu'
              : isVerify
                ? 'Xác thực tài khoản'
                : isSignup
                  ? 'Bắt đầu với GoTek'
                  : 'Chào mừng trở lại'}
          </h1>
          <p className="auth-heading-desc">
            {isReset
              ? 'Nhập địa chỉ email để nhận liên kết thiết lập lại mật khẩu'
              : isVerify
                ? 'Xác minh quyền sở hữu hộp thư để truy cập hệ thống'
                : isSignup
                  ? 'Đăng ký không gian làm việc đa kênh với trợ lý AI và đội ngũ CSKH'
                  : 'Đăng nhập vào workspace để quản lý hội thoại, tri thức và nhân sự.'}
          </p>

          {/* Mode Switcher Tabs */}
          {!isReset && !isVerify && (
            <div className="auth-segmented-switch">
              <div className={`auth-segmented-pill ${isSignup ? 'signup' : ''}`} />
              <button
                type="button"
                className={`auth-segmented-btn ${!isSignup ? 'active' : ''}`}
                onClick={() => handleTabSwitch('login')}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                className={`auth-segmented-btn ${isSignup ? 'active' : ''}`}
                onClick={() => handleTabSwitch('signup')}
              >
                Tạo tài khoản mới
              </button>
            </div>
          )}

          {/* Feedback Notices */}
          {error && (
            <div className="auth-alert-box error" role="alert">
              <AlertCircle size={17} className="shrink-0 mt-0.5" />
              <div>{error.message}</div>
            </div>
          )}

          {message && (
            <div className="auth-alert-box success" role="status">
              <CheckCircle2 size={17} className="shrink-0 mt-0.5" />
              <div>{message}</div>
            </div>
          )}

          {/* Reset / Verify Mode */}
          {isReset || isVerify ? (
            <form onSubmit={handleResetOrVerifySubmit}>
              <fieldset disabled={busy} style={{border: 0, padding: 0, margin: 0}}>
                {isReset && !token && (
                  <div className="auth-input-group">
                    <label className="auth-label">Email tài khoản</label>
                    <div className="auth-input-container">
                      <div className="auth-input-icon">
                        <Mail size={16} />
                      </div>
                      <input
                        name="email"
                        type="email"
                        className="auth-input"
                        placeholder="ban@doanhnghiep.com"
                        required
                      />
                    </div>
                  </div>
                )}

                {isReset && token && (
                  <div className="auth-input-group">
                    <label className="auth-label">Mật khẩu mới (tối thiểu 12 ký tự)</label>
                    <div className="auth-input-container">
                      <div className="auth-input-icon">
                        <Lock size={16} />
                      </div>
                      <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        className="auth-input"
                        placeholder="••••••••••••"
                        required
                        minLength={12}
                      />
                    </div>
                  </div>
                )}

                <button type="submit" className="auth-primary-btn mt-4" disabled={busy}>
                  {busy ? 'Đang gửi yêu cầu...' : 'Xác nhận khôi phục'}
                </button>
              </fieldset>
            </form>
          ) : !isSignup ? (
            /* ==================== LOGIN FORM ==================== */
            <div>
              {/* Quick SSO Buttons */}
              <div className="auth-social-row">
                <button
                  type="button"
                  onClick={() => {
                    setEmailValue('admin@gotek.vn');
                    setPasswordValue('Admin@12345678');
                  }}
                  className="auth-social-btn"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.42l4.04-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span>Tiếp tục với Google Workspace</span>
                </button>
              </div>

              <div className="auth-divider-line">
                <span>hoặc đăng nhập bằng tài khoản</span>
              </div>

              {/* Quick Fill Demo Chips */}
              <div className="auth-quick-fill-box">
                <div className="auth-quick-fill-header">
                  <Sparkles size={13} className="text-amber-500" />
                  <span>Tài khoản mẫu trải nghiệm nhanh</span>
                </div>
                <div className="auth-quick-fill-tags">
                  <button
                    type="button"
                    className={`auth-quick-tag ${emailValue === 'admin@gotek.vn' ? 'active' : ''}`}
                    onClick={() => {
                      setEmailValue('admin@gotek.vn');
                      setPasswordValue('Admin@12345678');
                    }}
                  >
                    👑 Super Admin
                  </button>
                  <button
                    type="button"
                    className={`auth-quick-tag ${emailValue === 'alex.rivera@gotek.vn' ? 'active' : ''}`}
                    onClick={() => {
                      setEmailValue('alex.rivera@gotek.vn');
                      setPasswordValue('Admin@12345678');
                    }}
                  >
                    💼 Quản trị Lead
                  </button>
                  <button
                    type="button"
                    className={`auth-quick-tag ${emailValue === 'nam.do@gotek.vn' ? 'active' : ''}`}
                    onClick={() => {
                      setEmailValue('nam.do@gotek.vn');
                      setPasswordValue('Admin@12345678');
                    }}
                  >
                    🎧 Nhân viên CSKH
                  </button>
                </div>
              </div>

              <form onSubmit={handleLoginSubmit}>
                <fieldset disabled={busy} style={{border: 0, padding: 0, margin: 0}}>
                  {/* Email */}
                  <div className="auth-input-group">
                    <label className="auth-label">Email công việc</label>
                    <div className="auth-input-container">
                      <div className="auth-input-icon">
                        <Mail size={16} />
                      </div>
                      <input
                        id="login-email"
                        name="email"
                        type="email"
                        className="auth-input"
                        placeholder="ban@doanhnghiep.com"
                        required
                        value={emailValue}
                        onChange={(e) => setEmailValue(e.target.value)}
                      />
                    </div>
                    {fields.email && <span className="auth-field-error">{fields.email.join(' ')}</span>}
                  </div>

                  {/* Password */}
                  <div className="auth-input-group">
                    <div className="auth-label-row">
                      <label className="auth-label">Mật khẩu</label>
                      <Link to="/app/auth/reset" className="auth-forgot-btn">
                        Quên mật khẩu?
                      </Link>
                    </div>
                    <div className="auth-input-container">
                      <div className="auth-input-icon">
                        <Lock size={16} />
                      </div>
                      <input
                        id="login-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        className="auth-input"
                        placeholder="••••••••••••"
                        required
                        value={passwordValue}
                        onChange={(e) => setPasswordValue(e.target.value)}
                      />
                      <button
                        type="button"
                        className="auth-password-toggle-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {fields.password && <span className="auth-field-error">{fields.password.join(' ')}</span>}
                  </div>

                  {/* Remember Me */}
                  <div className="auth-checkbox-row">
                    <input id="remember" name="remember" type="checkbox" defaultChecked />
                    <label htmlFor="remember" className="auth-checkbox-label">
                      Ghi nhớ phiên đăng nhập trên thiết bị này
                    </label>
                  </div>

                  {/* Submit CTA */}
                  <button type="submit" className="auth-primary-btn" disabled={busy}>
                    {busy ? (
                      <span>Đang đăng nhập...</span>
                    ) : (
                      <>
                        <span>Đăng nhập vào Workspace</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </fieldset>
              </form>
            </div>
          ) : (
            /* ==================== SIGNUP FORM ==================== */
            <form onSubmit={handleSignupSubmit}>
              <fieldset disabled={busy} style={{border: 0, padding: 0, margin: 0}}>
                {/* Full name & Company */}
                <div className="auth-grid-row">
                  <div className="auth-input-group">
                    <label className="auth-label">Họ và tên</label>
                    <div className="auth-input-container">
                      <div className="auth-input-icon">
                        <User size={16} />
                      </div>
                      <input
                        name="fullName"
                        className="auth-input"
                        placeholder="Nguyễn Văn A"
                        required
                        maxLength={120}
                      />
                    </div>
                    {fields.fullName && <span className="auth-field-error">{fields.fullName.join(' ')}</span>}
                  </div>

                  <div className="auth-input-group">
                    <label className="auth-label">Tên doanh nghiệp</label>
                    <div className="auth-input-container">
                      <div className="auth-input-icon">
                        <Building2 size={16} />
                      </div>
                      <input
                        name="business"
                        className="auth-input"
                        placeholder="Công ty Cổ phần..."
                        required
                        maxLength={160}
                      />
                    </div>
                    {fields.business && <span className="auth-field-error">{fields.business.join(' ')}</span>}
                  </div>
                </div>

                {/* Email & Phone */}
                <div className="auth-grid-row">
                  <div className="auth-input-group">
                    <label className="auth-label">Email công việc</label>
                    <div className="auth-input-container">
                      <div className="auth-input-icon">
                        <Mail size={16} />
                      </div>
                      <input
                        name="email"
                        type="email"
                        className="auth-input"
                        placeholder="ban@congty.com"
                        required
                        maxLength={254}
                      />
                    </div>
                    {fields.email && <span className="auth-field-error">{fields.email.join(' ')}</span>}
                  </div>

                  <div className="auth-input-group">
                    <label className="auth-label">Số điện thoại</label>
                    <div className="auth-input-container">
                      <div className="auth-input-icon">
                        <Phone size={16} />
                      </div>
                      <input
                        name="phone"
                        type="tel"
                        className="auth-input"
                        placeholder="0912 345 678"
                        required
                        maxLength={25}
                      />
                    </div>
                    {fields.phone && <span className="auth-field-error">{fields.phone.join(' ')}</span>}
                  </div>
                </div>

                {/* Referral & Password */}
                <div className="auth-grid-row">
                  <div className="auth-input-group">
                    <label className="auth-label">Mã giới thiệu (tùy chọn)</label>
                    <div className="auth-input-container">
                      <div className="auth-input-icon">
                        <Sparkles size={16} />
                      </div>
                      <input
                        name="referral"
                        className="auth-input"
                        placeholder="Mã đối tác..."
                        maxLength={80}
                      />
                    </div>
                  </div>

                  <div className="auth-input-group">
                    <label className="auth-label">Mật khẩu (12+ ký tự)</label>
                    <div className="auth-input-container">
                      <div className="auth-input-icon">
                        <Lock size={16} />
                      </div>
                      <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        className="auth-input"
                        placeholder="••••••••••••"
                        required
                        minLength={12}
                        maxLength={128}
                      />
                      <button
                        type="button"
                        className="auth-password-toggle-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {fields.password && <span className="auth-field-error">{fields.password.join(' ')}</span>}
                  </div>
                </div>

                {/* Submit Signup */}
                <button type="submit" className="auth-primary-btn mt-2" disabled={busy}>
                  {busy ? (
                    <span>Đang tạo tài khoản...</span>
                  ) : (
                    <>
                      <span>Khởi tạo tài khoản doanh nghiệp</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </fieldset>
            </form>
          )}
        </div>

        {/* Footer Terms */}
        <div className="auth-form-footer">
          Bằng việc đăng nhập, bạn đồng ý với{' '}
          <a href="#" onClick={(e) => e.preventDefault()}>Điều khoản dịch vụ</a> và{' '}
          <a href="#" onClick={(e) => e.preventDefault()}>Chính sách quyền riêng tư</a> của GoTek.
        </div>
      </div>

      {/* ====================================================================
          RIGHT COLUMN: ENTERPRISE SHOWCASE PANEL (Dribbble/Pinterest Gold Standard)
          ==================================================================== */}
      <div className="auth-showcase-column">
        {/* Soft atmospheric gradient glows (No particles/No 3D) */}
        <div className="auth-showcase-glow-1" />
        <div className="auth-showcase-glow-2" />

        {/* Top Header Tag & Headline */}
        <div className="auth-showcase-top">
          <div className="auth-showcase-pill">
            <Sparkles size={14} className="text-blue-400" />
            <span>Nền tảng CSKH Tự Động & Handoff Nhân Sự</span>
          </div>
          <h2 className="auth-showcase-title">
            Phản hồi chuẩn xác từng chi tiết, đồng hành mượt mà cùng đội ngũ chuyên viên.
          </h2>
        </div>

        {/* Central Realistic Live Chat Mockup Card */}
        <div className="auth-preview-card">
          <div className="auth-preview-header">
            <div className="auth-preview-client">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                alt="Client"
                className="auth-preview-avatar"
              />
              <div>
                <p className="auth-preview-name">Techcombank Corporate Banking</p>
                <p className="auth-preview-meta">Kênh: Web Widget · Khách hàng VIP</p>
              </div>
            </div>
            <span className="auth-preview-status">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Đang hoạt động
            </span>
          </div>

          {/* Chat Messages */}
          <div className="auth-chat-stream">
            <div className="auth-chat-msg customer">
              Xin chào GoTek, bên mình muốn phương án tích hợp gói vay doanh nghiệp và chính sách bảo lãnh vào Core Banking trước Quý 4.
            </div>

            <div className="auth-chat-msg ai">
              Dạ chào anh/chị, GoTek đã liên kết dữ liệu quy trình thẩm định tín dụng và biểu phí mới nhất của Techcombank, sẵn sàng tích hợp an toàn qua pgvector.
              <div>
                <span className="auth-chat-citation">
                  📄 Quy_trinh_tin_dung_2026.pdf (Mục 4.2)
                </span>
              </div>
            </div>

            <div className="auth-handoff-banner">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span>Chuyên viên Nguyễn Minh Tuấn đã tiếp nhận hội thoại</span>
              </div>
              <span className="font-mono text-[11px] text-blue-300">1.2s SLA</span>
            </div>
          </div>

          {/* Metrics Bento Row */}
          <div className="auth-metrics-row">
            <div className="auth-metric-item">
              <div className="auth-metric-value">99.8%</div>
              <div className="auth-metric-label">CSAT Hài lòng</div>
            </div>
            <div className="auth-metric-item">
              <div className="auth-metric-value">&lt; 35s</div>
              <div className="auth-metric-label">Tốc độ giải quyết</div>
            </div>
            <div className="auth-metric-item">
              <div className="auth-metric-value">Zero-Leak</div>
              <div className="auth-metric-label">Bảo mật Tenant RLS</div>
            </div>
          </div>
        </div>

        {/* Customer Testimonial Quote */}
        <div className="auth-testimonial-box">
          <p className="auth-testimonial-quote">
            “GoTek Chatbot giúp đội ngũ chúng tôi giải phóng hơn 70% thời gian xử lý thủ công, đồng thời nâng tỷ lệ phản hồi tức thì lên 99.8% mà vẫn giữ được sự ấm áp, chu đáo.”
          </p>
          <div className="auth-testimonial-author">
            <div className="auth-author-info">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80"
                alt="Đỗ Hoàng Nam"
                className="auth-author-avatar"
              />
              <div>
                <p className="auth-author-name">Đỗ Hoàng Nam</p>
                <p className="auth-author-role">Giám đốc Vận hành CSKH, FPT Software</p>
              </div>
            </div>
            <div className="auth-stars">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={14} fill="#fbbf24" strokeWidth={0} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
