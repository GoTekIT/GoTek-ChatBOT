import pg, {type PoolClient} from 'pg';
import {readFileSync, existsSync} from 'node:fs';

// Auto-load .env file if available (Node 20+)
try {
  if (existsSync('.env')) {
    process.loadEnvFile?.('.env');
  } else if (existsSync('../.env')) {
    process.loadEnvFile?.('../.env');
  }
} catch {
  // Ignore if .env is missing or invalid
}

function resolveDbConfig(): pg.PoolConfig {
  if (process.env.DB_RUNTIME_FILE) {
    // An explicit runtime file must exist; never fall back to privileged credentials.
    return JSON.parse(readFileSync(process.env.DB_RUNTIME_FILE, 'utf8'));
  }
  if (process.env.DATABASE_URL) {
    return {connectionString: process.env.DATABASE_URL};
  }

  const runtimePath = existsSync('.local/runtime.json')
    ? '.local/runtime.json'
    : existsSync('../.local/runtime.json')
      ? '../.local/runtime.json'
      : null;

  if (runtimePath) {
    try {
      return JSON.parse(readFileSync(runtimePath, 'utf8'));
    } catch (err) {
      console.warn(`[db] Warning: Failed to parse ${runtimePath}:`, err);
    }
  }

  // Fallback configuration (supports DB_* environment variables or defaults)
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 55432,
    database: process.env.DB_NAME || 'gotek_chatbot',
    user: process.env.DB_USER || 'gotek_app',
    password: process.env.DB_PASSWORD || undefined
  };
}

export const pool = new pg.Pool(resolveDbConfig());

// Handle unexpected idle client errors
pool.on('error', err => {
  console.error('[db] Unexpected error on idle PostgreSQL client:', err);
});

const commitCallbacks = new WeakMap<PoolClient, Array<() => void>>();
/** Side effects are emitted only after the owning transaction commits. */
export function afterCommit(db: PoolClient, callback: () => void): void {
  const callbacks = commitCallbacks.get(db);
  if (!callbacks) throw new Error('TRANSACTION_REQUIRED');
  callbacks.push(callback);
}

export async function transaction<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    commitCallbacks.set(db, []);
    const result = await fn(db);
    await db.query('COMMIT');
    for (const callback of commitCallbacks.get(db) || []) {
      try { callback(); } catch { /* REST state remains authoritative; clients can reload. */ }
    }
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    commitCallbacks.delete(db);
    db.release();
  }
}

export async function scope(db: PoolClient, workspaceId: string): Promise<void> {
  await db.query("SELECT set_config('app.workspace_id', $1, true)", [workspaceId]);
}
