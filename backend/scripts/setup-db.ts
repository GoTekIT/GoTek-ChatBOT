import {Client} from 'pg';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,readdirSync,mkdirSync} from 'node:fs';
const file='.local/runtime.json'; mkdirSync('.local',{recursive:true});
const config=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{host:'127.0.0.1',port:55432,user:'gotek_app',password:randomBytes(32).toString('hex'),database:'gotek_chatbot'};
const admin=new Client({host:'/tmp',port:55432,user:'gotek_migrator',database:'postgres'}); await admin.connect();
if(!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='gotek_app'")).rowCount) await admin.query(`CREATE ROLE gotek_app LOGIN PASSWORD '${config.password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
if(!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[config.database])).rowCount) await admin.query('CREATE DATABASE gotek_chatbot'); await admin.end();
const db=new Client({host:'/tmp',port:55432,user:'gotek_migrator',database:config.database});await db.connect();
await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())');
for(const name of readdirSync('db/migrations').sort()){if((await db.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name])).rowCount)continue; await db.query('BEGIN');try{await db.query(readFileSync(`db/migrations/${name}`,'utf8'));await db.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);await db.query('COMMIT');console.log(`Applied ${name}`);}catch(e){await db.query('ROLLBACK');throw e;}}
await db.end();writeFileSync(file,JSON.stringify(config),{mode:0o600});console.log('Local database ready; runtime credentials stored privately.');
