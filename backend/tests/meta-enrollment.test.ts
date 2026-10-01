import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {pool,transaction,scope} from '../src/core/db';
import {saveFacebookEnrollment,readFacebookEnrollment} from '../src/modules/meta/enrollment';
const admin=new pg.Pool({host:process.env.PGHOST||'/tmp',port:Number(process.env.PGPORT)||55432,user:process.env.PGUSER||'gotek_migrator',password:process.env.PGPASSWORD||'gotek_dev_password',database:'gotek_chatbot'});
after(async()=>{await pool.end();await admin.end();});
test('Meta enrollment encrypts grant and binds access to tenant, user, session, role and expiry',async()=>{
 const ws=randomUUID(),other=randomUUID(),user=randomUUID();
 const actor={workspace_id:ws,user_id:user,role:'Owner',token_hash:randomUUID()};
 const key='ab'.repeat(32),grant={token:'private-token',expiresIn:3600,scopes:['pages_messaging']};
 const scoped=<T>(fn:(db:pg.PoolClient)=>Promise<T>,workspace=ws)=>transaction(async db=>{await scope(db,workspace);return fn(db);});
 try {
  await admin.query("INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,'Meta fixture','','unused')",[user,user+'@example.test']);
  for(const value of [ws,other])await admin.query("INSERT INTO workspaces(id,name) VALUES($1,'Meta fixture')",[value]);
  const id=await scoped(db=>saveFacebookEnrollment(db,actor,grant,key));
  const raw=(await admin.query('SELECT * FROM meta_enrollments WHERE id=$1',[id])).rows[0];
  assert.equal(raw.grant_ciphertext.includes('private-token'),false);
  assert.deepEqual(await scoped(db=>readFacebookEnrollment(db,actor,id,key)),grant);
  for(const changed of [{...actor,token_hash:'other'},{...actor,user_id:randomUUID()}])
   await assert.rejects(scoped(db=>readFacebookEnrollment(db,changed,id,key)),/ENROLLMENT_INVALID/);
  await assert.rejects(scoped(db=>readFacebookEnrollment(db,{...actor,role:'Agent'},id,key)),/FORBIDDEN/);
  await assert.rejects(scoped(db=>readFacebookEnrollment(db,{...actor,workspace_id:other},id,key),other),/ENROLLMENT_INVALID/);
  await assert.rejects(scoped(db=>readFacebookEnrollment(db,actor,id,'cd'.repeat(32))),/CREDENTIAL_UNAVAILABLE/);
  await admin.query("UPDATE meta_enrollments SET created_at=now()-interval '20 minutes',expires_at=now()-interval '1 minute' WHERE id=$1",[id]);
  await assert.rejects(scoped(db=>readFacebookEnrollment(db,actor,id,key)),/ENROLLMENT_INVALID/);
 } finally {
  await admin.query('DELETE FROM meta_enrollments WHERE workspace_id=$1',[ws]);
  await admin.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[[ws,other]]);
  await admin.query('DELETE FROM users WHERE id=$1',[user]);
 }
});
