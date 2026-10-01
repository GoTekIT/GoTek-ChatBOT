import test from 'node:test';
import assert from 'node:assert/strict';
import {metaCallbackError} from '../src/services/meta-errors';
test('callback displays bounded known errors, not arbitrary provider or URL text',()=>{
 assert.match(metaCallbackError('META_AUTHORIZATION_DENIED'),/từ chối/);
 assert.equal(metaCallbackError('private-token-in-url'),metaCallbackError('META_CONNECT_FAILED'));
});
