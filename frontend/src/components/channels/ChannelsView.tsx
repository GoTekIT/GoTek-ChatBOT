import React, { useState, useEffect } from 'react';
import { api } from '../../api/api';

interface ChannelRow {
  id: string;
  name: string;
  origin: string;
  greeting: string;
  color: string;
  enabled: boolean;
}

export const ChannelsView: React.FC = () => {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [installSnippet, setInstallSnippet] = useState<{ id: string; name: string; snippet: string; origin: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    origin: '',
    greeting: 'Xin chào! Chúng tôi có thể giúp gì cho bạn?',
    color: '#0057E1',
  });
  const [busy, setBusy] = useState(false);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadChannels = async () => {
    try {
      setLoading(true);
      const rows: ChannelRow[] = await api('/channels');
      setChannels(rows);
    } catch (e: any) {
      triggerToast(`Lỗi tải danh sách kênh: ${e.message || 'Không thể kết nối'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChannels();
  }, []);

  const handleToggleChannel = async (id: string, currentEnabled: boolean) => {
    try {
      await api(`/channels/${id}/state`, 'PATCH', { enabled: !currentEnabled });
      triggerToast(currentEnabled ? 'Đã tắt kênh hội thoại' : 'Đã kích hoạt kênh hội thoại');
      await loadChannels();
    } catch (e: any) {
      triggerToast(`Lỗi: ${e.message || 'Không thể đổi trạng thái'}`);
    }
  };

  const handleShowSnippet = async (id: string) => {
    try {
      const data = await api(`/channels/${id}/installation`);
      setInstallSnippet(data);
    } catch (e: any) {
      triggerToast(`Lỗi lấy mã nhúng: ${e.message}`);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.origin.trim()) return;
    setBusy(true);
    try {
      await api('/channels', 'POST', {
        requestId: crypto.randomUUID(),
        name: createForm.name.trim(),
        origin: createForm.origin.trim(),
        greeting: createForm.greeting.trim(),
        color: createForm.color,
        agents: [],
      });
      triggerToast('Đã tạo kênh Live Widget mới thành công');
      setIsCreating(false);
      setCreateForm({
        name: '',
        origin: '',
        greeting: 'Xin chào! Chúng tôi có thể giúp gì cho bạn?',
        color: '#0057E1',
      });
      await loadChannels();
    } catch (e: any) {
      triggerToast(`Lỗi tạo kênh: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-[#faf8ff] dark:bg-[#080c14] text-xs transition-colors">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#131b2e] dark:bg-slate-900 text-white text-xs px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 border border-blue-500/50">
          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#c7c4d8]/60 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#131b2e] dark:text-slate-100 tracking-tight">
            Kênh giao tiếp & Tích hợp Widget
          </h1>
          <p className="text-[#464555] dark:text-slate-400 mt-1">
            Quản lý các điểm chạm khách hàng: Web Chat Widget được bảo vệ bằng Domain Whitelist và RAG phân quyền.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-[#4f46e5] text-white rounded-lg font-semibold hover:bg-[#4338ca] flex items-center gap-2 shadow-xs shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Thêm kênh mới</span>
        </button>
      </div>

      {/* Modal: Create Channel */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-[#131b2e] dark:text-slate-100">Tạo kênh Website Widget mới</h3>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateChannel} className="space-y-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Tên kênh / Website</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Trang chủ Gotek Landing"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Domain cho phép (Origin)</label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com"
                  value={createForm.origin}
                  onChange={(e) => setCreateForm({ ...createForm, origin: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Lời chào mở đầu</label>
                <textarea
                  rows={2}
                  value={createForm.greeting}
                  onChange={(e) => setCreateForm({ ...createForm, greeting: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Màu chủ đề Widget</label>
                <input
                  type="color"
                  value={createForm.color}
                  onChange={(e) => setCreateForm({ ...createForm, color: e.target.value })}
                  className="w-16 h-8 p-0 border-0 rounded cursor-pointer"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-[#4f46e5] text-white rounded-lg font-semibold hover:bg-[#4338ca] disabled:opacity-50"
                >
                  {busy ? 'Đang lưu...' : 'Tạo kênh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Embed Installation Snippet */}
      {installSnippet && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#131b2e] dark:text-slate-100">Mã nhúng: {installSnippet.name}</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Chỉ hoạt động trên domain đã khai báo: <code>{installSnippet.origin}</code></p>
              </div>
              <button onClick={() => setInstallSnippet(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <textarea
              readOnly
              rows={6}
              value={installSnippet.snippet}
              className="w-full font-mono text-[11px] p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(installSnippet.snippet);
                  triggerToast('Đã sao chép mã nhúng vào clipboard');
                }}
                className="px-4 py-2 bg-[#4f46e5] text-white rounded-lg font-semibold hover:bg-[#4338ca] flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span>Sao chép mã nhúng</span>
              </button>
              <button
                onClick={() => setInstallSnippet(null)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-12 text-center text-slate-400">
          <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
          <p className="mt-2">Đang tải danh sách kênh từ cơ sở dữ liệu...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && channels.length === 0 && (
        <div className="py-16 text-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-8 space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">chat_bubble_outline</span>
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Chưa có kênh nào trong không gian làm việc</h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs max-w-md mx-auto">
            Tạo kênh Live Widget để bắt đầu nhúng vào website và tiếp nhận khách hàng với trợ lý AI Copilot.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-[#4f46e5] text-white rounded-lg font-semibold hover:bg-[#4338ca] inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Tạo kênh đầu tiên</span>
          </button>
        </div>
      )}

      {/* Channels Grid */}
      {!loading && channels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className="p-5 bg-white dark:bg-slate-900 border border-[#c7c4d8]/70 dark:border-slate-800 rounded-xl shadow-xs flex flex-col justify-between space-y-4 hover:border-[#3525cd] transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: ch.color || '#0057E1' }}
                  >
                    <span className="material-symbols-outlined text-[22px]">language</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      ch.enabled
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {ch.enabled ? 'Hoạt động' : 'Tạm tắt'}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#131b2e] dark:text-slate-100">{ch.name}</h3>
                <p className="text-[11px] text-[#777587] dark:text-slate-400 font-mono mt-0.5 truncate">{ch.origin}</p>
                <p className="text-[#464555] dark:text-slate-300 mt-2 leading-relaxed line-clamp-2">
                  {ch.greeting || 'Xin chào! Chúng tôi có thể giúp gì cho bạn?'}
                </p>
              </div>

              <div className="pt-3 border-t border-[#eaedff] dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggleChannel(ch.id, ch.enabled)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    ch.enabled
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400'
                  }`}
                >
                  {ch.enabled ? 'Tắt kênh' : 'Bật kênh'}
                </button>
                <button
                  onClick={() => handleShowSnippet(ch.id)}
                  className="px-3 py-1 rounded bg-[#eaedff] dark:bg-slate-800 text-[#3525cd] dark:text-blue-400 font-semibold hover:bg-[#e2e7ff] dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px]">code</span>
                  <span>Mã nhúng</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};
