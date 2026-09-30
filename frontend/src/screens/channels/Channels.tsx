import {useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode} from 'react';
import {api} from '@/api/api';
import {ChannelConfiguration} from './ChannelConfiguration';
import './channels-ui.css';

type Channel = {id: string; name: string; origin: string; color?: string; enabled: boolean};
type Install = {name: string; origin: string; customerUrl: string; snippet: string};
type Member = {id: string; full_name: string; email: string; role: string; active: boolean};
type Modal = 'create' | 'install' | 'settings' | null;
type ToastData = {kind: 'success' | 'error'; message: string};

const defaultInput = () => ({requestId: crypto.randomUUID(), name: '', origin: '', greeting: 'Xin chào! Chúng tôi có thể giúp gì cho bạn?', color: '#0057E1', agents: [] as string[]});

function Icon({name}: {name: string}) { return <span className="material-symbols-outlined channel-action-icon" aria-hidden="true">{name}</span>; }
function Toast({toast, onClose}: {toast: ToastData; onClose: () => void}) { return <div className={`channel-toast channel-toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}><span className="channel-toast-icon"><Icon name={toast.kind === 'error' ? 'error' : 'check_circle'} /></span><span className="channel-toast-message">{toast.message}</span><button type="button" aria-label="Đóng thông báo" onClick={onClose}>×</button></div>; }

function ModalShell({title, children, onClose, wide = false}: {title: string; children: ReactNode; onClose: () => void; wide?: boolean}) {
  return <div className="channel-modal-backdrop" role="presentation" onMouseDown={(event) => {if (event.target === event.currentTarget) onClose();}}><section className={`channel-modal ${wide ? 'channel-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header className="channel-modal-header"><h2>{title}</h2><button type="button" className="channel-modal-close" aria-label="Đóng" onClick={onClose}>×</button></header>{children}</section></div>;
}

export function Channels({role}: {role: string}) {
  const [rows, setRows] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [install, setInstall] = useState<Install | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [input, setInput] = useState(defaultInput);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canManage = ['Owner', 'Admin'].includes(role);

  function notify(message: string, kind: ToastData['kind'] = 'success') {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({message, kind});
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  async function load() { setError(''); setRows(await api('/channels')); if (canManage) { const available = await api('/members'); setMembers(available.filter((member: Member) => member.active)); } }
  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, [canManage]);
  useEffect(() => { if (!modal) return; const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null); }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, [modal]);

  async function showInstall(id: string) { setError(''); try { setInstall(await api(`/channels/${id}/installation`)); setModal('install'); } catch (e) { const message = (e as Error).message; setError(message); notify(message, 'error'); } }
  async function showSettings(id: string) { setError(''); try { setSettings(await api(`/channels/${id}/settings`)); setModal('settings'); } catch (e) { const message = (e as Error).message; setError(message); notify(message, 'error'); } }
  async function toggleChannel(id: string, enabled: boolean) { setError(''); try { await api(`/channels/${id}/state`, 'PATCH', {enabled}); await load(); notify(enabled ? 'Đã bật kênh thành công.' : 'Đã tắt kênh thành công.'); } catch (e) { const message = (e as Error).message; setError(message); notify(message, 'error'); } }
  async function copy(value: string, message: string) { try { await navigator.clipboard.writeText(value); notify(message); } catch { const message = 'Không thể copy tự động. Hãy bôi đen và copy nội dung.'; setError(message); notify(message, 'error'); } }
  function startCreate() { setError(''); setInstall(null); setInput(defaultInput()); setStep(1); setModal('create'); }
  function closeModal() { setModal(null); if (step > 0 && !install) setStep(0); }

  async function submit(event: FormEvent) { event.preventDefault(); setError(''); if (step < 3) { setStep(step + 1); return; } setBusy(true); try { const result = await api('/channels', 'POST', input); await load(); await showInstall(result.id); setStep(0); notify('Đã tạo kênh và lưu agent phụ trách.'); } catch (e) { const message = (e as Error).message; setError(message); notify(message, 'error'); } finally { setBusy(false); } }

  return <main className="channels-screen">{toast && <Toast toast={toast} onClose={() => setToast(null)} />}<div className="channels-heading"><div><h1>Kênh chat</h1><p className="muted">Chỉ hiển thị các kết nối thuộc doanh nghiệp/workspace hiện tại.</p></div><div className="channels-actions"><button type="button" className="channel-toolbar-button" onClick={() => void load()}><Icon name="refresh" />Làm mới</button>{canManage && <button type="button" className="channel-toolbar-button channel-toolbar-primary" onClick={startCreate}><Icon name="add" />Tạo kênh website</button>}</div></div>{error && <div role="alert" className="notice error">{error}</div>}

    {!rows.length ? <p className="empty">Doanh nghiệp hiện tại chưa có kênh chat.</p> : <div className="channels-grid">{rows.map((row) => <article className="channel-card" key={row.id} style={{'--channel-accent': row.color || '#0057E1'} as CSSProperties}><div className="channel-card-top"><div className="channel-icon"><Icon name="language" /></div><span className={row.enabled ? 'status-pill status-on' : 'status-pill status-off'}>{row.enabled ? 'Đang bật' : 'Đã tắt'}</span></div><div className="channel-card-body"><h2>{row.name}</h2><p className="channel-type">Website chat · Kết nối riêng của doanh nghiệp</p><dl><div><dt>Website nhúng widget</dt><dd>{row.origin}</dd></div><div><dt>Mã kênh</dt><dd>{row.id}</dd></div></dl></div><div className="channel-card-actions">{canManage && <button type="button" className="channel-action channel-action-toggle" onClick={() => void toggleChannel(row.id, !row.enabled)}><Icon name={row.enabled ? 'toggle_on' : 'toggle_off'} />{row.enabled ? 'Tắt kênh' : 'Bật kênh'}</button>}<button type="button" className="channel-action channel-action-link" onClick={() => void showInstall(row.id)}><Icon name="link" />Link khách</button>{canManage && <button type="button" className="channel-action channel-action-settings" onClick={() => void showSettings(row.id)}><Icon name="tune" />Cấu hình</button>}</div></article>)}</div>}

    {modal === 'create' && <ModalShell title="Tạo kênh website" onClose={closeModal}><p className="channel-modal-subtitle">Thiết lập một kết nối website mới cho doanh nghiệp hiện tại trong 3 bước.</p><div className="channel-stepper">{['Loại kênh', 'Thông tin website', 'Agent phụ trách'].map((label, index) => <span className={step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''} key={label}><b>{index + 1}</b>{label}</span>)}</div><form onSubmit={(event) => void submit(event)}><fieldset disabled={busy}>{step === 1 && <label className="field"><span>Loại kênh</span><input value="Website chat" readOnly /></label>}{step === 2 && <><label className="field"><span>Tên kênh</span><input required minLength={2} maxLength={100} value={input.name} onChange={(e) => setInput({...input, name: e.target.value})} placeholder="Ví dụ: Website Fahasa" /></label><label className="field"><span>Website được phép nhúng khung chat</span><input required type="url" value={input.origin} onChange={(e) => setInput({...input, origin: e.target.value})} placeholder="https://example.com" /><small>Đây là địa chỉ website của doanh nghiệp sẽ đặt mã nhúng. Ví dụ local: http://localhost:3001.</small></label><label className="field"><span>Lời chào</span><textarea required maxLength={500} value={input.greeting} onChange={(e) => setInput({...input, greeting: e.target.value})} /></label><label className="field"><span>Màu thương hiệu</span><input type="color" value={input.color} onChange={(e) => setInput({...input, color: e.target.value})} /></label></>}{step === 3 && <><p>Chọn ít nhất một agent thuộc doanh nghiệp hiện tại để nhận hội thoại.</p>{members.map((member) => <label className="field checkbox-field" key={member.id}><span><input type="checkbox" checked={input.agents.includes(member.id)} onChange={(e) => setInput({...input, agents: e.target.checked ? [...input.agents, member.id] : input.agents.filter((id) => id !== member.id)})} /> {member.full_name} · {member.role}</span><small>{member.email}</small></label>)}{!members.length && <p className="empty">Doanh nghiệp hiện tại chưa có agent đang hoạt động.</p>}</>}<div className="wizard-actions">{step > 1 && <button type="button" className="button-secondary" onClick={() => setStep(step - 1)}><Icon name="arrow_back" />Quay lại</button>}<button className="channel-toolbar-button channel-toolbar-primary" disabled={busy || (step === 3 && !input.agents.length)}>{busy ? 'Đang lưu…' : step === 3 ? 'Tạo kênh' : 'Tiếp tục'}<Icon name="arrow_forward" /></button></div></fieldset></form></ModalShell>}

    {modal === 'install' && install && <ModalShell title={`Link và mã nhúng: ${install.name}`} onClose={closeModal} wide><p className="channel-modal-subtitle">Hai mục dưới đây có mục đích khác nhau: link để khách mở chat trực tiếp, mã nhúng để đặt widget vào website.</p><label className="field"><span>Link mở chat trực tiếp cho khách</span><div className="copy-row"><input readOnly value={install.customerUrl} /><button type="button" className="button-secondary" onClick={() => void copy(install.customerUrl, 'Đã copy link khách.')}><Icon name="content_copy" />Copy link</button><a className="button-link" href={install.customerUrl} target="_blank" rel="noreferrer"><Icon name="open_in_new" />Mở thử</a></div></label><label className="field"><span>Mã nhúng vào website</span><textarea aria-label="Mã nhúng" readOnly rows={5} value={install.snippet} /><button type="button" className="button-secondary button-full" onClick={() => void copy(install.snippet, 'Đã copy mã nhúng.')}><Icon name="content_copy" />Copy mã nhúng</button></label><p className="notice">Website được phép nhúng: <code>{install.origin}</code>. Website khác sẽ bị chặn để bảo vệ dữ liệu doanh nghiệp.</p></ModalShell>}

    {modal === 'settings' && settings && <ModalShell title={`Cấu hình: ${settings.name}`} onClose={closeModal} wide><ChannelConfiguration key={settings.id} initial={settings} onClose={closeModal} onNotify={notify} /></ModalShell>}
  </main>;
}
