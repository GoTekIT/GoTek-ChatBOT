import React, {useState, type FormEvent} from 'react';
import {api, ApiError} from '../../api';
import {navigate} from '../../hooks/usePath';
import {Link} from '../../components/common/Link';
import {Field} from '../../components/common/Field';
import {Notice} from '../../components/common/Notice';

interface AuthProps {
  path: string;
  onLogin: () => void;
}

export function Auth({path, onLogin}: AuthProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState('');

  const signup = path === '/app/auth/signup';
  const reset = path === '/app/auth/reset';
  const verify = path === '/app/auth/verify';
  const token = new URLSearchParams(location.search).get('token');

  const title = signup
    ? 'Đăng ký doanh nghiệp'
    : verify
      ? 'Xác thực email'
      : reset
        ? 'Khôi phục mật khẩu'
        : 'Đăng nhập';

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage('');
    const form = new FormData(e.currentTarget);

    try {
      if (signup) {
        await api('/auth/signup', 'POST', Object.fromEntries(form));
        setMessage('Đã nhận yêu cầu. Kiểm tra hướng dẫn xác thực rồi đăng nhập.');
      } else if (verify) {
        await api('/auth/verify', 'POST', {token});
        setMessage('Email đã được xác thực. Bạn có thể đăng nhập.');
      } else if (reset) {
        if (token) {
          await api('/auth/reset', 'POST', {token, password: form.get('password')});
          setMessage('Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.');
        } else {
          const r = await api('/auth/request-reset', 'POST', {email: form.get('email')});
          setMessage(r.message);
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
        navigate(pending && pending.startsWith('/app/invitation#') ? pending : '/settings/general');
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  }

  const fields = error instanceof ApiError ? error.fields : {};

  return (
    <main className="auth">
      <img className="brand" src="/gotek-logo.png" alt="gotek" />
      <h1>{title}</h1>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          {signup && (
            <>
              <Field name="fullName" label="Tên đầy đủ" maxLength={120} error={fields.fullName} />
              <Field name="business" label="Tên doanh nghiệp" maxLength={160} error={fields.business} />
            </>
          )}

          {!verify && !(reset && token) && (
            <Field name="email" label="Email" type="email" maxLength={254} error={fields.email} />
          )}

          {signup && (
            <>
              <Field name="phone" label="Số điện thoại" type="tel" maxLength={25} error={fields.phone} />
              <Field name="referral" label="Mã giới thiệu" required={false} maxLength={80} error={fields.referral} />
            </>
          )}

          {((!reset && !verify) || (reset && token)) && (
            <Field
              name="password"
              label="Mật khẩu"
              type="password"
              minLength={signup || reset ? 12 : undefined}
              maxLength={128}
              error={fields.password}
            />
          )}

          {!signup && !reset && !verify && (
            <div className="form-options">
              <label>
                <input name="remember" type="checkbox" /> Ghi nhớ đăng nhập
              </label>
              <Link to="/app/auth/reset">Quên mật khẩu?</Link>
            </div>
          )}

          <Notice error={error} message={message} />
          <button className="primary wide" disabled={busy || (verify && !token)}>
            {busy ? 'Đang xử lý…' : signup ? 'Tạo tài khoản' : verify ? 'Xác thực email' : reset ? 'Gửi yêu cầu' : 'Đăng nhập'}
          </button>
        </fieldset>
      </form>
      <p>
        {signup || reset || verify ? (
          <Link to="/app/login">Quay lại đăng nhập</Link>
        ) : (
          <>
            Chưa có tài khoản? <Link to="/app/auth/signup">Đăng ký doanh nghiệp</Link>
          </>
        )}
      </p>
    </main>
  );
}
