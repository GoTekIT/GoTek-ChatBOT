import {Client} from 'pg';
import {randomBytes} from 'node:crypto';
import {readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

// Support both monorepo root and backend directory execution
const rootDir = existsSync('backend') ? process.cwd() : resolve(process.cwd(), '..');
const localDir = resolve(rootDir, '.local');
mkdirSync(localDir, {recursive: true});
const file = resolve(localDir, 'runtime.json');

// Check .env if exists to keep password consistent with existing configuration
let envPassword = '';
const envFile = resolve(rootDir, '.env');
if (existsSync(envFile)) {
  const envContent = readFileSync(envFile, 'utf8');
  const match = envContent.match(/DATABASE_URL=postgresql:\/\/[^:]+:([^@]+)@/);
  if (match) envPassword = match[1];
}

const config = existsSync(file)
  ? JSON.parse(readFileSync(file, 'utf8'))
  : {
      host: '127.0.0.1',
      port: 55432,
      user: 'gotek_app',
      password: envPassword || randomBytes(32).toString('hex'),
      database: 'gotek_chatbot'
    };

// Admin connection options (supports Windows TCP and Unix socket)
const adminHost = process.env.PGHOST || (process.platform === 'win32' ? '127.0.0.1' : '/tmp');
const adminPort = Number(process.env.PGPORT) || 55432;
const adminUser = process.env.PGUSER || 'gotek_migrator';
const adminPassword = process.env.PGPASSWORD || 'gotek_dev_password';

const admin = new Client({
  host: adminHost,
  port: adminPort,
  user: adminUser,
  password: adminPassword,
  database: 'postgres'
});
await admin.connect();

if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='gotek_app'")).rowCount) {
  await admin.query(
    `CREATE ROLE gotek_app LOGIN PASSWORD '${config.password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`
  );
} else {
  await admin.query(`ALTER ROLE gotek_app WITH PASSWORD '${config.password}'`);
}

if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [config.database])).rowCount) {
  await admin.query(`CREATE DATABASE ${config.database}`);
}
await admin.query(`GRANT ALL PRIVILEGES ON DATABASE ${config.database} TO gotek_app`);
await admin.end();

const db = new Client({
  host: adminHost,
  port: adminPort,
  user: adminUser,
  password: adminPassword,
  database: config.database
});
await db.connect();

await db.query(
  'CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())'
);

const migrationsDir = existsSync('db/migrations')
  ? 'db/migrations'
  : resolve(rootDir, 'backend/db/migrations');

for (const name of readdirSync(migrationsDir).sort()) {
  if (!name.endsWith('.sql')) continue;
  if ((await db.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name])).rowCount) continue;
  await db.query('BEGIN');
  try {
    await db.query(readFileSync(resolve(migrationsDir, name), 'utf8'));
    await db.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
    await db.query('COMMIT');
    console.log(`Applied ${name}`);
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}

// Grant public schema privileges to gotek_app
await db.query('GRANT ALL ON SCHEMA public TO gotek_app');
await db.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gotek_app');
await db.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gotek_app');
await db.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO gotek_app');
await db.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO gotek_app');

await db.end();
writeFileSync(file, JSON.stringify(config, null, 2), {mode: 0o600});
console.log('Local database ready; runtime credentials stored privately.');
