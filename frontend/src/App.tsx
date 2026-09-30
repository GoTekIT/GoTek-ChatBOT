import React, {useState, useEffect, useRef} from 'react';
import {ApiError} from './api/api';
import {AuthService} from './services/auth.service';
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
  const refreshSequence = useRef(0);

  async function refresh() {
    const sequence = ++refreshSequence.current;
    try {
      const data = await AuthService.getMe();
      if (sequence !== refreshSequence.current) return;
      setMe(data);
      setError(null);
    } catch (e) {
      if (sequence !== refreshSequence.current) return;
      setMe(null);
      if (e instanceof ApiError && e.code === 'UNAUTHENTICATED') {
        setMe(null);
      } else {
        setError(e as Error);
      }
    } finally {
      if (sequence === refreshSequence.current) setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
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
      await AuthService.switchWorkspace(workspaceId);
      setMe(null);
      await refresh();
      navigate('/app/inbox');
    } catch (e) {
      setError(e as Error);
    }
  }

  async function handleLogout() {
    ++refreshSequence.current;
    try {
      await AuthService.logout();
      setMe(null);
      navigate('/app/auth/login');
    } catch (e) {
      setError(e as Error);
    }
  }

  // 1. Platform Admin Group Routes (/platform/*)
  if (path.startsWith('/platform') && loading) return <p role="status">Đang kiểm tra quyền…</p>;
  if (path.startsWith('/platform') && me) {
    return me.platformAdmin === true ? <Platform /> : <div className="boot" role="alert">
      Bạn không có quyền Platform Admin. <button onClick={() => navigate('/app/inbox')}>Về hộp thư</button>
    </div>;
  }

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
      <div style={{position: 'relative', width: '100%', minHeight: '100vh'}}>
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
      key={`${me.user.id}:${me.workspaceId}:${me.role}`}
      me={me}
      currentPath={path}
      onRefresh={refresh}
      onSwitchWorkspace={switchWorkspace}
      onLogout={handleLogout}
    />
  );
}
