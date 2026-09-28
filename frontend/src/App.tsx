import React, {useState, useEffect} from 'react';
import {
  Settings,
  Users,
  ShieldCheck,
  LogOut,
  Building2,
  MessageSquare
} from 'lucide-react';
import {api, ApiError} from './api/api';
import {usePath, navigate} from './hooks/usePath';
import {Link} from './components/common/Link';
import {Notice} from './components/common/Notice';

// User & Role Screens
import {Auth} from './screens/auth/Auth';
import {Invite} from './screens/auth/Invite';
import {GeneralSettings} from './screens/settings/GeneralSettings';
import {MembersSettings} from './screens/settings/MembersSettings';
import {AuditSettings} from './screens/settings/AuditSettings';
import {DataCollection} from './screens/settings/DataCollection';
import {Support} from './screens/settings/Support';
import {Usage} from './screens/settings/Usage';
import {Jobs} from './screens/settings/Jobs';
import {Platform} from './screens/platform/Platform';
import {Channels} from './screens/channels/Channels';
import {Inbox} from './screens/inbox/Inbox';
import {AiRules} from './screens/ai-rules/AiRules';
import {WebSources} from './screens/knowledge/WebSources';
import {Knowledge} from './screens/knowledge/Knowledge';
import {KnowledgeRetrievalPreview} from './screens/knowledge/KnowledgeRetrievalPreview';

function routeTitle(path: string): string {
  if (path === '/settings/knowledge') return 'Kho thông tin';
  if (path === '/settings/data-collection') return 'Thu thập dữ liệu';
  if (path === '/dashboard') return 'Hội thoại';
  if (path.startsWith('/settings/inboxes')) return 'Hộp thư';
  if (path === '/settings/web-sources') return 'Nguồn web';
  if (path === '/settings/ai-rules') return 'Quy tắc AI';

  const titles: Record<string, string> = {
    '/settings/general': 'Cài đặt doanh nghiệp',
    '/settings/people/agents': 'Quản lý nhân sự',
    '/settings/support': 'Quyền hỗ trợ',
    '/settings/jobs': 'Tác vụ nền',
    '/settings/usage': 'Mức sử dụng',
    '/settings/audit': 'Nhật ký hoạt động'
  };

  return titles[path] ?? 'Cài đặt doanh nghiệp';
}

export function App() {
  const path = usePath();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setMe(await api('/me'));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'UNAUTHENTICATED') {
        setMe(null);
      } else {
        setError(e as Error);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function switchWorkspace(workspaceId: string) {
    setBusy(true);
    try {
      await api('/workspace/switch', 'POST', {workspaceId});
      setMe(null);
      await refresh();
      navigate('/settings/general');
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  if (path.startsWith('/platform/')) return <Platform />;

  if (path === '/app/invitation') {
    return (
      <Invite
        signedIn={!!me}
        onAccepted={async () => {
          await refresh();
          navigate('/settings/general');
        }}
        onLogin={() => {
          sessionStorage.setItem('gotek.pending-invite', location.pathname + location.hash);
          navigate('/app/login');
        }}
      />
    );
  }

  if (path.startsWith('/app/auth/') || path === '/app/login' || (!me && !loading)) {
    return (
      <div style={{position: 'relative', width: '100%', height: '100vh', overflow: 'hidden'}}>
        <div
          className="local-label"
          style={{
            position: 'absolute',
            top: 12,
            right: 16,
            zIndex: 50,
            pointerEvents: 'none',
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: 9999,
            padding: '4px 12px',
            fontSize: 11,
            color: '#64748b'
          }}
        >
          Môi trường local/test
        </div>
        <Auth key={path + location.search} path={path} onLogin={refresh} />
      </div>
    );
  }

  if (loading) return <p role="status" className="boot">Đang tải workspace…</p>;

  if (!me) {
    return (
      <div className="boot">
        <Notice error={error} />
        <button onClick={refresh}>Thử lại</button>
      </div>
    );
  }

  return (
    <div className="shell">
      <nav className="rail" aria-label="Điều hướng chính">
        <img src="/gotek-logo.png" alt="gotek" />
        <Link to="/dashboard" label="Hội thoại">
          <MessageSquare size={20} aria-hidden="true" />
        </Link>
        <Link to="/settings/general" label="Cài đặt doanh nghiệp">
          <Settings size={20} aria-hidden="true" />
        </Link>
        <button
          title="Đăng xuất"
          aria-label="Đăng xuất"
          onClick={async () => {
            try {
              await api('/auth/logout', 'POST', {});
              setMe(null);
              navigate('/app/login');
            } catch (e) {
              setError(e as Error);
            }
          }}
        >
          <LogOut size={20} aria-hidden="true" />
        </button>
      </nav>

      <aside>
        <div className="workspace">
          <label htmlFor="workspace">Workspace</label>
          <select
            id="workspace"
            value={me.workspaceId}
            disabled={busy}
            onChange={e => void switchWorkspace(e.target.value)}
          >
            {me.workspaces.map((w: any) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <small>{me.role}</small>
        </div>

        <h2>{path === '/dashboard' ? 'Hội thoại' : 'Cài đặt'}</h2>

        <nav className="side-nav" aria-label="Điều hướng workspace">
          <Link to="/dashboard">Hội thoại</Link>
          <Link to="/settings/inboxes">Hộp thư</Link>
          {['Owner', 'Admin'].includes(me.role) && <Link to="/settings/ai-rules">Quy tắc AI</Link>}
          {me.platformAdmin && <Link to="/platform/providers">Platform Admin</Link>}
          <Link to="/settings/general">
            <Building2 size={18} />
            Doanh nghiệp
          </Link>
          {['Owner', 'Admin'].includes(me.role) && (
            <>
              <Link to="/settings/people/agents">
                <Users size={18} />
                Quản lý nhân sự
              </Link>
              <Link to="/settings/support">Quyền hỗ trợ</Link>
              <Link to="/settings/knowledge">Kho thông tin</Link>
              <Link to="/settings/data-collection">Thu thập dữ liệu</Link>
              <Link to="/settings/web-sources">Nguồn web</Link>
              <Link to="/settings/jobs">Tác vụ nền</Link>
              <Link to="/settings/usage">Mức sử dụng</Link>
              <Link to="/settings/audit">
                <ShieldCheck size={18} />
                Nhật ký hoạt động
              </Link>
            </>
          )}
        </nav>
        <p className="user">{me.user.full_name}</p>
      </aside>

      <div className="workspace-main">
        <header>
          <strong>{routeTitle(path)}</strong>
          <span>Local/test</span>
        </header>

        {!me.user.verified_at && (
          <div className="verify-banner">
            Email của bạn chưa được xác thực.
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api('/auth/resend', 'POST', {});
                  setError(null);
                } catch (e) {
                  setError(e as Error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Gửi lại email xác thực
            </button>
          </div>
        )}

        <main key={me.workspaceId + path} className="content">
          <Notice error={error} />
          {path === '/settings/people/agents' ? (
            <MembersSettings onChange={refresh} />
          ) : path === '/dashboard' ? (
            <Inbox userId={me.user.id} workspaceId={me.workspaceId} />
          ) : path === '/settings/knowledge' ? (
            <>
              <Knowledge role={me.role} />
              {['Owner', 'Admin'].includes(me.role) && <KnowledgeRetrievalPreview />}
            </>
          ) : path === '/settings/data-collection' ? (
            <DataCollection role={me.role} />
          ) : path === '/settings/web-sources' ? (
            <WebSources role={me.role} />
          ) : path === '/settings/ai-rules' ? (
            <AiRules />
          ) : path.startsWith('/settings/inboxes') ? (
            <Channels role={me.role} />
          ) : path === '/settings/support' ? (
            <Support />
          ) : path === '/settings/jobs' ? (
            <Jobs />
          ) : path === '/settings/usage' ? (
            <Usage />
          ) : path === '/settings/audit' ? (
            <AuditSettings />
          ) : (
            <GeneralSettings role={me.role} onChange={refresh} />
          )}
        </main>
      </div>
    </div>
  );
}
