import React, { useState } from 'react';
import {MetaConnections} from './MetaConnections';

export const ChannelsView: React.FC<{scope:string;allowed:boolean}> = ({scope,allowed}) => {
  const [channels, setChannels] = useState([
    {
      id: 'web',
      name: 'Website Live Widget',
      type: 'Direct Web Chat',
      status: 'Active',
      icon: 'language',
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      description: 'Embedded JavaScript bundle on techcombank.com.vn & acme.com',
      conversationsCount: 1420,
    },
    {
      id: 'slack',
      name: 'Slack Enterprise Grid',
      type: '#support-escalations',
      status: 'Active',
      icon: 'hub',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: 'Real-time alert routing and bi-directional thread takeover',
      conversationsCount: 580,
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business API',
      type: 'Meta Cloud API',
      status: 'Active',
      icon: 'chat',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: 'Automated 24/7 client triage with instant human fallback',
      conversationsCount: 310,
    },
    {
      id: 'teams',
      name: 'Microsoft Teams',
      type: 'Bot Framework v4',
      status: 'Configuring',
      icon: 'groups',
      color: 'bg-amber-50 text-amber-800 border-amber-200',
      description: 'Internal employee helpdesk integration with Active Directory SSO',
      conversationsCount: 45,
    },
    {
      id: 'webhook',
      name: 'Custom Webhook Pipeline',
      type: 'REST / GraphQL',
      status: 'Active',
      icon: 'api',
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      description: 'Event-driven customer ingestion from external CRM and portals',
      conversationsCount: 890,
    },
  ]);

  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-[#faf8ff] text-xs">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#131b2e] text-white text-xs px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
          <span>{toast}</span>
        </div>
      )}

      <MetaConnections key={scope} scope={scope} allowed={allowed} />
      <p role="note">Các kênh mẫu bên dưới là giao diện minh họa, chưa xác nhận kết nối thực tế.</p>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#c7c4d8]/60 pb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#131b2e] tracking-tight">
            Channels & Omnichannel Integrations
          </h1>
          <p className="text-[#464555] mt-1">
            Connect customer endpoints with GoTek RAG pipeline, automated triage routing, and staff takeover.
          </p>
        </div>
        <button
          onClick={() => triggerToast('Integration setup wizard launched')}
          className="px-4 py-2 bg-[#4f46e5] text-white rounded-lg font-semibold hover:bg-[#4338ca] flex items-center gap-2 shadow-xs shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Add Channel</span>
        </button>
      </div>

      {/* Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map((ch) => (
          <div
            key={ch.id}
            className="p-5 bg-white border border-[#c7c4d8]/70 rounded-xl shadow-xs flex flex-col justify-between space-y-4 hover:border-[#3525cd] transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${ch.color}`}>
                  <span className="material-symbols-outlined text-[22px]">{ch.icon}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    ch.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {ch.status}
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#131b2e]">{ch.name}</h3>
              <p className="text-[11px] text-[#777587] font-mono mt-0.5">{ch.type}</p>
              <p className="text-[#464555] mt-2 leading-relaxed">{ch.description}</p>
            </div>

            <div className="pt-3 border-t border-[#eaedff] flex items-center justify-between">
              <span className="font-mono text-[#777587]">
                {ch.conversationsCount.toLocaleString()} chats
              </span>
              <button
                onClick={() => triggerToast(`Configuring ${ch.name}...`)}
                className="px-3 py-1 rounded bg-[#eaedff] text-[#3525cd] font-semibold hover:bg-[#e2e7ff] transition-colors"
              >
                Configure
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
};
