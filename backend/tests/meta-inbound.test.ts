import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMetaInbound,normalizeMetaStatuses} from '../src/modules/meta/inbound';
const messaging={sender:{id:'user'},recipient:{id:'account'},message:{mid:'message',text:' hello '}};
test('routes page and Instagram messages without accepting echoes or wrong recipient',()=>{
 for(const [object,surface] of [['page','facebook_messenger'],['instagram','instagram_messaging']]){
 const result=normalizeMetaInbound({object,entry:[{id:'account',messaging:[messaging,{...messaging,recipient:{id:'other'}},{...messaging,message:{...messaging.message,is_echo:true}}]}]});
 assert.equal(result.length,1);assert.equal(result[0].surface,surface);assert.equal(result[0].text,'hello');
 }
});
test('WhatsApp routes by phone number and preserves media IDs rather than invented URLs',()=>{
 const result=normalizeMetaInbound({object:'whatsapp_business_account',entry:[{id:'business',changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:'phone'},messages:[{id:'m',from:'user',type:'video',video:{id:'media',caption:'clip'}},{id:'t',from:'user',type:'text',text:{body:'Hi'}}]}}]}]});
 assert.equal(result.length,2);assert.equal(result[0].externalAccountId,'phone');assert.deepEqual(result[0].mediaReferences,[{type:'video',id:'media'}]);assert.deepEqual(result[0].attachments,[]);assert.equal(result[1].text,'Hi');
});
test('unknown products, status callbacks and malformed arrays cannot become messages',()=>{
 for(const value of [null,{}, {object:'threads',entry:[{id:'account',messaging:[messaging]}]}, {object:'page',entry:[{id:'account',messaging:{}}]}, {object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{statuses:[{id:'m'}]}}]}]}])assert.deepEqual(normalizeMetaInbound(value),[]);
});

test('WhatsApp profile name belongs only to an unambiguous matching sender',()=>{
 const normalize=(contacts:unknown[])=>normalizeMetaInbound({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:'123'},contacts,messages:[{from:'sender',id:'mid',type:'text',text:{body:'Hi'}}]}}]}]})[0];
 assert.equal(normalize([{wa_id:'other',profile:{name:'Wrong'}},{wa_id:'sender',profile:{name:' Nguyễn An '}}]).displayName,'Nguyễn An');
 assert.equal(normalize([{wa_id:'other',profile:{name:'Wrong'}}]).displayName,undefined);
 assert.equal(normalize([{wa_id:'sender',profile:{name:'A'}},{wa_id:'sender',profile:{name:'B'}}]).displayName,undefined);
 assert.equal(normalize([{wa_id:'sender',profile:{name:42}}]).displayName,undefined);
});

test('WhatsApp status callbacks normalize into receipt events',()=>{
 const statuses=normalizeMetaStatuses({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:'1386169614577563'},statuses:[{id:'wamid.1',status:'delivered',recipient_id:'84935846075'},{id:'wamid.2',status:'failed',recipient_id:'84935846075',errors:[{title:'Undeliverable'}]}]}}]}]});
 assert.deepEqual(statuses.map(({eventId,status,error})=>({eventId,status,error})),[{eventId:'wamid.1',status:'delivered',error:undefined},{eventId:'wamid.2',status:'failed',error:'Undeliverable'}]);
});
