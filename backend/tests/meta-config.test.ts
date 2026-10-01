import {test} from 'node:test';
import assert from 'node:assert/strict';
import {metaConfig,metaAuthorizationUrl} from '../src/modules/meta/config';
const env = {
 META_FACEBOOK_APP_ID:'123', META_FACEBOOK_APP_SECRET:'private-secret',
 META_FACEBOOK_REDIRECT_URI:'https://staging.example.test/api/integrations/meta/facebook/callback',
 META_FACEBOOK_LOGIN_CONFIG_ID:'456', META_GRAPH_VERSION:'v25.0',
 META_INSTAGRAM_APP_ID:'789', META_INSTAGRAM_APP_SECRET:'other-private-secret',
 META_INSTAGRAM_REDIRECT_URI:'https://staging.example.test/api/integrations/meta/instagram/callback'
};
test('Meta OAuth uses fixed provider hosts and separates Facebook business config from Instagram scopes',()=>{
 const fb = new URL(metaAuthorizationUrl(metaConfig('facebook',env),'opaque-state'));
 assert.equal(fb.origin,'https://www.facebook.com');
 assert.equal(fb.searchParams.get('config_id'),'456');
 assert.equal(fb.searchParams.get('state'),'opaque-state');
 assert.equal(fb.searchParams.has('scope'),false);
 assert.equal(fb.toString().includes('private-secret'),false);
 const ig = new URL(metaAuthorizationUrl(metaConfig('instagram',env),'other-state'));
 assert.equal(ig.origin,'https://www.instagram.com');
 assert.equal(ig.searchParams.get('client_id'),'789');
 assert.equal(ig.searchParams.get('scope'),'instagram_business_basic,instagram_business_manage_messages');
 assert.equal(ig.searchParams.has('config_id'),false);
});
test('Meta configuration fails closed on absent config, unsafe callbacks and invalid version',()=>{
 assert.throws(()=>metaConfig('facebook',{}),/META_NOT_CONFIGURED/);
 for(const callback of ['http://example.test/callback','https://user:pass@example.test/callback','https://example.test/cb#fragment','https://example.test/cb?next=evil','garbage']) {
  assert.throws(()=>metaConfig('facebook',{...env,META_FACEBOOK_REDIRECT_URI:callback}),/META_NOT_CONFIGURED/);
 }
 assert.throws(()=>metaConfig('facebook',{...env,META_GRAPH_VERSION:'../../evil'}),/META_NOT_CONFIGURED/);
 assert.throws(()=>metaConfig('facebook',{...env,META_FACEBOOK_LOGIN_CONFIG_ID:''}),/META_NOT_CONFIGURED/);
});
