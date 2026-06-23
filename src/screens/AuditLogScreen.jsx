import React, { useEffect, useState } from 'react';
import api from '../services/ApiService';

const ACTION_LABELS = {
  LOGIN_SUCCESS:    { label: 'Đăng nhập',          color: '#10b981' },
  LOGIN_FAIL:       { label: 'Đăng nhập thất bại', color: '#ef4444' },
  CHANGE_PASSWORD:  { label: 'Đổi mật khẩu',       color: '#2563eb' },
  RESET_PASSWORD:   { label: 'Reset mật khẩu',     color: '#f59e0b' },
  CREATE_EMPLOYEE:  { label: 'Tạo tài khoản',      color: '#8b5cf6' },
  UPDATE_EMPLOYEE:  { label: 'Sửa tài khoản',      color: '#6b7280' },
  DELETE_EMPLOYEE:  { label: 'Xoá tài khoản',      color: '#dc2626' },
  APPROVE_EMPLOYEE: { label: 'Phê duyệt',          color: '#059669' },
  REJECT_EMPLOYEE:  { label: 'Từ chối',            color: '#ef4444' },
  CHANGE_ROLE:      { label: 'Đổi quyền',          color: '#d97706' },
};

export default function AuditLogScreen() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/audit?limit=500')
      .then(res => setLogs(res.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>Đang tải...</div>;
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#0f172a' }}>Lịch sử hệ thống</h2>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Ghi nhận tất cả thao tác quan trọng — chỉ Quản trị cấp cao xem được.</p>
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Thời gian', 'Người thực hiện', 'Hành động', 'Đối tượng', 'IP'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151', fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map(log => {
              const meta = ACTION_LABELS[log.action] || { label: log.action, color: '#6b7280' };
              return (
                <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {new Date(log.createdAt).toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: '6px 12px', color: '#374151' }}>
                    {log.actorName || log.actorId || '—'}
                  </td>
                  <td style={{ padding: '6px 12px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 99,
                      background: meta.color + '18', color: meta.color,
                      fontWeight: 600, fontSize: 11,
                    }}>
                      {meta.label}
                    </span>
                  </td>
                  <td style={{ padding: '6px 12px', color: '#374151' }}>
                    {log.resourceType && log.resourceId ? `${log.resourceType}/${log.resourceId}` : '—'}
                  </td>
                  <td style={{ padding: '6px 12px', color: '#9ca3af', fontFamily: 'monospace', fontSize: 11 }}>
                    {log.ip || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {logs.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Chưa có log nào.</div>
        )}
      </div>
    </div>
  );
}
