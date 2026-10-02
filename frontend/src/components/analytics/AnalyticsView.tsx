import React, { useState, useEffect } from 'react';
import { api } from '../../api/api';

export const AnalyticsView: React.FC = () => {
  const [range, setRange] = useState<'7d' | '30d' | 'quarter'>('7d');
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<any[]>([]);
  const [citations, setCitations] = useState<any[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<any[]>([]);
  const [usageSummary, setUsageSummary] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    async function loadData() {
      setLoading(true);
      try {
        const [convList, citeList, kItems, usage] = await Promise.all([
          api('/conversations').catch(() => []),
          api('/citations').catch(() => []),
          api('/knowledge/items?limit=100').catch(() => ({ items: [] })),
          api('/usage').catch(() => []),
        ]);
        if (!alive) return;
        setConversations(convList);
        setCitations(citeList);
        setKnowledgeItems(Array.isArray(kItems) ? kItems : kItems.items || []);
        setUsageSummary(usage);
      } catch (e) {
        console.error('Failed to load telemetry from db:', e);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void loadData();
    return () => {
      alive = false;
    };
  }, [range]);

  const totalConvs = conversations.length;
  const resolvedConvs = conversations.filter((c) => c.status === 'resolved').length;
  const aiHandled = conversations.filter((c) => c.reply_owner === 'AI_ACTIVE').length;
  const handoffPending = conversations.filter((c) => c.reply_owner === 'HANDOFF_PENDING').length;
  const publishedDocs = knowledgeItems.filter((i) => i.published_version_id || i.state === 'READY').length;

  const deflectionRate = totalConvs > 0 ? ((aiHandled / totalConvs) * 100).toFixed(1) + '%' : '0%';
  const resolutionRate = totalConvs > 0 ? ((resolvedConvs / totalConvs) * 100).toFixed(1) + '%' : '0%';

  return (
    <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-[#faf8ff] dark:bg-[#080c14] text-xs transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#c7c4d8]/60 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#131b2e] dark:text-slate-100 tracking-tight">
            Thống kê Vận hành & Chỉ số AI
          </h1>
          <p className="text-[#464555] dark:text-slate-400 mt-1">
            Dữ liệu đo lường trực tiếp từ cơ sở dữ liệu: hội thoại khách hàng, tỷ lệ AI giải quyết và trích dẫn tri thức.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#eaedff] dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setRange('7d')}
            className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
              range === '7d' ? 'bg-white dark:bg-slate-700 text-[#3525cd] dark:text-blue-400 shadow-xs' : 'text-[#464555] dark:text-slate-400'
            }`}
          >
            7 ngày qua
          </button>
          <button
            onClick={() => setRange('30d')}
            className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
              range === '30d' ? 'bg-white dark:bg-slate-700 text-[#3525cd] dark:text-blue-400 shadow-xs' : 'text-[#464555] dark:text-slate-400'
            }`}
          >
            30 ngày qua
          </button>
          <button
            onClick={() => setRange('quarter')}
            className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
              range === 'quarter' ? 'bg-white dark:bg-slate-700 text-[#3525cd] dark:text-blue-400 shadow-xs' : 'text-[#464555] dark:text-slate-400'
            }`}
          >
            Quý này
          </button>
        </div>
      </div>

      {loading && (
        <div className="py-8 text-center text-slate-400">
          <span className="material-symbols-outlined text-2xl animate-spin">progress_activity</span>
          <p className="mt-1">Đang truy vấn số liệu thực tế từ cơ sở dữ liệu...</p>
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-[#c7c4d8]/70 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#777587] dark:text-slate-400">
            Tổng hội thoại
          </p>
          <p className="text-2xl font-bold text-[#131b2e] dark:text-slate-100 mt-1 font-mono">
            {totalConvs}
          </p>
          <p className="text-emerald-700 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">forum</span>
            <span>{resolvedConvs} hội thoại đã giải quyết</span>
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-[#c7c4d8]/70 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#777587] dark:text-slate-400">
            Tỷ lệ giải quyết
          </p>
          <p className="text-2xl font-bold text-[#131b2e] dark:text-slate-100 mt-1 font-mono">
            {resolutionRate}
          </p>
          <p className="text-blue-600 dark:text-blue-400 font-semibold mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">trending_up</span>
            <span>{handoffPending} ca đang chờ nhân viên</span>
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-[#c7c4d8]/70 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#777587] dark:text-slate-400">
            AI Tự động phục vụ
          </p>
          <p className="text-2xl font-bold text-[#3525cd] dark:text-blue-400 mt-1 font-mono">
            {deflectionRate}
          </p>
          <p className="text-[#464555] dark:text-slate-400 mt-1">
            {aiHandled} phiên hội thoại AI đang trực tuyến
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-[#c7c4d8]/70 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#777587] dark:text-slate-400">
            Tri thức đã công bố
          </p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
            {publishedDocs}
          </p>
          <p className="text-emerald-700 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">verified</span>
            <span>Tổng số {knowledgeItems.length} tài liệu trong kho</span>
          </p>
        </div>
      </div>

      {/* RAG Knowledge Retrieval Citations Table */}
      <div className="bg-white dark:bg-slate-900 border border-[#c7c4d8]/70 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#131b2e] dark:text-slate-100">
              Trích dẫn Tri thức RAG trong Cơ sở Dữ liệu
            </h3>
            <p className="text-[#464555] dark:text-slate-400 text-xs">
              Các nguồn tài liệu được AI truy xuất thực tế để tạo câu trả lời cho khách hàng.
            </p>
          </div>
          <span className="font-mono text-[11px] text-[#3525cd] dark:text-blue-400 bg-[#eaedff] dark:bg-blue-950/40 px-2 py-0.5 rounded font-bold border border-blue-200 dark:border-blue-800">
            pgvector RLS Enforced
          </span>
        </div>

        {citations.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <span className="material-symbols-outlined text-3xl mb-1 text-slate-300 dark:text-slate-600 block">
              menu_book
            </span>
            <p>Chưa có trích dẫn tài liệu nào được tạo trong không gian làm việc.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Khi khách hàng gửi câu hỏi qua Widget và AI tìm kiếm văn bản từ Kho tri thức, thông tin trích dẫn sẽ lưu vào bảng active_citations.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#eaedff] dark:divide-slate-800">
            {citations.map((item, i) => (
              <div key={item.id || i} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-[#eaedff] dark:bg-slate-800 text-[#3525cd] dark:text-blue-400 font-bold flex items-center justify-center font-mono">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-xs text-[#131b2e] dark:text-slate-100">
                      {item.title || item.source || `Trích dẫn #${item.id?.slice(0, 8)}`}
                    </p>
                    <p className="text-[11px] text-[#777587] dark:text-slate-400">
                      {item.url || item.document_id || 'Kho tri thức nội bộ'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 font-mono text-xs">
                  <div className="text-right">
                    <p className="font-bold text-[#131b2e] dark:text-slate-100">
                      {item.citation_count || 1} lần trích dẫn
                    </p>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                      Cập nhật: {item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : 'Mới'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};
