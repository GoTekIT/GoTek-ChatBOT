import {HttpError} from './security';

export const workspaceRoles = ['Owner', 'Admin', 'Agent'] as const;
export type WorkspaceRole = typeof workspaceRoles[number];
export type WorkspacePermission = 'workspace.read' | 'inbox.use' | 'workspace.manage'
  | 'members.manage' | 'ownership.manage' | 'channels.manage' | 'knowledge.manage'
  | 'usage.read' | 'audit.read';

const staff: readonly WorkspacePermission[] = ['workspace.read', 'inbox.use'];
const admin: readonly WorkspacePermission[] = [...staff, 'workspace.manage', 'members.manage',
  'channels.manage', 'knowledge.manage', 'usage.read', 'audit.read'];
const permissions: Record<WorkspaceRole, readonly WorkspacePermission[]> = {
  Agent: staff, Admin: admin, Owner: [...admin, 'ownership.manage']
};

export function isWorkspaceRole(role: string): role is WorkspaceRole {
  return workspaceRoles.some(candidate => candidate === role);
}

// Platform status deliberately never contributes workspace permissions.
export function workspacePermissions(role: string): WorkspacePermission[] {
  return isWorkspaceRole(role) ? [...permissions[role]] : [];
}

export function requirePermission(role: string, permission: WorkspacePermission): void {
  if (!workspacePermissions(role).includes(permission)) throw new HttpError(403, 'FORBIDDEN');
}
