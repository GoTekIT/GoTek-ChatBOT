import {test} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {createApp} from '../src/app';

test('Meta connector catalogue exposes capability states without credentials', async()=>{
 const response=await request(createApp()).get('/meta/connectors');
 assert.equal(response.status,200);
 assert.deepEqual(response.body.connectors.map((item:any)=>item.surface),['facebook_messenger','instagram_messaging','whatsapp_business','threads']);
 const threads=response.body.connectors.find((item:any)=>item.surface==='threads');
 assert.equal(threads.status,'api_limited');
 assert.equal(threads.inboundWebhook,false);
 assert.equal(threads.outboundMessaging,false);
 assert.equal(JSON.stringify(response.body).includes('TOKEN'),false);
});
