import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {inboxSend} from '../src/modules/chat/inbox';

test('replaying a committed client id is resolved before ownership fencing', async () => {
  const calls:string[]=[];
  const conversation={id:'00000000-0000-4000-8000-000000000001',channel_id:'00000000-0000-4000-8000-000000000002',reply_owner:'AI_ACTIVE',assigned_to:null,owner_version:3};
  const existing={id:'00000000-0000-4000-8000-000000000003',body:'hello',author_type:'agent',visibility:'public',actor_id:'user'};
  const db={query:async(sql:string,args:any[])=>{
    calls.push(sql);
    if(sql.startsWith('SELECT * FROM conversations')) return {rows:[conversation]};
    if(sql.startsWith('SELECT id FROM channels')) return {rowCount:1,rows:[{id:conversation.channel_id}]};
    if(sql.startsWith('SELECT user_id FROM channel_members')) return {rows:[]};
    if(sql.startsWith('SELECT id FROM messages WHERE workspace_id')) return {rowCount:1,rows:[existing]};
    if(sql.startsWith('SELECT * FROM messages')) return {rows:[existing]};
    if(sql.includes('message_attachments')) return {rows:[]};
    if(sql.includes('meta_media_references')) return {rows:[]};
    return {rows:[]};
  }} as unknown as PoolClient;
  const result=await inboxSend(db,{workspace_id:'00000000-0000-4000-8000-000000000010',user_id:'user',role:'Admin'},conversation.id,{clientId:'00000000-0000-4000-8000-000000000003',body:'hello',visibility:'public'});
  assert.equal(result.id,existing.id);
  assert.equal(calls.some(sql=>sql.startsWith('UPDATE conversations SET reply_owner')),false);
});
