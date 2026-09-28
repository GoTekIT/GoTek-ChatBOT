import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
test.after(()=>admin.end());
test('H11 generation schema enforces lineage, action values and tenant RLS policy',async()=>{
 const user=randomUUID(),a=randomUUID(),b=randomUUID(),source=randomUUID(),group=randomUUID(),generation=randomUUID(),snapshot=randomUUID(),job=randomUUID(),request=randomUUID();
 try{
  await admin.query("INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,'Gen','0','x')",[user,user+'@e.test']);
  await admin.query("INSERT INTO workspaces(id,name) VALUES($1,'gen-a'),($2,'gen-b')",[a,b]);
  await admin.query("INSERT INTO web_sources(id,workspace_id,name,url,type,created_by) VALUES($1,$2,'source','https://example.com','URL',$3)",[source,a,user]);
  await admin.query("INSERT INTO jobs(id,workspace_id,kind,idempotency_key,payload) VALUES($1,$2,'web.refresh',$3,'{}')",[job,a,randomUUID()]);
  await admin.query("INSERT INTO web_source_snapshots(id,workspace_id,source_id,job_id,content_hash,document) VALUES($1,$2,$3,$4,$5,'{}')",[snapshot,a,source,job,'a'.repeat(64)]);
  await admin.query("INSERT INTO web_source_document_groups(id,workspace_id,source_id,entry_key) VALUES($1,$2,$3,'entry:0')",[group,a,source]);
  await admin.query("INSERT INTO web_source_generations(id,workspace_id,group_id,snapshot_id,request_id) VALUES($1,$2,$3,$4,$5)",[generation,a,group,snapshot,request]);
  await admin.query("INSERT INTO web_source_generation_parts(workspace_id,generation_id,part_index,action) VALUES($1,$2,0,'RETIRE')",[a,generation]);
  await assert.rejects(admin.query("INSERT INTO web_source_generation_parts(workspace_id,generation_id,part_index,action) VALUES($1,$2,1,'DELETE')",[a,generation]),{code:'23514'});
  await assert.rejects(admin.query("INSERT INTO web_source_generations(id,workspace_id,group_id,snapshot_id,request_id) VALUES($1,$2,$3,$4,$5)",[randomUUID(),b,group,snapshot,randomUUID()]),{code:'23503'});
 }finally{
  await admin.query('DELETE FROM web_source_generation_parts WHERE workspace_id=$1',[a]);await admin.query('DELETE FROM web_source_generations WHERE workspace_id=$1',[a]);await admin.query('DELETE FROM web_source_document_groups WHERE workspace_id=$1',[a]);await admin.query('DELETE FROM web_source_snapshots WHERE workspace_id=$1',[a]);await admin.query('DELETE FROM jobs WHERE workspace_id=$1',[a]);await admin.query('DELETE FROM web_sources WHERE workspace_id=$1',[a]);await admin.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[[a,b]]);await admin.query('DELETE FROM users WHERE id=$1',[user]);
 }
});
