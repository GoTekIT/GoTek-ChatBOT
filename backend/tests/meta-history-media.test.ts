import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMetaAttachments,parseMetaHistoryAttachments} from '../src/modules/meta/attachments';

test('history Graph attachment payload maps safe HTTPS media and rejects unsafe URLs',()=>{
 const result=parseMetaAttachments([
  {type:'image',payload:{url:'https://cdn.example.test/image.jpg'}},
  {type:'video',payload:{url:'http://insecure.example.test/video.mp4'}},
  {type:'file',payload:{url:'https://cdn.example.test/doc.pdf?x=1'}}
 ]);
 assert.deepEqual(result,[
  {type:'image',url:'https://cdn.example.test/image.jpg'},
  {type:'file',url:'https://cdn.example.test/doc.pdf?x=1'}
 ]);
});


test('Graph history reads image/video/file shapes and preserves video over thumbnail',()=>{
 assert.deepEqual(parseMetaHistoryAttachments({data:[
  {image_data:{url:'https://cdn.example.test/photo.jpg'}},
  {video_data:{url:'https://cdn.example.test/movie.mp4'},image_data:{url:'https://cdn.example.test/thumbnail.jpg'}},
  {file_url:'https://cdn.example.test/doc.pdf'},
  {video_data:{preview_url:'https://cdn.example.test/preview.jpg'}},
  {image_data:{url:'javascript:alert(1)'}},
  {file_url:'https://user:password@cdn.example.test/private'}
 ]}),[
  {type:'image',url:'https://cdn.example.test/photo.jpg'},
  {type:'video',url:'https://cdn.example.test/movie.mp4'},
  {type:'file',url:'https://cdn.example.test/doc.pdf'}
 ]);
});
