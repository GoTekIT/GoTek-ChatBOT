import type {PoolClient} from 'pg';
import {scope} from '../core/db';
import {HttpError, audit, uuid} from '../core/security';
import {WorkspaceRepository} from '../repositories/workspace.repository';
import {MembershipRepository} from '../repositories/membership.repository';
import {SessionRepository} from '../repositories/session.repository';
import {usageSummary} from '../modules/ai/quota';

export class WorkspaceService {
  /** The caller is authenticated; ownership always belongs to that caller. */
  static async createWorkspace(db: PoolClient, userId: string, name: string) {
    const workspaceId = uuid();
    await scope(db, workspaceId);
    await WorkspaceRepository.create(db, workspaceId, name);
    await MembershipRepository.create(db, workspaceId, userId, 'Owner');
    const quota = Number.parseInt(process.env.GOTEK_DEFAULT_AI_RESPONSE_QUOTA || '1000', 10);
    if (!Number.isSafeInteger(quota) || quota < 0) throw new HttpError(500, 'INVALID_DEFAULT_QUOTA');
    await WorkspaceRepository.createDefaultAiQuota(db, workspaceId, quota);
    await audit(db, workspaceId, userId, 'workspace.created', workspaceId);
    return {id: workspaceId, name, role: 'Owner'};
  }
  static async getWorkspace(db: PoolClient, workspaceId: string): Promise<any> {
    const ws = await WorkspaceRepository.findById(db, workspaceId);
    if (!ws) throw new HttpError(404, 'NOT_FOUND');
    return ws;
  }

  static async updateWorkspace(
    db: PoolClient,
    workspaceId: string,
    userId: string,
    data: {name: string; language: 'vi' | 'en'}
  ): Promise<any> {
    const updated = await WorkspaceRepository.update(db, workspaceId, data);
    await audit(db, workspaceId, userId, 'workspace.updated', workspaceId);
    return updated;
  }

  static async switchWorkspace(
    db: PoolClient,
    userId: string,
    targetWorkspaceId: string,
    tokenHash: string
  ): Promise<void> {
    const membership = await MembershipRepository.find(db, targetWorkspaceId, userId);
    if (!membership || !membership.active) {
      throw new HttpError(403, 'FORBIDDEN');
    }

    await scope(db, targetWorkspaceId);
    const isActive = await WorkspaceRepository.isActive(db, targetWorkspaceId);
    if (!isActive) {
      throw new HttpError(403, 'WORKSPACE_DISABLED');
    }

    await SessionRepository.updateWorkspace(db, tokenHash, targetWorkspaceId);
  }

  static async getAiUsage(
    db: PoolClient,
    workspaceId: string,
    filter: {from?: string; to?: string}
  ): Promise<any[]> {
    if (filter.from && filter.to && new Date(filter.from) > new Date(filter.to)) {
      throw new HttpError(400, 'INVALID_DATE_RANGE');
    }
    return WorkspaceRepository.findAiUsageLedger(db, workspaceId, filter);
  }

  static async getUsage(db: PoolClient): Promise<any> {
    return usageSummary(db);
  }
}
