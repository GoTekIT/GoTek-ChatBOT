import test from 'node:test';
import assert from 'node:assert/strict';
import {can, canOpenModule, canManageMember} from '../src/services/authorization';

test('workspace UI fails closed and platform status cannot grant tenant management', () => {
  assert.equal(canOpenModule(null, 'inbox'), false);
  assert.equal(canOpenModule({role:'Admin'}, 'settings'), false);
  const agent = {role:'Agent', permissions:['workspace.read','inbox.use'], platformAdmin:true};
  assert.equal(canOpenModule(agent, 'inbox'), true);
  for (const module of ['settings','knowledge','analytics','channels','widget-demo'] as const)
    assert.equal(canOpenModule(agent,module),false);
  assert.equal(can({role:'unknown', permissions:['members.manage']},'members.manage'),false);
});

test('only Owner can edit owners; UI protects last active Owner', () => {
  const admin={role:'Admin',permissions:['members.manage']};
  const owner={role:'Owner',permissions:['members.manage','ownership.manage']};
  assert.equal(canManageMember(admin,{role:'Agent',active:true},1),true);
  assert.equal(canManageMember(admin,{role:'Owner',active:false},2),false);
  assert.equal(canManageMember(owner,{role:'Owner',active:true},1),false);
  assert.equal(canManageMember(owner,{role:'Owner',active:true},2),true);
  assert.equal(canManageMember(owner,{role:'Owner',active:false},1),true);
});
