import type {PoolClient} from 'pg';

export interface MetaConnectionRoute {
  id: string;
  workspace_id: string;
  channel_id: string;
}

/** Only routing metadata crosses the tenant boundary; all writes remain scoped. */
export async function resolveConnectionRoute(
  db: PoolClient, surface: string, externalAccountId: string,
): Promise<MetaConnectionRoute | undefined> {
  const row = (await db.query(
    'SELECT * FROM resolve_meta_connection_route($1,$2)',
    [surface, externalAccountId],
  )).rows[0];
  if (!row) return undefined;
  await db.query("SELECT set_config('app.workspace_id', $1, true)", [row.workspace_id]);
  return {id: row.connection_id, workspace_id: row.workspace_id, channel_id: row.channel_id};
}
