import type {PoolClient} from 'pg';

export interface KnowledgeMutationRow {
  operation: string;
  same: boolean;
  response: any;
}

export class KnowledgeRepository {
  static async lockKnowledgeMutation(db: PoolClient, workspaceId: string, requestId: string): Promise<void> {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `knowledge:${workspaceId}:${requestId}`
    ]);
  }

  static async findMutation(
    db: PoolClient,
    workspaceId: string,
    requestId: string,
    payload: any
  ): Promise<KnowledgeMutationRow | undefined> {
    const res = await db.query<KnowledgeMutationRow>(
      'SELECT operation, payload = $3::jsonb AS same, response FROM knowledge_mutations WHERE workspace_id = $1 AND request_id = $2',
      [workspaceId, requestId, payload]
    );
    return res.rows[0];
  }

  static async recordMutation(
    db: PoolClient,
    workspaceId: string,
    requestId: string,
    operation: string,
    payload: any,
    response: any
  ): Promise<void> {
    await db.query(
      'INSERT INTO knowledge_mutations(workspace_id, request_id, operation, payload, response) VALUES($1, $2, $3, $4, $5)',
      [workspaceId, requestId, operation, payload, response]
    );
  }
}
