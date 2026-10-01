import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import request from 'supertest';
import {createApp} from '../src/app';

test('canonical installed SDK contains widget contract without provider secrets',()=>{const sdk=readFileSync('public/sdk.js','utf8');for(const token of ['/session','/profile','/messages','/handoff','/receipts','localStorage','autoOpen','Yêu cầu gặp nhân viên','Đang kết nối nhân viên','Nhân viên đang hỗ trợ','Trợ lý AI đang hỗ trợ','replyOwner'])assert.ok(sdk.includes(token),`missing ${token}`);assert.ok(!sdk.includes('generativelanguage.googleapis.com'));assert.ok(!sdk.includes('api.openai.com'));assert.ok(!sdk.includes('x-api-key'));});

test('sdk.js serves with cross-origin CORP and CORS headers', async () => {
  const app = createApp();
  const res = await request(app).get('/sdk.js');
  assert.equal(res.status, 200);
  assert.equal(res.headers['cross-origin-resource-policy'], 'cross-origin');
  assert.equal(res.headers['access-control-allow-origin'], '*');
});
