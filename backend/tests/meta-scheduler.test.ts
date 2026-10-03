import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {startMetaScheduler} from '../src/workers/meta-scheduler';

test('scheduler advances tenant cursor, never overlaps ingress, and drains on stop',async()=>{
 const cursors:Array<string|null>=[];let running=0,max=0;
 const stop=startMetaScheduler({ingress:async after=>{cursors.push(after);max=Math.max(max,++running);await delay(5);running--;return {next:after===null?'next':null,results:[]};},onError:()=>assert.fail('unexpected failure')},1);
 await delay(35);await stop();const count=cursors.length;await delay(10);
 assert.ok(count>=2);assert.equal(cursors[1],'next');assert.equal(max,1);assert.equal(running,0);assert.equal(cursors.length,count);
});

test('slow history does not hold up ingress and stop waits for history',async()=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let ingress=0,started=false,finished=false;
 const stop=startMetaScheduler({ingress:async()=>({next:null,results:++ingress===1?[{workspace:'one'}]:[]}),history:async()=>{started=true;await gate;finished=true;},onError:()=>assert.fail('unexpected failure')},1);
 await delay(20);assert.ok(started);assert.ok(ingress>1);
 const closing=stop();assert.equal(finished,false);release();await closing;assert.equal(finished,true);
});


test('expired-event cleanup runs before ingress on every pass',async()=>{
 const order:string[]=[];
 const stop=startMetaScheduler({cleanup:async()=>{order.push('cleanup');},ingress:async()=>{order.push('ingress');return {next:null,results:[]};},onError:()=>assert.fail('unexpected failure')},2);
 await delay(12);await stop();
 assert.ok(order.length>=2);
 for(let i=0;i<order.length;i+=2)assert.deepEqual(order.slice(i,i+2),['cleanup','ingress']);
});
