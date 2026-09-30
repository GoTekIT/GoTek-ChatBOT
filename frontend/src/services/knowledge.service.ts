import {api, getStoredToken, ApiError} from '../api/api';
import type {KnowledgeDocument} from '../types';
export interface KnowledgeRow {
  id: string; title: string; content: string; active: boolean; revision: number;
  draft_version_id: string; published_version_id: string | null; audience: string;
  state: string; source_type: string; updated_at: string;
}
export function mapKnowledge(row: KnowledgeRow): KnowledgeDocument {
  return {id: row.id,title: row.title,size: `${new TextEncoder().encode(row.content).length} B`,hash: '',cosineSim: 0,
    sourceType: row.source_type === 'WEB' ? 'web' : 'doc',
    publicationStatus: row.published_version_id === row.draft_version_id ? row.audience === 'PUBLIC' ? 'published' : 'internal' : row.state === 'READY' ? 'ready' : 'draft',
    audience: row.published_version_id ? row.audience : 'Chưa xuất bản', audienceDesc: 'Phạm vi do server xác định',
    chunksCount: 0,matchScore: 'Chưa đo',lastUpdated: new Date(row.updated_at).toLocaleString('vi-VN'),updatedBy: '—'};
}
export const KnowledgeService = {
  detail: (id:string): Promise<KnowledgeRow> => api(`/knowledge/items/${encodeURIComponent(id)}`),
  edit: (row:KnowledgeRow,title:string,content:string,requestId:string) => api(`/knowledge/items/${row.id}/draft`,'PATCH',{
    requestId,expectedRevision:row.revision,title,content}),
  async list(): Promise<KnowledgeRow[]> {
    const rows: KnowledgeRow[]=[]; let cursor: string | null = null;
    do {
      const page = await api(`/knowledge/items?active=true&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      rows.push(...page.items); cursor=page.nextCursor;
    } while(cursor);
    return rows;
  },
  async importDocument(file: File, requestId: string) {
    const body=new FormData(); body.append('file',file);
    const token=getStoredToken();
    const headers: Record<string,string>={'X-Gotek-Request':'1','X-Gotek-Import-Id':requestId};
    if(token) headers.Authorization=`Bearer ${token}`;
    const response=await fetch('/api/knowledge/import-document',{method:'POST',credentials:'include',headers,body});
    const result=await response.json();
    if(!response.ok || result.error) throw new ApiError(typeof result.error === 'string' ? result.error : result.error?.code || 'IMPORT_FAILED');
    return result;
  },
  process: (row: KnowledgeRow, requestId: string) => api(`/knowledge/items/${row.id}/process`,'POST',{
    requestId,expectedRevision:row.revision,versionId:row.draft_version_id}),
  publish: (row: KnowledgeRow, requestId: string, audience: 'PUBLIC'|'INTERNAL') => api(`/knowledge/items/${row.id}/publish`,'POST',{
    requestId,expectedRevision:row.revision,versionId:row.draft_version_id,audience}),
  archive: (row: KnowledgeRow, requestId: string) => api(`/knowledge/items/${row.id}/archive`,'POST',{
    requestId,expectedRevision:row.revision})
};
