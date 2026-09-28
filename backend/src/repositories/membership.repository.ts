import type {PoolClient} from 'pg';

export interface MembershipRow {
  workspace_id: string;
  user_id: string;
  role: string;
  active: boolean;
}

export interface MemberDetailRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
}

export class MembershipRepository {
  static async listActiveByUser(db: PoolClient, userId: string): Promise<{workspace_id: string; role: string}[]> {
    const res = await db.query<{workspace_id: string; role: string}>(
      'SELECT workspace_id, role FROM memberships WHERE user_id = $1 AND active ORDER BY workspace_id',
      [userId]
    );
    return res.rows;
  }

  static async listMembersByWorkspace(db: PoolClient, workspaceId: string): Promise<MemberDetailRow[]> {
    const res = await db.query<MemberDetailRow>(
      `SELECT u.id, u.email, u.full_name, m.role, m.active 
       FROM memberships m 
       JOIN users u ON u.id = m.user_id 
       WHERE m.workspace_id = $1 
       ORDER BY u.full_name`,
      [workspaceId]
    );
    return res.rows;
  }

  static async find(db: PoolClient, workspaceId: string, userId: string): Promise<MembershipRow | undefined> {
    const res = await db.query<MembershipRow>(
      'SELECT role, active FROM memberships WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );
    return res.rows[0];
  }

  static async hasActiveMembership(db: PoolClient, workspaceId: string, email: string): Promise<boolean> {
    const res = await db.query(
      `SELECT 1 
       FROM memberships m 
       JOIN users u ON u.id = m.user_id 
       WHERE m.workspace_id = $1 AND u.email = $2 AND m.active`,
      [workspaceId, email]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async countActive(db: PoolClient, workspaceId: string): Promise<number> {
    const res = await db.query('SELECT count(*) FROM memberships WHERE workspace_id = $1 AND active', [workspaceId]);
    return Number(res.rows[0].count);
  }

  static async countActiveOwnersExcept(db: PoolClient, workspaceId: string, excludeUserId: string): Promise<number> {
    const res = await db.query(
      "SELECT 1 FROM memberships WHERE workspace_id = $1 AND active AND role = 'Owner' AND user_id <> $2",
      [workspaceId, excludeUserId]
    );
    return res.rowCount ?? 0;
  }

  static async create(db: PoolClient, workspaceId: string, userId: string, role: string): Promise<void> {
    await db.query('INSERT INTO memberships(workspace_id, user_id, role) VALUES($1, $2, $3)', [
      workspaceId,
      userId,
      role
    ]);
  }

  static async upsert(db: PoolClient, workspaceId: string, userId: string, role: string): Promise<void> {
    await db.query(
      'INSERT INTO memberships(workspace_id, user_id, role) VALUES($1, $2, $3) ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = excluded.role, active = true',
      [workspaceId, userId, role]
    );
  }

  static async update(
    db: PoolClient,
    workspaceId: string,
    userId: string,
    data: {role: string; active: boolean}
  ): Promise<void> {
    await db.query('UPDATE memberships SET role = $1, active = $2 WHERE workspace_id = $3 AND user_id = $4', [
      data.role,
      data.active,
      workspaceId,
      userId
    ]);
  }

  static async isPlatformAdmin(db: PoolClient, userId: string): Promise<boolean> {
    const res = await db.query('SELECT 1 FROM platform_admins WHERE user_id = $1 AND active', [userId]);
    return (res.rowCount ?? 0) > 0;
  }
}
