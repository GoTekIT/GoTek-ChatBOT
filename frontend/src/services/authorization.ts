import type {ConsoleModule} from '../types';

export type WorkspaceRole = 'Owner' | 'Admin' | 'Agent';
export type Permission = 'workspace.read' | 'inbox.use' | 'workspace.manage'
  | 'members.manage' | 'ownership.manage' | 'channels.manage' | 'knowledge.manage'
  | 'usage.read' | 'audit.read';
export interface AuthorizationContext {
  role?: string;
  permissions?: readonly string[];
  platformAdmin?: boolean;
}
const modulePermissions: Record<ConsoleModule, Permission> = {
  inbox: 'inbox.use', knowledge: 'knowledge.manage', channels: 'channels.manage',
  analytics: 'usage.read', settings: 'members.manage', 'widget-demo': 'channels.manage'
};
export function can(context: AuthorizationContext | null | undefined, permission: Permission): boolean {
  return !!context && ['Owner', 'Admin', 'Agent'].includes(context.role ?? '')
    && context.permissions?.includes(permission) === true;
}
export function canOpenModule(context: AuthorizationContext | null | undefined, module: ConsoleModule): boolean {
  return can(context, modulePermissions[module]);
}
export function canManageMember(context: AuthorizationContext, member: {role: string; active: boolean}, activeOwners: number): boolean {
  return can(context, 'members.manage') && (member.role !== 'Owner'
    || (can(context, 'ownership.manage') && (!member.active || activeOwners > 1)));
}
