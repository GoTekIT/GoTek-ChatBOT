/** Provider time controls presentation; durable sequence remains the API cursor. */
export function chronologicalMessages<T extends {timestampIso?:string;sequence?:number}>(messages:readonly T[]):T[]{
 return messages.map((message,index)=>({message,index})).sort((a,b)=>{
 const ta=Date.parse(a.message.timestampIso||''),tb=Date.parse(b.message.timestampIso||'');
 if(Number.isFinite(ta)&&Number.isFinite(tb)&&ta!==tb)return ta-tb;
 if(Number.isFinite(ta)!==Number.isFinite(tb))return Number.isFinite(ta)?-1:1;
 return (a.message.sequence??a.index)-(b.message.sequence??b.index)||a.index-b.index;
 }).map(({message})=>message);
}
