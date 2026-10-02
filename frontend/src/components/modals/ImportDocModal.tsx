import React, { useState, useRef } from 'react';
import { api, ApiError } from '@api';

interface ImportDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (result: { count: number; filename: string }) => void;
  categories?: Array<{ id: string; name: string }>;
}

export const ImportDocModal: React.FC<ImportDocModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  categories = [],
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'web'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState<string>('');
  const [webUrl, setWebUrl] = useState('');
  const [crawlDepth, setCrawlDepth] = useState('2 Tầng liên kết');
  const [syncCadence, setSyncCadence] = useState('Hằng ngày');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (file: File | null) => {
    setErrorMessage(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isSupported = lowerName.endsWith('.pdf') || lowerName.endsWith('.docx') || lowerName.endsWith('.txt');
    if (!isSupported) {
      setErrorMessage('Định dạng tập tin chưa được hỗ trợ. Vui lòng chọn tệp .pdf, .docx hoặc .txt.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Tập tin vượt quá dung lượng tối đa 2MB cho phép.');
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (activeTab === 'file') {
      if (!selectedFile) {
        setErrorMessage('Vui lòng chọn hoặc kéo thả tệp tài liệu cần tải lên.');
        return;
      }

      setIsProcessing(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (categoryId) {
          formData.append('categoryId', categoryId);
        }

        const importId = crypto.randomUUID();
        const result = await api('/knowledge/import-document', 'POST', formData, {
          'x-gotek-import-id': importId,
        });

        const count = result.imported ?? (result.items ? result.items.length : 1);
        onImportSuccess({ count, filename: selectedFile.name });
        onClose();
      } catch (err) {
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage((err as Error).message || 'Không thể nhập tệp tin. Vui lòng kiểm tra lại.');
        }
      } finally {
        setIsProcessing(false);
      }
    } else {
      if (!webUrl.trim()) {
        setErrorMessage('Vui lòng nhập địa chỉ website hợp lệ.');
        return;
      }

      setIsProcessing(true);
      try {
        await api('/knowledge/items', 'POST', {
          title: `Trang web: ${webUrl.trim().replace(/^https?:\/\//, '')}`,
          content: `Tài liệu thu thập từ: ${webUrl.trim()}\nĐộ sâu: ${crawlDepth}\nChu kỳ đồng bộ: ${syncCadence}\nNgày thu thập: ${new Date().toLocaleDateString('vi-VN')}`,
          active: true,
          categoryId: categoryId || null,
          requestId: crypto.randomUUID(),
        });

        onImportSuccess({ count: 1, filename: webUrl.trim() });
        onClose();
      } catch (err) {
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage((err as Error).message || 'Không thể liên kết nguồn website.');
        }
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-[#c7c4d8] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#c7c4d8]/60 flex items-center justify-between bg-[#f8f9ff]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#3525cd] text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#131b2e]">Tải lên tài liệu tri thức</h3>
              <p className="text-[11px] text-[#464555]">Bóc tách văn bản tự động để huấn luyện AI Chatbot</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#777587] hover:text-[#131b2e] p-1.5 rounded-lg hover:bg-black/5 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 text-xs">
            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2.5 animate-in fade-in">
                <span className="material-symbols-outlined text-[18px] text-red-500 shrink-0">error</span>
                <span className="font-medium text-xs">{errorMessage}</span>
              </div>
            )}

            {/* Tabs for Import Mode */}
            <div className="flex border-b border-[#c7c4d8]/60 pb-2 gap-4 font-semibold">
              <button
                type="button"
                onClick={() => { setActiveTab('file'); setErrorMessage(null); }}
                className={`pb-1 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'file'
                    ? 'text-[#3525cd] border-b-2 border-[#3525cd]'
                    : 'text-[#777587] hover:text-[#131b2e]'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">upload_file</span>
                <span>Tập tin văn bản</span>
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('web'); setErrorMessage(null); }}
                className={`pb-1 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'web'
                    ? 'text-[#3525cd] border-b-2 border-[#3525cd]'
                    : 'text-[#777587] hover:text-[#131b2e]'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">language</span>
                <span>Thu thập từ Website</span>
              </button>
            </div>

            {/* Drag & Drop Zone or File selector */}
            {activeTab === 'file' ? (
              <div className="space-y-3.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />

                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#3525cd] bg-[#eaedff]/60 scale-[1.01]'
                      : selectedFile
                      ? 'border-emerald-500 bg-emerald-50/40'
                      : 'border-[#c7c4d8] hover:border-[#3525cd] hover:bg-[#f2f3ff]/50'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3 transition-colors ${
                    selectedFile ? 'bg-emerald-100 text-emerald-700' : 'bg-[#eaedff] text-[#3525cd]'
                  }`}>
                    <span className="material-symbols-outlined text-[24px]">
                      {selectedFile ? 'task' : 'upload_file'}
                    </span>
                  </div>

                  {selectedFile ? (
                    <div>
                      <div className="font-semibold text-xs text-emerald-900 flex items-center justify-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                        <span>{selectedFile.name}</span>
                      </div>
                      <p className="text-[11px] text-emerald-700 mt-1">
                        Dung lượng: {formatFileSize(selectedFile.size)} • Nhấp vào để chọn tệp khác
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="font-semibold text-xs text-[#131b2e]">
                        Kéo thả tài liệu vào đây, hoặc <span className="text-[#3525cd] hover:underline font-bold">chọn tệp từ máy</span>
                      </div>
                      <p className="text-[11px] text-[#777587] mt-1.5">
                        Hỗ trợ định dạng PDF, DOCX, TXT (Tối đa 2MB)
                      </p>
                    </div>
                  )}
                </div>

                {/* Category Selection */}
                {categories.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#131b2e] mb-1">
                      Danh mục tài liệu:
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full py-2 px-3 bg-[#f2f3ff] border border-[#c7c4d8] rounded-lg text-xs text-[#131b2e] focus:outline-none focus:border-[#3525cd]"
                    >
                      <option value="">-- Không phân loại --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              /* Web URL Section */
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#131b2e] mb-1">
                    Địa chỉ Website hoặc trang hỗ trợ
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#777587] text-[18px]">
                      language
                    </span>
                    <input
                      type="url"
                      value={webUrl}
                      onChange={(e) => setWebUrl(e.target.value)}
                      placeholder="https://acme.vn/chinh-sach-khach-hang"
                      className="w-full pl-9 pr-3 py-2 bg-[#f2f3ff] border border-[#c7c4d8] rounded-lg text-xs text-[#131b2e] focus:outline-none focus:border-[#3525cd]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-medium text-[#777587] block mb-1">
                      Độ sâu quét liên kết
                    </label>
                    <select
                      value={crawlDepth}
                      onChange={(e) => setCrawlDepth(e.target.value)}
                      className="w-full py-2 px-2.5 bg-[#f2f3ff] border border-[#c7c4d8] rounded-lg text-xs text-[#131b2e]"
                    >
                      <option>2 Tầng liên kết (Khuyên dùng)</option>
                      <option>3 Tầng liên kết</option>
                      <option>Chỉ trang hiện tại</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[#777587] block mb-1">
                      Tần suất đồng bộ
                    </label>
                    <select
                      value={syncCadence}
                      onChange={(e) => setSyncCadence(e.target.value)}
                      className="w-full py-2 px-2.5 bg-[#f2f3ff] border border-[#c7c4d8] rounded-lg text-xs text-[#131b2e]"
                    >
                      <option>Hằng ngày</option>
                      <option>Mỗi tuần</option>
                      <option>Thủ công</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Ingestion & Lifecycle Notice */}
            <div className="bg-[#f0f2ff] p-3 rounded-xl border border-[#c7c4d8]/60 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[17px] text-[#3525cd] shrink-0 mt-0.5">info</span>
              <div className="text-[11px] text-[#131b2e] leading-relaxed">
                Tài liệu sau khi tải lên sẽ ở trạng thái <strong className="text-purple-700">Bản nháp</strong>. Bạn có thể kiểm tra nội dung và nhấn <strong>"Xuất bản"</strong> bất cứ lúc nào để đưa vào phục vụ khách hàng.
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 bg-[#f8f9ff] border-t border-[#c7c4d8]/60 flex items-center justify-between">
            <span className="text-[11px] text-[#777587]">
              Dung lượng tối đa 2MB
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#131b2e] hover:bg-black/5 rounded-lg border border-[#c7c4d8] transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isProcessing || (activeTab === 'file' && !selectedFile)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#3525cd] hover:bg-[#281bb5] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs flex items-center gap-1.5 transition-all active:scale-[0.98]"
              >
                {isProcessing ? (
                  <>
                    <span className="material-symbols-outlined text-[15px] animate-spin">
                      progress_activity
                    </span>
                    <span>Đang trích xuất nội dung...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">file_upload</span>
                    <span>Tải lên tài liệu</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
