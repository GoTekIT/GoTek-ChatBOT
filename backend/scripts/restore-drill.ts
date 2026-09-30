import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,chmodSync,readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
// Dedicated disposable database; never accepts a caller-provided restore target.
const target=`gotek_restore_${randomUUID().replaceAll('-','')}`;
const source='gotek_chatbot';
const options={host:'127.0.0.1',port:55432,user:'gotek_migrator'};
const root=new pg.Client({...options,database:'postgres'});await root.connect();
const live=new pg.Client({...options,database:source});await live.connect();
mkdirSync('.local/backups',{recursive:true});chmodSync('.local/backups',0o700);
const backup=`.local/backups/${target}.dump`;
const args=['-h','/tmp','-p','55432','-U','gotek_migrator'];
const started=Date.now();
async function contentHashes(client:pg.Client,tables:string[]){
 const result:Record<string,string>={};
 for(const table of tables){
  const identifier='"'+table.replaceAll('"','""')+'"';
  const hash=createHash('sha256');
  await client.query(`DECLARE restore_hash_cursor NO SCROLL CURSOR FOR SELECT to_jsonb(t)::text AS value FROM ${identifier} t ORDER BY to_jsonb(t)::text COLLATE "C"`);
  try{
   while(true){const batch=await client.query('FETCH 500 FROM restore_hash_cursor');if(!batch.rows.length)break;for(const row of batch.rows){hash.update(row.value);hash.update('\n');}}
  }finally{await client.query('CLOSE restore_hash_cursor');}
  result[table]=hash.digest('hex');
 }
 return result;
}
try{
 // Freeze writers for a consistent count baseline and dump snapshot.
 await live.query('BEGIN');
 await live.query("SET LOCAL TIME ZONE 'UTC'");
 const tables=(await live.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename as string);
 for(const table of tables)await live.query(`LOCK TABLE "${table}" IN SHARE MODE`);
 const counts:Record<string,number>={};for(const table of tables)counts[table]=Number((await live.query(`SELECT count(*) FROM "${table}"`)).rows[0].count);
 const expectedHashes=await contentHashes(live,tables);
 execFileSync('pg_dump',[...args,'-Fc','-f',backup,source],{timeout:60000});chmodSync(backup,0o600);
 const backupSha256=createHash('sha256').update(readFileSync(backup)).digest('hex');
 writeFileSync(`${backup}.sha256`,backupSha256+'\n',{mode:0o600});
 await live.query('COMMIT');
 await root.query(`CREATE DATABASE ${target}`);
 // No server/worker is started against the restored database.
 if(createHash('sha256').update(readFileSync(backup)).digest('hex')!==readFileSync(`${backup}.sha256`,'utf8').trim())throw new Error('BACKUP_CHECKSUM_MISMATCH');
 execFileSync('pg_restore',[...args,'--exit-on-error','-d',target,backup],{timeout:60000});
 const restored=new pg.Client({...options,database:target});await restored.connect();
 try{
 const actual:Record<string,number>={};for(const table of tables)actual[table]=Number((await restored.query(`SELECT count(*) FROM "${table}"`)).rows[0].count);
 if(JSON.stringify(counts)!==JSON.stringify(actual))throw new Error('RESTORE_COUNT_MISMATCH');
 await restored.query('BEGIN');
 await restored.query("SET LOCAL TIME ZONE 'UTC'");
 const restoredHashes=await contentHashes(restored,tables);
 if(JSON.stringify(expectedHashes)!==JSON.stringify(restoredHashes))throw new Error('RESTORE_CONTENT_MISMATCH');
 await restored.query('DELETE FROM sessions');await restored.query('DELETE FROM challenges');await restored.query('DELETE FROM local_delivery');await restored.query('UPDATE invitations SET revoked_at=now() WHERE revoked_at IS NULL');
 await restored.query("UPDATE jobs SET state='cancelled',lease_token=NULL,lease_until=NULL WHERE state IN ('queued','running','retry','unknown')");
 await restored.query('UPDATE providers SET enabled=false');await restored.query('UPDATE model_grants SET active=false');
 await restored.query('UPDATE support_grants SET revoked_at=coalesce(revoked_at,now())');
 await restored.query('UPDATE visitors SET expires_at=now()');
 await restored.query('COMMIT');
 await restored.query('SET ROLE gotek_app');
 const visible=await restored.query('SELECT id FROM workspaces');if(visible.rowCount!==0)throw new Error('RESTORE_RLS_FAILED');
 await restored.query('RESET ROLE');
 const policy=(await restored.query("SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname")).rows;
 const originalPolicy=(await live.query("SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname")).rows;
 if(JSON.stringify(policy)!==JSON.stringify(originalPolicy))throw new Error('RESTORE_POLICY_MISMATCH');
 const report={timestamp:new Date().toISOString(),source,target,status:'PASS',durationMs:Date.now()-started,counts,contentHashes:restoredHashes,backupSha256,policies:policy,quarantine:{serverStarted:false,workerStarted:false,sessionsCleared:true,challengesCleared:true,deliveryCleared:true,invitationsRevoked:true,jobsQuarantined:true,providersDisabled:true,modelGrantsRevoked:true,supportGrantsRevoked:true,visitorSessionsExpired:true},limitations:['Database only: object storage and vector index not implemented yet','No production RPO/RTO acceptance','Backup contains test credentials; private local storage, not committed']};
 mkdirSync('delivery/evidence',{recursive:true});writeFileSync('delivery/evidence/p1-restore-drill.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,tables:tables.length,durationMs:report.durationMs}));
 }finally{await restored.end();}
}finally{await live.query('ROLLBACK').catch(()=>{});await live.end();await root.query(`DROP DATABASE IF EXISTS ${target} WITH (FORCE)`);await root.end();}
