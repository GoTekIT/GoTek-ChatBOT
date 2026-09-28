import React from 'react';
import {usePath, navigate} from '../../hooks/usePath';

interface LinkProps {
  to: string;
  children: React.ReactNode;
  label?: string;
  className?: string;
}

export function Link({to, children, label, className}: LinkProps) {
  const path = usePath();
  const current = path === to || path.startsWith(to + '/');

  return (
    <a
      href={to}
      className={className}
      aria-current={current ? 'page' : undefined}
      aria-label={label}
      title={label}
      onClick={e => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
