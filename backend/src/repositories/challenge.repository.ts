import type {PoolClient} from 'pg';

export class ChallengeRepository {
  static async findCandidate(db: PoolClient, tokenHash: string): Promise<{user_id: string} | undefined> {
    const res = await db.query<{user_id: string}>('SELECT user_id FROM challenges WHERE token_hash = $1', [tokenHash]);
    return res.rows[0];
  }

  static async hasRecent(db: PoolClient, userId: string, kind: string, seconds: number): Promise<boolean> {
    const res = await db.query(
      `SELECT 1 FROM challenges WHERE user_id = $1 AND kind = $2 AND created_at > now() - interval '${seconds} seconds'`,
      [userId, kind]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async consume(db: PoolClient, tokenHash: string, kind: string): Promise<{user_id: string} | undefined> {
    const res = await db.query<{user_id: string}>(
      'UPDATE challenges SET used_at = now() WHERE token_hash = $1 AND kind = $2 AND used_at IS NULL AND expires_at > now() RETURNING user_id',
      [tokenHash, kind]
    );
    return res.rows[0];
  }
}
