import {useEffect, useRef, useState} from 'react';
import {replyRetryStore} from '../inbox/reply-retry';
import {InboxService, mapConversation, type InboxRow} from '../../services/inbox.service';
import type {ChatMessage, Conversation} from '../../types';

export function useInboxData(workspaceId: string, enabled: boolean, userId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const rows = useRef<InboxRow[]>([]);
  const epoch = useRef(0);
  const sequence = useRef(0);
  async function refresh() {
    if (!enabled) return;
    const current = epoch.current;
    const request = ++sequence.current;
    try {
      const list = await InboxService.list();
      const messages = selectedConvId && list.some(r => r.id === selectedConvId)
        ? await InboxService.messages(selectedConvId) : [];
      if (current !== epoch.current || request !== sequence.current) return;
      rows.current = list;
      setConversations(list.map(r => mapConversation(r, r.id === selectedConvId ? messages : [])));
      setSelectedConvId(id => list.some(r => r.id === id) ? id : list[0]?.id || '');
      setError('');
    } catch (e) {
      if (current === epoch.current && request === sequence.current) {
        setConversations([]);
        setError(e instanceof Error ? e.message : 'Không thể tải hội thoại.');
      }
    }
  }
  useEffect(() => {
    epoch.current++;
    setConversations([]); setSelectedConvId(''); rows.current = [];
    return () => {epoch.current++;};
  }, [workspaceId, enabled]);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    setLoading(true);
    void refresh().finally(() => {if (!stopped) setLoading(false);});
    const timer = setInterval(() => {void refresh();}, 5000);
    return () => {stopped = true; clearInterval(timer); epoch.current++;};
  }, [workspaceId, enabled, selectedConvId]);
  async function action(run: () => Promise<unknown>) {
    if (!enabled) throw new Error('Bạn không có quyền thao tác hộp thư.');
    await run();
    await refresh();
  }
  return {conversations, selectedConvId, setSelectedConvId, error, loading, refresh,
    async send(id: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) {
      const visibility = message.senderType === 'internal_note' ? 'internal' : 'public';
      if (!enabled || !userId || !workspaceId) throw new Error('Bạn không có quyền gửi tin.');
      const retry = replyRetryStore(userId, workspaceId, sessionStorage);
      let clientId: string;
      try { clientId = retry.begin(id, visibility, message.content); }
      catch { throw new Error('Không thể lưu mã gửi an toàn trong trình duyệt. Chưa gửi tin; hãy kiểm tra bộ nhớ trình duyệt.'); }
      await action(() => InboxService.send(id,clientId,message.content,visibility));
      // A failed cleanup must not turn a confirmed send into a misleading failure.
      try { retry.acknowledge(id, visibility, message.content, clientId); } catch {}
    },
    async takeover(id: string) {
      const row = rows.current.find(r => r.id === id);
      if (!row) throw new Error('Hội thoại không còn trong phạm vi được phép.');
      await action(() => InboxService.takeover(id,row.owner_version));
    },
    resolve: (id: string) => action(() => InboxService.resolve(id))};
}
