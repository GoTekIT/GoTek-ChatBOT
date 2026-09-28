import type {PoolClient} from 'pg';
import {scope} from '../db';
import {HttpError, audit} from '../security';
import {WorkspaceRepository} from '../repositories/workspace.repository';
import {MembershipRepository} from '../repositories/membership.repository';
import {SessionRepository} from '../repositories/session.repository';
import {usageSummary} from '../quota';

export class WorkspaceService {
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
