import {inboxDraftKey} from './inbox-drafts';

const PREFIX = 'gotek.inbox.retry.v1.';
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function replyRetryStore(userId: string, workspaceId: string, storage: Store) {
  const scope = PREFIX + inboxDraftKey(userId, workspaceId);
  return {
    begin(conversationId: string, visibility: 'public' | 'internal', body: string): string {
      const key = scope + JSON.stringify([conversationId, visibility, body]);
      const previous = storage.getItem(key);
      if (previous && /^[0-9a-f-]{36}$/i.test(previous)) return previous;
      const id = crypto.randomUUID();
      // Persist before sending: if storage fails, do not risk an untracked retry.
      storage.setItem(key, id);
      return id;
    },
    acknowledge(conversationId: string, visibility: 'public' | 'internal', body: string, id: string) {
      const key = scope + JSON.stringify([conversationId, visibility, body]);
      if (storage.getItem(key) === id) storage.removeItem(key);
    }
  };
}
