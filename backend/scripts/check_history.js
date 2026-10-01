import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function checkMessages() {
  const convId = 'f7a8fd3c-1347-44b0-896c-9d034c7f4e96';

  console.log('=== 1. KIỂM TRA HỘI THOẠI ĐANG CHAT (ID: ' + convId + ') ===');
  const conv = await pool.query(
    'SELECT id, status, reply_owner, owner_version, next_sequence, updated_at FROM conversations WHERE id = $1',
    [convId]
  );
  console.log('Thông tin hội thoại:', conv.rows[0]);

  const messages = await pool.query(
    `SELECT sequence, author_type, visibility, body, created_at, client_id, id
     FROM messages 
     WHERE conversation_id = $1 
     ORDER BY sequence ASC`,
    [convId]
  );
  console.log(`\nTổng số tin nhắn đã lưu trong DB cho hội thoại này: ${messages.rows.length} tin nhắn:`);
  console.table(messages.rows.map(m => ({
    STT: m.sequence,
    NguoiGui: m.author_type,
    CheDo: m.visibility,
    NoiDung: m.body,
    ThoiGian: m.created_at?.toISOString()
  })));

  console.log('\n=== 2. CÁC TIN NHẮN MỚI NHẤT TRÊN TOÀN HỆ THỐNG ===');
  const recent = await pool.query(
    `SELECT m.sequence, m.author_type, m.visibility, m.body, m.created_at, m.conversation_id
     FROM messages m
     ORDER BY m.created_at DESC
     LIMIT 10`
  );
  console.table(recent.rows.map(m => ({
    ConvID: m.conversation_id.slice(0, 8) + '...',
    NguoiGui: m.author_type,
    CheDo: m.visibility,
    NoiDung: m.body.slice(0, 50),
    ThoiGian: m.created_at?.toISOString()
  })));

  await pool.end();
}

checkMessages().catch(console.error);
