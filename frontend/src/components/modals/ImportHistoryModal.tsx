import React, { useState, useEffect } from 'react';
import { api, ApiError } from '@api';
import { formatBytes, formatDate } from '@/utils/formatters';

export interface KnowledgeImportReceipt {
  id: string;
  filename: string;
  mime_type: string;
  byte_size: number;
  content_hash: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  imported_count: number;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
}

interface ImportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ERROR_DESCRIPTIONS: Record<string, string> = {
  DOCUMENT_TOO_LARGE: 'Tập tin vượt quá dung lượng tối đa 2MB cho phép.',
  DOCUMENT_TEXT_TOO_LARGE: 'Nội dung văn bản vượt quá giới hạn 120.000 ký tự.',
  INVALID_DOCUMENT: 'Tập tin bị hỏng hoặc cấu trúc DOCX/PDF không đọc được.',
  EMPTY_DOCUMENT: 'Tài liệu rỗng, không tìm thấy nội dung văn bản.',
  UNSUPPORTED_DOCUMENT_FORMAT: 'Định dạng tập tin chưa được hỗ trợ (chỉ chấp nhận .pdf, .docx).',
  FILE_REQUIRED: 'Không tìm thấy tệp tải lên.',
  KNOWLEDGE_FILE_TOO_LARGE: 'Tệp tải lên vượt quá 10MB.',
  EMPTY_KNOWLEDGE_FILE: 'Tệp tải lên không có dữ liệu.',
  IDEMPOTENCY_CONFLICT: 'Yêu cầu nhập tệp bị trùng lặp.',
};

export const ImportHistoryModal: React.FC<ImportHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [items, setItems] = useState<KnowledgeImportReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'COMPLETED' | 'FAILED'>('ALL');

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/knowledge/imports?limit=50');
      setItems(data.items || []);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError((err as Error).message || 'Không thể tải lịch sử nhập tệp.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadHistory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredItems = items.filter((item) => {
    if (filter === 'ALL') return true;
    return item.status === filter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-[#c7c4d8] rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden text-[#131b2e]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#eaedff] flex items-center justify-between bg-[#f8f9ff]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#eaedff] text-[#3525cd] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">history</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-[#131b2e]">Lịch sử nhập tài liệu</h2>
              <p className="text-xs text-[#777587]">
                Theo dõi kết quả phân tích DOCX/PDF, lỗi phát sinh và biên nhận nhập tệp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#777587] hover:bg-[#eaedff] hover:text-[#131b2e] transition-colors"
            title="Đóng"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="px-6 py-3 border-b border-[#eaedff] flex items-center justify-between bg-white gap-3">
          <div className="flex items-center gap-1 bg-[#f2f3ff] p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === 'ALL'
                  ? 'bg-white text-[#3525cd] font-bold shadow-2xs'
                  : 'text-[#464555] hover:text-[#131b2e]'
              }`}
            >
              Tất cả ({items.length})
            </button>
            <button
              onClick={() => setFilter('COMPLETED')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === 'COMPLETED'
                  ? 'bg-white text-emerald-700 font-bold shadow-2xs'
                  : 'text-[#464555] hover:text-[#131b2e]'
              }`}
            >
              Thành công ({items.filter((i) => i.status === 'COMPLETED').length})
            </button>
            <button
              onClick={() => setFilter('FAILED')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === 'FAILED'
                  ? 'bg-white text-rose-700 font-bold shadow-2xs'
                  : 'text-[#464555] hover:text-[#131b2e]'
              }`}
            >
              Thất bại ({items.filter((i) => i.status === 'FAILED').length})
            </button>
          </div>

          <button
            onClick={() => void loadHistory()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#c7c4d8] rounded-xl text-xs font-semibold text-[#3525cd] hover:bg-[#eaedff] transition-colors"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Làm mới</span>
          </button>
        </div>

        {/* Content Table / Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {loading && items.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-[#777587] gap-3">
              <span className="material-symbols-outlined text-[32px] animate-spin text-[#3525cd]">
                progress_activity
              </span>
              <p className="text-xs">Đang tải lịch sử nhập tệp từ máy chủ...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-[#777587]">
              <span className="material-symbols-outlined text-[40px] text-[#c7c4d8] mb-2 block">
                folder_open
              </span>
              <p className="text-xs font-semibold">Chưa có bản ghi nhập tệp nào</p>
              <p className="text-[11px] text-[#777587] mt-0.5">
                Các lần tải lên tập tin DOCX, PDF sẽ được lưu vết đầy đủ tại đây.
              </p>
            </div>
          ) : (
            <div className="border border-[#eaedff] rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f8f9ff] text-[#464555] font-semibold border-b border-[#eaedff]">
                    <th className="py-3 px-4">Tên tệp</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    <th className="py-3 px-3">Dung lượng</th>
                    <th className="py-3 px-3">Kết quả / Lỗi</th>
                    <th className="py-3 px-3">Thời gian</th>
                    <th className="py-3 px-3 text-right">Tệp gốc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eaedff]">
                  {filteredItems.map((item) => {
                    const isSuccess = item.status === 'COMPLETED';
                    const isFailed = item.status === 'FAILED';
                    const errorDesc = item.error_code
                      ? ERROR_DESCRIPTIONS[item.error_code] || item.error_code
                      : null;

                    return (
                      <tr key={item.id} className="hover:bg-[#fcfdff] transition-colors">
                        <td className="py-3 px-4 font-medium text-[#131b2e]">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-[#777587]">
                              {item.filename.toLowerCase().endsWith('.pdf')
                                ? 'picture_as_pdf'
                                : 'description'}
                            </span>
                            <span className="truncate max-w-[220px]" title={item.filename}>
                              {item.filename}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#777587] font-mono mt-0.5">
                            SHA: {item.content_hash.slice(0, 12)}...
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          {isSuccess && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Thành công
                            </span>
                          )}
                          {isFailed && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              Thất bại
                            </span>
                          )}
                          {!isSuccess && !isFailed && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              Đang xử lý
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-[#464555]">{formatBytes(item.byte_size)}</td>

                        <td className="py-3 px-3">
                          {isSuccess ? (
                            <div className="text-emerald-700 font-medium">
                              Đã nạp {item.imported_count} mục tri thức
                            </div>
                          ) : isFailed ? (
                            <div className="text-rose-600">
                              <span className="font-semibold block">{item.error_code}</span>
                              <span className="text-[11px] text-[#464555]">{errorDesc}</span>
                            </div>
                          ) : (
                            <span className="text-[#777587]">Đang phân tích cú pháp...</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-[#777587]">{formatDate(item.created_at)}</td>

                        <td className="py-3 px-3 text-right">
                          <a
                            href={`/api/knowledge/imports/${item.id}/file`}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={item.filename}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#c7c4d8] text-[#3525cd] hover:bg-[#eaedff] text-[11px] font-semibold transition-colors"
                            title="Tải lại tệp gốc đã tải lên"
                          >
                            <span className="material-symbols-outlined text-[14px]">download</span>
                            <span>Tải về</span>
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#eaedff] flex items-center justify-between bg-[#f8f9ff]">
          <span className="text-[11px] text-[#777587]">
            Hệ thống lưu giữ bản gốc và lịch sử xử lý nhằm đảm bảo tính toàn vẹn (idempotency).
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#c7c4d8] text-[#131b2e] hover:bg-[#f2f3ff] rounded-xl text-xs font-semibold transition-all shadow-2xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
