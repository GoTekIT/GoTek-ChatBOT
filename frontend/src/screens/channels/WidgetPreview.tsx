import {useState} from 'react';

export function WidgetPreview({
  title,
  position,
  mode,
  name,
  color = '#0057E1'
}: {
  title: string;
  position: string;
  mode: string;
  name: string;
  color?: string;
}) {
  const [open, setOpen] = useState(true);
  const widgetWidth = mode === 'expanded' ? 440 : 360;

  return (
    <section aria-label="Xem trước widget" className="widget-preview">
      <div className="widget-preview-header">
        <div>
          <h3>Xem trước hiển thị</h3>
          <p className="muted">Giao diện mô phỏng thực tế khách hàng nhìn thấy trên website của bạn.</p>
        </div>
        <button
          type="button"
          className="preview-toggle-btn"
          onClick={() => setOpen(!open)}
        >
          <span className="material-symbols-outlined" style={{fontSize: 18}}>
            {open ? 'visibility_off' : 'visibility'}
          </span>
          {open ? 'Thu nhỏ nút chat' : 'Mở khung chat mẫu'}
        </button>
      </div>

      <div
        className="widget-preview-stage"
        style={{alignItems: position === 'left' ? 'flex-start' : 'flex-end'}}
      >
        <div className="preview-browser-bar">
          <div className="preview-dots">
            <span />
            <span />
            <span />
          </div>
          <div className="preview-url-bar">https://your-website.com</div>
        </div>

        {open && (
          <div className="widget-preview-chat-box" style={{width: widgetWidth}}>
            <header className="widget-preview-chat-header" style={{backgroundColor: color}}>
              <div className="header-info">
                <div className="avatar-circle">
                  <span className="material-symbols-outlined">support_agent</span>
                </div>
                <div>
                  <strong>{title || 'Hỗ trợ trực tuyến'}</strong>
                  <div className="status-live">
                    <span className="status-dot" />
                    <span>{name || 'GoTek Chat'} · Trực tuyến</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="close-preview-btn"
                aria-label="Thu nhỏ"
                onClick={() => setOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="widget-preview-chat-body">
              <div className="message-date-divider">Hôm nay</div>

              <div className="preview-bubble bubble-agent">
                <div className="bubble-text">
                  Xin chào! 👋 Cảm ơn bạn đã ghé thăm. Chúng tôi có thể giúp gì cho bạn hôm nay?
                </div>
                <div className="bubble-time">10:00</div>
              </div>

              <div className="preview-bubble bubble-visitor" style={{backgroundColor: color}}>
                <div className="bubble-text">
                  Tôi muốn tìm hiểu thông tin chi tiết về sản phẩm và dịch vụ của bên mình.
                </div>
                <div className="bubble-time">10:01 · Đã gửi</div>
              </div>

              <div className="preview-bubble bubble-agent">
                <div className="bubble-text">
                  Dạ vâng, tư vấn viên sẵn sàng hỗ trợ bạn ngay đây ạ!
                </div>
                <div className="bubble-time">10:01</div>
              </div>
            </div>

            <footer className="widget-preview-chat-footer">
              <input
                type="text"
                placeholder="Nhập tin nhắn..."
                disabled
                className="preview-input"
              />
              <button
                type="button"
                className="preview-send-btn"
                style={{backgroundColor: color}}
                disabled
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            </footer>
          </div>
        )}

        <button
          className="widget-preview-launcher"
          type="button"
          aria-expanded={open}
          style={{backgroundColor: color}}
          onClick={() => setOpen(!open)}
        >
          <span className="material-symbols-outlined launcher-icon">
            {open ? 'expand_more' : 'chat'}
          </span>
          <span className="launcher-text">{title || 'Trò chuyện'}</span>
        </button>
      </div>
    </section>
  );
}
