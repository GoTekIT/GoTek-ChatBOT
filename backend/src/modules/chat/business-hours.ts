export type BusinessHours={enabled:boolean;timezone:string;days:{day:number;enabled:boolean;fullDay:boolean;start:string;end:string}[]};
/** Provisional GoTek policy: wall-clock weekly schedule, start inclusive/end exclusive.
 * Overnight windows belong to their starting weekday; equal times mean empty.
 * DST follows the configured IANA zone, so repeated wall-clock minutes both match.
 */
export function isWithinBusinessHours(hours:BusinessHours,instant=new Date()):boolean{
 if(!hours.enabled)return true;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:hours.timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant);
 const part=(type:string)=>parts.find(p=>p.type===type)?.value||'';
 const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(part('weekday'));
 const clock=part('hour')+':'+part('minute');
 const today=hours.days.find(d=>d.day===day);
 if(today?.enabled&&(today.fullDay||(today.start<today.end?clock>=today.start&&clock<today.end:today.start>today.end&&clock>=today.start)))return true;
 const previous=hours.days.find(d=>d.day===(day+6)%7);
 return !!(previous?.enabled&&!previous.fullDay&&previous.start>previous.end&&clock<previous.end);
}
