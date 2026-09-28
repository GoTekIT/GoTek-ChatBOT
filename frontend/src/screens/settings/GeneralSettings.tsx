import React, {useState, useEffect, type FormEvent} from 'react';
import {api} from '@/api/api';
import {Field} from '../../components/common/Field';
import {Notice} from '../../components/common/Notice';

interface GeneralSettingsProps {
  role: string;
  onChange: () => void;
}

export function GeneralSettings({role, onChange}: GeneralSettingsProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    try {
      setData(await api('/workspace'));
      setError(null);
    } catch (e) {
      setError(e as Error);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/workspace', 'PATCH', Object.fromEntries(new FormData(e.currentTarget)));
      await load();
      onChange();
      setMessage('Đã cập nhật cài đặt doanh nghiệp.');
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Cài đặt doanh nghiệp</h1>
      <p className="muted">Quản lý thông tin doanh nghiệp và ngôn ngữ workspace.</p>
      <Notice error={error} message={message} />
      {!data ? (
        <button onClick={load}>Tải lại</button>
      ) : (
        <form className="panel" onSubmit={save}>
          <fieldset disabled={busy || !['Owner', 'Admin'].includes(role)}>
            <Field name="name" label="Tên doanh nghiệp" defaultValue={data.name} maxLength={160} />
            <label className="field">
              Ngôn ngữ
              <select name="language" defaultValue={data.language}>
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </label>
            <div className="field">
              <label>Workspace ID</label>
              <code>{data.id}</code>
            </div>
            <button className="primary">{busy ? 'Đang lưu…' : 'Cập nhật'}</button>
          </fieldset>
          {role === 'Agent' && <p>Bạn có quyền xem. Cần Admin hoặc Owner để cập nhật.</p>}
        </form>
      )}
    </>
  );
}
