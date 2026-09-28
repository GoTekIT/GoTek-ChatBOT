import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {pool,scope,transaction} from '../src/core/db';
import {purgeExpiredSessions} from '../src/core/session-maintenance';

const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
after(async()=>{await pool.end();await admin.end();});

test('H23 expired sessions are purged in bounded batches without touching live sessions',async()=>{
 const workspace=randomUUID(),other=randomUUID(),user=randomUUID(),otherUser=randomUUID();
 await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$3),($2,$4)',[workspace,other,'H23 sessions','H23 other']);
 await admin.query("INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,'H23','00000000','fixture'),($3,$4,'H23 other','00000000','fixture')",[user,`h23-${user}@example.test`,otherUser,`h23-${otherUser}@example.test`]);
 const expired=[randomUUID(),randomUUID(),randomUUID()], live=randomUUID(), otherExpired=randomUUID();
 await admin.query("INSERT INTO sessions(token_hash,user_id,workspace_id,expires_at) VALUES($1,$2,$3,now()-interval '1 hour'),($4,$2,$3,now()-interval '2 hours'),($5,$2,$3,now()-interval '3 hours'),($6,$2,$3,now()+interval '1 hour'),($7,$8,$9,now()-interval '1 hour')",[expired[0],user,workspace,expired[1],expired[2],live,otherExpired,otherUser,other]);
 const removed=await transaction(async db=>{await scope(db,workspace);return purgeExpiredSessions(db,2);});
 assert.ok(removed>=4);
 const rows=(await admin.query('SELECT token_hash,expires_at FROM sessions WHERE token_hash=ANY($1::text[])',[ [live,...expired,otherExpired] ])).rows;
 assert.deepEqual(rows.map(r=>r.token_hash),[live]);
 await admin.query('DELETE FROM sessions WHERE user_id IN ($1,$2)',[user,otherUser]);
 await admin.query('DELETE FROM users WHERE id IN ($1,$2)',[user,otherUser]);
 await admin.query('DELETE FROM workspaces WHERE id IN ($1,$2)',[workspace,other]);
});

test('H23 maintenance rejects unbounded batch sizes',async()=>{
 await assert.rejects(transaction(async db=>purgeExpiredSessions(db,0)),{message:'INVALID_BATCH_SIZE'});
 await assert.rejects(transaction(async db=>purgeExpiredSessions(db,5001)),{message:'INVALID_BATCH_SIZE'});
});
