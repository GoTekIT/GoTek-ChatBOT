import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMetaPilotRoutes,resolveMetaPilotRoute} from '../src/modules/meta/routing';
const base={surface:'instagram_messaging',externalAccountId:'123',workspaceId:'00000000-0000-4000-8000-000000000001',connectionId:'00000000-0000-4000-8000-000000000002'};
test('routing keys include platform; unknown account cannot select a tenant',()=>{
 const routes=parseMetaPilotRoutes(JSON.stringify([base,{...base,surface:'whatsapp_business',workspaceId:'00000000-0000-4000-8000-000000000003'}]));
 assert.equal(resolveMetaPilotRoute(routes,'instagram_messaging','123')?.workspaceId,base.workspaceId);
 assert.equal(resolveMetaPilotRoute(routes,'facebook_messenger','123'),undefined);
 assert.equal(resolveMetaPilotRoute(routes,'instagram_messaging','other'),undefined);
});
test('invalid or ambiguous operator routes fail closed without leaking configuration',()=>{
 for(const config of ['secret value',JSON.stringify([base,base]),JSON.stringify([{...base,surface:'threads'}]),JSON.stringify([{...base,workspaceId:'bad'}])])assert.throws(()=>parseMetaPilotRoutes(config),{code:'META_ROUTING_INVALID'});
 assert.deepEqual(parseMetaPilotRoutes(undefined),[]);
});
