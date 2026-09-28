import React from 'react';

interface NoticeProps {
  error?: Error | null;
  message?: string;
}

export function Notice({error, message}: NoticeProps) {
  return (
    <>
      {error && (
        <div role="alert" className="notice error">
          {error.message}
        </div>
      )}
      {message && (
        <div role="status" className="notice">
          {message}
        </div>
      )}
    </>
  );
}
