import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/app';
import {pool} from '../src/core/db';
test.after(()=>pool.end());
test('H13 contacts persist without email/phone, replay, paginate and isolate workspace',async()=>{
 const app=createApp();
 async function owner(){const a=request.agent(app),email=`contacts-${randomUUID()}@example.test`,password='Local-contact-test-2026';await a.post('/api/auth/signup').set('X-Gotek-Request','1').send({email,password,fullName:'Contact tester',business:'Contacts fixture',phone:'0900000000'}).expect(202);await a.post('/api/auth/login').set('X-Gotek-Request','1').send({email,password}).expect(200);return a;}
 const a=await owner(),b=await owner();const body={requestId:randomUUID(),fullName:'Nguyễn Văn An',country:'Việt Nam',city:'Hà Nội',bio:'Khách hàng thử nghiệm',company:'GoTek'};
 const send=()=>a.post('/api/contacts').set('X-Gotek-Request','1').send(body).expect(200);
 const [one,replay]=await Promise.all([send(),send()]);assert.equal(one.body.id,replay.body.id);assert.equal(one.body.email,null);assert.equal(one.body.phone,null);assert.equal(one.body.city,body.city);assert.equal(one.body.company,body.company);
 assert.equal((await a.get(`/api/contacts/${one.body.id}`).expect(200)).body.full_name,body.fullName);
 await b.get(`/api/contacts/${one.body.id}`).expect(404);
 await request(app).get(`/api/contacts/${one.body.id}`).expect(401);
 await a.get('/api/contacts/invalid').expect(400);
 const edit=await a.put(`/api/contacts/${one.body.id}`).set('X-Gotek-Request','1').send({...body,requestId:randomUUID(),fullName:'Đã cập nhật',expectedRevision:1}).expect(200);assert.equal(edit.body.full_name,'Đã cập nhật');await a.put(`/api/contacts/${one.body.id}`).set('X-Gotek-Request','1').send({...body,requestId:randomUUID(),expectedRevision:1}).expect(409);await b.put(`/api/contacts/${one.body.id}`).set('X-Gotek-Request','1').send({...body,requestId:randomUUID(),expectedRevision:2}).expect(404);
 await a.post('/api/contacts').set('X-Gotek-Request','1').send({...body,fullName:'Khác'}).expect(409);
 const two=await a.post('/api/contacts').set('X-Gotek-Request','1').send({...body,requestId:randomUUID()}).expect(200);assert.notEqual(two.body.id,one.body.id);
 const tagBody={requestId:randomUUID(),tags:[{name:'VIP',color:'#112233'}]};const saveTags=()=>a.put(`/api/contacts/${one.body.id}/tags`).set('X-Gotek-Request','1').send(tagBody).expect(200);const [tags,tagReplay]=await Promise.all([saveTags(),saveTags()]);assert.deepEqual(tags.body,tagReplay.body);await a.put(`/api/contacts/${one.body.id}/tags`).set('X-Gotek-Request','1').send({...tagBody,tags:[]}).expect(409);await a.put(`/api/contacts/${one.body.id}/tags`).set('X-Gotek-Request','1').send({requestId:randomUUID(),tags:[{name:'VIP'},{name:'VIP'}]}).expect(400);assert.equal((await a.get('/api/audit').expect(200)).body.filter((x:any)=>x.action==='contact.tags_updated').length,1);assert.equal(tags.body[0].name,'VIP');assert.equal((await a.get(`/api/contacts/${one.body.id}`).expect(200)).body.tags[0].name,'VIP');const exp=(await a.get('/api/contacts/export').query({tag:'VIP'}).expect(200)).body;assert.deepEqual(exp.items.map((x:any)=>x.id),[one.body.id]);assert.equal((await b.get('/api/contacts/export').query({tag:'VIP'}).expect(200)).body.count,0);assert.equal((await a.get('/api/contacts/export').query({tag:'missing'}).expect(200)).body.count,0);assert.equal((await a.get('/api/audit').expect(200)).body.filter((x:any)=>x.action==='contact.exported').length,2);assert.equal((await a.get('/api/contact-tags').expect(200)).body[0].name,'VIP');assert.equal((await b.get('/api/contact-tags').expect(200)).body.length,0);assert.equal((await a.get('/api/contacts').query({tag:'VIP'}).expect(200)).body.items.length,1);await b.put(`/api/contacts/${one.body.id}/tags`).set('X-Gotek-Request','1').send({requestId:randomUUID(),tags:[]}).expect(404);const listed=(await a.get('/api/contacts').expect(200)).body.items;assert.deepEqual(listed.find((x:any)=>x.id===one.body.id).tags,tags.body);assert.deepEqual(listed.find((x:any)=>x.id===two.body.id).tags,[]);const first=(await a.get('/api/contacts?limit=1').expect(200)).body;assert.equal(first.items.length,1);assert.ok(first.nextCursor);
 const second=(await a.get('/api/contacts').query({limit:1,cursor:first.nextCursor}).expect(200)).body;assert.equal(second.items.length,1);assert.notEqual(first.items[0].id,second.items[0].id);assert.equal(second.nextCursor,null);
 assert.equal((await b.get('/api/contacts').expect(200)).body.items.length,0);assert.equal((await a.get('/api/contacts').query({search:'Hà Nội'}).expect(200)).body.items.length,2);assert.equal((await a.get('/api/contacts').query({search:'GoTek'}).expect(200)).body.items.length,2);assert.equal((await a.get('/api/contacts').query({search:'thử nghiệm'}).expect(200)).body.items.length,2);
 await b.get('/api/contacts').query({cursor:one.body.id}).expect(400);
 await request(app).get('/api/contacts').expect(401);await a.post('/api/contacts').set('X-Gotek-Request','1').send({...body,requestId:randomUUID(),notes:'x'.repeat(201)}).expect(400);
 await b.get('/api/contacts/merge/preview').query({primaryId:one.body.id,secondaryId:two.body.id}).expect(404);const preview=await a.get('/api/contacts/merge/preview').query({primaryId:one.body.id,secondaryId:two.body.id}).expect(200);assert.equal(preview.body.fields.company.selected,'GoTek'); const mergeRequest=randomUUID();const merged=await a.post('/api/contacts/merge').set('X-Gotek-Request','1').send({requestId:mergeRequest,primaryId:one.body.id,secondaryId:two.body.id,primaryRevision:2,secondaryRevision:two.body.revision}).expect(200);assert.equal(merged.body.state,'MERGED');await a.get('/api/contacts').query({cursor:two.body.id}).expect(400);assert.equal((await a.get(`/api/contacts/${two.body.id}`).expect(404)).status,404);assert.equal((await a.get('/api/contacts').expect(200)).body.items.length,1);const undone=await a.post('/api/contacts/merge/undo').set('X-Gotek-Request','1').send({requestId:randomUUID(),mergeRequestId:mergeRequest}).expect(200);assert.equal(undone.body.state,'MERGE_UNDONE');assert.equal((await a.get('/api/contacts').expect(200)).body.items.length,2);await a.post('/api/contacts/merge/undo').set('X-Gotek-Request','1').send({requestId:randomUUID(),mergeRequestId:mergeRequest}).expect(404);assert.equal((await a.get('/api/audit').expect(200)).body.filter((x:any)=>x.action==='contact.created').length,2);
 const before=(await a.get(`/api/contacts/${one.body.id}`).expect(200)).body;
 const other=(await a.get(`/api/contacts/${two.body.id}`).expect(200)).body;
 const nextMerge=randomUUID();
 await a.post('/api/contacts/merge').set('X-Gotek-Request','1').send({requestId:nextMerge,primaryId:before.id,secondaryId:other.id,primaryRevision:before.revision,secondaryRevision:other.revision}).expect(200);
 await a.put(`/api/contacts/${before.id}`).set('X-Gotek-Request','1').send({...body,requestId:randomUUID(),fullName:'Sửa sau gộp',expectedRevision:before.revision+1}).expect(200);
 await a.post('/api/contacts/merge/undo').set('X-Gotek-Request','1').send({requestId:randomUUID(),mergeRequestId:nextMerge}).expect(409);
 assert.equal((await a.get(`/api/contacts/${before.id}`).expect(200)).body.full_name,'Sửa sau gộp');
 await a.get(`/api/contacts/${other.id}`).expect(404);

 const sharedRequest=randomUUID();
 const collisions=await Promise.all([
  a.post('/api/contacts').set('X-Gotek-Request','1').send({...body,requestId:sharedRequest}),
  a.put(`/api/contacts/${before.id}/tags`).set('X-Gotek-Request','1').send({requestId:sharedRequest,tags:[]})
 ]);
 assert.deepEqual(collisions.map(r=>r.status).sort(),[200,409]);
 assert.equal(collisions.find(r=>r.status===409)!.body.error,'IDEMPOTENCY_CONFLICT');

});
