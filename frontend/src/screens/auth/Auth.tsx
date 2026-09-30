import React, {useState, type FormEvent} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {api, ApiError} from '@/api/api';
import {navigate} from '../../hooks/usePath';
import {Link} from '../../components/common/Link';
import {ThreeAuthBackground} from '../../components/common/ThreeAuthBackground';
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
  AlertCircle
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

  // Mouse Parallax Coordinates for 3D/2D Floating badges
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Route state
  const isSignup = path === '/app/auth/signup';
  const isReset = path === '/app/auth/reset';
  const isVerify = path === '/app/auth/verify';
  const token = new URLSearchParams(location.search).get('token');

  // Handle Mouse movement for 3D parallax tilt & spotlight
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = e;
    const x = (clientX / window.innerWidth - 0.5) * 2;
    const y = (clientY / window.innerHeight - 0.5) * 2;
    setMousePos({ x, y });

    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty('--mouse-x', `${px}%`);
    e.currentTarget.style.setProperty('--mouse-y', `${py}%`);
  };

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
    <div className="auth-centered-page" onMouseMove={handleMouseMove}>
      {/* 3D WebGL Neural Starfield Background */}
      <ThreeAuthBackground />

      {/* Dynamic Cursor Ambient Spotlight */}
      <div className="auth-spotlight-layer" />

      {/* Subtle Matrix Grid */}
      <div className="auth-ambient-grid" />

      {/* ====================================================================
          2D/3D INTERACTIVE SURROUNDING FLOATING BADGES (Parallax Physics)
          ==================================================================== */}
      <div className="auth-surroundings-container pointer-events-none">
        {/* Badge 1: Top-Left (Security & Isolation) */}
        <motion.div
          animate={{
            x: mousePos.x * -18,
            y: mousePos.y * -14 + Math.sin(Date.now() / 1000) * 4,
          }}
          transition={{ type: 'spring', damping: 20, stiffness: 60 }}
          className="auth-floating-badge badge-top-left pointer-events-auto"
        >
          <div className="badge-icon-box bg-blue-500/15 text-blue-400">
            <ShieldCheck size={20} />
          </div>
          <div className="badge-text">
            <strong>PostgreSQL RLS</strong>
            <span>Cô lập dữ liệu Multi-tenant 100%</span>
          </div>
        </motion.div>

        {/* Badge 2: Top-Right (Speed & pgvector) */}
        <motion.div
          animate={{
            x: mousePos.x * 22,
            y: mousePos.y * -18 + Math.cos(Date.now() / 1000) * 4,
          }}
          transition={{ type: 'spring', damping: 20, stiffness: 60 }}
          className="auth-floating-badge badge-top-right pointer-events-auto"
        >
          <div className="badge-icon-box bg-emerald-500/15 text-emerald-400">
            <Zap size={20} />
          </div>
          <div className="badge-text">
            <strong>Realtime pgvector</strong>
            <span>Truy xuất tri thức ngữ nghĩa 38ms</span>
          </div>
        </motion.div>

        {/* Badge 3: Bottom-Left (AI RAG Grounding) */}
        <motion.div
          animate={{
            x: mousePos.x * -20,
            y: mousePos.y * 16 + Math.cos(Date.now() / 1100) * 4,
          }}
          transition={{ type: 'spring', damping: 20, stiffness: 60 }}
          className="auth-floating-badge badge-bottom-left pointer-events-auto"
        >
          <div className="badge-icon-box bg-purple-500/15 text-purple-400">
            <Bot size={20} />
          </div>
          <div className="badge-text">
            <strong>Kiểm chứng RAG 100%</strong>
            <span>Trợ lý AI minh bạch, dẫn nguồn chuẩn xác</span>
          </div>
        </motion.div>

        {/* Badge 4: Bottom-Right (Staff Handoff) */}
        <motion.div
          animate={{
            x: mousePos.x * 18,
            y: mousePos.y * 20 + Math.sin(Date.now() / 1200) * 4,
          }}
          transition={{ type: 'spring', damping: 20, stiffness: 60 }}
          className="auth-floating-badge badge-bottom-right pointer-events-auto"
        >
          <div className="badge-icon-box bg-amber-500/15 text-amber-400">
            <Users size={20} />
          </div>
          <div className="badge-text">
            <strong>Staff Handoff 1-Click</strong>
            <span>Chuyển giao nhân viên tức thì, êm ái</span>
          </div>
        </motion.div>
      </div>

      {/* ====================================================================
          CENTERED BENTO GLASS CARD (Continuous Horizontal Slide Carousel)
          ==================================================================== */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="auth-center-bento-card"
      >
        {/* Glow ambient ring behind the box */}
        <div className="auth-card-ambient-glow" />

        {/* Card Header: Brand Logo & Title */}
        <div className="auth-card-header">
          <Link to="/app/auth/login" className="inline-block group">
            <img
              src="/gotek-logo.png"
              alt="GoTek Logo"
              className="auth-logo-img group-hover:scale-105 transition-transform"
            />
          </Link>

          <h1 className="auth-title">
            {isReset
              ? 'Khôi phục mật khẩu'
              : isVerify
                ? 'Xác thực email'
                : isSignup
                  ? 'Đăng ký doanh nghiệp'
                  : 'Đăng nhập hệ thống'}
          </h1>
          <p className="auth-subtitle">
            {isReset
              ? 'Nhập email để nhận liên kết đặt lại mật khẩu'
              : isVerify
                ? 'Hoàn tất bước xác minh tài khoản'
                : isSignup
                  ? 'Bắt đầu sử dụng CSKH AI thông minh chỉ trong vài phút'
                  : 'Nền tảng CSKH Đa Kênh & Trợ Lý AI Doanh Nghiệp'}
          </p>
        </div>

        {/* Mode Switcher Tabs with Sliding Pill */}
        {!isReset && !isVerify && (
          <div className="auth-tabs-wrapper">
            <motion.div
              layout
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className={`auth-tab-slider ${isSignup ? 'signup' : ''}`}
            />
            <button
              type="button"
              className={`auth-tab-btn ${!isSignup ? 'active' : ''}`}
              onClick={() => handleTabSwitch('login')}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${isSignup ? 'active' : ''}`}
              onClick={() => handleTabSwitch('signup')}
            >
              Đăng ký mới
            </button>
          </div>
        )}

        {/* Feedback Notices */}
        {error && (
          <div className="auth-notice-box error" role="alert">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>{error.message}</div>
          </div>
        )}

        {message && (
          <div className="auth-notice-box success" role="status">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <div>{message}</div>
          </div>
        )}

        {/* ==================================================================
            CONTINUOUS 2-PANE HORIZONTAL SLIDER (100% Smooth, Zero Jump)
            ================================================================== */}
        {isReset || isVerify ? (
          /* Reset / Verify Mode */
          <form onSubmit={handleResetOrVerifySubmit} className="pt-1">
            <fieldset disabled={busy} style={{border: 0, padding: 0, margin: 0}}>
              {isReset && !token && (
                <div className="auth-input-group">
                  <label htmlFor="email">Email tài khoản</label>
                  <div className="auth-input-wrapper">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className="auth-input-field"
                      placeholder="ban@doanhnghiep.com"
                      required
                    />
                    <div className="auth-input-icon">
                      <Mail size={17} />
                    </div>
                  </div>
                </div>
              )}

              {isReset && token && (
                <div className="auth-input-group">
                  <label htmlFor="password">Mật khẩu mới (tối thiểu 12 ký tự)</label>
                  <div className="auth-input-wrapper">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className="auth-input-field"
                      placeholder="••••••••••••"
                      required
                      minLength={12}
                    />
                    <div className="auth-input-icon">
                      <Lock size={17} />
                    </div>
                  </div>
                </div>
              )}

              <button type="submit" className="auth-submit-btn mt-3" disabled={busy}>
                {busy ? <span className="auth-spinner" /> : 'Xác nhận khôi phục'}
              </button>
            </fieldset>
          </form>
        ) : (
          /* Normal Slide Track: Pane 1 (Login) & Pane 2 (Signup) */
          <div className="auth-carousel-viewport">
            <motion.div
              className="auth-carousel-track"
              animate={{ x: isSignup ? '-50%' : '0%' }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 32,
                mass: 0.8,
              }}
            >
              {/* ============================================================
                  SLIDE PANE 1: FORM ĐĂNG NHẬP
                  ============================================================ */}
              <div className="auth-carousel-pane">
                {/* Quick Account Chips */}
                <div className="auth-quick-fill-section">
                  <span className="auth-quick-fill-label">⚡ Tài khoản mẫu trải nghiệm nhanh:</span>
                  <div className="auth-quick-fill-chips">
                    <button
                      type="button"
                      className={`auth-quick-chip ${emailValue === 'admin@gotek.vn' ? 'active' : ''}`}
                      onClick={() => {
                        setEmailValue('admin@gotek.vn');
                        setPasswordValue('Admin@12345678');
                      }}
                      title="Toàn quyền Super Admin"
                    >
                      👑 Super Admin
                    </button>
                    <button
                      type="button"
                      className={`auth-quick-chip ${emailValue === 'alex.rivera@gotek.vn' ? 'active' : ''}`}
                      onClick={() => {
                        setEmailValue('alex.rivera@gotek.vn');
                        setPasswordValue('Admin@12345678');
                      }}
                      title="Quản trị Lead"
                    >
                      💼 Lead
                    </button>
                    <button
                      type="button"
                      className={`auth-quick-chip ${emailValue === 'nam.do@gotek.vn' ? 'active' : ''}`}
                      onClick={() => {
                        setEmailValue('nam.do@gotek.vn');
                        setPasswordValue('Admin@12345678');
                      }}
                      title="Nhân viên CSKH"
                    >
                      🎧 Agent
                    </button>
                  </div>
                </div>

                <form onSubmit={handleLoginSubmit}>
                  <fieldset disabled={busy} style={{border: 0, padding: 0, margin: 0}}>
                    {/* Email */}
                    <div className="auth-input-group">
                      <label htmlFor="login-email">Địa chỉ Email công việc</label>
                      <div className="auth-input-wrapper">
                        <input
                          id="login-email"
                          name="email"
                          type="email"
                          className="auth-input-field"
                          placeholder="ban@doanhnghiep.com"
                          required
                          value={emailValue}
                          onChange={(e) => setEmailValue(e.target.value)}
                        />
                        <div className="auth-input-icon">
                          <Mail size={17} />
                        </div>
                      </div>
                      {fields.email && <span className="auth-field-error">{fields.email.join(' ')}</span>}
                    </div>

                    {/* Password */}
                    <div className="auth-input-group">
                      <label htmlFor="login-password">Mật khẩu</label>
                      <div className="auth-input-wrapper">
                        <input
                          id="login-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          className="auth-input-field"
                          placeholder="••••••••••••"
                          required
                          value={passwordValue}
                          onChange={(e) => setPasswordValue(e.target.value)}
                        />
                        <div className="auth-input-icon">
                          <Lock size={17} />
                        </div>
                        <button
                          type="button"
                          className="auth-password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                      {fields.password && <span className="auth-field-error">{fields.password.join(' ')}</span>}
                    </div>

                    {/* Remember & Forgot Password */}
                    <div className="auth-form-extras">
                      <label className="auth-remember-label">
                        <input name="remember" type="checkbox" defaultChecked />
                        <span>Ghi nhớ đăng nhập</span>
                      </label>
                      <Link to="/app/auth/reset" className="auth-forgot-link">
                        Quên mật khẩu?
                      </Link>
                    </div>

                    {/* Submit Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="auth-submit-btn"
                      disabled={busy}
                    >
                      {busy ? (
                        <>
                          <span className="auth-spinner" />
                          <span>Đang xử lý...</span>
                        </>
                      ) : (
                        <>
                          <span>Đăng nhập vào không gian làm việc</span>
                          <ArrowRight size={17} className="auth-btn-arrow" />
                        </>
                      )}
                    </motion.button>
                  </fieldset>
                </form>
              </div>

              {/* ============================================================
                  SLIDE PANE 2: FORM ĐĂNG KÝ (COMPACT 2-COLUMN GRID)
                  ============================================================ */}
              <div className="auth-carousel-pane">
                <form onSubmit={handleSignupSubmit}>
                  <fieldset disabled={busy} style={{border: 0, padding: 0, margin: 0}}>
                    {/* Row 1: Full Name & Business Name (2-Col Grid) */}
                    <div className="auth-grid-2col">
                      <div className="auth-input-group">
                        <label htmlFor="signup-name">Họ và tên</label>
                        <div className="auth-input-wrapper">
                          <input
                            id="signup-name"
                            name="fullName"
                            className="auth-input-field"
                            placeholder="Nguyễn Văn A"
                            required
                            maxLength={120}
                          />
                          <div className="auth-input-icon">
                            <User size={17} />
                          </div>
                        </div>
                        {fields.fullName && <span className="auth-field-error">{fields.fullName.join(' ')}</span>}
                      </div>

                      <div className="auth-input-group">
                        <label htmlFor="signup-biz">Doanh nghiệp</label>
                        <div className="auth-input-wrapper">
                          <input
                            id="signup-biz"
                            name="business"
                            className="auth-input-field"
                            placeholder="Tên công ty..."
                            required
                            maxLength={160}
                          />
                          <div className="auth-input-icon">
                            <Building2 size={17} />
                          </div>
                        </div>
                        {fields.business && <span className="auth-field-error">{fields.business.join(' ')}</span>}
                      </div>
                    </div>

                    {/* Row 2: Email & Phone (2-Col Grid) */}
                    <div className="auth-grid-2col">
                      <div className="auth-input-group">
                        <label htmlFor="signup-email">Email công việc</label>
                        <div className="auth-input-wrapper">
                          <input
                            id="signup-email"
                            name="email"
                            type="email"
                            className="auth-input-field"
                            placeholder="ban@congty.com"
                            required
                            maxLength={254}
                          />
                          <div className="auth-input-icon">
                            <Mail size={17} />
                          </div>
                        </div>
                        {fields.email && <span className="auth-field-error">{fields.email.join(' ')}</span>}
                      </div>

                      <div className="auth-input-group">
                        <label htmlFor="signup-phone">Số điện thoại</label>
                        <div className="auth-input-wrapper">
                          <input
                            id="signup-phone"
                            name="phone"
                            type="tel"
                            className="auth-input-field"
                            placeholder="0912 345 678"
                            required
                            maxLength={25}
                          />
                          <div className="auth-input-icon">
                            <Phone size={17} />
                          </div>
                        </div>
                        {fields.phone && <span className="auth-field-error">{fields.phone.join(' ')}</span>}
                      </div>
                    </div>

                    {/* Row 3: Referral & Password (2-Col Grid) */}
                    <div className="auth-grid-2col">
                      <div className="auth-input-group">
                        <label htmlFor="signup-referral">Mã ưu đãi (nếu có)</label>
                        <div className="auth-input-wrapper">
                          <input
                            id="signup-referral"
                            name="referral"
                            className="auth-input-field"
                            placeholder="Mã giới thiệu..."
                            maxLength={80}
                          />
                          <div className="auth-input-icon">
                            <Sparkles size={17} />
                          </div>
                        </div>
                      </div>

                      <div className="auth-input-group">
                        <label htmlFor="signup-password">
                          Mật khẩu <span style={{fontSize: 10, color: '#64748b'}}>(12+ ký tự)</span>
                        </label>
                        <div className="auth-input-wrapper">
                          <input
                            id="signup-password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            className="auth-input-field"
                            placeholder="••••••••••••"
                            required
                            minLength={12}
                            maxLength={128}
                          />
                          <div className="auth-input-icon">
                            <Lock size={17} />
                          </div>
                          <button
                            type="button"
                            className="auth-password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          >
                            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                        {fields.password && <span className="auth-field-error">{fields.password.join(' ')}</span>}
                      </div>
                    </div>

                    {/* Submit Signup Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="auth-submit-btn mt-2"
                      disabled={busy}
                    >
                      {busy ? (
                        <>
                          <span className="auth-spinner" />
                          <span>Đang đăng ký...</span>
                        </>
                      ) : (
                        <>
                          <span>Tạo tài khoản doanh nghiệp ngay</span>
                          <ArrowRight size={17} className="auth-btn-arrow" />
                        </>
                      )}
                    </motion.button>
                  </fieldset>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {/* Footer Link Switcher */}
        <div className="auth-footer">
          {isSignup || isReset || isVerify ? (
            <p>
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => handleTabSwitch('login')}
                className="auth-footer-link"
              >
                Đăng nhập ngay
              </button>
            </p>
          ) : (
            <p>
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => handleTabSwitch('signup')}
                className="auth-footer-link"
              >
                Đăng ký doanh nghiệp mới
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
