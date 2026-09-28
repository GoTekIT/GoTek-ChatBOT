import {test} from 'node:test';
import assert from 'node:assert/strict';
import {costMicros,estimateTokens,makeTokenMeterEvent,normalizeTokenUsage} from '../src/modules/ai/token-metering';

test('normalizes common provider usage fields and derives a consistent total',()=>{
 const usage=normalizeTokenUsage({prompt_tokens:100,output_tokens:25,total_tokens:120});
 assert.deepEqual(usage,{promptTokens:100,completionTokens:25,totalTokens:125,estimated:false});
});

test('estimates missing usage deterministically and rounds integer micro-cost',()=>{
 const usage=normalizeTokenUsage({},'12345678','1234');
 assert.equal(estimateTokens('12345678'),2); assert.equal(usage.estimated,true);
 assert.equal(costMicros(usage,{promptMicrosPer1k:1000n,completionMicrosPer1k:2000n}),4n);
});

test('meter event is tenant-bound and contains no raw prompt or secret',()=>{
 const event=makeTokenMeterEvent({workspaceId:'w',operationKey:'job-1',provider:'gemini',model:'flash',usage:normalizeTokenUsage({input_tokens:10,output_tokens:5}),rate:{promptMicrosPer1k:100n,completionMicrosPer1k:200n}});
 assert.equal(event.costMicros,2n); assert.equal(Object.hasOwn(event,'prompt'),false); assert.equal(Object.isFrozen(event),true);
});

test('rejects malformed, negative, unsafe and conflicting provider usage',()=>{
 assert.throws(()=>normalizeTokenUsage({prompt_tokens:-1}),/INVALID_TOKEN_USAGE/);
 assert.throws(()=>normalizeTokenUsage({prompt_tokens:'9007199254740992'}),/INVALID_TOKEN_USAGE/);
 assert.throws(()=>normalizeTokenUsage({prompt_tokens:1,promptTokens:2}),/INVALID_TOKEN_USAGE/);
 assert.throws(()=>normalizeTokenUsage([], 'x'),/INVALID_TOKEN_USAGE/);
});

test('rejects unsafe usage and non-integer or negative rates before billing',()=>{
 const valid={promptTokens:1,completionTokens:2,totalTokens:3,estimated:false};
 assert.throws(()=>costMicros({...valid,promptTokens:Number.MAX_SAFE_INTEGER, totalTokens:Number.MAX_SAFE_INTEGER},{promptMicrosPer1k:1n,completionMicrosPer1k:1n}),/INVALID_TOKEN_USAGE/);
 assert.throws(()=>costMicros(valid,{promptMicrosPer1k:-1n,completionMicrosPer1k:1n}),/INVALID_TOKEN_RATE/);
 assert.throws(()=>costMicros(valid,{promptMicrosPer1k:1 as any,completionMicrosPer1k:1n}),/INVALID_TOKEN_RATE/);
});
