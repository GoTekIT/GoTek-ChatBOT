import {useEffect,useRef,useState} from 'react';
import {KnowledgeService,type KnowledgeRow} from '../../services/knowledge.service';
export function KnowledgeEditor({id,onClose,onSaved}:{id:string;onClose:()=>void;onSaved:()=>Promise<void>}) {
  const [row,setRow]=useState<KnowledgeRow|null>(null);
  const [title,setTitle]=useState(''),[content,setContent]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const request=useRef<{key:string;id:string}|null>(null);
  useEffect(()=>{let live=true;KnowledgeService.detail(id).then(r=>{if(live){setRow(r);setTitle(r.title);setContent(r.content);}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[id]);
  async function save(event:React.FormEvent){
    event.preventDefault();if(!row||busy)return;setBusy(true);setError('');
    const key=JSON.stringify([id,row.revision,title,content]);
    if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
    try{await KnowledgeService.edit(row,title,content,request.current.id);await onSaved();onClose();}
    catch(e){setError(e instanceof Error?e.message:'Không thể lưu.');}finally{setBusy(false);}
  }
  return <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="knowledge-editor-title" className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-2xl">
    <h3 id="knowledge-editor-title">Xem và chỉnh sửa bản nháp</h3>
    {error&&<p role="alert">{error}</p>}
    {!row&&!error&&<p role="status">Đang tải nội dung…</p>}
    {row&&<form onSubmit={save}><fieldset disabled={busy} className="space-y-3">
      <label className="block">Tiêu đề<input required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} className="block border p-2 w-full"/></label>
      <label className="block">Nội dung<textarea required maxLength={2000} rows={12} value={content} onChange={e=>setContent(e.target.value)} className="block border p-2 w-full"/></label>
      <p>Phiên bản {row.revision} · {row.state}. Lưu tạo bản nháp mới; bản đang xuất bản được giữ nguyên.</p>
      <button type="submit">{busy?'Đang lưu…':'Lưu bản nháp'}</button>
    </fieldset></form>}
    <button disabled={busy} onClick={onClose}>Đóng</button>
  </section></div>;
}
