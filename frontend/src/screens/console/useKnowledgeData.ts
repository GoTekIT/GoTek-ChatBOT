import {useEffect,useRef,useState} from 'react';
import {KnowledgeService,mapKnowledge,type KnowledgeRow} from '../../services/knowledge.service';
import type {KnowledgeDocument} from '../../types';
export function useKnowledgeData(workspaceId: string, enabled: boolean) {
  const [documents,setDocuments]=useState<KnowledgeDocument[]>([]);
  const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  const rows=useRef<KnowledgeRow[]>([]); const epoch=useRef(0);
  const sequence=useRef(0);
  const ids=useRef(new Map<string,string>());
  async function refresh() {
    if(!enabled) return;
    const current=epoch.current; const request=++sequence.current; setLoading(true);
    try {const next=await KnowledgeService.list(); if(current!==epoch.current || request!==sequence.current)return;
      rows.current=next;setDocuments(next.map(mapKnowledge));setError('');
    } catch(e) {if(current===epoch.current && request===sequence.current){setDocuments([]);setError(e instanceof Error?e.message:'Không thể tải tri thức.');}}
    finally {if(current===epoch.current && request===sequence.current)setLoading(false);}
  }
  useEffect(()=>{epoch.current++;rows.current=[];ids.current.clear();setDocuments([]);void refresh();return()=>{epoch.current++;};},[workspaceId,enabled]);
  async function mutate(id:string,status:string) {
    if(!enabled)throw new Error('Bạn không có quyền quản lý tri thức.');
    const row=rows.current.find(r=>r.id===id);if(!row)throw new Error('Tài liệu không còn trong phạm vi được phép.');
    const key=JSON.stringify([workspaceId,id,row.revision,status]);const requestId=ids.current.get(key)||crypto.randomUUID();ids.current.set(key,requestId);
    if(status==='archive')await KnowledgeService.archive(row,requestId);
    else if(status==='ready')await KnowledgeService.process(row,requestId);
    else if(status==='published'||status==='internal')await KnowledgeService.publish(row,requestId,status==='published'?'PUBLIC':'INTERNAL');
    else throw new Error('Thao tác không được hỗ trợ.');
    ids.current.delete(key);await refresh();
  }
  return {documents,error,loading,refresh,
    async importFile(file:File,requestId:string) {if(!enabled)throw new Error('Bạn không có quyền nhập tri thức.');await KnowledgeService.importDocument(file,requestId);await refresh();},
    update:(id:string,updates:Partial<KnowledgeDocument>)=>mutate(id,updates.publicationStatus||''),
    archive:(id:string)=>mutate(id,'archive')};
}
