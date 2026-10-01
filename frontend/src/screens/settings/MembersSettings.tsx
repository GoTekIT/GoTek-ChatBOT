import React, {useState, useEffect} from 'react';
import {api} from '@/api/api';
import {Field} from '../../components/common/Field';
import {Notice} from '../../components/common/Notice';
import {can, canManageMember, type AuthorizationContext} from '../../services/authorization';
import './members-settings.css';

interface MembersSettingsProps {
  onChange: () => Promise<void>;
  authorization: AuthorizationContext;
}

export function MembersSettings({onChange, authorization}: MembersSettingsProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const activeOwners = members.filter(m => m.active && m.role === 'Owner').length;

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
      await onChange();
      await load();
      setMessage('Đã lưu thay đổi.');
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  const [createdInvite, setCreatedInvite] = useState<{email: string; inviteUrl: string} | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="members-settings">
      <h1>Quản lý nhân sự</h1>
      <div className="tabs">Nhân viên</div>
      <Notice error={error} message={message} />
      <section className="panel">
        <h2>Mời thành viên</h2>
        <p className="muted">
          Môi trường thử nghiệm: lời mời được lưu vào hộp thư local và tạo liên kết trực tiếp để gửi nhân viên.
        </p>

        {createdInvite && (
          <div style={{
            margin: '12px 0 16px 0',
            padding: '14px 16px',
            backgroundColor: '#e8f3ff',
            borderRadius: '10px',
            border: '1px solid #99c8ff',
            color: '#0e42d2'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '13px' }}>
                🎉 Đã tạo liên kết mời thành công cho: {createdInvite.email}
              </strong>
              <button
                type="button"
                onClick={() => setCreatedInvite(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#666' }}
              >
                ✕
              </button>
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#333' }}>
              Hãy sao chép liên kết này gửi cho nhân viên (qua Zalo/Slack/email nội bộ). Nhân viên chỉ cần mở liên kết này trên trình duyệt và bấm &quot;Chấp nhận lời mời&quot; để tham gia ca trực:
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                readOnly
                value={`${window.location.origin}${createdInvite.inviteUrl}`}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  borderRadius: '6px',
                  border: '1px solid #ccd',
                  backgroundColor: '#fff'
                }}
              />
              <button
                type="button"
                className="primary"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}${createdInvite.inviteUrl}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                }}
                style={{ whiteSpace: 'nowrap', padding: '6px 14px' }}
              >
                {copied ? '✓ Đã sao chép!' : '📋 Sao chép link'}
              </button>
            </div>
          </div>
        )}

        <form
          onSubmit={async e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const data = Object.fromEntries(f);
            setBusy(true);
            setError(null);
            try {
              const res: any = await api('/invitations', 'POST', data);
              await onChange();
              await load();
              if (res?.inviteUrl) {
                setCreatedInvite({
                  email: data.email as string,
                  inviteUrl: res.inviteUrl
                });
                setMessage(`Đã tạo liên kết mời cho ${data.email}.`);
              } else {
                setMessage('Đã lưu thay đổi.');
              }
            } catch (err) {
              setError(err as Error);
            } finally {
              setBusy(false);
            }
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
                    disabled={busy || !canManageMember(authorization, m, activeOwners)}
                    onChange={e =>
                      void action(() =>
                        api(`/members/${m.id}`, 'PATCH', {role: e.target.value, active: m.active})
                      )
                    }
                  >
                    {(can(authorization, 'ownership.manage') || m.role === 'Owner') && <option>Owner</option>}
                    <option>Admin</option>
                    <option>Agent</option>
                  </select>
                </td>
                <td>{m.active ? 'Hoạt động' : 'Đã thu hồi'}</td>
                <td>
                  <button
                    disabled={busy || !canManageMember(authorization, m, activeOwners)}
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
    </div>
  );
}
