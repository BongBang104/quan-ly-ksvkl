import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import React, { useState, useMemo } from 'react';

const formatDateTime = (dateString) => {
    if (!dateString) return '--:--';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${time} - ${date}`;
};

export default function NotificationLogModal({ isOpen, onClose, notifications = [], onDeleteAll, onDeleteOne }) {
  const [filter, setFilter] = useState('ALL');

  const displayNotifs = useMemo(() => {
      let filtered = notifications;
      if (filter === 'URGENT') filtered = notifications.filter(n => n.type === 'URGENT_UPDATE');
      else if (filter === 'NORMAL') filtered = notifications.filter(n => n.type !== 'URGENT_UPDATE');
      return [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [notifications, filter]);

  const urgentCount = notifications.filter(n => n.type === 'URGENT_UPDATE').length;

  return (
    <Modal visible={isOpen} maxWidth="520px">
      {/* HEADER */}
      <div style={styles.header}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <div style={styles.iconBox}>
            <Icon name="bell" size={20} color="#2563eb" />
          </div>
          <div>
            <span style={styles.title}>Trung Tâm Thông Báo</span>
            <span style={styles.subTitle}>Nhật ký sự kiện và cảnh báo hệ thống</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {notifications.length > 0 && onDeleteAll && (
            <button type="button" onClick={onDeleteAll} style={styles.btnReadAll} title="Xóa tất cả thông báo">
              <Icon name="check-check" size={14} color="#64748b" />
              <span style={styles.btnReadAllText}>Xóa tất cả</span>
            </button>
          )}
          <button type="button" onClick={onClose} style={styles.closeBtn}>
            <Icon name="x" size={20} color="#64748b" />
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div style={styles.filterContainer}>
        <div style={styles.filterRow}>
          {[
            { key: 'ALL',    label: `Tất cả (${notifications.length})`,         urgent: false },
            { key: 'URGENT', label: `Khẩn cấp (${urgentCount})`,                urgent: true  },
            { key: 'NORMAL', label: `Hệ thống (${notifications.length - urgentCount})`, urgent: false },
          ].map(({ key, label, urgent }) => (
            <button
              key={key}
              type="button"
              style={{
                ...styles.filterChip,
                ...(filter === key ? (urgent ? styles.filterChipUrgent : styles.filterChipActive) : {}),
              }}
              onClick={() => setFilter(key)}
            >
              <span style={{
                ...styles.filterText,
                ...(filter === key ? (urgent ? { color: '#dc2626' } : { color: '#fff' }) : {}),
              }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* LIST */}
      <div style={styles.scrollArea}>
        {displayNotifs.length === 0 ? (
          <div style={styles.emptyState}>
            <Icon name="inbox" size={40} color="#cbd5e1" />
            <span style={styles.emptyText}>Chưa có thông báo nào trong mục này.</span>
          </div>
        ) : (
          displayNotifs.map(notif => {
            const isUrgent = notif.type === 'URGENT_UPDATE';
            return (
              <div
                key={notif.id}
                style={{
                  ...styles.notifCard,
                  ...(isUrgent ? styles.bgUrgent : styles.bgNormal),
                }}
              >
                <div style={styles.cardIcon}>
                  <Icon name={isUrgent ? 'alert-triangle' : 'info'} size={16} color={isUrgent ? '#ea580c' : '#2563eb'} />
                </div>
                <div style={styles.cardContent}>
                  <div style={styles.notifHeader}>
                    <span style={{ ...styles.notifTitle, color: isUrgent ? '#9a3412' : '#1e3a8a' }}>
                      {notif.title}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={styles.timeText}>{formatDateTime(notif.createdAt)}</span>
                      {onDeleteOne && (
                        <button type="button" onClick={() => onDeleteOne(notif.id)} style={styles.btnDeleteOne} title="Xóa thông báo này">
                          <Icon name="x" size={12} color="#94a3b8" />
                        </button>
                      )}
                    </div>
                  </div>
                  <span style={styles.bodyText}>{notif.body}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}

const styles = {
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #f1f5f9',
    backgroundColor: '#fff',
  },
  iconBox: {
    width: 36, height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: 700, color: '#1e293b', display: 'block' },
  subTitle: { fontSize: 11, color: '#64748b', display: 'block', marginTop: 1 },
  closeBtn: { padding: 6, backgroundColor: '#f8fafc', borderRadius: 20 },
  btnReadAll: {
    display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: 8,
    backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', cursor: 'pointer',
  },
  btnReadAllText: { fontSize: 12, fontWeight: 600, color: '#64748b' },

  filterContainer: {
    backgroundColor: '#f8fafc',
    padding: '10px 20px',
    borderBottom: '1px solid #e2e8f0',
  },
  filterRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    padding: '6px 14px',
    borderRadius: 20,
    backgroundColor: '#fff',
    border: '1px solid #cbd5e1',
    cursor: 'pointer',
  },
  filterChipActive: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
  filterChipUrgent: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  filterText: { fontSize: 12, fontWeight: 600, color: '#64748b' },

  scrollArea: {
    padding: '12px 16px',
    overflowY: 'auto',
    maxHeight: 'calc(90vh - 170px)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    gap: 10,
  },
  emptyText: { color: '#94a3b8', fontSize: 13, fontStyle: 'italic' },

  notifCard: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid',
    marginBottom: 8,
    gap: 10,
  },
  bgUrgent: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  bgNormal: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },

  cardIcon: { marginTop: 2, flexShrink: 0 },
  cardContent: { flex: 1, minWidth: 0 },

  notifHeader: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  notifTitle: { fontSize: 13, fontWeight: 700, flex: 1 },
  timeText: { fontSize: 11, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' },
  bodyText: { fontSize: 13, color: '#475569', lineHeight: '1.5' },
  btnDeleteOne: {
    width: 20, height: 20,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid #e2e8f0', cursor: 'pointer', flexShrink: 0,
  },
};
