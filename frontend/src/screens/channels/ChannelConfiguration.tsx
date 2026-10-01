import {useEffect, useState, type FormEvent} from 'react';
import {api} from '@/api/api';
import {WidgetPreview} from './WidgetPreview';
import './channels-ui.css';
import './channels-config.css';
import './channels-config-overrides.css';
import './channels-config-hours.css';
import './channels-config-prechat.css';

const weekdays = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const fieldLabels: Record<string, string> = {emailAddress: 'Email', fullName: 'Họ và tên', phoneNumber: 'Số điện thoại'};
export type Step = 1 | 2 | 3 | 4 | 5;

export function normalize(initial: any) {
  const hours = initial.business_hours || {enabled: false, timezone: 'Asia/Ho_Chi_Minh', days: []};
  const prechat = initial.prechat || {enabled: false, message: '', fields: []};
  const existingFields = Array.isArray(prechat.fields) && prechat.fields.length
    ? prechat.fields
    : ['emailAddress', 'fullName', 'phoneNumber'].map((key) => ({
        key,
        required: false,
        label: fieldLabels[key] || key,
        placeholder: ''
      }));

  return {
    ...initial,
    name: initial.name || '',
    origin: initial.origin || '',
    greeting: initial.greeting || 'Xin chào! Chúng tôi có thể giúp gì cho bạn?',
    widget_title: initial.widget_title || initial.name || 'Chat với chúng tôi',
    widget_position: initial.widget_position || 'right',
    widget_mode: initial.widget_mode || 'standard',
    color: initial.color || '#0057E1',
    business_hours: {
      enabled: Boolean(hours.enabled),
      timezone: hours.timezone || 'Asia/Ho_Chi_Minh',
      days: weekdays.map((_, day) => hours.days?.find((item: any) => item.day === day) || {
        day,
        enabled: false,
        fullDay: false,
        start: '09:00',
        end: '17:00'
      })
    },
    prechat: {
      enabled: Boolean(prechat.enabled),
      message: prechat.message || '',
      fields: existingFields.map((field: any) => ({
        ...field,
        label: field.label || fieldLabels[field.key] || 'Thông tin mới',
        placeholder: field.placeholder || '',
        enabled: true
      }))
    },
    assignment_enabled: Boolean(initial.assignment_enabled),
    assignment_limit: initial.assignment_limit ?? null,
    agents: Array.isArray(initial.agents) ? initial.agents : []
  };
}

function Icon({name, className}: {name: string; className?: string}) {
  return <span className={`material-symbols-outlined config-icon ${className || ''}`} aria-hidden="true">{name}</span>;
}

export function HoursStep({value, setValue, eyebrow = 'BƯỚC 3 · GIỜ HOẠT ĐỘNG'}: any) {
  const updateHours = (patch: any) =>
    setValue((current: any) => ({
      ...current,
      business_hours: {...current.business_hours, ...patch}
    }));

  const updateDay = (dayNum: number, patch: any) =>
    updateHours({
      days: value.business_hours.days.map((day: any) => (day.day === dayNum ? {...day, ...patch} : day))
    });

  const displayDays = [1, 2, 3, 4, 5, 6, 0];

  function applyPreset(preset: 'standard' | 'fullweek' | 'all247') {
    if (preset === 'standard') {
      const newDays = value.business_hours.days.map((day: any) => ({
        ...day,
        enabled: day.day >= 1 && day.day <= 5,
        fullDay: false,
        start: '08:30',
        end: '17:30'
      }));
      updateHours({enabled: true, days: newDays});
    } else if (preset === 'fullweek') {
      const newDays = value.business_hours.days.map((day: any) => ({
        ...day,
        enabled: day.day >= 1 && day.day <= 6,
        fullDay: false,
        start: '08:00',
        end: '17:30'
      }));
      updateHours({enabled: true, days: newDays});
    } else if (preset === 'all247') {
      const newDays = value.business_hours.days.map((day: any) => ({
        ...day,
        enabled: true,
        fullDay: true,
        start: '00:00',
        end: '23:59'
      }));
      updateHours({enabled: true, days: newDays});
    }
  }

  return (
    <section className="config-section" style={{paddingTop: 14}}>
      <div className="config-section-heading">
        <div>
          <span className="config-eyebrow">{eyebrow}</span>
          <h3>Giờ làm việc</h3>
          <p>Thiết lập khung giờ tiếp nhận khách hàng trong tuần.</p>
        </div>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={value.business_hours.enabled}
            onChange={(event) => updateHours({enabled: event.target.checked})}
          />
          <span className="switch-ui" />
          <strong>{value.business_hours.enabled ? 'Đang bật' : 'Đang tắt'}</strong>
        </label>
      </div>

      <div className="hours-subbar">
        <div className="hours-tz-picker">
          <Icon name="schedule" />
          <span>Múi giờ:</span>
          <select
            value={value.business_hours.timezone}
            onChange={(event) => updateHours({timezone: event.target.value})}
            disabled={!value.business_hours.enabled}
          >
            <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (GMT+7)</option>
            <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
        <div className="hours-presets">
          <span className="hours-presets-label">Mẫu nhanh:</span>
          <button
            type="button"
            className="preset-chip"
            disabled={!value.business_hours.enabled}
            onClick={() => applyPreset('standard')}
          >
            T2–T6 (08:30–17:30)
          </button>
          <button
            type="button"
            className="preset-chip"
            disabled={!value.business_hours.enabled}
            onClick={() => applyPreset('fullweek')}
          >
            T2–T7 (08:00–17:30)
          </button>
          <button
            type="button"
            className="preset-chip"
            disabled={!value.business_hours.enabled}
            onClick={() => applyPreset('all247')}
          >
            24/7 Cả tuần
          </button>
        </div>
      </div>

      <div className={`hours-list-container hours-grid ${!value.business_hours.enabled ? 'is-disabled' : ''}`}>
        {displayDays.map((dayNum) => {
          const day = value.business_hours.days.find((d: any) => d.day === dayNum) || {
            day: dayNum,
            enabled: false,
            fullDay: false,
            start: '09:00',
            end: '17:00'
          };
          return (
            <div
              className={`hours-day-row day-card ${day.enabled ? 'is-active day-active' : 'is-off'}`}
              key={day.day}
            >
              <div className="day-left day-card-header">
                <label className="day-toggle" title={`Bật/tắt ${weekdays[day.day]}`}>
                  <input
                    type="checkbox"
                    aria-label={`Bật ${weekdays[day.day]}`}
                    disabled={!value.business_hours.enabled}
                    checked={day.enabled}
                    onChange={(event) => updateDay(day.day, {enabled: event.target.checked})}
                  />
                  <span className="day-toggle-slider" />
                </label>
                <strong className="day-name">{weekdays[day.day]}</strong>
              </div>

              <div className="day-right">
                {day.enabled ? (
                  <>
                    {day.fullDay ? (
                      <span className="day-open-badge day-open">
                        <Icon name="check_circle" /> Mở cửa cả ngày (24 giờ)
                      </span>
                    ) : (
                      <div className="day-time-inputs day-time-row">
                        <input
                          type="time"
                          disabled={!value.business_hours.enabled}
                          value={day.start}
                          onChange={(event) => updateDay(day.day, {start: event.target.value})}
                        />
                        <span className="day-time-sep">–</span>
                        <input
                          type="time"
                          disabled={!value.business_hours.enabled}
                          value={day.end}
                          onChange={(event) => updateDay(day.day, {end: event.target.value})}
                        />
                      </div>
                    )}
                    <label className="day-full-checkbox day-full">
                      <input
                        type="checkbox"
                        disabled={!value.business_hours.enabled}
                        checked={day.fullDay}
                        onChange={(event) => updateDay(day.day, {fullDay: event.target.checked})}
                      />
                      <span>Cả ngày</span>
                    </label>
                  </>
                ) : (
                  <span className="day-closed-text day-closed">Nghỉ (Đóng cửa)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!value.business_hours.enabled && (
        <div className="hours-disabled-hint">
          <Icon name="info" />
          <span>Giờ làm việc đang tắt. Khung chat tiếp nhận tin nhắn 24/7 mọi lúc.</span>
        </div>
      )}
    </section>
  );
}

export function PrechatStep({
  value,
  setValue,
  updateField,
  addField,
  removeField,
  eyebrow = 'BƯỚC 4 · THÔNG TIN KHÁCH'
}: any) {
  return (
    <section className="config-section" style={{paddingTop: 14}}>
      <div className="config-section-heading">
        <div>
          <span className="config-eyebrow">{eyebrow}</span>
          <h3>Biểu mẫu trước khi chat</h3>
          <p>Chọn thông tin khách cần điền trước khi bắt đầu trò chuyện với doanh nghiệp.</p>
        </div>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={value.prechat.enabled}
            onChange={(event) =>
              setValue((current: any) => ({
                ...current,
                prechat: {...current.prechat, enabled: event.target.checked}
              }))
            }
          />
          <span className="switch-ui" />
          <strong>{value.prechat.enabled ? 'Đang dùng form' : 'Không dùng form'}</strong>
        </label>
      </div>

      <div className="prechat-message">
        <label className="field">
          <span>Lời nhắn hiển thị cho khách</span>
          <textarea
            maxLength={500}
            disabled={!value.prechat.enabled}
            value={value.prechat.message}
            onChange={(event) =>
              setValue((current: any) => ({
                ...current,
                prechat: {...current.prechat, message: event.target.value}
              }))
            }
            placeholder="Ví dụ: Cho chúng tôi biết cách liên hệ với bạn nhé."
          />
        </label>
      </div>

      <div className={`prechat-fields ${!value.prechat.enabled ? 'is-disabled' : ''}`}>
        <div className="prechat-fields-toolbar">
          <p className="fields-helper">
            <Icon name="info" /> Mỗi thông tin nằm trên một dòng. Bạn có thể đổi nhãn, gợi ý nhập, chọn bắt buộc hoặc xoá trường.
          </p>
          <button
            type="button"
            className="add-field-button"
            disabled={!value.prechat.enabled}
            onClick={addField}
          >
            <Icon name="add" />
            Thêm thông tin
          </button>
        </div>

        {value.prechat.fields.map((field: any, index: number) => (
          <div className="prechat-field-card selected" key={field.key}>
            <div className="prechat-field-top">
              <label className="required-check">
                <input
                  type="checkbox"
                  disabled={!value.prechat.enabled}
                  checked={field.required}
                  onChange={(event) => updateField(index, {required: event.target.checked})}
                />{' '}
                Bắt buộc
              </label>
              <button
                type="button"
                className="field-delete-button"
                disabled={!value.prechat.enabled}
                aria-label={`Xóa ${field.label || 'trường thông tin'}`}
                title="Xóa trường này"
                onClick={() => removeField(index)}
              >
                <Icon name="delete" />
              </button>
            </div>

            <div className="prechat-field-options">
              <label className="field">
                <span>Nhãn hiển thị</span>
                <input
                  disabled={!value.prechat.enabled}
                  maxLength={120}
                  value={field.label}
                  onChange={(event) => updateField(index, {label: event.target.value})}
                  placeholder="Ví dụ: Mã đơn hàng"
                />
              </label>
              <label className="field">
                <span>Gợi ý nhập</span>
                <input
                  disabled={!value.prechat.enabled}
                  maxLength={160}
                  value={field.placeholder}
                  onChange={(event) => updateField(index, {placeholder: event.target.value})}
                  placeholder="Ví dụ: Nhập mã đơn hàng"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ChannelConfiguration({
  initial,
  onClose,
  onNotify,
  onSaved
}: {
  initial: any;
  onClose: () => void;
  onNotify?: (message: string, kind?: 'success' | 'error') => void;
  onSaved?: () => void;
}) {
  const [value, setValue] = useState(() => normalize(initial));
  const [members, setMembers] = useState<any[]>([]);
  const [agents, setAgents] = useState<string[]>(() =>
    Array.isArray(initial.agents) ? initial.agents : []
  );
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([api('/members'), api(`/channels/${initial.id}/agents`)])
      .then(([all, current]) => {
        setMembers(all.filter((member: any) => member.active));
        if (current && Array.isArray(current)) {
          setAgents(current.map((member: any) => member.id));
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [initial.id]);

  function updatePrechatField(index: number, patch: any) {
    setValue((current: any) => ({
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
    setValue((current: any) => ({
      ...current,
      prechat: {
        ...current.prechat,
        fields: [
          ...current.prechat.fields,
          {key, enabled: true, required: false, label: 'Thông tin mới', placeholder: 'Nhập thông tin'}
        ]
      }
    }));
    onNotify?.('Đã thêm trường thông tin mới. Bạn có thể đổi nhãn và gợi ý nhập.');
  }

  function removePrechatField(index: number) {
    if (value.prechat.fields.length <= 1) {
      const message = 'Form cần giữ lại ít nhất một trường thông tin.';
      setError(message);
      onNotify?.(message, 'error');
      return;
    }
    const removed = value.prechat.fields[index];
    setValue((current: any) => ({
      ...current,
      prechat: {
        ...current.prechat,
        fields: current.prechat.fields.filter((_: any, currentIndex: number) => currentIndex !== index)
      }
    }));
    onNotify?.(`Đã xoá trường ${removed?.label || 'thông tin'}.`);
  }

  function nextStep() {
    setError('');
    if (step === 1) {
      const trimmedName = (value.name || '').trim();
      if (!trimmedName || trimmedName.length < 2) {
        setError('Tên kênh phải có ít nhất 2 ký tự.');
        return;
      }
      const trimmedOrigin = (value.origin || '').trim();
      if (!trimmedOrigin) {
        setError('Vui lòng nhập website được phép nhúng widget (Origin).');
        return;
      }
      try {
        const u = new URL(trimmedOrigin);
        if (!['http:', 'https:'].includes(u.protocol)) {
          throw new Error();
        }
      } catch {
        setError('Địa chỉ website không hợp lệ. Vui lòng nhập đúng định dạng https://ten-mien-cua-ban.com');
        return;
      }
      if (!value.greeting?.trim()) {
        setError('Vui lòng nhập lời chào ban đầu.');
        return;
      }
    }
    setStep((current) => Math.min(5, current + 1) as Step);
  }

  async function handleSave() {
    setError('');

    // Validation for Step 1
    const trimmedName = (value.name || '').trim();
    if (!trimmedName || trimmedName.length < 2) {
      setStep(1);
      setError('Tên kênh phải có ít nhất 2 ký tự.');
      return;
    }

    const trimmedOrigin = (value.origin || '').trim();
    if (!trimmedOrigin) {
      setStep(1);
      setError('Vui lòng nhập website được phép nhúng widget (ví dụ: https://fahasa.com).');
      return;
    }
    try {
      const u = new URL(trimmedOrigin);
      if (!['http:', 'https:'].includes(u.protocol)) {
        throw new Error();
      }
    } catch {
      setStep(1);
      setError('Địa chỉ website không hợp lệ. Vui lòng nhập đúng định dạng https://ten-mien-cua-ban.com');
      return;
    }

    const trimmedGreeting = (value.greeting || '').trim();
    if (!trimmedGreeting) {
      setStep(1);
      setError('Vui lòng nhập lời chào ban đầu.');
      return;
    }

    // Validation for Step 5
    if (!agents.length) {
      setStep(5);
      setError('Vui lòng chọn ít nhất một cộng tác viên tiếp nhận hội thoại.');
      return;
    }

    setBusy(true);
    try {
      // Clean and sanitize prechat fields
      const prechat = {
        enabled: Boolean(value.prechat?.enabled),
        message: String(value.prechat?.message || ''),
        fields: (value.prechat?.fields || []).map((f: any) => ({
          key: String(f.key),
          enabled: Boolean(f.enabled),
          required: Boolean(f.required),
          label: String(f.label || 'Thông tin').trim() || 'Thông tin',
          placeholder: String(f.placeholder || '').trim()
        }))
      };

      // Clean and sanitize business hours
      const businessHours = {
        enabled: Boolean(value.business_hours?.enabled),
        timezone: value.business_hours?.timezone || 'Asia/Ho_Chi_Minh',
        days: (value.business_hours?.days || []).map((d: any) => ({
          day: Number(d.day),
          enabled: Boolean(d.enabled),
          fullDay: Boolean(d.fullDay),
          start: String(d.start || '09:00').slice(0, 5).padStart(5, '0'),
          end: String(d.end || '17:00').slice(0, 5).padStart(5, '0')
        }))
      };

      // Clean agents
      const validAgents = agents.filter((id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      );

      await api(`/channels/${value.id}/settings`, 'PATCH', {
        name: trimmedName,
        origin: trimmedOrigin,
        greeting: trimmedGreeting,
        color: /^#[0-9a-fA-F]{6}$/.test(value.color) ? value.color : '#0057E1',
        widgetTitle: (value.widget_title || trimmedName || 'Chat với chúng tôi').trim(),
        widgetPosition: value.widget_position === 'left' ? 'left' : 'right',
        widgetMode: value.widget_mode === 'expanded' ? 'expanded' : 'standard',
        businessHours,
        prechat,
        assignmentEnabled: Boolean(value.assignment_enabled),
        assignmentLimit: typeof value.assignment_limit === 'number' && value.assignment_limit > 0 ? Math.round(value.assignment_limit) : null,
        agents: validAgents
      });

      onNotify?.('Đã lưu toàn bộ cấu hình kênh thành công.');
      onSaved?.();
      onClose();
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      onNotify?.(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const steps: {title: string; num: Step}[] = [
    {title: 'Website kết nối', num: 1},
    {title: 'Giao diện widget', num: 2},
    {title: 'Giờ hoạt động', num: 3},
    {title: 'Thông tin khách', num: 4},
    {title: 'Người tiếp nhận', num: 5}
  ];

  return (
    <section className="channel-config-form" style={{padding: '0 24px 20px'}}>
      <div className="config-intro">
        <span className="material-symbols-outlined config-intro-icon-mini">tune</span>
        <strong>Cấu hình kênh: {value.name || initial.name}</strong>
        <span className="config-intro-sep">/</span>
        <span>Chỉnh sửa website, giao diện, giờ hoạt động, form thông tin khách và người tiếp nhận trong 5 bước</span>
      </div>

      <nav className="config-stepper" aria-label="Các bước cấu hình">
        {steps.map((s, index) => {
          const isCurrent = step === s.num;
          const isCompleted = step > s.num;
          return (
            <div
              key={s.title}
              className={`stepper-item ${isCurrent ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
              style={{cursor: 'pointer'}}
              onClick={() => {
                setError('');
                setStep(s.num);
              }}
              title={`Chuyển đến ${s.title}`}
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

      {error && <div role="alert" className="notice error config-notice">{error}</div>}

      <form onSubmit={(e) => { e.preventDefault(); }}>
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
                    value={value.name}
                    onChange={(e) => setValue({...value, name: e.target.value})}
                    placeholder="Ví dụ: Website Fahasa"
                  />
                  <small>Tên nhận diện kênh hỗ trợ trong không gian làm việc của bạn.</small>
                </label>

                <label className="field">
                  <span>Website được phép nhúng khung chat (Origin) <b style={{color: '#e11d48'}}>*</b></span>
                  <input
                    required
                    type="url"
                    value={value.origin}
                    onChange={(e) => setValue({...value, origin: e.target.value})}
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
                    value={value.greeting}
                    onChange={(e) => setValue({...value, greeting: e.target.value})}
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
                      value={value.widget_title}
                      onChange={(e) => setValue({...value, widget_title: e.target.value})}
                      placeholder="Ví dụ: Chat với chúng tôi"
                    />
                  </label>

                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
                    <label className="field">
                      <span>Vị trí</span>
                      <select
                        value={value.widget_position}
                        onChange={(e) => setValue({...value, widget_position: e.target.value})}
                      >
                        <option value="right">Bên phải</option>
                        <option value="left">Bên trái</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Kích thước</span>
                      <select
                        value={value.widget_mode}
                        onChange={(e) => setValue({...value, widget_mode: e.target.value})}
                      >
                        <option value="standard">Tiêu chuẩn</option>
                        <option value="expanded">Mở rộng</option>
                      </select>
                    </label>
                  </div>

                  <div className="field color-setting-field">
                    <span>Màu chủ đạo thương hiệu</span>
                    <div className="color-control-bar">
                      <div className="color-picker-box" style={{backgroundColor: value.color || '#0057E1'}}>
                        <input
                          type="color"
                          className="native-color-input"
                          aria-label="Chọn màu thương hiệu"
                          value={value.color || '#0057E1'}
                          onChange={(e) => setValue({...value, color: e.target.value})}
                        />
                      </div>
                      <input
                        type="text"
                        className="color-hex-text"
                        maxLength={7}
                        value={value.color || '#0057E1'}
                        onChange={(e) => {
                          let val = e.target.value.trim();
                          if (!val.startsWith('#') && val.length > 0) val = '#' + val;
                          setValue({...value, color: val});
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
                              boxShadow: (value.color || '').toLowerCase() === c.hex.toLowerCase()
                                ? `0 0 0 2px #fff, 0 0 0 4px ${c.hex}`
                                : undefined
                            }}
                            title={`${c.label} (${c.hex})`}
                            onClick={() => setValue({...value, color: c.hex})}
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
                      "{value.greeting || 'Xin chào! Chúng tôi có thể giúp gì cho bạn?'}"
                    </div>
                  </div>
                </div>

                <aside className="config-preview-pane">
                  <WidgetPreview
                    title={value.widget_title || value.name || 'Hỗ trợ trực tuyến'}
                    position={value.widget_position || 'right'}
                    mode={value.widget_mode || 'standard'}
                    name={value.name || 'Website'}
                    greeting={value.greeting}
                    color={value.color || '#0057E1'}
                  />
                </aside>
              </div>
            </section>
          )}

          {step === 3 && (
            <HoursStep
              value={value}
              setValue={setValue}
              eyebrow="BƯỚC 3 · GIỜ HOẠT ĐỘNG"
            />
          )}

          {step === 4 && (
            <PrechatStep
              value={value}
              setValue={setValue}
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
                <span className="config-count">{agents.length} đã chọn</span>
              </div>

              {loading ? (
                <div className="config-loading-state">
                  <span className="material-symbols-outlined spin-icon">sync</span>
                  <span>Đang tải danh sách cộng tác viên…</span>
                </div>
              ) : (
                <>
                  <div className="agent-grid">
                    {members.map((member: any) => (
                      <label
                        className={`agent-option ${agents.includes(member.id) ? 'selected' : ''}`}
                        key={member.id}
                      >
                        <input
                          type="checkbox"
                          checked={agents.includes(member.id)}
                          onChange={(event) =>
                            setAgents(
                              event.target.checked
                                ? [...agents, member.id]
                                : agents.filter((id: string) => id !== member.id)
                            )
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
                </>
              )}
            </section>
          )}

          <div className="wizard-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 18, borderTop: '1px solid #edf0f6'}}>
            {step > 1 && (
              <button
                type="button"
                className="button-secondary"
                disabled={busy}
                onClick={() => {
                  setError('');
                  setStep((current) => Math.max(1, current - 1) as Step);
                }}
              >
                <Icon name="arrow_back" /> Quay lại
              </button>
            )}
            {step < 5 ? (
              <button
                type="button"
                className="channel-toolbar-button channel-toolbar-primary"
                disabled={busy}
                onClick={nextStep}
              >
                Tiếp tục
                <Icon name="arrow_forward" />
              </button>
            ) : (
              <button
                type="button"
                className="channel-toolbar-button channel-toolbar-primary"
                disabled={busy || !agents.length}
                onClick={() => void handleSave()}
              >
                {busy ? (
                  <>
                    <Icon name="sync" className="spin-icon" />
                    Đang lưu cấu hình…
                  </>
                ) : (
                  <>
                    <Icon name="check_circle" />
                    Lưu cấu hình
                  </>
                )}
              </button>
            )}
          </div>
        </fieldset>
      </form>
    </section>
  );
}
