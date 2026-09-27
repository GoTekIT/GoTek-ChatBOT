import test from 'node:test';import assert from 'node:assert/strict';import {assertBodyBytes,assertRedirectBudget,DEFAULT_FETCH_POLICY,validateFetchPolicy} from '../src/server/web-source-policy';
test('H11 fetch policy enforces bounded pages/depth/bytes/time/redirects',()=>{assert.deepEqual(validateFetchPolicy({}),DEFAULT_FETCH_POLICY);assert.equal(validateFetchPolicy({maxPages:1,maxDepth:0,maxBytes:1000,timeoutMs:100,maxRedirects:0,delayMs:10}).maxBytes,1000);for(const p of [{maxPages:21},{maxDepth:3},{maxBytes:20_000_001},{timeoutMs:99},{maxRedirects:6},{delayMs:60_001}])assert.throws(()=>validateFetchPolicy(p));assert.throws(()=>assertRedirectBudget(6,DEFAULT_FETCH_POLICY));assert.throws(()=>assertBodyBytes(5_000_001,DEFAULT_FETCH_POLICY));});

test('H11 runtime counters reject malformed counts instead of bypassing limits',()=>{
  for(const value of [-1,-0.5,0.5,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1]){
    assert.throws(()=>assertRedirectBudget(value,DEFAULT_FETCH_POLICY),{status:400,code:'INVALID_REDIRECT_COUNT'},`redirect counter ${value}`);
    assert.throws(()=>assertBodyBytes(value,DEFAULT_FETCH_POLICY),{status:400,code:'INVALID_BODY_BYTES'},`body counter ${value}`);
  }
});

test('H11 runtime counters accept zero and exact limits and reject first excess',()=>{
  for(const policy of [DEFAULT_FETCH_POLICY,validateFetchPolicy({maxRedirects:0,maxBytes:1}),validateFetchPolicy({maxBytes:20_000_000})]){
    for(const count of [0,policy.maxRedirects])assert.doesNotThrow(()=>assertRedirectBudget(count,policy));
    for(const bytes of [0,policy.maxBytes])assert.doesNotThrow(()=>assertBodyBytes(bytes,policy));
    assert.throws(()=>assertRedirectBudget(policy.maxRedirects+1,policy),{status:400,code:'REDIRECT_LIMIT'});
    assert.throws(()=>assertBodyBytes(policy.maxBytes+1,policy),{status:400,code:'RESPONSE_TOO_LARGE'});
  }
});
