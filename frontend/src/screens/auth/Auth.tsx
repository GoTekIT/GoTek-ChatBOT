import React, {useState, type FormEvent} from 'react';
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
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Star,
  Check,
  FileText
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

  const handleSocialLogin = (provider: 'google' | 'facebook') => {
    setError(null);
    if (provider === 'google') {
      setEmailValue('admin@gotek.vn');
      setPasswordValue('Admin@12345678');
      setMessage('Đã kết nối tài khoản Google Workspace (admin@gotek.vn). Bấm "Đăng nhập" để tiếp tục.');
    } else {
      setEmailValue('alex.rivera@gotek.vn');
      setPasswordValue('Admin@12345678');
      setMessage('Đã liên kết tài khoản Facebook Business (alex.rivera@gotek.vn). Bấm "Đăng nhập" để tiếp tục.');
    }
  };

  const fields = error instanceof ApiError ? (error.fields as Record<string, string[]>) : {};

  return (
    <div className="auth-outer-screen">
      {/* Dynamic Animated Ambient Background */}
      <div className="auth-ambient-canvas" aria-hidden="true">
        <div className="ambient-orb orb-1" />
        <div className="ambient-orb orb-2" />
        <div className="ambient-orb orb-3" />
        <div className="ambient-pattern-grid" />
      </div>

      {/* Main Centered Floating Card (Occupies ~75-80% viewport) */}
      <div className="auth-card-wrapper">
        {/* ====================================================================
            LEFT PANEL: COMPACT & ELEGANT AUTH FORM
            ==================================================================== */}
        <div className="auth-card-left">
          {/* Brand & Tier Header */}
          <div className="auth-card-header">
            <Link to="/app/auth/login" className="auth-brand-badge">
              <img src="/gotek-logo.png" alt="GoTek" className="auth-brand-icon" />
              <span className="auth-brand-title">GoTek Solutions</span>
            </Link>
            <div className="auth-status-pill">
              <ShieldCheck size={13} className="text-blue-500" />
              <span>Enterprise Tier</span>
            </div>
          </div>

          {/* Form Content */}
          <div className="auth-form-content">
            <div className="auth-title-block">
              <h1 className="auth-main-heading">
                {isReset
                  ? 'Khôi phục mật khẩu'
                  : isVerify
                    ? 'Xác thực tài khoản'
                    : isSignup
                      ? 'Bắt đầu với GoTek'
                      : 'Chào mừng trở lại'}
              </h1>
              <p className="auth-sub-heading">
                {isReset
                  ? 'Nhập địa chỉ email để nhận liên kết đặt lại mật khẩu'
                  : isVerify
                    ? 'Xác minh quyền sở hữu hộp thư để truy cập hệ thống'
                    : isSignup
                      ? 'Tạo tài khoản quản lý chatbot đa kênh cho doanh nghiệp'
                      : 'Đăng nhập vào workspace để quản trị hội thoại và nhân sự.'}
              </p>
            </div>

            {/* Segmented Tab Switcher */}
            {!isReset && !isVerify && (
              <div className="auth-tab-group">
                <button
                  type="button"
                  className={`auth-tab-item ${!isSignup ? 'active' : ''}`}
                  onClick={() => handleTabSwitch('login')}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  className={`auth-tab-item ${isSignup ? 'active' : ''}`}
                  onClick={() => handleTabSwitch('signup')}
                >
                  Tạo tài khoản mới
                </button>
              </div>
            )}

            {/* Feedback Alerts */}
            {error && (
              <div className="auth-msg-alert error" role="alert">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error.message}</span>
              </div>
            )}

            {message && (
              <div className="auth-msg-alert success" role="status">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {/* Reset / Verify Form */}
            {isReset || isVerify ? (
              <form onSubmit={handleResetOrVerifySubmit} className="auth-actual-form">
                <fieldset disabled={busy} className="auth-fieldset">
                  {isReset && !token && (
                    <div className="auth-field-group">
                      <label className="auth-field-label">Email tài khoản</label>
                      <div className="auth-input-shell">
                        <Mail size={16} className="auth-input-prefix" />
                        <input
                          name="email"
                          type="email"
                          className="auth-input-control"
                          placeholder="ban@doanhnghiep.com"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {isReset && token && (
                    <div className="auth-field-group">
                      <label className="auth-field-label">Mật khẩu mới (tối thiểu 12 ký tự)</label>
                      <div className="auth-input-shell">
                        <Lock size={16} className="auth-input-prefix" />
                        <input
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          className="auth-input-control"
                          placeholder="••••••••••••"
                          required
                          minLength={12}
                        />
                      </div>
                    </div>
                  )}

                  <button type="submit" className="auth-action-btn" disabled={busy}>
                    {busy ? 'Đang gửi yêu cầu...' : 'Xác nhận khôi phục'}
                  </button>
                </fieldset>
              </form>
            ) : !isSignup ? (
              /* ==================== LOGIN FORM ==================== */
              <div className="auth-login-flow">
                {/* Social Login Buttons: Google & Facebook */}
                <div className="auth-social-grid">
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('google')}
                    className="auth-social-tile"
                    title="Đăng nhập nhanh với Google Workspace"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.42l4.04-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                    </svg>
                    <span>Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSocialLogin('facebook')}
                    className="auth-social-tile"
                    title="Đăng nhập nhanh với Facebook Business"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" className="shrink-0">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span>Facebook</span>
                  </button>
                </div>

                <div className="auth-separator">
                  <span>hoặc email công việc</span>
                </div>

                {/* Quick Demo Selector */}
                <div className="auth-demo-bar">
                  <span className="auth-demo-label">Thử nhanh:</span>
                  <div className="auth-demo-chips">
                    <button
                      type="button"
                      className={`auth-chip ${emailValue === 'admin@gotek.vn' ? 'active' : ''}`}
                      onClick={() => {
                        setEmailValue('admin@gotek.vn');
                        setPasswordValue('Admin@12345678');
                      }}
                    >
                      👑 Admin
                    </button>
                    <button
                      type="button"
                      className={`auth-chip ${emailValue === 'alex.rivera@gotek.vn' ? 'active' : ''}`}
                      onClick={() => {
                        setEmailValue('alex.rivera@gotek.vn');
                        setPasswordValue('Admin@12345678');
                      }}
                    >
                      💼 Lead
                    </button>
                    <button
                      type="button"
                      className={`auth-chip ${emailValue === 'nam.do@gotek.vn' ? 'active' : ''}`}
                      onClick={() => {
                        setEmailValue('nam.do@gotek.vn');
                        setPasswordValue('Admin@12345678');
                      }}
                    >
                      🎧 CSKH
                    </button>
                  </div>
                </div>

                <form onSubmit={handleLoginSubmit} className="auth-actual-form">
                  <fieldset disabled={busy} className="auth-fieldset">
                    {/* Email */}
                    <div className="auth-field-group">
                      <label className="auth-field-label">Email</label>
                      <div className="auth-input-shell">
                        <Mail size={16} className="auth-input-prefix" />
                        <input
                          id="login-email"
                          name="email"
                          type="email"
                          className="auth-input-control"
                          placeholder="admin@gotek.vn"
                          required
                          value={emailValue}
                          onChange={(e) => setEmailValue(e.target.value)}
                        />
                      </div>
                      {fields.email && <span className="auth-field-error">{fields.email.join(' ')}</span>}
                    </div>

                    {/* Password */}
                    <div className="auth-field-group">
                      <div className="auth-label-split">
                        <label className="auth-field-label">Mật khẩu</label>
                        <Link to="/app/auth/reset" className="auth-forgot-link">
                          Quên mật khẩu?
                        </Link>
                      </div>
                      <div className="auth-input-shell">
                        <Lock size={16} className="auth-input-prefix" />
                        <input
                          id="login-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          className="auth-input-control"
                          placeholder="••••••••••••"
                          required
                          value={passwordValue}
                          onChange={(e) => setPasswordValue(e.target.value)}
                        />
                        <button
                          type="button"
                          className="auth-password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {fields.password && <span className="auth-field-error">{fields.password.join(' ')}</span>}
                    </div>

                    {/* Remember me */}
                    <div className="auth-remember-row">
                      <label className="auth-checkbox-wrap">
                        <input id="remember" name="remember" type="checkbox" defaultChecked />
                        <span className="auth-checkbox-text">Ghi nhớ đăng nhập</span>
                      </label>
                    </div>

                    {/* Submit Button */}
                    <button type="submit" className="auth-action-btn" disabled={busy}>
                      {busy ? (
                        <span>Đang xử lý...</span>
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
              <form onSubmit={handleSignupSubmit} className="auth-actual-form">
                <fieldset disabled={busy} className="auth-fieldset">
                  <div className="auth-twin-row">
                    <div className="auth-field-group">
                      <label className="auth-field-label">Họ và tên</label>
                      <div className="auth-input-shell">
                        <User size={16} className="auth-input-prefix" />
                        <input
                          name="fullName"
                          className="auth-input-control"
                          placeholder="Nguyễn Văn A"
                          required
                          maxLength={120}
                        />
                      </div>
                      {fields.fullName && <span className="auth-field-error">{fields.fullName.join(' ')}</span>}
                    </div>

                    <div className="auth-field-group">
                      <label className="auth-field-label">Tên doanh nghiệp</label>
                      <div className="auth-input-shell">
                        <Building2 size={16} className="auth-input-prefix" />
                        <input
                          name="business"
                          className="auth-input-control"
                          placeholder="Công ty CP..."
                          required
                          maxLength={160}
                        />
                      </div>
                      {fields.business && <span className="auth-field-error">{fields.business.join(' ')}</span>}
                    </div>
                  </div>

                  <div className="auth-twin-row">
                    <div className="auth-field-group">
                      <label className="auth-field-label">Email công việc</label>
                      <div className="auth-input-shell">
                        <Mail size={16} className="auth-input-prefix" />
                        <input
                          name="email"
                          type="email"
                          className="auth-input-control"
                          placeholder="ban@congty.com"
                          required
                          maxLength={254}
                        />
                      </div>
                      {fields.email && <span className="auth-field-error">{fields.email.join(' ')}</span>}
                    </div>

                    <div className="auth-field-group">
                      <label className="auth-field-label">Số điện thoại</label>
                      <div className="auth-input-shell">
                        <Phone size={16} className="auth-input-prefix" />
                        <input
                          name="phone"
                          type="tel"
                          className="auth-input-control"
                          placeholder="0912 345 678"
                          required
                          maxLength={25}
                        />
                      </div>
                      {fields.phone && <span className="auth-field-error">{fields.phone.join(' ')}</span>}
                    </div>
                  </div>

                  <div className="auth-twin-row">
                    <div className="auth-field-group">
                      <label className="auth-field-label">Mã giới thiệu (tùy chọn)</label>
                      <div className="auth-input-shell">
                        <Sparkles size={16} className="auth-input-prefix" />
                        <input
                          name="referral"
                          className="auth-input-control"
                          placeholder="Mã đối tác..."
                          maxLength={80}
                        />
                      </div>
                    </div>

                    <div className="auth-field-group">
                      <label className="auth-field-label">Mật khẩu (12+ ký tự)</label>
                      <div className="auth-input-shell">
                        <Lock size={16} className="auth-input-prefix" />
                        <input
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          className="auth-input-control"
                          placeholder="••••••••••••"
                          required
                          minLength={12}
                          maxLength={128}
                        />
                        <button
                          type="button"
                          className="auth-password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {fields.password && <span className="auth-field-error">{fields.password.join(' ')}</span>}
                    </div>
                  </div>

                  <button type="submit" className="auth-action-btn" disabled={busy}>
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

          {/* Card Footer Policy */}
          <div className="auth-card-footer">
            Bằng việc tiếp tục, bạn đồng ý với{' '}
            <a href="#" onClick={(e) => e.preventDefault()}>Điều khoản</a> và{' '}
            <a href="#" onClick={(e) => e.preventDefault()}>Chính sách bảo mật</a> của GoTek.
          </div>
        </div>

        {/* ====================================================================
            RIGHT PANEL: DRIBBBLE-STYLE LUXURY FEATURE SHOWCASE
            ==================================================================== */}
        <div className="auth-card-right">
          {/* Subtle decorative inner ambient glow */}
          <div className="showcase-glow" />

          <div className="showcase-inner-container">
            {/* Tag badge */}
            <div className="showcase-badge">
              <Sparkles size={13} className="text-cyan-400" />
              <span>Nền tảng CSKH Đa Kênh Thế Hệ Mới</span>
            </div>

            {/* Headline */}
            <h2 className="showcase-title">
              Tự động hóa thông minh. Trải nghiệm chạm cảm xúc.
            </h2>
            <p className="showcase-desc">
              Hợp nhất AI trợ lý tra cứu tài liệu với đội ngũ tư vấn viên, nâng cao chất lượng phục vụ và tối ưu chi phí vận hành.
            </p>

            {/* Simulated Live Chat Interactive Bubble */}
            <div className="showcase-chat-card">
              <div className="chat-card-top">
                <div className="chat-client-info">
                  <div className="chat-client-avatar">TC</div>
                  <div>
                    <div className="chat-client-name">Techcombank Corporate</div>
                    <div className="chat-client-sub">Khách hàng Doanh nghiệp VIP</div>
                  </div>
                </div>
                <div className="chat-live-badge">
                  <span className="live-dot" />
                  <span>Trực tuyến</span>
                </div>
              </div>

              <div className="chat-convo-stream">
                <div className="chat-bubble user">
                  Bên mình muốn thẩm định hạn mức bảo lãnh và gói vay trước Quý 4.
                </div>

                <div className="chat-bubble bot">
                  <div className="bot-tag">
                    <Sparkles size={11} />
                    <span>GoTek AI Assistant</span>
                  </div>
                  <p>
                    Dạ anh/chị, GoTek đã đối soát biểu phí và quy trình thẩm định bảo lãnh Q4. Đã sẵn sàng hồ sơ tín dụng mẫu!
                  </p>
                  <div className="chat-citation-tag">
                    <FileText size={12} className="text-blue-400" />
                    <span>Quy_trinh_tin_dung_2026.pdf (Mục 4.2)</span>
                  </div>
                </div>

                <div className="chat-handoff-pill">
                  <div className="handoff-dot" />
                  <span>Chuyên viên Tuấn Anh đã tiếp nhận hội thoại</span>
                  <span className="handoff-sla">1.2s SLA</span>
                </div>
              </div>

              {/* 3 Metric Pills Bento */}
              <div className="showcase-bento-grid">
                <div className="bento-box">
                  <div className="bento-val">99.8%</div>
                  <div className="bento-lbl">Độ chính xác RAG</div>
                </div>
                <div className="bento-box">
                  <div className="bento-val">&lt; 1.2s</div>
                  <div className="bento-lbl">Tốc độ phản hồi</div>
                </div>
                <div className="bento-box">
                  <div className="bento-val">Zero-Leak</div>
                  <div className="bento-lbl">Bảo mật Tenant RLS</div>
                </div>
              </div>
            </div>

            {/* Testimonial Quote */}
            <div className="showcase-quote-box">
              <p className="quote-text">
                “GoTek Chatbot giúp giải phóng 75% khối lượng công việc lặp lại, khách hàng được giải đáp trong tích tắc mà vẫn đảm bảo độ bảo mật dữ liệu tuyệt đối.”
              </p>
              <div className="quote-footer">
                <div className="quote-author-meta">
                  <div className="quote-avatar">DH</div>
                  <div>
                    <span className="author-name">Đỗ Hoàng Nam</span>
                    <span className="author-role">Giám đốc Vận hành CSKH, FPT Software</span>
                  </div>
                </div>
                <div className="quote-rating">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={13} fill="#fbbf24" strokeWidth={0} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
