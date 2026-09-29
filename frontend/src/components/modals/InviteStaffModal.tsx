import React, { useState } from 'react';
import { StaffMember, StaffRole } from '../../types';

interface InviteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (member: StaffMember) => void;
  availableSeats: number;
}

export const InviteStaffModal: React.FC<InviteStaffModalProps> = ({
  isOpen,
  onClose,
  onInvite,
  availableSeats,
}) => {
  const [email, setEmail] = useState('jordan.hayes@acme.com');
  const [name, setName] = useState('Jordan Hayes');
  const [role, setRole] = useState<StaffRole>('admin');
  const [channels, setChannels] = useState<string[]>([
    'Website Live Widget (Primary)',
    'Slack Workspace Integration',
  ]);
  const [capacity, setCapacity] = useState(5);
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const toggleChannel = (ch: string) => {
    if (channels.includes(ch)) {
      setChannels(channels.filter((c) => c !== ch));
    } else {
      setChannels([...channels, ch]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSending(true);

    setTimeout(() => {
      const newStaff: StaffMember = {
        id: `staff-${Date.now()}`,
        name: name.trim() || email.split('@')[0],
        email: email.trim(),
        avatarUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCHLYbdc1Bhd6xVJZPC6jVbG-qC2cR--2snmSYxT8CF3e8VasIhvdl_3stkduM90vKRJEmtRoE87GQ3g841hrVm_VslPasNr_Lxb19BndtOk349n_k8sf2EuWmpOLS-gO7o43kJVzlwwyG1lTjBBjlV01sqCWFggZ7NLC1RrAAhlM15IU6mW9u3dhjmQKfm5x-erwkPOlcrcnA-dHMY1a7JPzd64Iw11xkvIyZXNLvYjkKU2_1Xa4GP',
        role: role,
        roleTitle: role === 'admin' ? 'Workspace Admin' : 'Agent',
        status: 'online',
        statusText: 'Active (Invited)',
        activeChats: 0,
        maxChats: capacity,
        assignedChannels: channels.length > 0 ? channels : ['Website Widget'],
        lastActive: 'Invited Just Now',
        locationInfo: 'Okta SSO Dispatched',
      };

      onInvite(newStaff);
      setIsSending(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl border border-[#c7c4d8] shadow-2xl max-w-xl w-full overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[#c7c4d8]/70 flex items-center justify-between bg-[#f2f3ff]">
          <div>
            <h2 className="text-base font-bold text-[#131b2e]">
              Invite Team Member to Acme Corp
            </h2>
            <p className="text-xs text-[#464555] mt-0.5">
              Assign permissions, role tiers, and communication queue routes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[#777587] hover:bg-[#eaedff] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar text-xs">
            {/* Email Input */}
            <div>
              <label className="block text-xs font-semibold text-[#131b2e] mb-1">
                Work Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#777587] text-[18px]">
                  mail
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@acme.com"
                  className="w-full pl-9 pr-4 py-2 bg-white border border-[#c7c4d8] rounded text-xs text-[#131b2e] focus:outline-none focus:border-[#4f46e5]"
                  required
                />
              </div>
              <span className="text-[11px] text-[#464555] mt-1 block">
                An Okta SSO invitation link will be dispatched automatically.
              </span>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-xs font-semibold text-[#131b2e] mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jordan Hayes"
                className="w-full px-3 py-2 bg-white border border-[#c7c4d8] rounded text-xs text-[#131b2e] focus:outline-none focus:border-[#4f46e5]"
              />
            </div>

            {/* Role Selection Cards */}
            <div>
              <label className="block text-xs font-semibold text-[#131b2e] mb-1.5">
                Select Role & Access Level
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Workspace Admin */}
                <label
                  onClick={() => setRole('admin')}
                  className={`relative flex flex-col p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    role === 'admin'
                      ? 'border-[#3525cd] bg-[#eaedff]/40'
                      : 'border-[#c7c4d8] hover:border-[#777587] bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#3525cd] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">
                        admin_panel_settings
                      </span>
                      <span>Workspace Admin</span>
                    </span>
                    {role === 'admin' && (
                      <span className="w-4 h-4 rounded-full bg-[#3525cd] flex items-center justify-center text-white text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#464555] leading-snug">
                    Full privileges to configure bot AI handoffs, invite/manage staff, and modify integrations.
                  </p>
                </label>

                {/* Option 2: Support Agent */}
                <label
                  onClick={() => setRole('agent')}
                  className={`relative flex flex-col p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    role === 'agent'
                      ? 'border-[#3525cd] bg-[#eaedff]/40'
                      : 'border-[#c7c4d8] hover:border-[#777587] bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[#131b2e] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">
                        support_agent
                      </span>
                      <span>Agent</span>
                    </span>
                    {role === 'agent' && (
                      <span className="w-4 h-4 rounded-full bg-[#3525cd] flex items-center justify-center text-white text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#464555] leading-snug">
                    Access to live queue triage, conversational takeovers, macro execution, and private thread notes.
                  </p>
                </label>
              </div>
            </div>

            {/* Channel Routing Assignment Checkmarks */}
            <div>
              <label className="block text-xs font-semibold text-[#131b2e] mb-1.5">
                Channel Routing Assignment
              </label>
              <div className="space-y-2 border border-[#c7c4d8] rounded-lg p-3 bg-[#f2f3ff]">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channels.includes('Website Live Widget (Primary)')}
                    onChange={() => toggleChannel('Website Live Widget (Primary)')}
                    className="w-4 h-4 rounded text-[#3525cd] focus:ring-[#3525cd] border-[#c7c4d8]"
                  />
                  <div>
                    <span className="font-semibold text-xs text-[#131b2e]">
                      Website Live Widget (Primary)
                    </span>
                    <span className="text-[#777587] text-[11px] block">
                      Direct live web chat routing
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channels.includes('Slack Workspace Integration')}
                    onChange={() => toggleChannel('Slack Workspace Integration')}
                    className="w-4 h-4 rounded text-[#3525cd] focus:ring-[#3525cd] border-[#c7c4d8]"
                  />
                  <div>
                    <span className="font-semibold text-xs text-[#131b2e]">
                      Slack Workspace Integration
                    </span>
                    <span className="text-[#777587] text-[11px] block">
                      #support-escalations & direct triage
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channels.includes('VIP Banking Channel (Restricted)')}
                    onChange={() => toggleChannel('VIP Banking Channel (Restricted)')}
                    className="w-4 h-4 rounded text-[#3525cd] focus:ring-[#3525cd] border-[#c7c4d8]"
                  />
                  <div>
                    <span className="font-semibold text-xs text-[#131b2e]">
                      VIP Banking Channel (Restricted)
                    </span>
                    <span className="text-[#777587] text-[11px] block">
                      Requires Compliance Clearance Level 2
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Concurrent Chat Capacity Cap Slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#131b2e]">
                  Concurrent Chat Capacity Cap
                </label>
                <span className="font-mono font-bold text-xs text-[#3525cd]">
                  {capacity} Concurrent Chats
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full accent-[#3525cd] h-1.5 bg-[#eaedff] rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-[#777587]">
                <span>1 Light</span>
                <span>5 Standard</span>
                <span>10 High Load</span>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-[#c7c4d8]/70 bg-[#f2f3ff] flex items-center justify-between text-xs">
            <span className="text-[#464555] flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">
                check_circle
              </span>
              <span>Consumes 1 of {availableSeats} available seats</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded border border-[#c7c4d8] bg-white text-[#131b2e] hover:bg-[#eaedff] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="px-4 py-1.5 rounded bg-[#4f46e5] text-white font-semibold hover:bg-[#4338ca] active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-sm"
              >
                {isSending ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      progress_activity
                    </span>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    <span>Send Invite</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
