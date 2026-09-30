import {useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode} from 'react';
import {api} from '@/api/api';
import {ChannelConfiguration, HoursStep, PrechatStep} from './ChannelConfiguration';
import {WidgetPreview} from './WidgetPreview';
import './channels-ui.css';
import './channels-config.css';
import './channels-config-overrides.css';
import './channels-config-hours.css';
import './channels-config-prechat.css';

type Channel = {id: string; name: string; origin: string; greeting?: string; color?: string; enabled: boolean};
type Install = {id: string; name: string; origin: string; snippet: string; snippetStandard?: string};
type Member = {id: string; full_name: string; email: string; role: string; active: boolean};
type Modal = 'create' | 'install' | 'settings' | null;
type ToastData = {kind: 'success' | 'error'; message: string};

const defaultInput = () => ({
  requestId: crypto.randomUUID(),
  name: '',
  origin: '',
  greeting: 'Xin chào! Chúng tôi có thể giúp gì cho bạn?',
  color: '#0057E1',
  widget_title: 'Chat với chúng tôi',
  widget_position: 'right',
  widget_mode: 'standard',
  business_hours: {
    enabled: false,
    timezone: 'Asia/Ho_Chi_Minh',
    days: [
      {day: 1, enabled: true, fullDay: false, start: '08:30', end: '17:30'},
      {day: 2, enabled: true, fullDay: false, start: '08:30', end: '17:30'},
      {day: 3, enabled: true, fullDay: false, start: '08:30', end: '17:30'},
      {day: 4, enabled: true, fullDay: false, start: '08:30', end: '17:30'},
      {day: 5, enabled: true, fullDay: false, start: '08:30', end: '17:30'},
      {day: 6, enabled: false, fullDay: false, start: '09:00', end: '17:00'},
      {day: 0, enabled: false, fullDay: false, start: '09:00', end: '17:00'}
    ]
  },
  prechat: {
    enabled: true,
    message: 'Vui lòng để lại thông tin để chúng tôi hỗ trợ bạn tốt nhất.',
    fields: [
      {key: 'fullName', enabled: true, required: true, label: 'Họ và tên', placeholder: 'Nhập họ và tên của bạn'},
      {key: 'emailAddress', enabled: true, required: false, label: 'Email', placeholder: 'example@email.com'},
      {key: 'phoneNumber', enabled: true, required: false, label: 'Số điện thoại', placeholder: '0901234567'}
    ]
  },
  assignment_enabled: true,
  assignment_limit: null as number | null,
  agents: [] as string[]
});

function Icon({name, className}: {name: string; className?: string}) {
  return <span className={`material-symbols-outlined channel-action-icon ${className || ''}`} aria-hidden="true">{name}</span>;
}
function Toast({toast, onClose}: {toast: ToastData; onClose: () => void}) { return <div className={`channel-toast channel-toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}><span className="channel-toast-icon"><Icon name={toast.kind === 'error' ? 'error' : 'check_circle'} /></span><span className="channel-toast-message">{toast.message}</span><button type="button" aria-label="Đóng thông báo" onClick={onClose}>×</button></div>; }

function ModalShell({title, children, onClose, wide = false}: {title: string; children: ReactNode; onClose: () => void; wide?: boolean}) {
  return <div className="channel-modal-backdrop" role="presentation" onMouseDown={(event) => {if (event.target === event.currentTarget) onClose();}}><section className={`channel-modal ${wide ? 'channel-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header className="channel-modal-header"><h2>{title}</h2><button type="button" className="channel-modal-close" aria-label="Đóng" onClick={onClose}>×</button></header>{children}</section></div>;
}

export function Channels({role}: {role: string}) {
  const [rows, setRows] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [install, setInstall] = useState<Install | null>(null);
  const [installTab, setInstallTab] = useState<'async' | 'standard' | 'gtm' | 'cms'>('async');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
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
  async function load(isRefresh = false) {
    setError('');
    if (isRefresh) setReloading(true);
    else setLoading(true);
    try {
      const [channelRows, memberRows] = await Promise.all([
        api('/channels'),
        canManage ? api('/members') : Promise.resolve([])
      ]);
      setRows(channelRows);
      if (canManage) {
        setMembers(memberRows.filter((member: Member) => member.active));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }

  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, [canManage]);
  useEffect(() => { if (!modal) return; const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null); }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, [modal]);

  async function showInstall(id: string) { setError(''); try { const data = await api(`/channels/${id}/installation`); setInstall({...data, id}); setInstallTab('async'); setVerifyResult(null); setModal('install'); } catch (e) { const message = (e as Error).message; setError(message); notify(message, 'error'); } }
  async function handleVerify(channelId: string) { setVerifying(true); try { const res = await api(`/channels/${channelId}/verify`); setVerifyResult(res); notify('Đã cập nhật trạng thái kết nối.'); } catch (e) { const message = (e as Error).message; notify(message, 'error'); } finally { setVerifying(false); } }
  async function showSettings(id: string) {
    setError('');
    try {
      const channel = rows.find((r) => r.id === id);
      const data = await api(`/channels/${id}/settings`);
      setSettings({
        ...channel,
        ...data,
        name: data.name || channel?.name || '',
        origin: data.origin || channel?.origin || '',
        greeting: data.greeting || channel?.greeting || ''
      });
      setModal('settings');
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      notify(message, 'error');
    }
  }
  async function toggleChannel(id: string, enabled: boolean) {
    setError('');
    setTogglingId(id);
    try {
      await api(`/channels/${id}/state`, 'PATCH', {enabled});
      await load(true);
      notify(enabled ? 'Đã bật kênh thành công.' : 'Đã tắt kênh thành công.');
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      notify(message, 'error');
    } finally {
      setTogglingId(null);
    }
  }

  async function copy(value: string, message: string) { try { await navigator.clipboard.writeText(value); notify(message); } catch { const message = 'Không thể copy tự động. Hãy bôi đen và copy nội dung.'; setError(message); notify(message, 'error'); } }
  function startCreate() { setError(''); setInstall(null); setInput(defaultInput()); setStep(1); setModal('create'); }
  function closeModal() { setModal(null); if (step > 0 && !install) setStep(0); }

  function updatePrechatField(index: number, patch: any) {
    setInput((current: any) => ({
      ...current,
      prechat: {
        ...current.prechat,
        fields: current.prechat.fields.map((field: any, currentIndex: number) =>
          currentIndex === index ? {...field, ...patch, enabled: true} : field
        )
      }
    }));
  }

  function addPrechatField() {
    const key = `custom_${crypto.randomUUID().replaceAll('-', '')}`;
    setInput((current: any) => ({
      ...current,
      prechat: {
        ...current.prechat,
        fields: [
          ...current.prechat.fields,
          {key, enabled: true, required: false, label: 'Thông tin mới', placeholder: 'Nhập thông tin'}
        ]
      }
    }));
    notify('Đã thêm trường thông tin mới. Bạn có thể đổi nhãn và gợi ý nhập.');
  }

  function removePrechatField(index: number) {
    if (input.prechat.fields.length <= 1) {
      notify('Form cần giữ lại ít nhất một trường thông tin.', 'error');
      return;
    }
    const removed = input.prechat.fields[index];
    setInput((current: any) => ({
      ...current,
      prechat: {
        ...current.prechat,
        fields: current.prechat.fields.filter((_: any, currentIndex: number) => currentIndex !== index)
      }
    }));
    notify(`Đã xoá trường ${removed?.label || 'thông tin'}.`);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (step < 5) {
      if (step === 1) {
        const trimmedName = (input.name || '').trim();
        if (!trimmedName || trimmedName.length < 2) { setError('Tên kênh phải có ít nhất 2 ký tự.'); return; }
        const trimmedOrigin = (input.origin || '').trim();
        if (!trimmedOrigin) { setError('Vui lòng nhập website được phép nhúng widget (Origin).'); return; }
        try { const u = new URL(trimmedOrigin); if (!['http:', 'https:'].includes(u.protocol)) throw new Error(); } catch { setError('Địa chỉ website không hợp lệ. Vui lòng nhập định dạng https://ten-mien-cua-ban.com'); return; }
        if (!input.greeting?.trim()) { setError('Vui lòng nhập lời chào ban đầu.'); return; }
      }
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      const result = await api('/channels', 'POST', {
        requestId: input.requestId,
        name: input.name,
        origin: input.origin,
        greeting: input.greeting,
        color: input.color,
        agents: input.agents
      });

      // Save additional prechat, business hours, widget settings & assignment
      const prechat = {
        ...input.prechat,
        fields: input.prechat.fields.map((f: any) => ({...f, enabled: true}))
      };
      await api(`/channels/${result.id}/settings`, 'PATCH', {
        assignmentEnabled: input.assignment_enabled,
        assignmentLimit: input.assignment_limit,
        businessHours: input.business_hours,
        prechat,
        widgetTitle: input.widget_title || input.name || 'Chat với chúng tôi',
        widgetPosition: input.widget_position || 'right',
        widgetMode: input.widget_mode || 'standard',
        color: input.color
      });

      await load(true);
      await showInstall(result.id);
      setStep(0);
      notify('Đã tạo kênh và cấu hình đầy đủ form khách & lịch làm việc.');
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      notify(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="channels-screen">
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      <div className="channels-heading">
        <div>
          <h1>Kênh kết nối & Tích hợp</h1>
          <p className="muted">Quản lý các điểm kết nối và widget hỗ trợ khách hàng trực tuyến của doanh nghiệp.</p>
        </div>
        <div className="channels-actions">
          <button
            type="button"
            className="channel-toolbar-button"
            disabled={reloading || loading}
            onClick={() => void load(true)}
          >
            <Icon name={reloading ? "sync" : "refresh"} className={reloading ? "spin-icon" : ""} />
            {reloading ? 'Đang làm mới…' : 'Làm mới'}
          </button>
          {canManage && (
            <button type="button" className="channel-toolbar-button channel-toolbar-primary" onClick={startCreate}>
              <Icon name="add" />Tạo kênh website
            </button>
          )}
        </div>
      </div>
      {error && <div role="alert" className="notice error">{error}</div>}

      {loading ? (
        <div className="channels-loading-state">
          <span className="material-symbols-outlined spin-icon">sync</span>
          <span>Đang tải danh sách kênh chat của doanh nghiệp…</span>
        </div>
      ) : !rows.length ? (
        <p className="empty">Doanh nghiệp hiện tại chưa có kênh chat.</p>
      ) : (
        <div className="channels-grid">
          {rows.map((row) => (
            <article className="channel-card" key={row.id} style={{'--channel-accent': row.color || '#0057E1'} as CSSProperties}>
              <div className="channel-card-top">
                <div className="channel-icon" style={{backgroundColor: `${row.color || '#0057E1'}18`, color: row.color || '#0057E1'}}>
                  <Icon name="language" />
                </div>
                <div className="channel-title-group">
                  <h2>{row.name}</h2>
                  <p className="channel-type">Website chat · Kết nối riêng của doanh nghiệp</p>
                </div>
                <span className={row.enabled ? 'status-pill status-on' : 'status-pill status-off'}>
                  {row.enabled ? 'Đang bật' : 'Đã tắt'}
                </span>
              </div>
              <div className="channel-card-body">
                <dl>
                  <div>
                    <dt>Website nhúng widget</dt>
                    <dd>{row.origin}</dd>
                  </div>
                  <div>
                    <dt>Mã kênh</dt>
                    <dd>{row.id}</dd>
                  </div>
                </dl>
              </div>
              <div className="channel-card-actions">
                {canManage && (
                  <button
                    type="button"
                    className="channel-action channel-action-toggle"
                    disabled={togglingId === row.id}
                    onClick={() => void toggleChannel(row.id, !row.enabled)}
                  >
                    <Icon
                      name={togglingId === row.id ? 'sync' : (row.enabled ? 'toggle_on' : 'toggle_off')}
                      className={togglingId === row.id ? 'spin-icon' : ''}
                    />
                    {togglingId === row.id ? 'Đang cập nhật…' : (row.enabled ? 'Tắt kênh' : 'Bật kênh')}
                  </button>
                )}
                <button type="button" className="channel-action channel-action-link" onClick={() => void showInstall(row.id)}>
                  <Icon name="code" />Mã nhúng
                </button>
                {canManage && (
                  <button type="button" className="channel-action channel-action-settings" onClick={() => void showSettings(row.id)}>
                    <Icon name="tune" />Cấu hình
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

    {modal === 'create' && (
      <ModalShell title="Tạo kênh website" onClose={closeModal} wide>
        <div className="channel-config-form" style={{padding: '0 24px 20px'}}>
          <div className="config-intro">
            <span className="material-symbols-outlined config-intro-icon-mini">add_circle</span>
            <strong>Tạo kênh website mới</strong>
            <span className="config-intro-sep">/</span>
            <span>Thiết lập website, giao diện, giờ hoạt động, form thông tin khách và người tiếp nhận trong 5 bước</span>
          </div>

          <nav className="config-stepper" aria-label="Các bước tạo kênh">
            {[
              {title: 'Website kết nối', num: 1},
              {title: 'Giao diện widget', num: 2},
              {title: 'Giờ hoạt động', num: 3},
              {title: 'Thông tin khách', num: 4},
              {title: 'Người tiếp nhận', num: 5}
            ].map((s, index) => {
              const isCurrent = step === s.num;
              const isCompleted = step > s.num;
              return (
                <div
                  key={s.title}
                  className={`stepper-item ${isCurrent ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <div className="stepper-indicator">
                    {isCompleted ? <Icon name="check" /> : <span>{s.num}</span>}
                  </div>
                  <span className="stepper-label">{s.title}</span>
                  {index < 4 && <div className="stepper-divider" />}
                </div>
              );
            })}
          </nav>

          <form onSubmit={(event) => void submit(event)}>
            <fieldset disabled={busy} style={{border: 0, padding: 0, margin: 0}}>
              {step === 1 && (
                <section className="config-section" style={{paddingTop: 14}}>
                  <div className="config-section-heading">
                    <div>
                      <span className="config-eyebrow">BƯỚC 1 · THÔNG TIN KÊNH</span>
                      <h3>Cấu hình website kết nối</h3>
                      <p>Khai báo tên kênh và website được phép nhúng widget chat của doanh nghiệp.</p>
                    </div>
                  </div>

                  <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
                    <label className="field">
                      <span>Tên kênh <b style={{color: '#e11d48'}}>*</b></span>
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={input.name}
                        onChange={(e) => setInput({...input, name: e.target.value})}
                        placeholder="Ví dụ: Website Fahasa"
                      />
                      <small>Tên nhận diện kênh hỗ trợ trong không gian làm việc của bạn.</small>
                    </label>

                    <label className="field">
                      <span>Website được phép nhúng khung chat (Origin) <b style={{color: '#e11d48'}}>*</b></span>
                      <input
                        required
                        type="url"
                        value={input.origin}
                        onChange={(e) => setInput({...input, origin: e.target.value})}
                        placeholder="https://example.com"
                      />
                      <small>
                        Địa chỉ website sẽ đặt widget (bảo vệ chống giả mạo Origin). Ví dụ: <code>https://fahasa.com</code> hoặc local <code>http://localhost:3001</code>.
                      </small>
                    </label>

                    <label className="field">
                      <span>Lời chào ban đầu <b style={{color: '#e11d48'}}>*</b></span>
                      <textarea
                        required
                        maxLength={500}
                        rows={3}
                        value={input.greeting}
                        onChange={(e) => setInput({...input, greeting: e.target.value})}
                        placeholder="Xin chào! Chúng tôi có thể giúp gì cho bạn?"
                      />
                      <small>Tin nhắn chào mừng tự động hiển thị cho khách truy cập khi lần đầu mở khung chat.</small>
                    </label>
                  </div>
                </section>
              )}

              {step === 2 && (
                <section className="config-section" style={{paddingTop: 14}}>
                  <div className="config-section-heading">
                    <div>
                      <span className="config-eyebrow">BƯỚC 2 · GIAO DIỆN & MÀU SẮC</span>
                      <h3>Tùy chỉnh màu sắc thương hiệu & giao diện</h3>
                      <p>Chọn màu chủ đạo đồng bộ với thương hiệu của bạn và xem trước mô phỏng giao diện khách nhìn thấy.</p>
                    </div>
                  </div>

                  <div className="config-workspace">
                    <div className="config-form" style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 14}}>
                      <label className="field">
                        <span>Tiêu đề hiển thị trên thanh header</span>
                        <input
                          maxLength={80}
                          value={input.widget_title}
                          onChange={(e) => setInput({...input, widget_title: e.target.value})}
                          placeholder="Ví dụ: Chat với chúng tôi"
                        />
                      </label>

                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
                        <label className="field">
                          <span>Vị trí</span>
                          <select
                            value={input.widget_position}
                            onChange={(e) => setInput({...input, widget_position: e.target.value})}
                          >
                            <option value="right">Bên phải</option>
                            <option value="left">Bên trái</option>
                          </select>
                        </label>

                        <label className="field">
                          <span>Kích thước</span>
                          <select
                            value={input.widget_mode}
                            onChange={(e) => setInput({...input, widget_mode: e.target.value})}
                          >
                            <option value="standard">Tiêu chuẩn</option>
                            <option value="expanded">Mở rộng</option>
                          </select>
                        </label>
                      </div>

                      <div className="field color-setting-field">
                        <span>Màu chủ đạo thương hiệu</span>
                        <div className="color-control-bar">
                          <div className="color-picker-box" style={{backgroundColor: input.color || '#0057E1'}}>
                            <input
                              type="color"
                              className="native-color-input"
                              aria-label="Chọn màu thương hiệu"
                              value={input.color || '#0057E1'}
                              onChange={(e) => setInput({...input, color: e.target.value})}
                            />
                          </div>
                          <input
                            type="text"
                            className="color-hex-text"
                            maxLength={7}
                            value={input.color || '#0057E1'}
                            onChange={(e) => {
                              let val = e.target.value.trim();
                              if (!val.startsWith('#') && val.length > 0) val = '#' + val;
                              setInput({...input, color: val});
                            }}
                          />
                          <div className="color-palette-swatches">
                            {[
                              {label: 'GoTek Xanh', hex: '#0057E1'},
                              {label: 'Xanh lá', hex: '#059669'},
                              {label: 'Chàm', hex: '#4f46e5'},
                              {label: 'Tím', hex: '#7c3aed'},
                              {label: 'Hồng đỏ', hex: '#e11d48'},
                              {label: 'Cam', hex: '#ea580c'},
                              {label: 'Đen sang', hex: '#0f172a'}
                            ].map((c) => (
                              <button
                                key={c.hex}
                                type="button"
                                className="color-swatch-circle"
                                style={{
                                  backgroundColor: c.hex,
                                  boxShadow: (input.color || '').toLowerCase() === c.hex.toLowerCase()
                                    ? `0 0 0 2px #fff, 0 0 0 4px ${c.hex}`
                                    : undefined
                                }}
                                title={`${c.label} (${c.hex})`}
                                onClick={() => setInput({...input, color: c.hex})}
                              />
                            ))}
                          </div>
                        </div>
                        <small style={{color: '#64748b', fontSize: '11.5px', marginTop: 4}}>
                          Màu này sẽ áp dụng lên nút Launcher tròn, thanh tiêu đề và các nút bấm chính của widget.
                        </small>
                      </div>

                      <div style={{padding: 12, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0'}}>
                        <div style={{fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4}}>
                          Lời chào sẽ xuất hiện cho khách:
                        </div>
                        <div style={{fontSize: 12.5, color: '#475569', fontStyle: 'italic', lineHeight: 1.45}}>
                          "{input.greeting || 'Xin chào! Chúng tôi có thể giúp gì cho bạn?'}"
                        </div>
                      </div>
                    </div>

                    <aside className="config-preview-pane">
                      <WidgetPreview
                        title={input.widget_title || input.name || 'Hỗ trợ trực tuyến'}
                        position={input.widget_position || 'right'}
                        mode={input.widget_mode || 'standard'}
                        name={input.name || 'Website'}
                        color={input.color || '#0057E1'}
                      />
                    </aside>
                  </div>
                </section>
              )}

              {step === 3 && (
                <HoursStep
                  value={input}
                  setValue={setInput}
                  eyebrow="BƯỚC 3 · GIỜ HOẠT ĐỘNG"
                />
              )}

              {step === 4 && (
                <PrechatStep
                  value={input}
                  setValue={setInput}
                  updateField={updatePrechatField}
                  addField={addPrechatField}
                  removeField={removePrechatField}
                  eyebrow="BƯỚC 4 · THÔNG TIN KHÁCH"
                />
              )}

              {step === 5 && (
                <section className="config-section" style={{paddingTop: 14}}>
                  <div className="config-section-heading">
                    <div>
                      <span className="config-eyebrow">BƯỚC 5 · NGƯỜI XỬ LÝ</span>
                      <h3>Cộng tác viên và phân công</h3>
                      <p>Chọn ít nhất một thành viên thuộc doanh nghiệp hiện tại có thể nhận hội thoại từ kênh này.</p>
                    </div>
                    <span className="config-count">{input.agents.length} đã chọn</span>
                  </div>

                  <div className="agent-grid">
                    {members.map((member) => (
                      <label
                        className={`agent-option ${input.agents.includes(member.id) ? 'selected' : ''}`}
                        key={member.id}
                      >
                        <input
                          type="checkbox"
                          checked={input.agents.includes(member.id)}
                          onChange={(event) =>
                            setInput({
                              ...input,
                              agents: event.target.checked
                                ? [...input.agents, member.id]
                                : input.agents.filter((id) => id !== member.id)
                            })
                          }
                        />
                        <span className="agent-avatar">{(member.full_name || member.email).slice(0, 1).toUpperCase()}</span>
                        <span className="agent-info">
                          <strong>{member.full_name}</strong>
                          <small>{member.role} · {member.email}</small>
                        </span>
                        <span className="agent-check">
                          <Icon name="check" />
                        </span>
                      </label>
                    ))}
                  </div>

                  {!members.length && (
                    <p className="empty">Doanh nghiệp hiện tại chưa có thành viên đang hoạt động.</p>
                  )}
                </section>
              )}

              <div className="wizard-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 18, borderTop: '1px solid #edf0f6'}}>
                {step > 1 && (
                  <button type="button" className="button-secondary" onClick={() => setStep(step - 1)}>
                    <Icon name="arrow_back" /> Quay lại
                  </button>
                )}
                <button
                  type="submit"
                  className="channel-toolbar-button channel-toolbar-primary"
                  disabled={busy || (step === 5 && !input.agents.length)}
                >
                  {busy ? (
                    <>
                      <Icon name="sync" className="spin-icon" />
                      Đang tạo kênh…
                    </>
                  ) : (
                    <>
                      {step === 5 ? 'Tạo kênh website' : 'Tiếp tục'}
                      <Icon name={step === 5 ? 'check_circle' : 'arrow_forward'} />
                    </>
                  )}
                </button>
              </div>
            </fieldset>
          </form>
        </div>
      </ModalShell>
    )}

    {modal === 'install' && install && (
      <ModalShell title={`Mã nhúng widget: ${install.name}`} onClose={closeModal} wide>
        <div className="install-modal-content">
          <div className="install-origin-banner">
            <div className="install-origin-info">
              <span className="install-origin-label">Website được phép nhúng:</span>
              <code className="install-origin-code">{install.origin}</code>
            </div>
            <span className="install-security-pill">
              <Icon name="verified_user" /> Chống giả mạo Origin
            </span>
          </div>

          <div className="install-tabs">
            <button
              type="button"
              className={`install-tab-btn ${installTab === 'async' ? 'active' : ''}`}
              onClick={() => setInstallTab('async')}
            >
              <Icon name="bolt" /> Mã Async (Khuyên dùng)
            </button>
            <button
              type="button"
              className={`install-tab-btn ${installTab === 'standard' ? 'active' : ''}`}
              onClick={() => setInstallTab('standard')}
            >
              <Icon name="code" /> Mã chuẩn (HTML)
            </button>
            <button
              type="button"
              className={`install-tab-btn ${installTab === 'gtm' ? 'active' : ''}`}
              onClick={() => setInstallTab('gtm')}
            >
              <Icon name="hub" /> Google Tag Manager
            </button>
            <button
              type="button"
              className={`install-tab-btn ${installTab === 'cms' ? 'active' : ''}`}
              onClick={() => setInstallTab('cms')}
            >
              <Icon name="integration_instructions" /> WordPress / CMS
            </button>
          </div>

          {installTab === 'async' && (
            <div className="install-tab-panel">
              <p className="install-tab-desc">
                Đoạn mã nạp bất đồng bộ không chặn luồng render (Non-blocking). Website của bạn luôn tải nhanh tối đa ngay cả khi mạng chậm.
              </p>
              <label className="field">
                <span>Chèn trước thẻ đóng <code>&lt;/body&gt;</code></span>
                <textarea aria-label="Mã nhúng bất đồng bộ" readOnly rows={6} value={install.snippet} />
                <button
                  type="button"
                  className="button-secondary button-full"
                  onClick={() => void copy(install.snippet, 'Đã copy mã nhúng Async.')}
                >
                  <Icon name="content_copy" /> Copy mã nhúng Async
                </button>
              </label>
            </div>
          )}

          {installTab === 'standard' && (
            <div className="install-tab-panel">
              <p className="install-tab-desc">
                Đoạn mã script chuẩn truyền thống, phù hợp cho website tĩnh hoặc các hệ thống CMS yêu cầu thẻ script đơn giản.
              </p>
              <label className="field">
                <span>Mã nhúng script tiêu chuẩn</span>
                <textarea aria-label="Mã nhúng chuẩn" readOnly rows={6} value={install.snippetStandard || install.snippet} />
                <button
                  type="button"
                  className="button-secondary button-full"
                  onClick={() => void copy(install.snippetStandard || install.snippet, 'Đã copy mã nhúng chuẩn.')}
                >
                  <Icon name="content_copy" /> Copy mã nhúng chuẩn
                </button>
              </label>
            </div>
          )}

          {installTab === 'gtm' && (
            <div className="install-tab-panel">
              <p className="install-tab-desc">
                Tích hợp nhanh chóng qua Google Tag Manager mà không cần sửa code website:
              </p>
              <ol className="install-steps">
                <li>Mở <b>Google Tag Manager</b> và chọn Container của website.</li>
                <li>Vào mục <b>Thẻ (Tags)</b> &rarr; Nhấn <b>Mới (New)</b> &rarr; Loại thẻ: <b>HTML tùy chỉnh (Custom HTML)</b>.</li>
                <li>Dán đoạn mã nhúng Async ở Tab 1 vào ô HTML.</li>
                <li>Tại mục <b>Kích hoạt (Triggering)</b> &rarr; Chọn <b>Initialization - All Pages</b> (hoặc All Pages).</li>
                <li>Nhấn <b>Lưu (Save)</b> và <b>Xuất bản (Submit / Publish)</b> Container GTM.</li>
              </ol>
              <button
                type="button"
                className="button-secondary button-full"
                onClick={() => void copy(install.snippet, 'Đã copy mã nhúng cho GTM.')}
              >
                <Icon name="content_copy" /> Copy mã nhúng cho GTM
              </button>
            </div>
          )}

          {installTab === 'cms' && (
            <div className="install-tab-panel">
              <p className="install-tab-desc">
                Hướng dẫn tích hợp cho WordPress, Shopify, Haravan hoặc các nền tảng CMS:
              </p>
              <ol className="install-steps">
                <li><b>WordPress</b>: Cài plugin <i>Insert Headers and Footers</i> (hoặc <i>WPCode</i>), dán mã nhúng vào mục <b>Scripts in Footer</b>.</li>
                <li><b>Shopify / Haravan</b>: Vào <i>Online Store</i> &rarr; <i>Themes</i> &rarr; <i>Edit code</i> &rarr; Mở file <code>theme.liquid</code> &rarr; Dán trước thẻ <code>&lt;/body&gt;</code>.</li>
                <li><b>Next.js / Nuxt / SPA</b>: Thêm qua component <code>&lt;Script strategy="afterInteractive"&gt;</code> hoặc chèn trực tiếp vào template HTML gốc.</li>
              </ol>
              <button
                type="button"
                className="button-secondary button-full"
                onClick={() => void copy(install.snippet, 'Đã copy mã nhúng.')}
              >
                <Icon name="content_copy" /> Copy mã nhúng
              </button>
            </div>
          )}

          <div className="install-verify-card">
            <div className="install-verify-header">
              <div>
                <strong>Kiểm tra kết nối Widget</strong>
                <p className="muted" style={{margin: '3px 0 0', fontSize: '11.5px'}}>
                  Kiểm tra xem widget đã nhận được lượt truy cập (visitor session) từ website hay chưa.
                </p>
              </div>
              <button
                type="button"
                className="button-secondary"
                disabled={verifying}
                onClick={() => void handleVerify(install.id)}
              >
                <Icon name={verifying ? 'sync' : 'sensors'} className={verifying ? 'spin-icon' : ''} />
                {verifying ? 'Đang kiểm tra…' : 'Kiểm tra ngay'}
              </button>
            </div>

            {verifyResult && (
              <div className={`install-verify-badge verify-${verifyResult.status}`}>
                <Icon
                  name={
                    verifyResult.status === 'connected'
                      ? 'check_circle'
                      : verifyResult.status === 'disabled'
                        ? 'block'
                        : 'hourglass_top'
                  }
                />
                <div>
                  <b>
                    {verifyResult.status === 'connected'
                      ? 'Đã kết nối thành công!'
                      : verifyResult.status === 'disabled'
                        ? 'Kênh chat đang tắt'
                        : 'Chưa có phiên kết nối từ website'}
                  </b>
                  <span>
                    {verifyResult.status === 'connected'
                      ? `Đã ghi nhận ${verifyResult.visitorCount} phiên hội thoại từ ${verifyResult.origin}. Widget hoạt động tốt.`
                      : verifyResult.status === 'disabled'
                        ? 'Vui lòng nhấn "Bật kênh" trên màn hình Kênh kết nối & Tích hợp để kích hoạt widget.'
                        : `Chưa phát hiện phiên chat nào từ ${verifyResult.origin}. Vui lòng mở website của bạn và bấm thử nút chat.`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </ModalShell>
    )}

    {modal === 'settings' && settings && (
      <ModalShell title={`Cấu hình: ${settings.name}`} onClose={closeModal} wide>
        <ChannelConfiguration key={settings.id} initial={settings} onClose={closeModal} onNotify={notify} onSaved={() => void load(true)} />
      </ModalShell>
    )}
  </main>
  );
}
