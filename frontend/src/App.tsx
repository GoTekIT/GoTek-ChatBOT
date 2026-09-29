import React, {useState, useEffect} from 'react';
import {api, ApiError} from './api/api';
import {usePath, navigate} from './hooks/usePath';
import {Notice} from './components/common/Notice';
import {Auth} from './screens/auth/Auth';
import {Invite} from './screens/auth/Invite';
import {Platform} from './screens/platform/Platform';
import {ConsoleWorkspace} from './screens/console/ConsoleWorkspace';

export function App() {
  const path = usePath();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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

  // Auto-redirect to /app/inbox when authenticated and entering root or alias paths
  useEffect(() => {
    if (me && (path === '/' || path === '/app' || path === '/dashboard')) {
      navigate('/app/inbox');
    }
  }, [me, path]);

  // Auto-redirect /app/login alias to standard group route /app/auth/login
  useEffect(() => {
    if (path === '/app/login') {
      navigate('/app/auth/login');
    }
  }, [path]);

  async function switchWorkspace(workspaceId: string) {
    try {
      await api('/workspace/switch', 'POST', {workspaceId});
      setMe(null);
      await refresh();
      navigate('/app/inbox');
    } catch (e) {
      setError(e as Error);
    }
  }

  async function handleLogout() {
    try {
      await api('/auth/logout', 'POST', {});
      setMe(null);
      navigate('/app/auth/login');
    } catch (e) {
      setError(e as Error);
    }
  }

  // 1. Platform Admin Group Routes (/platform/*)
  if (path.startsWith('/platform')) return <Platform />;

  // 2. Invitation Route (/app/invitation)
  if (path === '/app/invitation') {
    return (
      <Invite
        signedIn={!!me}
        onAccepted={async () => {
          await refresh();
          navigate('/app/inbox');
        }}
        onLogin={() => {
          sessionStorage.setItem('gotek.pending-invite', location.pathname + location.hash);
          navigate('/app/auth/login');
        }}
      />
    );
  }

  // 3. Auth Group Routes (/app/auth/*)
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
        <Auth path={path} onLogin={refresh} />
      </div>
    );
  }

  if (loading) return <p role="status" className="boot">Đang tải không gian làm việc…</p>;

  if (!me) {
    return (
      <div className="boot">
        <Notice error={error} />
        <button onClick={refresh}>Thử lại</button>
      </div>
    );
  }

  return (
    <ConsoleWorkspace
      me={me}
      currentPath={path}
      onRefresh={refresh}
      onSwitchWorkspace={switchWorkspace}
      onLogout={handleLogout}
    />
  );
}
