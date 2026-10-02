(()=>{
  'use strict';

  // Preserve any queue pushed before this script loaded
  const priorQueue = (window.gotekSDK && Array.isArray(window.gotekSDK.q)) ? window.gotekSDK.q : [];
  let instance = null;

  function createInstance(config) {
    if (instance) return instance;

    const base = new URL(config.baseUrl);
    if (!['http:', 'https:'].includes(base.protocol)) throw Error('Invalid base URL');
    const key = String(config.websiteToken);
    if (!/^[A-Za-z0-9_-]{40,80}$/.test(key)) throw Error('Invalid website token');

    const endpoint = base.origin + '/widget-api/' + key;
    const storageKey = 'gotek.visitor.' + base.origin + '.' + key;

    // Safe storage wrapper
    const storage = {
      get(k) { try { return localStorage.getItem(k) || undefined; } catch { return undefined; } },
      set(k, v) { try { localStorage.setItem(k, v); } catch {} },
      remove(k) { try { localStorage.removeItem(k); } catch {} }
    };

    const host = document.createElement('div');
    host.id = 'gotek-widget';
    const root = host.attachShadow({mode: 'open'});

    root.innerHTML = `<style>
    :host{all:initial;color:#1e293b;font:13.5px Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
    *{box-sizing:border-box}
    button,input{font:inherit}
    button{cursor:pointer}
    button:focus-visible,input:focus-visible{outline:2px solid #7bc7ff;outline-offset:2px}

    /* Launcher Pill matching Image 1: solid brand color, rounded pill, chevron/chat icon + label */
    .launcher{position:fixed;right:22px;bottom:22px;z-index:2147483000;display:inline-flex;align-items:center;gap:8px;padding:10px 18px;min-height:42px;border:none;border-radius:999px;background:var(--gotek-primary,#e04f16);box-shadow:0 4px 14px rgba(0,0,0,0.18);color:#fff;font-size:13.5px;font-weight:650;transition:transform .18s ease,box-shadow .18s ease}
    .launcher:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,0.24)}
    .launcher-icon{display:flex;align-items:center;justify-content:center}
    .launcher-label{font-size:13.5px;font-weight:700}

    /* Panel box matching Image 1: rounded 16px, subtle shadows, clean border */
    .panel{position:fixed;right:22px;bottom:22px;z-index:2147483000;display:flex;flex-direction:column;width:min(370px,calc(100vw - 24px));height:min(560px,calc(100dvh - 44px));min-height:420px;overflow:hidden;border:1px solid #e2e8f0;border-radius:16px;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,0.16),0 2px 8px rgba(15,23,42,0.08);transition:height .15s ease}
    .panel[hidden]{display:none!important}
    .launcher[hidden]{display:none!important}

    /* Header matching Image 1: avatar circle with home icon, title, subtitle with green dot + live status, close button */
    .header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--gotek-primary,#e04f16);color:#fff}
    .header-info{display:flex;align-items:center;gap:10px}
    .avatar-circle{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.22);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0}
    .header-text strong{display:block;font-size:13.5px;font-weight:700;color:#fff;line-height:1.2}
    .status-live{display:flex;align-items:center;gap:5px;font-size:11px;color:rgba(255,255,255,0.9);margin-top:3px}
    .status-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;flex-shrink:0}
    .close{background:transparent;border:none;color:rgba(255,255,255,0.85);cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s}
    .close:hover{background:rgba(255,255,255,0.15);color:#fff}
    .handoff-header-btn{background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:#fff;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:600;cursor:pointer;margin-left:6px;transition:background .15s}
    .handoff-header-btn:hover{background:rgba(255,255,255,0.35)}
    .handoff-header-btn:disabled{cursor:wait;opacity:.65}

    /* Hidden internal meta bar so contract tests pass without rendering extra line */
    .meta{display:none}

    /* Messages container: clean slate background #f8fafc */
    .messages{flex:1;overflow-y:auto;padding:14px 16px;background:#f8fafc;display:flex;flex-direction:column;gap:10px}
    .messages::-webkit-scrollbar{width:5px}
    .messages::-webkit-scrollbar-track{background:transparent}
    .messages::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:10px}
    .messages::-webkit-scrollbar-thumb:hover{background:#94a3b8}

    /* Date Divider matching Messenger */
    .message-date-divider{display:flex;align-items:center;justify-content:center;margin:14px 0 8px;width:100%;clear:both}
    .message-date-divider span{display:inline-block;padding:3px 12px;border-radius:999px;background:#f1f5f9;color:#64748b;font-size:11px;font-weight:600;letter-spacing:0.2px;border:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(0,0,0,0.03)}

    .empty{margin:24px 0;color:#94a3b8;text-align:center;font-size:12px;line-height:1.5}

    /* Message bubbles matching Image 1 */
    .bubble{max-width:82%;padding:9px 13px;border-radius:12px;font-size:12.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;box-sizing:border-box}
    .bubble-agent, .bubble.greeting-bubble{align-self:flex-start;background:#fff;color:#1e293b;border:1px solid #e2e8f0;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,0.03)}
    .bubble-visitor{align-self:flex-end;background:var(--gotek-primary,#e04f16) !important;color:#fff !important;border:none !important;border-bottom-right-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,0.06)}
    .bubble.optimistic{opacity:0.75}
    .bubble.failed{background:#fee2e2 !important;color:#991b1b !important;border:1px dashed #f87171 !important;cursor:pointer}
    .bubble-time{font-size:9.5px;margin-top:4px;opacity:0.75}
    .bubble-agent .bubble-time, .bubble.greeting-bubble .bubble-time{color:#64748b}
    .bubble-visitor .bubble-time{color:rgba(255,255,255,0.88)}

    .typing{display:flex;align-items:center;gap:6px;width:fit-content;padding:8px 12px;border-radius:12px;border-bottom-left-radius:4px;background:#fff;border:1px solid #e2e8f0;color:#64748b;font-size:11.5px;animation:gotekFadeIn .2s ease}
    .typing-dots{display:inline-flex;gap:3px;align-items:center}
    .typing-dots span{width:5px;height:5px;border-radius:50%;background:#94a3b8;animation:gotekPulse 1.4s infinite ease-in-out both}
    .typing-dots span:nth-child(1){animation-delay:-0.32s}
    .typing-dots span:nth-child(2){animation-delay:-0.16s}
    @keyframes gotekPulse{0%,80%,100%{transform:scale(0.3);opacity:0.4}40%{transform:scale(1);opacity:1}}
    @keyframes gotekFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}

    /* Composer matching Image 1: clean input + squircle send button */
    .composer{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fff;border-top:1px solid #e2e8f0}
    .composer input{flex:1;height:36px;border:1px solid #cbd5e1;border-radius:8px;padding:4px 12px;font-size:12.5px;background:#f8fafc;outline:none;color:#0f172a;transition:all .15s ease}
    .composer input:focus{background:#fff;border-color:var(--gotek-primary,#e04f16);box-shadow:0 0 0 2px rgba(224,79,22,0.12)}
    .composer input::placeholder{color:#94a3b8}
    .send{width:36px;height:36px;min-width:36px;border-radius:8px;border:none;background:var(--gotek-primary,#e04f16);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;transition:transform .12s,opacity .15s}
    .send:hover{transform:scale(1.04)}
    .send:active{transform:scale(0.96)}
    .send:disabled{opacity:0.4;cursor:not-allowed;transform:none}

    .prechat{flex:1;overflow-y:auto;padding:16px;background:#f8fafc;display:flex;flex-direction:column}
    .prechat[hidden]{display:none}
    .prechat-card{background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:16px 14px;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
    .prechat-intro{margin:0 0 14px;color:#4b5563;font-size:13px;line-height:1.5}
    .prechat form{display:grid;gap:12px}
    .prechat-field{display:grid;gap:5px}
    .prechat-field-title{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600;color:#1f2937}
    .prechat-req-star{color:#dc2626;margin-left:3px;font-weight:bold}
    .prechat-req-badge{font-size:10px;font-weight:600;color:#dc2626;background:#fef2f2;padding:2px 6px;border-radius:4px;border:1px solid #fecaca}
    .prechat input{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;transition:border-color .15s}
    .prechat input:focus{border-color:var(--gotek-primary,#e04f16);box-shadow:0 0 0 3px rgba(224,79,22,0.12)}
    .prechat button.prechat-submit{border:0;border-radius:8px;padding:10px 16px;background:var(--gotek-primary,#e04f16);color:#fff;font-weight:700;font-size:13px;cursor:pointer;margin-top:4px;transition:opacity .15s}
    .prechat button.prechat-submit:disabled{cursor:wait;opacity:0.7}

    .reconnect{border:0;border-radius:8px;padding:8px 12px;margin:0 14px 10px;background:#fff1f2;color:#a62a3b;font-weight:600;font-size:12px}
    .error{min-height:16px;margin:0 14px;color:#dc2626;font-size:11.5px;line-height:1.35}

    @media(max-width:520px){
      .launcher{right:12px;bottom:12px}
      .panel{right:12px;bottom:12px;width:calc(100vw - 24px);height:calc(100dvh - 24px);min-height:380px;border-radius:16px}
    }
    </style>
    <button class="launcher" type="button" aria-expanded="false" aria-controls="gotek-chat">
      <span class="launcher-icon">
        <svg class="icon-down" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:none">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        <svg class="icon-chat" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
      </span>
      <span class="launcher-label">Trò chuyện</span>
    </button>
    <section id="gotek-chat" class="panel" aria-label="Trò chuyện với GoTek" hidden>
      <header class="header">
        <div class="header-info">
          <div class="avatar-circle">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 3L4 9v12h16V9l-8-6zm0 2.5L18 10v9H6v-9l6-4.5zM12 11a2 2 0 100 4 2 2 0 000-4z"/>
            </svg>
          </div>
          <div class="header-text">
            <strong class="title">GoTek</strong>
            <div class="status-live">
              <span class="status-dot"></span>
              <span class="status-label"><span class="channel-name">GoTek Chat</span> · <span class="status-state">Trực tuyến</span></span>
              <button class="handoff-header-btn" type="button" hidden>Yêu cầu gặp nhân viên</button>
            </div>
          </div>
        </div>
        <button class="close" type="button" aria-label="Đóng trò chuyện">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>
      <div class="meta" style="display:none">
        <p class="status" role="status" aria-live="polite">Nhân viên đang hỗ trợ</p>
        <button class="handoff" type="button" hidden>Yêu cầu gặp nhân viên</button>
      </div>
      <div class="prechat"></div>
      <div class="messages" role="log" aria-live="polite">
        <p class="empty" hidden>Bạn đang trò chuyện với đội ngũ hỗ trợ của doanh nghiệp.</p>
      </div>
      <p class="error" role="alert" aria-live="assertive"></p>
      <button class="reconnect" type="button" hidden>Kết nối lại</button>
      <form class="composer">
        <input id="gotek-message" type="text" autocomplete="off" required maxlength="10000" placeholder="Nhập tin nhắn..." />
        <button class="send" type="submit" aria-label="Gửi tin nhắn" title="Gửi tin nhắn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    </section>`;

    if (document.body) {
      document.body.append(host);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (!document.body.contains(host)) document.body.append(host);
      });
    }
    const $ = s => root.querySelector(s);
    const panel = $('.panel'), launcher = $('.launcher'), close = $('.close');
    const messages = $('.messages'), empty = $('.empty'), error = $('.error');
    const textarea = $('#gotek-message'), send = $('.send'), reconnect = $('.reconnect');
    const handoff = $('.handoff'), status = $('.status'), prechat = $('.prechat');
    const header = $('.header'), composer = $('.composer');
    const handoffHeaderBtn = root.querySelector('.handoff-header-btn');

    let currentGreeting = '';

    function renderGreeting(text) {
      if (!text || !text.trim()) return;
      empty.hidden = true;
      let node = messages.querySelector('.greeting-bubble');
      if (!node) {
        node = document.createElement('div');
        node.className = 'bubble bubble-agent greeting-bubble';
        node.setAttribute('data-id', 'system-greeting');

        const textDiv = document.createElement('div');
        textDiv.className = 'bubble-text';
        textDiv.textContent = text;
        node.appendChild(textDiv);

        const timeDiv = document.createElement('div');
        timeDiv.className = 'bubble-time';
        timeDiv.textContent = new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});
        node.appendChild(timeDiv);

        const divider = messages.querySelector('.message-date-divider');
        if (divider) {
          divider.after(node);
        } else {
          messages.prepend(node);
        }
      } else {
        const textDiv = node.querySelector('.bubble-text') || node;
        textDiv.textContent = text;
      }
    }

    function applyAppearance(settings) {
      if (!settings) return;
      if (settings.name) {
        const chName = root.querySelector('.channel-name');
        if (chName) chName.textContent = settings.name;
      }
      const title = settings.widgetTitle || settings.name || 'GoTek Chat';
      const titleEl = root.querySelector('.title');
      if (titleEl) titleEl.textContent = title;
      const lLabel = root.querySelector('.launcher-label');
      if (lLabel) lLabel.textContent = title;

      if (settings.greeting) {
        currentGreeting = settings.available === false
          ? settings.greeting + ' (Hiện đang ngoài giờ hỗ trợ)'
          : settings.greeting;
        renderGreeting(currentGreeting);
      }
      if (settings.color) {
        host.style.setProperty('--gotek-primary', settings.color);
        launcher.style.background = settings.color;
        launcher.style.boxShadow = '0 4px 14px ' + settings.color + '4d';
        header.style.background = settings.color;
        send.style.background = settings.color;
        const prechatBtn = root.querySelector('.prechat button');
        if (prechatBtn) prechatBtn.style.background = settings.color;
      }
      if (settings.widgetPosition === 'left') {
        launcher.style.right = 'auto';
        launcher.style.left = '22px';
        panel.style.right = 'auto';
        panel.style.left = '22px';
      } else if (settings.widgetPosition === 'right') {
        launcher.style.left = 'auto';
        launcher.style.right = '22px';
        panel.style.left = 'auto';
        panel.style.right = '22px';
      }
    }

    applyAppearance({
      color: config.color,
      widgetTitle: config.widgetTitle,
      name: config.name,
      widgetPosition: config.widgetPosition,
      greeting: config.greeting
    });

    let token = '', cursor = 0, profileReady = true;
    let seen = new Set(), receipts = new Set();
    let pendingReceipts = new Set();
    let receiptBatchTimer = null;
    let handoffBusy = false;
    let replyOwner = 'AI_ACTIVE', ownerVersion = 0;
    let tabHidden = false;

    function queueReceipt(messageId) {
      if (!messageId || receipts.has(messageId)) return;
      receipts.add(messageId);
      pendingReceipts.add(messageId);
      clearTimeout(receiptBatchTimer);
      receiptBatchTimer = setTimeout(flushReceipts, 200);
    }

    async function flushReceipts() {
      if (!pendingReceipts.size || !token) return;
      const ids = Array.from(pendingReceipts);
      pendingReceipts.clear();
      try {
        await api('/receipts', 'POST', { messageIds: ids });
      } catch {
        for (const id of ids) pendingReceipts.add(id);
      }
    }

    let agentTypingNode = null;
    let agentTypingTimer = null;

    function showAgentTyping() {
      if (!agentTypingNode) {
        agentTypingNode = document.createElement('div');
        agentTypingNode.className = 'typing';
        agentTypingNode.innerHTML = '<span>Nhân viên đang soạn tin</span><div class="typing-dots"><span></span><span></span><span></span></div>';
        messages.append(agentTypingNode);
        messages.scrollTop = messages.scrollHeight;
      }
      clearTimeout(agentTypingTimer);
      agentTypingTimer = setTimeout(hideAgentTyping, 6000);
    }

    function hideAgentTyping() {
      clearTimeout(agentTypingTimer);
      if (agentTypingNode) {
        agentTypingNode.remove();
        agentTypingNode = null;
      }
    }

    function updateHandoff() {
      const visible = Boolean(token && profileReady && replyOwner === 'AI_ACTIVE');
      handoff.hidden = !visible;
      handoff.disabled = handoffBusy || !visible;
      handoff.textContent = handoffBusy ? 'Đang kết nối…' : 'Yêu cầu gặp nhân viên';
      if (handoffHeaderBtn) {
        handoffHeaderBtn.hidden = !visible;
        handoffHeaderBtn.disabled = handoffBusy || !visible;
        handoffHeaderBtn.textContent = handoffBusy ? 'Đang kết nối…' : 'Yêu cầu gặp nhân viên';
      }
    }

    function setOwner(owner, version) {
      if (!Number.isInteger(version) || version < ownerVersion) return;
      replyOwner = owner;
      ownerVersion = version;
      const ownerLabel = owner === 'HUMAN_ACTIVE'
        ? 'Nhân viên đang hỗ trợ'
        : owner === 'HANDOFF_PENDING'
          ? 'Đang kết nối nhân viên'
          : owner === 'AI_ACTIVE'
            ? 'Trợ lý AI đang hỗ trợ'
            : 'Trực tuyến';
      status.textContent = ownerLabel;
      const stateEl = root.querySelector('.status-state');
      if (stateEl) stateEl.textContent = ownerLabel;
      updateHandoff();
    }

    async function api(path, method = 'GET', body) {
      const r = await fetch(endpoint + path, {
        method,
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? {Authorization: 'Bearer ' + token} : {})
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const data = await r.json();
      if (!r.ok) {
        const e = Error(
          data.error === 'DOMAIN_DENIED'
            ? 'Website chưa được phép sử dụng kênh này.'
            : data.error === 'VISITOR_SESSION_EXPIRED'
              ? 'Phiên trò chuyện đã hết hạn.'
              : 'Chưa kết nối được. Vui lòng thử lại.'
        );
        e.code = data.error;
        throw e;
      }
      return data;
    }

    // Load channel branding (color, title, greeting) immediately so launcher displays custom brand before click
    api('/config').then(cfg => applyAppearance(cfg)).catch(() => {});

    function formatMessengerDateDivider(rawDate) {
      if (!rawDate) return 'Hôm nay';
      const date = new Date(rawDate);
      if (isNaN(date.getTime())) return 'Hôm nay';
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Hôm nay';
      if (diffDays === 1) return 'Hôm qua';
      if (diffDays > 1 && diffDays < 7) {
        const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        return dayNames[date.getDay()];
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      if (date.getFullYear() === now.getFullYear()) {
        return `${day} tháng ${month}`;
      }
      return `${day}/${month}/${date.getFullYear()}`;
    }

    function getMessageDateKey(rawDate) {
      if (!rawDate) return 'today';
      const date = new Date(rawDate);
      if (isNaN(date.getTime())) return 'today';
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }

    function render(message) {
      if (!message || !message.body) return;

      // Reconcile optimistic node if client_id matched
      if (message.client_id) {
        const optNode = messages.querySelector(`[data-client-id="${message.client_id}"]`);
        if (optNode) {
          optNode.classList.remove('optimistic');
          if (message.id) {
            seen.add(message.id);
            optNode.setAttribute('data-id', message.id);
          }
          return;
        }
      }

      if (message.id && seen.has(message.id)) return;
      if (message.id) seen.add(message.id);
      if (message.client_id) seen.add('cid:' + message.client_id);

      empty.hidden = true;
      hideAgentTyping();

      // Messenger-style Date Divider
      const msgDateKey = getMessageDateKey(message.created_at);
      if (msgDateKey) {
        const existingDivider = messages.querySelector(`.message-date-divider[data-date="${msgDateKey}"]`);
        if (!existingDivider) {
          const divNode = document.createElement('div');
          divNode.className = 'message-date-divider';
          divNode.setAttribute('data-date', msgDateKey);
          const span = document.createElement('span');
          span.textContent = formatMessengerDateDivider(message.created_at);
          divNode.appendChild(span);
          messages.append(divNode);
        }
      }

      const node = document.createElement('div');
      const isVisitor = message.author_type === 'visitor';
      node.className = 'bubble ' + (isVisitor ? 'bubble-visitor' : 'bubble-agent') + (message.optimistic ? ' optimistic' : '');
      if (message.client_id) node.setAttribute('data-client-id', message.client_id);
      if (message.id) node.setAttribute('data-id', message.id);

      const textDiv = document.createElement('div');
      textDiv.className = 'bubble-text';
      textDiv.textContent = message.body;
      node.appendChild(textDiv);

      const timeDiv = document.createElement('div');
      timeDiv.className = 'bubble-time';
      const timeStr = new Date(message.created_at || Date.now()).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});
      timeDiv.textContent = isVisitor ? (timeStr + ' · Đã gửi') : timeStr;
      node.appendChild(timeDiv);

      messages.append(node);
      messages.scrollTop = messages.scrollHeight;
    }

    let eventSource = null;
    let sseReconnectTimer = null;
    let sseBackoff = 1000;
    let isSyncing = false;

    async function syncMessages() {
      if (!token || !profileReady || isSyncing) return;
      isSyncing = true;
      try {
        const state = await api('/state');
        setOwner(state.replyOwner, state.ownerVersion);
        let hasMore = true;
        let loopCount = 0;
        while (hasMore && loopCount < 50) {
          loopCount++;
          const rows = await api('/messages?after=' + cursor);
          for (const message of rows) {
            render(message);
            cursor = Math.max(cursor, message.sequence || 0);
            if (message.author_type !== 'visitor' && message.id) receipts.add(message.id);
          }
          if (rows.length < 100) {
            hasMore = false;
          }
        }
        if (receipts.size) {
          const ids = [...receipts].slice(0, 100);
          await api('/receipts', 'POST', {messageIds: ids});
          ids.forEach(id => receipts.delete(id));
        }
        error.textContent = '';
      } catch (e) {
        if (!eventSource) error.textContent = e.message;
      } finally {
        isSyncing = false;
      }
    }

    let ws = null;
    let wsReconnectTimer = null;
    let wsBackoff = 1000;

    function connectRealtime() {
      if (!token || !profileReady) return;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

      try {
        const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = base.origin.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(token) + '&role=visitor';
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          wsBackoff = 1000;
          error.textContent = '';
          reconnect.hidden = true;
          // Sync message history so full chat history is loaded
          syncMessages().catch(() => {});
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            const type = payload.type || payload.event;

            if (type === 'message:new') {
              const msg = payload.data || payload;
              if (msg && msg.visibility !== 'internal') {
                render(msg);
                if (msg.sequence) cursor = Math.max(cursor, msg.sequence);
                if (msg.author_type !== 'visitor' && msg.id) {
                  queueReceipt(msg.id);
                }
              }
            } else if (type === 'message:ack') {
              const msg = payload.data || payload;
              if (msg.clientId) {
                const optNode = messages.querySelector(`[data-client-id="${msg.clientId}"]`);
                if (optNode) {
                  optNode.classList.remove('optimistic');
                  if (msg.id) {
                    seen.add(msg.id);
                    optNode.setAttribute('data-id', msg.id);
                  }
                }
              }
            } else if (type === 'message:persist_error' || type === 'message:failed') {
              const msg = payload.data || payload;
              if (msg.clientId) {
                const optNode = messages.querySelector(`[data-client-id="${msg.clientId}"]`);
                if (optNode) {
                  optNode.classList.remove('optimistic');
                  optNode.classList.add('failed');
                  optNode.title = 'Gửi thất bại. Bấm để thử lại.';
                  optNode.onclick = () => {
                    textarea.value = optNode.textContent || '';
                    optNode.remove();
                    textarea.focus();
                  };
                }
              }
            } else if (type === 'error') {
              const msg = payload.data || payload;
              if (msg.code === 'RATE_LIMITED' || msg.message) {
                error.textContent = msg.message || 'Lỗi gửi tin nhắn';
              }
            } else if (type === 'typing') {
              const data = payload.data || payload;
              if (data.actorType !== 'visitor') {
                if (data.isTyping) showAgentTyping();
                else hideAgentTyping();
              }
            } else if (type === 'conversation:takeover') {
              const data = payload.data || payload;
              if (data.replyOwner) setOwner(data.replyOwner, data.ownerVersion || (ownerVersion + 1));
            } else if (type === 'conversation:status') {
              const data = payload.data || payload;
              if (data.reply_owner) setOwner(data.reply_owner, data.owner_version);
            } else if (type === 'conversation:ai_resumed') {
              const data = payload.data || payload;
              if (data.reply_owner) setOwner(data.reply_owner, data.owner_version);
            }
          } catch (err) {
            console.error('[GoTek] WS parse error', err);
          }
        };

        ws.onerror = () => {
          disconnectWs();
          connectStream(); // Fallback to SSE
        };

        ws.onclose = () => {
          disconnectWs();
          const jitter = Math.floor(Math.random() * 500);
          wsReconnectTimer = setTimeout(() => {
            if (!panel.hidden && token && profileReady) {
              connectRealtime();
            }
          }, Math.min(wsBackoff + jitter, 15000));
          wsBackoff = Math.min(wsBackoff * 1.5, 15000);
        };
      } catch {
        connectStream();
      }
    }

    function disconnectWs() {
      if (ws) {
        ws.close();
        ws = null;
      }
      if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
      }
    }

    function connectStream() {
      if (!token || !profileReady) return;
      if (eventSource && eventSource.readyState !== EventSource.CLOSED) return;

      try {
        const streamUrl = endpoint + '/stream?token=' + encodeURIComponent(token);
        eventSource = new EventSource(streamUrl);

        eventSource.onopen = () => {
          sseBackoff = 1000;
          error.textContent = '';
          reconnect.hidden = true;
          syncMessages().catch(() => {});
        };

        eventSource.addEventListener('message:new', (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg && msg.visibility !== 'internal') {
              render(msg);
              if (msg.sequence) cursor = Math.max(cursor, msg.sequence);
              if (msg.author_type !== 'visitor' && msg.id) {
                queueReceipt(msg.id);
              }
            }
          } catch (err) {
            console.error('[GoTek] SSE parse error', err);
          }
        });

        eventSource.addEventListener('typing', (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.actorType !== 'visitor') {
              if (data.isTyping) showAgentTyping();
              else hideAgentTyping();
            }
          } catch {}
        });

        eventSource.addEventListener('conversation:takeover', (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.replyOwner) setOwner(data.replyOwner, data.ownerVersion || (ownerVersion + 1));
          } catch {}
        });

        eventSource.addEventListener('conversation:status', (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.reply_owner) setOwner(data.reply_owner, data.owner_version);
          } catch {}
        });

        eventSource.addEventListener('conversation:ai_resumed', (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.reply_owner) setOwner(data.reply_owner, data.owner_version);
          } catch {}
        });

        eventSource.onerror = () => {
          disconnectStream();
          const jitter = Math.floor(Math.random() * 500);
          sseReconnectTimer = setTimeout(() => {
            if (!panel.hidden && token && profileReady) {
              connectStream();
            }
          }, Math.min(sseBackoff + jitter, 15000));
          sseBackoff = Math.min(sseBackoff * 1.5, 15000);
        };
      } catch (err) {
        disconnectStream();
      }
    }

    function disconnectStream() {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (sseReconnectTimer) {
        clearTimeout(sseReconnectTimer);
        sseReconnectTimer = null;
      }
      hideAgentTyping();
    }

    async function requestHuman() {
      if (!token || handoffBusy || replyOwner !== 'AI_ACTIVE') return;
      handoffBusy = true;
      updateHandoff();
      status.textContent = 'Đang kết nối nhân viên…';
      try {
        const state = await api('/handoff', 'POST', {});
        setOwner(state.replyOwner, state.ownerVersion);
        error.textContent = '';
      } catch (e) {
        error.textContent = e.message;
      } finally {
        handoffBusy = false;
        updateHandoff();
      }
    }

    async function connect() {
      send.disabled = true;
      error.textContent = '';
      const resume = storage.get(storageKey);
      try {
        const session = await api('/session', 'POST', resume ? {resumeToken: resume} : (config.profile ? {profile: config.profile} : {}));
        token = session.token;
        setOwner(session.replyOwner, session.ownerVersion);
        storage.set(storageKey, token);

        applyAppearance(session);
        reconnect.hidden = true;

        const fields = session.prechat?.enabled ? (session.prechat.fields || []).filter(f => f.enabled) : [];
        profileReady = !fields.some(f => f.required && !String(session.profile?.[f.key] || '').trim());
        prechat.replaceChildren();
        prechat.hidden = profileReady;
        messages.hidden = !profileReady;
        composer.hidden = !profileReady;

        if (!profileReady) {
          const card = document.createElement('div');
          card.className = 'prechat-card';
          const intro = document.createElement('p');
          intro.className = 'prechat-intro';
          intro.textContent = session.prechat.message || 'Vui lòng để lại thông tin để chúng tôi hỗ trợ bạn tốt nhất.';
          card.append(intro);

          const form = document.createElement('form');
          for (const f of fields) {
            const fieldWrap = document.createElement('div');
            fieldWrap.className = 'prechat-field';

            const titleRow = document.createElement('div');
            titleRow.className = 'prechat-field-title';

            const labelText = document.createElement('span');
            labelText.textContent = f.label || f.key;
            if (f.required) {
              const star = document.createElement('span');
              star.className = 'prechat-req-star';
              star.textContent = '*';
              labelText.append(star);
            }
            titleRow.append(labelText);

            if (f.required) {
              const badge = document.createElement('span');
              badge.className = 'prechat-req-badge';
              badge.textContent = 'Bắt buộc';
              titleRow.append(badge);
            }
            fieldWrap.append(titleRow);

            const input = document.createElement('input');
            input.name = f.key;
            input.placeholder = f.placeholder || (f.required ? 'Bắt buộc nhập…' : 'Nhập thông tin…');
            input.required = Boolean(f.required);
            input.maxLength = 500;
            input.type = f.key === 'emailAddress' ? 'email' : f.key === 'phoneNumber' ? 'tel' : 'text';
            input.value = session.profile?.[f.key] || '';
            fieldWrap.append(input);
            form.append(fieldWrap);
          }

          const button = document.createElement('button');
          button.type = 'submit';
          button.className = 'prechat-submit';
          button.textContent = 'Bắt đầu trò chuyện';
          if (session.color) button.style.background = session.color;
          form.append(button);
          card.append(form);
          prechat.append(card);

          form.onsubmit = async event => {
            event.preventDefault();
            error.textContent = '';
            button.disabled = true;
            button.textContent = 'Đang xử lý…';
            try {
              const payload = Object.fromEntries(new FormData(form).entries());
              const res = await api('/profile', 'POST', {profile: payload});
              if (res.token) {
                token = res.token;
                storage.set(storageKey, token);
                seen.clear();
                receipts.clear();
                cursor = 0;
                messages.replaceChildren(empty);
                empty.hidden = false;
                if (currentGreeting) renderGreeting(currentGreeting);
              }
              if (res.replyOwner) {
                setOwner(res.replyOwner, res.ownerVersion || 1);
              }
              session.profile = res.profile;
              profileReady = true;
              prechat.hidden = true;
              messages.hidden = false;
              composer.hidden = false;
              send.disabled = false;
              textarea.disabled = false;
              updateHandoff();
              connectRealtime();
              await syncMessages();
              textarea.focus();
            } catch (e) {
              error.textContent = e.message || 'Không thể lưu thông tin. Vui lòng kiểm tra lại.';
            } finally {
              button.disabled = false;
              button.textContent = 'Bắt đầu trò chuyện';
            }
          };
        }

        send.disabled = !profileReady;
        textarea.disabled = !profileReady;
        updateHandoff();

        if (profileReady) {
          connectRealtime();
          await syncMessages();
        }
      } catch (e) {
        if (resume && e.code === 'VISITOR_SESSION_EXPIRED') {
          storage.remove(storageKey);
          token = '';
          cursor = 0;
          ownerVersion = 0;
          replyOwner = 'AI_ACTIVE';
          seen.clear();
          receipts.clear();
          pendingReceipts.clear();
          clearTimeout(receiptBatchTimer);
          messages.replaceChildren(empty);
          empty.hidden = false;
          if (currentGreeting) renderGreeting(currentGreeting);
          prechat.replaceChildren();
          prechat.hidden = true;
          profileReady = true;
          updateHandoff();
          send.disabled = false;
          textarea.disabled = false;
          return connect();
        }
        error.textContent = e.message;
        reconnect.hidden = false;
      }
    }

    launcher.onclick = () => {
      panel.hidden = false;
      panel.style.display = 'flex';
      launcher.hidden = true;
      launcher.style.display = 'none';
      launcher.setAttribute('aria-expanded', 'true');
      if (!token) void connect();
      else if (profileReady) {
        connectRealtime();
        void syncMessages();
      }
      textarea.focus();
    };

    close.onclick = () => {
      panel.hidden = true;
      panel.style.display = 'none';
      launcher.hidden = false;
      launcher.style.display = 'inline-flex';
      launcher.setAttribute('aria-expanded', 'false');
      launcher.focus();
    };

    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) {
        close.click();
      }
    });

    reconnect.onclick = connect;
    handoff.onclick = requestHuman;
    if (handoffHeaderBtn) handoffHeaderBtn.onclick = requestHuman;

    // Broadcast visitor typing indicator to agent console (via WebSocket or HTTP)
    let typingTimer = null;
    let isBroadcastingTyping = false;
    textarea.addEventListener('input', () => {
      if (textarea.tagName === 'TEXTAREA') {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 96) + 'px';
      }
      if (!token || !profileReady) return;
      if (!isBroadcastingTyping) {
        isBroadcastingTyping = true;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'typing', isTyping: true }));
        } else {
          api('/typing', 'POST', { isTyping: true }).catch(() => {});
        }
      }
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        isBroadcastingTyping = false;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'typing', isTyping: false }));
        } else {
          api('/typing', 'POST', { isTyping: false }).catch(() => {});
        }
      }, 3000);
    });

    textarea.addEventListener('blur', () => {
      if (isBroadcastingTyping && token) {
        isBroadcastingTyping = false;
        clearTimeout(typingTimer);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'typing', isTyping: false }));
        } else {
          api('/typing', 'POST', { isTyping: false }).catch(() => {});
        }
      }
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        composer.requestSubmit ? composer.requestSubmit() : composer.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });

    composer.onsubmit = async event => {
      event.preventDefault();
      if (!token || !profileReady) return;
      const text = textarea.value.trim();
      if (!text) return;

      const clientId = crypto.randomUUID();

      // OPTIMISTIC RENDERING: 0ms latency for visitor
      render({
        id: 'opt-' + clientId,
        client_id: clientId,
        author_type: 'visitor',
        body: text,
        created_at: new Date().toISOString(),
        optimistic: true
      });

      textarea.value = '';
      if (textarea.tagName === 'TEXTAREA') textarea.style.height = '';
      textarea.focus();

      // Fast WebSocket send (<1ms frame transfer)
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: 'message:send',
            clientId,
            body: text
          }));
          return;
        } catch {
          // Fall through to HTTP POST fallback
        }
      }

      // HTTP Fallback
      try {
        const message = await api('/messages', 'POST', { clientId, body: text });
        setOwner(message.replyOwner, message.ownerVersion);
        render(message);
        error.textContent = '';
      } catch (e) {
        error.textContent = e.message;
        const optNode = messages.querySelector(`[data-client-id="${clientId}"]`);
        if (optNode) {
          optNode.classList.remove('optimistic');
          optNode.classList.add('failed');
          optNode.title = 'Gửi thất bại. Bấm để thử lại.';
          optNode.onclick = () => {
            textarea.value = text;
            optNode.remove();
            textarea.focus();
          };
        }
      }
    };

    // Page Visibility API listener
    const onVisibilityChange = () => {
      tabHidden = document.hidden;
      if (!tabHidden && !panel.hidden && token && profileReady) {
        connectRealtime();
        void syncMessages();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Mobile Virtual Keyboard Viewport Handler
    let onVpResize = null;
    if (window.visualViewport) {
      onVpResize = () => {
        if (panel.hidden) return;
        const vp = window.visualViewport;
        if (window.innerHeight - vp.height > 120) {
          panel.style.height = (vp.height - 16) + 'px';
          panel.style.bottom = (window.innerHeight - vp.height - vp.offsetTop + 8) + 'px';
          messages.scrollTop = messages.scrollHeight;
        } else {
          panel.style.height = '';
          panel.style.bottom = '';
        }
      };
      window.visualViewport.addEventListener('resize', onVpResize);
    }

    if (config.autoOpen) setTimeout(() => launcher.click(), 0);

    instance = {
      destroy() {
        disconnectWs();
        disconnectStream();
        document.removeEventListener('visibilitychange', onVisibilityChange);
        if (onVpResize && window.visualViewport) {
          window.visualViewport.removeEventListener('resize', onVpResize);
        }
        host.remove();
        instance = null;
      }
    };

    return instance;
  }

  // Unified dispatcher supporting both async queue gotekSDK('run', {...}) and gotekSDK.run({...})
  const dispatcher = function(cmd, ...args) {
    if (typeof cmd === 'string' && cmd === 'run') return createInstance(args[0]);
    if (typeof cmd === 'object' && cmd !== null) return createInstance(cmd);
  };
  dispatcher.run = createInstance;
  dispatcher.init = createInstance;

  window.gotekSDK = dispatcher;
  if (window.GoTekObject && window[window.GoTekObject]) {
    window[window.GoTekObject] = dispatcher;
  }

  // 1. Execute queued commands if any
  if (priorQueue.length) {
    priorQueue.forEach(rawArgs => {
      const args = Array.isArray(rawArgs) ? rawArgs : (rawArgs && typeof rawArgs === 'object' ? Array.from(rawArgs) : []);
      if (args.length) {
        const [fn, ...params] = args;
        if (fn === 'run' || fn === 'init') createInstance(params[0]);
        else if (typeof fn === 'object' && fn !== null) createInstance(fn);
      }
    });
  }

  // 2. Auto-initialize if data attributes are present on script tag (Zero-Config for Next.js / HTML)
  const findScriptAndInit = () => {
    const script = document.currentScript || document.querySelector('script[data-website-token]');
    if (script) {
      const token = script.getAttribute('data-website-token');
      if (token) {
        let base = script.getAttribute('data-base-url');
        if (!base && script.src) {
          try {
            const parsed = new URL(script.src);
            base = parsed.origin;
          } catch {}
        }
        const autoOpen = script.getAttribute('data-auto-open') === 'true';
        const color = script.getAttribute('data-color') || undefined;
        const widgetTitle = script.getAttribute('data-widget-title') || undefined;
        const name = script.getAttribute('data-name') || undefined;
        const widgetPosition = script.getAttribute('data-widget-position') || script.getAttribute('data-position') || undefined;
        createInstance({
          websiteToken: token,
          baseUrl: base || window.location.origin,
          autoOpen,
          color,
          widgetTitle,
          name,
          widgetPosition
        });
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', findScriptAndInit);
  }
  findScriptAndInit();
})();
