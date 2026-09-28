import {useState, useEffect} from 'react';

export const navigate = (path: string) => {
  history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export function usePath(): string {
  const [path, setPath] = useState(location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return path;
}
