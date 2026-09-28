import type {PoolClient} from 'pg';

export interface InvitationRow {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  token_hash: string;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  created_at?: string;
}

export class InvitationRepository {
  static async listRecent(db: PoolClient, limit: number = 100): Promise<any[]> {
    const res = await db.query(
      'SELECT id, email, role, expires_at, accepted_at, revoked_at FROM invitations ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return res.rows;
  }

  static async countActive(db: PoolClient, workspaceId: string): Promise<number> {
    const res = await db.query(
      'SELECT count(*) FROM invitations WHERE workspace_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL',
      [workspaceId]
    );
    return Number(res.rows[0].count);
  }

  static async revokeExpired(db: PoolClient): Promise<void> {
    await db.query(
      'UPDATE invitations SET revoked_at = now() WHERE expires_at <= now() AND accepted_at IS NULL AND revoked_at IS NULL'
    );
  }

  static async create(
    db: PoolClient,
    invitation: {id: string; workspaceId: string; email: string; role: string; tokenHash: string}
  ): Promise<void> {
    await db.query(
      "INSERT INTO invitations(id, workspace_id, email, role, token_hash, expires_at) VALUES($1, $2, $3, $4, $5, now() + interval '7 days')",
      [invitation.id, invitation.workspaceId, invitation.email, invitation.role, invitation.tokenHash]
    );
  }

  static async revoke(db: PoolClient, id: string): Promise<boolean> {
    const res = await db.query(
      'UPDATE invitations SET revoked_at = now() WHERE id = $1 AND accepted_at IS NULL RETURNING id',
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async findValidForUpdate(db: PoolClient, tokenHash: string): Promise<InvitationRow | undefined> {
    const res = await db.query<InvitationRow>(
      'SELECT * FROM invitations WHERE token_hash = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now() FOR UPDATE',
      [tokenHash]
    );
    return res.rows[0];
  }

  static async markAccepted(db: PoolClient, id: string): Promise<void> {
    await db.query('UPDATE invitations SET accepted_at = now() WHERE id = $1', [id]);
  }
}
