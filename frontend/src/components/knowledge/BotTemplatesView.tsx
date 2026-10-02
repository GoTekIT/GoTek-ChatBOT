import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../../api/api';

export interface BotTemplate {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  category: string;
  media_urls: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotMedia {
  id: string;
  title: string;
  file_url: string;
  mime_type: string;
  byte_size: number;
  tags: string[];
  created_at: string;
}

interface BotTemplatesViewProps {
  onNotify: (msg: string) => void;
}

export const BotTemplatesView: React.FC<BotTemplatesViewProps> = ({ onNotify }) => {
  const [activeSubTab, setActiveSubTab] = useState<'templates' | 'media'>('templates');
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [mediaList, setMediaList] = useState<BotMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Template Modal
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BotTemplate | null>(null);
  const [shortcut, setShortcut] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Chăm sóc khách hàng');
  const [mediaUrlsInput, setMediaUrlsInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Media Modal
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaMime, setMediaMime] = useState('image/png');
  const [mediaTags, setMediaTags] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [tpls, medias] = await Promise.all([
        api('/bot/templates'),
        api('/bot/media'),
      ]);
      setTemplates(tpls || []);
      setMediaList(medias || []);
    } catch (err: any) {
      console.warn('Lỗi tải dữ liệu mẫu câu bot:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setShortcut('/');
    setTitle('');
    setContent('');
    setCategory('Chăm sóc khách hàng');
    setMediaUrlsInput('');
    setError(null);
    setIsTemplateModalOpen(true);
  };

  const openEditTemplate = (tpl: BotTemplate) => {
    setEditingTemplate(tpl);
    setShortcut(tpl.shortcut);
    setTitle(tpl.title);
    setContent(tpl.content);
    setCategory(tpl.category || 'General');
    setMediaUrlsInput((tpl.media_urls || []).join('\n'));
    setError(null);
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortcut.trim() || !title.trim() || !content.trim()) {
      setError('Vui lòng điền đầy đủ phím tắt, tiêu đề và nội dung.');
      return;
    }
    setBusy(true);
    setError(null);

    const media_urls = mediaUrlsInput
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u));

    try {
      if (editingTemplate) {
        await api(`/bot/templates/${editingTemplate.id}`, 'PATCH', {
          shortcut: shortcut.trim(),
          title: title.trim(),
          content: content.trim(),
          category: category.trim(),
          media_urls,
        });
        onNotify(`Đã cập nhật mẫu câu "${shortcut.trim()}"`);
      } else {
        await api('/bot/templates', 'POST', {
          shortcut: shortcut.trim(),
          title: title.trim(),
          content: content.trim(),
          category: category.trim(),
          media_urls,
        });
        onNotify(`Đã tạo mẫu câu mới "${shortcut.trim()}"`);
      }
      setIsTemplateModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu mẫu câu');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTemplate = async (tpl: BotTemplate) => {
    if (!confirm(`Bạn có chắc chắn muốn xoá mẫu câu "${tpl.shortcut}"?`)) return;
    try {
      await api(`/bot/templates/${tpl.id}`, 'DELETE');
      onNotify(`Đã xoá mẫu câu "${tpl.shortcut}"`);
      await loadData();
    } catch (err: any) {
      onNotify(`Lỗi xoá mẫu câu: ${err.message || 'Thử lại'}`);
    }
  };

  const handleSaveMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaTitle.trim() || !mediaUrl.trim()) return;
    setBusy(true);
    try {
      const tags = mediaTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await api('/bot/media', 'POST', {
        title: mediaTitle.trim(),
        file_url: mediaUrl.trim(),
        mime_type: mediaMime,
        byte_size: 1024 * 50, // 50KB default estimate for remote URL
        tags,
      });
      onNotify(`Đã thêm ảnh "${mediaTitle.trim()}" vào thư viện dùng cho bot`);
      setIsMediaModalOpen(false);
      setMediaTitle('');
      setMediaUrl('');
      setMediaTags('');
      await loadData();
    } catch (err: any) {
      onNotify(`Lỗi lưu hình ảnh: ${err.message || 'Thử lại'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteMedia = async (media: BotMedia) => {
    if (!confirm(`Xoá hình ảnh "${media.title}" khỏi thư viện?`)) return;
    try {
      await api(`/bot/media/${media.id}`, 'DELETE');
      onNotify(`Đã xoá hình ảnh "${media.title}"`);
      await loadData();
    } catch (err: any) {
      onNotify(`Lỗi xoá: ${err.message || 'Thử lại'}`);
    }
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.shortcut.toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">quickreply</span>
            Mẫu câu nhanh & Thư viện ảnh dùng cho Bot (UC-038)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Soạn các mẫu phản hồi với phím tắt gõ nhanh (ví dụ: <code className="bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded text-blue-700 dark:text-blue-300">/chao</code>, <code className="bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded text-blue-700 dark:text-blue-300">/gia</code>) và hình ảnh xác thực cho nhân viên & AI gợi ý.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === 'templates' ? (
            <button
              onClick={openCreateTemplate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Thêm mẫu câu mới
            </button>
          ) : (
            <button
              onClick={() => setIsMediaModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
              Thêm ảnh cho Bot
            </button>
          )}
        </div>
      </div>

      {/* Sub Tabs Selector */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('templates')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === 'templates'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">chat</span>
          Mẫu câu phản hồi ({templates.length})
        </button>
        <button
          onClick={() => setActiveSubTab('media')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === 'media'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">image</span>
          Thư viện ảnh minh họa ({mediaList.length})
        </button>
      </div>

      {/* Tab Content: Templates */}
      {activeSubTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm mẫu câu theo phím tắt hoặc nội dung..."
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-xs text-slate-500">
              Hiển thị {filteredTemplates.length} / {templates.length} mẫu
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Đang tải danh sách mẫu câu...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <span className="material-symbols-outlined text-slate-400 text-4xl mb-2">short_text</span>
              <p className="text-xs text-slate-500">Chưa có mẫu câu nào. Bấm &quot;Thêm mẫu câu mới&quot; để tạo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((t) => (
                <div
                  key={t.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold border border-blue-200 dark:border-blue-900">
                        {t.shortcut}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                        {t.category}
                      </span>
                    </div>

                    <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">{t.title}</h4>

                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      {t.content}
                    </p>

                    {t.media_urls && t.media_urls.length > 0 && (
                      <div className="flex items-center gap-1.5 pt-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                        <span className="material-symbols-outlined text-[14px]">attachment</span>
                        <span>Đính kèm {t.media_urls.length} hình ảnh</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 mt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => openEditTemplate(t)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(t)}
                      className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                    >
                      Xoá
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Media Library */}
      {activeSubTab === 'media' && (
        <div className="space-y-4">
          {mediaList.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <span className="material-symbols-outlined text-slate-400 text-4xl mb-2">perm_media</span>
              <p className="text-xs text-slate-500">Chưa có ảnh nào trong thư viện Bot. Thêm ảnh để dùng trong câu trả lời mẫu hoặc hướng dẫn.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {mediaList.map((m) => (
                <div
                  key={m.id}
                  className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col justify-between"
                >
                  <div className="aspect-square bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden">
                    <img
                      src={m.file_url}
                      alt={m.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="p-2.5 space-y-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate" title={m.title}>
                      {m.title}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{m.mime_type.split('/')[1]?.toUpperCase()}</span>
                      <button
                        onClick={() => handleDeleteMedia(m)}
                        className="text-rose-500 hover:underline"
                      >
                        Xoá
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Create/Edit Template */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              {editingTemplate ? 'Chỉnh sửa mẫu câu' : 'Tạo mẫu câu phản hồi mới'}
            </h3>

            {error && <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 text-xs rounded-xl">{error}</div>}

            <form onSubmit={handleSaveTemplate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phím tắt (Shortcut) *
                  </label>
                  <input
                    type="text"
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value)}
                    placeholder="/chao, /gia, /hotro..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nhóm chủ đề
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Bán hàng, Kỹ thuật..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tiêu đề gợi nhớ *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Lời chào khách mới, Hướng dẫn thanh toán..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nội dung phản hồi *
                </label>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Chào bạn, mình là trợ lý ảo GoTek..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  URL hình ảnh đính kèm (Mỗi link một dòng)
                </label>
                <textarea
                  rows={2}
                  value={mediaUrlsInput}
                  onChange={(e) => setMediaUrlsInput(e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  disabled={busy}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl"
                >
                  {busy ? 'Đang lưu...' : 'Lưu mẫu câu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Media */}
      {isMediaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Thêm hình ảnh vào thư viện Bot
            </h3>

            <form onSubmit={handleSaveMedia} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tên / Mô tả hình ảnh *
                </label>
                <input
                  type="text"
                  value={mediaTitle}
                  onChange={(e) => setMediaTitle(e.target.value)}
                  placeholder="Bảng giá năm 2026, Sơ đồ chỉ dẫn..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  URL hình ảnh trực tiếp (HTTPS) *
                </label>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://domain.com/image.png"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Định dạng
                  </label>
                  <select
                    value={mediaMime}
                    onChange={(e) => setMediaMime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  >
                    <option value="image/png">PNG</option>
                    <option value="image/jpeg">JPEG</option>
                    <option value="image/webp">WEBP</option>
                    <option value="image/svg+xml">SVG</option>
                    <option value="image/gif">GIF</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Thẻ gắn (Tags)
                  </label>
                  <input
                    type="text"
                    value={mediaTags}
                    onChange={(e) => setMediaTags(e.target.value)}
                    placeholder="banggia, huongdan"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMediaModalOpen(false)}
                  disabled={busy}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl"
                >
                  {busy ? 'Đang lưu...' : 'Thêm vào thư viện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
