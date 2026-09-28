import type {PoolClient} from 'pg';

export interface UserRow {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  password_hash: string;
  verified_at?: string | null;
  created_at?: string;
}

export class UserRepository {
  static async lockEmail(db: PoolClient, email: string): Promise<void> {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [email]);
  }

  static async findByEmail(db: PoolClient, email: string): Promise<UserRow | undefined> {
    const res = await db.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
    return res.rows[0];
  }

  static async findByEmailForUpdate(db: PoolClient, email: string): Promise<UserRow | undefined> {
    const res = await db.query<UserRow>('SELECT * FROM users WHERE email = $1 FOR UPDATE', [email]);
    return res.rows[0];
  }

  static async findById(db: PoolClient, id: string): Promise<UserRow | undefined> {
    const res = await db.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0];
  }

  static async lockById(db: PoolClient, id: string): Promise<void> {
    await db.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [id]);
  }

  static async create(
    db: PoolClient,
    user: {id: string; email: string; fullName: string; phone?: string; passwordHash: string}
  ): Promise<void> {
    await db.query(
      'INSERT INTO users(id, email, full_name, phone, password_hash) VALUES($1, $2, $3, $4, $5)',
      [user.id, user.email, user.fullName, user.phone, user.passwordHash]
    );
  }

  static async updatePassword(db: PoolClient, id: string, passwordHash: string): Promise<void> {
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
  }

  static async markVerified(db: PoolClient, id: string): Promise<void> {
    await db.query('UPDATE users SET verified_at = now() WHERE id = $1', [id]);
  }
}
