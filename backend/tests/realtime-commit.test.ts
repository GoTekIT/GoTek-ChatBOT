import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {pool,transaction,afterCommit} from '../src/core/db';
after(()=>pool.end());
test('realtime side effects occur after commit and are discarded after rollback',async()=>{
  const events:string[]=[];
  await transaction(async db=>{
    afterCommit(db,()=>events.push('committed'));
    assert.deepEqual(events,[]);
  });
  assert.deepEqual(events,['committed']);
  await assert.rejects(transaction(async db=>{
    afterCommit(db,()=>events.push('rolled-back'));
    throw new Error('fixture rollback');
  }),/fixture rollback/);
  assert.deepEqual(events,['committed']);
});
