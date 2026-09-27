import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

// Real HTTP check using a disposable local-only business; no external delivery.
const origin='http://127.0.0.1:4317';
const email=`smoke-${randomUUID()}@example.test`;
const password=randomUUID()+randomUUID();
async function call(path:string,body?:unknown,cookie?:string){
 return fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'X-Gotek-Request':'1',...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
}
const health=await call('/api/health');
assert.equal(health.status,200);
assert.deepEqual(await health.json(),{status:'ok',environment:'local-test',externalDelivery:false});
const signup=await call('/api/auth/signup',{email,password,fullName:'Local HTTP tester',business:'Disposable local smoke business',phone:'0900000000'});
assert.equal(signup.status,202);
const login=await call('/api/auth/login',{email,password});
assert.equal(login.status,200);
const setCookie=login.headers.get('set-cookie');assert.ok(setCookie);
assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=Lax/i);
const cookie=setCookie.split(';')[0];
try {
 const me=await call('/api/me',undefined,cookie);assert.equal(me.status,200);
 const identity=await me.json();assert.equal(identity.user.email,email);assert.equal(identity.role,'Owner');assert.equal(identity.platformAdmin,false);
 assert.equal((await call('/api/platform/registry',undefined,cookie)).status,403);
 assert.equal((await call('/api/platform/providers',{name:'Forbidden provider'},cookie)).status,403);
 assert.equal((await call('/api/auth/login',{email,password:'wrong-password'})).status,401);
} finally {
 assert.equal((await call('/api/auth/logout',{},cookie)).status,200);
}
assert.equal((await call('/api/me',undefined,cookie)).status,401);
console.log('PASS: real HTTP signup, login, session cookie, Owner identity, Platform Admin denial, invalid password, logout and session revocation. Disposable local business retained; no credentials logged.');
