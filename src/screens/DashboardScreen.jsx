import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import React, { useMemo, useState, useEffect, useContext } from 'react';

// Parse "HHMM" → total minutes (times stored as UTC)
const _parseHMM = (s) => { if (!s || s.length < 4) return 0; return parseInt(s.slice(0,2))*60+parseInt(s.slice(2,4)); };

import DetailedRosterModal from '../components/DetailedRosterModal';
import { AppContext } from '../context/AppContext';
import { DataService } from '../services/DataService';
import api from '../services/ApiService';

export default function DashboardScreen() {
  
  const {
      currentUser, employees, settings, activities, setActivities, // Cần gọi setActivities để tạo Biến động
      requests, setRequests, scheduleData, extraAssignments, 
      addNotification, setIsNotifOpen
  } = useContext(AppContext);

  const smsReports = [];

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'superadmin';
  const isLeader = currentUser?.role === 'LEADER';
  const isStaff = currentUser?.role === 'STAFF';

  const myRealEmp = useMemo(() => {
      if (!currentUser) return null;
      const realMatch = employees.find(e => e.id === currentUser.id);
      if (realMatch) return realMatch; 
      
      if (isLeader) return employees.find(e => e.team !== 'Trung tâm' && (e.isChief || e.position?.toLowerCase().includes('quản lý')));
      if (isStaff) return employees.find(e => e.team !== 'Trung tâm' && !e.isChief && !e.position?.toLowerCase().includes('quản lý'));
      return null;
  }, [currentUser, employees, isLeader, isStaff]);

  const userTeam = myRealEmp?.team || 'Kíp A';
  const myEmpId = myRealEmp?.id || currentUser?.id;
  const myEmpName = myRealEmp?.name || currentUser?.name;

  const [showReqModal, setShowReqModal] = useState(false);
  const EMPTY_FORM = { type: 'Nghỉ phép', date: '', shiftCode: '', returnDate: '', returnShiftCode: '', reason: '', targetTeam: '', targetEmpId: '', targetEmpName: '' };
  const [reqForm, setReqForm] = useState(EMPTY_FORM);
  const [showFullRoster, setShowFullRoster] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [myRosterSlots, setMyRosterSlots] = useState([]);

  useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 60000);
      return () => clearInterval(timer);
  }, []);

  const availableTeams = settings?.teams?.filter(t => t !== 'Trung tâm') || [];
  const availableEmpsForSwap = useMemo(() => {
      if (!reqForm.targetTeam) return [];
      return employees.filter(e => e.team === reqForm.targetTeam && e.id !== myEmpId && !e.position?.toLowerCase().includes('lãnh đạo'));
  }, [reqForm.targetTeam, employees, myEmpId]);

  // ── GỬI ĐƠN: lưu vào backend để quản lý nhận được ─────────────────────
  const handleSubmitRequest = async () => {
      if (!reqForm.date || !reqForm.reason) { window.alert("Lỗi\nVui lòng nhập ngày và lý do."); return; }

      const newReq = {
          id: 'REQ_' + Date.now(),
          requesterId: myEmpId,
          requesterName: myEmpName,
          requesterTeam: userTeam,
          type: reqForm.type, date: reqForm.date, reason: reqForm.reason,
          status: 'Pending', createdAt: new Date().toISOString()
      };

      if (reqForm.type === 'Đổi ca') {
          if (!reqForm.targetEmpId) { window.alert("Lỗi\nVui lòng chọn nhân sự để đổi ca."); return; }
          if (!reqForm.shiftCode) { window.alert("Lỗi\nVui lòng chọn ca cần đổi."); return; }
          if (reqForm.returnDate && !reqForm.returnShiftCode) { window.alert("Lỗi\nVui lòng chọn ca trả."); return; }
          newReq.targetEmpId = reqForm.targetEmpId;
          newReq.targetEmpName = reqForm.targetEmpName;
          newReq.targetTeam = reqForm.targetTeam;
          newReq.shiftCode = reqForm.shiftCode;
          if (reqForm.returnDate) {
              newReq.returnDate = reqForm.returnDate;
              newReq.returnShiftCode = reqForm.returnShiftCode;
          }
          if (isStaff) {
              newReq.status = 'Pending_Leaders';
              newReq.approvals = { [userTeam]: false };
              if (reqForm.targetTeam !== userTeam) newReq.approvals[reqForm.targetTeam] = false;
          } else if (isLeader) {
              newReq.status = 'Pending_Admin';
          }
      }

      try {
          const saved = await DataService.createItem('requests', newReq);
          if (setRequests) setRequests(prev => [saved || newReq, ...(prev || [])]);
      } catch {
          if (setRequests) setRequests(prev => [newReq, ...(prev || [])]);
      }

      setShowReqModal(false);
      setReqForm(EMPTY_FORM);
      window.alert("Thành công\n" + (newReq.status === 'Pending_Leaders' ? "Đơn đã được gửi tới các Kíp trưởng liên quan." : "Đơn đã gửi Quản trị viên."));
      if (addNotification) {
          const typeLabel = newReq.type === 'Đổi ca' ? `đổi ca với ${newReq.targetEmpName}${newReq.shiftCode ? ` ca ${newReq.shiftCode}` : ''}` : newReq.type.toLowerCase();
          addNotification('Đơn đã gửi', `Đơn ${typeLabel} ngày ${newReq.date} đã được gửi chờ duyệt.`, 'info');
      }
  };

  // ── LEADER DUYỆT ĐỔI CA: cập nhật backend ────────────────────────────
  const handleLeaderApproveSwap = async (reqId) => {
      const req = requests.find(r => r.id === reqId);
      const newApprovals = { ...req.approvals, [userTeam]: true };
      const allApproved = Object.values(newApprovals).every(v => v === true);
      const updatedReq = { ...req, approvals: newApprovals, status: allApproved ? 'APPROVED' : 'Pending_Leaders' };

      try { await DataService.updateItem('requests', reqId, updatedReq); } catch {}
      if (setRequests) setRequests(prev => prev.map(r => r.id === reqId ? updatedReq : r));

      if (allApproved) {
          const shiftInfo = req.shiftCode ? ` ca ${req.shiftCode}` : '';
          const act1 = { id: 'ACT'+Date.now(), empId: req.requesterId, type: 'CHANGE', startDate: req.date, endDate: req.date, note: `Đổi ca${shiftInfo} với ${req.targetEmpName}` };
          const act2 = { id: 'ACT'+(Date.now()+1), empId: req.targetEmpId, type: 'CHANGE', startDate: req.date, endDate: req.date, note: `Đổi ca${shiftInfo} với ${req.requesterName}` };
          try {
              await DataService.createItem('activities', act1);
              await DataService.createItem('activities', act2);
          } catch {}
          if (setActivities) setActivities(prev => [...prev, act1, act2]);
          addNotification('Phê duyệt Đổi ca', `Đơn đổi ca${shiftInfo} giữa ${req.requesterName} và ${req.targetEmpName} ngày ${req.date} đã được duyệt hoàn tất.`, 'info');
          window.alert("Hoàn tất\nĐã duyệt xong! Lịch trực và Danh sách Quản lý Kíp đã được tự động cập nhật.");
      } else {
          const shiftInfo = req.shiftCode ? ` ca ${req.shiftCode}` : '';
          addNotification('Tiến độ Đổi ca', `Kíp trưởng ${userTeam} đã duyệt đơn đổi ca${shiftInfo} của ${req.requesterName} ngày ${req.date}. Đang chờ kíp đích xác nhận.`, 'info');
          window.alert("Thành công\nĐã duyệt. Chờ Kíp trưởng đích xác nhận.");
      }
  };

  const todayObj = currentTime;
  const todayKey = `${todayObj.getFullYear()}-${todayObj.getMonth()}-${todayObj.getDate()}`;
  const todayStrYMD = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
  const displayDate = `${String(todayObj.getDate()).padStart(2, '0')}/${String(todayObj.getMonth() + 1).padStart(2, '0')}/${todayObj.getFullYear()}`;
  const totalCurrentMinutes = todayObj.getHours() * 60 + todayObj.getMinutes();
  const currentShiftCode = todayObj.getHours() < 11 ? 'S' : 'D';
  const currentShiftName = currentShiftCode === 'S' ? 'Ca Sáng' : 'Ca Đêm';

  const safeSmsReports = smsReports.length > 0 ? smsReports : [{ id: 'sms1', title: 'Thông báo hoạt động bay Chuyên cơ', time: '07:30', total: 15, ack: 15, status: 'DONE' }, { id: 'sms2', title: 'Báo cáo thời tiết xấu khu vực sân bay', time: '09:15', total: 15, ack: 12, status: 'PENDING' }];

  const myNextShift = useMemo(() => {
      if (isAdmin || !myEmpId) return null;
      let foundShift = null;
      for (let i = 0; i < 14; i++) {
          const d = new Date(todayObj); d.setDate(d.getDate() + i);
          const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const shiftCode = scheduleData[`${myEmpId}_${dateKey}`]; 
          
          if (shiftCode) {
              const shiftInfo = settings?.shiftTypes?.find(s => s.code === shiftCode);
              if (i === 0 && shiftInfo) {
                  const [sH] = (shiftInfo.startTime || '07:00').split(':').map(Number);
                  const [eH, eM] = (shiftInfo.endTime || '19:00').split(':').map(Number);
                  let endMin = eH * 60 + eM;
                  let curMin = totalCurrentMinutes;
                  if (eH < sH) { endMin += 24 * 60; if (todayObj.getHours() < eH) curMin += 24 * 60; }
                  if (curMin > endMin) continue; 
              }
              
              let assignedPosition = myRealEmp?.position || 'Kiểm soát viên';
              const positionKeys = ['QL', 'KSV', 'ON-CALL'];
              for (const pos of positionKeys) {
                  const extraKey = `${dateKey}_${shiftCode}_${pos}`;
                  if (extraAssignments[extraKey]?.some(emp => emp.id === myEmpId)) {
                      assignedPosition = pos === 'QL' ? 'Kíp trưởng' : pos === 'KSV' ? 'Trực Chính Radar' : 'Trực Dự Bị (On-Call)';
                  }
              }

              foundShift = {
                  dateDisplay: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
                  isToday: i === 0, shiftName: shiftInfo?.label || `Ca ${shiftCode}`,
                  time: `${shiftInfo?.startTime || '--:--'} đến ${shiftInfo?.endTime || '--:--'}`,
                  position: assignedPosition, baseStartHour: shiftInfo?.startTime ? parseInt(shiftInfo.startTime.split(':')[0]) : (shiftCode === 'S' ? 7 : 19),
                  actualDate: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
                  shiftCode,
                  isMock: false
              };
              break;
          }
      }
      return foundShift;
  }, [myEmpId, scheduleData, extraAssignments, settings, isAdmin, todayObj, totalCurrentMinutes, myRealEmp]);

  // Load published detailed roster for current user's next shift
  useEffect(() => {
      if (!myNextShift?.actualDate || !myNextShift?.shiftCode || !myEmpId) { setMyRosterSlots([]); return; }
      let cancelled = false;
      const load = async () => {
          try {
              const res = await api.get('/api/schedules/detailed_rosters');
              const globalData = res.data?.data ?? res.data ?? {};
              if (cancelled) return;
              const key = `${userTeam}_${myNextShift.actualDate}_${myNextShift.shiftCode}`;
              const entry = globalData[key];
              if (!entry || entry.status !== 'PUBLISHED') { setMyRosterSlots([]); return; }
              const customCols = settings?.rosterColumns?.length > 0 ? settings.rosterColumns : ['CTL', 'APP', 'TWR', 'GCU'];
              const myCodes = [String(myEmpId), myRealEmp?.icaoCode].filter(Boolean).map(c => c.toUpperCase());
              const slots = [];
              (entry.data || []).forEach(row => {
                  customCols.forEach(colKey => {
                      const cellVal = (row[colKey] || '').trim().toUpperCase();
                      if (!cellVal) return;
                      const matched = myCodes.some(code => new RegExp(`\\b${code}\\b`).test(cellVal));
                      if (matched) slots.push({ utcTime: row.time || '', position: colKey });
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

      // Use published roster data (UTC) when available
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

      // Fallback: mock rotation schedule (local time)
      const startH = myNextShift.baseStartHour;
      const slots = [
          { startOffset: 0, durH: 2, durM: 0, pos: 'Trực TWR (Chỉ Huy)' }, { startOffset: 2, durH: 1, durM: 30, pos: 'Nghỉ / Dự bị' },
          { startOffset: 3.5, durH: 2, durM: 0, pos: 'Trực APP (Tiếp Cận)' }, { startOffset: 5.5, durH: 1, durM: 15, pos: 'Trực HĐ TWR (Hiệp Đồng)' },
          { startOffset: 6.75, durH: 2, durM: 15, pos: 'Nghỉ ngơi' }, { startOffset: 9, durH: 3, durM: 0, pos: 'Trực GND (Mặt Đất)' }
      ];
      let baseStartMin = startH * 60;
      let currentAdjustedMin = totalCurrentMinutes;
      if (myNextShift.isToday && startH >= 18 && todayObj.getHours() < 12) currentAdjustedMin += 24 * 60;

      return slots.map(slot => {
          const startTotalMin = baseStartMin + Math.round(slot.startOffset * 60);
          const endTotalMin = startTotalMin + Math.round(slot.durH * 60 + slot.durM);
          const formatTime = (min) => `${String(Math.floor(min/60)%24).padStart(2,'0')}:${String(Math.round(min%60)).padStart(2,'0')}`;
          let status = 'upcoming';
          if (myNextShift.isToday) {
              if (currentAdjustedMin >= startTotalMin && currentAdjustedMin < endTotalMin) status = 'current';
              else if (currentAdjustedMin >= endTotalMin) status = 'past';
          }
          return { id: startTotalMin, timeStr: `${formatTime(startTotalMin)} - ${formatTime(endTotalMin)}`, position: slot.pos, status };
      });
  }, [myNextShift, myRosterSlots, totalCurrentMinutes, todayObj]);

  const dashboardData = useMemo(() => {
      const operationalStaff = employees.filter(e => e.team !== 'Trung tâm' && !e.position?.toLowerCase().includes('lãnh đạo'));
      const leavesToday = activities.filter(act => act.startDate <= todayStrYMD && act.endDate >= todayStrYMD && act.type !== 'CHANGE' && act.status !== 'REJECTED');
      let teamOnDuty = 'Chưa xác định';
      let membersOnDuty = [];
      operationalStaff.forEach(emp => {
          if (scheduleData[`${emp.id}_${todayKey}`] === currentShiftCode) {
              if (teamOnDuty === 'Chưa xác định') teamOnDuty = emp.team; 
              if (!leavesToday.some(act => act.empId === emp.id)) membersOnDuty.push(emp);
          }
      });
      let smsTotalExpected = safeSmsReports.reduce((sum, sms) => sum + sms.total, 0);
      let smsAckRate = smsTotalExpected > 0 ? Math.round((safeSmsReports.reduce((sum, sms) => sum + sms.ack, 0) / smsTotalExpected) * 100) : 0;
      return { totalStaff: operationalStaff.length, leavesToday, pendingRequests: requests.filter(r => r.status !== 'APPROVED').length, teamOnDuty, membersOnDuty, smsTotalSent: safeSmsReports.length, smsAckRate };
  }, [employees, activities, requests, scheduleData, todayKey, todayStrYMD, currentShiftCode, safeSmsReports]);

  const getActivityConfig = (type) => {
      const found = settings?.activityTypes?.find(a => a.id === type);
      if (found) {
          if (found.id === 'LEAVE') return { label: 'Nghỉ phép', bg: '#fef2f2', text: '#dc2626', icon: 'coffee' };
          if (found.id === 'SICK') return { label: 'Nghỉ ốm', bg: '#f0fdfa', text: '#0d9488', icon: 'thermometer' };
          if (found.id === 'TRIP') return { label: 'Công tác', bg: '#faf5ff', text: '#9333ea', icon: 'briefcase' };
      }
      return { label: type, bg: '#f3f4f6', text: '#4b5563', icon: 'info' };
  };

  const renderSwapStatus = (req) => {
      if (req.status === 'Pending_Admin') return <span style={{ ...styles.statusText, color: '#d97706' }}>Chờ Quản lý duyệt</span>;
      if (req.status === 'APPROVED') return <span style={{ ...styles.statusText, color: '#16a34a' }}>Đã duyệt</span>;
      if (req.status === 'Pending_Leaders') {
          const myLeaderApproved = req.approvals?.[req.requesterTeam];
          const targetLeaderApproved = req.approvals?.[req.targetTeam];
          if (req.requesterTeam === req.targetTeam) return <span style={{ ...styles.statusText, color: '#d97706' }}>Chờ Kíp trưởng duyệt</span>;
          return (
              <div>
                  <span style={{ ...styles.statusText, color: '#d97706', marginBottom: 2 }}>Tiến độ duyệt (1/2):</span>
                  <span style={{fontSize: 10, color: myLeaderApproved ? '#16a34a' : '#64748b'}}>• Kíp {req.requesterTeam}: {myLeaderApproved ? 'Đã xong' : 'Đang chờ'}</span>
                  <span style={{fontSize: 10, color: targetLeaderApproved ? '#16a34a' : '#64748b'}}>• Kíp {req.targetTeam}: {targetLeaderApproved ? 'Đã xong' : 'Đang chờ'}</span>
              </div>
          );
      }
      return <span style={{ ...styles.statusText, color: '#d97706' }}>Đang xử lý</span>;
  };

  if (!isAdmin) {
      const myRequests = requests?.filter(r => r.requesterId === myEmpId) || [];
      const shiftEmployees = employees.filter(emp => emp.team !== 'Trung tâm' && !emp.position?.toLowerCase().includes('lãnh đạo'));
      const requestsForLeader = requests?.filter(r => r.type === 'Đổi ca' && r.status === 'Pending_Leaders' && (r.requesterTeam === userTeam || r.targetTeam === userTeam) && r.approvals && r.approvals[userTeam] === false) || [];

      return (
          <div style={{ ...styles.container, padding: 20 }}>

              <DetailedRosterModal team={userTeam} isOpen={showFullRoster} onClose={() => setShowFullRoster(false)} employees={shiftEmployees} activities={activities} settings={settings} isAdmin={isLeader} />

              <div>
                  <div style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 25, gap: 15 }}>
                      <div style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' }}>
                          <span style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', fontFamily: 'Times New Roman' }}>{myEmpName?.charAt(0) || 'U'}</span>
                      </div>
                      <div>
                          <span style={{ fontFamily: 'Times New Roman', fontSize: 24, fontWeight: 'bold', color: '#1e293b' }}>Xin chào, {myEmpName}!</span>
                          <span style={{ fontFamily: 'Times New Roman', fontSize: 14, color: '#64748b', marginTop: 4 }}>Kíp hiện tại: {userTeam}</span>
                      </div>
                  </div>

                  {isLeader && requestsForLeader.length > 0 && (
                      <div style={{ backgroundColor: '#fffbeb', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#fde68a' }}>
                          <span style={{ fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#b45309', marginBottom: 15 }}><Icon name="bell" size={16}/> Đơn Đổi Ca Cần Bạn Duyệt ({requestsForLeader.length})</span>
                          {requestsForLeader.map(req => (
                              <div key={req.id} style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fde68a', marginBottom: 10 }}>
                                  <span style={{ fontFamily: 'Times New Roman', fontSize: 14, color: '#1e293b', marginBottom: 6 }}><span style={{fontWeight: 'bold', color: '#dc2626'}}>{req.requesterName}</span> xin đổi ca với <span style={{fontWeight: 'bold', color: '#2563eb'}}>{req.targetEmpName}</span></span>
                                  <span style={{ fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', marginBottom: 10 }}>Ngày đổi: {req.date} • Lý do: {req.reason}</span>
                                  <button type="button" style={{ backgroundColor: '#10b981', paddingTop: 8, paddingBottom: 8, borderRadius: 6, alignItems: 'center' }} onClick={() => handleLeaderApproveSwap(req.id)}><span style={{ color: '#fff', fontWeight: 'bold', fontSize: 13, fontFamily: 'Times New Roman' }}>Phê duyệt đổi ca</span></button>
                              </div>
                          ))}
                      </div>
                  )}

                  <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', boxShadow: "0 4px 6px rgba(0,0,0,0.08)"}}>
                      <div style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                          <span style={{ fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}><Icon name="clock" size={16}/> Lịch trực chi tiết của bạn</span>
                          <button type="button" onClick={() => setShowFullRoster(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eff6ff', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe' }}>
                              <Icon name="layout" size={14} color="#2563eb" />
                              <span style={{ color: '#2563eb', fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold' }}>Xem lịch trực ca chi tiết</span>
                          </button>
                      </div>
                      
                      {myNextShift ? (
                          <>
                              <div style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9ff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#bae6fd', marginBottom: 20 }}>
                                  <div style={{ alignItems: 'center', borderRightWidth: 1, borderColor: '#bfdbfe', paddingRight: 15, minWidth: 80 }}>
                                      <span style={{ fontFamily: 'Times New Roman', fontSize: 13, color: '#0369a1', fontWeight: 'bold' }}>{myNextShift.isToday ? 'HÔM NAY' : 'SẮP TỚI'}</span>
                                      <span style={{ fontFamily: 'Courier New', fontSize: 20, color: '#0284c7', fontWeight: 'bold', marginTop: 4 }}>{myNextShift.dateDisplay}</span>
                                  </div>
                                  <div style={{ flex: 1, paddingLeft: 15 }}>
                                      <span style={{ fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>{myNextShift.shiftName}</span>
                                      <span style={{ fontFamily: 'Courier New', fontSize: 13, color: '#64748b', marginTop: 6 }}><Icon name="clock" size={12}/> {myNextShift.time}</span>
                                      <span style={{ fontFamily: 'Times New Roman', fontSize: 14, color: '#059669', marginTop: 4, fontWeight: 'bold' }}><Icon name="map-pin" size={12}/> Vị trí: {myNextShift.position}</span>
                                  </div>
                                  <div style={{ backgroundColor: myNextShift.isToday ? '#ef4444' : '#2563eb', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 12 }}><span style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{myNextShift.isToday ? 'Đang diễn ra' : 'Đã lên lịch'}</span></div>
                              </div>

                              {positionTimeline.length > 0 && (
                                  <div style={{ paddingLeft: 10 }}>
                                      <span style={{ fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 15 }}>
                                          {myRosterSlots.length > 0 ? 'Lịch vị trí được phân công (UTC):' : 'Lộ trình luân chuyển vị trí (ước tính):'}
                                      </span>
                                      {positionTimeline.map((item, index) => (
                                          <div key={item.id} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: index === positionTimeline.length - 1 ? 0 : 15 }}>
                                              <div style={{ alignItems: 'center', marginRight: 15 }}>
                                                  <div style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: item.status === 'current' ? '#2563eb' : item.status === 'past' ? '#94a3b8' : '#e2e8f0', borderWidth: 2, borderColor: item.status === 'current' ? '#bfdbfe' : '#fff', zIndex: 2 }} />
                                                  {index < positionTimeline.length - 1 && <div style={{ width: 2, height: 45, backgroundColor: item.status === 'past' ? '#cbd5e1' : '#f1f5f9', position: 'absolute', top: 14, zIndex: 1 }} />}
                                              </div>
                                              
                                              <div style={{ flex: 1, backgroundColor: item.status === 'current' ? '#eff6ff' : '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: item.status === 'current' ? '#bfdbfe' : '#f1f5f9', marginTop: -10 }}>
                                                  <span style={{ fontFamily: 'Courier New', fontSize: 13, fontWeight: 'bold', color: item.status === 'past' ? '#94a3b8' : '#2563eb' }}>{item.timeStr}</span>
                                                  <span style={{ fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: item.status === 'past' ? '#94a3b8' : '#1e293b', marginTop: 4 }}>{item.position}</span>
                                                  {item.status === 'current' && <span style={{ fontFamily: 'Times New Roman', fontSize: 12, color: '#16a34a', marginTop: 4, fontStyle: 'italic' }}>Đang thực hiện...</span>}
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </>
                      ) : (
                          <div style={{ backgroundColor: '#f8fafc', padding: 20, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed' }}>
                              <Icon name="calendar" size={32} color="#cbd5e1" />
                              <span style={{ fontFamily: 'Times New Roman', color: '#64748b', marginTop: 10 }}>Bạn chưa có lịch trực nào trong 14 ngày tới.</span>
                          </div>
                      )}
                  </div>

                  <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <div style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                          <span style={{ fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}><Icon name="file-text" size={16}/> Đơn từ cá nhân</span>
                          <button type="button" onClick={() => setShowReqModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563eb', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8 }}>
                              <Icon name="plus" size={14} color="#fff" />
                              <span style={{ color: '#fff', fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold' }}>Tạo đơn</span>
                          </button>
                      </div>
                      
                      {myRequests.length === 0 ? (
                          <span style={{ fontFamily: 'Times New Roman', fontStyle: 'italic', color: '#94a3b8', textAlign: 'center', paddingTop: 20 , paddingBottom: 20 ,}}>Bạn chưa có đơn từ nào.</span>
                      ) : (
                          myRequests.map(req => (
                              <div key={req.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' }}>
                                  <div style={{ flex: 1 }}>
                                      <span style={{ fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#1e293b' }}>
                                          {req.type} {req.type === 'Đổi ca' && <span style={{color: '#2563eb'}}>↔ {req.targetEmpName}</span>} — {req.date}{req.shiftCode ? ` [${req.shiftCode}]` : ''}
                                      </span>
                                      {req.returnDate && <span style={{ fontFamily: 'Times New Roman', fontSize: 12, color: '#7c3aed', marginTop: 2 }}>Trả ca: {req.returnDate}{req.returnShiftCode ? ` [${req.returnShiftCode}]` : ''}</span>}
                                      <span style={{ fontFamily: 'Times New Roman', fontSize: 13, color: '#64748b', marginTop: 2 }}>{req.reason}</span>
                                  </div>
                                  <div style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: 12, borderWidth: 1, backgroundColor: req.status.includes('Pending') ? '#fffbeb' : '#f0fdf4', borderColor: req.status.includes('Pending') ? '#fde68a' : '#bbf7d0' }}>
                                      {req.type === 'Đổi ca' ? renderSwapStatus(req) : <span style={{ ...styles.statusText, color: req.status === 'Pending' ? '#d97706' : '#16a34a' }}>{req.status === 'Pending' ? 'Đang chờ' : 'Đã duyệt'}</span>}
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
                  <div style={{ height: 40 }}/>
              </div>

              <Modal visible={showReqModal} maxWidth="480px">
                  <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}>Tạo Đơn Yêu Cầu</span>
                      <button type="button" onClick={() => setShowReqModal(false)}><Icon name="x" size={20} color="#64748b"/></button>
                  </div>
                  <div style={{ padding: 20 }}>
                      <span style={{ display: 'block', fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 8 }}>Loại đơn</span>
                      <div style={{ display: 'flex', flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                          <button type="button" style={{ flex: 1, padding: '10px 0', display: 'flex', justifyContent: 'center', borderRadius: 8, border: `1.5px solid ${reqForm.type === 'Nghỉ phép' ? '#2563eb' : '#e2e8f0'}`, backgroundColor: reqForm.type === 'Nghỉ phép' ? '#eff6ff' : '#f8fafc', cursor: 'pointer' }} onClick={() => setReqForm({...reqForm, type: 'Nghỉ phép'})}>
                              <span style={{ fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: reqForm.type === 'Nghỉ phép' ? '#2563eb' : '#64748b' }}>Nghỉ phép</span>
                          </button>
                          <button type="button" style={{ flex: 1, padding: '10px 0', display: 'flex', justifyContent: 'center', borderRadius: 8, border: `1.5px solid ${reqForm.type === 'Đổi ca' ? '#2563eb' : '#e2e8f0'}`, backgroundColor: reqForm.type === 'Đổi ca' ? '#eff6ff' : '#f8fafc', cursor: 'pointer' }} onClick={() => setReqForm({...reqForm, type: 'Đổi ca'})}>
                              <span style={{ fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: reqForm.type === 'Đổi ca' ? '#2563eb' : '#64748b' }}>Đổi ca</span>
                          </button>
                      </div>

                      {reqForm.type === 'Đổi ca' && (
                          <div style={{ backgroundColor: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                              <span style={{ display: 'block', fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#2563eb', marginBottom: 10 }}>1. Chọn Kíp Đích</span>
                              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                                  {availableTeams.map(t => (
                                      <button type="button" key={t} style={{ padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${reqForm.targetTeam === t ? '#2563eb' : '#cbd5e1'}`, backgroundColor: reqForm.targetTeam === t ? '#2563eb' : '#fff', cursor: 'pointer' }} onClick={() => setReqForm({...reqForm, targetTeam: t, targetEmpId: '', targetEmpName: ''})}>
                                          <span style={{ fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: reqForm.targetTeam === t ? '#fff' : '#475569' }}>{t}</span>
                                      </button>
                                  ))}
                              </div>
                              {reqForm.targetTeam && (
                                  <>
                                      <span style={{ display: 'block', fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#2563eb', marginBottom: 10 }}>2. Chọn Nhân Sự</span>
                                      {availableEmpsForSwap.length > 0 ? (
                                          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                              {availableEmpsForSwap.map(emp => (
                                                  <button type="button" key={emp.id} style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${reqForm.targetEmpId === emp.id ? '#2563eb' : '#cbd5e1'}`, backgroundColor: reqForm.targetEmpId === emp.id ? '#eff6ff' : '#fff', cursor: 'pointer' }} onClick={() => setReqForm({...reqForm, targetEmpId: emp.id, targetEmpName: emp.name})}>
                                                      <span style={{ fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: reqForm.targetEmpId === emp.id ? '#2563eb' : '#334155' }}>{emp.name}</span>
                                                  </button>
                                              ))}
                                          </div>
                                      ) : (
                                          <span style={{ fontFamily: 'Times New Roman', fontSize: 12, fontStyle: 'italic', color: '#ef4444' }}>Không có nhân sự nào phù hợp.</span>
                                      )}
                                  </>
                              )}
                          </div>
                      )}

                      {reqForm.type === 'Đổi ca' && (
                          <div style={{ backgroundColor: '#f0f9ff', padding: 14, borderRadius: 8, marginBottom: 16, border: '1px solid #bae6fd' }}>
                              <span style={{ display: 'block', fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#0369a1', marginBottom: 10 }}>3. Ca cần đổi *</span>
                              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                  {(settings?.shiftTypes || []).map(shift => (
                                      <button type="button" key={shift.code}
                                          style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${reqForm.shiftCode === shift.code ? '#0369a1' : '#bae6fd'}`, backgroundColor: reqForm.shiftCode === shift.code ? '#0369a1' : '#fff', cursor: 'pointer' }}
                                          onClick={() => setReqForm({...reqForm, shiftCode: shift.code})}>
                                          <span style={{ fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: reqForm.shiftCode === shift.code ? '#fff' : '#0369a1' }}>
                                              {shift.label} ({shift.startTime}–{shift.endTime})
                                          </span>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      )}

                      <span style={{ display: 'block', fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 8 }}>Ngày đổi ca *</span>
                      <input type="date" style={{ display: 'block', width: '100%', boxSizing: 'border-box', fontFamily: 'Times New Roman', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 14 }} value={reqForm.date} onChange={(e) => setReqForm({...reqForm, date: e.target.value})} />

                      {reqForm.type === 'Đổi ca' && (
                          <div style={{ backgroundColor: '#fafafa', padding: 14, borderRadius: 8, marginBottom: 14, border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: reqForm.returnDate ? 12 : 0 }}>
                                  <span style={{ fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569' }}>Ngày trả ca (tùy chọn)</span>
                                  <button type="button"
                                      style={{ padding: '4px 12px', borderRadius: 6, border: `1.5px solid ${reqForm.returnDate ? '#dc2626' : '#2563eb'}`, backgroundColor: reqForm.returnDate ? '#fef2f2' : '#eff6ff', cursor: 'pointer' }}
                                      onClick={() => setReqForm({...reqForm, returnDate: reqForm.returnDate ? '' : new Date().toISOString().slice(0,10), returnShiftCode: ''})}>
                                      <span style={{ fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: reqForm.returnDate ? '#dc2626' : '#2563eb' }}>{reqForm.returnDate ? 'Xóa trả ca' : '+ Thêm trả ca'}</span>
                                  </button>
                              </div>
                              {reqForm.returnDate && (
                                  <>
                                      <input type="date" style={{ display: 'block', width: '100%', boxSizing: 'border-box', fontFamily: 'Times New Roman', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 10 }} value={reqForm.returnDate} onChange={(e) => setReqForm({...reqForm, returnDate: e.target.value})} />
                                      <span style={{ display: 'block', fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#475569', marginBottom: 8 }}>Ca trả *</span>
                                      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                          {(settings?.shiftTypes || []).map(shift => (
                                              <button type="button" key={shift.code}
                                                  style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${reqForm.returnShiftCode === shift.code ? '#7c3aed' : '#e2e8f0'}`, backgroundColor: reqForm.returnShiftCode === shift.code ? '#7c3aed' : '#fff', cursor: 'pointer' }}
                                                  onClick={() => setReqForm({...reqForm, returnShiftCode: shift.code})}>
                                                  <span style={{ fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: reqForm.returnShiftCode === shift.code ? '#fff' : '#7c3aed' }}>
                                                      {shift.label} ({shift.startTime}–{shift.endTime})
                                                  </span>
                                              </button>
                                          ))}
                                      </div>
                                  </>
                              )}
                          </div>
                      )}

                      <span style={{ display: 'block', fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 8 }}>Lý do chi tiết *</span>
                      <textarea style={{ display: 'block', width: '100%', boxSizing: 'border-box', fontFamily: 'Times New Roman', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', fontSize: 14, height: 88, resize: 'vertical' }} placeholder="Nhập lý do..." value={reqForm.reason} onChange={(e) => setReqForm({...reqForm, reason: e.target.value})} />
                      <button type="button" style={{ display: 'flex', width: '100%', justifyContent: 'center', backgroundColor: '#2563eb', padding: '13px 0', borderRadius: 8, marginTop: 18, cursor: 'pointer', border: 'none' }} onClick={handleSubmitRequest}>
                          <span style={{ color: '#fff', fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold' }}>Gửi Đơn Xin Duyệt</span>
                      </button>
                  </div>
              </Modal>
          </div>
      );
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerCard}>
          <div style={styles.headerLeft}>
              <div style={styles.avatarBox}><Icon name="shield" size={28} color="#2563eb" /></div>
              <div><span style={styles.greetingText}>Hệ thống Quản lý KSVKL</span><span style={styles.systemName}>ATC SHIFT PRO</span></div>
          </div>
          <div style={styles.headerRight}>
              <div style={styles.dateBadge}><Icon name="calendar" size={14} color="#64748b" /><span style={styles.dateText}>Hôm nay: {displayDate}</span></div>
              {dashboardData.teamOnDuty !== 'Chưa xác định' ? (
                  <div style={styles.shiftBadgeAlert}><div style={styles.pulsingDot} /><span style={styles.shiftBadgeTextAlert}>ĐANG TRỰC: {dashboardData.teamOnDuty} ({currentShiftName})</span></div>
              ) : (
                  <div style={styles.shiftBadgeNormal}><span style={styles.shiftBadgeTextNormal}>CHƯA CÓ DỮ LIỆU CA TRỰC</span></div>
              )}
          </div>
      </div>

      <div style={styles.overviewRow}>
          <div style={{ ...styles.overviewCard, borderBottomColor: '#3b82f6' }}>
              <div style={styles.cardIconWrap}><Icon name="users" size={20} color="#3b82f6" /></div>
              <span style={styles.cardValue}>{dashboardData.totalStaff}</span>
              <span style={styles.cardLabel}>Quân số điều hành</span>
          </div>
          <div style={{ ...styles.overviewCard, borderBottomColor: '#10b981' }}>
              <div style={{ ...styles.cardIconWrap, backgroundColor: '#ecfdf5' }}><Icon name="message-square" size={20} color="#10b981" /></div>
              <div style={{flexDirection: 'row', alignItems: 'baseline'}}><span style={{ ...styles.cardValue, color: '#10b981' }}>{dashboardData.smsAckRate}</span><span style={{fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#10b981', marginLeft: 2}}>%</span></div>
              <span style={styles.cardLabel}>Tỉ lệ xác nhận SMS</span>
          </div>
          <div style={{ ...styles.overviewCard, borderBottomColor: '#ef4444' }}>
              <div style={{ ...styles.cardIconWrap, backgroundColor: '#fef2f2' }}><Icon name="user-minus" size={20} color="#ef4444" /></div>
              <span style={{ ...styles.cardValue, color: '#ef4444' }}>{dashboardData.leavesToday.length}</span>
              <span style={styles.cardLabel}>Vắng mặt hôm nay</span>
          </div>
          <div style={{ ...styles.overviewCard, borderBottomColor: '#f59e0b' }}>
              <div style={{ ...styles.cardIconWrap, backgroundColor: '#fffbeb' }}><Icon name="inbox" size={20} color="#f59e0b" /></div>
              <span style={{ ...styles.cardValue, color: '#f59e0b' }}>{dashboardData.pendingRequests}</span>
              <span style={styles.cardLabel}>Đơn từ chờ duyệt</span>
          </div>
      </div>

      <div>
          <div style={styles.mainContentRow}>
              <div style={styles.columnLeft}>
                  <div style={styles.columnCard}>
                      <div style={{ ...styles.columnHeader, backgroundColor: '#f0fdfa', borderBottomColor: '#ccfbf1' }}>
                          <Icon name="activity" size={18} color="#0d9488" />
                          <span style={{ ...styles.columnTitle, color: '#0f766e' }}>Thực tế Kíp đang trực ({dashboardData.membersOnDuty.length} người)</span>
                      </div>
                      <div style={styles.columnBody}>
                          {dashboardData.membersOnDuty.length > 0 ? (
                              dashboardData.membersOnDuty.map((emp, index) => (
                                  <div key={emp.id || index} style={styles.dutyItem}>
                                      <div style={styles.dutyAvatar}><span style={styles.dutyAvatarText}>{emp.name.charAt(0)}</span></div>
                                      <div style={styles.dutyInfo}>
                                          <span style={styles.dutyName}>{emp.name}</span>
                                          <div style={{flexDirection: 'row', gap: 6, marginTop: 4}}>
                                              <div style={styles.dutyTag}><span style={styles.dutyTagText}>{emp.position}</span></div>
                                              <div style={styles.dutyTag}><span style={styles.dutyTagText}>{emp.qualification}</span></div>
                                          </div>
                                      </div>
                                      {emp.isChief && <Icon name="star" size={16} color="#eab308" />}
                                  </div>
                              ))
                          ) : (
                              <div style={styles.emptyBox}><Icon name="grid" size={32} color="#cbd5e1" /><span style={styles.emptyText}>Chưa có ai trực hoặc mọi người đều nghỉ.</span></div>
                          )}
                      </div>
                  </div>

                  <div style={{ ...styles.columnCard, marginTop: 20 }}>
                      <div style={styles.columnHeader}><Icon name="user-x" size={18} color="#1e293b" /><span style={styles.columnTitle}>Vắng mặt Hôm nay</span></div>
                      <div style={styles.columnBody}>
                          {dashboardData.leavesToday.length > 0 ? (
                              dashboardData.leavesToday.map((act, index) => {
                                  const emp = employees.find(e => e.id === act.empId);
                                  const conf = getActivityConfig(act.type);
                                  return (
                                      <div key={act.id || index} style={styles.listItem}>
                                          <div style={{ ...styles.listIcon, backgroundColor: conf.bg }}><Icon name={conf.icon} size={14} color={conf.text} /></div>
                                          <div style={styles.listInfo}>
                                              <span style={styles.listName}>{emp?.name || act.empId}</span>
                                              <span style={styles.listSub}>{emp?.team || 'Không xác định'}</span>
                                          </div>
                                          <div style={{ ...styles.statusBadge, backgroundColor: conf.bg, borderColor: conf.bg }}><span style={{ ...styles.statusBadgeText, color: conf.text }}>{conf.label}</span></div>
                                      </div>
                                  )
                              })
                          ) : (
                              <div style={{ ...styles.emptyBox, paddingTop: 20, paddingBottom: 20 }}><Icon name="check-circle" size={24} color="#10b981" /><span style={styles.emptyText}>Không có nhân sự vắng mặt.</span></div>
                          )}
                      </div>
                  </div>
              </div>

              <div style={styles.columnRight}>
                  <div style={styles.columnCard}>
                      <div style={styles.columnHeader}><Icon name="smartphone" size={18} color="#1e293b" /><span style={styles.columnTitle}>Tiến độ báo nhận SMS ({dashboardData.smsTotalSent})</span></div>
                      <div style={styles.columnBody}>
                          {safeSmsReports.map((sms, index) => {
                              const isDone = sms.ack === sms.total;
                              return (
                                  <div key={sms.id || index} style={styles.smsItem}>
                                      <div style={styles.smsHeader}>
                                          <span style={styles.smsTime}>{sms.time}</span>
                                          <div style={{ ...styles.smsStatus, backgroundColor: isDone ? '#ecfdf5' : '#fffbeb' }}><span style={{ ...styles.smsStatusText, color: isDone ? '#059669' : '#d97706' }}>{isDone ? 'Hoàn tất' : 'Đang chờ'}</span></div>
                                      </div>
                                      <span style={styles.smsTitle} >{sms.title}</span>
                                      <div style={styles.progressWrap}>
                                          <div style={styles.progressInfo}>
                                              <span style={styles.progressText}>Đã báo nhận:</span>
                                              <span style={styles.progressNumbers}><span style={{color: isDone ? '#059669' : '#d97706', fontWeight: 'bold'}}>{sms.ack}</span> / {sms.total}</span>
                                          </div>
                                          <div style={styles.progressBarBg}><div style={{ ...styles.progressBarFill, width: `${(sms.ack / sms.total) * 100}%`, backgroundColor: isDone ? '#10b981' : '#f59e0b' }} /></div>
                                      </div>
                                  </div>
                              )
                          })}
                      </div>
                  </div>
              </div>
          </div>
          <div style={{height: 40}} />
      </div>
    </div>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#f0f4f8', padding: 20, overflowY: 'auto', display: 'block' },

  /* Header */
  headerCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
    padding: '20px 24px', borderRadius: 18,
    marginBottom: 20,
    boxShadow: '0 8px 24px rgba(9,18,43,.25), 0 2px 6px rgba(9,18,43,.15)',
    flexWrap: 'wrap', gap: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarBox: {
    width: 52, height: 52, borderRadius: 16,
    background: 'linear-gradient(135deg, rgba(37,99,235,.3), rgba(59,130,246,.2))',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,.12)',
  },
  greetingText: { fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 4, letterSpacing: '0.04em' },
  systemName: { fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '0.06em' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  dateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(255,255,255,.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,.15)',
    paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7, borderRadius: 10,
  },
  dateText: { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.85)' },
  shiftBadgeAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    background: 'linear-gradient(135deg, rgba(239,68,68,.25), rgba(239,68,68,.15))',
    paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,.3)',
  },
  pulsingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#f87171' },
  shiftBadgeTextAlert: { fontSize: 12, fontWeight: 700, color: '#fca5a5', letterSpacing: '0.04em' },
  shiftBadgeNormal: {
    backgroundColor: 'rgba(255,255,255,.08)',
    paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,.12)',
  },
  shiftBadgeTextNormal: { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.5)' },

  /* Stat cards */
  overviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 20 },
  overviewCard: {
    flex: 1, minWidth: 170,
    backgroundColor: '#fff', padding: '18px 20px',
    borderRadius: 16, borderWidth: 1, borderColor: '#e8eef4',
    borderBottomWidth: 4,
    boxShadow: '0 2px 8px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)',
    position: 'relative', overflow: 'hidden',
  },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  cardValue: { fontSize: 30, fontWeight: 800, color: '#0f172a', marginBottom: 4, lineHeight: 1 },
  cardLabel: { fontSize: 12, color: '#64748b', fontWeight: 500, letterSpacing: '0.01em' },

  /* Content area */
  mainContentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  columnLeft: { flex: 1, minWidth: 340 },
  columnRight: { flex: 1, minWidth: 340 },
  columnCard: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#e8eef4', overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)',
  },
  columnHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f8fafc', padding: '14px 18px',
    borderBottomWidth: 1, borderColor: '#e8eef4',
  },
  columnTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a' },
  columnBody: { padding: '14px 18px' },

  /* Duty list */
  dutyItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 11, paddingBottom: 11,
    borderBottomWidth: 1, borderColor: '#f1f5f9',
  },
  dutyAvatar: {
    width: 38, height: 38, borderRadius: 11,
    background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12, flexShrink: 0,
  },
  dutyAvatarText: { fontSize: 15, fontWeight: 700, color: '#1d4ed8' },
  dutyInfo: { flex: 1 },
  dutyName: { fontSize: 14, fontWeight: 600, color: '#0f172a' },
  dutyTag: {
    backgroundColor: '#f1f5f9', paddingLeft: 7, paddingRight: 7,
    paddingTop: 3, paddingBottom: 3, borderRadius: 6,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  dutyTagText: { fontSize: 10, color: '#475569', fontWeight: 600 },

  /* SMS */
  smsItem: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8eef4',
    borderRadius: 12, padding: '14px 16px', marginBottom: 10,
  },
  smsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  smsTime: { fontSize: 12, fontWeight: 600, color: '#64748b' },
  smsStatus: { paddingLeft: 9, paddingRight: 9, paddingTop: 3, paddingBottom: 3, borderRadius: 20 },
  smsStatusText: { fontSize: 10, fontWeight: 700 },
  smsTitle: { fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 12 },
  progressWrap: { marginTop: 4 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  progressText: { fontSize: 11, color: '#64748b' },
  progressNumbers: { fontSize: 12, color: '#475569', fontWeight: 500 },
  progressBarBg: {
    height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 3 },

  /* Absence list */
  listItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 10, paddingBottom: 10,
    borderBottomWidth: 1, borderColor: '#f1f5f9',
  },
  listIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 12, flexShrink: 0,
  },
  listInfo: { flex: 1 },
  listName: { fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 2 },
  listSub: { fontSize: 12, color: '#64748b', fontStyle: 'italic' },
  statusBadge: {
    paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
    borderRadius: 8, borderWidth: 1,
  },
  statusBadgeText: { fontSize: 11, fontWeight: 700 },

  /* Empty states */
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 32, paddingBottom: 32 },
  emptyText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', marginTop: 10, textAlign: 'center' },
  statusText: { fontSize: 11, fontWeight: 700 },
};


