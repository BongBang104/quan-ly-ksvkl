import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import api from '../services/ApiService';
import Icon from '../components/Icon.jsx';

export default function SuperAdminScreen() {
  const { employees, setEmployees, addNotification } = useContext(AppContext);
  const [loading, setLoading] = useState({});

  const admins = employees.filter(e => e.role === 'ADMIN');
  const pending = admins.filter(e => !e.isApproved);
  const approved = admins.filter(e => e.isApproved);

  const handleApprove = async (id, isApproved) => {
    setLoading(prev => ({ ...prev, [id]: true }));
    try {
      await api.patch(`/api/employees/${id}/approve`, { isApproved });
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, isApproved } : e));
    } catch {
      addNotification('Lỗi', 'Không thể cập nhật trạng thái tài khoản.', 'error');
    } finally {
      setLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div style={S.container}>
      {/* Page header */}
      <div style={S.pageHeader}>
        <div style={S.pageHeaderIcon}><Icon name="user-check" size={22} color="#fff" /></div>
        <div>
          <div style={S.pageHeaderTitle}>Phê Duyệt Tài Khoản Admin</div>
          <div style={S.pageHeaderSub}>Chấp thuận hoặc thu hồi quyền truy cập Quản trị viên</div>
        </div>
      </div>

      <div style={S.body}>
        {/* Pending */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <Icon name="clock" size={15} color="#d97706" />
            <span style={S.cardTitle}>Chờ phê duyệt</span>
            <span style={{ ...S.chip, color: '#d97706', background: '#fef3c7' }}>{pending.length}</span>
          </div>
          {pending.length === 0
            ? <div style={S.empty}>Không có tài khoản nào đang chờ phê duyệt.</div>
            : pending.map(emp => (
              <div key={emp.id} style={S.row}>
                <div style={{ ...S.avatar, background: 'linear-gradient(135deg,#d97706,#f59e0b)' }}>
                  <span style={S.avatarTxt}>{emp.name?.charAt(0)?.toUpperCase() || '?'}</span>
                </div>
                <div style={S.info}>
                  <span style={S.empName}>{emp.name}</span>
                  <span style={S.empMeta}>{emp.id}{emp.team ? ` · ${emp.team}` : ''}</span>
                </div>
                <button type="button" style={{ ...S.btn, background: '#16a34a' }}
                  onClick={() => handleApprove(emp.id, true)} disabled={!!loading[emp.id]}>
                  <Icon name="check" size={13} color="#fff" />
                  <span>{loading[emp.id] ? '...' : 'Phê duyệt'}</span>
                </button>
              </div>
            ))
          }
        </div>

        {/* Approved */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <Icon name="check-circle" size={15} color="#16a34a" />
            <span style={S.cardTitle}>Đã phê duyệt</span>
            <span style={{ ...S.chip, color: '#16a34a', background: '#dcfce7' }}>{approved.length}</span>
          </div>
          {approved.length === 0
            ? <div style={S.empty}>Chưa có tài khoản Admin nào được phê duyệt.</div>
            : approved.map(emp => (
              <div key={emp.id} style={S.row}>
                <div style={{ ...S.avatar, background: 'linear-gradient(135deg,#16a34a,#22c55e)' }}>
                  <span style={S.avatarTxt}>{emp.name?.charAt(0)?.toUpperCase() || '?'}</span>
                </div>
                <div style={S.info}>
                  <span style={S.empName}>{emp.name}</span>
                  <span style={S.empMeta}>{emp.id}{emp.team ? ` · ${emp.team}` : ''}</span>
                </div>
                <button type="button" style={{ ...S.btn, background: '#ef4444' }}
                  onClick={() => handleApprove(emp.id, false)} disabled={!!loading[emp.id]}>
                  <Icon name="x" size={13} color="#fff" />
                  <span>{loading[emp.id] ? '...' : 'Thu hồi'}</span>
                </button>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

const S = {
  container: { flex: 1, background: '#f0f4f8', display: 'flex', flexDirection: 'column' },

  pageHeader: {
    display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: '20px 28px 18px',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
  },
  pageHeaderIcon: {
    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
    background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(37,99,235,.3)',
  },
  pageHeaderTitle: { fontSize: 18, fontWeight: 700, color: '#0f172a' },
  pageHeaderSub:   { fontSize: 12, color: '#64748b', marginTop: 3 },

  body: { padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 },

  card: {
    background: '#fff', borderRadius: 14,
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
  },
  cardHeader: {
    display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: '14px 20px',
    borderBottom: '1px solid #f1f5f9',
    background: '#f8fafc',
  },
  cardTitle: { fontSize: 13, fontWeight: 700, color: '#1e293b', flex: 1 },
  chip: {
    fontSize: 11, fontWeight: 700,
    padding: '2px 8px', borderRadius: 20,
  },

  empty: {
    padding: '28px 20px', fontSize: 13,
    color: '#94a3b8', textAlign: 'center', fontStyle: 'italic',
  },

  row: {
    display: 'flex', flexDirection: 'row', alignItems: 'center',
    padding: '12px 20px', gap: 12,
    borderBottom: '1px solid #f8fafc',
  },
  avatar: {
    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: 15, fontWeight: 700, color: '#fff' },
  info:    { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  empName: { fontSize: 14, fontWeight: 600, color: '#1e293b' },
  empMeta: { fontSize: 11, color: '#94a3b8' },
  btn: {
    display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 5,
    padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, color: '#fff', flexShrink: 0,
  },
};
