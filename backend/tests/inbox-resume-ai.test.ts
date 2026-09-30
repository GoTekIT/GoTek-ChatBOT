import test from 'node:test';
import assert from 'node:assert/strict';
import {pool,transaction} from '../src/core/db';
import {inboxResumeAi} from '../src/modules/chat/inbox';
const id='11111111-1111-4111-8111-111111111111';
test('explicit resume checks ownership/version and audits only successful transitions',async(t)=>{
 for(const scenario of [
  {role:'Agent',assigned:'actor',version:3,owner:'HUMAN_ACTIVE',error:null},
  {role:'Owner',assigned:'other',version:3,owner:'HANDOFF_PENDING',error:null},
  {role:'Agent',assigned:'other',version:3,owner:'HUMAN_ACTIVE',error:'FORBIDDEN'},
  {role:'Owner',assigned:'actor',version:2,owner:'HUMAN_ACTIVE',error:'STALE_REPLY_OWNER'},
  {role:'Owner',assigned:null,version:3,owner:'AI_ACTIVE',error:'INVALID_STATE'},
 ]){
  let writes=0,audits=0;
  const db:any={release(){},query:async(sql:string)=>{
   if(sql.startsWith('SELECT * FROM conversations'))return {rows:[{channel_id:id}]};
   if(sql.startsWith('SELECT reply_owner'))return {rows:[{reply_owner:scenario.owner,owner_version:3,assigned_to:scenario.assigned}]};
   if(sql.startsWith('UPDATE conversations')){writes++;return {rows:[{id,reply_owner:'AI_ACTIVE',owner_version:4,assigned_to:null}]};}
   if(sql.startsWith('INSERT INTO audit'))audits++;
   return {rows:[{}],rowCount:1};
  }};
  const connection=t.mock.method(pool,'connect',async()=>db);
  const run=()=>transaction(client=>inboxResumeAi(client,{workspace_id:id,user_id:'actor',role:scenario.role},id,{version:scenario.version}));
  if(scenario.error){await assert.rejects(run(),{code:scenario.error});assert.equal(writes,0);assert.equal(audits,0);}
  else {assert.equal((await run()).owner_version,4);assert.equal(writes,1);assert.equal(audits,1);}
  connection.mock.restore();
 }
});
