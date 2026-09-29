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
  Bot,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import './auth.css';

interface AuthProps {
  path: string;
  onLogin: () => void;
}

interface DemoPrompt {
  id: string;
  label: string;
  userMsg: string;
  aiMsg: string;
  source: string;
}

const DEMO_PROMPTS: DemoPrompt[] = [
  {
    id: 'sdk',
    label: '🚀 Tích hợp Website?',
    userMsg: 'Sản phẩm GoTek có dễ tích hợp vào website không?',
    aiMsg: 'Dạ rất nhanh ạ! GoTek cung cấp Widget SDK nhúng chỉ với 1 dòng mã script, hiển thị đẹp mắt và mượt mà trên cả Mobile & Desktop! ✨',
    source: 'Tài liệu Kỹ thuật Widget SDK v2.4'
  },
  {
    id: 'grounding',
    label: '📚 AI có bịa thông tin không?',
    userMsg: 'Chatbot AI có bịa đặt hay trả lời sai kiến thức công ty không?',
    aiMsg: 'Hoàn toàn không ạ! Hệ thống áp dụng AI Grounding nghiêm ngặt, chỉ trích xuất từ tài liệu bạn đã duyệt và luôn dẫn nguồn minh bạch từng câu. 🎯',
    source: 'Kiểm chứng RAG & Semantic Grounding'
  },
  {
    id: 'security',
    label: '🛡️ Bảo mật Multi-tenant?',
    userMsg: 'Dữ liệu khách hàng giữa các doanh nghiệp có bị lẫn lộn hay rò rỉ không?',
    aiMsg: 'GoTek dùng kiến trúc PostgreSQL RLS (Row-Level Security) cô lập dữ liệu cấp database, cam kết bảo mật 100% dữ liệu từng doanh nghiệp! 🔒',
    source: 'Kiến trúc Phân quyền & Postgres RLS'
  },
  {
    id: 'handoff',
    label: '👥 Chuyển giao nhân viên?',
    userMsg: 'Khi khách hỏi vấn đề phức tạp cần gặp người thật thì sao?',
    aiMsg: 'Nhân viên có thể tiếp quản (Staff Handoff) chỉ bằng 1 click, xem toàn bộ lịch sử trò chuyện và ghi chú nội bộ bảo mật mà khách không thấy! 💼',
    source: 'Quy trình Hộp thư CSKH Gotek Inbox'
  }
];

export function Auth({path, onLogin}: AuthProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Interactive AI Demo State
  const [activePromptId, setActivePromptId] = useState<string>('sdk');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [currentPrompt, setCurrentPrompt] = useState<DemoPrompt>(DEMO_PROMPTS[0]);

  const signup = path === '/app/auth/signup';
  const reset = path === '/app/auth/reset';
  const verify = path === '/app/auth/verify';
  const token = new URLSearchParams(location.search).get('token');

  // Dynamic mouse spotlight tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty('--mouse-x', `${x}%`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}%`);
  };

  // Interactive Prompt Selection
  const handleSelectPrompt = (prompt: DemoPrompt) => {
    if (prompt.id === activePromptId && !isTyping) return;
    setActivePromptId(prompt.id);
    setIsTyping(true);
    setTimeout(() => {
      setCurrentPrompt(prompt);
      setIsTyping(false);
    }, 380);
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage('');
    const form = new FormData(e.currentTarget);

    try {
      if (signup) {
        await api('/auth/signup', 'POST', Object.fromEntries(form));
        setMessage('Đã nhận yêu cầu đăng ký. Vui lòng kiểm tra hướng dẫn xác thực rồi đăng nhập.');
      } else if (verify) {
        await api('/auth/verify', 'POST', {token});
        setMessage('Email đã được xác thực thành công. Bạn có thể đăng nhập ngay.');
      } else if (reset) {
        if (token) {
          await api('/auth/reset', 'POST', {token, password: form.get('password')});
          setMessage('Mật khẩu đã được cập nhật thành công. Vui lòng đăng nhập lại.');
        } else {
          const r = await api('/auth/request-reset', 'POST', {email: form.get('email')});
          setMessage(r.message || 'Hướng dẫn khôi phục mật khẩu đã được gửi đến email của bạn.');
        }
      } else {
        await api('/auth/login', 'POST', {
          email: form.get('email'),
          password: form.get('password'),
          remember: form.get('remember') === 'on'
        });
        onLogin();
        const pending = sessionStorage.getItem('gotek.pending-invite');
        sessionStorage.removeItem('gotek.pending-invite');
        navigate(pending && pending.startsWith('/app/invitation#') ? pending : '/app/inbox');
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  }

  const fields = error instanceof ApiError ? (error.fields as Record<string, string[]>) : {};

  return (
    <div className="auth-page" onMouseMove={handleMouseMove}>
      {/* Interactive Cursor Spotlight */}
      <div className="auth-spotlight-layer" />

      {/* --------------------------------------------------------------------
          Left Column: Hero & Interactive AI Showcase Section
          -------------------------------------------------------------------- */}
      <section className="auth-hero">
        <div className="auth-hero-grid" />

        <div className="auth-hero-content">
          <div style={{display: 'inline-flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.95)', padding: '8px 18px', borderRadius: 14, marginBottom: 20, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'}}>
            <img src="/gotek-logo.png" alt="GoTek Logo" style={{height: 38, objectFit: 'contain'}} />
          </div>

          <div className="auth-brand-badge">
            <Sparkles size={14} />
            <span>Thế Hệ Chatbot Doanh Nghiệp Mới</span>
          </div>

          <h2>Nền Tảng CSKH Đa Kênh & Trợ Lý AI Doanh Nghiệp</h2>
          <p className="auth-hero-desc">
            Tự động hóa phản hồi thông minh dựa trên kho tri thức riêng của từng doanh nghiệp,
            kết hợp phân công nhân viên hỗ trợ mượt mà và bảo mật dữ liệu cấp cơ sở dữ liệu.
          </p>

          <div className="auth-features-list">
            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <Bot size={18} />
              </div>
              <div className="auth-feature-text">
                <h4>Trí tuệ nhân tạo có kiểm chứng (AI Grounded)</h4>
                <p>Chỉ trả lời dựa trên tài liệu đã xuất bản, dẫn nguồn chính xác theo từng đoạn văn bản.</p>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <ShieldCheck size={18} />
              </div>
              <div className="auth-feature-text">
                <h4>Cô lập dữ liệu tuyệt đối (PostgreSQL RLS)</h4>
                <p>Bảo mật đa khách thuê (Multi-tenant) mạnh mẽ, không rò rỉ dữ liệu giữa các doanh nghiệp.</p>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <CheckCircle2 size={18} />
              </div>
              <div className="auth-feature-text">
                <h4>Chuyển giao mượt mà (Staff Handoff)</h4>
                <p>Nhân viên có thể tiếp quản ngay tức thì, ghi chú nội bộ và theo dõi trạng thái khách hàng.</p>
              </div>
            </div>
          </div>

          {/* Interactive AI Chat Playground */}
          <div className="auth-interactive-chat">
            <div className="auth-chat-header">
              <div className="auth-chat-avatar-group">
                <div className="auth-chat-avatar" style={{background: 'white', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}}>
                  <img src="/gotek-logo.png" alt="GoTek" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
                </div>
                <div>
                  <strong style={{fontSize: 12.5, color: '#f8fafc', display: 'block'}}>GoTek AI Assistant</strong>
                  <span style={{fontSize: 10.5, color: '#94a3b8'}}>Trợ lý ảo doanh nghiệp thông minh</span>
                </div>
              </div>
              <div className="auth-chat-status">
                <span>Trực tuyến</span>
              </div>
            </div>

            {/* Clickable Quick Prompts */}
            <div className="auth-chips-bar">
              {DEMO_PROMPTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`auth-chip-btn ${activePromptId === p.id ? 'active' : ''}`}
                  onClick={() => handleSelectPrompt(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Chat Body with dynamic animated bubbles */}
            <div className="auth-chat-body" key={currentPrompt.id + (isTyping ? '-typing' : '-ready')}>
              <div className="auth-bubble user">
                {currentPrompt.userMsg}
              </div>

              {isTyping ? (
                <div className="auth-typing-row">
                  <span className="auth-typing-dots">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span>AI đang truy xuất kho tri thức đã kiểm chứng...</span>
                </div>
              ) : (
                <>
                  <div className="auth-bubble ai">
                    {currentPrompt.aiMsg}
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#93c5fd', marginTop: 2}}>
                    <CheckCircle2 size={12} style={{color: '#34d399'}} />
                    <span>Dẫn nguồn: <strong>{currentPrompt.source}</strong></span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{fontSize: 11.5, color: '#64748b', zIndex: 3, marginTop: 12}}>
          © 2026 GoTek IT Solutions. All rights reserved.
        </div>
      </section>

      {/* --------------------------------------------------------------------
          Right Column: Ultra-Clean Floating Glass Form
          -------------------------------------------------------------------- */}
      <section className="auth-form-column">
        <div className="auth-form-card">
          <div className="auth-card-header">
            <Link to="/app/login">
              <img className="auth-logo-img" src="/gotek-logo.png" alt="GoTek Logo" />
            </Link>
            <h1>
              {signup
                ? 'Đăng ký doanh nghiệp'
                : verify
                  ? 'Xác thực email'
                  : reset
                    ? 'Khôi phục mật khẩu'
                    : 'Đăng nhập hệ thống'}
            </h1>
            <p>
              {signup
                ? 'Bắt đầu sử dụng nền tảng CSKH AI thông minh chỉ trong vài phút'
                : reset
                  ? 'Nhập email để nhận liên kết đặt lại mật khẩu'
                  : 'Chào mừng trở lại! Vui lòng nhập thông tin tài khoản của bạn'}
            </p>
          </div>

          {/* Mode Switcher Tabs with Animated Sliding Pill */}
          {!reset && !verify && (
            <div className="auth-tabs-wrapper">
              <div className={`auth-tab-slider ${signup ? 'signup' : ''}`} />
              <button
                type="button"
                className={`auth-tab-btn ${!signup ? 'active' : ''}`}
                onClick={() => navigate('/app/login')}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                className={`auth-tab-btn ${signup ? 'active' : ''}`}
                onClick={() => navigate('/app/auth/signup')}
              >
                Đăng ký mới
              </button>
            </div>
          )}

          {/* Feedback Notice Box */}
          {error && (
            <div className="auth-notice-box error" role="alert">
              <AlertCircle size={18} style={{flexShrink: 0, marginTop: 2}} />
              <div>{error.message}</div>
            </div>
          )}

          {message && (
            <div className="auth-notice-box success" role="status">
              <CheckCircle2 size={18} style={{flexShrink: 0, marginTop: 2}} />
              <div>{message}</div>
            </div>
          )}

          <form onSubmit={submit}>
            <fieldset disabled={busy} style={{border: 0, padding: 0, margin: 0}}>
              {/* Sign Up Fields */}
              {signup && (
                <>
                  <div className="auth-input-group">
                    <label htmlFor="fullName">Họ và tên của bạn</label>
                    <div className="auth-input-wrapper">
                      <input
                        id="fullName"
                        name="fullName"
                        className="auth-input-field"
                        placeholder="Nguyễn Văn A"
                        required
                        maxLength={120}
                      />
                      <div className="auth-input-icon">
                        <User size={18} />
                      </div>
                    </div>
                    {fields.fullName && <span className="auth-field-error">{fields.fullName.join(' ')}</span>}
                  </div>

                  <div className="auth-input-group">
                    <label htmlFor="business">Tên công ty / Doanh nghiệp</label>
                    <div className="auth-input-wrapper">
                      <input
                        id="business"
                        name="business"
                        className="auth-input-field"
                        placeholder="Công ty TNHH Giải Pháp Công Nghệ..."
                        required
                        maxLength={160}
                      />
                      <div className="auth-input-icon">
                        <Building2 size={18} />
                      </div>
                    </div>
                    {fields.business && <span className="auth-field-error">{fields.business.join(' ')}</span>}
                  </div>
                </>
              )}

              {/* Email Field */}
              {!verify && !(reset && token) && (
                <div className="auth-input-group">
                  <label htmlFor="email">Địa chỉ Email</label>
                  <div className="auth-input-wrapper">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className="auth-input-field"
                      placeholder="ban@doanhnghiep.com"
                      required
                      maxLength={254}
                    />
                    <div className="auth-input-icon">
                      <Mail size={18} />
                    </div>
                  </div>
                  {fields.email && <span className="auth-field-error">{fields.email.join(' ')}</span>}
                </div>
              )}

              {/* Additional Sign Up Details */}
              {signup && (
                <>
                  <div className="auth-input-group">
                    <label htmlFor="phone">Số điện thoại liên hệ</label>
                    <div className="auth-input-wrapper">
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        className="auth-input-field"
                        placeholder="0912 345 678"
                        required
                        maxLength={25}
                      />
                      <div className="auth-input-icon">
                        <Phone size={18} />
                      </div>
                    </div>
                    {fields.phone && <span className="auth-field-error">{fields.phone.join(' ')}</span>}
                  </div>

                  <div className="auth-input-group">
                    <label htmlFor="referral">Mã giới thiệu (nếu có)</label>
                    <div className="auth-input-wrapper">
                      <input
                        id="referral"
                        name="referral"
                        className="auth-input-field"
                        placeholder="Nhập mã ưu đãi hoặc đối tác..."
                        maxLength={80}
                      />
                      <div className="auth-input-icon">
                        <Sparkles size={18} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Password Field */}
              {((!reset && !verify) || (reset && token)) && (
                <div className="auth-input-group">
                  <label htmlFor="password">
                    {reset && token ? 'Mật khẩu mới' : 'Mật khẩu'}
                    {signup && <span style={{fontSize: 12, fontWeight: 400, color: '#64748b'}}> (tối thiểu 12 ký tự)</span>}
                  </label>
                  <div className="auth-input-wrapper">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className="auth-input-field"
                      placeholder="••••••••••••"
                      required
                      minLength={signup || reset ? 12 : undefined}
                      maxLength={128}
                    />
                    <div className="auth-input-icon">
                      <Lock size={18} />
                    </div>
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {fields.password && <span className="auth-field-error">{fields.password.join(' ')}</span>}
                </div>
              )}

              {/* Remember Me & Forgot Password */}
              {!signup && !reset && !verify && (
                <div className="auth-form-extras">
                  <label className="auth-remember-label">
                    <input name="remember" type="checkbox" defaultChecked />
                    <span>Ghi nhớ đăng nhập</span>
                  </label>
                  <Link to="/app/auth/reset" className="auth-forgot-link">
                    Quên mật khẩu?
                  </Link>
                </div>
              )}

              {/* Submit Button with Shimmer and Arrow Micro-animation */}
              <button
                type="submit"
                className="auth-submit-btn"
                disabled={busy || (verify && !token)}
              >
                {busy ? (
                  <>
                    <span className="auth-spinner" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {signup
                        ? 'Tạo tài khoản doanh nghiệp'
                        : verify
                          ? 'Xác thực email'
                          : reset
                            ? 'Gửi yêu cầu khôi phục'
                            : 'Đăng nhập vào không gian làm việc'}
                    </span>
                    <ArrowRight size={18} className="auth-btn-arrow" />
                  </>
                )}
              </button>
            </fieldset>
          </form>

          {/* Footer Back Link */}
          <div className="auth-footer">
            {signup || reset || verify ? (
              <p>
                Đã có tài khoản? <Link to="/app/login">Đăng nhập ngay</Link>
              </p>
            ) : (
              <p>
                Chưa có không gian làm việc? <Link to="/app/auth/signup">Đăng ký doanh nghiệp</Link>
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
