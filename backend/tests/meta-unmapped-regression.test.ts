import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {ingestMetaBody} from '../src/modules/meta/messenger';
import {pool} from '../src/core/db';
after(()=>pool.end());
for(const object of ['page','instagram']) test(`${object}: unmapped envelope must not be acknowledged and discarded`,async()=>{
 const db={query:async()=>({rows:[]})} as unknown as PoolClient;
 await assert.rejects(ingestMetaBody(db,{object,entry:[{id:'unmapped',messaging:[{sender:{id:'visitor'},recipient:{id:'unmapped'},message:{mid:'m1',text:'retain me'}}]}]}),{code:'META_ROUTE_UNAVAILABLE'});
});
test('WhatsApp: unmapped message must not be acknowledged and discarded',async()=>{
 const db={query:async()=>({rows:[]})} as unknown as PoolClient;
 await assert.rejects(ingestMetaBody(db,{object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:'unmapped'},messages:[{from:'visitor',id:'m1',type:'text',text:{body:'retain me'}}]}}]}]}),{code:'META_ROUTE_UNAVAILABLE'});
});
