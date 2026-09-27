import {useState} from 'react';
export function WidgetPreview({title,position,mode,name}:{title:string;position:string;mode:string;name:string}){
 const [open,setOpen]=useState(false);
 return <section aria-label="Xem trước widget" className="widget-preview"><h3>Xem trước</h3><p className="muted">Tin nhắn mẫu · Thay đổi chưa lưu chỉ hiển thị trong bản xem trước.</p><div className="widget-preview-stage" style={{alignItems:position==='left'?'flex-start':'flex-end'}}>
 {open&&<div className="widget-preview-chat" style={{width:mode==='expanded'?480:370}}><strong>{name}</strong><p className="message">Xin chào! Chúng tôi có thể giúp gì cho bạn?</p><p className="message">Tôi muốn tìm hiểu thêm về sản phẩm.</p><button type="button" onClick={()=>setOpen(false)}>Đóng bản xem trước</button></div>}
 <button className="primary" type="button" aria-expanded={open} onClick={()=>setOpen(!open)}>{title||'Trò chuyện'}</button>
 </div></section>;
}
