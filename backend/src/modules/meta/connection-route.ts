import type {PoolClient} from 'pg';
import {MetaRepository} from '../../repositories/meta.repository';

export interface MetaConnectionRoute {
  id: string;
  workspace_id: string;
  channel_id: string;
}

/** Only routing metadata crosses the tenant boundary; all writes remain scoped. */
export async function resolveConnectionRoute(
  db: PoolClient, surface: string, externalAccountId: string,
): Promise<MetaConnectionRoute | undefined> {
  const row = await MetaRepository.resolveConnectionRoute(db, surface, externalAccountId);
  if (!row) return undefined;
  await MetaRepository.setWorkspaceScope(db, row.workspace_id);
  return {id: row.connection_id, workspace_id: row.workspace_id, channel_id: row.channel_id};
}
