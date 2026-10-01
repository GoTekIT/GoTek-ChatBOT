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
    :host{all:initial;color:#0a1a4f;font:14px Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
    *{box-sizing:border-box}
    button,textarea,input{font:inherit}
    button{cursor:pointer}
    button:focus-visible,textarea:focus-visible,input:focus-visible{outline:3px solid #7bc7ff;outline-offset:2px}
    .launcher{position:fixed;right:22px;bottom:22px;z-index:2147483000;display:flex;align-items:center;gap:9px;min-height:48px;padding:0 18px;border:0;border-radius:999px;background:linear-gradient(135deg,#0057e1,#0878d9);box-shadow:0 12px 28px #052d7d3d;color:#fff;font-weight:700;transition:transform .18s ease,box-shadow .18s ease}
    .launcher:hover{transform:translateY(-2px);box-shadow:0 15px 32px #052d7d52}
    .mark{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;background:#ffffff2b;font-weight:800}
    .panel{position:fixed;right:22px;bottom:82px;z-index:2147483000;display:flex;flex-direction:column;width:min(390px,calc(100vw - 24px));height:min(620px,calc(100dvh - 104px));min-height:430px;overflow:hidden;border:1px solid #dce5f1;border-radius:20px;background:#fff;box-shadow:0 22px 60px #1020502b;transition:height .15s ease}
    .panel[hidden],.handoff[hidden],.reconnect[hidden]{display:none}
    .header{display:flex;align-items:center;justify-content:space-between;padding:17px 18px;background:linear-gradient(135deg,#063a9f,#0057e1);color:#fff}
    .brand{display:flex;align-items:center;gap:10px}
    .brand small{display:block;margin-top:2px;color:#dbeaff;font-size:11px}
    .close{width:32px;height:32px;border:1px solid #ffffff52;border-radius:9px;background:#ffffff18;color:#fff;font-size:20px}
    .meta{padding:10px 18px;border-bottom:1px solid #edf2f7;background:#fff}
    .statusrow{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .status{margin:0;color:#405474;font-size:12px;font-weight:700}
    .status:before{content:'';display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#1bb978}
    .handoff{border:1px solid #b9d6ff;border-radius:999px;padding:6px 10px;background:#f3f8ff;color:#0057e1;font-size:11px;font-weight:700}
    .handoff:disabled{cursor:wait;opacity:.65}
    .prechat{flex:1;overflow-y:auto;padding:16px;background:#fbfdff;display:flex;flex-direction:column}
    .prechat[hidden]{display:none}
    .prechat-card{background:#ffffff;border:1px solid #dce5f1;border-radius:14px;padding:16px 14px;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
    .prechat-intro{margin:0 0 14px;color:#4b5563;font-size:13px;line-height:1.5}
    .prechat form{display:grid;gap:12px}
    .prechat-field{display:grid;gap:5px}
    .prechat-field-title{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600;color:#1f2937}
    .prechat-req-star{color:#dc2626;margin-left:3px;font-weight:bold}
    .prechat-req-badge{font-size:10px;font-weight:600;color:#dc2626;background:#fef2f2;padding:2px 6px;border-radius:4px;border:1px solid #fecaca}
    .prechat input{width:100%;box-sizing:border-box;border:1px solid #cbd7e8;border-radius:8px;padding:10px 12px;font-size:13px;outline:none;transition:border-color .15s}
    .prechat input:focus{border-color:var(--gotek-primary,#0057e1);box-shadow:0 0 0 3px rgba(0,87,225,0.12)}
    .prechat button.prechat-submit{border:0;border-radius:9px;padding:11px 16px;background:var(--gotek-primary,#0057e1);color:#fff;font-weight:700;font-size:13px;cursor:pointer;margin-top:4px;transition:opacity .15s}
    .prechat button.prechat-submit:disabled{cursor:wait;opacity:0.7}
    .messages{flex:1;overflow:auto;padding:14px 18px;background:#fbfdff}
    .empty{margin:24px 0;color:#8290a8;text-align:center;font-size:12px;line-height:1.5}
    .bubble{width:fit-content;max-width:88%;margin:8px 0;padding:10px 12px;border-radius:14px 14px 14px 4px;background:#edf2f8;color:#253957;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
    .bubble.visitor{margin-left:auto;border-radius:14px 14px 4px 14px;background:#e5f0ff;color:#073e9e}
    .bubble.optimistic{opacity:0.75}
    .bubble.failed{background:#fee2e2;color:#991b1b;border:1px dashed #f87171;cursor:pointer}
    .typing{display:flex;align-items:center;gap:6px;width:fit-content;margin:6px 0;padding:8px 12px;border-radius:14px 14px 14px 4px;background:#edf2f8;color:#506484;font-size:12px;animation:gotekFadeIn .2s ease}
    .typing-dots{display:inline-flex;gap:3px;align-items:center}
    .typing-dots span{width:5px;height:5px;border-radius:50%;background:#647693;animation:gotekPulse 1.4s infinite ease-in-out both}
    .typing-dots span:nth-child(1){animation-delay:-0.32s}
    .typing-dots span:nth-child(2){animation-delay:-0.16s}
    @keyframes gotekPulse{0%,80%,100%{transform:scale(0.3);opacity:0.4}40%{transform:scale(1);opacity:1}}
    @keyframes gotekFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
    .composer{display:flex;flex-direction:column;gap:6px;padding:10px 16px 12px;border-top:1px solid #e8eef6;background:#fff}
    .input-row{display:flex;align-items:flex-end;gap:8px;background:#f8fafc;border:1px solid #cbd7e8;border-radius:18px;padding:4px 6px 4px 14px;transition:all .15s ease}
    .input-row:focus-within{background:#fff;border-color:#0057e1;box-shadow:0 0 0 3px rgba(0,87,225,0.12)}
    .composer textarea{flex:1;min-height:24px;max-height:96px;resize:none;border:none;outline:none;background:transparent;padding:6px 0;color:#0a1a4f;font-size:13.5px;line-height:1.4}
    .composer textarea::placeholder{color:#94a3b8}
    .footer{display:flex;align-items:center;justify-content:flex-start;padding:0 4px}
    .privacy{color:#94a3b8;font-size:10px}
    .send{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;min-width:34px;border:0;border-radius:50%;background:#0057e1;color:#fff;cursor:pointer;transition:transform .12s ease,opacity .15s ease,background-color .15s ease;padding:0;margin-bottom:2px}
    .send:hover{transform:scale(1.06)}
    .send:active{transform:scale(0.94)}
    .send:disabled{opacity:0.4;cursor:not-allowed;transform:none}
    .send svg{display:block;margin-left:2px}
    .reconnect{border:0;border-radius:9px;padding:10px 14px;margin:0 18px 10px;background:#fff1f2;color:#a62a3b;font-weight:700}
    .error{min-height:17px;margin:0 18px;color:#a62a3b;font-size:12px;line-height:1.35}
    @media(max-width:520px){
      .launcher{right:12px;bottom:12px}
      .panel{right:12px;bottom:70px;width:calc(100vw - 24px);height:calc(100dvh - 82px);min-height:390px;border-radius:16px}
    }
    </style>
    <button class="launcher" type="button" aria-expanded="false" aria-controls="gotek-chat">
      <span class="mark" aria-hidden="true">G</span>
      <span class="launcher-label">Trò chuyện</span>
    </button>
    <section id="gotek-chat" class="panel" aria-label="Trò chuyện với GoTek" hidden>
      <header class="header">
        <div class="brand">
          <span class="mark" aria-hidden="true">G</span>
          <div><strong class="name">GoTek</strong><small>Hỗ trợ khách hàng</small></div>
        </div>
        <button class="close" type="button" aria-label="Đóng trò chuyện">×</button>
      </header>
      <div class="meta">
        <div class="statusrow">
          <p class="status" role="status" aria-live="polite"></p>
          <button class="handoff" type="button" hidden>Yêu cầu gặp nhân viên</button>
        </div>
      </div>
      <div class="prechat"></div>
      <div class="messages" role="log" aria-live="polite">
        <p class="empty">Bạn đang trò chuyện với đội ngũ hỗ trợ của doanh nghiệp.</p>
      </div>
      <p class="error" role="alert" aria-live="assertive"></p>
      <button class="reconnect" type="button" hidden>Kết nối lại</button>
      <form class="composer">
        <label for="gotek-message" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap">Nội dung tin nhắn</label>
        <div class="input-row">
          <textarea id="gotek-message" rows="1" required maxlength="10000" placeholder="Nhập tin nhắn của bạn…"></textarea>
          <button class="send" type="submit" aria-label="Gửi tin nhắn" title="Gửi tin nhắn">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
        <div class="footer">
          <small class="privacy">Thông tin chỉ dùng cho phiên hỗ trợ này.</small>
        </div>
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

    let currentGreeting = '';

    function renderGreeting(text) {
      if (!text || !text.trim()) return;
      empty.hidden = true;
      let node = messages.querySelector('.greeting-bubble');
      if (!node) {
        node = document.createElement('div');
        node.className = 'bubble greeting-bubble';
        node.setAttribute('data-id', 'system-greeting');
        if (empty && empty.parentNode === messages) {
          empty.after(node);
        } else {
          messages.prepend(node);
        }
      }
      node.textContent = text;
    }

    function applyAppearance(settings) {
      if (!settings) return;
      if (settings.name) $('.name').textContent = settings.name;
      if (settings.greeting) {
        currentGreeting = settings.available === false
          ? settings.greeting + ' (Hiện đang ngoài giờ hỗ trợ)'
          : settings.greeting;
        renderGreeting(currentGreeting);
      }
      if (settings.widgetTitle) {
        $('.launcher-label').textContent = settings.widgetTitle;
      } else if (settings.name) {
        $('.launcher-label').textContent = settings.name;
      }
      if (settings.color) {
        launcher.style.background = settings.color;
        launcher.style.boxShadow = '0 12px 28px ' + settings.color + '4d';
        header.style.background = settings.color;
        send.style.background = settings.color;
        host.style.setProperty('--gotek-primary', settings.color);
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
    let handoffBusy = false;
    let replyOwner = 'AI_ACTIVE', ownerVersion = 0;
    let tabHidden = false;

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
    }

    function setOwner(owner, version) {
      if (!Number.isInteger(version) || version < ownerVersion) return;
      replyOwner = owner;
      ownerVersion = version;
      status.textContent = owner === 'HUMAN_ACTIVE'
        ? 'Nhân viên đang hỗ trợ'
        : owner === 'HANDOFF_PENDING'
          ? 'Đang kết nối nhân viên'
          : owner === 'AI_ACTIVE'
            ? 'Trợ lý AI đang hỗ trợ'
            : 'Đang kết nối hỗ trợ';
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

      const node = document.createElement('div');
      const isVisitor = message.author_type === 'visitor';
      node.className = 'bubble ' + (isVisitor ? 'visitor' : '') + (message.optimistic ? ' optimistic' : '');
      if (message.client_id) node.setAttribute('data-client-id', message.client_id);
      if (message.id) node.setAttribute('data-id', message.id);
      node.textContent = message.body;

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
        const rows = await api('/messages?after=' + cursor);
        for (const message of rows) {
          render(message);
          cursor = Math.max(cursor, message.sequence || 0);
          if (message.author_type !== 'visitor' && message.id) receipts.add(message.id);
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
                  api('/receipts', 'POST', {messageIds: [msg.id]}).catch(() => {});
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
                api('/receipts', 'POST', {messageIds: [msg.id]}).catch(() => {});
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
      panel.hidden = !panel.hidden;
      launcher.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) {
        if (!token) void connect();
        else if (profileReady) {
          connectRealtime();
          void syncMessages();
        }
        textarea.focus();
      }
    };

    close.onclick = () => {
      panel.hidden = true;
      launcher.setAttribute('aria-expanded', 'false');
      launcher.focus();
    };

    reconnect.onclick = connect;
    handoff.onclick = requestHuman;

    // Broadcast visitor typing indicator to agent console (via WebSocket or HTTP)
    let typingTimer = null;
    let isBroadcastingTyping = false;
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 96) + 'px';
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
        optimistic: true
      });

      textarea.value = '';
      textarea.style.height = '';
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
