import test from 'node:test';
import assert from 'node:assert/strict';
import {csvCell,parseCsv} from '../src/web/rules-csv';
test('H09 CSV roundtrip preserves Vietnamese, quotes, comma and embedded line endings',()=>{
 const rules=[{title:'Xin chào, "bạn"',content:'Dòng một\r\nDòng hai\nTiếp tục',active:false}];
 const csv='\uFEFFtitle,content,active\r\n'+rules.map(r=>[csvCell(r.title),csvCell(r.content),String(r.active)].join(',')).join('\r\n')+'\r\n';
 assert.deepEqual(parseCsv(csv),rules);
});
test('H09 CSV rejects malformed quotes, extra columns and ambiguous active values',()=>{
 for(const row of ['x,y,yes','x,y,','x,y,true,extra','"unclosed,y,true','"x"suffix,y,true','x"y,z,true'])assert.throws(()=>parseCsv('title,content,active\n'+row));
 assert.throws(()=>parseCsv('title,content,active\n'));
});
