import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {pool,scope,transaction} from '../src/core/db';
import {HttpError} from '../src/core/security';
import {enqueueJob} from '../src/modules/jobs/jobs';
import {runWebRefreshOnce} from '../src/modules/web-sources/web-refresh-worker';
const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
after(async()=>{await pool.end();await admin.end();});
test('web refresh persists isolated immutable snapshots; replay skips fetch; paused/changed/expired jobs cannot commit',async()=>{
 const workspace=randomUUID(),other=randomUUID(),user=randomUUID(),source=randomUUID();
 await admin.query('INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,$3,$4,$5)',[user,`${user}@test.invalid`,'Refresh fixture','000','fixture']);
 await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2),($3,$4)',[workspace,'Refresh fixture',other,'Other refresh']);
 await admin.query('INSERT INTO web_sources(id,workspace_id,name,url,type,created_by) VALUES($1,$2,$3,$4,$5,$6)',[source,workspace,'Refresh','https://example.com/','URL',user]);
 const enqueue=()=>transaction(async db=>{await scope(db,workspace);return enqueueJob(db,workspace,{kind:'web.refresh',key:randomUUID(),payload:{sourceId:source},external:false});});
 let calls=0;
 const fetcher=async()=>{calls++;return {url:'https://example.com/',status:200,contentType:'text/html',body:Buffer.from('<h1>Warranty</h1><p>Twelve months.</p>')};};
 try{
  const first=await enqueue();assert.equal((await runWebRefreshOnce(workspace,fetcher)).state,'succeeded');assert.equal(calls,1);
  const snapshot=(await admin.query('SELECT * FROM web_source_snapshots WHERE job_id=$1',[first.id])).rows[0];
  assert.equal(snapshot.document.items[0].text,'Warranty Twelve months.');assert.match(snapshot.content_hash,/^[a-f0-9]{64}$/);
  assert.equal(await transaction(async db=>{await scope(db,other);return (await db.query('SELECT id FROM web_source_snapshots WHERE id=$1',[snapshot.id])).rowCount;}),0);
  await assert.rejects(transaction(async db=>{await scope(db,workspace);await db.query('UPDATE web_source_snapshots SET content_hash=$1 WHERE id=$2',['0'.repeat(64),snapshot.id]);}),{code:'42501'});
  await admin.query("UPDATE jobs SET state='retry',available_at=now() WHERE id=$1",[first.id]);
  assert.equal((await runWebRefreshOnce(workspace,fetcher)).state,'succeeded');assert.equal(calls,1);
  assert.equal((await runWebRefreshOnce(workspace,fetcher)).state,'idle');
  const transient=await enqueue();
  let failedFetches=0;
  for(let attempt=1;attempt<=5;attempt++){
   const outcome=await runWebRefreshOnce(workspace,async()=>{failedFetches++;throw new HttpError(408,'SOURCE_TIMEOUT');});
   assert.equal(outcome.state,attempt===5?'dead':'retry');
   const state=(await admin.query('SELECT state,attempts,error_code FROM jobs WHERE id=$1',[transient.id])).rows[0];
   assert.equal(state.attempts,attempt);assert.equal(state.error_code,'SOURCE_TIMEOUT');
   assert.equal((await admin.query('SELECT id FROM web_source_snapshots WHERE job_id=$1',[transient.id])).rowCount,0);
   if(attempt<5){assert.equal((await runWebRefreshOnce(workspace,fetcher)).state,'idle');await admin.query('UPDATE jobs SET available_at=now() WHERE id=$1',[transient.id]);}
  }
  assert.equal(failedFetches,5);
  const recoverable=await enqueue();
  assert.equal((await runWebRefreshOnce(workspace,async()=>{throw new HttpError(502,'SOURCE_FETCH_FAILED');})).state,'retry');
  await admin.query('UPDATE jobs SET available_at=now() WHERE id=$1',[recoverable.id]);
  assert.equal((await runWebRefreshOnce(workspace,fetcher)).state,'succeeded');
  const recovered=(await admin.query('SELECT state,attempts,error_code,receipt_id FROM jobs WHERE id=$1',[recoverable.id])).rows[0];
  assert.equal(recovered.attempts,2);assert.equal(recovered.error_code,null);assert.match(recovered.receipt_id,/^web-snapshot:/);
  assert.equal((await admin.query('SELECT id FROM web_source_snapshots WHERE job_id=$1',[recoverable.id])).rowCount,1);
  await admin.query("UPDATE web_sources SET type='SITEMAP',url='https://example.com/map.xml' WHERE id=$1",[source]);
  const sitemapJob=await enqueue();
  assert.equal((await runWebRefreshOnce(workspace,async url=>({url,status:200,contentType:url.endsWith('.xml')?'application/xml':'text/html',body:Buffer.from(url.endsWith('.xml')?'<urlset><url><loc>https://example.com/page</loc></url></urlset>':'<p>Crawled business page</p>')}))).state,'succeeded');
  const sitemapDoc=(await admin.query('SELECT document FROM web_source_snapshots WHERE job_id=$1',[sitemapJob.id])).rows[0].document;
  assert.equal(sitemapDoc.kind,'URL');assert.equal(sitemapDoc.items[0].text,'Crawled business page');
  await admin.query("UPDATE web_sources SET type='URL',url='https://example.com/' WHERE id=$1",[source]);
  const paused=await enqueue();assert.equal((await runWebRefreshOnce(workspace,async()=>{await admin.query("UPDATE web_sources SET status='PAUSED' WHERE id=$1",[source]);return fetcher();})).state,'unknown');
  assert.equal((await admin.query('SELECT id FROM web_source_snapshots WHERE job_id=$1',[paused.id])).rowCount,0);
  await admin.query("UPDATE web_sources SET status='ACTIVE' WHERE id=$1",[source]);
  const changed=await enqueue();assert.equal((await runWebRefreshOnce(workspace,async()=>{await admin.query('UPDATE web_sources SET max_pages=1 WHERE id=$1',[source]);return fetcher();})).state,'unknown');
  assert.equal((await admin.query('SELECT id FROM web_source_snapshots WHERE job_id=$1',[changed.id])).rowCount,0);
  const expired=await enqueue();assert.equal((await runWebRefreshOnce(workspace,async()=>{await admin.query("UPDATE jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[expired.id]);return fetcher();})).state,'lease_expired');
  assert.equal((await admin.query('SELECT id FROM web_source_snapshots WHERE job_id=$1',[expired.id])).rowCount,0);
  assert.equal((await admin.query('SELECT id FROM web_source_snapshots WHERE workspace_id=$1',[workspace])).rowCount,3);
 }finally{
  await admin.query('DELETE FROM web_source_snapshots WHERE workspace_id=$1',[workspace]);
  await admin.query('DELETE FROM jobs WHERE workspace_id=$1',[workspace]);
  await admin.query('DELETE FROM web_sources WHERE id=$1',[source]);
  await admin.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[[workspace,other]]);
  await admin.query('DELETE FROM users WHERE id=$1',[user]);
 }
});
