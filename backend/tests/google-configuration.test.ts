import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AuthController} from '../src/controllers/auth.controller';

test('Google login fails closed before network call when client ID missing; rejects wrong audience/profile subject',async()=>{
  const old=process.env.GOOGLE_CLIENT_ID,fetcher=globalThis.fetch;
  try {
    delete process.env.GOOGLE_CLIENT_ID;
    globalThis.fetch=async()=>{throw new Error('unexpected provider call');};
    const req={body:{credential:'test-token'}} as any;
    await assert.rejects(AuthController.googleLogin(req,{} as any),/GOOGLE_LOGIN_NOT_CONFIGURED/);
    process.env.GOOGLE_CLIENT_ID='expected-client';
    globalThis.fetch=async()=>new Response(JSON.stringify({sub:'person',email:'fixture@example.test',email_verified:'true',aud:'wrong-client'}));
    await assert.rejects(AuthController.googleLogin(req,{} as any),/INVALID_GOOGLE_CREDENTIAL/);
    let n=0;
    globalThis.fetch=async()=>new Response(JSON.stringify(++n===1?{sub:'person',email:'fixture@example.test',email_verified:'true',aud:'expected-client'}:{sub:'other-person',email:'fixture@example.test'}));
    await assert.rejects(AuthController.googleLogin(req,{} as any),/INVALID_GOOGLE_CREDENTIAL/);
  } finally {globalThis.fetch=fetcher;if(old===undefined)delete process.env.GOOGLE_CLIENT_ID;else process.env.GOOGLE_CLIENT_ID=old;}
});
