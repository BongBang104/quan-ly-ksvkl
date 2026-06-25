import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import React, { useMemo, useState, useEffect, useContext } from 'react';

// Parse "HHMM" → total minutes (times stored as UTC)
const _parseHMM = (s) => { if (!s || s.length < 4) return 0; return parseInt(s.slice(0,2))*60+parseInt(s.slice(2,4)); };

import DetailedRosterModal from '../components/DetailedRosterModal';
import { AppContext } from '../context/AppContext';
import { DataService } from '../services/DataService';
import api from '../services/ApiService';

// ── Design System ───────────────────────────────────────────────────────────
const D = {
  page: {
    width: '100%',
    flex: 1,
    backgroundColor: '#f4f6f9',
    padding: '20px 20px 40px',
    fontFamily: "'Inter', 'system-ui', sans-serif",
    boxSizing: 'border-box',
  },
  header: {
    width: '100%',
    boxSizing: 'border-box',
    background: 'linear-gradient(135deg, #0c1a3a 0%, #1a3560 55%, #0f2d5c 100%)',
    borderRadius: 18,
    padding: '18px 24px',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
    boxShadow: '0 8px 32px rgba(12,26,58,.3)',
    position: 'relative',
    overflow: 'hidden',
  },
  statusBar: {
    height: 4,
    borderRadius: '0 0 4px 4px',
    marginBottom: 20,
    transition: 'background 0.4s',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
    gap: 14,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: '16px 18px',
    border: '1px solid #e8edf2',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(15,23,42,.05)',
    cursor: 'default',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 16,
    marginBottom: 16,
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    marginBottom: 16,
  },
  grid2Responsive: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
    gap: 16,
    marginBottom: 16,
  },
  grid3Responsive: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
    gap: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    border: '1px solid #e8edf2',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(15,23,42,.05)',
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '13px 18px',
    borderBottom: '1px solid #f1f5f9',
    backgroundColor: '#f8fafc',
  },
  cardTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
    color: '#0f172a',
    letterSpacing: '0.01em',
  },
  cardBody: { padding: '14px 18px' },
  rowItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
    borderBottom: '1px solid #f1f5f9',
  },
  avatar: (color = '#2563eb', size = 36) => ({
    width: size, height: size,
    borderRadius: Math.floor(size * 0.3),
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    fontSize: Math.floor(size * 0.4), fontWeight: 700, color: '#fff',
    background: color,
  }),
  badge: (bg, color, borderColor) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 99,
    fontSize: 11, fontWeight: 700,
    backgroundColor: bg, color,
    border: `1px solid ${borderColor || bg}`,
    whiteSpace: 'nowrap',
  }),
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 8,
    fontSize: 12, fontWeight: 600,
    backgroundColor: '#2563eb', color: '#fff',
    border: 'none', cursor: 'pointer', flexShrink: 0,
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 8,
    fontSize: 12, fontWeight: 600,
    backgroundColor: 'transparent', color: '#475569',
    border: '1px solid #e2e8f0', cursor: 'pointer', flexShrink: 0,
  },
  quickTile: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', borderRadius: 10,
    cursor: 'pointer', border: '1px solid #e8edf2',
    backgroundColor: '#fff', textDecoration: 'none',
  },
  quickTileIcon: (bg) => ({
    width: 38, height: 38, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, backgroundColor: bg,
  }),
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '28px 16px', color: '#94a3b8', fontSize: 13, gap: 8, fontStyle: 'italic',
  },
  progress: (pct, color = '#2563eb') => ({
    height: 6, borderRadius: 3,
    background: `linear-gradient(90deg, ${color} ${pct}%, #f1f5f9 ${pct}%)`,
  }),
};

// ── Shared Components ───────────────────────────────────────────────────────
function HeaderBar({ name, role, team, currentTime, urgentCount = 0 }) {
  const roleLabel = { superadmin: 'Quản trị cấp cao', ADMIN: 'Quản trị viên', CHIEF: 'Kíp trưởng', STAFF: 'Kiểm soát viên' }[role] || role;
  const roleColor = { superadmin: '#a855f7', ADMIN: '#f59e0b', CHIEF: '#2563eb', STAFF: '#10b981' }[role] || '#64748b';
  const displayDate = currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const displayTime = currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={D.header}>
      <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(135deg, rgba(37,99,235,.4), rgba(99,102,241,.3))', border: '1px solid rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
          {name?.charAt(0) || 'U'}
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginBottom: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>ATC Pro — Trung tâm KSTC-TS Đà Nẵng</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, backgroundColor: roleColor + '30', color: roleColor, border: `1px solid ${roleColor}50`, letterSpacing: '0.04em' }}>{roleLabel}</span>
            {team && <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{team}</span>}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {urgentCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(239,68,68,.2)', border: '1px solid rgba(239,68,68,.35)', padding: '7px 14px', borderRadius: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#f87171', boxShadow: '0 0 0 3px rgba(239,68,68,.3)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5' }}>{urgentCount} cần xử lý</span>
          </div>
        )}
        <div style={{ backgroundColor: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', padding: '8px 16px', borderRadius: 10, textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}>{displayTime}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{displayDate}</div>
        </div>
      </div>
    </div>
  );
}

function OperationalStatusBar({ urgentCount, pendingCount }) {
  const level = urgentCount > 0 ? 'urgent' : pendingCount > 0 ? 'warn' : 'ok';
  const colors = { urgent: 'linear-gradient(90deg, #ef4444, #f97316)', warn: 'linear-gradient(90deg, #f59e0b, #eab308)', ok: 'linear-gradient(90deg, #10b981, #059669)' };
  const labels = { urgent: `⚠ ${urgentCount} vấn đề cần xử lý ngay`, warn: `● ${pendingCount} mục đang chờ xử lý`, ok: '● Hoạt động bình thường' };
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ ...D.statusBar, background: colors[level] }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, color: level === 'ok' ? '#16a34a' : level === 'warn' ? '#d97706' : '#dc2626' }}>
        <span>{labels[level]}</span>
      </div>
    </div>
  );
}

// ── Admin Widgets ───────────────────────────────────────────────────────────
function AdminStatGrid({ data, employees, requests }) {
  const stats = [
    { label: 'Tổng nhân sự', value: employees.filter(e => e.isApproved !== false).length, icon: 'users', color: '#2563eb', bg: '#eff6ff', sub: `${employees.filter(e => e.role === 'STAFF').length} KSV` },
    { label: 'Đang trực hôm nay', value: data.membersOnDuty.length, icon: 'activity', color: '#16a34a', bg: '#f0fdf4', sub: data.teamOnDuty !== 'Chưa xác định' ? `Kíp ${data.teamOnDuty}` : '—' },
    { label: 'Vắng mặt', value: data.leavesToday.length, icon: 'user-x', color: '#f59e0b', bg: '#fffbeb', sub: 'hôm nay' },
    { label: 'Đơn chờ duyệt', value: data.pendingRequests, icon: 'clock', color: '#7c3aed', bg: '#f5f3ff', sub: 'yêu cầu', urgent: data.pendingRequests > 0 },
    { label: 'Báo cáo mệt mỏi', value: 0, icon: 'alert-triangle', color: '#ef4444', bg: '#fef2f2', sub: 'chờ xử lý' },
    { label: 'Tỷ lệ báo nhận SMS', value: `${data.smsAckRate}%`, icon: 'message-circle', color: '#0891b2', bg: '#f0f9ff', sub: `${data.smsTotalSent} báo cáo` },
  ];
  return (
    <div style={D.statGrid}>
      {stats.map(s => (
        <div key={s.label} style={{ ...D.statCard, borderBottom: `3px solid ${s.color}`, minWidth: 0 }}>
          {s.urgent && <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,.25)' }} />}
          <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Icon name={s.icon} size={17} color={s.color} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>{s.label}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

function DutyRosterWidget({ members, team }) {
  return (
    <div style={D.card}>
      <div style={D.cardHead}>
        <div style={D.cardTitle}><Icon name="activity" size={14} color="#16a34a" />Đang trực — Kíp {team}</div>
        <span style={D.badge('#f0fdf4', '#16a34a', '#bbf7d0')}>{members.length} người</span>
      </div>
      <div style={{ ...D.cardBody, padding: '6px 18px', maxHeight: 340, overflowY: 'auto' }}>
        {members.length === 0 ? (
          <div style={D.empty}><Icon name="moon" size={24} color="#cbd5e1" />Không có ca trực trong ca này</div>
        ) : members.map(emp => (
          <div key={emp.id} style={D.rowItem}>
            <div style={D.avatar(emp.isChief ? '#7c3aed' : '#2563eb', 36)}>{emp.name.charAt(0)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {emp.name}{emp.isChief && <Icon name="star" size={11} color="#f59e0b" style={{ marginLeft: 4 }} />}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{emp.qualification || 'KSVKL'} · {emp.icaoCode || '—'}</div>
            </div>
            <span style={D.badge('#f1f5f9', '#475569', '#e2e8f0')}>{emp.position?.split(' ')[0] || 'KSV'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingRequestsWidget({ requests, onNavigateTo }) {
  const pending = requests.filter(r => ['Pending', 'Pending_Leaders', 'Pending_Admin'].includes(r.status)).slice(0, 5);
  return (
    <div style={D.card}>
      <div style={D.cardHead}>
        <div style={D.cardTitle}><Icon name="inbox" size={14} color="#7c3aed" />Đơn từ chờ duyệt</div>
        {pending.length > 0 && (
          <button onClick={() => onNavigateTo?.('ANALYTICS', 'exchange')} style={{ ...D.btnGhost, fontSize: 11, padding: '4px 10px' }}>Xem tất cả</button>
        )}
      </div>
      <div style={{ ...D.cardBody, padding: '6px 18px' }}>
        {pending.length === 0 ? (
          <div style={D.empty}><Icon name="check-circle" size={22} color="#10b981" />Không có đơn nào chờ duyệt</div>
        ) : pending.map(req => (
          <div key={req.id} style={D.rowItem}>
            <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: req.type === 'Đổi ca' ? '#eff6ff' : '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={req.type === 'Đổi ca' ? 'repeat' : 'calendar-off'} size={14} color={req.type === 'Đổi ca' ? '#2563eb' : '#7c3aed'} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.requesterName} — {req.type}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{req.date}</div>
            </div>
            <span style={D.badge('#fffbeb', '#d97706', '#fde68a')}>Chờ</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminQuickActions({ onNavigateTo }) {
  const actions = [
    { icon: 'calendar', label: 'Phân ca tháng', color: '#eff6ff', iconColor: '#2563eb', nav: 'SCHEDULER' },
    { icon: 'users', label: 'Quản lý nhân sự', color: '#f5f3ff', iconColor: '#7c3aed', nav: 'TEAMS' },
    { icon: 'activity', label: 'Phân tích & Báo cáo', color: '#f0fdf4', iconColor: '#16a34a', nav: 'ANALYTICS' },
    { icon: 'settings', label: 'Cài đặt hệ thống', color: '#f8fafc', iconColor: '#475569', nav: 'SETTINGS' },
    { icon: 'file-text', label: 'Nhật ký hệ thống', color: '#fef2f2', iconColor: '#dc2626', nav: 'AUDITLOG' },
    { icon: 'shield', label: 'Phê duyệt Admin', color: '#fffbeb', iconColor: '#d97706', nav: 'APPROVE' },
  ];
  return (
    <div style={D.card}>
      <div style={D.cardHead}><div style={D.cardTitle}><Icon name="zap" size={14} color="#f59e0b" />Truy cập nhanh</div></div>
      <div style={{ ...D.cardBody, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {actions.map(a => (
          <button key={a.label} type="button" onClick={() => onNavigateTo?.(a.nav)}
            style={{ ...D.quickTile, flexDirection: 'column', alignItems: 'flex-start', padding: 12, gap: 8 }}>
            <div style={D.quickTileIcon(a.color)}><Icon name={a.icon} size={16} color={a.iconColor} /></div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', lineHeight: 1.3 }}>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AbsenceWidget({ leaves, employees, settings }) {
  const getConf = (type) => {
    const found = settings?.activityTypes?.find(a => a.id === type);
    if (found?.id === 'LEAVE') return { label: 'Nghỉ phép', bg: '#fef2f2', text: '#dc2626', icon: 'coffee' };
    if (found?.id === 'SICK')  return { label: 'Nghỉ ốm',   bg: '#f0fdfa', text: '#0d9488', icon: 'thermometer' };
    if (found?.id === 'TRIP')  return { label: 'Công tác',  bg: '#faf5ff', text: '#9333ea', icon: 'briefcase' };
    return { label: type, bg: '#f3f4f6', text: '#4b5563', icon: 'info' };
  };
  return (
    <div style={D.card}>
      <div style={D.cardHead}>
        <div style={D.cardTitle}><Icon name="user-x" size={14} color="#f59e0b" />Vắng mặt hôm nay</div>
        <span style={D.badge('#fffbeb', '#d97706', '#fde68a')}>{leaves.length} người</span>
      </div>
      <div style={{ ...D.cardBody, padding: '6px 18px' }}>
        {leaves.length === 0 ? (
          <div style={D.empty}><Icon name="check-circle" size={22} color="#10b981" />Không có nhân sự vắng mặt</div>
        ) : leaves.map((act, i) => {
          const emp = employees.find(e => e.id === act.empId);
          const conf = getConf(act.type);
          return (
            <div key={act.id || i} style={D.rowItem}>
              <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: conf.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={conf.icon} size={14} color={conf.text} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{emp?.name || act.empId}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{emp?.team || '—'}</div>
              </div>
              <span style={D.badge(conf.bg, conf.text, conf.bg)}>{conf.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SmsProgressWidget({ reports }) {
  return (
    <div style={D.card}>
      <div style={D.cardHead}>
        <div style={D.cardTitle}><Icon name="message-circle" size={14} color="#0891b2" />Tiến độ báo nhận SMS</div>
        <span style={D.badge('#f0f9ff', '#0891b2', '#bae6fd')}>{reports.length} báo cáo</span>
      </div>
      <div style={D.cardBody}>
        {reports.map((sms, i) => {
          const isDone = sms.ack === sms.total;
          const pct = sms.total > 0 ? Math.round((sms.ack / sms.total) * 100) : 0;
          return (
            <div key={sms.id || i} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{sms.time}</span>
                <span style={D.badge(isDone ? '#f0fdf4' : '#fffbeb', isDone ? '#16a34a' : '#d97706', isDone ? '#bbf7d0' : '#fde68a')}>
                  {isDone ? 'Hoàn tất' : 'Đang chờ'}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>{sms.title}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>Đã báo nhận:</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: isDone ? '#16a34a' : '#d97706' }}>{sms.ack} / {sms.total}</span>
              </div>
              <div style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, backgroundColor: isDone ? '#10b981' : '#f59e0b', borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CHIEF / STAFF Widgets ───────────────────────────────────────────────────
function NextShiftWidget({ shift, onOpenRoster }) {
  const now = new Date();
  const getCountdown = () => {
    if (!shift) return null;
    const [h, m] = (shift.time.split(' đến ')[0] || '').split(':').map(Number);
    if (isNaN(h)) return null;
    const shiftStart = new Date(); shiftStart.setHours(h, m || 0, 0, 0);
    if (shiftStart < now) return null;
    const diffMin = Math.floor((shiftStart - now) / 60000);
    if (diffMin > 240) return null;
    const hh = Math.floor(diffMin / 60), mm = diffMin % 60;
    return hh > 0 ? `${hh}g ${mm}p nữa` : `${mm} phút nữa`;
  };
  const countdown = getCountdown();

  if (!shift) {
    return (
      <div style={{ ...D.card, border: '1px dashed #e2e8f0' }}>
        <div style={D.empty}><Icon name="calendar" size={28} color="#cbd5e1" />Chưa có lịch trong 14 ngày tới</div>
      </div>
    );
  }

  const accentColor = shift.isToday ? '#2563eb' : '#16a34a';
  return (
    <div style={{ ...D.card, border: `1px solid ${accentColor}30` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: shift.isToday ? 'linear-gradient(135deg, #eff6ff, #dbeafe)' : 'linear-gradient(135deg, #f0fdf4, #dcfce7)', borderBottom: `1px solid ${accentColor}20` }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: accentColor, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{shift.isToday ? '🟢 Hôm nay' : '📅 Sắp tới'}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{shift.shiftName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: accentColor, fontFamily: "'JetBrains Mono', monospace" }}>{shift.dateDisplay}</div>
          {countdown && (
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', backgroundColor: '#fffbeb', padding: '2px 8px', borderRadius: 4, marginTop: 4, border: '1px solid #fde68a' }}>⏱ {countdown}</div>
          )}
        </div>
      </div>
      <div style={D.cardBody}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Thời gian</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: "'JetBrains Mono', monospace" }}>{shift.time}</div>
          </div>
          <div style={{ padding: '10px 12px', backgroundColor: '#f0fdf4', borderRadius: 8, border: '1px solid #dcfce7' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Vị trí</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{shift.position}</div>
          </div>
        </div>
        <button type="button" onClick={onOpenRoster} style={{ ...D.btnPrimary, width: '100%', justifyContent: 'center' }}>
          <Icon name="layout" size={13} color="#fff" />Xem lịch phân vị trí chi tiết
        </button>
      </div>
    </div>
  );
}

function WeekCalendarStrip({ myEmpId, scheduleData, settings, todayObj }) {
  const shiftColors = { S: { bg: '#eff6ff', text: '#1d4ed8' }, D: { bg: '#fef3c7', text: '#d97706' } };
  const strips = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(todayObj); d.setDate(d.getDate() + i);
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const shiftCode = scheduleData[`${myEmpId}_${dateKey}`];
    const isToday = i === 0;
    const dayLabel = ['CN','T2','T3','T4','T5','T6','T7'][d.getDay()];
    strips.push({ d, isToday, dayLabel, shiftCode });
  }
  return (
    <div style={D.card}>
      <div style={D.cardHead}><div style={D.cardTitle}><Icon name="calendar" size={14} color="#2563eb" />Lịch trực 7 ngày tới</div></div>
      <div style={{ ...D.cardBody, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, padding: 14 }}>
        {strips.map(({ d, isToday, dayLabel, shiftCode }, i) => {
          const sc = shiftColors[shiftCode];
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 2px', borderRadius: 8, backgroundColor: isToday ? '#0f172a' : 'transparent', border: isToday ? 'none' : '1px solid #f1f5f9', minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: isToday ? 'rgba(255,255,255,.6)' : '#94a3b8' }}>{dayLabel}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: isToday ? '#fff' : '#374151' }}>{d.getDate()}</div>
              {shiftCode ? (
                <div style={{ fontSize: 9, fontWeight: 700, padding: '2px 4px', borderRadius: 4, backgroundColor: isToday ? 'rgba(255,255,255,.2)' : (sc?.bg || '#f1f5f9'), color: isToday ? '#fff' : (sc?.text || '#475569') }}>{shiftCode}</div>
              ) : (
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: isToday ? 'rgba(255,255,255,.3)' : '#f1f5f9' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChiefApprovalWidget({ requests, userTeam, onApprove }) {
  const pending = requests.filter(r =>
    r.type === 'Đổi ca' && r.status === 'Pending_Leaders' &&
    (r.requesterTeam === userTeam || r.targetTeam === userTeam) &&
    r.approvals?.[userTeam] === false
  );

  if (pending.length === 0) return (
    <div style={{ ...D.card, border: '1px solid #bbf7d0' }}>
      <div style={D.cardHead}><div style={{ ...D.cardTitle, color: '#16a34a' }}><Icon name="check-circle" size={14} color="#16a34a" />Đơn đổi ca</div></div>
      <div style={D.empty}><Icon name="check-circle" size={22} color="#10b981" />Không có đơn nào cần duyệt</div>
    </div>
  );

  return (
    <div style={{ ...D.card, border: '1px solid #fde68a' }}>
      <div style={{ ...D.cardHead, backgroundColor: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
        <div style={{ ...D.cardTitle, color: '#d97706' }}><Icon name="bell" size={14} color="#d97706" />Đổi ca cần duyệt</div>
        <span style={D.badge('#fef3c7', '#d97706', '#fde68a')}>{pending.length} đơn</span>
      </div>
      <div style={{ ...D.cardBody, padding: '8px 18px' }}>
        {pending.map(req => (
          <div key={req.id} style={{ padding: '12px 0', borderBottom: '1px solid #fef3c7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{req.requesterName}</span>
                <span style={{ fontSize: 12, color: '#64748b' }}> ↔ </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>{req.targetEmpName}</span>
              </div>
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#475569' }}>{req.date}</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>{req.reason}</div>
            <button type="button" onClick={() => onApprove(req.id)} style={{ ...D.btnPrimary, backgroundColor: '#16a34a', fontSize: 11, padding: '6px 14px' }}>
              <Icon name="check" size={12} color="#fff" />Phê duyệt
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChiefQuickActions({ onNavigateTo }) {
  const actions = [
    { icon: 'layout',    label: 'Lịch phân vị trí',    desc: 'Xếp và ban hành lịch ca',     color: '#eff6ff', iconColor: '#2563eb', nav: 'ANALYTICS', subTab: 'tasks_feed' },
    { icon: 'repeat',    label: 'Đổi ca / Nghỉ phép',  desc: 'Tạo và quản lý đơn',          color: '#f5f3ff', iconColor: '#7c3aed', nav: 'ANALYTICS', subTab: 'exchange' },
    { icon: 'file-text', label: 'Bình giảng sau ca',    desc: 'Lập biên bản bình giảng',     color: '#f0fdf4', iconColor: '#16a34a', nav: 'ANALYTICS', subTab: 'briefing' },
    { icon: 'clipboard', label: 'Giao nhận ca WEST',    desc: 'Phiếu giao nhận kíp',         color: '#fff7ed', iconColor: '#ea580c', nav: 'ANALYTICS', subTab: 'handover' },
  ];
  return (
    <div style={D.card}>
      <div style={D.cardHead}><div style={D.cardTitle}><Icon name="zap" size={14} color="#f59e0b" />Thao tác nhanh</div></div>
      <div style={{ ...D.cardBody, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {actions.map(a => (
          <button key={a.label} type="button" onClick={() => onNavigateTo?.(a.nav, a.subTab)} style={{ ...D.quickTile, width: '100%', textAlign: 'left' }}>
            <div style={D.quickTileIcon(a.color)}><Icon name={a.icon} size={16} color={a.iconColor} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{a.label}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{a.desc}</div>
            </div>
            <Icon name="chevron-right" size={14} color="#cbd5e1" />
          </button>
        ))}
      </div>
    </div>
  );
}

function StaffQuickActions({ onNavigateTo }) {
  const actions = [
    { icon: 'repeat',         label: 'Tạo đơn đổi ca',     desc: 'Gửi yêu cầu đổi ca / nghỉ phép', color: '#eff6ff', iconColor: '#2563eb', nav: 'ANALYTICS', subTab: 'exchange' },
    { icon: 'alert-triangle', label: 'Báo cáo mệt mỏi',    desc: 'Ẩn danh — không ảnh hưởng kỷ luật', color: '#fef2f2', iconColor: '#ef4444', nav: 'ANALYTICS', subTab: 'fatigue' },
    { icon: 'layers',         label: 'Bảng tin nhiệm vụ',  desc: 'Xem nhiệm vụ và thông báo kíp', color: '#f5f3ff', iconColor: '#7c3aed', nav: 'ANALYTICS', subTab: 'tasks_feed' },
    { icon: 'file-text',      label: 'Phiếu giao nhận ca', desc: 'Xem phiếu WEST của kíp mình',  color: '#fff7ed', iconColor: '#ea580c', nav: 'ANALYTICS', subTab: 'handover' },
  ];
  return (
    <div style={D.card}>
      <div style={D.cardHead}><div style={D.cardTitle}><Icon name="zap" size={14} color="#f59e0b" />Thao tác nhanh</div></div>
      <div style={{ ...D.cardBody, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {actions.map(a => (
          <button key={a.label} type="button" onClick={() => onNavigateTo?.(a.nav, a.subTab)} style={{ ...D.quickTile, width: '100%', textAlign: 'left' }}>
            <div style={D.quickTileIcon(a.color)}><Icon name={a.icon} size={16} color={a.iconColor} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{a.label}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{a.desc}</div>
            </div>
            <Icon name="chevron-right" size={14} color="#cbd5e1" />
          </button>
        ))}
      </div>
    </div>
  );
}

function MyRequestsWidget({ requests, myEmpId, onNavigateTo }) {
  const mine = (requests || []).filter(r => r.requesterId === myEmpId).slice(0, 3);
  const statusMeta = (status) => {
    if (status === 'APPROVED') return { label: 'Đã duyệt', bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' };
    if (status?.includes('Pending')) return { label: 'Đang chờ', bg: '#fffbeb', text: '#d97706', border: '#fde68a' };
    return { label: status, bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
  };
  return (
    <div style={D.card}>
      <div style={D.cardHead}>
        <div style={D.cardTitle}><Icon name="file-text" size={14} color="#475569" />Đơn từ của tôi</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onNavigateTo?.('ANALYTICS', 'exchange')} style={{ ...D.btnGhost, fontSize: 11, padding: '4px 10px' }}>
            <Icon name="repeat" size={11} color="#475569" />Đổi ca
          </button>
          <button onClick={() => onNavigateTo?.('ANALYTICS', 'exchange', { formType: 'LEAVE' })} style={{ ...D.btnGhost, fontSize: 11, padding: '4px 10px' }}>
            <Icon name="calendar-off" size={11} color="#475569" />Nghỉ phép
          </button>
        </div>
      </div>
      <div style={{ ...D.cardBody, padding: '6px 18px' }}>
        {mine.length === 0 ? (
          <div style={D.empty}><Icon name="inbox" size={22} color="#cbd5e1" />Chưa có đơn từ nào</div>
        ) : (
          <>
            {mine.map(req => {
              const sm = statusMeta(req.status);
              return (
                <div key={req.id} style={D.rowItem}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.type}{req.type === 'Đổi ca' && <span style={{ color: '#2563eb' }}> ↔ {req.targetEmpName}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{req.date}{req.shiftCode ? ` · Ca ${req.shiftCode}` : ''}</div>
                  </div>
                  <span style={D.badge(sm.bg, sm.text, sm.border)}>{sm.label}</span>
                </div>
              );
            })}
            {(requests || []).filter(r => r.requesterId === myEmpId).length > 3 && (
              <button onClick={() => onNavigateTo?.('ANALYTICS', 'exchange')}
                style={{ width: '100%', padding: '8px 0', fontSize: 12, color: '#2563eb', fontWeight: 600, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', marginTop: 4, borderTop: '1px solid #f1f5f9' }}>
                Xem tất cả đơn từ →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function DashboardScreen({ onNavigateTo } = {}) {

  const {
    currentUser, employees, settings, activities, setActivities,
    requests, setRequests, scheduleData, extraAssignments,
    addNotification, setIsNotifOpen
  } = useContext(AppContext);

  const smsReports = [];

  const isAdmin  = currentUser?.role === 'ADMIN' || currentUser?.role === 'superadmin';
  const isLeader = currentUser?.role === 'CHIEF';
  const isChief  = isLeader;
  const isStaff  = currentUser?.role === 'STAFF';

  const myRealEmp = useMemo(() => {
    if (!currentUser) return null;
    const realMatch = employees.find(e => e.id === currentUser.id);
    if (realMatch) return realMatch;
    if (isLeader) return employees.find(e => e.team !== 'Trung tâm' && (e.isChief || e.position?.toLowerCase().includes('quản lý')));
    if (isStaff)  return employees.find(e => e.team !== 'Trung tâm' && !e.isChief && !e.position?.toLowerCase().includes('quản lý'));
    return null;
  }, [currentUser, employees, isLeader, isStaff]);

  const userTeam  = myRealEmp?.team || 'Kíp A';
  const myEmpId   = myRealEmp?.id   || currentUser?.id;
  const myEmpName = myRealEmp?.name  || currentUser?.name;

  const [showFullRoster,      setShowFullRoster]      = useState(false);
  const [pendingFatigueCount, setPendingFatigueCount] = useState(0);
  const [currentTime,         setCurrentTime]         = useState(new Date());
  const [myRosterSlots,       setMyRosterSlots]       = useState([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isChief) return;
    api.get('/api/fatigue-reports/for-chief')
      .then(({ data }) => setPendingFatigueCount(data.filter(r => r.status === 'submitted').length))
      .catch(() => {});
  }, [isChief]);

  const handleLeaderApproveSwap = async (reqId) => {
    const req = requests.find(r => r.id === reqId);
    const newApprovals = { ...req.approvals, [userTeam]: true };
    const allApproved  = Object.values(newApprovals).every(v => v === true);
    const updatedReq   = { ...req, approvals: newApprovals, status: allApproved ? 'APPROVED' : 'Pending_Leaders' };
    try { await DataService.updateItem('requests', reqId, updatedReq); } catch {}
    if (setRequests) setRequests(prev => prev.map(r => r.id === reqId ? updatedReq : r));
    if (allApproved) {
      const shiftInfo = req.shiftCode ? ` ca ${req.shiftCode}` : '';
      const act1 = { id: 'ACT'+Date.now(),    empId: req.requesterId, type: 'CHANGE', startDate: req.date, endDate: req.date, note: `Đổi ca${shiftInfo} với ${req.targetEmpName}` };
      const act2 = { id: 'ACT'+(Date.now()+1), empId: req.targetEmpId, type: 'CHANGE', startDate: req.date, endDate: req.date, note: `Đổi ca${shiftInfo} với ${req.requesterName}` };
      try { await DataService.createItem('activities', act1); await DataService.createItem('activities', act2); } catch {}
      if (setActivities) setActivities(prev => [...prev, act1, act2]);
      addNotification('Phê duyệt Đổi ca', `Đơn đổi ca${shiftInfo} giữa ${req.requesterName} và ${req.targetEmpName} ngày ${req.date} đã được duyệt hoàn tất.`, 'info');
      window.alert("Hoàn tất\nĐã duyệt xong! Lịch trực và Danh sách Quản lý Kíp đã được tự động cập nhật.");
    } else {
      const shiftInfo = req.shiftCode ? ` ca ${req.shiftCode}` : '';
      addNotification('Tiến độ Đổi ca', `Kíp trưởng ${userTeam} đã duyệt đơn đổi ca${shiftInfo} của ${req.requesterName} ngày ${req.date}. Đang chờ kíp đích xác nhận.`, 'info');
      window.alert("Thành công\nĐã duyệt. Chờ Kíp trưởng đích xác nhận.");
    }
  };

  const todayObj           = currentTime;
  const todayKey           = `${todayObj.getFullYear()}-${todayObj.getMonth()}-${todayObj.getDate()}`;
  const todayStrYMD        = `${todayObj.getFullYear()}-${String(todayObj.getMonth()+1).padStart(2,'0')}-${String(todayObj.getDate()).padStart(2,'0')}`;
  const totalCurrentMinutes = todayObj.getHours() * 60 + todayObj.getMinutes();
  const currentShiftCode   = todayObj.getHours() < 11 ? 'S' : 'D';

  const safeSmsReports = smsReports.length > 0 ? smsReports : [
    { id: 'sms1', title: 'Thông báo hoạt động bay Chuyên cơ',   time: '07:30', total: 15, ack: 15, status: 'DONE' },
    { id: 'sms2', title: 'Báo cáo thời tiết xấu khu vực sân bay', time: '09:15', total: 15, ack: 12, status: 'PENDING' },
  ];

  const myNextShift = useMemo(() => {
    if (isAdmin || !myEmpId) return null;
    for (let i = 0; i < 14; i++) {
      const d = new Date(todayObj); d.setDate(d.getDate() + i);
      const dateKey   = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const shiftCode = scheduleData[`${myEmpId}_${dateKey}`];
      if (shiftCode) {
        const shiftInfo = settings?.shiftTypes?.find(s => s.code === shiftCode);
        if (i === 0 && shiftInfo) {
          const [sH]     = (shiftInfo.startTime || '07:00').split(':').map(Number);
          const [eH, eM] = (shiftInfo.endTime   || '19:00').split(':').map(Number);
          let endMin = eH * 60 + eM, curMin = totalCurrentMinutes;
          if (eH < sH) { endMin += 24*60; if (todayObj.getHours() < eH) curMin += 24*60; }
          if (curMin > endMin) continue;
        }
        let assignedPosition = myRealEmp?.position || 'Kiểm soát viên';
        for (const pos of ['QL','KSV','ON-CALL']) {
          if (extraAssignments[`${dateKey}_${shiftCode}_${pos}`]?.some(emp => emp.id === myEmpId)) {
            assignedPosition = pos === 'QL' ? 'Kíp trưởng' : pos === 'KSV' ? 'Trực Chính Radar' : 'Trực Dự Bị (On-Call)';
          }
        }
        return {
          dateDisplay: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`,
          isToday: i === 0, shiftName: shiftInfo?.label || `Ca ${shiftCode}`,
          time: `${shiftInfo?.startTime || '--:--'} đến ${shiftInfo?.endTime || '--:--'}`,
          position: assignedPosition,
          baseStartHour: shiftInfo?.startTime ? parseInt(shiftInfo.startTime.split(':')[0]) : (shiftCode === 'S' ? 7 : 19),
          actualDate: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
          shiftCode, isMock: false,
        };
      }
    }
    return null;
  }, [myEmpId, scheduleData, extraAssignments, settings, isAdmin, todayObj, totalCurrentMinutes, myRealEmp]);

  useEffect(() => {
    if (!myNextShift?.actualDate || !myNextShift?.shiftCode || !myEmpId) { setMyRosterSlots([]); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get('/api/schedules/detailed_rosters');
        const globalData = res.data?.data ?? res.data ?? {};
        if (cancelled) return;
        const key   = `${userTeam}_${myNextShift.actualDate}_${myNextShift.shiftCode}`;
        const entry = globalData[key];
        if (!entry || entry.status !== 'PUBLISHED') { setMyRosterSlots([]); return; }
        const customCols = settings?.rosterColumns?.length > 0 ? settings.rosterColumns : ['CTL','APP','TWR','GCU'];
        const myCodes    = [String(myEmpId), myRealEmp?.icaoCode].filter(Boolean).map(c => c.toUpperCase());
        const slots = [];
        (entry.data || []).forEach(row => {
          customCols.forEach(colKey => {
            const cellVal = (row[colKey] || '').trim().toUpperCase();
            if (!cellVal) return;
            if (myCodes.some(code => new RegExp(`\\b${code}\\b`).test(cellVal))) slots.push({ utcTime: row.time || '', position: colKey });
          });
        });
        if (!cancelled) setMyRosterSlots(slots);
      } catch { if (!cancelled) setMyRosterSlots([]); }
    };
    load();
    return () => { cancelled = true; };
  }, [myNextShift?.actualDate, myNextShift?.shiftCode, myEmpId, userTeam]); // eslint-disable-line

  const positionTimeline = useMemo(() => {
    if (!myNextShift) return [];
    if (myRosterSlots.length > 0) {
      const nowUTCMin = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
      return myRosterSlots.map(slot => {
        const [a, b] = slot.utcTime.split('-');
        const startMin = _parseHMM(a || '0000');
        let endMin = _parseHMM(b || '0100');
        if (endMin <= startMin) endMin += 1440;
        const adjNow = (nowUTCMin < startMin && endMin > 1440) ? nowUTCMin + 1440 : nowUTCMin;
        let status = 'upcoming';
        if (myNextShift.isToday) {
          if (adjNow >= startMin && adjNow < endMin) status = 'current';
          else if (adjNow >= endMin) status = 'past';
        }
        return { id: `${slot.utcTime}_${slot.position}`, timeStr: `${slot.utcTime}Z`, position: slot.position, status };
      });
    }
    const startH = myNextShift.baseStartHour;
    const slots = [
      { startOffset: 0,    durH: 2, durM: 0,  pos: 'Trực TWR (Chỉ Huy)' },
      { startOffset: 2,    durH: 1, durM: 30, pos: 'Nghỉ / Dự bị' },
      { startOffset: 3.5,  durH: 2, durM: 0,  pos: 'Trực APP (Tiếp Cận)' },
      { startOffset: 5.5,  durH: 1, durM: 15, pos: 'Trực HĐ TWR (Hiệp Đồng)' },
      { startOffset: 6.75, durH: 2, durM: 15, pos: 'Nghỉ ngơi' },
      { startOffset: 9,    durH: 3, durM: 0,  pos: 'Trực GND (Mặt Đất)' },
    ];
    const baseStartMin = startH * 60;
    let currentAdjustedMin = totalCurrentMinutes;
    if (myNextShift.isToday && startH >= 18 && todayObj.getHours() < 12) currentAdjustedMin += 24 * 60;
    return slots.map(slot => {
      const startTotalMin = baseStartMin + Math.round(slot.startOffset * 60);
      const endTotalMin   = startTotalMin + Math.round(slot.durH * 60 + slot.durM);
      const fmt = (min) => `${String(Math.floor(min/60)%24).padStart(2,'0')}:${String(Math.round(min%60)).padStart(2,'0')}`;
      let status = 'upcoming';
      if (myNextShift.isToday) {
        if (currentAdjustedMin >= startTotalMin && currentAdjustedMin < endTotalMin) status = 'current';
        else if (currentAdjustedMin >= endTotalMin) status = 'past';
      }
      return { id: startTotalMin, timeStr: `${fmt(startTotalMin)} - ${fmt(endTotalMin)}`, position: slot.pos, status };
    });
  }, [myNextShift, myRosterSlots, totalCurrentMinutes, todayObj]);

  const dashboardData = useMemo(() => {
    const operationalStaff = employees.filter(e => e.team !== 'Trung tâm' && !e.position?.toLowerCase().includes('lãnh đạo'));
    const leavesToday = activities.filter(act => act.startDate <= todayStrYMD && act.endDate >= todayStrYMD && act.type !== 'CHANGE' && act.status !== 'REJECTED');
    let teamOnDuty = 'Chưa xác định', membersOnDuty = [];
    operationalStaff.forEach(emp => {
      if (scheduleData[`${emp.id}_${todayKey}`] === currentShiftCode) {
        if (teamOnDuty === 'Chưa xác định') teamOnDuty = emp.team;
        if (!leavesToday.some(act => act.empId === emp.id)) membersOnDuty.push(emp);
      }
    });
    const smsTotalExpected = safeSmsReports.reduce((sum, s) => sum + s.total, 0);
    const smsAckRate = smsTotalExpected > 0 ? Math.round((safeSmsReports.reduce((sum, s) => sum + s.ack, 0) / smsTotalExpected) * 100) : 0;
    return { totalStaff: operationalStaff.length, leavesToday, pendingRequests: requests.filter(r => r.status !== 'APPROVED').length, teamOnDuty, membersOnDuty, smsTotalSent: safeSmsReports.length, smsAckRate };
  }, [employees, activities, requests, scheduleData, todayKey, todayStrYMD, currentShiftCode, safeSmsReports]);

  // ── CHIEF / STAFF return ─────────────────────────────────────────────────
  if (!isAdmin) {
    const shiftEmployees     = employees.filter(e => e.team !== 'Trung tâm' && !e.position?.toLowerCase().includes('lãnh đạo'));
    const myRequests         = (requests || []).filter(r => r.requesterId === myEmpId);
    const urgentCount        = (requests || []).filter(r => r.type === 'Đổi ca' && r.status === 'Pending_Leaders' && (r.requesterTeam === userTeam || r.targetTeam === userTeam) && r.approvals?.[userTeam] === false).length;
    const pendingCount       = myRequests.filter(r => r.status?.includes('Pending')).length;

    return (
      <div style={D.page}>
        <DetailedRosterModal team={userTeam} isOpen={showFullRoster} onClose={() => setShowFullRoster(false)} employees={shiftEmployees} activities={activities} settings={settings} isAdmin={isChief} />

        <HeaderBar name={myEmpName} role={currentUser?.role} team={userTeam} currentTime={currentTime} urgentCount={urgentCount} />
        <OperationalStatusBar urgentCount={urgentCount} pendingCount={pendingCount} />

        {/* Stat cards */}
        <div style={D.statGrid}>
          <div style={{ ...D.statCard, borderBottom: '3px solid #2563eb' }}>
            <div style={{ ...D.avatar('#2563eb', 36), marginBottom: 12 }}><Icon name="calendar" size={16} color="#fff" /></div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, marginBottom: 4 }}>{myNextShift?.dateDisplay || '—'}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>{myNextShift?.shiftName || 'Chưa có lịch'}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{myNextShift?.isToday ? 'Hôm nay' : 'Ca tiếp theo'}</div>
          </div>

          <div style={{ ...D.statCard, borderBottom: '3px solid #16a34a' }}>
            <div style={{ ...D.avatar('#16a34a', 36), marginBottom: 12 }}><Icon name="map-pin" size={16} color="#fff" /></div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, marginBottom: 4 }}>{myNextShift?.position?.split(' ')[0] || '—'}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>Vị trí phân công</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{myNextShift?.time || '—'}</div>
          </div>

          <div style={{ ...D.statCard, borderBottom: `3px solid ${pendingCount > 0 ? '#d97706' : '#10b981'}` }}>
            <div style={{ ...D.avatar(pendingCount > 0 ? '#d97706' : '#10b981', 36), marginBottom: 12 }}><Icon name={pendingCount > 0 ? 'clock' : 'check-circle'} size={16} color="#fff" /></div>
            <div style={{ fontSize: 28, fontWeight: 800, color: pendingCount > 0 ? '#d97706' : '#10b981', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, marginBottom: 4 }}>{pendingCount}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>Đơn đang chờ</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>yêu cầu của tôi</div>
          </div>

          {isChief && (
            <div style={{ ...D.statCard, borderBottom: `3px solid ${urgentCount > 0 ? '#dc2626' : '#10b981'}` }}>
              {urgentCount > 0 && <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,.2)' }} />}
              <div style={{ ...D.avatar(urgentCount > 0 ? '#dc2626' : '#10b981', 36), marginBottom: 12 }}><Icon name="bell" size={16} color="#fff" /></div>
              <div style={{ fontSize: 28, fontWeight: 800, color: urgentCount > 0 ? '#dc2626' : '#10b981', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, marginBottom: 4 }}>{urgentCount}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>Đổi ca cần duyệt</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>kíp của tôi</div>
            </div>
          )}
        </div>

        {/* Main content grid */}
        <div style={D.grid2Responsive}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <NextShiftWidget shift={myNextShift} onOpenRoster={() => setShowFullRoster(true)} />
            <WeekCalendarStrip myEmpId={myEmpId} scheduleData={scheduleData} settings={settings} todayObj={currentTime} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {isChief && <ChiefApprovalWidget requests={requests} userTeam={userTeam} onApprove={handleLeaderApproveSwap} />}
            {isChief ? <ChiefQuickActions onNavigateTo={onNavigateTo} /> : <StaffQuickActions onNavigateTo={onNavigateTo} />}
            <MyRequestsWidget requests={requests} myEmpId={myEmpId} onNavigateTo={onNavigateTo} />
          </div>
        </div>
      </div>
    );
  }

  // ── ADMIN return ─────────────────────────────────────────────────────────
  return (
    <div style={D.page}>
      <HeaderBar name={myEmpName || 'Admin'} role={currentUser?.role} currentTime={currentTime} urgentCount={dashboardData.pendingRequests > 5 ? dashboardData.pendingRequests : 0} />
      <OperationalStatusBar urgentCount={dashboardData.pendingRequests > 5 ? dashboardData.pendingRequests : 0} pendingCount={dashboardData.pendingRequests} />
      <AdminStatGrid data={dashboardData} employees={employees} requests={requests} />
      <div style={D.grid3Responsive}>
        <DutyRosterWidget members={dashboardData.membersOnDuty} team={dashboardData.teamOnDuty} />
        <PendingRequestsWidget requests={requests} onNavigateTo={onNavigateTo} />
        <AdminQuickActions onNavigateTo={onNavigateTo} />
      </div>
      <div style={D.grid2Responsive}>
        <AbsenceWidget leaves={dashboardData.leavesToday} employees={employees} settings={settings} />
        <SmsProgressWidget reports={safeSmsReports} />
      </div>
    </div>
  );
}
