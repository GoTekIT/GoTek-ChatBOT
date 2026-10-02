import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../api/api';

interface WidgetMessage {
  id: string;
  sender: 'visitor' | 'ai' | 'agent' | 'system';
  text: string;
  time: string;
  hasCitation?: boolean;
}

export const CustomerWidgetView: React.FC<{ onBackToConsole: () => void }> = ({ onBackToConsole }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [widgetWidth, setWidgetWidth] = useState<number>(400);
  const [widgetHeight, setWidgetHeight] = useState<number>(620);
  const [isDraggingCorner, setIsDraggingCorner] = useState<boolean>(false);

  const [messages, setMessages] = useState<WidgetMessage[]>([
    {
      id: 'w1',
      sender: 'visitor',
      text: "Hello! Our team has 500 members and we'd like to ask about Enterprise quarterly payment plans.",
      time: '10:41 AM',
    },
    {
      id: 'w2',
      sender: 'ai',
      text: 'Hi there! Yes, we support Enterprise quarterly payment structures for teams of 500+ members. Key highlights:\n• Dedicated account tier with 99.99% uptime SLA\n• Flexible quarterly billing with standard net-30 terms\n• Automated seat provisioning and SAML 2.0 SSO integration',
      time: '10:41 AM',
      hasCitation: true,
    },
    {
      id: 'w3',
      sender: 'visitor',
      text: 'Can I connect with a live customer specialist?',
      time: '10:42 AM',
    },
    {
      id: 'w4',
      sender: 'system',
      text: 'Alex Rivera (Enterprise Consultant) joined the conversation',
      time: '10:42 AM',
    },
    {
      id: 'w5',
      sender: 'agent',
      text: 'Hi there! I am Alex from the Enterprise team. I can prepare a custom quote and schedule a 15-minute briefing today.',
      time: '10:43 AM',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [activeChartTab, setActiveChartTab] = useState<'30' | 'quarterly'>('quarterly');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isMinimized]);

  // Corner resize dragging logic for floating widget
  useEffect(() => {
    if (!isDraggingCorner) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Widget is docked at bottom right (window.innerWidth - e.clientX = width, window.innerHeight - e.clientY = height)
      const newWidth = Math.max(320, Math.min(window.innerWidth - 40, window.innerWidth - e.clientX));
      const newHeight = Math.max(420, Math.min(window.innerHeight - 80, window.innerHeight - e.clientY));
      setWidgetWidth(newWidth);
      setWidgetHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDraggingCorner(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingCorner]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: WidgetMessage = {
      id: `w-${Date.now()}`,
      sender: 'visitor',
      text: inputText.trim(),
      time: timeStr,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    // Simulate agent response
    setTimeout(() => {
      const agentReply: WidgetMessage = {
        id: `w-${Date.now() + 1}`,
        sender: 'agent',
        text: "Got your note! I'm reviewing our current quarterly pricing schedule for the 500-seat tier now. Would you like to review an NDA draft as well?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, agentReply]);
    }, 1000);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#f2f3ff] overflow-y-auto">
      {/* Top Banner with Quick Switcher Back to Support Console */}
      <div className="bg-[#131b2e] text-white px-4 py-2 flex items-center justify-between text-xs shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="font-semibold">Simulated Visitor Environment</span>
          <span className="text-[#c7c4d8] hidden sm:inline">• Testing GoTek Live Chat Widget with Grounded RAG</span>
        </div>
        <button
          onClick={onBackToConsole}
          className="px-3 py-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <span className="material-symbols-outlined text-[14px]">arrow_back</span>
          <span>Back to Console</span>
        </button>
      </div>

      {/* Simulated Host Application: Acme Cloud Operations Dashboard */}
      <div className="flex-1 flex flex-col pointer-events-auto">
        {/* Simulated SaaS Top Navigation */}
        <header className="w-full bg-white border-b border-[#c7c4d8]/40 px-6 py-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[#3525cd] flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-[18px]">space_dashboard</span>
              </div>
              <span className="font-bold text-[#131b2e] tracking-tight text-sm">
                Acme Cloud Operations
              </span>
            </div>
            <nav className="hidden md:flex items-center gap-1 pl-4 text-xs font-medium text-[#464555]">
              <span className="px-3 py-1.5 rounded text-[#3525cd] font-semibold bg-[#eaedff]">
                Workspaces
              </span>
              <span className="px-3 py-1.5 rounded hover:text-[#131b2e] cursor-pointer">
                Infrastructure
              </span>
              <span className="px-3 py-1.5 rounded hover:text-[#131b2e] cursor-pointer">
                Telemetry
              </span>
              <span className="px-3 py-1.5 rounded hover:text-[#131b2e] cursor-pointer">
                Billing & Plans
              </span>
              <span className="px-3 py-1.5 rounded hover:text-[#131b2e] cursor-pointer">
                Access Control
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-2 text-[#777587] text-[16px]">
                search
              </span>
              <input
                className="pl-8 pr-4 py-1 text-xs bg-[#f2f3ff] border border-[#c7c4d8]/60 rounded text-[#131b2e] placeholder:text-[#777587] w-56 focus:outline-none"
                placeholder="Search resources, metrics..."
                type="text"
                readOnly
              />
            </div>
            <div className="h-5 w-px bg-[#c7c4d8]/50"></div>
            <button className="p-1 rounded text-[#464555] hover:bg-[#eaedff] relative">
              <span className="material-symbols-outlined text-[18px]">notifications</span>
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"></span>
            </button>
            <div className="w-7 h-7 rounded-full overflow-hidden border border-[#c7c4d8]">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDSCupxkTS4b3n9lyGYCXb1H0pAWFt7QC9pS7Z15N5WnQDyFhc_2lOYn--STrZUMrVLNfot57lhIdYtVAtgi_-_wlpS3puH0xxIGBWsExW-vsoARDemaYi3q81QQbDYkkqmjpyCL8RT-SHBUGVA7qvolJ2_nH-purA7Gt9Zp4guyNYUDaUymCyl_idPrxrx3A_oAzEwY4l3SjzW_Tu9CHPrFpmG4Ctn1BkdrJF-9spw2Ny0PiuRMKxW"
                alt="Account User Profile"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </header>

        {/* Dashboard Content Grid */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full grid grid-cols-12 gap-6 select-none opacity-85">
          <div className="col-span-12 flex items-center justify-between pb-2 border-b border-[#c7c4d8]/30">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[#131b2e]">
                Enterprise Fleet Overview
              </h1>
              <p className="text-xs text-[#464555]">
                Real-time status of 500 active node orchestrators across EU-West and US-East regions.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> System Healthy 99.99%
              </span>
            </div>
          </div>

          {/* 4 KPI Metrics */}
          <div className="col-span-12 md:col-span-3 p-4 rounded-xl bg-white border border-[#c7c4d8]/60 shadow-xs">
            <p className="text-[11px] text-[#464555] uppercase tracking-wider font-semibold">
              Total Compute Cost (MTD)
            </p>
            <p className="text-xl font-bold text-[#131b2e] mt-1 font-mono">$42,850.00</p>
            <p className="text-xs text-emerald-700 font-medium mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">trending_up</span> +3.2% vs last cycle
            </p>
          </div>

          <div className="col-span-12 md:col-span-3 p-4 rounded-xl bg-white border border-[#c7c4d8]/60 shadow-xs">
            <p className="text-[11px] text-[#464555] uppercase tracking-wider font-semibold">
              Active Provisioned Seats
            </p>
            <p className="text-xl font-bold text-[#131b2e] mt-1 font-mono">500 / 500</p>
            <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">info</span> Capacity reached
            </p>
          </div>

          <div className="col-span-12 md:col-span-3 p-4 rounded-xl bg-white border border-[#c7c4d8]/60 shadow-xs">
            <p className="text-[11px] text-[#464555] uppercase tracking-wider font-semibold">
              Average API Latency
            </p>
            <p className="text-xl font-bold text-[#131b2e] mt-1 font-mono">18.4 ms</p>
            <p className="text-xs text-emerald-700 font-medium mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">check_circle</span> Optimal response
            </p>
          </div>

          <div className="col-span-12 md:col-span-3 p-4 rounded-xl bg-white border border-[#c7c4d8]/60 shadow-xs">
            <p className="text-[11px] text-[#464555] uppercase tracking-wider font-semibold">
              Security & SAML SSO
            </p>
            <p className="text-xl font-bold text-[#131b2e] mt-1">Enforced</p>
            <p className="text-xs text-[#3525cd] font-medium mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">verified_user</span> Okta v2.4 connected
            </p>
          </div>

          {/* Consumption Chart */}
          <div className="col-span-12 md:col-span-8 p-5 rounded-xl bg-white border border-[#c7c4d8]/60 shadow-xs flex flex-col justify-between min-h-[280px]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-xs text-[#131b2e]">Cluster Consumption vs Quota</h3>
                <p className="text-[11px] text-[#777587]">Tracking hourly requests throughput</p>
              </div>
              <div className="flex gap-1.5 text-xs">
                <button
                  onClick={() => setActiveChartTab('30')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    activeChartTab === '30'
                      ? 'bg-[#3525cd] text-white'
                      : 'bg-[#eaedff] text-[#464555]'
                  }`}
                >
                  30 Days
                </button>
                <button
                  onClick={() => setActiveChartTab('quarterly')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    activeChartTab === 'quarterly'
                      ? 'bg-[#3525cd] text-white'
                      : 'bg-[#eaedff] text-[#464555]'
                  }`}
                >
                  Quarterly
                </button>
              </div>
            </div>

            {/* Mock Bars */}
            <div className="h-36 w-full flex items-end gap-3 pt-4 px-2">
              <div className="flex-1 bg-[#dae2fd] rounded-t h-[40%]"></div>
              <div className="flex-1 bg-[#dae2fd] rounded-t h-[55%]"></div>
              <div className="flex-1 bg-[#dae2fd] rounded-t h-[48%]"></div>
              <div className="flex-1 bg-[#dae2fd] rounded-t h-[65%]"></div>
              <div className="flex-1 bg-[#dae2fd] rounded-t h-[75%]"></div>
              <div className="flex-1 bg-[#dae2fd] rounded-t h-[60%]"></div>
              <div className="flex-1 bg-[#dae2fd] rounded-t h-[82%]"></div>
              <div className="flex-1 bg-[#dae2fd] rounded-t h-[94%]"></div>
              <div className="flex-1 bg-[#4f46e5] rounded-t h-[98%] shadow-xs"></div>
              <div className="flex-1 bg-[#dae2fd] rounded-t h-[70%]"></div>
              <div className="flex-1 bg-[#dae2fd] rounded-t h-[64%]"></div>
              <div className="flex-1 bg-[#dae2fd] rounded-t h-[80%]"></div>
            </div>

            <div className="flex justify-between text-[11px] text-[#777587] pt-2 border-t border-[#c7c4d8]/30">
              <span>Week 1</span>
              <span>Week 2</span>
              <span>Week 3</span>
              <span>Week 4 (Peak Enterprise Load)</span>
            </div>
          </div>

          {/* Contract Terms */}
          <div className="col-span-12 md:col-span-4 p-5 rounded-xl bg-white border border-[#c7c4d8]/60 shadow-xs flex flex-col justify-between">
            <h3 className="font-semibold text-xs text-[#131b2e] mb-3">Enterprise Contract Terms</h3>
            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded bg-[#f2f3ff] border border-[#c7c4d8]/40 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[#3525cd] text-[18px] mt-0.5">
                  description
                </span>
                <div>
                  <p className="font-semibold text-[#131b2e]">MSA Agreement 2024-2025</p>
                  <p className="text-[11px] text-[#464555]">Expires in 42 days • Renewal pending</p>
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#f2f3ff] border border-[#c7c4d8]/40 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[#6b38d4] text-[18px] mt-0.5">
                  schedule
                </span>
                <div>
                  <p className="font-semibold text-[#131b2e]">Payment Cadence</p>
                  <p className="text-[11px] text-[#464555]">Annual upfront (Migrating to Quarterly)</p>
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#f2f3ff] border border-[#c7c4d8]/40 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[#005338] text-[18px] mt-0.5">
                  support_agent
                </span>
                <div>
                  <p className="font-semibold text-[#131b2e]">Dedicated Support Pod</p>
                  <p className="text-[11px] text-[#464555]">Pod 04: EMEA/US High-Touch SLA</p>
                </div>
              </div>
            </div>
            <div className="pt-3 border-t border-[#c7c4d8]/40 text-[11px] text-[#777587]">
              Account Manager: Alex Rivera
            </div>
          </div>
        </main>
      </div>

      {/* ================= FLOATING CHAT WIDGET DOCKED AT BOTTOM-RIGHT ================= */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
        {!isMinimized ? (
          /* Chat Widget Card Container (Interactive Resizable & Maximizable) */
          <div
            style={{
              width: isMaximized ? 'min(720px, calc(100vw - 2.5rem))' : `${widgetWidth}px`,
              height: isMaximized ? 'calc(100vh - 5rem)' : `${widgetHeight}px`,
            }}
            className="max-w-[calc(100vw-2rem)] max-h-[calc(100vh-3.5rem)] bg-white rounded-2xl border border-[#c7c4d8] shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 relative"
          >
            {/* Corner Resize Handle on Top-Left */}
            {!isMaximized && (
              <div
                onMouseDown={() => setIsDraggingCorner(true)}
                className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-30 group flex items-start justify-start p-0.5"
                title="Kéo góc này để chỉnh kích thước cửa sổ chat"
              >
                <div className="w-2.5 h-2.5 border-t-2 border-l-2 border-[#777587] group-hover:border-[#3525cd] transition-colors rounded-tl-sm"></div>
              </div>
            )}

            {/* Top Header Section */}
            <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#c7c4d8]/50 select-none">
              <div className="flex items-center gap-2.5">
                <div className="relative flex items-center justify-center">
                  <div className="w-8 h-8 rounded-lg bg-white border border-[#c7c4d8]/70 flex items-center justify-center p-1 shadow-xs">
                    <img src="/gotek-logo.png" alt="GoTek" className="w-full h-full object-contain" />
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white"
                    title="Online & Ready"
                  ></span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-[#131b2e] font-bold text-xs leading-tight tracking-tight">
                      GoTek Support
                    </h2>
                    <span className="bg-[#e9ddff] text-[#6b38d4] text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                      AI + LIVE
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 leading-tight mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block"></span>
                    <span>Online & Ready</span>
                  </p>
                </div>
              </div>

              {/* Window Controls: Maximize, Minimize, Close */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="w-7 h-7 rounded hover:bg-[#f2f3ff] text-[#464555] flex items-center justify-center transition-colors"
                  title={isMaximized ? "Thu nhỏ lại kích thước chuẩn" : "Phóng to cửa sổ chat"}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isMaximized ? 'close_fullscreen' : 'open_in_full'}
                  </span>
                </button>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="w-7 h-7 rounded hover:bg-[#f2f3ff] text-[#464555] flex items-center justify-center transition-colors"
                  title="Minimize"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">remove</span>
                </button>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="w-7 h-7 rounded hover:bg-[#f2f3ff] text-[#464555] flex items-center justify-center transition-colors"
                  title="Close"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </header>

            {/* Message Stream */}
            <div className="flex-1 p-3.5 space-y-3 overflow-y-auto widget-scrollbar bg-[#faf8ff] text-xs custom-scrollbar">
              {/* Security Banner */}
              <div className="flex items-center justify-center my-1">
                <div className="bg-[#f2f3ff] border border-[#c7c4d8]/60 rounded px-2.5 py-1 text-center max-w-[95%] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px] text-[#3525cd] shrink-0">
                    lock
                  </span>
                  <p className="text-[#464555] text-[10px] leading-tight">
                    End-to-end encrypted session • Grounded with Acme Knowledge
                  </p>
                </div>
              </div>

              {messages.map((m) => {
                if (m.sender === 'visitor') {
                  return (
                    <div key={m.id} className="flex flex-col items-end gap-1 pl-8">
                      <div className="flex items-center gap-1 text-right pr-0.5">
                        <span className="text-[10px] text-[#777587]">Visitor (You)</span>
                        <span className="text-[10px] text-[#777587] font-mono">{m.time}</span>
                      </div>
                      <div className="bg-[#4f46e5] text-white px-3.5 py-2 rounded-xl rounded-tr-xs text-xs shadow-xs leading-relaxed max-w-[90%]">
                        {m.text}
                      </div>
                    </div>
                  );
                }

                if (m.sender === 'system') {
                  return (
                    <div key={m.id} className="flex items-center justify-center my-2">
                      <div className="bg-[#e9ddff]/60 border border-[#d0bcff] rounded px-3 py-1 text-center max-w-[90%] flex items-center gap-1.5 shadow-xs">
                        <span className="material-symbols-outlined text-[14px] text-[#6b38d4]">
                          transfer_within_a_station
                        </span>
                        <p className="text-[#23005c] text-[10px] font-semibold">
                          <strong>Alex Rivera</strong> (Enterprise Consultant) joined the conversation
                        </p>
                      </div>
                    </div>
                  );
                }

                if (m.sender === 'ai') {
                  return (
                    <div key={m.id} className="flex items-start gap-2 pr-4">
                      <div className="w-7 h-7 rounded-full bg-[#eaedff] text-[#3525cd] flex items-center justify-center shrink-0 mt-1 border border-[#c7c4d8]/50">
                        <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                      </div>
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-1 pl-0.5">
                          <span className="text-[10px] font-bold text-[#131b2e]">
                            GoTek AI Specialist
                          </span>
                          <span className="text-[10px] text-[#777587] font-mono">{m.time}</span>
                        </div>
                        <div className="bg-white text-[#131b2e] px-3.5 py-2.5 rounded-xl rounded-tl-xs text-xs shadow-xs border border-[#c7c4d8]/50 space-y-2 leading-relaxed">
                          <div className="whitespace-pre-wrap">{m.text}</div>
                          {m.hasCitation && (
                            <div className="pt-1 border-t border-[#eaedff]">
                              <div className="flex items-center gap-2 p-1.5 rounded bg-[#f2f3ff] border border-[#c7c4d8]/70 hover:border-[#3525cd] transition-all cursor-pointer">
                                <div className="w-6 h-6 rounded bg-[#eaedff] flex items-center justify-center text-[#3525cd] shrink-0">
                                  <span className="material-symbols-outlined text-[14px]">
                                    description
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-semibold text-[#131b2e] truncate">
                                    Enterprise_Policy_2025.pdf
                                  </p>
                                  <p className="text-[9px] text-emerald-700 font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    <span>98% match • Acme Knowledge Base</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (m.sender === 'agent') {
                  return (
                    <div key={m.id} className="flex items-start gap-2 pr-4">
                      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mt-1 border border-[#3525cd]/40">
                        <img
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCHLYbdc1Bhd6xVJZPC6jVbG-qC2cR--2snmSYxT8CF3e8VasIhvdl_3stkduM90vKRJEmtRoE87GQ3g841hrVm_VslPasNr_Lxb19BndtOk349n_k8sf2EuWmpOLS-gO7o43kJVzlwwyG1lTjBBjlV01sqCWFggZ7NLC1RrAAhlM15IU6mW9u3dhjmQKfm5x-erwkPOlcrcnA-dHMY1a7JPzd64Iw11xkvIyZXNLvYjkKU2_1Xa4GP"
                          alt="Alex Rivera"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-1 pl-0.5">
                          <span className="text-[10px] font-bold text-[#131b2e]">Alex Rivera</span>
                          <span className="text-[9px] bg-[#eaedff] text-[#3525cd] px-1 py-0.2 rounded font-semibold">
                            Enterprise Consultant
                          </span>
                          <span className="text-[10px] text-[#777587] font-mono">{m.time}</span>
                        </div>
                        <div className="bg-white text-[#131b2e] px-3.5 py-2.5 rounded-xl rounded-tl-xs text-xs shadow-xs border border-[#c7c4d8]/50 leading-relaxed">
                          {m.text}
                        </div>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Input Section */}
            <footer className="p-3 bg-white border-t border-[#c7c4d8]/40 space-y-2">
              <form onSubmit={handleSendMessage} className="flex flex-col gap-1.5">
                <div className="relative flex items-center bg-[#f2f3ff] rounded-xl border border-[#c7c4d8]/80 focus-within:border-[#3525cd] focus-within:ring-1 focus-within:ring-[#3525cd] transition-all px-3 py-1.5">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type your message..."
                    className="w-full bg-transparent border-0 text-[#131b2e] text-xs placeholder:text-[#777587] focus:outline-none p-0.5"
                  />
                  <div className="flex items-center gap-1 pl-1 shrink-0">
                    <button
                      type="button"
                      className="p-1 rounded text-[#464555] hover:text-[#3525cd] hover:bg-[#eaedff] transition-colors"
                      title="Attach Document"
                    >
                      <span className="material-symbols-outlined text-[18px]">attach_file</span>
                    </button>
                    <button
                      type="submit"
                      disabled={!inputText.trim()}
                      className="ml-1 w-7 h-7 rounded bg-[#3525cd] hover:bg-[#4f46e5] text-white flex items-center justify-center transition-all shadow-xs disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-[15px]">send</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1 text-[10px] text-[#777587]">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[11px] text-emerald-700">
                      shield
                    </span>
                    <span>Protected by GoTek RLS Security</span>
                  </span>
                  <span className="flex items-center gap-1 text-[#3525cd] font-semibold">
                    <span className="material-symbols-outlined text-[11px]">bolt</span>
                    <span>Instant Handoff</span>
                  </span>
                </div>
              </form>
            </footer>
          </div>
        ) : (
          /* Collapsed Launcher Bubble */
          <div
            onClick={() => setIsMinimized(false)}
            className="cursor-pointer group flex items-center gap-2"
          >
            <div className="bg-white text-[#131b2e] px-3.5 py-2 rounded-full shadow-xl border border-[#c7c4d8] text-xs font-bold flex items-center gap-2 group-hover:scale-105 transition-all">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Chat with Enterprise Support</span>
            </div>
            <button className="w-13 h-13 rounded-full bg-white border-2 border-[#3525cd] shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all p-2.5">
              <img src="/gotek-logo.png" alt="GoTek" className="w-full h-full object-contain" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
