import React, { useState, useEffect, useRef } from 'react';
import { api, ApiError } from '@api';
import { ImportDocModal } from '../modals/ImportDocModal';
import { ImportHistoryModal } from '../modals/ImportHistoryModal';
import { BotTemplatesView } from './BotTemplatesView';
import { MultiStepFaqView } from './MultiStepFaqView';
import { WebSources } from '../../screens/knowledge/WebSources';

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  active: boolean;
  revision: number;
  created_at: string;
  updated_at: string;
  draft_version_id: string;
  published_version_id: string | null;
  audience: 'INTERNAL' | 'PUBLIC' | null;
  category_id: string | null;
  state: 'DRAFT' | 'READY' | 'FAILED';
  source_type?: string;
}

export interface KnowledgeCategory {
  id: string;
  name: string;
}

export interface KnowledgeVersion {
  id: string;
  version_no: number;
  title: string;
  content: string;
  state: 'DRAFT' | 'READY' | 'FAILED';
  first_published_at: string | null;
  created_at: string;
  processed_at: string | null;
}

interface KnowledgeBaseViewProps {
  authorization?: any;
  onSyncDocuments?: (docs: any[]) => void;
  // Backward compatibility props
  documents?: any[];
  onAddDocument?: (doc: any) => void;
  onUpdateDocument?: (id: string, updates: any) => void;
  onDeleteDocument?: (id: string) => void;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = () => {
  // Data state
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation SubTab state (UC-036 to UC-050)
  const [activeKnowledgeTab, setActiveKnowledgeTab] = useState<'documents' | 'faq' | 'bot_templates' | 'web_sources' | 'diagnostic'>('documents');

  // Category Quick Modal state (UC-036)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryBusy, setCategoryBusy] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'title'>('updated');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Action / Feedback
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // Detail Modal state (Xem chi tiết nội dung tài liệu)
  const [detailItem, setDetailItem] = useState<KnowledgeItem | null>(null);
  const [copiedContent, setCopiedContent] = useState(false);

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportHistoryOpen, setIsImportHistoryOpen] = useState(false);

  // Create / Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Version History modal state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<KnowledgeItem | null>(null);
  const [historyVersions, setHistoryVersions] = useState<KnowledgeVersion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Retrieval Preview / RAG Diagnostic test modal
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [testQuery, setTestQuery] = useState('');
  const [testAudience, setTestAudience] = useState<'PUBLIC' | 'INTERNAL'>('PUBLIC');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testBusy, setTestBusy] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const fetchSeq = useRef(0);

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3800);
  };

  // Load knowledge items & categories from backend
  const loadData = async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, catsRes] = await Promise.all([
        api('/knowledge/items?limit=100&sort=newest'),
        api('/knowledge-categories'),
      ]);
      if (seq !== fetchSeq.current) return;
      const loadedItems: KnowledgeItem[] = itemsRes.items || [];
      setItems(loadedItems);
      setCategories(catsRes || []);

      // If detail modal is open, keep its item state fresh
      if (detailItem) {
        const refreshedDetail = loadedItems.find((i) => i.id === detailItem.id);
        if (refreshedDetail) setDetailItem(refreshedDetail);
      }
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      setError((err as Error).message || 'Không thể tải danh sách tài liệu từ máy chủ.');
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    return () => {
      fetchSeq.current++;
    };
  }, []);

  // Filter items
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchContent = item.content.toLowerCase().includes(q);
      if (!matchTitle && !matchContent) return false;
    }

    if (categoryFilter !== 'all' && item.category_id !== categoryFilter) {
      return false;
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'published_public') {
        return item.published_version_id !== null && item.audience === 'PUBLIC';
      }
      if (statusFilter === 'internal') {
        return item.published_version_id !== null && item.audience === 'INTERNAL';
      }
      if (statusFilter === 'ready') {
        return item.state === 'READY' && item.published_version_id === null;
      }
      if (statusFilter === 'draft') {
        return item.state === 'DRAFT';
      }
    }

    return true;
  });

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title, 'vi');
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  // Category name lookup map
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Process draft (Draft -> READY)
  const handleProcess = async (item: KnowledgeItem) => {
    setActionBusyId(item.id);
    try {
      await api(`/knowledge/items/${item.id}/process`, 'POST', {
        requestId: crypto.randomUUID(),
        expectedRevision: item.revision,
        versionId: item.draft_version_id,
      });
      showNotification(`Đã kích hoạt tài liệu "${item.title}". Bây giờ bạn có thể xuất bản.`);
      await loadData();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') {
        showNotification('Tài liệu đã được cập nhật ở phiên khác. Vui lòng thử lại.');
      } else {
        showNotification(`Xử lý không thành công: ${(err as Error).message}`);
      }
    } finally {
      setActionBusyId(null);
    }
  };

  // Publish knowledge (READY -> PUBLIC / INTERNAL)
  const handlePublish = async (item: KnowledgeItem, audience: 'PUBLIC' | 'INTERNAL') => {
    setActionBusyId(item.id);
    try {
      await api(`/knowledge/items/${item.id}/publish`, 'POST', {
        requestId: crypto.randomUUID(),
        expectedRevision: item.revision,
        versionId: item.draft_version_id,
        audience,
      });
      showNotification(
        audience === 'PUBLIC'
          ? `Đã xuất bản công khai "${item.title}". AI Chatbot đã có thể sử dụng dữ liệu này.`
          : `Đã xuất bản nội bộ "${item.title}". Chỉ nhân viên tư vấn mới có quyền truy cập.`
      );
      await loadData();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') {
        showNotification('Dữ liệu đã thay đổi ở phiên khác. Vui lòng thử lại.');
      } else {
        showNotification(`Xuất bản không thành công: ${(err as Error).message}`);
      }
    } finally {
      setActionBusyId(null);
    }
  };

  // Switch between PUBLIC and INTERNAL
  const handleToggleAudience = async (item: KnowledgeItem) => {
    const nextAudience: 'PUBLIC' | 'INTERNAL' = item.audience === 'PUBLIC' ? 'INTERNAL' : 'PUBLIC';
    await handlePublish(item, nextAudience);
  };

  // Revoke publication of a knowledge item (UC-045)
  const handleUnpublish = async (item: KnowledgeItem) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn thu hồi xuất bản của tài liệu "${item.title}"? Dữ liệu này sẽ ngừng phục vụ khách hàng trên Widget ngay lập tức.`
      )
    ) {
      return;
    }
    setActionBusyId(item.id);
    try {
      await api(`/knowledge/items/${item.id}/unpublish`, 'POST', {
        requestId: crypto.randomUUID(),
        expectedRevision: item.revision,
      });
      showNotification(`Đã thu hồi xuất bản "${item.title}". Tài liệu chuyển về Chưa xuất bản.`);
      await loadData();
    } catch (err: any) {
      showNotification(`Thu hồi không thành công: ${err.message || 'Lỗi thử lại'}`);
    } finally {
      setActionBusyId(null);
    }
  };

  // Create new category (UC-036)
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setCategoryBusy(true);
    try {
      await api('/knowledge-categories', 'POST', { name: newCategoryName.trim() });
      showNotification(`Đã tạo danh mục "${newCategoryName.trim()}"`);
      setNewCategoryName('');
      setIsCategoryModalOpen(false);
      await loadData();
    } catch (err: any) {
      showNotification(`Lỗi tạo danh mục: ${err.message || 'Thử lại'}`);
    } finally {
      setCategoryBusy(false);
    }
  };

  // Delete knowledge item (Draft, Ready, or Published)
  const handleDeleteItem = async (item: KnowledgeItem) => {
    const isPub = item.published_version_id !== null;
    const confirmMsg = isPub
      ? `Bạn có chắc chắn muốn xoá tài liệu "${item.title}"? Dữ liệu này sẽ được gỡ bỏ hoàn toàn khỏi AI Chatbot và hệ thống.`
      : `Bạn có chắc chắn muốn xoá bản nháp "${item.title}"? Thao tác này không thể hoàn tác.`;

    if (!confirm(confirmMsg)) {
      return;
    }
    setActionBusyId(item.id);
    try {
      await api(`/knowledge/items/${item.id}`, 'DELETE');
      showNotification(`Đã xoá thành công "${item.title}".`);
      if (detailItem?.id === item.id) {
        setDetailItem(null);
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      await loadData();
    } catch (err) {
      showNotification(`Xoá không thành công: ${(err as Error).message}`);
    } finally {
      setActionBusyId(null);
    }
  };

  // Bulk delete selected items
  const handleBulkDelete = async () => {
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) return;

    if (
      !confirm(
        `Bạn có chắc chắn muốn xoá ${selectedItems.length} tài liệu đã chọn? Thao tác này không thể hoàn tác.`
      )
    ) {
      return;
    }

    let successCount = 0;
    let failCount = 0;
    for (const itm of selectedItems) {
      try {
        await api(`/knowledge/items/${itm.id}`, 'DELETE');
        successCount++;
      } catch (err) {
        failCount++;
        console.error(`Lỗi khi xoá ${itm.id}:`, err);
      }
    }

    if (failCount > 0) {
      showNotification(`Đã xoá ${successCount} tài liệu (${failCount} mục không thể xoá).`);
    } else {
      showNotification(`Đã xoá thành công ${successCount} tài liệu.`);
    }
    setSelectedIds(new Set());
    await loadData();
  };

  // Open modal to create new item
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormContent('');
    setFormCategoryId('');
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Open modal to edit draft
  const handleOpenEdit = (item: KnowledgeItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormContent(item.content);
    setFormCategoryId(item.category_id || '');
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Save draft mutation
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) {
      setFormError('Vui lòng nhập đầy đủ tiêu đề và nội dung tài liệu.');
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      if (editingItem) {
        await api(`/knowledge/items/${editingItem.id}/draft`, 'PATCH', {
          title: formTitle.trim(),
          content: formContent.trim(),
          expectedRevision: editingItem.revision,
          categoryId: formCategoryId || null,
          requestId: crypto.randomUUID(),
        });
        showNotification(`Đã lưu bản nháp mới cho "${formTitle.trim()}". Phiên bản đang phục vụ AI vẫn giữ nguyên.`);
      } else {
        await api('/knowledge/items', 'POST', {
          title: formTitle.trim(),
          content: formContent.trim(),
          active: true,
          categoryId: formCategoryId || null,
          requestId: crypto.randomUUID(),
        });
        showNotification(`Đã thêm tài liệu mới: "${formTitle.trim()}" (dạng Bản nháp).`);
      }
      setIsEditModalOpen(false);
      await loadData();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') {
        setFormError('Bản ghi đã bị thay đổi ở phiên khác. Vui lòng đóng cửa sổ và thử lại.');
      } else {
        setFormError((err as Error).message || 'Không thể lưu tài liệu.');
      }
    } finally {
      setFormBusy(false);
    }
  };

  // Open Version History
  const handleOpenHistory = async (item: KnowledgeItem) => {
    setHistoryItem(item);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const detail = await api(`/knowledge/items/${item.id}`);
      setHistoryVersions(detail.versions || []);
      setHistoryItem(detail);
    } catch (err) {
      setHistoryError((err as Error).message || 'Không thể tải lịch sử phiên bản.');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Restore previous version
  const handleRollback = async (targetVersion: KnowledgeVersion) => {
    if (!historyItem) return;
    if (confirm(`Bạn có chắc chắn muốn khôi phục về phiên bản v${targetVersion.version_no} ("${targetVersion.title}")?`)) {
      setHistoryBusy(true);
      setHistoryError(null);
      try {
        await api(`/knowledge/items/${historyItem.id}/rollback`, 'POST', {
          requestId: crypto.randomUUID(),
          expectedRevision: historyItem.revision,
          versionId: targetVersion.id,
        });
        showNotification(`Đã khôi phục thành công "${historyItem.title}" về phiên bản v${targetVersion.version_no}!`);
        const refreshed = await api(`/knowledge/items/${historyItem.id}`);
        setHistoryItem(refreshed);
        setHistoryVersions(refreshed.versions || []);
        await loadData();
      } catch (err) {
        if (err instanceof ApiError) {
          setHistoryError(err.message);
        } else {
          setHistoryError((err as Error).message || 'Không thể khôi phục phiên bản.');
        }
      } finally {
        setHistoryBusy(false);
      }
    }
  };

  // Run Diagnostic Test
  const handleRunDiagnosticTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim()) return;
    setTestBusy(true);
    setTestError(null);
    try {
      const res = await api(`/knowledge/retrieve?query=${encodeURIComponent(testQuery.trim())}&audience=${testAudience}&limit=5`);
      setTestResults(res.items || []);
    } catch (err) {
      setTestResults([]);
      setTestError((err as Error).message || 'Không tìm thấy dữ liệu phù hợp.');
    } finally {
      setTestBusy(false);
    }
  };

  // Copy full content
  const handleCopyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedContent(true);
    setTimeout(() => setCopiedContent(false), 2000);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Tiêu đề', 'Danh mục', 'Trạng thái', 'Phạm vi', 'Phiên bản', 'Cập nhật lần cuối'];
    const rows = sortedItems.map((item) => [
      item.id,
      `"${item.title.replace(/"/g, '""')}"`,
      `"${(categoryMap.get(item.category_id || '') || 'Chưa phân loại').replace(/"/g, '""')}"`,
      item.published_version_id ? 'Đã xuất bản' : item.state,
      item.audience === 'PUBLIC' ? 'Công khai' : item.audience === 'INTERNAL' ? 'Nội bộ' : 'Chưa xuất bản',
      `v${item.revision}`,
      `"${new Date(item.updated_at).toLocaleString('vi-VN')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GoTek_Knowledge_Base_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Đã xuất danh sách tài liệu ra tệp CSV.');
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sortedItems.map((d) => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Dynamic statistics
  const totalItemsCount = items.length;
  const publicItemsCount = items.filter((i) => i.published_version_id !== null && i.audience === 'PUBLIC').length;
  const internalItemsCount = items.filter((i) => i.published_version_id !== null && i.audience === 'INTERNAL').length;
  const pendingItemsCount = items.filter((i) => i.state === 'DRAFT' || (i.state === 'READY' && i.published_version_id === null)).length;

  return (
    <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-[#faf8ff] custom-scrollbar">
      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#131b2e] text-white text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 border border-[#c7c4d8]/40">
          <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
          <span className="font-medium">{actionNotice}</span>
        </div>
      )}

      {/* Global error banner if load failed */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600">error</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadData()}
            className="px-2.5 py-1 bg-white border border-red-300 text-red-700 font-semibold rounded-lg hover:bg-red-50"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* ================= HEADER SECTION ================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-[#131b2e] tracking-tight">
              Kho tri thức AI
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>RAG Engine</span>
            </span>
          </div>
          <p className="text-xs text-[#464555] mt-1 max-w-4xl">
            Quản lý dữ liệu tài liệu huấn luyện AI Chatbot. Phê duyệt xuất bản công khai hoặc nội bộ và kiểm soát các phiên bản tri thức phục vụ khách hàng.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Quick RAG Diagnostic Test Button */}
          <button
            onClick={() => setIsDiagnosticOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#c7c4d8] hover:bg-[#f2f3ff] text-[#131b2e] rounded-xl text-xs font-semibold transition-all active:scale-[0.98] shadow-2xs"
            type="button"
            title="Thử nghiệm truy xuất câu trả lời AI theo phân quyền Công khai / Nội bộ"
          >
            <span className="material-symbols-outlined text-[17px] text-[#3525cd]">science</span>
            <span>Thử nghiệm truy xuất</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#c7c4d8] hover:bg-[#f2f3ff] text-[#131b2e] rounded-xl text-xs font-semibold transition-all active:scale-[0.98]"
            type="button"
            title="Làm mới danh sách"
          >
            <span className={`material-symbols-outlined text-[17px] ${loading ? 'animate-spin text-[#3525cd]' : ''}`}>
              refresh
            </span>
            <span>Làm mới</span>
          </button>

          {/* Import Document Button */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#3525cd] text-[#3525cd] hover:bg-[#eaedff] rounded-xl text-xs font-semibold transition-all active:scale-[0.98] shadow-2xs"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            <span>Nhập tài liệu</span>
          </button>

          {/* Import History & Error Logs Button (UC-11) */}
          <button
            onClick={() => setIsImportHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#c7c4d8] hover:bg-[#f2f3ff] text-[#131b2e] rounded-xl text-xs font-semibold transition-all active:scale-[0.98] shadow-2xs"
            type="button"
            title="Xem lịch sử và lỗi các tệp DOCX / PDF đã nhập"
          >
            <span className="material-symbols-outlined text-[17px] text-[#464555]">history</span>
            <span>Lịch sử nhập tệp</span>
          </button>

          {/* New Item Button */}
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#3525cd] hover:bg-[#281bb5] text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow active:scale-[0.98] transition-all"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Thêm tài liệu</span>
          </button>
        </div>
      </div>

      {/* ================= SUB-NAVIGATION TABS (UC-036 - UC-050) ================= */}
      <div className="flex items-center gap-2 border-b border-[#c7c4d8]/60 pb-3 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveKnowledgeTab('documents')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeKnowledgeTab === 'documents'
              ? 'bg-[#3525cd] text-white shadow-xs'
              : 'bg-white text-[#464555] hover:bg-[#eaedff] hover:text-[#3525cd] border border-[#c7c4d8]/60'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">library_books</span>
          <span>Kho tài liệu ({items.length})</span>
        </button>

        <button
          onClick={() => setActiveKnowledgeTab('faq')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeKnowledgeTab === 'faq'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-[#464555] hover:bg-emerald-50 hover:text-emerald-700 border border-[#c7c4d8]/60'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">quiz</span>
          <span>Soạn FAQ nhiều bước (UC-037)</span>
        </button>

        <button
          onClick={() => setActiveKnowledgeTab('bot_templates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeKnowledgeTab === 'bot_templates'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-[#464555] hover:bg-indigo-50 hover:text-indigo-700 border border-[#c7c4d8]/60'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">quickreply</span>
          <span>Mẫu câu & Ảnh Bot (UC-038)</span>
        </button>

        <button
          onClick={() => setActiveKnowledgeTab('web_sources')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeKnowledgeTab === 'web_sources'
              ? 'bg-[#131b2e] text-white shadow-xs'
              : 'bg-white text-[#464555] hover:bg-slate-100 hover:text-[#131b2e] border border-[#c7c4d8]/60'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">public</span>
          <span>Nguồn Website & Sitemap (UC-046-050)</span>
        </button>

        <button
          onClick={() => setIsDiagnosticOpen(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 bg-white text-[#464555] hover:bg-purple-50 hover:text-purple-700 border border-[#c7c4d8]/60`}
        >
          <span className="material-symbols-outlined text-[18px]">science</span>
          <span>Thử nghiệm truy xuất RAG (UC-043)</span>
        </button>
      </div>

      {/* ================= TAB 1: KNOWLEDGE DOCUMENTS ================= */}
      {activeKnowledgeTab === 'documents' && (
        <div className="space-y-6">
          {/* ================= STAT SUMMARY CARDS (Bento Grid) ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Documents */}
        <div className="bg-white border border-[#c7c4d8]/70 rounded-2xl p-4 flex flex-col justify-between shadow-2xs hover:border-[#777587] transition-colors">
          <div className="flex items-center justify-between text-[#464555]">
            <span className="text-xs font-semibold">Tổng số tài liệu</span>
            <div className="w-8 h-8 rounded-lg bg-[#eaedff] flex items-center justify-center text-[#3525cd]">
              <span className="material-symbols-outlined text-[18px]">folder_open</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#131b2e]">
              {totalItemsCount} <span className="text-xs font-normal text-[#464555]">tài liệu</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[#3525cd] font-medium">
              <span className="material-symbols-outlined text-[15px]">database</span>
              <span>Lưu trữ an toàn trên hệ thống</span>
            </div>
          </div>
        </div>

        {/* Card 2: Published Public */}
        <div className="bg-white border border-[#c7c4d8]/70 rounded-2xl p-4 flex flex-col justify-between shadow-2xs hover:border-[#777587] transition-colors">
          <div className="flex items-center justify-between text-[#464555]">
            <span className="text-xs font-semibold">Đang phục vụ AI (Công khai)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">public</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#131b2e]">
              {publicItemsCount} <span className="text-xs font-normal text-emerald-700 font-medium">tài liệu</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Khách hàng & Widget có thể truy cập</span>
            </div>
          </div>
        </div>

        {/* Card 3: Internal Only */}
        <div className="bg-white border border-[#c7c4d8]/70 rounded-2xl p-4 flex flex-col justify-between shadow-2xs hover:border-[#777587] transition-colors">
          <div className="flex items-center justify-between text-[#464555]">
            <span className="text-xs font-semibold">Tài liệu nội bộ</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">lock</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#131b2e]">
              {internalItemsCount} <span className="text-xs font-normal text-amber-700 font-medium">tài liệu</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-700 font-medium">
              <span className="material-symbols-outlined text-[14px]">shield</span>
              <span>Chỉ dành riêng cho nhân viên tư vấn</span>
            </div>
          </div>
        </div>

        {/* Card 4: Draft & Ready */}
        <div className="bg-white border border-[#c7c4d8]/70 rounded-2xl p-4 flex flex-col justify-between shadow-2xs hover:border-[#777587] transition-colors">
          <div className="flex items-center justify-between text-[#464555]">
            <span className="text-xs font-semibold">Bản nháp / Chờ duyệt</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#131b2e]">
              {pendingItemsCount} <span className="text-xs font-normal text-[#464555]">tài liệu</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-purple-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
              <span>Chưa đưa vào phục vụ khách hàng</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= FILTER CONTROLS BAR ================= */}
      <div className="bg-white border border-[#c7c4d8]/70 rounded-2xl p-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Fast Filter Search */}
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#777587] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tiêu đề, nội dung tài liệu..."
              className="w-full pl-9 pr-3 py-2 bg-[#f2f3ff] border border-[#c7c4d8] rounded-xl text-xs text-[#131b2e] placeholder:text-[#777587] focus:outline-none focus:border-[#3525cd]"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-[#777587] uppercase tracking-wider pl-1">
              Danh mục:
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="py-2 pl-3 pr-8 bg-[#f2f3ff] border border-[#c7c4d8] rounded-xl text-xs text-[#131b2e] focus:outline-none focus:border-[#3525cd] cursor-pointer"
            >
              <option value="all">Tất cả danh mục ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-2.5 py-2 bg-[#f2f3ff] hover:bg-[#eaedff] text-[#3525cd] border border-[#c7c4d8] rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
              title="Tạo thêm danh mục tri thức mới (UC-036)"
            >
              <span className="material-symbols-outlined text-[16px]">create_new_folder</span>
              <span className="hidden sm:inline">Tạo mục</span>
            </button>
          </div>

          {/* Status / Audience Filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-[#777587] uppercase tracking-wider pl-1">
              Trạng thái:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 pl-3 pr-8 bg-[#f2f3ff] border border-[#c7c4d8] rounded-xl text-xs text-[#131b2e] focus:outline-none focus:border-[#3525cd] cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="published_public">Đang phục vụ AI (Công khai)</option>
              <option value="internal">Nội bộ nhân viên</option>
              <option value="ready">Sẵn sàng xuất bản</option>
              <option value="draft">Bản nháp</option>
            </select>
          </div>
        </div>

        {/* Quick bulk view actions & Sort */}
        <div className="flex items-center gap-2 text-[#464555] self-end lg:self-auto text-xs">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5 hover:bg-rose-100 transition-colors shadow-2xs"
              type="button"
              title="Xoá các tài liệu đã chọn"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              <span>Xoá {selectedIds.size} mục đã chọn</span>
            </button>
          )}

          <span className="text-[#777587]">Sắp xếp:</span>
          <button
            onClick={() => setSortBy((prev) => (prev === 'updated' ? 'title' : 'updated'))}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#eaedff] text-[#3525cd] border border-[#c7c4d8] flex items-center gap-1 hover:bg-[#dfe3ff] transition-colors"
            type="button"
          >
            <span>{sortBy === 'updated' ? 'Mới cập nhật' : 'Tiêu đề (A-Z)'}</span>
            <span className="material-symbols-outlined text-[15px]">swap_vert</span>
          </button>

          <button
            onClick={handleExportCSV}
            aria-label="Xuất CSV"
            className="p-2 text-[#464555] hover:text-[#131b2e] border border-[#c7c4d8] rounded-xl hover:bg-[#f2f3ff] transition-colors"
            title="Xuất danh sách ra tệp CSV"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
          </button>
        </div>
      </div>

      {/* ================= COMPACT & RESPONSIVE DATA TABLE ================= */}
      {/* Fitted 100% without horizontal scrollbar - actions always immediately visible */}
      <div className="bg-white border border-[#c7c4d8]/70 rounded-2xl shadow-2xs overflow-hidden flex flex-col">
        <div className="w-full">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-[#f8f9ff] border-b border-[#c7c4d8]/60 text-[11px] font-bold uppercase tracking-wider text-[#777587] select-none">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={sortedItems.length > 0 && selectedIds.size === sortedItems.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-[#c7c4d8] text-[#3525cd] focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3">Tên tài liệu (Nhấp để xem nội dung)</th>
                <th className="py-3 px-3 w-32 hidden lg:table-cell">Danh mục</th>
                <th className="py-3 px-3 w-36">Trạng thái</th>
                <th className="py-3 px-3 w-16 text-center hidden sm:table-cell">Bản</th>
                <th className="py-3 px-3 w-80 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c7c4d8]/40 text-xs text-[#131b2e]">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-[#777587]">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <span className="material-symbols-outlined text-[28px] animate-spin text-[#3525cd]">
                        progress_activity
                      </span>
                      <span className="font-medium">Đang tải danh sách tài liệu...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-[#777587]">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <div className="w-14 h-14 rounded-2xl bg-[#eaedff] text-[#3525cd] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[28px]">library_books</span>
                      </div>
                      <span className="font-semibold text-sm text-[#131b2e]">Chưa có tài liệu nào</span>
                      <p className="text-xs text-[#464555] max-w-sm">
                        Hãy nhấn "Nhập tài liệu" để tải lên tệp PDF/Word hoặc "Thêm tài liệu" để tạo nội dung mới cho AI Chatbot.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedItems.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const isBusy = actionBusyId === item.id;
                  const isPublished = item.published_version_id !== null;
                  const categoryName = categoryMap.get(item.category_id || '') || 'Chưa phân loại';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setDetailItem(item)}
                      className={`hover:bg-[#f8f9ff] transition-colors group cursor-pointer ${
                        isSelected
                          ? 'bg-[#eaedff]/40'
                          : item.audience === 'INTERNAL'
                          ? 'bg-amber-50/15'
                          : item.state === 'DRAFT'
                          ? 'bg-purple-50/15'
                          : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(item.id)}
                          className="rounded border-[#c7c4d8] text-[#3525cd] focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                      </td>

                      {/* Title Only: Clean, Truncated, Clickable to open detail */}
                      <td className="py-3 px-3 truncate">
                        <div
                          className="flex items-center gap-2 group/title"
                          title="Nhấp vào để xem toàn bộ nội dung tài liệu"
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                              isPublished && item.audience === 'PUBLIC'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isPublished && item.audience === 'INTERNAL'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : item.state === 'READY'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {isPublished && item.audience === 'PUBLIC'
                                ? 'public'
                                : isPublished && item.audience === 'INTERNAL'
                                ? 'lock'
                                : item.state === 'READY'
                                ? 'check_circle'
                                : 'edit_document'}
                            </span>
                          </div>

                          <span className="font-semibold text-[#131b2e] group-hover/title:text-[#3525cd] group-hover/title:underline truncate">
                            {item.title}
                          </span>

                          <span className="material-symbols-outlined text-[14px] text-[#777587] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            visibility
                          </span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 truncate hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#eaedff] text-[#3525cd] border border-[#c7c4d8]/60 truncate max-w-[120px]">
                          {categoryName}
                        </span>
                      </td>

                      {/* Publication Status Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isPublished && item.audience === 'PUBLIC' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="material-symbols-outlined text-[12px] text-emerald-600">public</span>
                            <span>Công khai</span>
                          </span>
                        )}

                        {isPublished && item.audience === 'INTERNAL' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-300">
                            <span className="material-symbols-outlined text-[12px] text-amber-700">lock</span>
                            <span>Nội bộ</span>
                          </span>
                        )}

                        {!isPublished && item.state === 'READY' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <span className="material-symbols-outlined text-[12px] text-blue-600">check_circle</span>
                            <span>Sẵn sàng</span>
                          </span>
                        )}

                        {!isPublished && item.state === 'DRAFT' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-900 border border-purple-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                            <span>Bản nháp</span>
                          </span>
                        )}
                      </td>

                      {/* Version */}
                      <td className="py-3 px-3 text-center font-mono text-[11px] hidden sm:table-cell">
                        <span className="px-2 py-0.5 rounded-md bg-[#f2f3ff] border border-[#c7c4d8]/70 text-[#131b2e] font-semibold">
                          v{item.revision}
                        </span>
                      </td>

                      {/* Actions Toolbar: ALWAYS VISIBLE WITHOUT HORIZONTAL SCROLL */}
                      <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {isBusy ? (
                            <span className="px-2 py-1 text-xs text-[#777587] flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                              <span>Đang xử lý...</span>
                            </span>
                          ) : (
                            <>
                              {/* 1. Action for DRAFT (Chưa kích hoạt) */}
                              {!isPublished && item.state === 'DRAFT' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleProcess(item); }}
                                  className="px-2.5 py-1 text-xs font-semibold text-white bg-[#3525cd] hover:bg-[#281bb5] rounded-lg transition-all shadow-2xs flex items-center gap-1 active:scale-[0.98]"
                                  type="button"
                                  title="Kích hoạt tài liệu sẵn sàng cho AI xuất bản"
                                >
                                  <span className="material-symbols-outlined text-[13px]">bolt</span>
                                  <span>Kích hoạt</span>
                                </button>
                              )}

                              {/* 2. Actions for READY (Sẵn sàng, chưa xuất bản) -> Công khai hoặc Nội bộ */}
                              {!isPublished && item.state === 'READY' && (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handlePublish(item, 'PUBLIC'); }}
                                    className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-2xs flex items-center gap-1 active:scale-[0.98]"
                                    type="button"
                                    title="Xuất bản công khai để AI Chatbot phục vụ khách hàng"
                                  >
                                    <span className="material-symbols-outlined text-[13px]">public</span>
                                    <span>Công khai</span>
                                  </button>

                                  <button
                                    onClick={(e) => { e.stopPropagation(); handlePublish(item, 'INTERNAL'); }}
                                    className="px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors flex items-center gap-1"
                                    type="button"
                                    title="Chỉ xuất bản cho nội bộ nhân viên"
                                  >
                                    <span className="material-symbols-outlined text-[13px]">lock</span>
                                    <span>Nội bộ</span>
                                  </button>
                                </>
                              )}

                              {/* 3. Action for PUBLISHED: Chỉ hiển thị duy nhất nút chuyển đổi trạng thái */}
                              {isPublished && item.audience === 'PUBLIC' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleToggleAudience(item); }}
                                  className="px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors flex items-center gap-1 active:scale-[0.98]"
                                  type="button"
                                  title="Chuyển sang chế độ Nội bộ (không cho AI trả lời khách)"
                                >
                                  <span className="material-symbols-outlined text-[13px]">lock</span>
                                  <span>Đổi Nội bộ</span>
                                </button>
                              )}

                              {isPublished && item.audience === 'INTERNAL' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleToggleAudience(item); }}
                                  className="px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors flex items-center gap-1 active:scale-[0.98]"
                                  type="button"
                                  title="Chuyển sang chế độ Công khai (cho phép AI trả lời khách)"
                                >
                                  <span className="material-symbols-outlined text-[13px]">public</span>
                                  <span>Đổi Công khai</span>
                                </button>
                              )}

                              {isPublished && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUnpublish(item); }}
                                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors flex items-center gap-1 active:scale-[0.98]"
                                  type="button"
                                  title="Thu hồi xuất bản (ngừng phục vụ trên Widget và Bot)"
                                >
                                  <span className="material-symbols-outlined text-[13px]">unpublished</span>
                                  <span>Thu hồi</span>
                                </button>
                              )}

                              {/* Separator */}
                              <div className="h-4 w-px bg-[#c7c4d8]/60 mx-0.5"></div>

                              {/* View Detail button */}
                              <button
                                onClick={(e) => { e.stopPropagation(); setDetailItem(item); }}
                                className="p-1.5 text-[#464555] hover:text-[#3525cd] hover:bg-[#eaedff] rounded-lg transition-colors"
                                type="button"
                                title="Xem nội dung chi tiết"
                              >
                                <span className="material-symbols-outlined text-[17px]">visibility</span>
                              </button>

                              {/* Edit Draft button */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleOpenEdit(item); }}
                                className="p-1.5 text-[#464555] hover:text-[#3525cd] hover:bg-[#eaedff] rounded-lg transition-colors"
                                type="button"
                                title="Chỉnh sửa bản nháp"
                              >
                                <span className="material-symbols-outlined text-[17px]">edit</span>
                              </button>

                              {/* History button */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleOpenHistory(item); }}
                                className="p-1.5 text-[#464555] hover:text-[#3525cd] hover:bg-[#eaedff] rounded-lg transition-colors"
                                type="button"
                                title="Lịch sử phiên bản & Khôi phục"
                              >
                                <span className="material-symbols-outlined text-[17px]">history</span>
                              </button>

                              {/* Delete button (Hiển thị cho tất cả tài liệu) */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteItem(item); }}
                                className="p-1.5 text-[#777587] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                type="button"
                                title={isPublished ? "Xoá tài liệu này" : "Xoá bản nháp này"}
                              >
                                <span className="material-symbols-outlined text-[17px]">delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ================= FOOTER ================= */}
        <div className="p-3.5 bg-[#f8f9ff] border-t border-[#c7c4d8]/60 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-[#464555] font-medium">
              Hiển thị {sortedItems.length} / {totalItemsCount} tài liệu
            </span>
            <div className="h-4 w-px bg-[#c7c4d8]"></div>
            <div className="flex items-center gap-1.5 text-xs text-[#3525cd] font-semibold bg-[#eaedff] px-2.5 py-0.5 rounded-full border border-[#c7c4d8]/60">
              <span className="material-symbols-outlined text-[15px]">verified_user</span>
              <span>AI Chatbot chỉ sử dụng tài liệu đã xuất bản công khai để phản hồi khách hàng</span>
            </div>
          </div>

          <div className="text-[11px] text-[#777587]">
            GoTek RAG • Phân quyền bảo mật đa doanh nghiệp
          </div>
        </div>
      </div>
    </div>
  )}

  {/* ================= TAB 2: MULTI-STEP FAQ BUILDER (UC-037) ================= */}
  {activeKnowledgeTab === 'faq' && (
    <MultiStepFaqView
      categories={categories}
      onNotify={showNotification}
      onSuccess={() => {
        void loadData();
        setActiveKnowledgeTab('documents');
      }}
    />
  )}

  {/* ================= TAB 3: BOT TEMPLATES & MEDIA (UC-038) ================= */}
  {activeKnowledgeTab === 'bot_templates' && (
    <BotTemplatesView onNotify={showNotification} />
  )}

  {/* ================= TAB 4: WEB SOURCES & SITEMAP (UC-046 - UC-050) ================= */}
  {activeKnowledgeTab === 'web_sources' && (
    <div className="bg-white rounded-2xl p-6 border border-[#c7c4d8]/70 shadow-sm">
      <WebSources role="Owner" />
    </div>
  )}

      {/* ================= MODAL: VIEW DOCUMENT DETAIL (XEM CHI TIẾT) ================= */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-[#c7c4d8] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#c7c4d8]/60 flex items-center justify-between bg-[#f8f9ff]">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    detailItem.published_version_id && detailItem.audience === 'PUBLIC'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : detailItem.published_version_id && detailItem.audience === 'INTERNAL'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : detailItem.state === 'READY'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-purple-50 text-purple-700 border-purple-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {detailItem.published_version_id && detailItem.audience === 'PUBLIC'
                      ? 'public'
                      : detailItem.published_version_id && detailItem.audience === 'INTERNAL'
                      ? 'lock'
                      : detailItem.state === 'READY'
                      ? 'check_circle'
                      : 'edit_document'}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-[#131b2e] truncate">{detailItem.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="px-2 py-0.5 rounded bg-[#f2f3ff] border border-[#c7c4d8]/70 text-[#131b2e] font-mono text-[10px] font-semibold">
                      v{detailItem.revision}
                    </span>
                    <span className="text-[11px] text-[#777587]">
                      {categoryMap.get(detailItem.category_id || '') || 'Chưa phân loại'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="text-[#777587] hover:text-[#131b2e] p-1.5 rounded-lg hover:bg-black/5"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Metadata tags */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#f8f9ff] rounded-xl border border-[#c7c4d8]/60 text-[11px]">
                <div className="flex items-center gap-3">
                  <span className="text-[#464555]">
                    Trạng thái:{' '}
                    <strong className="text-[#131b2e]">
                      {detailItem.published_version_id
                        ? detailItem.audience === 'PUBLIC'
                          ? 'Đang phục vụ AI (Công khai)'
                          : 'Xuất bản nội bộ (Nhân viên)'
                        : detailItem.state === 'READY'
                        ? 'Sẵn sàng xuất bản'
                        : 'Bản nháp'}
                    </strong>
                  </span>
                  <span>•</span>
                  <span className="text-[#777587]">
                    Cập nhật: {new Date(detailItem.updated_at).toLocaleString('vi-VN')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyContent(detailItem.content)}
                  className="px-2.5 py-1 text-xs font-medium text-[#3525cd] hover:bg-[#eaedff] rounded-lg border border-[#c7c4d8] flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copiedContent ? 'done' : 'content_copy'}
                  </span>
                  <span>{copiedContent ? 'Đã sao chép' : 'Sao chép nội dung'}</span>
                </button>
              </div>

              {/* Document Text Box */}
              <div>
                <label className="block text-[11px] font-semibold text-[#131b2e] mb-1.5">
                  Nội dung đầy đủ của tài liệu:
                </label>
                <div className="bg-[#f8f9ff] border border-[#c7c4d8]/70 rounded-xl p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto text-[#131b2e]">
                  {detailItem.content}
                </div>
              </div>
            </div>

            {/* Footer with immediate actions */}
            <div className="px-6 py-3.5 bg-[#f8f9ff] border-t border-[#c7c4d8]/60 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Actions from detail modal */}
                {!detailItem.published_version_id && detailItem.state === 'DRAFT' && (
                  <button
                    onClick={() => handleProcess(detailItem)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#3525cd] hover:bg-[#281bb5] rounded-lg shadow-2xs flex items-center gap-1 active:scale-[0.98]"
                    type="button"
                    title="Kích hoạt tài liệu sẵn sàng cho AI xuất bản"
                  >
                    <span className="material-symbols-outlined text-[14px]">bolt</span>
                    <span>Kích hoạt</span>
                  </button>
                )}

                {!detailItem.published_version_id && detailItem.state === 'READY' && (
                  <>
                    <button
                      onClick={() => handlePublish(detailItem, 'PUBLIC')}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs flex items-center gap-1 active:scale-[0.98]"
                      type="button"
                      title="Xuất bản công khai để AI Chatbot phục vụ khách hàng"
                    >
                      <span className="material-symbols-outlined text-[14px]">public</span>
                      <span>Công khai</span>
                    </button>
                    <button
                      onClick={() => handlePublish(detailItem, 'INTERNAL')}
                      className="px-2.5 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg flex items-center gap-1"
                      type="button"
                      title="Chỉ xuất bản cho nội bộ nhân viên"
                    >
                      <span className="material-symbols-outlined text-[14px]">lock</span>
                      <span>Nội bộ</span>
                    </button>
                  </>
                )}

                {detailItem.published_version_id && detailItem.audience === 'PUBLIC' && (
                  <button
                    onClick={() => handleToggleAudience(detailItem)}
                    className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg flex items-center gap-1 active:scale-[0.98]"
                    type="button"
                    title="Chuyển sang chế độ Nội bộ (không cho AI trả lời khách)"
                  >
                    <span className="material-symbols-outlined text-[14px]">lock</span>
                    <span>Đổi Nội bộ</span>
                  </button>
                )}

                {detailItem.published_version_id && detailItem.audience === 'INTERNAL' && (
                  <button
                    onClick={() => handleToggleAudience(detailItem)}
                    className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg flex items-center gap-1 active:scale-[0.98]"
                    type="button"
                    title="Chuyển sang chế độ Công khai (cho phép AI trả lời khách)"
                  >
                    <span className="material-symbols-outlined text-[14px]">public</span>
                    <span>Đổi Công khai</span>
                  </button>
                )}

                {detailItem.published_version_id && (
                  <button
                    onClick={() => {
                      const itm = detailItem;
                      setDetailItem(null);
                      handleUnpublish(itm);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1 active:scale-[0.98]"
                    type="button"
                    title="Thu hồi xuất bản (ngừng phục vụ trên Widget và Bot)"
                  >
                    <span className="material-symbols-outlined text-[14px]">unpublished</span>
                    <span>Thu hồi</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    const itm = detailItem;
                    setDetailItem(null);
                    handleOpenEdit(itm);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-[#464555] hover:text-[#3525cd] hover:bg-[#eaedff] border border-[#c7c4d8] rounded-lg flex items-center gap-1"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  <span>Chỉnh sửa</span>
                </button>

                <button
                  onClick={() => {
                    const itm = detailItem;
                    setDetailItem(null);
                    handleOpenHistory(itm);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-[#464555] hover:text-[#3525cd] hover:bg-[#eaedff] border border-[#c7c4d8] rounded-lg flex items-center gap-1"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[14px]">history</span>
                  <span>Lịch sử</span>
                </button>

                <button
                  onClick={() => handleDeleteItem(detailItem)}
                  className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1 transition-colors"
                  type="button"
                  title="Xoá tài liệu này"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                  <span>Xoá tài liệu</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="px-4 py-1.5 text-xs font-semibold text-[#131b2e] hover:bg-black/5 rounded-lg border border-[#c7c4d8]"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT / CREATE ================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-[#c7c4d8] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#c7c4d8]/60 flex items-center justify-between bg-[#f8f9ff]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#3525cd] text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[18px]">
                    {editingItem ? 'edit_note' : 'add'}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#131b2e]">
                    {editingItem ? 'Chỉnh sửa tài liệu tri thức' : 'Thêm tài liệu mới'}
                  </h3>
                  <p className="text-[11px] text-[#464555]">
                    {editingItem
                      ? `Tài liệu: "${editingItem.title}" • Sửa nháp không ảnh hưởng bản đang xuất bản`
                      : 'Bổ sung thông tin, chính sách hoặc hướng dẫn vào kho dữ liệu của AI'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-[#777587] hover:text-[#131b2e] p-1.5 rounded-lg hover:bg-black/5"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveForm}>
              <div className="p-6 space-y-4 text-xs">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-red-500 shrink-0">error</span>
                    <span className="font-medium">{formError}</span>
                  </div>
                )}

                {/* Title Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-[#131b2e]">
                      Tiêu đề tài liệu:
                    </label>
                    <span className={`text-[10px] ${formTitle.length > 100 ? 'text-red-600 font-bold' : 'text-[#777587]'}`}>
                      {formTitle.length} / 100 ký tự
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ví dụ: Chính sách bảo hành và đổi trả sản phẩm 2026"
                    className="w-full px-3 py-2 bg-[#f2f3ff] border border-[#c7c4d8] rounded-xl text-xs text-[#131b2e] focus:outline-none focus:border-[#3525cd]"
                  />
                </div>

                {/* Category Dropdown */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#131b2e] mb-1">
                    Danh mục phân loại:
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full py-2 px-3 bg-[#f2f3ff] border border-[#c7c4d8] rounded-xl text-xs text-[#131b2e] focus:outline-none focus:border-[#3525cd]"
                  >
                    <option value="">-- Không phân loại --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Content Textarea */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-[#131b2e]">
                      Nội dung chi tiết cho AI:
                    </label>
                    <span className={`text-[10px] ${formContent.length > 2000 ? 'text-red-600 font-bold' : 'text-[#777587]'}`}>
                      {formContent.length} / 2.000 ký tự
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    required
                    maxLength={2000}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Nhập nội dung chi tiết, các câu hỏi thường gặp, quy định hoặc bảng giá..."
                    className="w-full px-3 py-2 bg-[#f2f3ff] border border-[#c7c4d8] rounded-xl text-xs text-[#131b2e] focus:outline-none focus:border-[#3525cd] resize-y"
                  />
                </div>

                {/* Notice */}
                <div className="p-3 bg-[#f0f2ff] border border-[#c7c4d8]/60 rounded-xl text-[11px] text-[#131b2e] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] text-[#3525cd] shrink-0 mt-0.5">info</span>
                  <div>
                    Tài liệu lưu dưới dạng <strong>Bản nháp</strong>. Bạn có thể kiểm tra kỹ trước khi bấm <strong>"Xuất bản"</strong> để phục vụ khách hàng.
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 bg-[#f8f9ff] border-t border-[#c7c4d8]/60 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={formBusy}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#131b2e] hover:bg-black/5 rounded-lg border border-[#c7c4d8] transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={formBusy || !formTitle.trim() || !formContent.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#3525cd] hover:bg-[#281bb5] disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-1.5 transition-all"
                >
                  {formBusy ? (
                    <>
                      <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Lưu bản nháp</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: VERSION HISTORY & ROLLBACK ================= */}
      {isHistoryModalOpen && historyItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-[#c7c4d8] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#c7c4d8]/60 flex items-center justify-between bg-[#f8f9ff]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#3525cd] text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[20px]">history</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#131b2e]">
                    Lịch sử phiên bản
                  </h3>
                  <p className="text-[11px] text-[#464555]">
                    Tài liệu: "{historyItem.title}" • Xem và khôi phục các phiên bản đã lưu
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-[#777587] hover:text-[#131b2e] p-1.5 rounded-lg hover:bg-black/5"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {historyError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-red-500 shrink-0">error</span>
                  <span className="font-medium">{historyError}</span>
                </div>
              )}

              {/* Guide notice */}
              <div className="p-3 bg-[#f0f2ff] border border-[#c7c4d8]/60 rounded-xl flex items-start gap-2.5 text-[#131b2e] text-[11px]">
                <span className="material-symbols-outlined text-[16px] text-[#3525cd] shrink-0 mt-0.5">help_outline</span>
                <div>
                  Bạn có thể khôi phục tài liệu về bất kỳ phiên bản nào đã từng được xuất bản trước đây. Phiên bản khôi phục sẽ trở thành bản nháp mới để bạn kiểm tra trước khi tái xuất bản.
                </div>
              </div>

              {historyLoading ? (
                <div className="py-12 text-center text-[#777587] flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-[24px] animate-spin text-[#3525cd]">progress_activity</span>
                  <span>Đang tải các phiên bản lịch sử...</span>
                </div>
              ) : historyVersions.length === 0 ? (
                <div className="py-8 text-center text-[#777587]">
                  Chưa có lịch sử phiên bản nào.
                </div>
              ) : (
                <div className="space-y-3">
                  {historyVersions.map((ver) => {
                    const isCurrentlyPublished = ver.id === historyItem.published_version_id;
                    const isCurrentDraft = ver.id === historyItem.draft_version_id;
                    const canRollback = ver.first_published_at !== null && !isCurrentDraft;

                    return (
                      <div
                        key={ver.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isCurrentlyPublished
                            ? 'border-emerald-300 bg-emerald-50/30'
                            : isCurrentDraft
                            ? 'border-purple-300 bg-purple-50/30'
                            : 'border-[#c7c4d8]/70 bg-white hover:border-[#777587]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs px-2.5 py-0.5 rounded-md bg-[#f2f3ff] text-[#131b2e] border border-[#c7c4d8]/70 font-mono">
                              Phiên bản v{ver.version_no}
                            </span>

                            {isCurrentlyPublished && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <span className="material-symbols-outlined text-[12px] text-emerald-700">public</span>
                                <span>Đang phục vụ AI ({historyItem.audience === 'PUBLIC' ? 'Công khai' : 'Nội bộ'})</span>
                              </span>
                            )}

                            {isCurrentDraft && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-300">
                                <span className="material-symbols-outlined text-[12px] text-purple-700">edit_note</span>
                                <span>Bản nháp hiện tại</span>
                              </span>
                            )}

                            {ver.first_published_at && !isCurrentlyPublished && (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Đã từng xuất bản
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-[#777587]">
                            Tạo ngày: {new Date(ver.created_at).toLocaleString('vi-VN')}
                          </div>
                        </div>

                        <div className="mt-2.5">
                          <div className="font-semibold text-xs text-[#131b2e]">{ver.title}</div>
                          <p className="text-[11px] text-[#464555] mt-1 line-clamp-2 bg-[#f2f3ff]/60 p-2.5 rounded-xl font-mono">
                            {ver.content}
                          </p>
                        </div>

                        {/* Action: Rollback */}
                        <div className="mt-3 flex items-center justify-between border-t border-[#c7c4d8]/40 pt-2.5">
                          <span className="text-[10px] text-[#777587]">
                            Trạng thái: <strong>{ver.state === 'READY' ? 'Sẵn sàng' : ver.state === 'DRAFT' ? 'Bản nháp' : ver.state}</strong>
                            {ver.first_published_at && (
                              <span> • Xuất bản lần đầu: {new Date(ver.first_published_at).toLocaleDateString('vi-VN')}</span>
                            )}
                          </span>

                          {isCurrentDraft ? (
                            <span className="text-[11px] text-purple-700 font-medium italic">
                              (Đang là bản nháp hiện tại)
                            </span>
                          ) : canRollback ? (
                            <button
                              onClick={() => handleRollback(ver)}
                              disabled={historyBusy}
                              className="px-3 py-1.5 bg-[#3525cd] hover:bg-[#281bb5] text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1 active:scale-[0.98] transition-all disabled:opacity-50"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[15px]">history_toggle_off</span>
                              <span>Khôi phục phiên bản này</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#777587] italic" title="Chỉ các phiên bản đã từng xuất bản mới có thể khôi phục">
                              (Chưa từng xuất bản)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-[#f8f9ff] border-t border-[#c7c4d8]/60 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-[#131b2e] hover:bg-black/5 rounded-lg border border-[#c7c4d8]"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: RAG DIAGNOSTIC TEST ================= */}
      {isDiagnosticOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-[#c7c4d8] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="px-6 py-4 border-b border-[#c7c4d8]/60 flex items-center justify-between bg-[#f8f9ff]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#3525cd] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">science</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#131b2e]">Thử nghiệm truy xuất tri thức AI</h3>
                  <p className="text-[11px] text-[#464555]">Kiểm tra các đoạn trích dẫn thực tế mà AI sẽ sử dụng để trả lời</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDiagnosticOpen(false)}
                className="text-[#777587] hover:text-[#131b2e] p-1.5 rounded-lg hover:bg-black/5"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleRunDiagnosticTest} className="p-6 space-y-4 text-xs">
              {testError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                  {testError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-[#131b2e] mb-1">
                  Câu hỏi giả lập của khách hàng:
                </label>
                <input
                  type="text"
                  required
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  placeholder="Ví dụ: Chính sách bảo hành sản phẩm bao lâu?..."
                  className="w-full px-3 py-2 bg-[#f2f3ff] border border-[#c7c4d8] rounded-xl text-xs text-[#131b2e] focus:outline-none focus:border-[#3525cd]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#131b2e] mb-1">
                  Kênh truy xuất:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <label
                    onClick={() => setTestAudience('PUBLIC')}
                    className={`flex items-center gap-2.5 p-2.5 bg-white border rounded-xl cursor-pointer transition-all ${
                      testAudience === 'PUBLIC' ? 'border-[#3525cd] bg-[#eaedff]/30 ring-1 ring-[#3525cd]' : 'border-[#c7c4d8]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="testAudience"
                      checked={testAudience === 'PUBLIC'}
                      onChange={() => setTestAudience('PUBLIC')}
                    />
                    <div>
                      <div className="font-semibold text-xs">Công khai (Widget)</div>
                      <div className="text-[10px] text-[#777587]">Dữ liệu khách hàng thấy</div>
                    </div>
                  </label>

                  <label
                    onClick={() => setTestAudience('INTERNAL')}
                    className={`flex items-center gap-2.5 p-2.5 bg-white border rounded-xl cursor-pointer transition-all ${
                      testAudience === 'INTERNAL' ? 'border-amber-500 bg-amber-50/30 ring-1 ring-amber-500' : 'border-[#c7c4d8]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="testAudience"
                      checked={testAudience === 'INTERNAL'}
                      onChange={() => setTestAudience('INTERNAL')}
                    />
                    <div>
                      <div className="font-semibold text-xs">Nội bộ (Nhân viên)</div>
                      <div className="text-[10px] text-[#777587]">Dữ liệu nhân viên xem</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={testBusy || !testQuery.trim()}
                  className="px-4 py-2 bg-[#3525cd] hover:bg-[#281bb5] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-all shadow-xs"
                >
                  {testBusy ? 'Đang truy xuất...' : 'Thử nghiệm tìm kiếm'}
                </button>
              </div>

              {/* Results */}
              <div className="border-t border-[#c7c4d8]/60 pt-3.5">
                <h4 className="font-semibold text-xs text-[#131b2e] mb-2">Đoạn tri thức được AI trích xuất:</h4>
                {testResults.length === 0 ? (
                  <p className="text-[#777587] italic">Chưa có kết quả hoặc không có tài liệu nào phù hợp.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {testResults.map((res: any, idx: number) => (
                      <div key={idx} className="p-3 bg-[#f2f3ff] rounded-xl border border-[#c7c4d8]/60 text-xs">
                        <div className="font-bold text-[#131b2e] flex items-center justify-between">
                          <span>{res.title}</span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Phiên bản: {res.versionId?.slice(0, 8)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#464555] mt-1 line-clamp-2">{res.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: IMPORT DOCUMENT ================= */}
      <ImportDocModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        categories={categories}
        onImportSuccess={({ count, filename }) => {
          showNotification(`Đã tải lên thành công ${count} tài liệu từ "${filename}"! Nhấn "Kích hoạt" và "Xuất bản" để bắt đầu phục vụ.`);
          void loadData();
        }}
      />
      {/* ================= MODAL: IMPORT RECEIPTS & ERROR HISTORY (UC-11) ================= */}
      <ImportHistoryModal
        isOpen={isImportHistoryOpen}
        onClose={() => setIsImportHistoryOpen(false)}
      />

      {/* ================= MODAL: CREATE CATEGORY (UC-036) ================= */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">create_new_folder</span>
              Tạo danh mục tri thức mới (UC-036)
            </h3>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tên danh mục *
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Bán hàng, Bảo hành, Kỹ thuật..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  disabled={categoryBusy}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={categoryBusy || !newCategoryName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl"
                >
                  {categoryBusy ? 'Đang tạo...' : 'Tạo danh mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
