import type {PoolClient} from 'pg';

export class SessionRepository {
  static async create(
    db: PoolClient,
    tokenHash: string,
    userId: string,
    workspaceId: string,
    intervalStr: string
  ): Promise<void> {
    await db.query(
      'INSERT INTO sessions(token_hash, user_id, workspace_id, expires_at) VALUES($1, $2, $3, now() + $4::interval)',
      [tokenHash, userId, workspaceId, intervalStr]
    );
  }

  static async deleteByTokenHash(db: PoolClient, tokenHash: string): Promise<void> {
    await db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }

  static async deleteByUserId(db: PoolClient, userId: string): Promise<void> {
    await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }

  static async updateWorkspace(db: PoolClient, tokenHash: string, workspaceId: string): Promise<void> {
    await db.query('UPDATE sessions SET workspace_id = $1 WHERE token_hash = $2', [workspaceId, tokenHash]);
  }
}
