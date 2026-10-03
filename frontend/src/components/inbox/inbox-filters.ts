import type { Conversation } from '../../types';

export type InboxFilterTab = 'all' | 'queue' | 'bot' | 'mine';

/**
 * Applies the queue tab and free-text search rules used by the inbox list.
 * Keeping this pure makes the list rules independently testable and avoids
 * coupling them to the large visual component.
 */
export function filterInboxConversations(
  conversations: Conversation[],
  filterTab: InboxFilterTab,
  searchQuery: string,
): Conversation[] {
  const query = searchQuery.toLowerCase();

  return conversations.filter((conversation) => {
    const matchesSearch =
      conversation.customerName.toLowerCase().includes(query) ||
      conversation.customerCompany.toLowerCase().includes(query) ||
      conversation.lastMessageSnippet.toLowerCase().includes(query);

    if (!matchesSearch) return false;
    if (filterTab === 'queue') return conversation.status === 'handoff';
    if (filterTab === 'bot') return conversation.status === 'ai_active';
    if (filterTab === 'mine') return conversation.status === 'in_review' || conversation.status === 'resolved';
    return true;
  });
}
