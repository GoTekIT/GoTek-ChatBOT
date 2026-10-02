export type ConsoleModule = 'inbox' | 'knowledge' | 'channels' | 'analytics' | 'settings' | 'widget-demo';
export type SettingsSubTab = 'general' | 'staff' | 'routing' | 'audit';

export type PublicationStatus = 'published' | 'internal' | 'ready' | 'draft';
export type SourceType = 'pdf' | 'csv' | 'web' | 'doc' | 'api';

export interface KnowledgeDocument {
  id: string;
  title: string;
  size: string;
  hash: string;
  cosineSim: number;
  sourceType: SourceType;
  publicationStatus: PublicationStatus;
  audience: string;
  audienceDesc: string;
  chunksCount: number;
  matchScore: string;
  lastUpdated: string;
  updatedBy: string;
  tag?: string;
  url?: string;
  processingProgress?: number;
}

export type StaffRole = 'owner' | 'admin' | 'agent' | 'support_temp';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: StaffRole;
  roleTitle: string;
  isCurrentUser?: boolean;
  status: 'online' | 'offline' | 'away';
  statusText: string;
  activeChats: number;
  maxChats: number;
  assignedChannels: string[];
  lastActive: string;
  locationInfo: string;
  tempTtl?: string;
  isTempGrant?: boolean;
}

export interface ChatMessage {
  id: string;
  clientId?: string;
  created_at?: string;
  createdAt?: string;
  senderType: 'customer' | 'ai' | 'agent' | 'internal_note' | 'system_event';
  senderName: string;
  senderAvatar?: string;
  senderRole?: string;
  timestamp: string;
  content: string;
  citations?: Array<{
    title: string;
    pageOrSection?: string;
    similarity?: string;
    verified?: boolean;
  }>;
}

export interface PrechatFormEntry {
  key: string;
  label: string;
  value: string;
  required?: boolean;
  placeholder?: string;
}

export interface Conversation {
  id: string;
  channel_name?: string;
  channelName?: string;
  customerName: string;
  customerCompany?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerLocation?: string;
  customerAvatar?: string;
  clientTier?: string;
  websiteUrl?: string;
  lastMessageSnippet: string;
  lastMessageTime: string;
  unreadCount?: number;
  channel: 'Widget' | 'Slack App' | 'Email' | 'API Chat';
  status: 'handoff' | 'ai_active' | 'in_review' | 'resolved';
  reply_owner?: string;
  replyOwner?: string;
  assignedTo?: string;
  ownerVersion?: number;
  slaCountdown?: string;
  slaUrgent?: boolean;
  activeUrl?: string;
  sessionDuration?: string;
  deviceInfo?: string;
  ragMatchScore?: string;
  ragCitations?: Array<{
    title: string;
    similarity: string;
    excerpt: string;
  }>;
  crmTags: string[];
  prechatForm?: PrechatFormEntry[];
  channelPrechatMessage?: string;
  visitorProfile?: Record<string, any>;
  messages: ChatMessage[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  ipAddress: string;
  complianceCode: string;
  status: 'Success' | 'Flagged';
}
