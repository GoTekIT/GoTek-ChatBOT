import React, { useState } from 'react';
import { StaffMember } from '../../types';
import { InviteStaffModal } from '../modals/InviteStaffModal';

interface StaffRolesViewProps {
  staffList: StaffMember[];
  onInviteMember: (m: StaffMember) => void;
  onUpdateMemberRole: (id: string, role: any) => void;
  onRevokeMember: (id: string) => void;
  onOpenAuditLogs: () => void;
}

export const StaffRolesView: React.FC<StaffRolesViewProps> = ({
  staffList,
  onInviteMember,
  onUpdateMemberRole,
  onRevokeMember,
  onOpenAuditLogs,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const filteredStaff = staffList.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.roleTitle.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (roleFilter !== 'all') {
      if (roleFilter === 'owner' && m.role !== 'owner') return false;
      if (roleFilter === 'admin' && m.role !== 'admin') return false;
      if (roleFilter === 'agent' && m.role !== 'agent') return false;
      if (roleFilter === 'temp' && m.role !== 'support_temp') return false;
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'active' && m.status !== 'online') return false;
      if (statusFilter === 'away' && m.status !== 'away') return false;
    }

    return true;
  });

  const availableSeats = 15 - staffList.length;

  const handleExportMatrix = () => {
    const headers = ['Member Name', 'Email', 'Role', 'Status', 'Active Chats', 'Assigned Channels', 'Last Active'];
    const rows = staffList.map((m) => [
      `"${m.name}"`,
      m.email,
      `"${m.roleTitle}"`,
      m.status,
      `${m.activeChats}/${m.maxChats}`,
      `"${m.assignedChannels.join(', ')}"`,
      `"${m.lastActive}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Acme_Staff_Access_Matrix_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Staff Access Matrix (RBAC) to CSV');
  };

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-[#faf8ff]">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#131b2e] text-white text-xs px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* PAGE HEADER & CONTEXT BLOCK */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#c7c4d8]/60 pb-6">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl md:text-2xl font-bold text-[#131b2e] tracking-tight">
              Staff & Role-Based Access Control
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-[#4f46e5]/10 text-[#3525cd] border border-[#3525cd]/20">
              RBAC Enabled
            </span>
          </div>
          <p className="text-xs text-[#464555]">
            Manage workspace members, assign granular roles (Workspace Owner, Workspace Admin, Agent), configure live chat assignment capacity, and track audit sessions.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleExportMatrix}
            className="px-3.5 py-2 border border-[#c7c4d8] rounded-lg bg-white text-[#131b2e] text-xs font-semibold hover:bg-[#f2f3ff] transition-colors flex items-center gap-2 shadow-xs"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">file_download</span>
            <span>Export Access Matrix</span>
          </button>

          {/* Primary CTA Button: Invite Member */}
          <button
            onClick={() => setIsInviteOpen(true)}
            className="px-4 py-2 bg-[#4f46e5] text-white rounded-lg text-xs font-semibold hover:bg-[#4338ca] active:scale-[0.98] transition-all flex items-center gap-2 shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Invite Member</span>
          </button>
        </div>
      </div>

      {/* METRIC / KPI WIDGETS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Active Staff */}
        <div className="p-4 rounded-xl bg-white border border-[#c7c4d8]/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#464555] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#777587]">
              Active Staff
            </span>
            <span className="material-symbols-outlined text-[#3525cd] text-[20px]">groups</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#131b2e]">{staffList.length}</span>
            <span className="text-xs text-[#464555]">members</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#c7c4d8]/40 flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-700 font-semibold">3 Online currently</span>
            <span className="text-[#777587] text-[11px]">• 2 Offline/Away</span>
          </div>
        </div>

        {/* Metric 2: Available Seats */}
        <div className="p-4 rounded-xl bg-white border border-[#c7c4d8]/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#464555] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#777587]">
              Available Seats
            </span>
            <span className="material-symbols-outlined text-[#6b38d4] text-[20px]">
              airline_seat_recline_normal
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#131b2e]">{availableSeats}</span>
            <span className="text-xs text-[#464555]">seats remaining</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#c7c4d8]/40 flex items-center justify-between">
            <div className="w-full bg-[#eaedff] rounded-full h-1.5 mr-2 overflow-hidden">
              <div
                className="bg-[#3525cd] h-1.5 rounded-full"
                style={{ width: `${(staffList.length / 15) * 100}%` }}
              ></div>
            </div>
            <span className="text-xs font-semibold text-[#464555] shrink-0 font-mono">
              {Math.round((staffList.length / 15) * 100)}%
            </span>
          </div>
        </div>

        {/* Metric 3: Support Grant Status */}
        <div className="p-4 rounded-xl bg-white border border-[#c7c4d8]/70 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-[#464555] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#777587]">
              Temp Support Grant
            </span>
            <span className="material-symbols-outlined text-amber-700 text-[20px]">lock_clock</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#fef3c7] text-[#92400E] border border-[#fde68a]">
              Active Grant
            </span>
            <span className="font-mono text-xs font-bold text-[#131b2e]">03h 42m TTL</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#c7c4d8]/40 flex items-center gap-1.5 text-xs text-[#464555]">
            <span className="material-symbols-outlined text-[14px] text-emerald-600">verified_user</span>
            <span>SRS FR-OPS-03 Compliant</span>
          </div>
        </div>

        {/* Metric 4: Auth & SSO Compliance */}
        <div className="p-4 rounded-xl bg-white border border-[#c7c4d8]/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#464555] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#777587]">
              Two-Factor / SAML
            </span>
            <span className="material-symbols-outlined text-emerald-700 text-[20px]">security</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-emerald-700">Enforced</span>
            <span className="text-xs text-[#464555]">(100%)</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#c7c4d8]/40 flex items-center justify-between text-xs">
            <span className="text-[#464555]">Okta Enterprise SSO</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              HEALTHY
            </span>
          </div>
        </div>
      </div>

      {/* FILTER / SEARCH CONTROLS ROW */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white border border-[#c7c4d8]/80 rounded-xl shadow-xs">
        {/* Search bar */}
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#777587] text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by member name, email or ID..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-[#f2f3ff] border border-[#c7c4d8] rounded focus:outline-none focus:border-[#4f46e5] text-[#131b2e] placeholder:text-[#777587]"
          />
        </div>

        {/* Dropdown filters */}
        <div className="flex items-center gap-2.5 flex-wrap text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#777587] uppercase">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="py-1.5 pl-2.5 pr-8 bg-[#f2f3ff] border border-[#c7c4d8] rounded text-xs text-[#131b2e] focus:outline-none focus:border-[#4f46e5]"
            >
              <option value="all">All Roles ({staffList.length})</option>
              <option value="owner">Workspace Owner</option>
              <option value="admin">Workspace Admin</option>
              <option value="agent">Agent</option>
              <option value="temp">Support Operator (Temp)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#777587] uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 pl-2.5 pr-8 bg-[#f2f3ff] border border-[#c7c4d8] rounded text-xs text-[#131b2e] focus:outline-none focus:border-[#4f46e5]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Online</option>
              <option value="away">Away / Offline</option>
            </select>
          </div>

          <div className="h-4 w-px bg-[#c7c4d8] mx-1"></div>

          <button
            onClick={() => showToast('Column display settings opened')}
            className="p-1.5 text-[#464555] hover:bg-[#f2f3ff] rounded border border-[#c7c4d8] transition-colors"
            title="Customize Columns"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">view_column</span>
          </button>
        </div>
      </div>

      {/* WORKSPACE MEMBERS DATA TABLE */}
      <div className="bg-white border border-[#c7c4d8]/70 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#f2f3ff] border-b border-[#c7c4d8]/70 text-[#464555] text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4 font-bold w-1/4">Member</th>
                <th className="py-3 px-4 font-bold">Assigned Role</th>
                <th className="py-3 px-4 font-bold">Live Status & Capacity</th>
                <th className="py-3 px-4 font-bold">Channel Assignment</th>
                <th className="py-3 px-4 font-bold">Last Active</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c7c4d8]/50 text-xs text-[#131b2e]">
              {filteredStaff.map((staff) => (
                <tr
                  key={staff.id}
                  className={`hover:bg-[#f2f3ff]/60 transition-colors group ${
                    staff.isTempGrant ? 'bg-amber-50/30' : ''
                  }`}
                >
                  {/* Member Column */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 rounded-full bg-[#eaedff] overflow-hidden ring-1 ring-[#c7c4d8] shrink-0 flex items-center justify-center font-bold text-[#3525cd]">
                        {staff.avatarUrl ? (
                          <img
                            src={staff.avatarUrl}
                            alt={staff.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-amber-800 text-[20px]">
                            engineering
                          </span>
                        )}
                        {staff.status === 'online' && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                        )}
                        {staff.status === 'away' && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white"></span>
                        )}
                        {staff.status === 'offline' && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-white"></span>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-[#131b2e] group-hover:text-[#3525cd] transition-colors flex items-center gap-1.5">
                          <span>{staff.name}</span>
                          {staff.isCurrentUser && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#eaedff] text-[#3525cd]">
                              You
                            </span>
                          )}
                          {staff.isTempGrant && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#fef3c7] text-amber-800 border border-[#fde68a]">
                              FR-OPS-03
                            </span>
                          )}
                          {staff.role === 'owner' && (
                            <span className="material-symbols-outlined text-amber-500 text-[16px]" title="Primary Billing Contact">
                              workspace_premium
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#464555] font-mono">{staff.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Assigned Role Column */}
                  <td className="py-3 px-4">
                    {staff.role === 'admin' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eef2ff] text-[#4f46e5] border border-[#c7d2fe]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4f46e5]"></span>
                        <span>Workspace Admin</span>
                      </span>
                    )}
                    {staff.role === 'owner' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-900 border border-purple-200">
                        <span className="material-symbols-outlined text-[14px]">shield_person</span>
                        <span>Workspace Owner</span>
                      </span>
                    )}
                    {staff.role === 'agent' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eaedff] text-[#464555] border border-[#c7c4d8]">
                        <span className="material-symbols-outlined text-[14px]">support_agent</span>
                        <span>Agent</span>
                      </span>
                    )}
                    {staff.role === 'support_temp' && (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300">
                          <span className="material-symbols-outlined text-[14px]">lock_clock</span>
                          <span>Support Operator</span>
                        </span>
                        <div className="font-mono text-[10px] text-amber-800 font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">timer</span>
                          <span>{staff.tempTtl}</span>
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Live Status & Capacity */}
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            staff.status === 'online'
                              ? 'bg-emerald-50 text-emerald-700'
                              : staff.status === 'away'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              staff.status === 'online'
                                ? 'bg-emerald-500'
                                : staff.status === 'away'
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`}
                          ></span>
                          <span>{staff.statusText}</span>
                        </span>
                        {staff.maxChats > 0 ? (
                          <span className="font-mono text-[11px] text-[#131b2e] font-semibold">
                            {staff.activeChats}/{staff.maxChats} Chats
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] text-[#777587]">0/0 Routing</span>
                        )}
                      </div>
                      {staff.maxChats > 0 && (
                        <div className="w-28 bg-[#eaedff] rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-[#4f46e5] h-1 rounded-full"
                            style={{
                              width: `${(staff.activeChats / staff.maxChats) * 100}%`,
                            }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Channel Assignment */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {staff.assignedChannels.map((ch, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-[#f2f3ff] border border-[#c7c4d8]/60 text-[11px] font-medium text-[#131b2e]"
                        >
                          {ch}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Last Active */}
                  <td className="py-3 px-4">
                    <div className="font-medium text-[#131b2e] flex items-center gap-1">
                      {staff.status === 'online' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      )}
                      <span>{staff.lastActive}</span>
                    </div>
                    <span className="text-[11px] text-[#777587]">{staff.locationInfo}</span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      {staff.isTempGrant ? (
                        <>
                          <button
                            onClick={() => {
                              onRevokeMember(staff.id);
                              showToast(`Revoked temporary grant for ${staff.email}`);
                            }}
                            className="px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors"
                            type="button"
                          >
                            Revoke Immediately
                          </button>
                          <button
                            onClick={onOpenAuditLogs}
                            className="p-1 text-[#464555] hover:text-[#3525cd] rounded transition-colors"
                            title="View Audit Log"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[18px]">history</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              const newRole = staff.role === 'admin' ? 'agent' : 'admin';
                              onUpdateMemberRole(staff.id, newRole);
                              showToast(`Updated ${staff.name}'s role to ${newRole}`);
                            }}
                            className="px-2 py-1 text-xs text-[#3525cd] hover:bg-[#eaedff] rounded transition-colors font-semibold"
                            type="button"
                          >
                            {staff.role === 'owner' ? 'Manage' : 'Edit Role'}
                          </button>
                          {staff.role !== 'owner' && (
                            <button
                              onClick={() => {
                                if (confirm(`Revoke workspace access for ${staff.name}?`)) {
                                  onRevokeMember(staff.id);
                                  showToast(`Revoked access for ${staff.name}`);
                                }
                              }}
                              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors font-medium"
                              type="button"
                            >
                              Revoke
                            </button>
                          )}
                          <button
                            onClick={() => showToast(`Actions drawer for ${staff.name}`)}
                            className="p-1 text-[#777587] hover:text-[#131b2e] rounded transition-colors"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[18px]">more_vert</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TABLE PAGINATION & SEAT UPGRADE ROW */}
        <div className="p-4 border-t border-[#c7c4d8]/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-[#464555] text-xs">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-[#131b2e]">1–{filteredStaff.length}</strong> of{' '}
              <strong className="text-[#131b2e]">{filteredStaff.length}</strong> members
            </span>
            <span className="text-[#777587]">•</span>
            <button
              onClick={() => showToast('Upgrade plan requested: contact Enterprise Billing')}
              className="text-[#3525cd] hover:underline font-semibold flex items-center gap-1"
            >
              <span>Need more concurrent seats? Upgrade Plan</span>
              <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled
              className="p-1.5 rounded border border-[#c7c4d8] text-[#777587] opacity-40 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <button className="px-2.5 py-1 rounded bg-[#3525cd] text-white font-semibold text-xs">
              1
            </button>
            <button
              disabled
              className="p-1.5 rounded border border-[#c7c4d8] text-[#777587] opacity-40 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* AUDIT & COMPLIANCE FOOTER NOTICE */}
      <div className="p-4 rounded-xl bg-[#f2f3ff] border border-[#c7c4d8]/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-[#3525cd] text-[24px] mt-0.5">verified</span>
          <div>
            <h2 className="text-xs font-bold text-[#131b2e]">Enterprise Audit Trail Enabled</h2>
            <p className="text-xs text-[#464555] mt-0.5">
              Changes to roles and seat grants are cryptographically logged in the Workspace Audit Log
              (FR-OPS-01). Support access grants conform strictly to temporary TTL restrictions.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenAuditLogs}
          className="px-3 py-1.5 rounded border border-[#c7c4d8] bg-white text-[#131b2e] text-xs font-semibold hover:bg-[#eaedff] transition-colors shrink-0 flex items-center gap-1.5 shadow-xs"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          <span>Inspect Log Archive</span>
        </button>
      </div>

      {/* Invite Member Modal */}
      <InviteStaffModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onInvite={(m) => {
          onInviteMember(m);
          showToast(`Invited ${m.name} (${m.email}) to workspace!`);
        }}
        availableSeats={availableSeats}
      />
    </main>
  );
};
