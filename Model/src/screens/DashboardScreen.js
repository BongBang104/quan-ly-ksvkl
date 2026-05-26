import React, { useMemo, useState, useEffect, useContext } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import DetailedRosterModal from '../components/DetailedRosterModal'; 
import { AppContext } from '../context/AppContext';

export default function DashboardScreen() {
  
  const {
      currentUser, employees, settings, activities, setActivities, // Cần gọi setActivities để tạo Biến động
      requests, setRequests, scheduleData, extraAssignments, 
      addNotification, setIsNotifOpen
  } = useContext(AppContext);

  const smsReports = [];

  const isAdmin = currentUser?.role === 'ADMIN';
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
  const [reqForm, setReqForm] = useState({ type: 'Nghỉ phép', date: '', reason: '', targetTeam: '', targetEmpId: '', targetEmpName: '' });
  const [showFullRoster, setShowFullRoster] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 60000);
      return () => clearInterval(timer);
  }, []);

  const availableTeams = settings?.teams?.filter(t => t !== 'Trung tâm') || [];
  const availableEmpsForSwap = useMemo(() => {
      if (!reqForm.targetTeam) return [];
      return employees.filter(e => e.team === reqForm.targetTeam && e.id !== myEmpId && !e.position?.toLowerCase().includes('lãnh đạo'));
  }, [reqForm.targetTeam, employees, myEmpId]);

  // 🌟 KHẮC PHỤC LỖI #2: GỬI THÔNG BÁO CHI TIẾT CÓ TÊN NGƯỜI ĐÍCH
  const handleSubmitRequest = () => {
      if (!reqForm.date || !reqForm.reason) { Alert.alert("Lỗi", "Vui lòng nhập ngày và lý do."); return; }
      
      const newReq = {
          id: 'REQ_' + Date.now(), 
          requesterId: myEmpId, 
          requesterName: myEmpName,
          requesterTeam: userTeam,
          type: reqForm.type, date: reqForm.date, reason: reqForm.reason, 
          status: 'Pending', createdAt: new Date().toISOString()
      };

      if (reqForm.type === 'Đổi ca') {
          if (!reqForm.targetEmpId) { Alert.alert("Lỗi", "Vui lòng chọn nhân sự để đổi ca."); return; }
          newReq.targetEmpId = reqForm.targetEmpId;
          newReq.targetEmpName = reqForm.targetEmpName;
          newReq.targetTeam = reqForm.targetTeam;

          if (isStaff) {
              newReq.status = 'Pending_Leaders';
              newReq.approvals = { [userTeam]: false };
              if (reqForm.targetTeam !== userTeam) newReq.approvals[reqForm.targetTeam] = false;
          } else if (isLeader) {
              newReq.status = 'Pending_Admin';
          }
          
          // Bắn thông báo rõ ràng tên
          addNotification('Đơn Đổi Ca Mới', `${myEmpName} vừa gửi đề nghị đổi ca với ${reqForm.targetEmpName} vào ngày ${reqForm.date}.`, 'urgent');
      } else {
          // Xin nghỉ
          addNotification('Đơn Xin Nghỉ Mới', `${myEmpName} vừa gửi đề nghị nghỉ vào ngày ${reqForm.date}. Lý do: ${reqForm.reason}`, 'info');
      }

      if (setRequests) setRequests(prev => [newReq, ...(prev || [])]);
      setShowReqModal(false); 
      setReqForm({ type: 'Nghỉ phép', date: '', reason: '', targetTeam: '', targetEmpId: '', targetEmpName: '' });
      Alert.alert("Thành công", newReq.status === 'Pending_Leaders' ? "Đơn đã được gửi tới các Kíp trưởng liên quan." : "Đơn đã gửi Quản trị viên.");
  };

  // 🌟 KHẮC PHỤC LỖI #3: TỰ ĐỘNG SINH ACTIVITY KHI DUYỆT ĐỂ TAB QUẢN LÝ KÍP CẬP NHẬT
  const handleLeaderApproveSwap = (reqId) => {
      const req = requests.find(r => r.id === reqId);
      let newApprovals = { ...req.approvals, [userTeam]: true };
      const allApproved = Object.values(newApprovals).every(v => v === true);
      const updatedReq = { ...req, approvals: newApprovals, status: allApproved ? 'APPROVED' : 'Pending_Leaders' };
      
      if (setRequests) setRequests(prev => prev.map(r => r.id === reqId ? updatedReq : r));
      
      if (allApproved) {
          // BƯỚC QUAN TRỌNG: Ghi Biến động (Activity) vào Hệ thống!
          const act1 = { id: 'ACT'+Date.now(), empId: req.requesterId, type: 'CHANGE', startDate: req.date, endDate: req.date, note: `Đổi ca với ${req.targetEmpName}` };
          const act2 = { id: 'ACT'+(Date.now()+1), empId: req.targetEmpId, type: 'CHANGE', startDate: req.date, endDate: req.date, note: `Đổi ca với ${req.requesterName}` };
          if (setActivities) setActivities(prev => [...prev, act1, act2]);

          addNotification('Phê duyệt Đổi ca', `Đơn đổi ca giữa ${req.requesterName} và ${req.targetEmpName} ngày ${req.date} đã được duyệt hoàn tất.`, 'success');
          Alert.alert("Hoàn tất", "Đã duyệt xong! Lịch trực và Danh sách Quản lý Kíp đã được tự động cập nhật.");
      } else {
          addNotification('Tiến độ Đổi ca', `Kíp trưởng ${userTeam} đã duyệt đơn đổi ca của ${req.requesterName}. Đang chờ kíp đích xác nhận.`, 'info');
          Alert.alert("Thành công", `Đã duyệt. Chờ Kíp trưởng đích xác nhận.`);
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
                  isMock: false
              };
              break;
          }
      }
      return foundShift;
  }, [myEmpId, scheduleData, extraAssignments, settings, isAdmin, todayObj, totalCurrentMinutes, myRealEmp]);

  const positionTimeline = useMemo(() => {
      if (!myNextShift) return [];
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
  }, [myNextShift, totalCurrentMinutes, todayObj]);

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
      if (req.status === 'Pending_Admin') return <Text style={[styles.statusText, {color: '#d97706'}]}>Chờ Quản lý duyệt</Text>;
      if (req.status === 'APPROVED') return <Text style={[styles.statusText, {color: '#16a34a'}]}>Đã duyệt</Text>;
      if (req.status === 'Pending_Leaders') {
          const myLeaderApproved = req.approvals?.[req.requesterTeam];
          const targetLeaderApproved = req.approvals?.[req.targetTeam];
          if (req.requesterTeam === req.targetTeam) return <Text style={[styles.statusText, {color: '#d97706'}]}>Chờ Kíp trưởng duyệt</Text>;
          return (
              <View>
                  <Text style={[styles.statusText, {color: '#d97706', marginBottom: 2}]}>Tiến độ duyệt (1/2):</Text>
                  <Text style={{fontSize: 10, color: myLeaderApproved ? '#16a34a' : '#64748b'}}>• Kíp {req.requesterTeam}: {myLeaderApproved ? 'Đã xong' : 'Đang chờ'}</Text>
                  <Text style={{fontSize: 10, color: targetLeaderApproved ? '#16a34a' : '#64748b'}}>• Kíp {req.targetTeam}: {targetLeaderApproved ? 'Đã xong' : 'Đang chờ'}</Text>
              </View>
          );
      }
      return <Text style={[styles.statusText, {color: '#d97706'}]}>Đang xử lý</Text>;
  };

  if (!isAdmin) {
      const myRequests = requests?.filter(r => r.requesterId === myEmpId) || [];
      const shiftEmployees = employees.filter(emp => emp.team !== 'Trung tâm' && !emp.position?.toLowerCase().includes('lãnh đạo'));
      const requestsForLeader = requests?.filter(r => r.type === 'Đổi ca' && r.status === 'Pending_Leaders' && (r.requesterTeam === userTeam || r.targetTeam === userTeam) && r.approvals && r.approvals[userTeam] === false) || [];

      return (
          <View style={[styles.container, { padding: 20 }]}>
              
              <DetailedRosterModal team={userTeam} isOpen={showFullRoster} onClose={() => setShowFullRoster(false)} employees={shiftEmployees} activities={activities} settings={settings} isAdmin={isLeader} />

              <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 25, gap: 15 }}>
                      <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', fontFamily: 'Times New Roman' }}>{myEmpName?.charAt(0) || 'U'}</Text>
                      </View>
                      <View>
                          <Text style={{ fontFamily: 'Times New Roman', fontSize: 24, fontWeight: 'bold', color: '#1e293b' }}>Xin chào, {myEmpName}!</Text>
                          <Text style={{ fontFamily: 'Times New Roman', fontSize: 14, color: '#64748b', marginTop: 4 }}>Kíp hiện tại: {userTeam}</Text>
                      </View>
                  </View>

                  {isLeader && requestsForLeader.length > 0 && (
                      <View style={{ backgroundColor: '#fffbeb', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#fde68a' }}>
                          <Text style={{ fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#b45309', marginBottom: 15 }}><Feather name="bell" size={16}/> Đơn Đổi Ca Cần Bạn Duyệt ({requestsForLeader.length})</Text>
                          {requestsForLeader.map(req => (
                              <View key={req.id} style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fde68a', marginBottom: 10 }}>
                                  <Text style={{ fontFamily: 'Times New Roman', fontSize: 14, color: '#1e293b', marginBottom: 6 }}><Text style={{fontWeight: 'bold', color: '#dc2626'}}>{req.requesterName}</Text> xin đổi ca với <Text style={{fontWeight: 'bold', color: '#2563eb'}}>{req.targetEmpName}</Text></Text>
                                  <Text style={{ fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', marginBottom: 10 }}>Ngày đổi: {req.date} • Lý do: {req.reason}</Text>
                                  <TouchableOpacity style={{ backgroundColor: '#10b981', paddingVertical: 8, borderRadius: 6, alignItems: 'center' }} onPress={() => handleLeaderApproveSwap(req.id)}><Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13, fontFamily: 'Times New Roman' }}>Phê duyệt đổi ca</Text></TouchableOpacity>
                              </View>
                          ))}
                      </View>
                  )}

                  <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                          <Text style={{ fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}><Feather name="clock" size={16}/> Lịch trực chi tiết của bạn</Text>
                          <TouchableOpacity onPress={() => setShowFullRoster(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe' }}>
                              <Feather name="layout" size={14} color="#2563eb" />
                              <Text style={{ color: '#2563eb', fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold' }}>Xem lịch trực ca chi tiết</Text>
                          </TouchableOpacity>
                      </View>
                      
                      {myNextShift ? (
                          <>
                              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9ff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#bae6fd', marginBottom: 20 }}>
                                  <View style={{ alignItems: 'center', borderRightWidth: 1, borderColor: '#bfdbfe', paddingRight: 15, minWidth: 80 }}>
                                      <Text style={{ fontFamily: 'Times New Roman', fontSize: 13, color: '#0369a1', fontWeight: 'bold' }}>{myNextShift.isToday ? 'HÔM NAY' : 'SẮP TỚI'}</Text>
                                      <Text style={{ fontFamily: 'Courier New', fontSize: 20, color: '#0284c7', fontWeight: 'bold', marginTop: 4 }}>{myNextShift.dateDisplay}</Text>
                                  </View>
                                  <View style={{ flex: 1, paddingLeft: 15 }}>
                                      <Text style={{ fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>{myNextShift.shiftName}</Text>
                                      <Text style={{ fontFamily: 'Courier New', fontSize: 13, color: '#64748b', marginTop: 6 }}><Feather name="clock" size={12}/> {myNextShift.time}</Text>
                                      <Text style={{ fontFamily: 'Times New Roman', fontSize: 14, color: '#059669', marginTop: 4, fontWeight: 'bold' }}><Feather name="map-pin" size={12}/> Vị trí: {myNextShift.position}</Text>
                                  </View>
                                  <View style={{ backgroundColor: myNextShift.isToday ? '#ef4444' : '#2563eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}><Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{myNextShift.isToday ? 'Đang diễn ra' : 'Đã lên lịch'}</Text></View>
                              </View>

                              {positionTimeline.length > 0 && (
                                  <View style={{ paddingLeft: 10 }}>
                                      <Text style={{ fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 15 }}>Lộ trình luân chuyển vị trí:</Text>
                                      {positionTimeline.map((item, index) => (
                                          <View key={item.id} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: index === positionTimeline.length - 1 ? 0 : 15 }}>
                                              <View style={{ alignItems: 'center', marginRight: 15 }}>
                                                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: item.status === 'current' ? '#2563eb' : item.status === 'past' ? '#94a3b8' : '#e2e8f0', borderWidth: 2, borderColor: item.status === 'current' ? '#bfdbfe' : '#fff', zIndex: 2 }} />
                                                  {index < positionTimeline.length - 1 && <View style={{ width: 2, height: 45, backgroundColor: item.status === 'past' ? '#cbd5e1' : '#f1f5f9', position: 'absolute', top: 14, zIndex: 1 }} />}
                                              </View>
                                              
                                              <View style={{ flex: 1, backgroundColor: item.status === 'current' ? '#eff6ff' : '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: item.status === 'current' ? '#bfdbfe' : '#f1f5f9', marginTop: -10 }}>
                                                  <Text style={{ fontFamily: 'Courier New', fontSize: 13, fontWeight: 'bold', color: item.status === 'past' ? '#94a3b8' : '#2563eb' }}>{item.timeStr}</Text>
                                                  <Text style={{ fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: item.status === 'past' ? '#94a3b8' : '#1e293b', marginTop: 4 }}>{item.position}</Text>
                                                  {item.status === 'current' && <Text style={{ fontFamily: 'Times New Roman', fontSize: 12, color: '#16a34a', marginTop: 4, fontStyle: 'italic' }}>Đang thực hiện...</Text>}
                                              </View>
                                          </View>
                                      ))}
                                  </View>
                              )}
                          </>
                      ) : (
                          <View style={{ backgroundColor: '#f8fafc', padding: 20, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed' }}>
                              <Feather name="calendar" size={32} color="#cbd5e1" />
                              <Text style={{ fontFamily: 'Times New Roman', color: '#64748b', marginTop: 10 }}>Bạn chưa có lịch trực nào trong 14 ngày tới.</Text>
                          </View>
                      )}
                  </View>

                  <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                          <Text style={{ fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}><Feather name="file-text" size={16}/> Đơn từ cá nhân</Text>
                          <TouchableOpacity onPress={() => setShowReqModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                              <Feather name="plus" size={14} color="#fff" />
                              <Text style={{ color: '#fff', fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold' }}>Tạo đơn</Text>
                          </TouchableOpacity>
                      </View>
                      
                      {myRequests.length === 0 ? (
                          <Text style={{ fontFamily: 'Times New Roman', fontStyle: 'italic', color: '#94a3b8', textAlign: 'center', paddingVertical: 20 }}>Bạn chưa có đơn từ nào.</Text>
                      ) : (
                          myRequests.map(req => (
                              <View key={req.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' }}>
                                  <View style={{ flex: 1 }}>
                                      <Text style={{ fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#1e293b' }}>
                                          {req.type} {req.type === 'Đổi ca' && <Text style={{color: '#2563eb'}}>({req.targetEmpName})</Text>} - {req.date}
                                      </Text>
                                      <Text style={{ fontFamily: 'Times New Roman', fontSize: 13, color: '#64748b', marginTop: 4 }}>{req.reason}</Text>
                                  </View>
                                  <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, backgroundColor: req.status.includes('Pending') ? '#fffbeb' : '#f0fdf4', borderColor: req.status.includes('Pending') ? '#fde68a' : '#bbf7d0' }}>
                                      {req.type === 'Đổi ca' ? renderSwapStatus(req) : <Text style={[styles.statusText, {color: req.status === 'Pending' ? '#d97706' : '#16a34a'}]}>{req.status === 'Pending' ? 'Đang chờ' : 'Đã duyệt'}</Text>}
                                  </View>
                              </View>
                          ))
                      )}
                  </View>
                  <View style={{ height: 40 }}/>
              </ScrollView>

              <Modal visible={showReqModal} transparent={true} animationType="fade">
                  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                      <View style={{ backgroundColor: '#fff', width: '100%', maxWidth: 450, borderRadius: 12, overflow: 'hidden' }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderColor: '#e2e8f0' }}>
                              <Text style={{ fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}>Tạo Đơn Yêu Cầu</Text>
                              <TouchableOpacity onPress={() => setShowReqModal(false)}><Feather name="x" size={20} color="#64748b"/></TouchableOpacity>
                          </View>
                          <ScrollView style={{ padding: 20, maxHeight: 500 }}>
                              <Text style={{ fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 6 }}>Loại đơn</Text>
                              <View style={{ flexDirection: 'row', gap: 10 }}>
                                  <TouchableOpacity style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: reqForm.type === 'Nghỉ phép' ? '#2563eb' : '#e2e8f0', backgroundColor: reqForm.type === 'Nghỉ phép' ? '#eff6ff' : '#f8fafc' }} onPress={() => setReqForm({...reqForm, type: 'Nghỉ phép'})}>
                                      <Text style={{ fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: reqForm.type === 'Nghỉ phép' ? '#2563eb' : '#64748b' }}>Nghỉ phép</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: reqForm.type === 'Đổi ca' ? '#2563eb' : '#e2e8f0', backgroundColor: reqForm.type === 'Đổi ca' ? '#eff6ff' : '#f8fafc' }} onPress={() => setReqForm({...reqForm, type: 'Đổi ca'})}>
                                      <Text style={{ fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: reqForm.type === 'Đổi ca' ? '#2563eb' : '#64748b' }}>Đổi ca</Text>
                                  </TouchableOpacity>
                              </View>

                              {reqForm.type === 'Đổi ca' && (
                                  <View style={{ backgroundColor: '#f8fafc', padding: 15, borderRadius: 8, marginTop: 15, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                      <Text style={{ fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#2563eb', marginBottom: 8 }}>1. Chọn Kíp Đích</Text>
                                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                                          {availableTeams.map(t => (
                                              <TouchableOpacity key={t} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: reqForm.targetTeam === t ? '#2563eb' : '#cbd5e1', backgroundColor: reqForm.targetTeam === t ? '#2563eb' : '#fff', marginRight: 8 }} onPress={() => setReqForm({...reqForm, targetTeam: t, targetEmpId: '', targetEmpName: ''})}>
                                                  <Text style={{ fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: reqForm.targetTeam === t ? '#fff' : '#475569' }}>{t}</Text>
                                              </TouchableOpacity>
                                          ))}
                                      </ScrollView>
                                      {reqForm.targetTeam ? (
                                          <>
                                              <Text style={{ fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#2563eb', marginBottom: 8 }}>2. Chọn Nhân Sự</Text>
                                              {availableEmpsForSwap.length > 0 ? (
                                                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                                      {availableEmpsForSwap.map(emp => (
                                                          <TouchableOpacity key={emp.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: reqForm.targetEmpId === emp.id ? '#2563eb' : '#cbd5e1', backgroundColor: reqForm.targetEmpId === emp.id ? '#eff6ff' : '#fff' }} onPress={() => setReqForm({...reqForm, targetEmpId: emp.id, targetEmpName: emp.name})}>
                                                              <Text style={{ fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: reqForm.targetEmpId === emp.id ? '#2563eb' : '#334155' }}>{emp.name}</Text>
                                                          </TouchableOpacity>
                                                      ))}
                                                  </View>
                                              ) : (
                                                  <Text style={{ fontFamily: 'Times New Roman', fontSize: 12, fontStyle: 'italic', color: '#ef4444' }}>Không có nhân sự nào phù hợp.</Text>
                                              )}
                                          </>
                                      ) : null}
                                  </View>
                              )}

                              <Text style={{ fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 6, marginTop: 15 }}>Ngày áp dụng *</Text>
                              <TextInput style={{ fontFamily: 'Times New Roman', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, height: 42 }} placeholder="DD/MM/YYYY" value={reqForm.date} onChangeText={t => setReqForm({...reqForm, date: t})} />
                              <Text style={{ fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 6, marginTop: 15 }}>Lý do chi tiết *</Text>
                              <TextInput style={{ fontFamily: 'Times New Roman', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, height: 80, textAlignVertical: 'top', paddingTop: 10 }} placeholder="Nhập lý do..." multiline value={reqForm.reason} onChangeText={t => setReqForm({...reqForm, reason: t})} />
                              <TouchableOpacity style={{ backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 }} onPress={handleSubmitRequest}>
                                  <Text style={{ color: '#fff', fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold' }}>Gửi Đơn Xin Duyệt</Text>
                              </TouchableOpacity>
                          </ScrollView>
                      </View>
                  </View>
              </Modal>
          </View>
      );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
          <View style={styles.headerLeft}>
              <View style={styles.avatarBox}><Feather name="shield" size={28} color="#2563eb" /></View>
              <View><Text style={styles.greetingText}>Hệ thống Quản lý KSVKL</Text><Text style={styles.systemName}>ATC SHIFT PRO</Text></View>
          </View>
          <View style={styles.headerRight}>
              <View style={styles.dateBadge}><Feather name="calendar" size={14} color="#64748b" /><Text style={styles.dateText}>Hôm nay: {displayDate}</Text></View>
              {dashboardData.teamOnDuty !== 'Chưa xác định' ? (
                  <View style={styles.shiftBadgeAlert}><View style={styles.pulsingDot} /><Text style={styles.shiftBadgeTextAlert}>ĐANG TRỰC: {dashboardData.teamOnDuty} ({currentShiftName})</Text></View>
              ) : (
                  <View style={styles.shiftBadgeNormal}><Text style={styles.shiftBadgeTextNormal}>CHƯA CÓ DỮ LIỆU CA TRỰC</Text></View>
              )}
          </View>
      </View>

      <View style={styles.overviewRow}>
          <View style={[styles.overviewCard, { borderBottomColor: '#3b82f6' }]}>
              <View style={styles.cardIconWrap}><Feather name="users" size={20} color="#3b82f6" /></View>
              <Text style={styles.cardValue}>{dashboardData.totalStaff}</Text>
              <Text style={styles.cardLabel}>Quân số điều hành</Text>
          </View>
          <View style={[styles.overviewCard, { borderBottomColor: '#10b981' }]}>
              <View style={[styles.cardIconWrap, {backgroundColor: '#ecfdf5'}]}><Feather name="message-square" size={20} color="#10b981" /></View>
              <View style={{flexDirection: 'row', alignItems: 'baseline'}}><Text style={[styles.cardValue, {color: '#10b981'}]}>{dashboardData.smsAckRate}</Text><Text style={{fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#10b981', marginLeft: 2}}>%</Text></View>
              <Text style={styles.cardLabel}>Tỉ lệ xác nhận SMS</Text>
          </View>
          <View style={[styles.overviewCard, { borderBottomColor: '#ef4444' }]}>
              <View style={[styles.cardIconWrap, {backgroundColor: '#fef2f2'}]}><Feather name="user-minus" size={20} color="#ef4444" /></View>
              <Text style={[styles.cardValue, {color: '#ef4444'}]}>{dashboardData.leavesToday.length}</Text>
              <Text style={styles.cardLabel}>Vắng mặt hôm nay</Text>
          </View>
          <View style={[styles.overviewCard, { borderBottomColor: '#f59e0b' }]}>
              <View style={[styles.cardIconWrap, {backgroundColor: '#fffbeb'}]}><Feather name="inbox" size={20} color="#f59e0b" /></View>
              <Text style={[styles.cardValue, {color: '#f59e0b'}]}>{dashboardData.pendingRequests}</Text>
              <Text style={styles.cardLabel}>Đơn từ chờ duyệt</Text>
          </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.mainContentRow}>
              <View style={styles.columnLeft}>
                  <View style={styles.columnCard}>
                      <View style={[styles.columnHeader, {backgroundColor: '#f0fdfa', borderBottomColor: '#ccfbf1'}]}>
                          <Feather name="activity" size={18} color="#0d9488" />
                          <Text style={[styles.columnTitle, {color: '#0f766e'}]}>Thực tế Kíp đang trực ({dashboardData.membersOnDuty.length} người)</Text>
                      </View>
                      <View style={styles.columnBody}>
                          {dashboardData.membersOnDuty.length > 0 ? (
                              dashboardData.membersOnDuty.map((emp, index) => (
                                  <View key={emp.id || index} style={styles.dutyItem}>
                                      <View style={styles.dutyAvatar}><Text style={styles.dutyAvatarText}>{emp.name.charAt(0)}</Text></View>
                                      <View style={styles.dutyInfo}>
                                          <Text style={styles.dutyName}>{emp.name}</Text>
                                          <View style={{flexDirection: 'row', gap: 6, marginTop: 4}}>
                                              <View style={styles.dutyTag}><Text style={styles.dutyTagText}>{emp.position}</Text></View>
                                              <View style={styles.dutyTag}><Text style={styles.dutyTagText}>{emp.qualification}</Text></View>
                                          </View>
                                      </View>
                                      {emp.isChief && <Feather name="star" size={16} color="#eab308" />}
                                  </View>
                              ))
                          ) : (
                              <View style={styles.emptyBox}><Feather name="grid" size={32} color="#cbd5e1" /><Text style={styles.emptyText}>Chưa có ai trực hoặc mọi người đều nghỉ.</Text></View>
                          )}
                      </View>
                  </View>

                  <View style={[styles.columnCard, {marginTop: 20}]}>
                      <View style={styles.columnHeader}><Feather name="user-x" size={18} color="#1e293b" /><Text style={styles.columnTitle}>Vắng mặt Hôm nay</Text></View>
                      <View style={styles.columnBody}>
                          {dashboardData.leavesToday.length > 0 ? (
                              dashboardData.leavesToday.map((act, index) => {
                                  const emp = employees.find(e => e.id === act.empId);
                                  const conf = getActivityConfig(act.type);
                                  return (
                                      <View key={act.id || index} style={styles.listItem}>
                                          <View style={[styles.listIcon, { backgroundColor: conf.bg }]}><Feather name={conf.icon} size={14} color={conf.text} /></View>
                                          <View style={styles.listInfo}>
                                              <Text style={styles.listName}>{emp?.name || act.empId}</Text>
                                              <Text style={styles.listSub}>{emp?.team || 'Không xác định'}</Text>
                                          </View>
                                          <View style={[styles.statusBadge, { backgroundColor: conf.bg, borderColor: conf.bg }]}><Text style={[styles.statusBadgeText, { color: conf.text }]}>{conf.label}</Text></View>
                                      </View>
                                  )
                              })
                          ) : (
                              <View style={[styles.emptyBox, {paddingVertical: 20}]}><Feather name="check-circle" size={24} color="#10b981" /><Text style={styles.emptyText}>Không có nhân sự vắng mặt.</Text></View>
                          )}
                      </View>
                  </View>
              </View>

              <View style={styles.columnRight}>
                  <View style={styles.columnCard}>
                      <View style={styles.columnHeader}><Feather name="smartphone" size={18} color="#1e293b" /><Text style={styles.columnTitle}>Tiến độ báo nhận SMS ({dashboardData.smsTotalSent})</Text></View>
                      <View style={styles.columnBody}>
                          {safeSmsReports.map((sms, index) => {
                              const isDone = sms.ack === sms.total;
                              return (
                                  <View key={sms.id || index} style={styles.smsItem}>
                                      <View style={styles.smsHeader}>
                                          <Text style={styles.smsTime}>{sms.time}</Text>
                                          <View style={[styles.smsStatus, {backgroundColor: isDone ? '#ecfdf5' : '#fffbeb'}]}><Text style={[styles.smsStatusText, {color: isDone ? '#059669' : '#d97706'}]}>{isDone ? 'Hoàn tất' : 'Đang chờ'}</Text></View>
                                      </View>
                                      <Text style={styles.smsTitle} numberOfLines={2}>{sms.title}</Text>
                                      <View style={styles.progressWrap}>
                                          <View style={styles.progressInfo}>
                                              <Text style={styles.progressText}>Đã báo nhận:</Text>
                                              <Text style={styles.progressNumbers}><Text style={{color: isDone ? '#059669' : '#d97706', fontWeight: 'bold'}}>{sms.ack}</Text> / {sms.total}</Text>
                                          </View>
                                          <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${(sms.ack / sms.total) * 100}%`, backgroundColor: isDone ? '#10b981' : '#f59e0b' }]} /></View>
                                      </View>
                                  </View>
                              )
                          })}
                      </View>
                  </View>
              </View>
          </View>
          <View style={{height: 40}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 16 },
  headerCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20, elevation: 2, flexWrap: 'wrap', gap: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  greetingText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#64748b', marginBottom: 4 },
  systemName: { fontFamily: 'Times New Roman', fontSize: 22, fontWeight: 'bold', color: '#1e293b', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 }, 
  
  dateBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6 },
  dateText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569' },
  shiftBadgeAlert: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#fecaca' },
  pulsingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  shiftBadgeTextAlert: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#b91c1c' },
  shiftBadgeNormal: { backgroundColor: '#f1f5f9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  shiftBadgeTextNormal: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  overviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 20 },
  overviewCard: { flex: 1, minWidth: 180, backgroundColor: '#fff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', borderBottomWidth: 4, elevation: 1 },
  cardIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  cardValue: { fontFamily: 'Times New Roman', fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  cardLabel: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontWeight: 'bold' },
  mainContentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  columnLeft: { flex: 1, minWidth: 350 },
  columnRight: { flex: 1, minWidth: 350 },
  columnCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', elevation: 1 },
  columnHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  columnTitle: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  columnBody: { padding: 16 },
  dutyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  dutyAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e0f2fe', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  dutyAvatarText: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#0369a1' },
  dutyInfo: { flex: 1 },
  dutyName: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  dutyTag: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  dutyTagText: { fontFamily: 'Times New Roman', fontSize: 10, color: '#475569', fontWeight: 'bold' },
  smsItem: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, marginBottom: 12 },
  smsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  smsTime: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  smsStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  smsStatusText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold' },
  smsTitle: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
  progressWrap: { marginTop: 4 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontFamily: 'Times New Roman', fontSize: 11, color: '#64748b' },
  progressNumbers: { fontFamily: 'Times New Roman', fontSize: 12, color: '#475569' },
  progressBarBg: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  listIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  listInfo: { flex: 1 },
  listName: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 2 },
  listSub: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontStyle: 'italic' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  statusBadgeText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30 },
  emptyText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#94a3b8', fontStyle: 'italic', marginTop: 10 },
  statusText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold' }
});