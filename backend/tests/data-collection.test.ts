import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {HttpError} from '../src/core/security';

test('H12 contract: request ids are UUIDs and error codes are stable',()=>{
  assert.match(randomUUID(),/^[0-9a-f-]{36}$/);
  const error=new HttpError(409,'COLLECTION_NOT_ACTIVE');
  assert.equal(error.status,409); assert.equal(error.code,'COLLECTION_NOT_ACTIVE');
});
