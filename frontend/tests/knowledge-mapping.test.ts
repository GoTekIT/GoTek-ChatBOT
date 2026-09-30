import test from 'node:test';
import assert from 'node:assert/strict';
import {mapKnowledge,type KnowledgeRow} from '../src/services/knowledge.service';
test('new knowledge drafts remain drafts even when an older version is public',()=>{
  const row:KnowledgeRow={id:'item',title:'Draft',content:'New content',active:true,revision:4,draft_version_id:'new',published_version_id:'old',audience:'PUBLIC',state:'DRAFT',source_type:'MANUAL',updated_at:'2026-10-01T00:00:00Z'};
  assert.equal(mapKnowledge(row).publicationStatus,'draft');
  assert.equal(mapKnowledge({...row,state:'READY'}).publicationStatus,'ready');
  assert.equal(mapKnowledge({...row,published_version_id:'new',state:'READY'}).publicationStatus,'published');
  assert.equal(mapKnowledge({...row,published_version_id:'new',audience:'INTERNAL',state:'READY'}).publicationStatus,'internal');
});
