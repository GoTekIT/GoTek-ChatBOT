import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {syncMetaHistoryOnce} from '../src/modules/meta/history';

function fixture(cursor?:string,locked=true,checkpoint?:Record<string,unknown>){
 const writes:unknown[][]=[];
 const db={query:async(sql:string,args:unknown[]=[])=>{
  if(sql.startsWith('SELECT id,channel_id'))return {rows:[{id:'connection',channel_id:'channel',external_page_id:'page',channel_kind:'facebook_messenger',page_access_token_ref:'HISTORY_TEST_TOKEN'}]};
  if(sql.startsWith('SELECT pg_try_advisory'))return {rows:[{locked}]};
  if(sql.startsWith('SELECT next_url'))return {rows:checkpoint?[checkpoint]:cursor?[{next_url:cursor}]:[]};
  if(sql.startsWith('SELECT encrypted_token'))return {rows:[]};
  writes.push(args);return {rows:[]};
 }} as unknown as PoolClient;
 return {db,writes};
}
test('history paging never persists the provider token',async()=>{
 process.env.HISTORY_TEST_TOKEN='test-secret';
 const {db,writes}=fixture();
 await syncMetaHistoryOnce(db,'workspace','connection',async()=>new Response(JSON.stringify({data:[],paging:{next:'https://graph.facebook.com/v26.0/page/conversations?after=cursor&access_token=secret'}})) as any);
 assert.equal(writes[0][2],'https://graph.facebook.com/v26.0/page/conversations?after=cursor');
 delete process.env.HISTORY_TEST_TOKEN;
});
test('history refuses a cursor on another host before sending credentials',async()=>{
 process.env.HISTORY_TEST_TOKEN='test-secret';
 const {db}=fixture('https://attacker.invalid/page');
 let calls=0;
 await assert.rejects(syncMetaHistoryOnce(db,'workspace','connection',async()=>{calls++;return new Response('{}');}),/META_HISTORY_CURSOR_INVALID/);
 assert.equal(calls,0);
 delete process.env.HISTORY_TEST_TOKEN;
});

test('busy history connection does not fetch or advance its checkpoint',async()=>{
 process.env.HISTORY_TEST_TOKEN='test-secret';
 const {db,writes}=fixture(undefined,false);
 let calls=0;
 const result=await syncMetaHistoryOnce(db,'workspace','connection',async()=>{calls++;return new Response('{}');});
 assert.equal(result.state,'busy');assert.equal(calls,0);assert.equal(writes.length,0);
 delete process.env.HISTORY_TEST_TOKEN;
});
test('recently completed scan does not poll Meta every second',async()=>{
 process.env.HISTORY_TEST_TOKEN='test-secret';
 const {db,writes}=fixture(undefined,true,{state:'complete',last_synced_at:new Date()});
 let calls=0;
 const result=await syncMetaHistoryOnce(db,'workspace','connection',async()=>{calls++;return new Response('{}');});
 assert.equal(result.state,'idle');assert.equal(calls,0);assert.equal(writes.length,0);
 delete process.env.HISTORY_TEST_TOKEN;
});
test('malformed success cannot erase a durable history cursor',async()=>{
 process.env.HISTORY_TEST_TOKEN='test-secret';
 const {db,writes}=fixture('https://graph.facebook.com/v26.0/page/conversations?after=old');
 await assert.rejects(syncMetaHistoryOnce(db,'workspace','connection',async()=>new Response('{}')),/META_HISTORY_RESPONSE_INVALID/);
 assert.equal(writes.length,0);
 delete process.env.HISTORY_TEST_TOKEN;
});

test('nested history cursor commits and resumes independently after restart',async()=>{
 process.env.HISTORY_TEST_TOKEN='test-secret';
 try {
 const {db,writes}=fixture();
 const result=await syncMetaHistoryOnce(db,'workspace','connection',async()=>new Response(JSON.stringify({data:[{participants:{data:[{id:'customer',name:'Customer'}]},messages:{data:[],paging:{next:'https://graph.facebook.com/v26.0/thread/messages?after=next&access_token=secret'}}}],paging:{next:'https://graph.facebook.com/v26.0/page/conversations?after=outer'}})));
 assert.equal(result.state,'more');assert.equal(writes.length,1);
 const pending=JSON.parse(String(writes[0][4]));
 assert.equal(pending[0].next,'https://graph.facebook.com/v26.0/thread/messages?after=next');
 assert.deepEqual(pending[0].participants,[{id:'customer',name:'Customer'}]);
 const resumed=fixture(undefined,true,{next_url:writes[0][2],pending_threads:pending,state:'pending'});
 const urls:string[]=[];
 const second=await syncMetaHistoryOnce(resumed.db,'workspace','connection',async url=>{urls.push(String(url));return new Response(JSON.stringify({data:[]}));});
 assert.deepEqual(urls,[pending[0].next]);assert.equal(second.state,'more');
 assert.equal(resumed.writes[0][2],writes[0][2]);assert.equal(resumed.writes[0][4],'[]');
 }finally{delete process.env.HISTORY_TEST_TOKEN;}
});
test('failed resumed message page preserves both checkpoint levels',async()=>{
 process.env.HISTORY_TEST_TOKEN='test-secret';
 try {
 const {db,writes}=fixture(undefined,true,{next_url:'https://graph.facebook.com/outer',pending_threads:[{next:'https://graph.facebook.com/messages',participants:[]}],state:'pending'});
 await assert.rejects(syncMetaHistoryOnce(db,'workspace','connection',async()=>new Response('{}',{status:503})),/META_HISTORY_FETCH_FAILED/);
 assert.equal(writes.length,0);
 }finally{delete process.env.HISTORY_TEST_TOKEN;}
});
test('last nested page completes and repeated provider cursor is rejected',async()=>{
 process.env.HISTORY_TEST_TOKEN='test-secret';
 try {
 const checkpoint={pending_threads:[{next:'https://graph.facebook.com/messages',participants:[]}],state:'pending'};
 const {db,writes}=fixture(undefined,true,checkpoint);
 assert.equal((await syncMetaHistoryOnce(db,'workspace','connection',async()=>new Response(JSON.stringify({data:[]})))).state,'complete');
 assert.equal(writes[0][4],'[]');
 const repeated=fixture(undefined,true,checkpoint);
 await assert.rejects(syncMetaHistoryOnce(repeated.db,'workspace','connection',async()=>new Response(JSON.stringify({data:[],paging:{next:'https://graph.facebook.com/messages'}}))),/META_HISTORY_PAGING_LOOP/);
 assert.equal(repeated.writes.length,0);
 }finally{delete process.env.HISTORY_TEST_TOKEN;}
});

test('history retry cooldown applies even when credential is missing',async()=>{
 delete process.env.HISTORY_TEST_TOKEN;
 const {db,writes}=fixture(undefined,true,{state:'retry',updated_at:new Date(),next_url:'https://graph.facebook.com/v26.0/page/conversations?after=saved'});
 let calls=0;
 const result=await syncMetaHistoryOnce(db,'workspace','connection',async()=>{calls++;return new Response('{}');});
 assert.equal(result.state,'retry_wait');assert.equal(calls,0);assert.equal(writes.length,0);
});
test('expired history retry resumes the saved cursor',async()=>{
 process.env.HISTORY_TEST_TOKEN='test-secret';
 try {
 const cursor='https://graph.facebook.com/v26.0/page/conversations?after=saved';
 const {db}=fixture(undefined,true,{state:'retry',updated_at:new Date(Date.now()-61000),next_url:cursor});
 const urls:string[]=[];
 const result=await syncMetaHistoryOnce(db,'workspace','connection',async url=>{urls.push(String(url));return new Response(JSON.stringify({data:[]}));});
 assert.equal(result.state,'complete');assert.deepEqual(urls,[cursor]);
 }finally{delete process.env.HISTORY_TEST_TOKEN;}
});
