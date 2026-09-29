import type {Request, Response} from 'express';

export class StatusController {
  static getRoot(req: Request, res: Response) {
    const isJson = req.xhr || req.headers.accept?.includes('application/json') || req.query.format === 'json';

    if (isJson) {
      return res.json({
        service: 'GoTek Chatbot Core API Engine',
        status: 'online',
        version: '1.0.0',
        architecture: 'Modular Monolith + Event-Driven Workers',
        messageBroker: 'RabbitMQ (AMQP 5672 / WebUI 15672)',
        database: 'PostgreSQL 16 (Multi-tenant RLS 55432)',
        cache: 'Redis 7 (6379)',
        endpoints: {
          health: '/api/health',
          group_routes: '/api/*',
          widget_sdk: '/widget.js',
          widget_api: '/widget-api/*'
        },
        timestamp: new Date().toISOString()
      });
    }

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GoTek Chatbot Engine API · Service Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(22, 29, 47, 0.7);
      --card-border: rgba(99, 102, 241, 0.2);
      --primary: #6366f1;
      --primary-light: #818cf8;
      --success: #10b981;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background-image: 
        radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 40%),
        radial-gradient(circle at 85% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 40%);
    }
    .container {
      width: 100%;
      max-width: 760px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(16px);
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .logo-badge {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 800;
      color: #fff;
      box-shadow: 0 8px 16px rgba(99, 102, 241, 0.35);
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .subtitle {
      color: var(--text-muted);
      font-size: 13px;
      margin-top: 2px;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 9999px;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 10px #10b981;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.8); }
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .service-card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 16px;
      transition: all 0.2s;
    }
    .service-card:hover {
      border-color: rgba(99, 102, 241, 0.4);
      transform: translateY(-2px);
    }
    .service-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .service-value {
      font-size: 15px;
      font-weight: 700;
      margin-top: 6px;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .links-section {
      background: rgba(15, 23, 42, 0.4);
      border-radius: 14px;
      padding: 20px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .links-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 14px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: var(--primary);
      color: white;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
    }
    .btn-primary:hover {
      background: var(--primary-light);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.14);
      transform: translateY(-1px);
    }
    .footer {
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--text-muted);
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div style="background: rgba(255, 255, 255, 0.95); padding: 6px 14px; border-radius: 14px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3); display: flex; align-items: center; justify-content: center;">
          <img src="/gotek-logo.png" alt="GoTek Logo" style="height: 36px; object-fit: contain;" />
        </div>
        <div>
          <h1>GoTek Chatbot API Engine</h1>
          <div class="subtitle">Hệ sinh thái CSKH Đa Kênh Thông Minh · Cổng 4317</div>
        </div>
      </div>
      <div class="status-pill">
        <div class="pulse-dot"></div>
        RUNNING NORMAL
      </div>
    </div>

    <div class="grid">
      <div class="service-card">
        <div class="service-name">Mô hình kiến trúc</div>
        <div class="service-value">Modular Monolith</div>
      </div>
      <div class="service-card">
        <div class="service-name">Message Broker</div>
        <div class="service-value">RabbitMQ 3.12 (Active)</div>
      </div>
      <div class="service-card">
        <div class="service-name">Cơ sở dữ liệu</div>
        <div class="service-value">PostgreSQL 16 (RLS)</div>
      </div>
      <div class="service-card">
        <div class="service-name">Phân nhóm API</div>
        <div class="service-value">Central Group Routes</div>
      </div>
    </div>

    <div class="links-section">
      <div class="links-title">Cổng điều khiển và tài nguyên nhanh</div>
      <div class="actions">
        <a href="http://localhost:3001/app/login" class="btn btn-primary" target="_blank">
          <span>🚀 Mở Frontend App (Cổng 3001)</span>
        </a>
        <a href="http://localhost:15672" class="btn btn-secondary" target="_blank">
          <span>🐰 RabbitMQ Management (Cổng 15672)</span>
        </a>
        <a href="/api/health" class="btn btn-secondary" target="_blank">
          <span>🩺 API Health Endpoint</span>
        </a>
        <a href="/?format=json" class="btn btn-secondary">
          <span>📄 Raw Specs JSON</span>
        </a>
      </div>
    </div>

    <div class="footer">
      <span>Express 5.2.1 · Node 22 Alpine Container</span>
      <span>Port: 4317 · Status: 200 OK</span>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
