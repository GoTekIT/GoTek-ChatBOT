import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {pool,transaction,scope} from '../src/core/db';
import {listMetaConnections,disconnectMetaConnection} from '../src/modules/meta/connections';
const admin=new pg.Pool({host:process.env.PGHOST||'/tmp',port:Number(process.env.PGPORT)||55432,user:process.env.PGUSER||'gotek_migrator',password:process.env.PGPASSWORD||'gotek_dev_password',database:'gotek_chatbot'});
after(async()=>{await pool.end();await admin.end();});
test('Meta connections isolate credentials, reject Agent, and fence idempotent disconnect',async()=>{
 const ws=randomUUID(),other=randomUUID(),user=randomUUID(),channel=randomUUID(),id=randomUUID();
 const actor={workspace_id:ws,user_id:user,role:'Owner',token_hash:'fixture'};
 const scoped=<T>(fn:(db:pg.PoolClient)=>Promise<T>,workspace=ws)=>transaction(async db=>{await scope(db,workspace);return fn(db);});
 try {
  await admin.query("INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,'Meta fixture','','unused')",[user,user+'@example.test']);
  for(const value of [ws,other])await admin.query("INSERT INTO workspaces(id,name) VALUES($1,'Meta fixture')",[value]);
  await admin.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'Meta','https://example.test','','#000',$3,$4,'{}')",[channel,ws,randomUUID(),randomUUID()]);
  await admin.query("INSERT INTO meta_connections(id,workspace_id,channel_id,provider,asset_id,asset_name,token_ciphertext,status,connected_by) VALUES($1,$2,$3,'facebook',$4,'Page','encrypted-secret','active',$5)",[id,ws,channel,String(Date.now()),user]);
  const rows=await scoped(db=>listMetaConnections(db,actor));
  assert.equal(rows.length,1);assert.equal('token_ciphertext' in rows[0],false);
  assert.equal((await scoped(db=>listMetaConnections(db,{...actor,workspace_id:other}),other)).length,0);
  await assert.rejects(scoped(db=>disconnectMetaConnection(db,{...actor,role:'Agent'},id)),/FORBIDDEN/);
  await assert.rejects(scoped(db=>disconnectMetaConnection(db,{...actor,workspace_id:other},id),other),/NOT_FOUND/);
  await scoped(db=>disconnectMetaConnection(db,actor,id));
  await scoped(db=>disconnectMetaConnection(db,actor,id));
  const saved=(await admin.query('SELECT * FROM meta_connections WHERE id=$1',[id])).rows[0];
  assert.equal(saved.status,'disconnected');assert.equal(saved.token_ciphertext,null);assert.equal(saved.generation,2);
  assert.equal((await admin.query("SELECT * FROM audit_events WHERE workspace_id=$1 AND action='meta.connection.disconnected'",[ws])).rowCount,1);
 } finally {
  await admin.query('DELETE FROM meta_connections WHERE workspace_id=$1',[ws]);
  await admin.query('DELETE FROM audit_events WHERE workspace_id=$1',[ws]);
  await admin.query('DELETE FROM channels WHERE workspace_id=$1',[ws]);
  await admin.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[[ws,other]]);
  await admin.query('DELETE FROM users WHERE id=$1',[user]);
 }
});
