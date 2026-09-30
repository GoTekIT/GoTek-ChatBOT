export function csvCell(value:string){return `"${value.replaceAll('"','""')}"`;}

/** Strict quoted CSV, preserving embedded newlines and rejecting ambiguous cells. */
export function parseCsv(raw:string){
 const text=raw.replace(/^\uFEFF/,'');
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 const fail=()=>{throw new Error(`CSV không hợp lệ tại bản ghi ${rows.length+1}.`);};
 const finishCell=()=>{row.push(cell);cell='';closed=false;};
 const finishRow=()=>{finishCell();rows.push(row);row=[];};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c===','){finishCell();continue;}
  if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;finishRow();continue;}
  if(closed)fail();
  if(c==='"'){if(cell.length)fail();quoted=true;}else cell+=c;
 }
 if(quoted)fail();
 if(cell.length||closed||row.length)finishRow();
 if(rows.shift()?.join('|')!=='title|content|active')throw new Error('CSV cần header: title,content,active');
 if(!rows.length)throw new Error('CSV không có dòng dữ liệu.');
 return rows.map((cells,index)=>{
  if(cells.length!==3||!['true','false'].includes(cells[2]))throw new Error(`CSV bản ghi ${index+2}: cần 3 cột và active là true hoặc false.`);
  return {title:cells[0],content:cells[1],active:cells[2]==='true'};
 });
}
