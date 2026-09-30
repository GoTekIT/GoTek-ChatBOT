import React, {useState, type FormEvent, useRef} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
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
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Zap
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

  // Form values - Start completely blank for genuine manual testing
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');

  // Client-side validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  // Interactive mouse tracking state for overall background and mascot
  const [screenMouse, setScreenMouse] = useState({x: 500, y: 300});
  const [isBotHovered, setIsBotHovered] = useState(false);
  const [eyeOffset, setEyeOffset] = useState({x: 0, y: 0});
  const showcaseRef = useRef<HTMLDivElement>(null);

  // Route state
  const isSignup = path === '/app/auth/signup';
  const isReset = path === '/app/auth/reset';
  const isVerify = path === '/app/auth/verify';
  const token = new URLSearchParams(location.search).get('token');

  const handleTabSwitch = (target: 'login' | 'signup') => {
    setError(null);
    setMessage('');
    setClientErrors({});
    setTouched({});
    if (target === 'signup') {
      navigate('/app/auth/signup');
    } else {
      navigate('/app/auth/login');
    }
  };

  // Full-screen mouse movement tracking for dynamic background glow and mascot eyes
  const handleScreenMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setScreenMouse({x: e.clientX, y: e.clientY});

    if (showcaseRef.current) {
      const rect = showcaseRef.current.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / rect.width - 0.5) * 16;
      const relY = ((e.clientY - rect.top) / rect.height - 0.5) * 12;
      setEyeOffset({
        x: Math.max(-8, Math.min(8, relX)),
        y: Math.max(-6, Math.min(6, relY))
      });
    }
  };

  // Helper validation logic
  function validateField(name: string, value: string): string | null {
    if (name === 'email') {
      if (!value.trim()) return 'Vui lòng nhập địa chỉ email.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        return 'Email không hợp lệ (ví dụ: name@company.com).';
      }
    }
    if (name === 'password') {
      if (!value) return 'Vui lòng nhập mật khẩu.';
      if (isSignup && value.length < 12) {
        return 'Mật khẩu đăng ký phải có tối thiểu 12 ký tự.';
      }
    }
    if (name === 'fullName' && isSignup) {
      if (!value.trim() || value.trim().length < 2) {
        return 'Họ và tên cần tối thiểu 2 ký tự.';
      }
    }
    if (name === 'business' && isSignup) {
      if (!value.trim() || value.trim().length < 2) {
        return 'Tên doanh nghiệp cần tối thiểu 2 ký tự.';
      }
    }
    if (name === 'phone' && isSignup) {
      if (!value.trim()) return 'Vui lòng nhập số điện thoại.';
      if (!/^\+?[0-9 ()-]{7,25}$/.test(value.trim())) {
        return 'Số điện thoại không hợp lệ (từ 7 đến 25 số).';
      }
    }
    return null;
  }

  const handleBlur = (field: string, value: string) => {
    setTouched(prev => ({...prev, [field]: true}));
    const err = validateField(field, value);
    setClientErrors(prev => ({...prev, [field]: err || ''}));
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'email') setEmailValue(value);
    if (field === 'password') setPasswordValue(value);
    if (touched[field]) {
      const err = validateField(field, value);
      setClientErrors(prev => ({...prev, [field]: err || ''}));
    }
  };

  // Submit Handler for Login
  async function handleLoginSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage('');

    const emailErr = validateField('email', emailValue);
    const passErr = validateField('password', passwordValue);

    if (emailErr || passErr) {
      setTouched({email: true, password: true});
      setClientErrors({email: emailErr || '', password: passErr || ''});
      setError(new Error('Vui lòng kiểm tra và nhập đúng thông tin đăng nhập.'));
      return;
    }

    setBusy(true);
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
    setError(null);
    setMessage('');
    const form = new FormData(e.currentTarget);
    const fullName = String(form.get('fullName') || '');
    const business = String(form.get('business') || '');
    const email = String(form.get('email') || '');
    const phone = String(form.get('phone') || '');
    const password = String(form.get('password') || '');

    const nameErr = validateField('fullName', fullName);
    const bizErr = validateField('business', business);
    const emailErr = validateField('email', email);
    const phoneErr = validateField('phone', phone);
    const passErr = validateField('password', password);

    if (nameErr || bizErr || emailErr || phoneErr || passErr) {
      setTouched({fullName: true, business: true, email: true, phone: true, password: true});
      setClientErrors({
        fullName: nameErr || '',
        business: bizErr || '',
        email: emailErr || '',
        phone: phoneErr || '',
        password: passErr || ''
      });
      setError(new Error('Vui lòng hoàn thiện đúng và đủ các thông tin đăng ký.'));
      return;
    }

    setBusy(true);
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
    setError(null);
    setMessage('');
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');

    if (isReset && !token) {
      const emailErr = validateField('email', email);
      if (emailErr) {
        setTouched({email: true});
        setClientErrors({email: emailErr});
        setError(new Error(emailErr));
        return;
      }
    }

    if (isReset && token && password.length < 12) {
      setError(new Error('Mật khẩu mới phải có tối thiểu 12 ký tự.'));
      return;
    }

    setBusy(true);
    try {
      if (isVerify) {
        await api('/auth/verify', 'POST', {token});
        setMessage('Email đã được xác thực thành công. Bạn có thể đăng nhập ngay.');
      } else if (isReset) {
        if (token) {
          await api('/auth/reset', 'POST', {token, password});
          setMessage('Mật khẩu đã được cập nhật thành công. Vui lòng đăng nhập lại.');
        } else {
          const r = await api('/auth/request-reset', 'POST', {email});
          setMessage(r.message || 'Hướng dẫn khôi phục mật khẩu đã được gửi đến email của bạn.');
        }
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  }

  const handleSocialLogin = (provider: 'Google' | 'Facebook') => {
    setError(null);
    setMessage(`Cổng liên kết ${provider} SSO đang kết nối hệ thống doanh nghiệp.`);
  };

  const serverFields = error instanceof ApiError ? (error.fields as Record<string, string[]>) : {};

  const getFieldError = (fieldName: string) => {
    if (clientErrors[fieldName]) return clientErrors[fieldName];
    if (serverFields[fieldName]) return serverFields[fieldName].join(' ');
    return null;
  };

  return (
    <div className="auth-outer-screen" onMouseMove={handleScreenMouseMove}>
      {/* Dynamic Interactive Animated Background with Mouse Follower Light */}
      <div className="auth-ambient-canvas" aria-hidden="true">
        {/* Interactive Cursor Spotlight Glow */}
        <div
          className="ambient-cursor-spotlight"
          style={{
            transform: `translate3d(${screenMouse.x - 250}px, ${screenMouse.y - 250}px, 0)`
          }}
        />
        <div className="ambient-orb orb-1" />
        <div className="ambient-orb orb-2" />
        <div className="ambient-orb orb-3" />
        <div className="ambient-pattern-grid" />
      </div>

      {/* Main Centered Floating Card (Expansive size ~85%, Switches Left/Right on Signup) */}
      <motion.div
        layout
        transition={{type: 'spring', stiffness: 220, damping: 26}}
        className={`auth-card-wrapper ${isSignup ? 'signup-layout' : 'login-layout'}`}
      >
        {/* ====================================================================
            FORM PANEL: Clean with subtle GoTek cyan/blue color bleed streaks!
            ==================================================================== */}
        <motion.div
          layout="position"
          transition={{type: 'spring', stiffness: 220, damping: 26}}
          className="auth-card-left"
        >
          {/* Subtle Color Bleed Elements extending from the brand side */}
          <div className="form-color-bleed-top" aria-hidden="true" />
          <div className="form-color-bleed-bottom" aria-hidden="true" />

          {/* Brand & Tier Header */}
          <div className="auth-card-header">
            <Link to="/app/auth/login" className="auth-brand-badge">
              <img src="/gotek-logo.png" alt="GoTek" className="auth-brand-icon" />
              <span className="auth-brand-title">GoTek Solutions</span>
            </Link>
            <div className="auth-status-pill">
              <ShieldCheck size={13} className="text-[#0284c7]" />
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

            {/* Segmented Tab Switcher with Fluid Motion Indicator */}
            {!isReset && !isVerify && (
              <div className="auth-tab-group">
                <button
                  type="button"
                  className={`auth-tab-item ${!isSignup ? 'active' : ''}`}
                  onClick={() => handleTabSwitch('login')}
                >
                  {!isSignup && (
                    <motion.div
                      layoutId="authTabIndicator"
                      className="auth-tab-indicator"
                      transition={{type: 'spring', stiffness: 450, damping: 32}}
                    />
                  )}
                  <span className="auth-tab-label">Đăng nhập</span>
                </button>
                <button
                  type="button"
                  className={`auth-tab-item ${isSignup ? 'active' : ''}`}
                  onClick={() => handleTabSwitch('signup')}
                >
                  {isSignup && (
                    <motion.div
                      layoutId="authTabIndicator"
                      className="auth-tab-indicator"
                      transition={{type: 'spring', stiffness: 450, damping: 32}}
                    />
                  )}
                  <span className="auth-tab-label">Tạo tài khoản mới</span>
                </button>
              </div>
            )}

            {/* Feedback Alerts */}
            {error && (
              <div className="auth-msg-alert error" role="alert">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error.message}</span>
              </div>
            )}

            {message && (
              <div className="auth-msg-alert success" role="status">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {/* Animated Form Content */}
            <AnimatePresence mode="wait" initial={false}>
              {isReset || isVerify ? (
                <motion.div
                  key="reset-verify"
                  initial={{opacity: 0}}
                  animate={{opacity: 1}}
                  exit={{opacity: 0}}
                  transition={{duration: 0.18}}
                >
                  <form onSubmit={handleResetOrVerifySubmit} className="auth-actual-form" noValidate>
                    <fieldset disabled={busy} className="auth-fieldset">
                      {isReset && !token && (
                        <div className="auth-field-group">
                          <label className="auth-field-label">Email tài khoản</label>
                          <div className={`auth-input-shell ${getFieldError('email') ? 'error' : ''}`}>
                            <Mail size={16} className="auth-input-prefix" />
                            <input
                              name="email"
                              type="email"
                              className="auth-input-control"
                              placeholder="name@company.com"
                              required
                              onBlur={(e) => handleBlur('email', e.target.value)}
                            />
                          </div>
                          {getFieldError('email') && (
                            <span className="auth-field-error">
                              <AlertCircle size={12} /> {getFieldError('email')}
                            </span>
                          )}
                        </div>
                      )}

                      {isReset && token && (
                        <div className="auth-field-group">
                          <label className="auth-field-label">Mật khẩu mới (tối thiểu 12 ký tự)</label>
                          <div className={`auth-input-shell ${getFieldError('password') ? 'error' : ''}`}>
                            <Lock size={16} className="auth-input-prefix" />
                            <input
                              name="password"
                              type={showPassword ? 'text' : 'password'}
                              className="auth-input-control"
                              placeholder="••••••••••••"
                              required
                              minLength={12}
                              onBlur={(e) => handleBlur('password', e.target.value)}
                            />
                          </div>
                          {getFieldError('password') && (
                            <span className="auth-field-error">
                              <AlertCircle size={12} /> {getFieldError('password')}
                            </span>
                          )}
                        </div>
                      )}

                      <button type="submit" className="auth-action-btn" disabled={busy}>
                        {busy ? 'Đang gửi yêu cầu...' : 'Xác nhận khôi phục'}
                      </button>
                    </fieldset>
                  </form>
                </motion.div>
              ) : !isSignup ? (
                /* ==================== LOGIN FORM ==================== */
                <motion.div
                  key="login-form"
                  initial={{opacity: 0}}
                  animate={{opacity: 1}}
                  exit={{opacity: 0}}
                  transition={{duration: 0.18}}
                  className="auth-login-flow"
                >
                  <form onSubmit={handleLoginSubmit} className="auth-actual-form" noValidate>
                    <fieldset disabled={busy} className="auth-fieldset">
                      {/* Email */}
                      <div className="auth-field-group">
                        <label className="auth-field-label">Email công việc</label>
                        <div className={`auth-input-shell ${getFieldError('email') ? 'error' : ''}`}>
                          <Mail size={16} className="auth-input-prefix" />
                          <input
                            id="login-email"
                            name="email"
                            type="email"
                            className="auth-input-control"
                            placeholder="name@company.com"
                            required
                            value={emailValue}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            onBlur={(e) => handleBlur('email', e.target.value)}
                          />
                        </div>
                        {getFieldError('email') && (
                          <span className="auth-field-error">
                            <AlertCircle size={12} /> {getFieldError('email')}
                          </span>
                        )}
                      </div>

                      {/* Password */}
                      <div className="auth-field-group">
                        <div className="auth-label-split">
                          <label className="auth-field-label">Mật khẩu</label>
                          <Link to="/app/auth/reset" className="auth-forgot-link">
                            Quên mật khẩu?
                          </Link>
                        </div>
                        <div className={`auth-input-shell ${getFieldError('password') ? 'error' : ''}`}>
                          <Lock size={16} className="auth-input-prefix" />
                          <input
                            id="login-password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            className="auth-input-control"
                            placeholder="••••••••••••"
                            required
                            value={passwordValue}
                            onChange={(e) => handleInputChange('password', e.target.value)}
                            onBlur={(e) => handleBlur('password', e.target.value)}
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
                        {getFieldError('password') && (
                          <span className="auth-field-error">
                            <AlertCircle size={12} /> {getFieldError('password')}
                          </span>
                        )}
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

                  {/* Divider Line */}
                  <div className="auth-separator">
                    <span>hoặc tiếp tục với</span>
                  </div>

                  {/* Social Login Buttons: Google & Facebook */}
                  <div className="auth-social-grid">
                    <button
                      type="button"
                      onClick={() => handleSocialLogin('Google')}
                      className="auth-social-tile"
                      title="Đăng nhập với Google Workspace"
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
                      onClick={() => handleSocialLogin('Facebook')}
                      className="auth-social-tile"
                      title="Đăng nhập với Facebook Business"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" className="shrink-0">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      <span>Facebook</span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                /* ==================== SIGNUP FORM ==================== */
                <motion.div
                  key="signup-form"
                  initial={{opacity: 0}}
                  animate={{opacity: 1}}
                  exit={{opacity: 0}}
                  transition={{duration: 0.18}}
                >
                  <form onSubmit={handleSignupSubmit} className="auth-actual-form" noValidate>
                    <fieldset disabled={busy} className="auth-fieldset">
                      <div className="auth-twin-row">
                        <div className="auth-field-group">
                          <label className="auth-field-label">Họ và tên</label>
                          <div className={`auth-input-shell ${getFieldError('fullName') ? 'error' : ''}`}>
                            <User size={16} className="auth-input-prefix" />
                            <input
                              name="fullName"
                              className="auth-input-control"
                              placeholder="Nguyễn Văn A"
                              required
                              maxLength={120}
                              onBlur={(e) => handleBlur('fullName', e.target.value)}
                            />
                          </div>
                          {getFieldError('fullName') && (
                            <span className="auth-field-error">
                              <AlertCircle size={12} /> {getFieldError('fullName')}
                            </span>
                          )}
                        </div>

                        <div className="auth-field-group">
                          <label className="auth-field-label">Tên doanh nghiệp</label>
                          <div className={`auth-input-shell ${getFieldError('business') ? 'error' : ''}`}>
                            <Building2 size={16} className="auth-input-prefix" />
                            <input
                              name="business"
                              className="auth-input-control"
                              placeholder="Công ty CP..."
                              required
                              maxLength={160}
                              onBlur={(e) => handleBlur('business', e.target.value)}
                            />
                          </div>
                          {getFieldError('business') && (
                            <span className="auth-field-error">
                              <AlertCircle size={12} /> {getFieldError('business')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="auth-twin-row">
                        <div className="auth-field-group">
                          <label className="auth-field-label">Email công việc</label>
                          <div className={`auth-input-shell ${getFieldError('email') ? 'error' : ''}`}>
                            <Mail size={16} className="auth-input-prefix" />
                            <input
                              name="email"
                              type="email"
                              className="auth-input-control"
                              placeholder="name@company.com"
                              required
                              maxLength={254}
                              onBlur={(e) => handleBlur('email', e.target.value)}
                            />
                          </div>
                          {getFieldError('email') && (
                            <span className="auth-field-error">
                              <AlertCircle size={12} /> {getFieldError('email')}
                            </span>
                          )}
                        </div>

                        <div className="auth-field-group">
                          <label className="auth-field-label">Số điện thoại</label>
                          <div className={`auth-input-shell ${getFieldError('phone') ? 'error' : ''}`}>
                            <Phone size={16} className="auth-input-prefix" />
                            <input
                              name="phone"
                              type="tel"
                              className="auth-input-control"
                              placeholder="0912 345 678"
                              required
                              maxLength={25}
                              onBlur={(e) => handleBlur('phone', e.target.value)}
                            />
                          </div>
                          {getFieldError('phone') && (
                            <span className="auth-field-error">
                              <AlertCircle size={12} /> {getFieldError('phone')}
                            </span>
                          )}
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
                          <label className="auth-field-label">Mật khẩu (tối thiểu 12 ký tự)</label>
                          <div className={`auth-input-shell ${getFieldError('password') ? 'error' : ''}`}>
                            <Lock size={16} className="auth-input-prefix" />
                            <input
                              name="password"
                              type={showPassword ? 'text' : 'password'}
                              className="auth-input-control"
                              placeholder="••••••••••••"
                              required
                              minLength={12}
                              maxLength={128}
                              onBlur={(e) => handleBlur('password', e.target.value)}
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
                          {getFieldError('password') && (
                            <span className="auth-field-error">
                              <AlertCircle size={12} /> {getFieldError('password')}
                            </span>
                          )}
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Card Footer Policy */}
          <div className="auth-card-footer">
            Bằng việc tiếp tục, bạn đồng ý với{' '}
            <a href="#" onClick={(e) => e.preventDefault()}>Điều khoản</a> và{' '}
            <a href="#" onClick={(e) => e.preventDefault()}>Chính sách bảo mật</a> của GoTek.
          </div>
        </motion.div>

        {/* ====================================================================
            SHOWCASE PANEL: BALANCED DEEPER SAPPHIRE GRADIENT + INTERACTIVE MASCOT
            Calmed down slightly (Not glaring, not too dark, rich Royal Sapphire)
            ==================================================================== */}
        <motion.div
          ref={showcaseRef}
          layout="position"
          transition={{type: 'spring', stiffness: 220, damping: 26}}
          className="auth-card-right"
        >
          {/* Subtle logo-inspired light orbs */}
          <div className="showcase-glow-light" />

          {/* Interactive Assistant Mascot Stage */}
          <div className="mascot-stage">
            {/* Dynamic Interactive Speech Bubble */}
            <motion.div
              initial={{scale: 0.9, opacity: 0}}
              animate={{scale: 1, opacity: 1}}
              key={isBotHovered ? 'hover' : isSignup ? 'signup' : 'login'}
              className="mascot-speech-bubble"
            >
              <span className="speech-avatar">✨</span>
              <p>
                {isBotHovered
                  ? 'Em luôn sẵn sàng hỗ trợ anh yêu 24/7! 🤖'
                  : isSignup
                    ? 'Tạo tài khoản để mở khóa trợ lý AI thông minh ngay nhé! 🚀'
                    : 'Chào mừng trở lại! Hãy đăng nhập để bắt đầu phiên làm việc nhé 👋'}
              </p>
              <div className="speech-arrow" />
            </motion.div>

            {/* Interactive Vector 2D/3D Mascot */}
            <div
              className={`mascot-character ${isBotHovered ? 'hovered' : ''}`}
              onMouseEnter={() => setIsBotHovered(true)}
              onMouseLeave={() => setIsBotHovered(false)}
            >
              {/* Antenna with pulsing star */}
              <div className="mascot-antenna">
                <div className="antenna-stem" />
                <div className="antenna-star">★</div>
              </div>

              {/* Bot Head & Face */}
              <div className="mascot-head">
                <div className="mascot-face-visor">
                  {/* Digital Eyes with Eye Tracking */}
                  <div
                    className="mascot-eyes"
                    style={{
                      transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`
                    }}
                  >
                    <div className="digital-eye left">
                      <div className="eye-pupil" />
                    </div>
                    <div className="digital-eye right">
                      <div className="eye-pupil" />
                    </div>
                  </div>
                  {/* Subtle cute smile */}
                  <div className="mascot-smile" />
                </div>
              </div>

              {/* Floating Hands */}
              <div className="mascot-hand left" />
              <div className="mascot-hand right" />

              {/* Pod Body with GoTek Star Emblem */}
              <div className="mascot-body">
                <div className="mascot-core-star">
                  <svg width="24" height="24" viewBox="0 0 100 100" fill="none">
                    <polygon
                      points="50,5 64,36 98,40 72,64 80,98 50,80 20,98 28,64 2,40 36,36"
                      fill="#38bdf8"
                    />
                  </svg>
                </div>
              </div>

              {/* Floating Shadow */}
              <div className="mascot-shadow" />
            </div>
          </div>

          {/* Minimal, Punchy Information */}
          <div className="mascot-info-block">
            <h2 className="mascot-title">GoTek Smart Chatbot</h2>
            <p className="mascot-subtitle">
              Nền tảng CSKH Đa Kênh Tự Động & Handoff Chuyên Viên
            </p>

            {/* 3 Clean Modern Feature Pills */}
            <div className="mascot-pill-tags">
              <span className="mascot-tag">
                <Zap size={12} className="text-amber-300" />
                <span>Phản hồi &lt;1.2s</span>
              </span>
              <span className="mascot-tag">
                <Sparkles size={12} className="text-cyan-200" />
                <span>Trích dẫn RAG chuẩn xác</span>
              </span>
              <span className="mascot-tag">
                <ShieldCheck size={12} className="text-emerald-300" />
                <span>Bảo mật RLS 100%</span>
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
