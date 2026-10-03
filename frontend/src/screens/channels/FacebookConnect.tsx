import {useEffect,useRef,useState} from 'react';
import {api} from '@/api/api';
type Page={id:string;name:string};
export function FacebookConnect({onConnected}:{onConnected:()=>Promise<void>}){
 const [session]=useState(()=>new URLSearchParams(window.location.search).get('metaSession'));
 const [pages,setPages]=useState<Page[]>([]);
 const [selected,setSelected]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const lock=useRef(false);
 const [error,setError]=useState('');
 const [results,setResults]=useState<Record<string,string>>({});
 useEffect(()=>{
  if(!session)return;
  let current=true;
  setBusy(true);
  api(`/meta/oauth/${encodeURIComponent(session)}/accounts`).then(data=>{if(current)setPages(data.accounts);}).catch((e:Error)=>{if(current)setError(e.message);}).finally(()=>{if(current)setBusy(false);});
  return()=>{current=false;};
 },[session]);
 async function start(){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   const data=await api('/meta/oauth/start','POST',{});
   const url=new URL(data.authorizationUrl);
   if(url.protocol!=='https:'||url.hostname!=='www.facebook.com')throw new Error('Đường dẫn Facebook không hợp lệ');
   window.location.assign(url.href);
  }catch(e){setError((e as Error).message);setBusy(false);lock.current=false;}
 }
 async function connect(){
  if(lock.current||!session)return;lock.current=true;setBusy(true);setError('');
  try{
   for(const id of selected){
    setResults(old=>({...old,[id]:'Đang xác minh và kết nối…'}));
    try{
     await api(`/meta/oauth/${encodeURIComponent(session)}/select`,'POST',{accountId:id});
     setResults(old=>({...old,[id]:'Đã kết nối'}));
     setPages(old=>old.filter(page=>page.id!==id));
     setSelected(old=>old.filter(value=>value!==id));
    }catch(e){setResults(old=>({...old,[id]:`Chưa kết nối: ${(e as Error).message}`}));}
   }
   await onConnected();
  }catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
 }
 return <section className="facebook-connect" aria-label="Liên kết Facebook">
  <div><h3>Facebook Messenger</h3><p>Chọn các Page bạn quản lý để nhận và trả lời tin nhắn trong workspace này.</p></div>
  <button type="button" className="channel-primary-button" disabled={busy} onClick={()=>void start()}>{busy?'Đang xử lý…':'Đăng nhập Facebook / cấp quyền lại'}</button>
  {error&&<p role="alert">{error}</p>}
  {session&&<div className="facebook-page-picker">
   <h4>Chọn Page liên kết</h4>
   {!busy&&!pages.length&&!error&&<p>Không còn Page nào để chọn. Bạn có thể đăng nhập lại để cấp thêm quyền.</p>}
   {pages.map(page=><label key={page.id} className="facebook-page-option"><input type="checkbox" disabled={busy} checked={selected.includes(page.id)} onChange={event=>setSelected(old=>event.target.checked?[...old,page.id]:old.filter(id=>id!==page.id))}/><span><strong>{page.name}</strong><small>Page ID: {page.id}</small></span></label>)}
   {pages.length>0&&<button type="button" disabled={busy||!selected.length} onClick={()=>void connect()}>Liên kết {selected.length} Page đã chọn</button>}
   <div aria-live="polite">{Object.entries(results).map(([id,result])=><p key={id}>{pages.find(page=>page.id===id)?.name||id}: {result}</p>)}</div>
  </div>}
 </section>;
}
