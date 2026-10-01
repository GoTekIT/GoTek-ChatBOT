import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMetaAuthorizationUrl} from '../src/services/meta.service';
const query='?client_id=123&response_type=code&state='+'a'.repeat(64);
test('OAuth navigation accepts only the correct provider HTTPS endpoint',()=>{
 assert.equal(validateMetaAuthorizationUrl('https://www.facebook.com/v25.0/dialog/oauth'+query,'facebook'),'https://www.facebook.com/v25.0/dialog/oauth'+query);
 assert.equal(validateMetaAuthorizationUrl('https://www.instagram.com/oauth/authorize'+query,'instagram'),'https://www.instagram.com/oauth/authorize'+query);
 for(const url of ['https://www.facebook.com.attacker.test/v25.0/dialog/oauth','http://www.facebook.com/v25.0/dialog/oauth','https://name:pass@www.facebook.com/v25.0/dialog/oauth','https://www.facebook.com:444/v25.0/dialog/oauth','https://www.facebook.com/login','javascript:alert(1)'])
  assert.throws(()=>validateMetaAuthorizationUrl(url+query,'facebook'));
 assert.throws(()=>validateMetaAuthorizationUrl('https://www.instagram.com/oauth/authorize'+query,'facebook'));
 assert.throws(()=>validateMetaAuthorizationUrl('https://www.facebook.com/v25.0/dialog/oauth?client_id=123','facebook'));
});
