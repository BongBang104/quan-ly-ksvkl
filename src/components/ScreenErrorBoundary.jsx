import React from 'react';

export default class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ScreenErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 32, gap: 16, background: '#fff9f9',
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>
            Màn hình này gặp lỗi
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', maxWidth: 360 }}>
            {this.state.error?.message || 'Đã xảy ra lỗi không xác định.'}
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
