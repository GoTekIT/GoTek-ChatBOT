import React, { useState } from 'react';
import { KnowledgeDocument, PublicationStatus, SourceType } from '../../types';

interface ImportDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (doc: KnowledgeDocument) => void;
}

export const ImportDocModal: React.FC<ImportDocModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'web'>('file');
  const [fileName, setFileName] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [crawlDepth, setCrawlDepth] = useState('2 Levels (Recommended)');
  const [syncCadence, setSyncCadence] = useState('Every 24 Hours');
  const [audience, setAudience] = useState<'published' | 'internal'>('published');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    setTimeout(() => {
      if (activeTab === 'file') {
        const title = fileName.trim() || 'Enterprise_Service_Manual_2026.pdf';
        const isPdf = title.endsWith('.pdf');
        const isCsv = title.endsWith('.csv');
        const sourceType: SourceType = isPdf ? 'pdf' : isCsv ? 'csv' : 'doc';

        const newDoc: KnowledgeDocument = {
          id: `doc-${Date.now()}`,
          title: title,
          size: '2.3 MB',
          hash: `md5-${Math.random().toString(36).substring(2, 8)}`,
          cosineSim: 0.92,
          sourceType: sourceType,
          publicationStatus: audience,
          audience: audience === 'published' ? 'Published Public' : 'Internal Only',
          audienceDesc:
            audience === 'published'
              ? 'Audience: Visitor & Agent'
              : 'Agent Staff Only • Forbidden from visitor widget RLS',
          chunksCount: 16,
          matchScore: '0.94 Match avg',
          lastUpdated: 'Just now',
          updatedBy: 'Alex Rivera',
        };
        onImport(newDoc);
      } else {
        const url = webUrl.trim() || 'https://docs.acmewarp.io/knowledge';
        const newDoc: KnowledgeDocument = {
          id: `doc-${Date.now()}`,
          title: url,
          size: `${crawlDepth.includes('2') ? '42' : '18'} Pages`,
          hash: `web-${Math.random().toString(36).substring(2, 8)}`,
          cosineSim: 0.95,
          sourceType: 'web',
          publicationStatus: audience,
          audience: audience === 'published' ? 'Published Public' : 'Internal Only',
          audienceDesc: `Auto-sync: ${syncCadence}`,
          chunksCount: 38,
          matchScore: 'HTML clean parsed',
          lastUpdated: 'Just now',
          updatedBy: 'Web Crawler Pipeline',
          url: url,
          tag: `Depth: ${crawlDepth}`,
        };
        onImport(newDoc);
      }

      setIsProcessing(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-[#c7c4d8] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#c7c4d8]/70 flex items-center justify-between bg-[#f2f3ff]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#4f46e5] text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#131b2e]">Import Knowledge Source</h3>
              <p className="text-[11px] text-[#464555]">GoTek AI RAG Ingestion Pipeline</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-[#777587] hover:text-[#131b2e] p-1 rounded-lg"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 text-xs">
            {/* Tabs for Import Mode */}
            <div className="flex border-b border-[#c7c4d8]/70 pb-2 gap-4 font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('file')}
                className={`pb-1 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'file'
                    ? 'text-[#3525cd] border-b-2 border-[#3525cd]'
                    : 'text-[#777587] hover:text-[#131b2e]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                <span>File Drag & Drop</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('web')}
                className={`pb-1 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'web'
                    ? 'text-[#3525cd] border-b-2 border-[#3525cd]'
                    : 'text-[#777587] hover:text-[#131b2e]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">travel_explore</span>
                <span>Web Crawler URL</span>
              </button>
            </div>

            {/* Drag & Drop Zone or File selector */}
            {activeTab === 'file' ? (
              <div className="space-y-3">
                <div 
                  onClick={() => {
                    const sampleFiles = [
                      'Huong_dan_bao_tri_ha_tang_2026.pdf',
                      'Enterprise_Terms_Of_Service_v3.pdf',
                      'Quy_chuan_an_toan_thong_tin_FSI.docx',
                      'Techcombank_API_Integration_Spec.csv',
                    ];
                    const chosen = sampleFiles[Math.floor(Math.random() * sampleFiles.length)];
                    setFileName(chosen);
                  }}
                  className="border-2 border-dashed border-[#c7c4d8] rounded-xl p-6 text-center hover:border-[#4f46e5] hover:bg-[#f2f3ff]/50 transition-all cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-[#eaedff] text-[#3525cd] mx-auto flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[24px]">upload_file</span>
                  </div>
                  <div className="font-semibold text-xs text-[#131b2e]">
                    {fileName ? (
                      <span className="text-[#3525cd] font-mono">{fileName} (Selected)</span>
                    ) : (
                      <>Drag your enterprise files here, or <span className="text-[#3525cd] hover:underline">browse</span></>
                    )}
                  </div>
                  <p className="text-[11px] text-[#777587] mt-1">
                    Supports PDF, DOCX, TXT, CSV, JSON, Markdown up to 50MB
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#131b2e] mb-1">
                    Or Enter Document File Name:
                  </label>
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="e.g. Bang_gia_dich_vu_Cloud_2026.pdf"
                    className="w-full px-3 py-1.5 bg-[#f2f3ff] border border-[#c7c4d8] rounded-lg text-xs text-[#131b2e]"
                  />
                </div>
              </div>
            ) : (
              /* Web Crawler URL Section */
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#131b2e] mb-1">
                    Website Sitemap or Base URL
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2 text-[#777587]">
                      language
                    </span>
                    <input
                      type="url"
                      value={webUrl}
                      onChange={(e) => setWebUrl(e.target.value)}
                      placeholder="https://techcombank.com.vn/ho-tro/khach-hang-doanh-nghiep"
                      className="w-full pl-9 pr-3 py-2 bg-[#f2f3ff] border border-[#c7c4d8] rounded-lg text-xs text-[#131b2e] focus:outline-none focus:border-[#4f46e5]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-medium text-[#777587] block mb-1">
                      Max Crawl Depth
                    </label>
                    <select
                      value={crawlDepth}
                      onChange={(e) => setCrawlDepth(e.target.value)}
                      className="w-full py-1.5 px-2 bg-[#f2f3ff] border border-[#c7c4d8] rounded-lg text-xs text-[#131b2e]"
                    >
                      <option>2 Levels (Recommended)</option>
                      <option>3 Levels</option>
                      <option>Single Page Only</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[#777587] block mb-1">
                      Sync Cadence
                    </label>
                    <select
                      value={syncCadence}
                      onChange={(e) => setSyncCadence(e.target.value)}
                      className="w-full py-1.5 px-2 bg-[#f2f3ff] border border-[#c7c4d8] rounded-lg text-xs text-[#131b2e]"
                    >
                      <option>Every 24 Hours</option>
                      <option>Every 7 Days</option>
                      <option>Manual Only</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Target Publication Audience Selector (Mandatory for SRS v1.0) */}
            <div className="bg-[#f2f3ff] p-3.5 rounded-xl border border-[#c7c4d8] space-y-2">
              <label className="block text-xs font-semibold text-[#131b2e]">
                Default Target Audience & Visibility
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label
                  onClick={() => setAudience('published')}
                  className={`flex items-center gap-2 p-2 bg-white border rounded-lg cursor-pointer transition-all ${
                    audience === 'published'
                      ? 'border-[#3525cd] ring-1 ring-[#3525cd]/40'
                      : 'border-[#c7c4d8] hover:border-[#777587]'
                  }`}
                >
                  <input
                    type="radio"
                    name="audience"
                    checked={audience === 'published'}
                    onChange={() => setAudience('published')}
                    className="text-[#3525cd] focus:ring-0"
                  />
                  <div>
                    <div className="font-semibold text-xs text-[#131b2e]">Published Public</div>
                    <div className="text-[10px] text-[#777587]">Visitor & Agent widget</div>
                  </div>
                </label>

                <label
                  onClick={() => setAudience('internal')}
                  className={`flex items-center gap-2 p-2 bg-white border rounded-lg cursor-pointer transition-all ${
                    audience === 'internal'
                      ? 'border-amber-500 ring-1 ring-amber-500/40'
                      : 'border-[#c7c4d8] hover:border-[#777587]'
                  }`}
                >
                  <input
                    type="radio"
                    name="audience"
                    checked={audience === 'internal'}
                    onChange={() => setAudience('internal')}
                    className="text-amber-600 focus:ring-0"
                  />
                  <div>
                    <div className="font-semibold text-xs text-amber-900">Internal Only</div>
                    <div className="text-[10px] text-amber-700">Staff Agent RLS Only</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 bg-[#f2f3ff] border-t border-[#c7c4d8]/70 flex items-center justify-between">
            <span className="text-[11px] text-[#777587] font-mono">
              SRS FR-KNOW-01 Vector Ingest
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-semibold text-[#131b2e] hover:bg-[#eaedff] rounded-lg border border-[#c7c4d8] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#3525cd] hover:bg-[#4f46e5] rounded-lg shadow-sm flex items-center gap-1.5 transition-all active:scale-[0.98]"
              >
                {isProcessing ? (
                  <>
                    <span className="material-symbols-outlined text-[14px] animate-spin">
                      progress_activity
                    </span>
                    <span>Chunking & Embedding...</span>
                  </>
                ) : (
                  <span>Begin Processing & Embedding</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
