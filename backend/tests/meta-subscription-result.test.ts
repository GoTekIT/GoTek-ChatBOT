import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {subscribeMetaWebhook} from '../src/modules/meta/connections';

test('subscription persists only an explicit provider success',async()=>{
 const id='00000000-0000-4000-8000-000000000001';
 const actor={workspace_id:id,user_id:id,role:'Owner'};
 const ref='META_SUBSCRIPTION_RESULT_TEST';
 const previous=process.env[ref];process.env[ref]='fixture-only';
 const originalFetch=globalThis.fetch;
 try {
  for(const response of [new Response('{"success":false}'),new Response('{}'),new Response('invalid'),new Response('{"success":true}',{status:400}),new Response('{"success":true}')]){
   const succeeds=response.ok && (await response.clone().text())==='{"success":true}';
   let mutations=0;
   const db={query:async(sql:string)=>{
    if(sql.startsWith('SELECT id,channel_kind'))return {rows:[{id,channel_kind:'facebook_messenger',external_page_id:'123',page_access_token_ref:ref,status:'connected'}]};
    mutations++;return {rows:[]};
   }} as unknown as PoolClient;
   globalThis.fetch=async()=>response;
   if(succeeds){await subscribeMetaWebhook(db,actor,id);assert.ok(mutations>0);}
   else {await assert.rejects(subscribeMetaWebhook(db,actor,id),{code:'META_WEBHOOK_SUBSCRIPTION_FAILED'});assert.equal(mutations,0);}
  }
 }finally {globalThis.fetch=originalFetch;if(previous===undefined)delete process.env[ref];else process.env[ref]=previous;}
});
