const pg = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const ch = await pool.query('SELECT name, greeting, prechat FROM channels WHERE id = $1', ['a3b166b1-3614-440c-aa0f-1ad5582708cf']);
  console.log('CHANNEL:', JSON.stringify(ch.rows, null, 2));

  const vis = await pool.query('SELECT id, profile, created_at, expires_at FROM visitors WHERE channel_id = $1 ORDER BY created_at DESC LIMIT 5', ['a3b166b1-3614-440c-aa0f-1ad5582708cf']);
  console.log('VISITORS:', JSON.stringify(vis.rows, null, 2));

  const conv = await pool.query('SELECT c.id, c.status, c.reply_owner, c.visitor_id, c.created_at FROM conversations c WHERE c.channel_id = $1 ORDER BY c.created_at DESC LIMIT 5', ['a3b166b1-3614-440c-aa0f-1ad5582708cf']);
  console.log('CONVERSATIONS:', JSON.stringify(conv.rows, null, 2));

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
