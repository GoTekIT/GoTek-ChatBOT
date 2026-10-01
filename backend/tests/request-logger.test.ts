import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import type {Request,Response} from 'express';
import {requestLogger} from '../src/middlewares/logger.middleware';

test('request logger excludes OAuth codes, states and webhook verification secrets',()=>{
 const previous = console.log;
 const lines:string[]=[];
 console.log=(line:unknown)=>{lines.push(String(line));};
 try {
  for(const originalUrl of [
   '/api/integrations/meta/facebook/callback?code=private-code&state=private-state',
   '/integrations/meta/webhook?hub.verify_token=private-verify&hub.challenge=private-challenge',
   '/api/inbox?search=private-customer-text'
  ]) {
   const res = Object.assign(new EventEmitter(),{statusCode:200,statusMessage:'OK'});
   let nextCalled=false;
   requestLogger({method:'GET',originalUrl,headers:{},socket:{remoteAddress:'127.0.0.1'}} as Request,res as unknown as Response,()=>{nextCalled=true;});
   res.emit('finish');
   assert.ok(nextCalled);
   assert.ok(lines.at(-1)?.includes(originalUrl.split('?')[0]));
   assert.equal(lines.at(-1)?.includes('private-'),false);
  }
 } finally {console.log=previous;}
});
