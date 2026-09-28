import type {PoolClient} from 'pg';
import {uuid} from '../security';

export interface WorkspaceRow {
  id: string;
  name: string;
  language: string;
  status: string;
  seat_limit: number;
  created_at?: string;
}

export class WorkspaceRepository {
  static async findById(db: PoolClient, id: string): Promise<WorkspaceRow | undefined> {
    const res = await db.query<WorkspaceRow>(
      'SELECT id, name, language, status, seat_limit FROM workspaces WHERE id = $1',
      [id]
    );
    return res.rows[0];
  }

  static async lockById(db: PoolClient, id: string): Promise<WorkspaceRow | undefined> {
    const res = await db.query<WorkspaceRow>(
      'SELECT id, name, language, status, seat_limit FROM workspaces WHERE id = $1 FOR UPDATE',
      [id]
    );
    return res.rows[0];
  }

  static async isActive(db: PoolClient, id: string): Promise<boolean> {
    const res = await db.query("SELECT 1 FROM workspaces WHERE id = $1 AND status = 'active'", [id]);
    return res.rowCount !== null && res.rowCount > 0;
  }

  static async create(db: PoolClient, id: string, name: string): Promise<void> {
    await db.query('INSERT INTO workspaces(id, name) VALUES($1, $2)', [id, name]);
  }

  static async update(
    db: PoolClient,
    id: string,
    data: {name: string; language: string}
  ): Promise<{id: string; name: string; language: string}> {
    const res = await db.query<{id: string; name: string; language: string}>(
      'UPDATE workspaces SET name = $1, language = $2 WHERE id = $3 RETURNING id, name, language',
      [data.name, data.language, id]
    );
    return res.rows[0];
  }

  static async createDefaultAiQuota(db: PoolClient, workspaceId: string, limitUnits: number): Promise<void> {
    await db.query(
      "INSERT INTO quota_budgets(id, workspace_id, meter, period_start, period_end, limit_units) VALUES($1, $2, 'ai_response', date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', $3)",
      [uuid(), workspaceId, limitUnits]
    );
  }

  static async findAiUsageLedger(
    db: PoolClient,
    workspaceId: string,
    filter: {from?: string; to?: string}
  ): Promise<any[]> {
    const res = await db.query(
      `SELECT provider, model, count(*)::int AS requests,
              sum(prompt_tokens)::bigint AS prompt_tokens,
              sum(completion_tokens)::bigint AS completion_tokens,
              sum(total_tokens)::bigint AS total_tokens,
              sum(cost_micros)::bigint AS cost_micros
       FROM ai_usage_ledger 
       WHERE workspace_id = $1 
         AND ($2::timestamptz IS NULL OR created_at >= $2) 
         AND ($3::timestamptz IS NULL OR created_at < $3) 
       GROUP BY provider, model 
       ORDER BY provider, model`,
      [workspaceId, filter.from || null, filter.to || null]
    );
    return res.rows;
  }
}
