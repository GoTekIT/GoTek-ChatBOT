import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveMetaMedia} from '../src/modules/meta/media';
test('media metadata rejects unusable URLs and does not follow redirects with credentials',async()=>{
 process.env.META_MEDIA_VALIDATION_FIXTURE='fixture-only';
 try{
  for(const url of ['https://','https://user:password@example.test/file','http://example.test/file','javascript:alert(1)','https://example.test/'+ 'x'.repeat(8192)]){
   const result=await resolveMetaMedia({mediaId:'123',tokenRef:'META_MEDIA_VALIDATION_FIXTURE',fetchImpl:async(_url,init)=>{
    assert.equal(init?.redirect,'error');return Response.json({url});
   }});
   assert.equal(result.status,'unknown');assert.equal(result.url,undefined);
  }
  const valid=await resolveMetaMedia({mediaId:'123',tokenRef:'META_MEDIA_VALIDATION_FIXTURE',fetchImpl:async()=>Response.json({url:'https://example.test/media?signature=a%2Fb&expires=1',mime_type:'video/mp4'})});
  assert.equal(valid.url,'https://example.test/media?signature=a%2Fb&expires=1');
 }finally{delete process.env.META_MEDIA_VALIDATION_FIXTURE;}
});
