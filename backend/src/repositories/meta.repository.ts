import type {PoolClient} from 'pg';

export interface MetaConnectionRouteRow {
  connection_id: string;
  workspace_id: string;
  channel_id: string;
}

/** Persistence operations for Meta connections and their server-side credentials. */
export class MetaRepository {
  static async resolveConnectionRoute(
    db: PoolClient,
    surface: string,
    externalAccountId: string,
  ): Promise<MetaConnectionRouteRow | undefined> {
    const row = (await db.query<MetaConnectionRouteRow>(
      'SELECT * FROM resolve_meta_connection_route($1,$2)',
      [surface, externalAccountId],
    )).rows[0];
    return row;
  }

  static async setWorkspaceScope(db: PoolClient, workspaceId: string): Promise<void> {
    await db.query("SELECT set_config('app.workspace_id', $1, true)", [workspaceId]);
  }

  static async storeCredential(
    db: PoolClient,
    workspace: string,
    connection: string,
    encryptedToken: string,
  ): Promise<void> {
    await db.query(`INSERT INTO meta_connection_credentials(workspace_id,connection_id,encrypted_token)
 VALUES($1,$2,$3) ON CONFLICT(workspace_id,connection_id)
 DO UPDATE SET encrypted_token=EXCLUDED.encrypted_token,updated_at=now()`, [workspace, connection, encryptedToken]);
  }

  static async findCredential(
    db: PoolClient,
    workspace: string,
    connection: string,
  ): Promise<{encrypted_token: string} | undefined> {
    const row = (await db.query<{encrypted_token: string}>(
      'SELECT encrypted_token FROM meta_connection_credentials WHERE workspace_id=$1 AND connection_id=$2',
      [workspace, connection],
    )).rows[0];
    return row;
  }
}
