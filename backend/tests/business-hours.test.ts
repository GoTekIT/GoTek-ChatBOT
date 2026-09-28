import {test} from 'node:test';import assert from 'node:assert/strict';
import {isWithinBusinessHours,type BusinessHours} from '../src/modules/chat/business-hours';
const schedule=(day:number,start:string,end:string,timezone='Asia/Ho_Chi_Minh'):BusinessHours=>({enabled:true,timezone,days:[{day,enabled:true,fullDay:false,start,end}]});
const at=(h:BusinessHours,t:string)=>isWithinBusinessHours(h,new Date(t));
test('H06 local start inclusive, end exclusive, disabled day and full-day',()=>{
 const h=schedule(1,'09:00','17:00');
 assert.equal(at(h,'2026-09-21T01:59:59Z'),false);assert.equal(at(h,'2026-09-21T02:00:00Z'),true);
 assert.equal(at(h,'2026-09-21T09:59:59Z'),true);assert.equal(at(h,'2026-09-21T10:00:00Z'),false);
 assert.equal(at(h,'2026-09-22T02:00:00Z'),false);h.days[0].fullDay=true;assert.equal(at(h,'2026-09-20T17:00:00Z'),true);
 h.days[0].enabled=false;assert.equal(at(h,'2026-09-21T02:00:00Z'),false);h.enabled=false;assert.equal(at(h,'2026-09-21T02:00:00Z'),true);
});
test('H06 overnight carries from starting weekday, including week rollover',()=>{
 const h=schedule(6,'22:00','06:00');assert.equal(at(h,'2026-09-26T15:00:00Z'),true);
 assert.equal(at(h,'2026-09-26T22:59:59Z'),true);assert.equal(at(h,'2026-09-26T23:00:00Z'),false);
 assert.equal(at(h,'2026-09-26T14:59:59Z'),false);assert.equal(at(schedule(6,'09:00','09:00'),'2026-09-26T02:00:00Z'),false);
});
test('H06 DST uses actual local time for spring gap and repeated fall hour',()=>{
 const h=schedule(0,'01:00','03:00','America/New_York');
 assert.equal(at(h,'2026-03-08T06:59:59Z'),true);assert.equal(at(h,'2026-03-08T07:00:00Z'),false);
 assert.equal(at(h,'2026-11-01T05:30:00Z'),true);assert.equal(at(h,'2026-11-01T06:30:00Z'),true);assert.equal(at(h,'2026-11-01T08:00:00Z'),false);
});
