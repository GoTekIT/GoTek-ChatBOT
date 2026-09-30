import {KnowledgeEditor} from '../../screens/console/KnowledgeEditor';
import React, { useState } from 'react';
import { KnowledgeDocument, PublicationStatus, SourceType } from '../../types';
import { ImportDocModal } from '../modals/ImportDocModal';

interface KnowledgeBaseViewProps {
  documents: KnowledgeDocument[];
  onImportFile: (file: File, requestId: string) => Promise<void>;
  error?: string; loading?: boolean; onRefresh: () => Promise<void>;
  onUpdateDocument: (id: string, updates: Partial<KnowledgeDocument>) => Promise<void>;
  onDeleteDocument: (id: string) => Promise<void>;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  documents,
  onImportFile, error, loading, onRefresh,
  onUpdateDocument: updateDocument,
  onDeleteDocument: deleteDocument,
}) => {
  const [editingId,setEditingId] = useState<string|null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'title' | 'chunks'>('updated');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const onUpdateDocument = async (id: string, updates: Partial<KnowledgeDocument>) => {
    try {await updateDocument(id, updates); showNotification('Đã lưu thay đổi trên máy chủ.');}
    catch(e) {showNotification(e instanceof Error ? e.message : 'Không thể cập nhật.');}
  };
  const onDeleteDocument = async (id: string) => {
    try {await deleteDocument(id); showNotification('Đã lưu trữ tài liệu.');}
    catch(e) {showNotification(e instanceof Error ? e.message : 'Không thể lưu trữ.');}
  };
  const handleReindexAll = async () => {
    setIsReindexing(true);setReindexProgress(0);
    const pending=documents.filter(d=>d.publicationStatus==='draft');
    try {for(let i=0;i<pending.length;i++) {await updateDocument(pending[i].id,{publicationStatus:'ready'});setReindexProgress(Math.round((i+1)/pending.length*100));}
      showNotification(pending.length ? 'Đã xử lý các bản nháp. Chưa tự động xuất bản.' : 'Không có bản nháp cần xử lý.');
    } catch(e){showNotification(e instanceof Error ? e.message : 'Xử lý chưa hoàn tất.');}
    finally{setIsReindexing(false);}
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Title', 'SourceType', 'PublicationStatus', 'Audience', 'ChunksCount', 'LastUpdated', 'UpdatedBy'];
    const rows = documents.map((d) => [
      d.id,
      `"${d.title}"`,
      d.sourceType,
      d.publicationStatus,
      `"${d.audience}"`,
      d.chunksCount,
      `"${d.lastUpdated}"`,
      `"${d.updatedBy}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GoTek_Knowledge_Base_Index_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Exported Knowledge Base Metadata to CSV');
  };

  // Filter documents
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.audience.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.tag && doc.tag.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (sourceFilter !== 'all' && doc.sourceType !== sourceFilter) return false;
    if (statusFilter !== 'all') {
      if (statusFilter === 'published' && doc.publicationStatus !== 'published') return false;
      if (statusFilter === 'internal' && doc.publicationStatus !== 'internal') return false;
      if (statusFilter === 'ready' && doc.publicationStatus !== 'ready') return false;
      if (statusFilter === 'processing' && doc.publicationStatus !== 'draft') return false;
    }

    return true;
  });

  // Sort documents
  const sortedDocs = [...filteredDocs].sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'chunks') return b.chunksCount - a.chunksCount;
    return 0; // default order
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sortedDocs.map((d) => d.id)));
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

  const handleBulkDelete = async () => {
    if(!selectedIds.size || !confirm(`Lưu trữ ${selectedIds.size} tài liệu?`))return;
    try {for(const id of selectedIds)await deleteDocument(id);setSelectedIds(new Set());showNotification('Đã lưu trữ các tài liệu.');}
    catch(e){showNotification(e instanceof Error ? e.message : 'Một số tài liệu chưa được lưu trữ.');}
  };

  return (
    <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-[#faf8ff] custom-scrollbar">
      {loading && <p role="status">Đang tải tri thức…</p>}
      {error && <p role="alert">{error} <button onClick={()=>{void onRefresh();}}>Thử lại</button></p>}
      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#131b2e] text-white text-xs px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
          <span>{actionNotice}</span>
        </div>
      )}

      {/* ================= HEADER SECTION ================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-[#131b2e] tracking-tight">
              Knowledge Base & RAG Indexing
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#eaedff] text-[#3525cd] border border-[#c7c4d8]/70">
              Module 3
            </span>
          </div>
          <p className="text-xs text-[#464555] mt-1 max-w-4xl">
            Manage documents, web crawl sources, vector embeddings, and audience publication states
            (Draft, Ready, Published Public, Internal Only) compliant with{' '}
            <span className="font-semibold text-[#131b2e]">GoTek SRS v1.0</span>.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReindexAll}
            disabled={isReindexing}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-[#c7c4d8] hover:bg-[#f2f3ff] text-[#131b2e] rounded-lg text-xs font-semibold transition-all active:scale-[0.98]"
            type="button"
          >
            <span className={`material-symbols-outlined text-[18px] ${isReindexing ? 'animate-spin text-[#4f46e5]' : ''}`}>
              cached
            </span>
            <span>{isReindexing ? `Đang xử lý (${reindexProgress}%)` : 'Xử lý các bản nháp'}</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#3525cd] hover:bg-[#281bb5] text-white rounded-lg text-xs font-semibold shadow-sm hover:shadow active:scale-[0.98] transition-all"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Import Data</span>
          </button>
        </div>
      </div>

      {/* ================= STAT SUMMARY CARDS (Bento Grid) ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Documents */}
        <div className="bg-white border border-[#c7c4d8]/70 rounded-xl p-4 flex flex-col justify-between shadow-xs hover:border-[#777587] transition-colors">
          <div className="flex items-center justify-between text-[#464555]">
            <span className="text-xs font-semibold">Total Documents</span>
            <div className="w-8 h-8 rounded-lg bg-[#eaedff] flex items-center justify-center text-[#3525cd]">
              <span className="material-symbols-outlined text-[18px]">folder_open</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#131b2e]">
              {documents.length} <span className="text-xs font-normal text-[#464555]">docs</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
              <span className="material-symbols-outlined text-[15px]">trending_up</span>
              <span>Dữ liệu đã tải từ máy chủ</span>
            </div>
          </div>
        </div>

        {/* Card 2: Đã xuất bản công khai */}
        <div className="bg-white border border-[#c7c4d8]/70 rounded-xl p-4 flex flex-col justify-between shadow-xs hover:border-[#777587] transition-colors">
          <div className="flex items-center justify-between text-[#464555]">
            <span className="text-xs font-semibold">Đã xuất bản công khai</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#131b2e]">
              {documents.filter(d=>d.publicationStatus==='published').length} <span className="text-xs font-normal text-emerald-700 font-medium">Public</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[#464555]">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Phụ thuộc trạng thái nguồn và quyền truy xuất</span>
            </div>
          </div>
        </div>

        {/* Card 3: Bản nháp */}
        <div className="bg-white border border-[#c7c4d8]/70 rounded-xl p-4 flex flex-col justify-between shadow-xs hover:border-[#777587] transition-colors">
          <div className="flex items-center justify-between text-[#464555]">
            <span className="text-xs font-semibold">Bản nháp</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-[#6b38d4] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">autorenew</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#131b2e]">
              {documents.filter(d=>d.publicationStatus==='draft').length} <span className="text-xs font-normal text-[#464555]">docs</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[#6b38d4] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#6b38d4] animate-pulse"></span>
              <span>Chưa xuất bản</span>
            </div>
          </div>
        </div>

        {/* Card 4: Storage & Token Footprint */}
        <div className="bg-white border border-[#c7c4d8]/70 rounded-xl p-4 flex flex-col justify-between shadow-xs hover:border-[#777587] transition-colors">
          <div className="flex items-center justify-between text-[#464555]">
            <span className="text-xs font-semibold">Storage & Token Footprint</span>
            <div className="w-8 h-8 rounded-lg bg-[#eaedff] flex items-center justify-center text-[#3525cd]">
              <span className="material-symbols-outlined text-[18px]">data_usage</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#131b2e]">
              — <span className="text-xs font-normal text-[#464555]">MB</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-mono text-[#464555]">
              <span>Chưa có số liệu token</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= FILTER CONTROLS BAR ================= */}
      <div className="bg-white border border-[#c7c4d8]/70 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Fast Filter Search */}
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777587] text-[18px]">
              filter_list
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title, tags or audience..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#f2f3ff] border border-[#c7c4d8] rounded-lg text-xs text-[#131b2e] placeholder:text-[#777587] focus:outline-none focus:border-[#4f46e5]"
            />
          </div>

          {/* Source Type Dropdown */}
          <div className="flex items-center gap-1">
            <label className="text-[10px] font-bold text-[#777587] uppercase tracking-wider pl-1">
              Source:
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="py-1.5 pl-2.5 pr-8 bg-[#f2f3ff] border border-[#c7c4d8] rounded-lg text-xs text-[#131b2e] focus:outline-none focus:border-[#4f46e5] cursor-pointer"
            >
              <option value="all">All Types (PDF, CSV, Web, Doc)</option>
              <option value="pdf">PDF Documents</option>
              <option value="csv">CSV & Tabular Tables</option>
              <option value="web">Web Crawler URLs</option>
              <option value="doc">Notion / Docs</option>
            </select>
          </div>

          {/* Status / Audience Filter */}
          <div className="flex items-center gap-1">
            <label className="text-[10px] font-bold text-[#777587] uppercase tracking-wider pl-1">
              Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 pl-2.5 pr-8 bg-[#f2f3ff] border border-[#c7c4d8] rounded-lg text-xs text-[#131b2e] focus:outline-none focus:border-[#4f46e5] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published Public (Visitor & Agent)</option>
              <option value="internal">Internal Only (Agent Staff Only)</option>
              <option value="ready">Ready (Awaiting Admin Approval)</option>
              <option value="processing">Processing / Draft</option>
            </select>
          </div>

          {/* Bulk delete action if selection exists */}
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-1 hover:bg-red-100 transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">delete</span>
              <span>Delete ({selectedIds.size})</span>
            </button>
          )}
        </div>

        {/* Quick bulk view actions & Sort */}
        <div className="flex items-center gap-2 text-[#464555] self-end lg:self-auto text-xs">
          <span className="text-[#777587]">Sort by:</span>
          <button
            onClick={() => {
              if (sortBy === 'updated') setSortBy('chunks');
              else if (sortBy === 'chunks') setSortBy('title');
              else setSortBy('updated');
            }}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-[#eaedff] text-[#3525cd] border border-[#c7c4d8] flex items-center gap-1"
            type="button"
          >
            <span>
              {sortBy === 'updated'
                ? 'Last Updated'
                : sortBy === 'chunks'
                ? 'Chunks Count'
                : 'Document Title'}
            </span>
            <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
          </button>

          <button
            onClick={handleExportCSV}
            aria-label="Export metadata CSV"
            className="p-1.5 text-[#464555] hover:text-[#131b2e] border border-[#c7c4d8] rounded hover:bg-[#f2f3ff] transition-colors"
            title="Export CSV"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
          </button>
        </div>
      </div>

      {/* ================= KNOWLEDGE BASE DATA TABLE ================= */}
      <div className="bg-white border border-[#c7c4d8]/70 rounded-xl shadow-xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="bg-[#f2f3ff] border-b border-[#c7c4d8]/70 text-[11px] font-bold uppercase tracking-wider text-[#777587] select-none">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={sortedDocs.length > 0 && selectedIds.size === sortedDocs.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-[#c7c4d8] text-[#3525cd] focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Document Title & Metadata</th>
                <th className="py-3 px-4 w-40">Source Type</th>
                <th className="py-3 px-4 w-52">Publication Status & Audience</th>
                <th className="py-3 px-4 w-36">Chunks & Vectors</th>
                <th className="py-3 px-4 w-44">Last Updated</th>
                <th className="py-3 px-4 w-44 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c7c4d8]/50 text-xs text-[#131b2e]">
              {sortedDocs.map((doc) => {
                const isSelected = selectedIds.has(doc.id);
                return (
                  <tr
                    key={doc.id}
                    className={`hover:bg-[#f2f3ff]/70 transition-colors group ${
                      isSelected
                        ? 'bg-[#eaedff]/40'
                        : doc.publicationStatus === 'internal'
                        ? 'bg-amber-50/20'
                        : doc.publicationStatus === 'draft'
                        ? 'bg-purple-50/20'
                        : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleRow(doc.id)}
                        className="rounded border-[#c7c4d8] text-[#3525cd] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                    </td>

                    {/* Title & Metadata */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded flex items-center justify-center shrink-0 border mt-0.5 ${
                            doc.sourceType === 'pdf'
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : doc.sourceType === 'csv'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : doc.sourceType === 'web'
                              ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                              : 'bg-blue-50 text-blue-600 border-blue-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {doc.sourceType === 'pdf'
                              ? 'picture_as_pdf'
                              : doc.sourceType === 'csv'
                              ? 'table_chart'
                              : doc.sourceType === 'web'
                              ? 'language'
                              : 'description'}
                          </span>
                        </div>
                        <div>
                          <div
                            onClick={() => setEditingId(doc.id)}
                            className="font-semibold text-[#131b2e] hover:text-[#3525cd] cursor-pointer flex items-center gap-1.5"
                          >
                            <span className={doc.sourceType === 'web' ? 'font-mono text-[11px]' : ''}>
                              {doc.title}
                            </span>
                            {doc.publicationStatus === 'internal' && (
                              <span className="material-symbols-outlined text-[14px] text-amber-600" title="Security Restricted">
                                lock
                              </span>
                            )}
                            <span className="material-symbols-outlined text-[14px] text-[#777587] opacity-0 group-hover:opacity-100 transition-opacity">
                              open_in_new
                            </span>
                          </div>
                          <div className="text-[11px] text-[#464555] flex items-center gap-2 mt-0.5 font-mono">
                            <span>{doc.size}</span>
                            <span>•</span>
                            <span>{doc.tag || 'Phiên bản quản lý trên máy chủ'}</span>
                            {doc.cosineSim && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-700 font-semibold">
                                  Cosine Sim &gt; {doc.cosineSim}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Source Type Badge */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          doc.sourceType === 'pdf'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : doc.sourceType === 'csv'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : doc.sourceType === 'web'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {doc.sourceType === 'pdf'
                            ? 'picture_as_pdf'
                            : doc.sourceType === 'csv'
                            ? 'table_chart'
                            : doc.sourceType === 'web'
                            ? 'travel_explore'
                            : 'article'}
                        </span>
                        <span>
                          {doc.sourceType === 'pdf'
                            ? 'PDF'
                            : doc.sourceType === 'csv'
                            ? 'CSV'
                            : doc.sourceType === 'web'
                            ? 'Web Crawler'
                            : 'Notion / Doc'}
                        </span>
                      </span>
                    </td>

                    {/* Publication Status & Audience */}
                    <td className="py-3.5 px-4">
                      <div>
                        {doc.publicationStatus === 'published' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="material-symbols-outlined text-[14px] text-emerald-600">
                              public
                            </span>
                            <span>Published Public</span>
                          </span>
                        )}

                        {doc.publicationStatus === 'internal' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                            <span className="material-symbols-outlined text-[14px] text-amber-700">
                              lock
                            </span>
                            <span>Internal Only</span>
                          </span>
                        )}

                        {doc.publicationStatus === 'ready' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                            <span>Ready</span>
                          </span>
                        )}

                        {doc.publicationStatus === 'draft' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-900 border border-purple-200">
                            <span className="w-2 h-2 rounded-full bg-[#6b38d4] animate-ping"></span>
                            <span>Draft / Processing</span>
                          </span>
                        )}

                        <div className="text-[11px] text-[#464555] mt-1 line-clamp-1">
                          {doc.audienceDesc}
                        </div>
                      </div>
                    </td>

                    {/* Chunks & Vectors */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div className="font-semibold text-[#131b2e]">
                        Số chunk chưa tải
                      </div>
                      <div
                        className={`text-[11px] ${
                          doc.publicationStatus === 'internal'
                            ? 'text-amber-700 font-semibold'
                            : doc.publicationStatus === 'draft'
                            ? 'text-[#6b38d4]'
                            : 'text-emerald-700'
                        }`}
                      >
                        {doc.matchScore}
                      </div>
                    </td>

                    {/* Last Updated */}
                    <td className="py-3.5 px-4">
                      <div className="text-xs text-[#131b2e]">{doc.lastUpdated}</div>
                      <div className="text-[11px] text-[#777587]">{doc.updatedBy}</div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        {doc.publicationStatus === 'ready' ? (
                          <>
                            <button
                              onClick={() => {
                                onUpdateDocument(doc.id, {
                                  publicationStatus: 'published',
                                  audience: 'Published Public',
                                  audienceDesc: 'Audience: Visitor & Agent',
                                });

                              }}
                              className="px-2 py-1 text-xs font-semibold text-white bg-[#3525cd] hover:bg-[#281bb5] rounded transition-colors shadow-xs"
                              type="button"
                            >
                              Publish Public
                            </button>
                            <button
                              onClick={() => onUpdateDocument(doc.id, {publicationStatus: 'internal'})}
                              className="px-2 py-1 text-xs font-semibold text-[#131b2e] hover:bg-[#eaedff] rounded transition-colors"
                              type="button"
                            >
                              Publish Internal
                            </button>
                            <button
                              onClick={() => setEditingId(doc.id)}
                              className="px-2 py-1 text-xs font-medium text-[#131b2e] hover:bg-[#eaedff] rounded transition-colors"
                              type="button"
                            >
                              Review
                            </button>
                          </>
                        ) : doc.publicationStatus === 'draft' ? (
                          <>
                            <button
                              onClick={() => onDeleteDocument(doc.id)}
                              className="px-2 py-1 text-xs font-semibold text-[#ba1a1a] hover:bg-red-50 rounded transition-colors"
                              type="button"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                onUpdateDocument(doc.id, {
                                  publicationStatus: 'ready',


                                  audience: 'Ready',
                                });

                              }}
                              className="px-2 py-1 text-xs font-medium text-[#777587] hover:text-[#131b2e] hover:bg-[#eaedff] rounded transition-colors"
                              type="button"
                            >
                              Retry
                            </button>
                          </>
                        ) : doc.sourceType === 'web' ? (
                          <>
                            <button
                              disabled title="Quản lý lịch thu thập trong Nguồn web; chưa tích hợp tại màn này"
                              className="px-2 py-1 text-xs font-semibold text-[#3525cd] hover:bg-[#eaedff] rounded transition-colors flex items-center gap-1"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[13px]">refresh</span>
                              <span>Re-crawl</span>
                            </button>
                            <button
                              onClick={() => setEditingId(doc.id)}
                              className="px-2 py-1 text-xs font-medium text-[#464555] hover:text-[#131b2e] hover:bg-[#eaedff] rounded transition-colors"
                              type="button"
                            >
                              View Chunks
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingId(doc.id)}
                              className="px-2 py-1 text-xs font-semibold text-[#3525cd] hover:bg-[#eaedff] rounded transition-colors"
                              type="button"
                            >
                              Revise
                            </button>
                            <button
                              onClick={() => {
                                const nextStatus: PublicationStatus =
                                  doc.publicationStatus === 'published' ? 'internal' : 'published';
                                onUpdateDocument(doc.id, {
                                  publicationStatus: nextStatus,
                                  audience: nextStatus === 'published' ? 'Published Public' : 'Internal Only',
                                  audienceDesc:
                                    nextStatus === 'published'
                                      ? 'Audience: Visitor & Agent'
                                      : 'Agent Staff Only • Forbidden from visitor widget RLS',
                                });

                              }}
                              className="px-2 py-1 text-xs font-medium text-[#464555] hover:text-[#131b2e] hover:bg-[#eaedff] rounded transition-colors"
                              type="button"
                            >
                              {doc.publicationStatus === 'published' ? 'Make Internal' : 'Make Public'}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete ${doc.title}?`)) {
                                  onDeleteDocument(doc.id);

                                }
                              }}
                              aria-label="Delete document"
                              className="p-1 text-[#777587] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 text-sm">Hiển thị {sortedDocs.length} / {documents.length} tài liệu đã tải.</div>
      </div>

      <p className="text-sm">Xử lý bản nháp không tự xuất bản. Chỉ tài liệu công khai hợp lệ mới được dùng cho khách.</p>

      {editingId && <KnowledgeEditor key={editingId} id={editingId} onClose={()=>setEditingId(null)} onSaved={onRefresh}/> }
      {/* Import Modal */}
      <ImportDocModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={async (file,requestId) => {await onImportFile(file,requestId);showNotification('Đã nhập bản nháp. Chưa xuất bản.');}}
      />
    </main>
  );
};
