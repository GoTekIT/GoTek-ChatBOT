import pg, {type PoolClient} from 'pg';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Auto-load .env file if available (Node 20+)
try {
  process.loadEnvFile?.(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {
  // Ignore if .env is missing or invalid
}

function resolveDbConfig(): pg.PoolConfig {
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

export async function transaction<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const result = await fn(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

export async function scope(db: PoolClient, workspaceId: string): Promise<void> {
  await db.query("SELECT set_config('app.workspace_id', $1, true)", [workspaceId]);
}
