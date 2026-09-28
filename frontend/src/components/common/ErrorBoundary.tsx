import React from 'react';

type Props = {children: React.ReactNode};
type State = {error: Error | null};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  render() {
    if (this.state.error) {
      return (
        <main className="boot" role="alert">
          <h1>Không thể hiển thị màn hình</h1>
          <p>Đã xảy ra lỗi giao diện. Tải lại trang để thử lại.</p>
          <button type="button" onClick={() => window.location.reload()}>Tải lại</button>
        </main>
      );
    }
    return this.props.children;
  }
}
