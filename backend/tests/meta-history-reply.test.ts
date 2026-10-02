import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {recordMetaHistoryReply} from '../src/modules/meta/history-reply';
import type {NormalizedMetaInbound} from '../src/modules/meta/inbound';
const event:NormalizedMetaInbound={surface:'facebook_messenger',externalAccountId:'page',senderId:'customer',eventId:'mid',text:'Page reply',attachments:[],mediaReferences:[],createdAt:'2026-09-01T01:02:03Z'};
function fixture(existing=false){
 const writes:Array<{sql:string;args:any[]}>=[];
 const db={query:async(sql:string,args:any[])=>{
 if(sql.startsWith('SELECT next_sequence')){assert.deepEqual(args,['conversation','workspace','connection']);return {rows:[{next_sequence:5}]};}
 if(sql.startsWith('SELECT m.*'))return {rows:existing?[{id:'already-sent'}]:[]};
 writes.push({sql,args});return {rows:[{id:'imported'}]};
 }} as unknown as PoolClient;return {db,writes};
}
test('historical Page reply preserves timestamp and never queues sending or changes owner',async()=>{
 const {db,writes}=fixture();await recordMetaHistoryReply(db,'workspace','connection','conversation','client',event);
 const message=writes.find(w=>w.sql.startsWith('INSERT INTO messages'))!;
 assert.equal(message.args[6].toISOString(),'2026-09-01T01:02:03.000Z');
 assert.match(message.sql,/'agent',NULL,'public'/);
 assert.ok(writes.some(w=>w.sql.startsWith('INSERT INTO meta_message_deliveries')&&w.args[4]==='connection'));
 assert.ok(writes.every(w=>!/jobs|reply_owner|assigned_to|owner_version/.test(w.sql)));
});
test('historical Page reply already sent by GoTek is not duplicated',async()=>{
 const {db,writes}=fixture(true);const result=await recordMetaHistoryReply(db,'workspace','connection','conversation','client',event);
 assert.equal(result.id,'already-sent');assert.equal(writes.length,0);
});
test('history reply cannot target a conversation outside its connection',async()=>{
 const db={query:async()=>({rows:[]})} as unknown as PoolClient;
 await assert.rejects(recordMetaHistoryReply(db,'workspace','connection','conversation','client',event),/NOT_FOUND/);
});
