import test from 'node:test';
import assert from 'node:assert/strict';
import {assertMetaWorkerRole} from '../src/modules/meta/worker-role';
const db=(row:unknown)=>({query:async()=>({rows:row?[row]:[]})}) as never;
const valid={login:'gotek_meta_worker',effective:'gotek_meta_worker',rolsuper:false,rolbypassrls:false};
test('dedicated nonprivileged worker login is accepted',async()=>{
 await assertMetaWorkerRole(db(valid));
});
test('app role, impersonation, superuser and RLS bypass fail closed',async()=>{
 for(const row of [null,{...valid,login:'gotek_app'},{...valid,effective:'gotek_app'},{...valid,rolsuper:true},{...valid,rolbypassrls:true}]){
  await assert.rejects(assertMetaWorkerRole(db(row)),{code:'META_WORKER_ROLE_INVALID'});
 }
});
