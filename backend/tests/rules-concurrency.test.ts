import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {ZodError} from 'zod';
import {updateRule,setRuleState} from '../src/modules/rules/rules';
import {HttpError} from '../src/core/security';
const actor={role:'Owner',workspace_id:'11111111-1111-4111-8111-111111111111',user_id:'22222222-2222-4222-8222-222222222222'};
const id='33333333-3333-4333-8333-333333333333';
const operations=[
 {name:'update',body:{title:'Updated',content:'Content'},invoke:updateRule,versionParam:5},
 {name:'state',body:{active:false},invoke:setRuleState,versionParam:4},
];
for(const op of operations){
 for(const version of [undefined,0,-1,1.5,'1']) test(`H09 ${op.name} rejects invalid expectedVersion ${version}`,async()=>{
  const db={query:async()=>{throw new Error('Invalid input reached DB');}} as unknown as PoolClient;
  await assert.rejects(()=>op.invoke(db,actor,id,{...op.body,expectedVersion:version}),ZodError);
 });
 for(const exists of [true,false]) test(`H09 ${op.name} failed compare-and-swap returns ${exists?'conflict':'not found'} without audit`,async()=>{
  const calls:{sql:string;params:unknown[]}[]=[];
  const db={query:async(sql:string,params:unknown[])=>{calls.push({sql,params});return {rows:calls.length===2?[]:exists?[{id}]:[]};}} as unknown as PoolClient;
  await assert.rejects(()=>op.invoke(db,actor,id,{...op.body,expectedVersion:2}),error=>error instanceof HttpError&&error.status===(exists?409:404)&&error.code===(exists?'VERSION_CONFLICT':'NOT_FOUND'));
  assert.equal(calls.length,3);
  assert.match(calls[1].sql,new RegExp(`AND version=\\$${op.versionParam}`));
  assert.equal(calls[1].params[op.versionParam-1],2);
  assert.match(calls[2].sql,/WHERE id=\$1 AND workspace_id=\$2/);
  assert.deepEqual(calls[2].params,[id,actor.workspace_id]);
 });
 test(`H09 ${op.name} successful compare-and-swap returns new version and audits once`,async()=>{
  const calls:string[]=[];
  const db={query:async(sql:string)=>{calls.push(sql);return {rows:[{id,version:3}]};}} as unknown as PoolClient;
  const result=await op.invoke(db,actor,id,{...op.body,expectedVersion:2});
  assert.equal(result.version,3);assert.equal(calls.length,3);assert.match(calls[2],/^INSERT INTO audit_events/);
 });
}
