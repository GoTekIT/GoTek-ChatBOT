import React,{useEffect,useRef,useState} from 'react';
import {MetaService,type MetaConnection,type MetaProvider} from '../../services/meta.service';
const labels={pending:'Chờ kích hoạt',active:'Đã kích hoạt',reauth_required:'Cần kết nối lại',disconnected:'Đã ngắt'};
export function MetaConnections({scope,allowed}:{scope:string;allowed:boolean}) {
 const [connections,setConnections]=useState<MetaConnection[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [pages,setPages]=useState<Array<{id:string;name:string}>>([]),[cursor,setCursor]=useState<string|null>(null),[pageCursor,setPageCursor]=useState<string|undefined>();
 const [enrollment,setEnrollment]=useState('');
 const epoch=useRef(0);
 useEffect(()=>{
  const current=++epoch.current;setConnections([]);setPages([]);setError('');setEnrollment('');
  if(!allowed)return;
  setBusy(true);
  const candidate=new URLSearchParams(window.location.search).get('meta_enrollment')||'';
  const id=/^[0-9a-f-]{36}$/i.test(candidate)?candidate:'';
  void (async()=>{
   try{
    const rows=await MetaService.list();
    const batch=id?await MetaService.pages(id):null;
    if(epoch.current!==current)return;
    setConnections(rows);setEnrollment(id);setPages(batch?.assets||[]);setCursor(batch?.after||null);setPageCursor(undefined);
   }catch(e){if(epoch.current===current)setError(e instanceof Error?e.message:'Không thể tải kết nối.');}
   finally{if(epoch.current===current)setBusy(false);}
  })();
  return()=>{epoch.current++;};
 },[scope,allowed]);
 async function run(action:(active:()=>boolean)=>Promise<void>){
  if(!allowed||busy)return;
  const current=epoch.current;setBusy(true);setError('');
  try{await action(()=>current===epoch.current);if(current===epoch.current){const rows=await MetaService.list();if(current===epoch.current)setConnections(rows);}}
  catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'Thao tác thất bại.');}
  finally{if(current===epoch.current)setBusy(false);}
 }
 const button='rounded-lg border px-3 py-2 disabled:opacity-50';
 if(!allowed)return null;
 return <section aria-label="Kết nối Facebook và Instagram" className="space-y-4 rounded-xl border bg-white p-5">
  <h2 className="text-lg font-semibold">Facebook và Instagram</h2>
  <p>Kết nối tài khoản doanh nghiệp để nhận và trả lời tin nhắn. Trạng thái kích hoạt chưa chứng minh tin đã được giao đến khách.</p>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  <div className="flex flex-wrap gap-2">{(['facebook','instagram'] as MetaProvider[]).map(provider=><button className={button} key={provider} disabled={busy} onClick={()=>void run(async(active)=>{const url=await MetaService.connect(provider);if(active())window.location.assign(url);})}>Kết nối {provider==='facebook'?'Facebook':'Instagram'}</button>)}</div>
  {busy&&<p role="status">Đang xử lý…</p>}
  {enrollment&&<div className="space-y-2"><h3 className="font-semibold">Chọn Facebook Page</h3>
   {!pages.length&&!busy&&<p>Không có Page đủ quyền trong trang kết quả này.</p>}
   {pages.map(page=><button className={button+' mr-2'} key={page.id} disabled={busy} onClick={()=>void run(async(active)=>{
    await MetaService.selectPage(enrollment,page.id,pageCursor);if(!active())return;setEnrollment('');setPages([]);
    window.history.replaceState(null,'','/app/channels');
   })}>{page.name}</button>)}
   {cursor&&<button className={button} disabled={busy} onClick={()=>void run(async(active)=>{const next=cursor;const batch=await MetaService.pages(enrollment,next);if(!active())return;setPages(batch.assets);setPageCursor(next);setCursor(batch.after);})}>Page tiếp theo</button>}
  </div>}
  {!busy&&!connections.length&&<p>Chưa có kết nối Meta.</p>}
  <ul className="space-y-3">{connections.map(connection=><li key={connection.id} className="rounded-lg border p-3">
   <strong>{connection.asset_name}</strong> · {connection.provider} · {labels[connection.status]}
   {connection.token_expires_at&&<p>Token hết hạn: {new Date(connection.token_expires_at).toLocaleString('vi-VN')}</p>}
   <div className="mt-2 flex gap-2">
    {connection.status==='pending'&&<button className={button} disabled={busy} onClick={()=>void run(async()=>{await MetaService.activate(connection.provider,connection.id);})}>Kích hoạt nhận tin</button>}
    {connection.status!=='disconnected'&&<button className={button} disabled={busy} onClick={()=>{if(window.confirm('Ngắt xử lý tin nhắn của tài khoản này trên GoTek? Quyền trên Meta không bị thu hồi.'))void run(async()=>{await MetaService.disconnect(connection.id);});}}>Ngắt kết nối</button>}
   </div>
  </li>)}</ul>
 </section>;
}
