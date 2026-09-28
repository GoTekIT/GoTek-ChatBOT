import React, {useState, useEffect} from 'react';
import {api} from '@/api/api';
import {Notice} from '../../components/common/Notice';

export function AuditSettings() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  async function load() {
    try {
      setRows(await api('/audit'));
      setError(null);
    } catch (e) {
      setError(e as Error);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <h1>Nhật ký hoạt động</h1>
      <p className="muted">Hoạt động quản trị trong workspace hiện tại.</p>
      <Notice error={error} />
      <button onClick={load}>Làm mới</button>
      {rows ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Hành động</th>
                <th>Đối tượng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString('vi-VN')}</td>
                  <td>{r.action}</td>
                  <td>
                    <code>{r.object_id}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p>Chưa có hoạt động.</p>}
        </div>
      ) : (
        <p>Đang tải…</p>
      )}
    </>
  );
}
