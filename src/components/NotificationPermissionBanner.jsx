import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { getApiBaseUrl } from '../services/ApiService';

// Thin banner shown only when the API server is unreachable after login.
export default function NotificationPermissionBanner() {
  const { currentUser } = useContext(AppContext);
  const [offline, setOffline]     = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!currentUser) { setOffline(false); return; }

    const check = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/health`, {
          method: 'GET', signal: AbortSignal.timeout(4000),
        });
        setOffline(!res.ok);
      } catch {
        setOffline(true);
      }
    };

    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [currentUser]);

  if (!offline || dismissed) return null;

  return (
    <div style={S.bar}>
      <div style={S.left}>
        <span style={S.dot} />
        <div>
          <strong style={S.title}>Mất kết nối API Server</strong>
          <span style={S.sub}>
            Hệ thống không thể kết nối tới {getApiBaseUrl()}.
            Kiểm tra NestJS backend hoặc cấu hình API URL trong Cài đặt.
          </span>
        </div>
      </div>
      <button type="button" style={S.btnClose} onClick={() => setDismissed(true)}>✕</button>
    </div>
  );
}

const S = {
  bar: {
    position: 'fixed', bottom: 20, left: 20, right: 20, zIndex: 9999,
    display: 'flex', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderLeft: '5px solid #ef4444',
    borderRadius: 12,
    padding: '14px 20px',
    boxShadow: '0 10px 25px rgba(0,0,0,.15)',
    gap: 16,
  },
  left: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  dot: {
    width: 10, height: 10, borderRadius: '50%',
    backgroundColor: '#ef4444', flexShrink: 0,
    animation: 'pulse 1.6s ease-in-out infinite',
  },
  title: { fontSize: 14, fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 2 },
  sub:   { fontSize: 12, color: '#64748b' },
  btnClose: {
    padding: '6px 12px', borderRadius: 8,
    backgroundColor: '#f1f5f9', color: '#64748b',
    fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
    flexShrink: 0,
  },
};
