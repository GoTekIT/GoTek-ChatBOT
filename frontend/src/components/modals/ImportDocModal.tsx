import React, {useRef,useState} from 'react';
interface ImportDocModalProps {
  isOpen:boolean; onClose:()=>void;
  onImport:(file:File,requestId:string)=>Promise<void>;
}
export const ImportDocModal:React.FC<ImportDocModalProps>=({isOpen,onClose,onImport})=>{
  const [file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const requestId=useRef('');
  if(!isOpen)return null;
  async function submit(event:React.FormEvent){
    event.preventDefault();if(!file||busy)return;
    if(file.size>2_000_000){setError('File vượt giới hạn 2 MB.');return;}
    requestId.current ||= crypto.randomUUID();setBusy(true);setError('');
    try{await onImport(file,requestId.current);setFile(null);requestId.current='';onClose();}
    catch(e){setError(e instanceof Error?e.message:'Không thể nhập file. Hãy thử lại.');}
    finally{setBusy(false);}
  }
  return <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="knowledge-import-title" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 max-w-xl w-full p-6">
      <h3 id="knowledge-import-title" className="font-bold">Nhập tài liệu tri thức</h3>
      <form onSubmit={submit} className="space-y-4 mt-4"><fieldset disabled={busy} className="space-y-4">
        <label className="block">Chọn file (PDF, DOCX — tối đa 2 MB)
          <input type="file" accept=".pdf,.docx" required onChange={event=>{setFile(event.target.files?.[0]||null);requestId.current='';setError('');}} className="block w-full border rounded p-3 mt-2"/>
        </label>
        <p className="text-sm">Nội dung được nhập thành bản nháp. Kiểm tra và xử lý trước khi chọn xuất bản công khai hoặc nội bộ.</p>
        {error&&<p role="alert">{error}</p>}
        <div className="flex gap-3"><button type="submit" disabled={!file} className="px-4 py-2 rounded bg-blue-600 text-white">{busy?'Đang nhập…':'Nhập bản nháp'}</button>
        <button type="button" onClick={onClose}>Hủy</button></div>
      </fieldset></form>
    </section>
  </div>;
};
