import 'dotenv/config';
import {pool,scope,transaction} from '../src/core/db';
import {randomUUID} from 'node:crypto';
import {metaBootstrapConfig} from '../src/modules/meta/bootstrap-config';

try{
 const {workspace,connections}=metaBootstrapConfig(process.env);
 const rows=await transaction(async db=>{
  await scope(db,workspace);
  // Serialize bootstrap runs for this workspace; mapping changes require an explicit migration.
  await db.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[workspace]);
  const out=[];
  for(const c of connections){
   const existing=(await db.query('SELECT channel_id,channel_kind,external_page_id FROM meta_connections WHERE workspace_id=$1 AND (channel_id=$2 OR external_page_id=$3) FOR UPDATE',[workspace,c.channel,c.account])).rows;
   if(existing.some(r=>r.channel_id!==c.channel||r.channel_kind!==c.kind||r.external_page_id!==c.account))throw new Error('META_BOOTSTRAP_MAPPING_CONFLICT');
   const row=(await db.query(`INSERT INTO meta_connections(id,workspace_id,channel_id,channel_kind,external_page_id,page_name,page_access_token_ref,status) VALUES($1,$2,$3,$4,$5,$6,$7,'pending') ON CONFLICT(workspace_id,external_page_id) DO NOTHING RETURNING id,channel_kind,status`,[randomUUID(),workspace,c.channel,c.kind,c.account,c.name,c.tokenRef])).rows[0];
   out.push(row||{channel_kind:c.kind,status:'unchanged'});
  }
  return out;
 });
 console.log(JSON.stringify({bootstrapped:rows}));
}catch(error){
 // Database errors and validation objects can contain private configuration.
 const code=error instanceof Error&&/^META_BOOTSTRAP_[A-Z_]+$/.test(error.message)?error.message:'META_BOOTSTRAP_FAILED';
 console.error(code);process.exitCode=1;
}finally{await pool.end();}
