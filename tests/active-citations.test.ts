import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {pool, transaction, scope} from '../src/server/db';
import {HttpError} from '../src/server/security';
import {
 registerCitationSource, recordCitation, listAccessibleCitations, listCitations,
 grantCitationAccess, revokeCitationAccess, revokeCitationSource, revokeCitation,
} from '../src/server/active-citations';

type Actor={user_id:string;workspace_id:string;role:string};
const run=<T>(actor:Actor,fn:(db:PoolClient)=>Promise<T>)=>transaction(async db=>{
 await scope(db,actor.workspace_id);
 return fn(db);
});
const error=(code:string)=>(e:unknown)=>e instanceof HttpError&&e.code===code;

// Each workspace is inserted under its own RLS scope. These fixtures exercise
// the same application DB role as the service, without disabling tenant policies.
async function fixture(){
 const owner:Actor={user_id:randomUUID(),workspace_id:randomUUID(),role:'Owner'};
 const reader:Actor={user_id:randomUUID(),workspace_id:owner.workspace_id,role:'Agent'};
 await run(owner,async db=>{
  await db.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[owner.workspace_id,'Citation integration']);
  for(const actor of [owner,reader]){
   await db.query('INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,$3,$4,$5)',[actor.user_id,`citation-${actor.user_id}@example.test`,'Citation fixture','0900000000','not-a-login-credential']);
   await db.query('INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,$3)',[actor.workspace_id,actor.user_id,actor.role]);
  }
 });
 return {owner,reader};
}

test('E01 DB: tenant isolation, internal ACL, revocation and mutation roles',async t=>{
 t.after(()=>pool.end());
 const a=await fixture(),b=await fixture(),answerId=randomUUID();
 const input={sourceKey:`knowledge:${randomUUID()}`,sourceType:'KNOWLEDGE',title:'Internal source',version:'1',audience:'INTERNAL'};
 const source=await run(a.owner,db=>registerCitationSource(db,a.owner,input));
 const citation=await run(a.owner,db=>recordCitation(db,a.owner,{answerId,sourceId:source.id,snippet:'Restricted evidence',position:0}));
 assert.equal(citation.answerId,answerId);
 assert.deepEqual(await run(a.reader,db=>listAccessibleCitations(db,a.reader,answerId)),[]);
 assert.deepEqual(await run(b.owner,db=>listAccessibleCitations(db,b.owner,answerId)),[]);
 assert.deepEqual(await run(b.owner,db=>listCitations(db,b.owner)),[]);
 // A valid foreign tenant source ID must not grant access or allow mutation.
 await assert.rejects(run(b.owner,db=>grantCitationAccess(db,b.owner,source.id,b.reader.user_id)),error('NOT_FOUND'));
 await assert.rejects(run(b.owner,db=>revokeCitationSource(db,b.owner,source.id)),error('NOT_FOUND'));
 await assert.rejects(run(b.owner,db=>revokeCitation(db,b.owner,citation.id)),error('NOT_FOUND'));
 await assert.rejects(run(b.owner,db=>recordCitation(db,b.owner,{answerId,sourceId:source.id,snippet:'Cross tenant',position:0})),error('CITATION_SOURCE_UNAVAILABLE'));
 await assert.rejects(run(a.owner,db=>grantCitationAccess(db,a.owner,source.id,b.reader.user_id)),error('NOT_FOUND'));
 await run(a.owner,db=>grantCitationAccess(db,a.owner,source.id,a.reader.user_id));
 const accessible=await run(a.reader,db=>listAccessibleCitations(db,a.reader,answerId));
 assert.equal(accessible.length,1);
 assert.equal(accessible[0].snippet,'Restricted evidence');
 assert.equal(accessible[0].id,citation.id);
 await run(a.owner,db=>revokeCitationAccess(db,a.owner,source.id,a.reader.user_id));
 assert.deepEqual(await run(a.reader,db=>listAccessibleCitations(db,a.reader,answerId)),[]);
 await run(a.owner,db=>grantCitationAccess(db,a.owner,source.id,a.reader.user_id));
 assert.equal((await run(a.reader,db=>listAccessibleCitations(db,a.reader,answerId))).length,1);
 await run(a.owner,db=>revokeCitation(db,a.owner,citation.id));
 assert.deepEqual(await run(a.reader,db=>listAccessibleCitations(db,a.reader,answerId)),[]);
 assert.deepEqual(await run(a.owner,db=>listCitations(db,a.owner)),[]);
 const publicSource=await run(a.owner,db=>registerCitationSource(db,a.owner,{...input,sourceKey:`public:${randomUUID()}`,audience:'PUBLIC'}));
 await run(a.owner,db=>recordCitation(db,a.owner,{answerId,sourceId:publicSource.id,snippet:'Public evidence',position:1}));
 assert.equal((await run(a.reader,db=>listAccessibleCitations(db,a.reader,answerId))).length,1);
 // PUBLIC refers to the source audience, never a cross-workspace bypass.
 assert.deepEqual(await run(b.reader,db=>listAccessibleCitations(db,b.reader,answerId)),[]);
 await run(a.owner,db=>revokeCitationSource(db,a.owner,publicSource.id));
 assert.deepEqual(await run(a.reader,db=>listAccessibleCitations(db,a.reader,answerId)),[]);
 await assert.rejects(run(a.owner,db=>recordCitation(db,a.owner,{answerId,sourceId:publicSource.id,snippet:'Revoked source',position:2})),error('CITATION_SOURCE_UNAVAILABLE'));
 await assert.rejects(run(a.reader,db=>registerCitationSource(db,a.reader,{...input,sourceKey:'forbidden'})),error('FORBIDDEN'));
 await assert.rejects(run(a.reader,db=>recordCitation(db,a.reader,{answerId,sourceId:source.id,snippet:'Forbidden',position:3})),error('FORBIDDEN'));
 await assert.rejects(run(a.reader,db=>grantCitationAccess(db,a.reader,source.id,a.reader.user_id)),error('FORBIDDEN'));
 await assert.rejects(run(a.reader,db=>revokeCitation(db,a.reader,citation.id)),error('FORBIDDEN'));
 const audits=await run(a.owner,db=>db.query('SELECT action FROM audit_events WHERE workspace_id=$1',[a.owner.workspace_id]));
 for(const action of ['citation.source_registered','citation.permission_granted','citation.permission_revoked','citation.revoked','citation.source_revoked']){
  assert.ok(audits.rows.some(row=>row.action===action),`missing audit: ${action}`);
 }
});
