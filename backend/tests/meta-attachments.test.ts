import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMetaAttachments} from '../src/modules/meta/attachments';
test('keeps image and video references without dropping signed query parameters',()=>{
 assert.deepEqual(parseMetaAttachments([
  {type:'image',payload:{url:'https://cdn.example.org/photo.jpg?signature=a%2Fb'}},
  {type:'video',payload:{url:'https://cdn.example.org/clip.mp4'}}
 ]),[
  {type:'image',url:'https://cdn.example.org/photo.jpg?signature=a%2Fb'},
  {type:'video',url:'https://cdn.example.org/clip.mp4'}
 ]);
});
test('rejects executable, insecure, credential-bearing, malformed and unsupported references',()=>{
 assert.deepEqual(parseMetaAttachments([null,{},
  {type:'image',payload:{url:'javascript:alert(1)'}},
  {type:'video',payload:{url:'http://cdn.example.org/video'}},
  {type:'image',payload:{url:'https://user:secret@example.org/p'}},
  {type:'image',payload:{url:'not a URL'}},
  {type:'template',payload:{url:'https://example.org'}}
 ]),[]);
 assert.deepEqual(parseMetaAttachments(null),[]);
});
test('bounds processing of a provider attachment array',()=>{
 assert.equal(parseMetaAttachments(Array.from({length:100},()=>({type:'image',payload:{url:'https://example.org/p'}}))).length,20);
});
