import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { DataService } from '../services/DataService';
import api, { clearAuthToken, getAuthToken, getApiBaseUrl } from '../services/ApiService';

export const AppContext = createContext();

const DEFAULT_SETTINGS = {
  teams: ['Kíp A', 'Kíp B', 'Kíp C', 'Kíp D', 'Hành chính'],
  shiftTypes: [
    { code: 'S', label: 'Sáng', startTime: '07:00', endTime: '19:00' },
    { code: 'D', label: 'Đêm',  startTime: '19:00', endTime: '07:00' },
  ],
  activityTypes: [
    { id: 'LEAVE', code: 'P',  label: 'Nghỉ phép' },
    { id: 'SICK',  code: 'O',  label: 'Nghỉ ốm'  },
    { id: 'TRIP',  code: 'CT', label: 'Công tác'  },
    { id: 'STUDY', code: 'H',  label: 'Đi học'   },
  ],
  qualifications: ['Full', 'TWR', 'APP', 'TWR/APP', 'GND', 'Học viên'],
  apiBaseUrl: 'http://localhost:3000',
};

export const AppProvider = ({ children }) => {
  const [isLoading,         setIsLoading]         = useState(true);
  const [currentUser,       setCurrentUser]        = useState(null);
  const [settings,          setSettings]           = useState(DEFAULT_SETTINGS);
  const [employees,         setEmployees]          = useState([]);
  const [activities,        setActivities]         = useState([]);
  const [requests,          setRequests]           = useState([]);
  const [scheduleData,      setScheduleData]       = useState({});
  const [extraAssignments,  setExtraAssignments]   = useState({});
  const [isPublished,       setIsPublished]        = useState(false);
  const [notifications,     setNotifications]      = useState([]);
  const [isNotifOpen,       setIsNotifOpen]        = useState(false);

  const socketRef = useRef(null);

  // ── In-app notification helper ─────────────────────────────────────────
  const addNotification = useCallback((title, message, type = 'info') => {
    setNotifications(prev => [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      body: message,
      type: ['urgent', 'error'].includes(type) ? 'URGENT_UPDATE' : 'NORMAL',
      createdAt: new Date().toISOString(),
    }, ...prev]);
  }, []);

  // ── Reload helpers (re-fetch from backend after WS events) ────────────
  const reloadActivities = useCallback(async () => {
    const res = await DataService.fetchData(null, null, 'activities');
    if (res?.list) setActivities(res.list);
  }, []);

  const reloadRequests = useCallback(async () => {
    const res = await DataService.fetchData(null, null, 'requests');
    if (res?.list) setRequests(res.list);
  }, []);

  const reloadSchedule = useCallback(async () => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    try {
      const { data } = await api.get(`/api/schedules/${monthKey}`);
      const payload = data?.data ?? {};
      if (payload.scheduleData) setScheduleData(payload.scheduleData);
      if (payload.extraAssignments) setExtraAssignments(payload.extraAssignments);
      if (payload.isPublished !== undefined) setIsPublished(payload.isPublished);
      return payload;
    } catch {}
    return {};
  }, []);

  // ── Load public settings on startup ───────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const res = await DataService.fetchData(null, null, 'settings');
        if (res?.config) setSettings(res.config);
      } catch {}
      finally { setIsLoading(false); }
    };
    init();

    const onForceLogout = () => { clearAuthToken(); setCurrentUser(null); };
    window.addEventListener('atc:logout', onForceLogout);
    return () => window.removeEventListener('atc:logout', onForceLogout);
  }, []);

  // ── Load protected data after login ───────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const loadPrivate = async () => {
      const results = await Promise.allSettled([
        DataService.fetchData(null, null, 'employees'),
        DataService.fetchData(null, null, 'activities'),
        DataService.fetchData(null, null, 'requests'),
      ]);
      if (results[0].status === 'fulfilled' && results[0].value?.list)
        setEmployees(results[0].value.list.filter(emp => emp.role !== 'superadmin'));
      if (results[1].status === 'fulfilled' && results[1].value?.list)
        setActivities(results[1].value.list);
      if (results[2].status === 'fulfilled' && results[2].value?.list)
        setRequests(results[2].value.list);
      await reloadSchedule();
    };
    loadPrivate();
  }, [currentUser?.id]); // eslint-disable-line

  // ── WebSocket connection after login ──────────────────────────────────
  useEffect(() => {
    if (!currentUser) {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
      return;
    }

    const token = getAuthToken();
    const baseUrl = getApiBaseUrl();
    const socket = io(`${baseUrl}/ws`, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    // Join team room for targeted notifications
    if (currentUser.team) socket.emit('joinTeam', currentUser.team);

    // ── Real-time event handlers ──────────────────────────────────────
    // ── helpers ───────────────────────────────────────────────────────────
    const TYPE_LABEL = { 'Nghỉ phép': 'nghỉ phép', 'LEAVE': 'nghỉ phép', 'SICK': 'nghỉ ốm', 'Đổi ca': 'đổi ca', 'CHANGE': 'đổi ca', 'TRIP': 'công tác', 'STUDY': 'đi học' };
    const ACT_LABEL  = { 'LEAVE': 'Nghỉ phép', 'SICK': 'Nghỉ ốm', 'TRIP': 'Công tác', 'STUDY': 'Đi học', 'CHANGE': 'Tăng cường / Đổi ca' };

    socket.on('request:new', (payload) => {
      reloadRequests();
      if (currentUser.role === 'ADMIN' || currentUser.role === 'superadmin' || currentUser.role === 'LEADER') {
        const typeLabel = TYPE_LABEL[payload.type] || payload.type || 'yêu cầu';
        const team = payload.requesterTeam ? ` (${payload.requesterTeam})` : '';
        const dateNote = payload.date ? ` ngày ${payload.date}` : '';
        addNotification(
          'Đơn mới cần duyệt',
          `${payload.requesterName || 'Nhân viên'}${team} vừa gửi đơn xin ${typeLabel}${dateNote}.`,
          'urgent'
        );
      }
    });

    socket.on('request:updated', (payload) => {
      reloadRequests();
      const isRequester = payload?.requesterId === currentUser.id || payload?.employeeId === currentUser.id;
      const isTarget    = payload?.targetEmpId  === currentUser.id;

      if (isRequester) {
        const statusLabel = payload.status === 'APPROVED' ? 'được chấp thuận' : payload.status === 'REJECTED' ? 'bị từ chối' : 'được cập nhật';
        const typeLabel   = TYPE_LABEL[payload.type] || 'yêu cầu';
        const dateNote    = payload.date ? ` ngày ${payload.date}` : '';
        addNotification(
          `Đơn ${typeLabel} ${statusLabel}`,
          `Đơn ${typeLabel} của bạn${dateNote} vừa ${statusLabel}.`,
          payload.status === 'APPROVED' ? 'info' : 'urgent'
        );
      }
      if (isTarget && payload.status === 'APPROVED' && (payload.type === 'Đổi ca' || payload.type === 'CHANGE')) {
        const dateNote = payload.date ? ` ngày ${payload.date}` : '';
        addNotification(
          'Đơn đổi ca được duyệt',
          `Đơn đổi ca với ${payload.requesterName || 'đồng nghiệp'}${dateNote} đã được phê duyệt.`,
          'info'
        );
      }
    });
    socket.on('request:deleted', () => { reloadRequests(); });
    socket.on('requests:updated', () => { reloadRequests(); });

    socket.on('activity:new', (payload) => {
      reloadActivities();
      if (currentUser.role === 'ADMIN' || currentUser.role === 'superadmin' || currentUser.role === 'LEADER') {
        const typeLabel = ACT_LABEL[payload.type] || payload.type || 'biến động';
        const empNote   = payload.empName ? ` — ${payload.empName}` : '';
        const dateNote  = payload.startDate ? ` từ ngày ${payload.startDate}` : '';
        addNotification(
          'Biến động nhân sự',
          `Ghi nhận ${typeLabel}${empNote}${dateNote}.`,
          payload.type === 'CHANGE' ? 'info' : 'urgent'
        );
      }
      // Thông báo cho chính nhân sự được ghi nhận
      if (payload.empId === currentUser.id) {
        const typeLabel = ACT_LABEL[payload.type] || 'Biến động';
        const start = payload.startDate || '';
        const end   = payload.endDate && payload.endDate !== payload.startDate ? ` đến ${payload.endDate}` : '';
        addNotification(
          `${typeLabel} được ghi nhận`,
          `${typeLabel} của bạn${start ? ` từ ${start}` : ''}${end} đã được cập nhật vào hệ thống.`,
          'info'
        );
      }
    });

    socket.on('activity:updated', () => { reloadActivities(); });
    socket.on('activity:deleted', () => { reloadActivities(); });
    socket.on('activities:updated', () => { reloadActivities(); });

    socket.on('task:new', (payload) => {
      const isTarget = payload.targetEmpIds?.length
        ? payload.targetEmpIds.includes(currentUser.id)
        : currentUser.role !== 'ADMIN' && currentUser.role !== 'superadmin';
      if (isTarget) {
        const author = payload.authorName ? ` từ ${payload.authorName}` : ' từ quản lý';
        addNotification(
          'Thông báo mới',
          `"${payload.title || 'Bài đăng mới'}"${author}. Vào tab Nhiệm vụ để xem chi tiết.`,
          'urgent'
        );
      }
    });

    socket.on('task:updated', (payload) => {
      const isTarget = payload.targetEmpIds?.length
        ? payload.targetEmpIds.includes(currentUser.id)
        : currentUser.role !== 'ADMIN' && currentUser.role !== 'superadmin';
      if (isTarget) {
        addNotification(
          'Thông báo được cập nhật',
          `Bài đăng "${payload.title || ''}" vừa được cập nhật nội dung.`,
          'info'
        );
      }
    });

    socket.on('roster:published', (payload) => {
      const myAssignment = payload?.empAssignments?.[currentUser.id];
      if (myAssignment?.length) {
        const positions = [...new Set(myAssignment.map(a => a.position))].join(', ');
        const times = myAssignment.map(a => `${a.utcTime}Z`).slice(0, 4).join(', ');
        addNotification(
          'Lịch phân vị trí mới',
          `Kíp trưởng Kíp ${payload.team} vừa ban hành bảng phân vị trí Ca ${payload.shift} ngày ${payload.date}. Vị trí của bạn: ${positions} — ${times}.`,
          'urgent'
        );
      } else if (currentUser.role === 'ADMIN' || currentUser.role === 'superadmin' || currentUser.role === 'LEADER') {
        addNotification(
          'Phân vị trí được ban hành',
          `Kíp trưởng Kíp ${payload?.team} đã ban hành bảng phân vị trí Ca ${payload?.shift} ngày ${payload?.date}.`,
          'info'
        );
      }
    });

    socket.on('schedule:published', async (payload) => {
      const newData = await reloadSchedule();
      if (currentUser.role === 'ADMIN' || currentUser.role === 'superadmin') return;

      addNotification(
        'Lịch trực mới',
        payload.message || 'Quản lý vừa phát hành lịch trực mới. Kiểm tra tab Phân ca để xem lịch của bạn.',
        'urgent'
      );

      // Kiểm tra nhân sự có được gọi tăng cường không (bỏ qua slot dự bị _RESERVE)
      const extras = newData.extraAssignments || {};
      const mySlots = [];
      Object.entries(extras).forEach(([key, items]) => {
        if (key.endsWith('_RESERVE')) return;
        if (!Array.isArray(items)) return;
        const inSlot = items.some(item => item.type === 'emp' && item.id === currentUser.id);
        if (!inSlot) return;
        // key = "YYYY-M-D_shiftCode_roleType" (tháng 0-indexed từ toDateKey)
        const parts = key.split('_');
        if (parts.length >= 2) {
          const [y, m, d] = parts[0].split('-');
          const display = `${(d||'').padStart(2,'0')}/${String((parseInt(m)||0)+1).padStart(2,'0')}`;
          mySlots.push(`ca ${parts[1]} ngày ${display}`);
        }
      });
      if (mySlots.length > 0) {
        addNotification(
          'Bạn được gọi Tăng cường',
          `Trong lịch mới bạn được gọi tăng cường: ${mySlots.join(', ')}.`,
          'urgent'
        );
      }
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [currentUser?.id]); // eslint-disable-line

  const handleLogout = () => {
    clearAuthToken();
    setCurrentUser(null);
    setEmployees([]);
    setActivities([]);
    setRequests([]);
    setScheduleData({});
    setExtraAssignments({});
    setIsPublished(false);
    setNotifications([]);
  };

  const handleUpdateEmployeeId = (oldId, newId) =>
    console.log(`ID update: ${oldId} → ${newId}`);

  return (
    <AppContext.Provider value={{
      isLoading, setIsLoading,
      currentUser, setCurrentUser, handleLogout,
      settings, setSettings,
      employees, setEmployees, handleUpdateEmployeeId,
      activities, setActivities,
      requests, setRequests,
      scheduleData, setScheduleData,
      extraAssignments, setExtraAssignments,
      isPublished, setIsPublished,
      addNotification,
      notifications, setNotifications, isNotifOpen, setIsNotifOpen,
      reloadActivities, reloadRequests, reloadSchedule,
    }}>
      {children}
    </AppContext.Provider>
  );
};
