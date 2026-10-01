const pg = require('pg');
require('dotenv').config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const r = await pool.query("UPDATE conversations SET status = 'open', reply_owner = 'HUMAN_ACTIVE' WHERE id = 'f7a8fd3c-1347-44b0-896c-9d034c7f4e96'");
  console.log('Updated rows:', r.rowCount);
  await pool.end();
}

run().catch(console.error);
