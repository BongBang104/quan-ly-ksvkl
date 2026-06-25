import Spinner from "./src/components/Spinner.jsx";
import Modal from './src/components/Modal.jsx';
import Icon from './src/components/Icon.jsx';
import React, { useState, useContext } from 'react';

import { AppProvider, AppContext } from './src/context/AppContext.jsx';
import LoginScreen from './src/screens/LoginScreen.jsx';
import DashboardScreen from './src/screens/DashboardScreen.jsx';
import SchedulerScreen from './src/screens/SchedulerScreen.jsx';
import TeamsScreen from './src/screens/TeamsScreen.jsx';
import ManagerDataScreen from './src/screens/ManagerDataScreen.jsx';
import StatsScreen from './src/screens/StatsScreen.jsx';
import AccountManagerScreen from './src/screens/AccountManagerScreen.jsx';
import SettingsScreen from './src/screens/SettingsScreen.jsx';
import SuperAdminScreen from './src/screens/SuperAdminScreen.jsx';
import AnalyticsScreen from './src/screens/AnalyticsScreen.jsx';
import AuditLogScreen from './src/screens/AuditLogScreen.jsx';
import NotificationLogModal from './src/components/NotificationLogModal.jsx';
import NotificationPermissionBanner from './src/components/NotificationPermissionBanner.jsx';

/* ─── Styles ─────────────────────────────────────────────────── */
const S = {
  safeArea: {
    height: '100vh', display: 'flex', flexDirection: 'column',
    background: '#09122b', overflow: 'hidden',
  },
  centerScreen: {
    flex: 1, display: 'flex', flexDirection: 'column',
    justifyContent: 'center', alignItems: 'center',
    background: 'linear-gradient(135deg, #0a1628 0%, #0f2544 100%)',
    gap: 16,
  },
  loadingText: {
    fontSize: 14, color: '#7da0c4', letterSpacing: '0.02em',
  },
  appContainer: {
    flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row',
    background: '#f0f4f8', overflow: 'hidden',
  },

  /* ── Sidebar ── */
  sidebar: {
    width: 232,
    flexShrink: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(180deg, #09122b 0%, #0c1a3d 60%, #0a1530 100%)',
    borderRight: '1px solid rgba(255,255,255,.07)',
    boxShadow: '4px 0 32px rgba(0,0,0,.35)',
    zIndex: 50,
    overflowY: 'auto',
    overflowX: 'hidden',
  },

  /* ── Logo ── */
  logoBox: {
    display: 'flex', flexDirection: 'row', alignItems: 'center',
    padding: '22px 18px 18px',
    borderBottom: '1px solid rgba(255,255,255,.07)',
    marginBottom: 6,
    gap: 12,
  },
  logoIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(37,99,235,.45)',
    flexShrink: 0,
  },
  logoTextWrap: { display: 'flex', flexDirection: 'column', gap: 1 },
  logoMain: {
    fontSize: 16, fontWeight: 800, color: '#fff',
    letterSpacing: '0.04em', lineHeight: 1.2,
  },
  logoSub: {
    fontSize: 10, color: 'rgba(255,255,255,.4)',
    letterSpacing: '0.08em', fontWeight: 500,
  },

  /* ── Nav section label ── */
  navSection: {
    paddingLeft: 18, paddingRight: 18, paddingTop: 16, paddingBottom: 6,
  },
  navSectionText: {
    fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.25)',
    letterSpacing: '0.12em', textTransform: 'uppercase',
  },

  /* ── Nav scroll container ── */
  navScroll: {
    padding: '4px 10px', gap: 2,
    display: 'flex', flexDirection: 'column', flex: 1,
  },

  /* ── Nav item ── */
  navItem: {
    display: 'flex', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '9px 10px',
    borderRadius: 9,
    marginBottom: 1,
    background: 'none', border: 'none',
    cursor: 'pointer', width: '100%', textAlign: 'left',
    transition: 'background 180ms ease, box-shadow 180ms ease',
    position: 'relative',
  },
  navItemActive: {
    background: 'linear-gradient(135deg, rgba(37,99,235,.9), rgba(29,78,216,.95))',
    boxShadow: '0 4px 14px rgba(37,99,235,.4), inset 0 1px 0 rgba(255,255,255,.1)',
  },
  navItemHovered: {
    background: 'rgba(255,255,255,.07)',
  },
  navIconWrap: {
    width: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  navText: {
    fontSize: 13, color: '#7da0c4',
    marginLeft: 10, fontWeight: 500, lineHeight: 1,
  },
  navTextActive: { color: '#fff', fontWeight: 600 },

  /* ── Bell badge ── */
  navBellBadge: {
    position: 'absolute', top: -6, right: -8,
    backgroundColor: '#ef4444', minWidth: 16, height: 16,
    borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '2px solid #09122b', padding: '0 3px',
    boxShadow: '0 0 0 0 rgba(239,68,68,.7)',
  },
  navBellBadgeText: { color: '#fff', fontSize: 9, fontWeight: 700 },

  /* ── Divider ── */
  navDivider: {
    height: 1, background: 'rgba(255,255,255,.07)',
    margin: '8px 10px',
    border: 'none', borderWidth: 0,
  },

  /* ── User box ── */
  userBox: {
    display: 'flex', flexDirection: 'row', alignItems: 'center',
    padding: '14px 14px',
    borderTop: '1px solid rgba(255,255,255,.07)',
    background: 'rgba(0,0,0,.25)',
    marginTop: 'auto',
    gap: 10,
  },
  avatar: {
    width: 34, height: 34, borderRadius: 10,
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(37,99,235,.4)',
  },
  avatarText: { fontSize: 13, fontWeight: 700, color: '#fff' },
  userInfo: { flex: 1, minWidth: 0 },
  userName: {
    fontSize: 13, fontWeight: 600, color: '#f0f6ff',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  userRole: { fontSize: 11, color: '#5b8bbd', marginTop: 2 },
  btnLogout: {
    padding: 7, borderRadius: 8,
    background: 'rgba(239,68,68,.12)',
    border: '1px solid rgba(239,68,68,.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  /* ── Content area ── */
  contentArea: {
    flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
    background: '#f0f4f8', overflowY: 'auto', position: 'relative',
  },
};

/* ─── Error Boundary ─────────────────────────────────────────── */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, background: '#fee2e2', color: '#dc2626', fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: 12, height: '100vh', overflow: 'auto' }}>
          <h2 style={{ margin: '0 0 10px', color: '#991b1b' }}>⚠️ LỖI HỆ THỐNG</h2>
          <p style={{ margin: '0 0 10px', fontWeight: 700 }}>{this.state.error?.message}</p>
          <pre style={{ fontSize: 11, margin: 0, color: '#7f1d1d' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Nav Item with hover ────────────────────────────────────── */
function NavButton({ item, isActive, onClick, children }) {
  const [hovered, setHovered] = useState(false);
  const style = {
    ...S.navItem,
    ...(isActive ? S.navItemActive : (hovered ? S.navItemHovered : {})),
  };
  return (
    <button
      type="button"
      style={style}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
}

/* ─── Main App ───────────────────────────────────────────────── */
function MainApp() {
  const {
    isLoading, currentUser, setCurrentUser, handleLogout,
    settings, setSettings, employees, setEmployees,
    activities, setActivities, requests, setRequests,
    scheduleData, setScheduleData, extraAssignments, setExtraAssignments,
    isPublished, setIsPublished, addNotification, handleUpdateEmployeeId,
    notifications, setNotifications, isNotifOpen, setIsNotifOpen,
  } = useContext(AppContext);

  const [activeTab, setActiveTab] = useState('DASHBOARD');

  const performLogout = () => { handleLogout(); setActiveTab('DASHBOARD'); };

  const getNavItems = () => {
    const role = currentUser?.role || 'STAFF';
    const all = [
      { id: 'DASHBOARD',    icon: 'home',       label: 'Tổng quan',  section: 'MAIN' },
      { id: 'SCHEDULER',    icon: 'calendar',   label: 'Phân ca',    section: 'MAIN' },
      { id: 'TEAMS',        icon: 'users',      label: 'Quản lý',    section: 'MAIN' },
      { id: 'STATS',        icon: 'bar-chart-2',label: 'Thống kê',         section: 'MANAGE' },
      { id: 'ANALYTICS',    icon: 'activity',   label: 'Báo cáo & Nhiệm vụ', section: 'MANAGE' },
      { id: 'MANAGER_DATA', icon: 'database',   label: 'Nhân sự',    section: 'MANAGE' },
      { id: 'ACCOUNTS',     icon: 'shield',     label: 'Tài khoản',  section: 'SYSTEM' },
      { id: 'SETTINGS',     icon: 'settings',   label: 'Cài đặt',    section: 'SYSTEM' },
    ];
    if (role === 'superadmin') {
      return [
        ...all,
        { id: 'APPROVE',    icon: 'user-check', label: 'Phê duyệt Admin', section: 'SYSTEM' },
        { id: 'AUDIT_LOG',  icon: 'file-text',  label: 'Lịch sử hệ thống', section: 'SYSTEM' },
      ];
    }
    if (role === 'ADMIN') return all;
    return all.filter(m => ['DASHBOARD', 'SCHEDULER', 'TEAMS', 'ANALYTICS'].includes(m.id));
  };

  const renderScreen = () => {
    const p = {
      employees, setEmployees, settings, setSettings,
      activities, setActivities, addNotification,
      requests, setRequests, currentUser,
    };
    switch (activeTab) {
      case 'DASHBOARD':    return <DashboardScreen    {...p} scheduleData={scheduleData} extraAssignments={extraAssignments} smsReports={[]}
        onNavigateTo={(screen, subTab, extra) => {
          setActiveTab(screen);
          if (subTab) {
            const groupMap = { exchange:'forms', fatigue:'forms', briefing:'forms', handover:'forms', checklist:'forms', compliance:'analysis', fairness:'analysis', tasks_feed:'operations' };
            setTimeout(() => window.dispatchEvent(new CustomEvent('atc:navigate-subtab', { detail: { subTab, group: groupMap[subTab] || null, ...extra } })), 150);
          }
        }}
      />;
      case 'SCHEDULER':    return <SchedulerScreen    {...p} scheduleData={scheduleData} setScheduleData={setScheduleData} extraAssignments={extraAssignments} setExtraAssignments={setExtraAssignments} isPublished={isPublished} setIsPublished={setIsPublished} />;
      case 'TEAMS':        return <TeamsScreen        {...p} scheduleData={scheduleData} extraAssignments={extraAssignments} />;
      case 'MANAGER_DATA': return <ManagerDataScreen  {...p} onUpdateEmployeeId={handleUpdateEmployeeId} />;
      case 'STATS':        return <StatsScreen        {...p} scheduleData={scheduleData} />;
      case 'ANALYTICS':    return <AnalyticsScreen    {...p} />;
      case 'ACCOUNTS':     return <AccountManagerScreen {...p} />;
      case 'SETTINGS':     return <SettingsScreen {...p} />;
      case 'APPROVE':      return <SuperAdminScreen />;
      case 'AUDIT_LOG':    return <AuditLogScreen />;
      default:             return <DashboardScreen    {...p} scheduleData={scheduleData} extraAssignments={extraAssignments} />;
    }
  };

  if (isLoading) {
    return (
      <div style={S.centerScreen}>
        <Spinner size="large" color="#3b82f6" />
        <span style={S.loadingText}>Đang tải hệ thống ATC PRO…</span>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        employees={employees} setEmployees={setEmployees} settings={settings}
        onLogin={(user) => { setCurrentUser(user); setActiveTab('DASHBOARD'); }}
      />
    );
  }

  const navItems = getNavItems();

  /* Group nav items by section */
  const sections = [
    { key: 'MAIN',   label: null },
    { key: 'MANAGE', label: 'Quản trị' },
    { key: 'SYSTEM', label: 'Hệ thống' },
  ];

  return (
    <div style={S.safeArea}>
      <div style={S.appContainer}>

        {/* ══ SIDEBAR ══════════════════════════════════════════ */}
        <div style={S.sidebar} className="sidebar-scroll">

          {/* Logo */}
          <div style={S.logoBox}>
            <div style={S.logoIconWrap}>
              <Icon name="radio" size={18} color="#fff" />
            </div>
            <div style={S.logoTextWrap}>
              <span style={S.logoMain}>ATC PRO</span>
              <span style={S.logoSub}>ROSTERING SYSTEM</span>
            </div>
          </div>

          {/* Nav */}
          <div style={S.navScroll}>
            {sections.map(section => {
              const items = navItems.filter(i => i.section === section.key);
              if (items.length === 0) return null;
              return (
                <div key={section.key} style={{ display: 'flex', flexDirection: 'column' }}>
                  {section.label && (
                    <div style={S.navSection}>
                      <span style={S.navSectionText}>{section.label}</span>
                    </div>
                  )}
                  {items.map(item => {
                    const isActive = activeTab === item.id;
                    return (
                      <NavButton key={item.id} item={item} isActive={isActive} onClick={() => setActiveTab(item.id)}>
                        <div style={S.navIconWrap}>
                          <Icon name={item.icon} size={16} color={isActive ? '#fff' : '#5b8bbd'} />
                        </div>
                        <span style={{ ...S.navText, ...(isActive ? S.navTextActive : {}) }}>
                          {item.label}
                        </span>
                      </NavButton>
                    );
                  })}
                  {section.key !== 'SYSTEM' && <div style={S.navDivider} />}
                </div>
              );
            })}

            {/* Notifications */}
            <NavButton
              item={{ id: 'NOTIF' }}
              isActive={isNotifOpen}
              onClick={() => setIsNotifOpen(true)}
            >
              <div style={{ ...S.navIconWrap, position: 'relative' }}>
                <Icon name="bell" size={16} color={isNotifOpen ? '#fff' : '#5b8bbd'} />
                {notifications.length > 0 && (
                  <div style={{ ...S.navBellBadge }} className="badge-ring">
                    <span style={S.navBellBadgeText}>
                      {notifications.length > 99 ? '99+' : notifications.length}
                    </span>
                  </div>
                )}
              </div>
              <span style={{ ...S.navText, ...(isNotifOpen ? S.navTextActive : {}) }}>
                Thông báo
              </span>
            </NavButton>
          </div>

          {/* User box */}
          <div style={S.userBox}>
            <div style={S.avatar}>
              <span style={S.avatarText}>{currentUser.name?.charAt(0).toUpperCase() || 'U'}</span>
            </div>
            <div style={S.userInfo}>
              <span style={S.userName}>{currentUser.name}</span>
              <span style={S.userRole}>
                {currentUser.role === 'superadmin' ? 'Quản trị cấp cao' :
                 currentUser.role === 'ADMIN' ? 'Quản trị viên' :
                 currentUser.role === 'CHIEF' ? 'Kíp trưởng' : 'Nhân sự'}
              </span>
            </div>
            <button type="button" style={S.btnLogout} onClick={performLogout} title="Đăng xuất">
              <Icon name="log-out" size={15} color="#f87171" />
            </button>
          </div>
        </div>

        {/* ══ CONTENT ══════════════════════════════════════════ */}
        <div style={S.contentArea}>
          <div className="screen-enter" key={activeTab} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {renderScreen()}
          </div>
          <NotificationLogModal
            isOpen={isNotifOpen}
            onClose={() => setIsNotifOpen(false)}
            notifications={notifications}
            onDeleteAll={() => setNotifications([])}
            onDeleteOne={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
          />
        </div>

        <NotificationPermissionBanner />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ErrorBoundary>
        <MainApp />
      </ErrorBoundary>
    </AppProvider>
  );
}
