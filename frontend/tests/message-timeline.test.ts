import test from 'node:test';
import assert from 'node:assert/strict';
import {chronologicalMessages} from '../src/utils/message-timeline';
test('backfilled customer and Page history renders by provider time without mutating cursors',()=>{
 const rows=[{sequence:1,timestampIso:'2026-10-02T10:00:00Z'},{sequence:3,timestampIso:'2026-10-01T10:00:00Z'},{sequence:2,timestampIso:'2026-10-01T10:00:00Z'}];
 assert.deepEqual(chronologicalMessages(rows).map(r=>r.sequence),[2,3,1]);
 assert.deepEqual(rows.map(r=>r.sequence),[1,3,2]);
});
test('pending messages without provider time stay after persisted messages',()=>{
 const rows=[{sequence:2,timestampIso:undefined},{sequence:1,timestampIso:'2026-10-02T10:00:00Z'}];
 assert.deepEqual(chronologicalMessages(rows).map(r=>r.sequence),[1,2]);
});
