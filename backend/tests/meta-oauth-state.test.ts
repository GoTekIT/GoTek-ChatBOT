import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {pool,transaction,scope} from '../src/core/db';
import {digest} from '../src/core/security';
import {createMetaOAuthState,consumeMetaOAuthState} from '../src/modules/meta/oauth-state';
const admin=new pg.Pool({host:process.env.PGHOST||'/tmp',port:Number(process.env.PGPORT)||55432,user:process.env.PGUSER||'gotek_migrator',password:process.env.PGPASSWORD||'gotek_dev_password',database:'gotek_chatbot'});
after(async()=>{await pool.end();await admin.end();});
test('Meta state is tenant/session/provider-bound, expiring and consumed once under concurrency',async()=>{
 const ws=randomUUID(),other=randomUUID(),user=randomUUID();
 const actor={workspace_id:ws,user_id:user,role:'Owner',token_hash:digest(randomUUID())};
 const scoped=<T>(fn:(db:pg.PoolClient)=>Promise<T>,workspace=ws)=>transaction(async db=>{await scope(db,workspace);return fn(db);});
 try {
  await admin.query("INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,'Meta fixture','','unused')",[user,user+'@example.test']);
  for(const id of [ws,other])await admin.query("INSERT INTO workspaces(id,name) VALUES($1,'Meta fixture')",[id]);
  const state=await scoped(db=>createMetaOAuthState(db,actor,'facebook'));
  assert.notEqual((await admin.query('SELECT state_hash FROM meta_oauth_attempts WHERE workspace_id=$1',[ws])).rows[0].state_hash,state);
  await assert.rejects(scoped(db=>createMetaOAuthState(db,{...actor,role:'Agent'},'facebook')),/FORBIDDEN/);
  await assert.rejects(scoped(db=>consumeMetaOAuthState(db,{...actor,token_hash:digest('other')},'facebook',state)),/STATE_INVALID/);
  await assert.rejects(scoped(db=>consumeMetaOAuthState(db,actor,'instagram',state)),/STATE_INVALID/);
  assert.equal(await scoped(async db=>(await db.query('SELECT * FROM meta_oauth_attempts')).rowCount,other),0);
  await assert.rejects(scoped(db=>consumeMetaOAuthState(db,{...actor,workspace_id:other},'facebook',state),other),/STATE_INVALID/);
  const outcomes=await Promise.allSettled([scoped(db=>consumeMetaOAuthState(db,actor,'facebook',state)),scoped(db=>consumeMetaOAuthState(db,actor,'facebook',state))]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(outcomes.filter(r=>r.status==='rejected').length,1);
  const expired=await scoped(db=>createMetaOAuthState(db,actor,'facebook'));
  await admin.query("UPDATE meta_oauth_attempts SET created_at=now()-interval '20 minutes',expires_at=now()-interval '1 minute' WHERE state_hash=$1",[digest(expired)]);
  await assert.rejects(scoped(db=>consumeMetaOAuthState(db,actor,'facebook',expired)),/STATE_INVALID/);
 } finally {
  await admin.query('DELETE FROM meta_oauth_attempts WHERE workspace_id=$1',[ws]);
  await admin.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[[ws,other]]);
  await admin.query('DELETE FROM users WHERE id=$1',[user]);
 }
});
