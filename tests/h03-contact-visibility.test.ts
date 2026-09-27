import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {pool,scope,transaction} from '../src/server/db';
import {createContact,listContacts,getContact} from '../src/server/contacts';
const admin=new pg.Pool({host:'/tmp',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});
after(async()=>{await pool.end();await admin.end();});

test('H03 contact visibility: Agent cannot read CRM contacts and tenant owner cannot cross workspace',async()=>{
 const w=randomUUID(),otherW=randomUUID(),owner=randomUUID(),agent=randomUUID(),otherOwner=randomUUID(),contact=randomUUID();
 await admin.query('INSERT INTO workspaces(id,name) VALUES($1,$2),($3,$4)',[w,'H03 visibility fixture',otherW,'H03 other fixture']);
 await admin.query('INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,$3,$4,$5),($6,$7,$8,$9,$10),($11,$12,$13,$14,$15)',[owner,owner+'@e.test','Owner','0900000011','disabled',agent,agent+'@e.test','Agent','0900000012','disabled',otherOwner,otherOwner+'@e.test','Other owner','0900000013','disabled']);
 await admin.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'Owner'),($1,$3,'Agent'),($4,$5,'Owner')",[w,owner,agent,otherW,otherOwner]);
 await admin.query('INSERT INTO contacts(id,workspace_id,full_name,created_by) VALUES($1,$2,$3,$4)',[contact,w,'Private CRM contact',owner]);
 const run=<T>(fn:(db:pg.PoolClient)=>Promise<T>,workspace:string)=>transaction(async db=>{await scope(db,workspace);return fn(db);});
 const agentActor={workspace_id:w,user_id:agent,role:'Agent'};
 await assert.rejects(run(db=>listContacts(db,agentActor,{}),w),{code:'FORBIDDEN'});
 await assert.rejects(run(db=>getContact(db,agentActor,contact),w),{code:'FORBIDDEN'});
 const otherActor={workspace_id:otherW,user_id:otherOwner,role:'Owner'};
 await assert.rejects(run(db=>getContact(db,otherActor,contact),otherW),{code:'NOT_FOUND'});
 const ownerActor={workspace_id:w,user_id:owner,role:'Owner'};
 assert.equal((await run(db=>listContacts(db,ownerActor,{}),w)).items.length,1);
 assert.equal((await run(db=>getContact(db,ownerActor,contact),w)).full_name,'Private CRM contact');
 await admin.query('DELETE FROM contacts WHERE id=$1',[contact]);
 await admin.query('DELETE FROM memberships WHERE workspace_id IN ($1,$2)',[w,otherW]);
 await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[owner,agent,otherOwner]]);
 await admin.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[[w,otherW]]);
});
