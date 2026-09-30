import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {resolveModel} from '../src/modules/platform/platform';
import {pool} from '../src/core/db';

const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
after(async()=>{await pool.end();await admin.end();});

test('H28 registry resolution is tenant and lifecycle scoped',async()=>{
 const workspaceA=randomUUID(),workspaceB=randomUUID(),provider=randomUUID(),model=randomUUID();
 try {
  await admin.query('INSERT INTO workspaces(id,name,status) VALUES($1,$2,\'active\'),($3,$4,\'active\')',[workspaceA,'H28 registry A',workspaceB,'H28 registry B']);
  await admin.query("INSERT INTO providers(id,name,adapter,secret_ref,enabled) VALUES($1,$2,'local','H28_LOCAL_UNUSED',true)",[provider,'H28 local registry']);
  await admin.query("INSERT INTO models(id,provider_id,name,capabilities,enabled) VALUES($1,$2,'h28-chat',ARRAY['chat'],true)",[model,provider]);
  await admin.query("INSERT INTO model_grants(id,workspace_id,model_id,capability,active) VALUES($1,$2,$3,'chat',true)",[randomUUID(),workspaceA,model]);

  const granted=await resolveModel(workspaceA,model,'chat');
  assert.deepEqual(granted,{adapter:'local',model:'h28-chat',secret:undefined});
  await assert.rejects(resolveModel(workspaceB,model,'chat'),{code:'MODEL_NOT_GRANTED'});

  await admin.query('UPDATE providers SET enabled=false WHERE id=$1',[provider]);
  await assert.rejects(resolveModel(workspaceA,model,'chat'),{code:'MODEL_NOT_GRANTED'},'provider disable revokes runtime routing');
  await admin.query('UPDATE providers SET enabled=true WHERE id=$1',[provider]);
  await admin.query('UPDATE models SET enabled=false WHERE id=$1',[model]);
  await assert.rejects(resolveModel(workspaceA,model,'chat'),{code:'MODEL_NOT_GRANTED'},'model disable revokes runtime routing');
  await admin.query('UPDATE models SET enabled=true WHERE id=$1',[model]);
  await admin.query('UPDATE model_grants SET active=false WHERE workspace_id=$1 AND model_id=$2',[workspaceA,model]);
  await assert.rejects(resolveModel(workspaceA,model,'chat'),{code:'MODEL_NOT_GRANTED'},'grant revoke revokes runtime routing');
 } finally {
  await admin.query('DELETE FROM model_grants WHERE workspace_id IN ($1,$2)',[workspaceA,workspaceB]);
  await admin.query('DELETE FROM models WHERE id=$1',[model]);
  await admin.query('DELETE FROM providers WHERE id=$1',[provider]);
  await admin.query('DELETE FROM workspaces WHERE id IN ($1,$2)',[workspaceA,workspaceB]);
 }
});
