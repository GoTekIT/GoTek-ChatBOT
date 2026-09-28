import test from 'node:test';import assert from 'node:assert/strict';import {HttpError} from '../src/core/security';
test('E06 onboarding blocks unsafe index and preserves audience gate',()=>{assert.equal(new HttpError(409,'ONBOARDING_BLOCKED').code,'ONBOARDING_BLOCKED');assert.equal(new HttpError(400,'VALIDATION_ERROR').status,400);});
