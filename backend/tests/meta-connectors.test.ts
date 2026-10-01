import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getMetaConnector,META_CONNECTORS} from '../src/modules/meta/connectors';

test('Meta connector catalog keeps supported surfaces explicit and honest',()=>{
 assert.deepEqual(META_CONNECTORS.map(x=>x.surface),['facebook_messenger','instagram_messaging','whatsapp_business','threads']);
 assert.equal(getMetaConnector('facebook_messenger')?.status,'pilot_ready');
 assert.equal(getMetaConnector('instagram_messaging')?.inboundWebhook,true);
 assert.equal(getMetaConnector('whatsapp_business')?.profileFields.includes('phone'),true);
 assert.equal(getMetaConnector('threads')?.outboundMessaging,false);
 assert.equal(getMetaConnector('unknown'),undefined);
});
