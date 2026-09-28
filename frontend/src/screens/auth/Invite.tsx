import {useState} from 'react';
import {api} from '@/api/api';

/** GoTek invitation acceptance; source HiChat parity remains pending G001. */
export function Invite({signedIn,onAccepted,onLogin}:{signedIn:boolean,onAccepted:()=>Promise<void>,onLogin:()=>void}){
 const params=new URLSearchParams(location.hash.slice(1));
 const [invitation]=useState(()=>({workspaceId:params.get('workspaceId'),token:params.get('token')}));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[accepted,setAccepted]=useState(false);
 async function accept(){setBusy(true);setError('');try{
 await api('/invitations/accept','POST',invitation);
 await api('/workspace/switch','POST',{workspaceId:invitation.workspaceId});
 history.replaceState({},'',location.pathname);setAccepted(true);await onAccepted();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <main className="auth"><img className="brand" src="/gotek-logo.png" alt="gotek"/><h1>Nhận lời mời</h1>
 {!invitation.token||!invitation.workspaceId?<p role="alert">Liên kết lời mời không đầy đủ. Vui lòng yêu cầu quản trị viên gửi lại.</p>:accepted?<p role="status">Bạn đã tham gia workspace.</p>:<><p>Đăng nhập bằng email nhận lời mời và xác thực email trước khi tham gia.</p>{error&&<div role="alert" className="notice error">{error}</div>}{signedIn?<button className="primary wide" disabled={busy} onClick={accept}>{busy?'Đang xử lý…':'Chấp nhận lời mời'}</button>:<button className="primary wide" onClick={onLogin}>Đăng nhập để tiếp tục</button>}</>}
 </main>;
}
