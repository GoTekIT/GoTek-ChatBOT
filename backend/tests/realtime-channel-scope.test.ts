import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import type {WebSocket} from 'ws';
import {realtimeHub} from '../src/modules/chat/realtime';

test('workspace channel refresh excludes visitors, foreign tenants and unassigned agents',()=>{
 const cases=[
  {id:'owner',workspace:'a',role:'Owner',channels:undefined,visitor:false,allowed:true},
  {id:'member',workspace:'a',role:'Agent',channels:['page'],visitor:false,allowed:true},
  {id:'other-channel',workspace:'a',role:'Agent',channels:['other'],visitor:false,allowed:false},
  {id:'missing-membership',workspace:'a',role:'Agent',channels:undefined,visitor:false,allowed:false},
  {id:'visitor',workspace:'a',role:undefined,channels:undefined,visitor:true,allowed:false},
  {id:'foreign',workspace:'b',role:'Owner',channels:undefined,visitor:false,allowed:false},
 ];
 const messages=new Map<string,string[]>();
 try {
  for(const c of cases){
   const output:string[]=[];messages.set(c.id,output);
   const ws=Object.assign(new EventEmitter(),{readyState:1,send:(value:string)=>output.push(value),close:()=>{},ping:()=>{}});
   realtimeHub.registerWs(c.id,c.workspace,ws as unknown as WebSocket,undefined,c.visitor,c.id,c.role,c.channels);
   output.length=0;
  }
  realtimeHub.broadcastToWorkspace('a','inbox:refresh',{connectionId:'source'},{channelId:'page'});
  for(const c of cases)assert.equal(messages.get(c.id)!.length,c.allowed?1:0,c.id);
 }finally{for(const c of cases)realtimeHub.removeClient(c.id);}
});
