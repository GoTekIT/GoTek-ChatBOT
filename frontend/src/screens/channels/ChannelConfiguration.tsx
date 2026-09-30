import {useEffect, useState, type FormEvent} from 'react';
import {api} from '@/api/api';
import {WidgetPreview} from './WidgetPreview';
import './channels-config.css';
import './channels-config-overrides.css';
import './channels-config-hours.css';
import './channels-config-prechat.css';

const weekdays = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const fieldLabels: Record<string, string> = {emailAddress: 'Email', fullName: 'Họ và tên', phoneNumber: 'Số điện thoại'};
const fieldIcons: Record<string, string> = {emailAddress: 'mail', fullName: 'person', phoneNumber: 'phone'};
type Step = 1 | 2 | 3 | 4;

function normalize(initial: any) {
  const hours = initial.business_hours || {enabled: false, timezone: 'Asia/Ho_Chi_Minh', days: []};
  const prechat = initial.prechat || {enabled: false, message: '', fields: []};
  const existingFields = Array.isArray(prechat.fields) && prechat.fields.length
    ? prechat.fields
    : ['emailAddress', 'fullName', 'phoneNumber'].map((key) => ({key, required: false, label: fieldLabels[key], placeholder: ''}));
  return {
    ...initial,
    business_hours: {enabled: Boolean(hours.enabled), timezone: hours.timezone || 'Asia/Ho_Chi_Minh', days: weekdays.map((_, day) => hours.days?.find((item: any) => item.day === day) || {day, enabled: false, fullDay: false, start: '09:00', end: '17:00'})},
    prechat: {enabled: Boolean(prechat.enabled), message: prechat.message || '', fields: existingFields.map((field: any) => ({...field, label: field.label || fieldLabels[field.key] || 'Thông tin mới', placeholder: field.placeholder || '', enabled: true}))},
    assignment_enabled: Boolean(initial.assignment_enabled), assignment_limit: initial.assignment_limit ?? null,
    widget_title: initial.widget_title || 'Chat với chúng tôi', widget_position: initial.widget_position || 'right', widget_mode: initial.widget_mode || 'standard'
  };
}

function Icon({name}: {name: string}) { return <span className="material-symbols-outlined config-icon" aria-hidden="true">{name}</span>; }

function StepGuide({active}: {active: Step}) {
  const steps = [['Người xử lý', 'Chọn ai nhận và trả lời tin nhắn.', 'group'], ['Giờ hoạt động', 'Cài thời gian doanh nghiệp hỗ trợ.', 'schedule'], ['Thông tin khách', 'Chọn thông tin cần hỏi trước chat.', 'person_search'], ['Giao diện chat', 'Tùy chỉnh phần khách nhìn thấy.', 'palette']];
  return <div className="config-step-guide"><div className="config-guide-title"><strong>Thiết lập channel · Bước {active}/4</strong><span>Điền xong một bước rồi bấm Tiếp tục để sang bước kế tiếp.</span></div><div className="config-step-grid">{steps.map(([title, description, icon], index) => <div className={`config-step-card ${active === index + 1 ? 'active' : ''} ${active > index + 1 ? 'done' : ''}`} aria-current={active === index + 1 ? 'step' : undefined} key={title}><b>{index + 1}</b><Icon name={icon} /><div><strong>{title}</strong><p>{description}</p></div></div>)}</div></div>;
}

function AgentsStep({members, agents, setAgents, assignmentEnabled, assignmentLimit, setValue, saving, message, onSave}: any) {
  return <section className="config-section"><div className="config-section-heading"><div><span className="config-eyebrow">BƯỚC 1 · NGƯỜI XỬ LÝ</span><h3>Cộng tác viên và phân công</h3><p>Chọn thành viên thuộc doanh nghiệp hiện tại có thể nhận hội thoại mới.</p></div><span className="config-count">{agents.length} người</span></div><div className="agent-grid">{members.map((member: any) => <label className={`agent-option ${agents.includes(member.id) ? 'selected' : ''}`} key={member.id}><input type="checkbox" checked={agents.includes(member.id)} onChange={(event) => setAgents(event.target.checked ? [...agents, member.id] : agents.filter((id: string) => id !== member.id))} /><span className="agent-avatar">{(member.full_name || member.email).slice(0, 1).toUpperCase()}</span><span className="agent-info"><strong>{member.full_name}</strong><small>{member.role} · {member.email}</small></span><span className="agent-check"><Icon name="check" /></span></label>)}</div>{!members.length && <p className="empty">Chưa có thành viên đang hoạt động.</p>}<div className="section-action-row"><button type="button" className="button-secondary" disabled={saving} onClick={() => void onSave()}><Icon name="save" />{saving ? 'Đang lưu…' : 'Lưu cộng tác viên'}</button>{message && <span className="inline-success"><Icon name="check_circle" />{message}</span>}</div><div className="assignment-setting"><div className="setting-icon"><Icon name="group_work" /></div><div><strong>Phân công tự động</strong><p>Phân phối hội thoại mới cho agent đang có ít hội thoại mở hơn.</p></div><label className="switch-row"><input type="checkbox" checked={assignmentEnabled} onChange={(event) => setValue((current: any) => ({...current, assignment_enabled: event.target.checked}))} /><span className="switch-ui" /><strong>{assignmentEnabled ? 'Đang bật' : 'Đang tắt'}</strong></label><input className="limit-input" type="number" min="1" max="10000" disabled={!assignmentEnabled} value={assignmentLimit ?? ''} onChange={(event) => setValue((current: any) => ({...current, assignment_limit: event.target.value === '' ? null : Number(event.target.value)}))} /></div></section>;
}

function HoursStep({value, setValue}: any) {
  const updateHours = (patch: any) => setValue((current: any) => ({...current, business_hours: {...current.business_hours, ...patch}}));
  const updateDay = (index: number, patch: any) => updateHours({days: value.business_hours.days.map((day: any, current: number) => current === index ? {...day, ...patch} : day)});
  return <section className="config-section"><div className="config-section-heading"><div><span className="config-eyebrow">BƯỚC 2 · THỜI GIAN</span><h3>Giờ làm việc</h3><p>Thiết lập thời gian doanh nghiệp sẵn sàng tiếp nhận hỗ trợ.</p></div><label className="switch-row"><input type="checkbox" checked={value.business_hours.enabled} onChange={(event) => updateHours({enabled: event.target.checked})} /><span className="switch-ui" /><strong>{value.business_hours.enabled ? 'Đang bật' : 'Đang tắt'}</strong></label></div><div className="config-inline-field"><label className="field"><span>Múi giờ</span><select value={value.business_hours.timezone} onChange={(event) => updateHours({timezone: event.target.value})}><option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (GMT+7)</option><option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option><option value="UTC">UTC</option></select></label></div><div className={`hours-grid ${!value.business_hours.enabled ? 'is-disabled' : ''}`}>{value.business_hours.days.map((day: any, index: number) => <div className={`day-card ${day.enabled ? 'day-active' : ''}`} key={day.day}><div className="day-card-header"><strong>{weekdays[day.day]}</strong><input type="checkbox" aria-label={`Bật ${weekdays[day.day]}`} disabled={!value.business_hours.enabled} checked={day.enabled} onChange={(event) => updateDay(index, {enabled: event.target.checked})} /></div><label className="day-full"><input type="checkbox" disabled={!value.business_hours.enabled || !day.enabled} checked={day.fullDay} onChange={(event) => updateDay(index, {fullDay: event.target.checked})} /> Cả ngày</label>{day.fullDay ? <span className="day-open">24 giờ</span> : <div className="day-time-row"><label><small>Bắt đầu</small><input type="time" disabled={!value.business_hours.enabled || !day.enabled} value={day.start} onChange={(event) => updateDay(index, {start: event.target.value})} /></label><label><small>Kết thúc</small><input type="time" disabled={!value.business_hours.enabled || !day.enabled} value={day.end} onChange={(event) => updateDay(index, {end: event.target.value})} /></label></div>}</div>)}</div></section>;
}

function PrechatStep({value, setValue, updateField, applyTemplate, addField, removeField}: any) {
  return <section className="config-section"><div className="config-section-heading"><div><span className="config-eyebrow">BƯỚC 3 · THÔNG TIN KHÁCH</span><h3>Biểu mẫu trước khi chat</h3><p>Chọn thông tin khách cần điền trước khi bắt đầu trò chuyện với doanh nghiệp.</p></div><label className="switch-row"><input type="checkbox" checked={value.prechat.enabled} onChange={(event) => setValue((current: any) => ({...current, prechat: {...current.prechat, enabled: event.target.checked}}))} /><span className="switch-ui" /><strong>{value.prechat.enabled ? 'Đang dùng form' : 'Không dùng form'}</strong></label></div><div className="form-template-block"><div><strong>Mẫu form nhanh</strong><small>Chọn mẫu gần nhất rồi chỉnh lại theo nhu cầu.</small></div><div className="form-template-actions"><button type="button" className="form-template-button" onClick={() => applyTemplate('basic')}><Icon name="person" /><span><strong>Cơ bản</strong><small>Họ tên</small></span></button><button type="button" className="form-template-button" onClick={() => applyTemplate('support')}><Icon name="support_agent" /><span><strong>Hỗ trợ</strong><small>Họ tên + email</small></span></button><button type="button" className="form-template-button" onClick={() => applyTemplate('full')}><Icon name="fact_check" /><span><strong>Đầy đủ</strong><small>Đủ 3 thông tin</small></span></button></div></div><div className="prechat-message"><label className="field"><span>Lời nhắn hiển thị cho khách</span><textarea maxLength={500} disabled={!value.prechat.enabled} value={value.prechat.message} onChange={(event) => setValue((current: any) => ({...current, prechat: {...current.prechat, message: event.target.value}}))} placeholder="Ví dụ: Cho chúng tôi biết cách liên hệ với bạn nhé." /></label></div><div className={`prechat-fields ${!value.prechat.enabled ? 'is-disabled' : ''}`}><div className="prechat-fields-toolbar"><p className="fields-helper"><Icon name="info" /> Mỗi thông tin nằm trên một dòng. Bạn có thể đổi nhãn, gợi ý nhập, chọn bắt buộc hoặc xoá trường.</p><button type="button" className="add-field-button" disabled={!value.prechat.enabled} onClick={addField}><Icon name="add" />Thêm thông tin</button></div>{value.prechat.fields.map((field: any, index: number) => <div className="prechat-field-card selected" key={field.key}><div className="prechat-field-top"><div className="prechat-field-title"><span><Icon name={fieldIcons[field.key] || 'text_fields'} /></span><strong>{field.label || fieldLabels[field.key] || 'Thông tin mới'}</strong></div><div className="prechat-field-actions"><span className="field-visible-badge">Hiển thị</span><button type="button" className="field-delete-button" disabled={!value.prechat.enabled} aria-label={`Xóa ${field.label || 'trường thông tin'}`} title="Xóa trường này" onClick={() => removeField(index)}><Icon name="delete" /></button></div></div><div className="prechat-field-options"><label className="field"><span>Nhãn hiển thị</span><input disabled={!value.prechat.enabled} maxLength={120} value={field.label} onChange={(event) => updateField(index, {label: event.target.value})} placeholder="Ví dụ: Mã đơn hàng" /></label><label className="field"><span>Gợi ý nhập</span><input disabled={!value.prechat.enabled} maxLength={160} value={field.placeholder} onChange={(event) => updateField(index, {placeholder: event.target.value})} placeholder="Ví dụ: Nhập mã đơn hàng" /></label><label className="required-check"><input type="checkbox" disabled={!value.prechat.enabled} checked={field.required} onChange={(event) => updateField(index, {required: event.target.checked})} /> Bắt buộc</label></div></div>)}</div></section>;
}

function WidgetStep({value, setValue, name}: any) {
  return <section className="config-section"><div className="config-section-heading"><div><span className="config-eyebrow">BƯỚC 4 · GIAO DIỆN</span><h3>Khung chat của khách</h3><p>Tùy chỉnh tiêu đề, vị trí và kiểu hiển thị khách nhìn thấy trên website.</p></div></div><div className="widget-settings-grid"><label className="field"><span>Tiêu đề hiển thị</span><input required maxLength={80} value={value.widget_title} onChange={(event) => setValue((current: any) => ({...current, widget_title: event.target.value}))} /></label><label className="field"><span>Vị trí</span><select value={value.widget_position} onChange={(event) => setValue((current: any) => ({...current, widget_position: event.target.value}))}><option value="left">Bên trái</option><option value="right">Bên phải</option></select></label><label className="field"><span>Kích thước</span><select value={value.widget_mode} onChange={(event) => setValue((current: any) => ({...current, widget_mode: event.target.value}))}><option value="standard">Tiêu chuẩn</option><option value="expanded">Mở rộng</option></select></label></div><WidgetPreview title={value.widget_title} position={value.widget_position} mode={value.widget_mode} name={name}/></section>;
}

export function ChannelConfiguration({initial, onClose, onNotify}: {initial: any; onClose: () => void; onNotify?: (message: string, kind?: 'success' | 'error') => void}) {
  const [value, setValue] = useState(() => normalize(initial));
  const [members, setMembers] = useState<any[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [savingAgents, setSavingAgents] = useState(false);
  const [agentMessage, setAgentMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { Promise.all([api('/members'), api(`/channels/${initial.id}/agents`)]).then(([all, current]) => { setMembers(all.filter((member: any) => member.active)); setAgents(current.map((member: any) => member.id)); }).catch((e) => setError((e as Error).message)); }, [initial.id]);

  async function saveAgents(): Promise<boolean> {
    if (!agents.length) { setError('Chọn ít nhất một cộng tác viên.'); return false; }
    setSavingAgents(true); setError(''); setAgentMessage('');
    try { await api(`/channels/${value.id}/agents`, 'PUT', {agents}); const current = await api(`/channels/${value.id}/agents`); setAgents(current.map((member: any) => member.id)); setAgentMessage('Đã lưu cộng tác viên.'); onNotify?.('Đã lưu cộng tác viên.'); return true; }
    catch (e) { const message = (e as Error).message; setError(message); onNotify?.(message, 'error'); return false; } finally { setSavingAgents(false); }
  }

  async function nextStep() {
    setError('');
    if (step === 1 && !(await saveAgents())) return;
    setStep((current) => Math.min(4, current + 1) as Step);
  }

  function applyTemplate(template: 'basic' | 'support' | 'full') {
    const templates = {basic: {message: 'Vui lòng để lại thông tin để chúng tôi hỗ trợ bạn tốt hơn.', required: {emailAddress: false, fullName: true, phoneNumber: false}}, support: {message: 'Cho chúng tôi xin thông tin để nhân viên hỗ trợ nhanh hơn nhé.', required: {emailAddress: true, fullName: true, phoneNumber: false}}, full: {message: 'Vui lòng điền đầy đủ thông tin trước khi bắt đầu trò chuyện.', required: {emailAddress: true, fullName: true, phoneNumber: true}}}[template];
    setValue((current: any) => ({...current, prechat: {...current.prechat, enabled: true, message: templates.message, fields: current.prechat.fields.map((field: any) => ({...field, enabled: true, required: templates.required[field.key as keyof typeof templates.required] ?? field.required}))}}));
    onNotify?.('Đã áp dụng mẫu form. Bạn có thể chỉnh lại trước khi lưu.');
  }

  function updateField(index: number, patch: any) { setValue((current: any) => ({...current, prechat: {...current.prechat, fields: current.prechat.fields.map((field: any, currentIndex: number) => currentIndex === index ? {...field, ...patch, enabled: true} : field)}})); }

  function addField() {
    const key = `custom_${crypto.randomUUID().replaceAll('-', '')}`;
    setValue((current: any) => ({...current, prechat: {...current.prechat, fields: [...current.prechat.fields, {key, enabled: true, required: false, label: 'Thông tin mới', placeholder: 'Nhập thông tin'}]}}));
    onNotify?.('Đã thêm trường thông tin mới. Bạn có thể đổi nhãn và gợi ý nhập.');
  }

  function removeField(index: number) {
    if (value.prechat.fields.length <= 1) { const message = 'Form cần giữ lại ít nhất một trường thông tin.'; setError(message); onNotify?.(message, 'error'); return; }
    const removed = value.prechat.fields[index];
    setValue((current: any) => ({...current, prechat: {...current.prechat, fields: current.prechat.fields.filter((_: any, currentIndex: number) => currentIndex !== index)}}));
    onNotify?.(`Đã xoá trường ${removed?.label || 'thông tin'}.`);
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const prechat = {...value.prechat, fields: value.prechat.fields.map((field: any) => ({...field, enabled: true}))}; await api(`/channels/${value.id}/settings`, 'PATCH', {assignmentEnabled: value.assignment_enabled, assignmentLimit: value.assignment_limit, businessHours: value.business_hours, prechat, widgetTitle: value.widget_title, widgetPosition: value.widget_position, widgetMode: value.widget_mode}); const saved = await api(`/channels/${value.id}/settings`); setValue((current: any) => ({...current, ...saved})); onNotify?.('Đã lưu toàn bộ cấu hình channel.'); }
    catch (e) { const message = (e as Error).message; setError(message); onNotify?.(message, 'error'); } finally { setBusy(false); }
  }

  return <section className="channel-config-form"><div className="config-intro"><div className="config-intro-icon"><Icon name="tune" /></div><div><h3>Tùy chỉnh kênh chat</h3><p>Đi theo từng bước. Điền xong bước hiện tại rồi bấm Tiếp tục.</p></div></div><StepGuide active={step}/>{error && <div role="alert" className="notice error config-notice">{error}</div>}<form onSubmit={save}>{step === 1 && <AgentsStep members={members} agents={agents} setAgents={setAgents} assignmentEnabled={value.assignment_enabled} assignmentLimit={value.assignment_limit} setValue={setValue} saving={savingAgents} message={agentMessage} onSave={saveAgents}/>} {step === 2 && <HoursStep value={value} setValue={setValue}/>} {step === 3 && <PrechatStep value={value} setValue={setValue} updateField={updateField} applyTemplate={applyTemplate} addField={addField} removeField={removeField}/>} {step === 4 && <WidgetStep value={value} setValue={setValue} name={initial.name}/>}<footer className="config-footer wizard-footer"><span><Icon name="verified_user" />Bước {step}/4 · Có thể quay lại chỉnh sửa trước khi lưu.</span><div>{step > 1 && <button type="button" className="button-secondary" onClick={() => {setError(''); setStep((current) => Math.max(1, current - 1) as Step);}}><Icon name="arrow_back" />Quay lại</button>}{step < 4 ? <button type="button" className="channel-toolbar-button channel-toolbar-primary" onClick={() => void nextStep()} disabled={savingAgents}>{savingAgents ? 'Đang lưu bước 1…' : 'Tiếp tục'}<Icon name="arrow_forward" /></button> : <button type="submit" className="channel-toolbar-button channel-toolbar-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu tất cả thay đổi'}<Icon name="check" /></button>}</div></footer></form></section>;
}
