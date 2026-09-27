import {useEffect,useRef,useState,type FormEvent} from 'react';
import {api} from './api';
import {RulesTransfer} from './RulesTransfer';
import './ai-rules.css';
type Rule={id:string;title:string;content:string;active:boolean;version:number;updated_at:string};
export function AiRules(){
 const requestSequence=useRef(0),createRequestId=useRef(crypto.randomUUID()),dialog=useRef<HTMLDialogElement>(null);
 const [role,setRole]=useState<string|null>(null),[editing,setEditing]=useState<Rule|null>(null),[title,setTitle]=useState(''),[content,setContent]=useState('');
 const [rows,setRows]=useState<Rule[]>([]),[search,setSearch]=useState(''),[error,setError]=useState<Error|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[loading,setLoading]=useState(false),[loaded,setLoaded]=useState(false),[accessLoading,setAccessLoading]=useState(true),[selected,setSelected]=useState<Set<string>>(new Set()),[showExplainer,setShowExplainer]=useState(true);
 const titleError=title.length>150?'Tiêu đề không được vượt quá 150 ký tự.':!title.trim()&&editing!==null?'Nhập tiêu đề.':'';
 const contentError=content.length>2000?'Nội dung không được vượt quá 2.000 ký tự.':!content.trim()&&editing!==null?'Nhập nội dung.':'';
 const allowed=role==='Owner'||role==='Admin';
 useEffect(()=>{api('/me').then((me:any)=>setRole(me.role)).catch(e=>setError(e as Error)).finally(()=>setAccessLoading(false));},[]);
 const load=async()=>{const sequence=++requestSequence.current;setLoading(true);try{const result=await api(`/ai/rules${search?`?search=${encodeURIComponent(search)}`:''}`);if(sequence!==requestSequence.current)return false;setRows(result);setError(null);setLoaded(true);return true;}catch(e){if(sequence===requestSequence.current)setError(e as Error);return false;}finally{if(sequence===requestSequence.current)setLoading(false);}};
 useEffect(()=>{if(allowed)void load();return()=>{requestSequence.current++;};},[allowed]);
 async function create(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy||!allowed||titleError||contentError||!title.trim()||!content.trim())return;setBusy(true);setError(null);setMessage('');try{await api(editing?`/ai/rules/${editing.id}`:'/ai/rules',editing?'PATCH':'POST',editing?{title:title.trim(),content:content.trim(),expectedVersion:editing.version}:{title:title.trim(),content:content.trim(),requestId:createRequestId.current});dialog.current?.close();setEditing(null);setTitle('');setContent('');createRequestId.current=crypto.randomUUID();const refreshed=await load();setMessage(refreshed?'Đã lưu quy tắc.':'Đã lưu quy tắc, nhưng chưa tải lại được danh sách. Chọn Tải lại; không cần lưu lại.');}catch(e){setError(e as Error);}finally{setBusy(false);}}
 async function toggle(row:Rule){if(busy)return;setBusy(true);setError(null);setMessage('');try{await api(`/ai/rules/${row.id}/state`,'PATCH',{active:!row.active,expectedVersion:row.version});const refreshed=await load();setMessage(refreshed?'Đã cập nhật trạng thái.':'Đã cập nhật trạng thái, nhưng chưa tải lại được danh sách. Chọn Tải lại.');}catch(e){setError(e as Error);}finally{setBusy(false);}}
 if(accessLoading)return <p role="status">Đang kiểm tra quyền…</p>;
 if(error&&role===null)return <><h1>Quy tắc AI</h1><div role="alert" className="notice error">{error.message}</div><button onClick={()=>{setAccessLoading(true);api('/me').then((me:any)=>{setRole(me.role);setError(null);}).catch(e=>setError(e as Error)).finally(()=>setAccessLoading(false));}}>Thử lại</button></>;
 if(!allowed)return <><h1>Quy tắc AI</h1><div role="alert" className="notice error">Bạn cần quyền Admin hoặc Owner để quản lý quy tắc AI.</div></>;
 function openEditor(row:Rule|null){setEditing(row);setTitle(row?.title??'');setContent(row?.content??'');setError(null);setMessage('');dialog.current?.showModal();}
 function cancelEditor(){if(busy)return;dialog.current?.close();setEditing(null);setTitle('');setContent('');createRequestId.current=crypto.randomUUID();setError(null);}
 return <div className="ai-rules-page">
  <h1>Quy tắc AI</h1>
  {error&&!dialog.current?.open&&<div role="alert" className="notice error">{error.message}</div>}
  {message&&<div role="status" className="notice">{message}</div>}
  <section className="panel ai-rules-panel">
   {showExplainer&&<div className="ai-rules-explainer" role="note"><span className="ai-rules-info" aria-hidden="true">i</span><div><strong>Quy tắc ứng xử (AI Rules)</strong><p>Quy định cách Bot hành xử. Ví dụ: “Luôn xưng hô là em”, “Không được nhắc đến đối thủ cạnh tranh”, “Chỉ trả lời ngắn gọn dưới 3 câu”.</p></div><button type="button" className="ai-rules-explainer-close" aria-label="Ẩn thông tin" onClick={()=>setShowExplainer(false)}>×</button></div>}
   <h2>Quy tắc AI</h2><p className="ai-rules-description">Định nghĩa các nguyên tắc mà trợ lý AI phải tuân thủ trong mọi cuộc hội thoại.</p>
   <div className="ai-rules-toolbar"><button type="button" className="primary ai-rules-add" disabled={busy} onClick={()=>openEditor(null)}>＋ Thêm quy tắc</button><RulesTransfer onImported={()=>void load()}/></div>
   <form className="ai-rules-search" onSubmit={e=>{e.preventDefault();void load();}}>
    <label className="field">Tìm kiếm<input value={search} maxLength={150} placeholder="Tìm kiếm theo tiêu đề hoặc nội dung quy tắc…" onChange={e=>setSearch(e.target.value)}/></label>
    <button type="submit" disabled={loading||busy}>Tìm kiếm</button><button type="button" disabled={loading||busy} onClick={()=>void load()}>Tải lại</button>
   </form>
   {loading&&<p role="status">Đang tải quy tắc…</p>}
   {!rows.length?(loaded&&!loading&&!error?<p className="empty">Không có quy tắc phù hợp.</p>:null):<div className="ai-rules-list">{rows.map(row=><article className={selected.has(row.id)?'ai-rule-row selected':'ai-rule-row'} key={row.id}>
    <label className="ai-rule-select"><input type="checkbox" aria-label={`Chọn quy tắc ${row.title}`} checked={selected.has(row.id)} onChange={e=>setSelected(previous=>{const next=new Set(previous);if(e.target.checked)next.add(row.id);else next.delete(row.id);return next;})}/></label><div className="ai-rule-body"><div className="ai-rule-heading"><strong>{row.title}</strong><span className={row.active?'ai-rule-state active':'ai-rule-state'}>{row.active?'Đang hoạt động':'Đã tắt'}</span></div><p>{row.content}</p><small>Cập nhật {new Date(row.updated_at).toLocaleString('vi-VN')}</small></div>
    <div className="ai-rule-actions"><button disabled={busy} onClick={()=>openEditor(row)}>Chỉnh sửa</button><button disabled={busy} onClick={()=>void toggle(row)}>{row.active?'Tắt':'Bật'}</button></div>
   </article>)}</div>}
  </section>
  <dialog ref={dialog} className="ai-rules-dialog" aria-labelledby="ai-rules-dialog-title" onCancel={e=>{e.preventDefault();cancelEditor();}}>
   <div className="ai-rules-dialog-heading"><h2 id="ai-rules-dialog-title">{editing?'Chỉnh sửa quy tắc':'Thêm quy tắc'}</h2><button type="button" disabled={busy} aria-label="Đóng" onClick={cancelEditor}>×</button></div>
   {error&&<div role="alert" className="notice error">{error.message}</div>}
   <form onSubmit={create}><fieldset disabled={busy}>
    <label className="field">Tiêu đề <input autoFocus name="title" required maxLength={150} placeholder="Ví dụ: Quy tắc không thu thập thông tin nhạy cảm" aria-invalid={!!titleError} aria-describedby="rule-title-count" value={title} onChange={e=>setTitle(e.target.value)}/><small id="rule-title-count" className="ai-rule-counter">{title.length}/150</small>{titleError&&<small className="field-error" role="alert">{titleError}</small>}</label>
    <label className="field">Nội dung quy tắc <textarea name="content" required maxLength={2000} rows={5} placeholder="Mô tả chi tiết hành vi mà AI phải tuân theo" aria-invalid={!!contentError} aria-describedby="rule-content-count" value={content} onChange={e=>setContent(e.target.value)}/><small id="rule-content-count" className="ai-rule-counter">{content.length}/2000</small>{contentError&&<small className="field-error" role="alert">{contentError}</small>}</label>
    <div className="ai-rules-dialog-actions"><button type="button" onClick={cancelEditor}>Hủy</button><button className="primary" disabled={busy||!!titleError||!!contentError||!title.trim()||!content.trim()}>{busy?'Đang lưu…':editing?'Lưu thay đổi':'Tạo'}</button></div>
   </fieldset></form>
  </dialog>
 </div>;
}
