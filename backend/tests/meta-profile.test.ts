import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchMetaProfile} from '../src/modules/meta/profile';
test('Meta profile accepts only returned name and HTTPS avatar, never contact guesses',async()=>{
 process.env.META_PROFILE_TEST_TOKEN='fixture';
 try{
 const fetcher=(async()=>new Response(JSON.stringify({first_name:'Test',last_name:'User',profile_pic:'https://example.test/avatar',email:'not-requested@example.test'}))) as typeof fetch;
 assert.deepEqual(await fetchMetaProfile('123','META_PROFILE_TEST_TOKEN',fetcher),{name:'Test User',avatarUrl:'https://example.test/avatar'});
 const unsafe=(async()=>new Response(JSON.stringify({profile_pic:'javascript:alert(1)'}))) as typeof fetch;
 assert.deepEqual(await fetchMetaProfile('123','META_PROFILE_TEST_TOKEN',unsafe),{});
 const denied=(async()=>new Response('{}',{status:403})) as typeof fetch;
 await assert.rejects(fetchMetaProfile('123','META_PROFILE_TEST_TOKEN',denied),/META_PROFILE_UNAVAILABLE/);
 }finally{delete process.env.META_PROFILE_TEST_TOKEN;}
});
