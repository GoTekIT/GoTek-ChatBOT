import React, {useState, useEffect} from 'react';
import {api} from '../../api';
import {Field} from '../../components/common/Field';
import {Notice} from '../../components/common/Notice';

interface MembersSettingsProps {
  onChange: () => void;
}

export function MembersSettings({onChange}: MembersSettingsProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [a, b] = await Promise.all([api('/members'), api('/invitations')]);
    setMembers(a);
    setInvites(b);
  }

  useEffect(() => {
    load().catch(setError);
  }, []);

  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChange();
      setMessage('Đã lưu thay đổi.');
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Quản lý nhân sự</h1>
      <div className="tabs">Nhân viên</div>
      <Notice error={error} message={message} />
      <section className="panel">
        <h2>Mời thành viên</h2>
        <p className="muted">
          Môi trường thử nghiệm: lời mời được lưu vào hộp thư local, chưa gửi email ra ngoài.
        </p>
        <form
          onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void action(() => api('/invitations', 'POST', Object.fromEntries(f)));
          }}
        >
          <fieldset disabled={busy}>
            <Field name="email" label="Email" type="email" />
            <label className="field">
              Vai trò
              <select name="role">
                <option>Agent</option>
                <option>Admin</option>
              </select>
            </label>
            <button className="primary">Mời thành viên</button>
          </fieldset>
        </form>
      </section>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id}>
                <td>{m.full_name}</td>
                <td>{m.email}</td>
                <td>
                  <select
                    aria-label={`Vai trò ${m.full_name}`}
                    value={m.role}
                    disabled={busy}
                    onChange={e =>
                      void action(() =>
                        api(`/members/${m.id}`, 'PATCH', {role: e.target.value, active: m.active})
                      )
                    }
                  >
                    <option>Owner</option>
                    <option>Admin</option>
                    <option>Agent</option>
                  </select>
                </td>
                <td>{m.active ? 'Hoạt động' : 'Đã thu hồi'}</td>
                <td>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(() =>
                        api(`/members/${m.id}`, 'PATCH', {role: m.role, active: !m.active})
                      )
                    }
                  >
                    {m.active ? 'Thu hồi' : 'Khôi phục'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Lời mời</h2>
      {!invites.length ? (
        <p className="empty">Chưa có lời mời.</p>
      ) : (
        invites.map(i => (
          <div className="list-row" key={i.id}>
            <span>
              {i.email} · {i.role}
            </span>
            <span>
              {i.accepted_at
                ? 'Đã nhận'
                : i.revoked_at
                  ? 'Đã thu hồi'
                  : new Date(i.expires_at) < new Date()
                    ? 'Hết hạn'
                    : 'Chờ nhận'}
            </span>
            {!i.accepted_at && !i.revoked_at && (
              <button
                disabled={busy}
                onClick={() => void action(() => api(`/invitations/${i.id}/revoke`, 'POST', {}))}
              >
                Thu hồi
              </button>
            )}
          </div>
        ))
      )}
    </>
  );
}
