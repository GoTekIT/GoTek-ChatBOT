import { KnowledgeDocument, StaffMember, Conversation, AuditLogEntry } from '../types';

/**
 * 100% Real Database Mode:
 * All mock data has been removed. Data is fetched directly from PostgreSQL 16 via backend REST/SSE APIs.
 */
export const INITIAL_DOCUMENTS: KnowledgeDocument[] = [];
export const INITIAL_STAFF: StaffMember[] = [];
export const INITIAL_CONVERSATIONS: Conversation[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];
