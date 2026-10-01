import {api} from '../api/api';
import type {ChatMessage, Conversation} from '../types';

export interface InboxRow {
  transport?: 'website' | 'facebook' | 'instagram';
  id: string; channel_id: string; channel_name: string; status: string;
  reply_owner: string; owner_version: number; assigned_to: string | null; updated_at: string;
}
export interface MessageRow {
  id: string; client_id: string; sequence: number; author_type: string;
  delivery_status?: ChatMessage['deliveryStatus'] | null;
  visibility: string; body: string; created_at: string;
}
export function mapMessage(row: MessageRow): ChatMessage {
  return {id: row.id, senderType: row.visibility === 'internal' ? 'internal_note'
    : row.author_type === 'visitor' ? 'customer' : row.author_type === 'ai' ? 'ai' : 'agent',
    senderName: row.author_type === 'visitor' ? 'Khách hàng' : row.author_type === 'ai' ? 'AI' : 'Nhân viên',
    timestamp: new Date(row.created_at).toLocaleString('vi-VN'), content: row.body, deliveryStatus: row.delivery_status || undefined};
}
export function mapConversation(row: InboxRow, messages: ChatMessage[] = []): Conversation {
  return {id: row.id, customerName: `Khách · ${row.id.slice(0,8)}`, customerCompany: row.channel_name,
    customerEmail: '', customerPhone: '', customerLocation: '', customerAvatar: '',
    clientTier: '', websiteUrl: '', lastMessageSnippet: messages.at(-1)?.content || '',
    lastMessageTime: new Date(row.updated_at).toLocaleString('vi-VN'), channel: row.transport === 'facebook' ? 'Facebook' : row.transport === 'instagram' ? 'Instagram' : 'Widget',
    status: row.status === 'resolved' ? 'resolved' : row.reply_owner === 'AI_ACTIVE' ? 'ai_active'
      : row.reply_owner === 'HUMAN_ACTIVE' ? 'in_review' : 'handoff',
    assignedTo: row.assigned_to || undefined, activeUrl: '', sessionDuration: '—', deviceInfo: '—',
    ragMatchScore: '—', ragCitations: [], crmTags: [], messages};
}
export const InboxService = {
  list: (): Promise<InboxRow[]> => api('/conversations'),
  async messages(id: string): Promise<ChatMessage[]> {
    const result: ChatMessage[] = []; let after = 0;
    for (;;) {
      const rows: MessageRow[] = await api(`/conversations/${encodeURIComponent(id)}/messages?after=${after}`);
      result.push(...rows.map(mapMessage));
      if (rows.length < 100) return result;
      const next = rows.at(-1)!.sequence;
      if (next <= after) throw new Error('Không thể tải tiếp lịch sử hội thoại.');
      after = next;
    }
  },
  send: (id: string, clientId: string, body: string, visibility: 'public' | 'internal') =>
    api(`/conversations/${encodeURIComponent(id)}/messages`, 'POST', {clientId, body, visibility}),
  takeover: (id: string, version: number) => api(`/conversations/${encodeURIComponent(id)}/takeover`, 'POST', {version}),
  resolve: (id: string) => api(`/conversations/${encodeURIComponent(id)}/status`, 'PATCH', {status: 'resolved'})
};
