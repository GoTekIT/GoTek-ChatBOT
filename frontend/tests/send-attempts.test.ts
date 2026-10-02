import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SendAttempts} from '../src/components/inbox/send-attempts';
test('failed send retains identity across edits and conversations; confirmed send permits intentional repetition',()=>{
 const attempts=new SendAttempts();
 const first=attempts.begin('a','Hello','public');
 assert.notEqual(attempts.begin('b','Hello','public'),first);
 assert.notEqual(attempts.begin('a','Hello','internal'),first);
 assert.notEqual(attempts.begin('a','Edited','public'),first);
 assert.equal(attempts.begin('a','Hello','public'),first);
 attempts.confirmed('a','Hello','public','wrong-id');
 assert.equal(attempts.begin('a','Hello','public'),first);
 attempts.confirmed('a','Hello','public',first);
 assert.notEqual(attempts.begin('a','Hello','public'),first);
});
