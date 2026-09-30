import {useEffect, useMemo, useState} from 'react';

type WidgetInstance = {destroy: () => void};

declare global {
  interface Window {
    gotekSDK?: {
      run: (config: {websiteToken: string; baseUrl: string; autoOpen?: boolean}) => WidgetInstance;
    };
  }
}

interface CustomerChatPageProps {
  publicKey: string;
}

export function CustomerChatPage({publicKey}: CustomerChatPageProps) {
  const [error, setError] = useState('');
  const validKey = useMemo(() => /^[A-Za-z0-9_-]{40,80}$/.test(publicKey), [publicKey]);

  useEffect(() => {
    if (!validKey) return;

    let mounted = true;
    let widget: WidgetInstance | undefined;
    const script = document.createElement('script');
    const baseUrl = window.location.origin;
    script.src = `${baseUrl}/sdk.js`;
    script.async = true;
    script.dataset.gotekVisitorSdk = 'true';

    const start = () => {
      if (!mounted || !window.gotekSDK) return;
      try {
        widget = window.gotekSDK.run({websiteToken: publicKey, baseUrl, autoOpen: true});
      } catch {
        setError('Không thể khởi tạo khung chat. Vui lòng thử lại.');
      }
    };

    script.onload = start;
    script.onerror = () => setError('Không tải được khung chat. Vui lòng thử lại sau.');

    if (window.gotekSDK) start();
    else document.head.append(script);

    return () => {
      mounted = false;
      widget?.destroy();
      if (script.parentNode) script.remove();
    };
  }, [publicKey, validKey]);

  if (!validKey) {
    return (
      <main className="customer-page">
        <section className="customer-card customer-card-error">
          <div className="customer-mark" aria-hidden="true">G</div>
          <p className="customer-kicker">GoTek Chat</p>
          <h1>Link chat không hợp lệ</h1>
          <p>Vui lòng sử dụng đúng đường dẫn chat do doanh nghiệp cung cấp.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="customer-page">
      <header className="customer-header">
        <div className="customer-brand"><span className="customer-mark" aria-hidden="true">G</span><strong>GoTek</strong></div>
        <span className="customer-secure">Kênh hỗ trợ trực tuyến</span>
      </header>
      <section className="customer-hero" aria-label="Trang hỗ trợ khách hàng">
        <div className="customer-card">
          <p className="customer-kicker">HỖ TRỢ KHÁCH HÀNG</p>
          <h1>Chúng tôi sẵn sàng lắng nghe bạn</h1>
          <p className="customer-lead">Gửi câu hỏi cho doanh nghiệp. Trợ lý AI hoặc nhân viên sẽ phản hồi ngay trong khung chat.</p>
          <div className="customer-points">
            <div><span aria-hidden="true">✓</span><p>Trao đổi theo đúng kênh của doanh nghiệp</p></div>
            <div><span aria-hidden="true">✓</span><p>Có thể yêu cầu gặp nhân viên bất cứ lúc nào</p></div>
            <div><span aria-hidden="true">✓</span><p>Không cần tạo tài khoản GoTek</p></div>
          </div>
          <p className="customer-hint">Khung chat sẽ mở tự động ở góc dưới màn hình.</p>
          {error && <p className="customer-error" role="alert">{error}</p>}
        </div>
      </section>
      <footer className="customer-footer">Powered by GoTek · Hỗ trợ khách hàng đa doanh nghiệp</footer>
    </main>
  );
}
