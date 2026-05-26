import React, { useState, useMemo, useCallback, useEffect, useContext, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import RosterGrid from '../components/RosterGrid';
import ManualAddModal from '../components/ManualAddModal';
import { AppContext } from '../context/AppContext';

const toDateKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
const toYMDLocal = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
const safeString = (str) => (str || '').toString().toLowerCase().replace(/\s+/g, '');

const formatDateDisplay = (dateStr) => {
    if(!dateStr) return '';
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}` : '';
};

export default function SchedulerScreen() {
  
  const {
      currentUser, settings: globalSettings, employees,
      scheduleData, setScheduleData,
      extraAssignments, setExtraAssignments,
      activities, setActivities,
      isPublished, setIsPublished, addNotification
  } = useContext(AppContext);

  const isAdmin = currentUser?.role === 'ADMIN';
  const canEditRoster = currentUser?.role === 'ADMIN' || currentUser?.role === 'LEADER';
  const isPublishedRef = useRef(isPublished);
  
  useEffect(() => { isPublishedRef.current = isPublished; }, [isPublished]);

  const settings = useMemo(() => ({
      ...globalSettings,
      teams: globalSettings?.teams?.filter(t => t !== 'Trung tâm' && t !== 'Hành chính') || [],
      positions: ['QL', 'KSV', 'ON-CALL']
  }), [globalSettings]);

  const shiftEmployees = useMemo(() => {
      return employees.filter(emp => emp.team !== 'Trung tâm' && !emp.position?.toLowerCase().includes('lãnh đạo'));
  }, [employees]);

  const [viewMode, setViewMode] = useState('14_DAYS');
  const [startDate, setStartDate] = useState(new Date());
  const [startCycleTeam, setStartCycleTeam] = useState('Kíp A');
  const [selectedMoveItem, setSelectedMoveItem] = useState(null);
  const [manualModalData, setManualModalData] = useState(null);
  const [isHighlightEnabled, setIsHighlightEnabled] = useState(settings?.highlightRules?.enabled ?? true);
  const [history, setHistory] = useState([]);
  
  const [confirmDialog, setConfirmDialog] = useState({ visible: false, title: '', msg: '', onConfirm: null });

  const saveToHistory = useCallback(() => {
      setHistory(prev => {
          const newHistory = [...prev, {
              scheduleData: JSON.parse(JSON.stringify(scheduleData)),
              extraAssignments: JSON.parse(JSON.stringify(extraAssignments)),
              activities: JSON.parse(JSON.stringify(activities))
          }];
          return newHistory.length > 20 ? newHistory.slice(newHistory.length - 20) : newHistory;
      });
  }, [scheduleData, extraAssignments, activities]);

  const handleUndo = () => {
      if (isPublishedRef.current) { setConfirmDialog({ visible: true, title: 'Lịch đang Khóa', msg: 'Vui lòng nhấn "Mở khóa Lịch" (Màu cam) để có thể chỉnh sửa.', onConfirm: null }); return; }
      if (history.length === 0) return;
      const previousState = history[history.length - 1];
      setScheduleData(previousState.scheduleData);
      setExtraAssignments(previousState.extraAssignments);
      setActivities(previousState.activities);
      setHistory(prev => prev.slice(0, prev.length - 1));
  };

  const viewEndDate = useMemo(() => {
      const end = new Date(startDate);
      if (viewMode === '7_DAYS') end.setDate(end.getDate() + 6);
      else if (viewMode === '14_DAYS') end.setDate(end.getDate() + 13);
      else if (viewMode === '30_DAYS') end.setDate(end.getDate() + 29);
      return end;
  }, [startDate, viewMode]);

  const daysArray = useMemo(() => {
    const arr = [];
    const curr = new Date(startDate);
    while (curr <= viewEndDate) {
      arr.push({ dateObj: new Date(curr), label: `${curr.getDate()}/${curr.getMonth() + 1}`, dayOfWeek: curr.getDay(), isWeekend: curr.getDay() === 0 || curr.getDay() === 6 });
      curr.setDate(curr.getDate() + 1);
    }
    return arr;
  }, [startDate, viewEndDate]);

  useEffect(() => {
      if (Object.keys(scheduleData).length === 0) return; 
      let hasChanges = false;
      const newSchedule = { ...scheduleData };
      daysArray.forEach(day => {
          const dateKeyPart = toDateKey(day.dateObj);
          shiftEmployees.forEach(emp => {
              const key = `${emp.id}_${dateKeyPart}`;
              if (newSchedule[key] === undefined) { newSchedule[key] = ''; hasChanges = true; }
          });
      });
      if (hasChanges) setScheduleData(newSchedule); 
  }, [shiftEmployees, daysArray]); 

  const weekChunks = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < daysArray.length; i += 7) chunks.push(daysArray.slice(i, i + 7));
    return chunks;
  }, [daysArray]);

  const shortNameMap = useMemo(() => {
    const map = {};
    shiftEmployees.forEach(emp => {
        const nameStr = emp.name ? emp.name.trim() : "";
        if (!nameStr) { map[emp.id] = ""; return; }
        const parts = nameStr.split(/\s+/);
        map[emp.id] = parts.slice(-2).join(" "); 
    });
    return map;
  }, [shiftEmployees]);

  const recentExtraMap = useMemo(() => {
      const map = {}; 
      Object.keys(extraAssignments).forEach(key => {
          const parts = key.split('_');
          if (parts.length < 3 || parts[2] === 'RESERVE') return; 
          const [y, m, d] = parts[0].split('-').map(Number);
          const dateTimestamp = new Date(y, m, d).getTime();
          extraAssignments[key].forEach(item => {
              if (item.type === 'emp' && item.id) {
                  if (!map[item.id]) map[item.id] = [];
                  if (!map[item.id].includes(dateTimestamp)) map[item.id].push(dateTimestamp);
              }
          });
      });
      return map;
  }, [extraAssignments]);

  const visibleActivities = useMemo(() => {
      const vStartStr = toYMDLocal(startDate);
      const vEndStr = toYMDLocal(viewEndDate);
      return activities.filter(act => act.startDate <= vEndStr && act.endDate >= vStartStr).sort((a,b) => a.startDate.localeCompare(b.startDate));
  }, [activities, startDate, viewEndDate]);

  const getActivityConfig = useCallback((typeCode) => {
      if (typeCode === 'CHANGE') return { id: 'CHANGE', code: 'Đ/C', label: 'Đổi ca', bg: '#f3f4f6', text: '#4b5563' };
      const found = settings.activityTypes?.find(a => a.id === typeCode);
      if(found) {
          if(found.id === 'LEAVE') return { ...found, bg: '#fef2f2', text: '#dc2626' };
          if(found.id === 'TRIP') return { ...found, bg: '#faf5ff', text: '#9333ea' };
          if(found.id === 'STUDY') return { ...found, bg: '#eff6ff', text: '#2563eb' };
          if(found.id === 'COMP') return { ...found, bg: '#fff7ed', text: '#ea580c' };
          if(found.id === 'SICK') return { ...found, bg: '#f0fdfa', text: '#0d9488' };
      }
      return { code: typeCode, label: typeCode, bg: '#f3f4f6', text: '#4b5563' };
  }, [settings.activityTypes]);

  const getPatternForDate = useCallback((date) => {
    let startIndex = settings.teams.indexOf(startCycleTeam);
    if (startIndex === -1) startIndex = 0;
    const d1 = new Date(date); d1.setHours(12,0,0,0);
    const dStart = new Date(startDate); dStart.setHours(12,0,0,0);
    const diffDays = Math.round((d1 - dStart) / (1000 * 60 * 60 * 24)); 
    const cycleLength = settings.teams.length;
    const cycleIndex = ((startIndex + diffDays) % cycleLength + cycleLength) % cycleLength;
    return { cycleIndex };
  }, [startCycleTeam, settings.teams, startDate]);

  const getTeamForShift = useCallback((cycleIndex, shiftCode) => {
    const cycleLength = settings.teams.length;
    const shiftIndex = settings.shiftTypes.findIndex(s => s.code === shiftCode);
    let defaultOffset = shiftIndex === 1 ? (cycleLength - 1) : shiftIndex;
    const offset = settings.autoFillRules?.[shiftCode] ?? defaultOffset;
    const teamIndex = ((cycleIndex + offset) % cycleLength + cycleLength) % cycleLength;
    return settings.teams[teamIndex]; 
  }, [settings.teams, settings.shiftTypes, settings.autoFillRules]);

  const rotateStartTeam = () => {
    if (!isAdmin) return;
    if (isPublishedRef.current) { setConfirmDialog({ visible: true, title: 'Lịch đang Khóa', msg: 'Vui lòng nhấn "Mở khóa Lịch" (Màu cam) để thao tác.', onConfirm: null }); return; }
    const currentIndex = settings.teams.indexOf(startCycleTeam);
    setStartCycleTeam(settings.teams[(currentIndex + 1) % settings.teams.length]);
  };

  const attemptAutoFill = () => {
      if (!isAdmin) return;
      if (isPublishedRef.current) { setConfirmDialog({ visible: true, title: 'Lịch đang Khóa', msg: 'Vui lòng nhấn "Mở khóa Lịch" (Màu cam) để thao tác.', onConfirm: null }); return; }
      setConfirmDialog({
          visible: true, title: 'Xác nhận Xếp tự động',
          msg: 'Hệ thống sẽ tự động rải lịch dựa trên quy tắc bước nhảy đã thiết lập ở mục Cài đặt. Tiến hành ngay?',
          onConfirm: () => { setConfirmDialog({ visible: false, title: '', msg: '', onConfirm: null }); setTimeout(() => executeAutoFill(), 300); }
      });
  };

  const executeAutoFill = () => {
      try {
          saveToHistory();
          const newSchedule = {}; 
          let newExtraAssignments = { ...extraAssignments };
          const onCallCounts = {};
          shiftEmployees.forEach(e => { onCallCounts[e.id] = 0; });

          const getRotatedMembers = (teamName, role, count, dateObj) => {
              const roleIndex = role === 'MANAGER' ? 0 : 1;
              const roleName = safeString(settings.positions[roleIndex]);
              const teamMembers = shiftEmployees.filter(e => {
                  if (safeString(e.team) !== safeString(teamName)) return false;
                  const ePos = safeString(e.position);
                  if (role === 'MANAGER') return ePos === roleName || ePos.includes('quản lý') || ePos.includes('trưởng') || e.isChief;
                  if (role === 'STAFF') return (ePos === roleName || ePos.includes('ksvkl') || ePos.includes('nhân viên')) && !e.isChief;
                  return false;
              });

              if (teamMembers.length === 0 || count <= 0) return [];
              teamMembers.sort((a, b) => {
                  if (onCallCounts[a.id] !== onCallCounts[b.id]) return onCallCounts[a.id] - onCallCounts[b.id];
                  const dateSeed = dateObj.getDate() + dateObj.getMonth(); 
                  return (a.id + dateSeed) % 2 - (b.id + dateSeed) % 2; 
              });
              const selected = teamMembers.slice(0, count);
              selected.forEach(e => { onCallCounts[e.id]++; });
              return selected;
          };

          const defaultRules = settings.onCallRules || { smartMode: true, managerQty: 1, staffQty: 3 };
          const cycleLength = settings.teams.length;

          daysArray.forEach((day) => {
              const { cycleIndex } = getPatternForDate(day.dateObj);
              const dateKeyPart = toDateKey(day.dateObj);
              
              shiftEmployees.forEach(emp => {
                  const key = `${emp.id}_${dateKeyPart}`;
                  let targetShift = ''; 
                  settings.shiftTypes.forEach(shift => {
                      const teamName = getTeamForShift(cycleIndex, shift.code);
                      if (safeString(emp.team) === safeString(teamName) || safeString(emp.team).includes(safeString(teamName))) {
                          targetShift = shift.code;
                      }
                  });
                  newSchedule[key] = targetShift;
              });

              settings.shiftTypes.forEach((shift, sIdx) => {
                  let fallbackOffset = sIdx === 1 ? (cycleLength - 1) : sIdx;
                  const shiftOffset = settings.autoFillRules?.[shift.code] ?? fallbackOffset;
                  let onCallOffset = defaultRules.smartMode ? (sIdx + 1) : (sIdx + 2); 
                  const onCallTeamIndex = ((cycleIndex + shiftOffset + onCallOffset) % cycleLength + cycleLength) % cycleLength;
                  const onCallTeamName = settings.teams[onCallTeamIndex];

                  newExtraAssignments[`${dateKeyPart}_${shift.code}_RESERVE`] = [
                      ...getRotatedMembers(onCallTeamName, 'MANAGER', defaultRules.managerQty, day.dateObj),
                      ...getRotatedMembers(onCallTeamName, 'STAFF', defaultRules.staffQty, day.dateObj)
                  ].map(e => ({ type: 'emp', id: e.id, name: e.name, team: e.team, uId: Date.now() + Math.random().toString(36).substr(2, 5) }));
              });
          });
          
          setScheduleData(newSchedule); 
          setExtraAssignments(newExtraAssignments);
          setConfirmDialog({ visible: true, title: 'Thành công', msg: 'Đã hoàn tất rải lịch tự động theo cấu hình động!', onConfirm: null });
      } catch (error) { setConfirmDialog({ visible: true, title: 'Lỗi thuật toán', msg: error.message, onConfirm: null }); }
  };

  const handleSelectForMove = (item, isExtra, dateObj, shiftCode, roleType) => {
    if (!isAdmin) return;
    if (isPublishedRef.current) { setConfirmDialog({ visible: true, title: 'Lịch đang Khóa', msg: 'Vui lòng nhấn "Mở khóa Lịch" (Màu cam) để thao tác.', onConfirm: null }); return; }
    
    const dateKey = toDateKey(dateObj);
    if (selectedMoveItem && selectedMoveItem.id === item.id && selectedMoveItem.fromDateKey === dateKey) { setSelectedMoveItem(null); return; }
    setSelectedMoveItem({ id: item.id, name: item.name, isExtra, fromShift: shiftCode, fromRole: roleType, fromDateKey: dateKey, uId: item.uId });
  };

  const handleExecuteMove = (targetDateObj, targetShift, targetRole) => {
    if (!isAdmin || isPublishedRef.current || !selectedMoveItem) return;

    const targetDateStr = `${String(targetDateObj.getDate()).padStart(2, '0')}/${String(targetDateObj.getMonth() + 1).padStart(2, '0')}`;

    setConfirmDialog({
        visible: true,
        title: 'Xác nhận Điều động',
        msg: `Điều động nhân sự [${selectedMoveItem.name}] sang Tăng cường (Ca ${targetShift} - Ngày ${targetDateStr})?`,
        onConfirm: () => {
            saveToHistory();
            const targetDateKey = toDateKey(targetDateObj);
            const targetKey = `${targetDateKey}_${targetShift}_${targetRole}`;
            const newUId = Date.now() + "-" + Math.random().toString(36).substr(2, 5);

            if (!selectedMoveItem.isExtra) {
                const [y, m, d] = selectedMoveItem.fromDateKey.split('-').map(Number);
                const fromDateYMD = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const uniqueActivityId = Date.now() + Math.random();
                
                setActivities(prev => [...prev, { id: uniqueActivityId, empId: selectedMoveItem.id, type: 'CHANGE', startDate: fromDateYMD, endDate: fromDateYMD, note: `Nghỉ ca chính. Đổi sang Tăng cường (Ca ${targetShift})` }]);
                setExtraAssignments(prev => {
                    const currentList = prev[targetKey] || [];
                    return { ...prev, [targetKey]: [...currentList, { type: 'emp', id: selectedMoveItem.id, name: selectedMoveItem.name, uId: newUId, relatedActivityId: uniqueActivityId }] };
                });
            } else {
                const srcKey = `${selectedMoveItem.fromDateKey}_${selectedMoveItem.fromShift}_${selectedMoveItem.fromRole}`;
                let oldActivityId = null;
                if (extraAssignments[srcKey]) {
                    const item = extraAssignments[srcKey].find(i => i.uId === selectedMoveItem.uId);
                    if (item && item.relatedActivityId) oldActivityId = item.relatedActivityId;
                }

                const targetDateYMD = toYMDLocal(targetDateObj);
                const uniqueActivityId = Date.now() + Math.random();

                setActivities(actPrev => {
                    let filtered = actPrev;
                    if (oldActivityId) filtered = actPrev.filter(a => a.id !== oldActivityId);
                    return [...filtered, { id: uniqueActivityId, empId: selectedMoveItem.id || selectedMoveItem.name, type: 'CHANGE', startDate: targetDateYMD, endDate: targetDateYMD, note: `Chuyển ca Tăng cường sang Ca ${targetShift}` }];
                });

                setExtraAssignments(prev => {
                    const newExtras = { ...prev };
                    if (newExtras[srcKey]) newExtras[srcKey] = newExtras[srcKey].filter(i => i.uId !== selectedMoveItem.uId);
                    const currentList = newExtras[targetKey] || [];
                    newExtras[targetKey] = [...currentList, { type: 'emp', id: selectedMoveItem.id, name: selectedMoveItem.name, uId: newUId, relatedActivityId: uniqueActivityId }];
                    return newExtras;
                });
            }
            setSelectedMoveItem(null);
            setConfirmDialog({ visible: false, title: '', msg: '', onConfirm: null });
        }
    });
  };

  const handleOpenManualAddWrapper = (dateObj, shiftCode, roleType) => {
      if (!isAdmin) return;
      if (isPublishedRef.current) { setConfirmDialog({ visible: true, title: 'Lịch đang Khóa', msg: 'Vui lòng nhấn "Mở khóa Lịch" (Màu cam) để thao tác.', onConfirm: null }); return; }
      setManualModalData({ dateObj, shiftCode, roleType, label: settings.positions[roleType==='MANAGER'?0:roleType==='STAFF'?1:2] });
  }

  const handleAddExtraManual = (newItem, sourceKey, oldUId) => {
      if (!isAdmin) return;
      saveToHistory();
      const targetDateKey = toDateKey(manualModalData.dateObj);
      const targetKey = `${targetDateKey}_${manualModalData.shiftCode}_${manualModalData.roleType}`;
      const targetDateYMD = toYMDLocal(manualModalData.dateObj);
      const uniqueActivityId = Date.now() + Math.random();
      const sourceText = sourceKey === 'ON_CALL_LIST' ? 'từ ON-CALL' : (sourceKey === 'CUSTOM' ? 'người ngoài' : `từ ${sourceKey}`);
      
      setActivities(prev => [...prev, { id: uniqueActivityId, empId: newItem.type === 'emp' ? newItem.id : newItem.name, type: 'CHANGE', startDate: targetDateYMD, endDate: targetDateYMD, note: `Tăng cường Ca ${manualModalData.shiftCode} (${sourceText})` }]);

      const itemWithActivity = { ...newItem, relatedActivityId: uniqueActivityId };

      if (sourceKey === 'ON_CALL_LIST') {
          const onCallKey = `${targetDateKey}_${manualModalData.shiftCode}_RESERVE`;
          setExtraAssignments(prev => {
              const currentOC = prev[onCallKey] || [];
              const newOC = currentOC.filter(oc => oc.uId !== oldUId && oc.name !== newItem.name);
              return { ...prev, [targetKey]: [...(prev[targetKey]||[]), itemWithActivity], [onCallKey]: newOC };
          });
      } else {
          setExtraAssignments(prev => ({ ...prev, [targetKey]: [...(prev[targetKey]||[]), itemWithActivity] }));
      }
  };

  const removeExtraAssignment = (dateObj, shiftCode, roleType, item) => {
      if (!isAdmin) return;
      if (isPublishedRef.current) { setConfirmDialog({ visible: true, title: 'Lịch đang Khóa', msg: 'Vui lòng nhấn "Mở khóa Lịch" (Màu cam) để thao tác.', onConfirm: null }); return; }
      saveToHistory();
      if (item.relatedActivityId) setActivities(prev => prev.filter(act => act.id !== item.relatedActivityId));
      const key = `${toDateKey(dateObj)}_${shiftCode}_${roleType}`;
      setExtraAssignments(prev => {
          const currentList = prev[key] || [];
          return { ...prev, [key]: currentList.filter(i => i.uId !== item.uId) };
      });
  };

  const togglePublishState = () => {
    if (!isAdmin) return;
    if (isPublished) {
        setIsPublished(false);
        if (addNotification) addNotification('Mở khóa Lịch', 'Bạn đang ở chế độ chỉnh sửa. Nhớ Phát hành lại sau khi hoàn tất.', 'warning');
    } else {
        let msg = `Đã phát hành Lịch thành công.`;
        if (addNotification) addNotification('Phát hành Lịch mới', msg, 'success');
        setConfirmDialog({ visible: true, title: 'Đã Phát hành Lịch', msg: msg, onConfirm: null });
        setIsPublished(true);
        setSelectedMoveItem(null); 
    }
  };

  const handleFeature = (type) => {
      setConfirmDialog({
          visible: true,
          title: `Tính năng Xuất ${type}`,
          msg: `Chức năng xuất ${type} sẽ được kích hoạt khi cài đặt thư viện (như expo-print, react-native-html-to-pdf) trong quá trình build App Production.`,
          onConfirm: null
      });
  };

  return (
    <View style={styles.container}>
      <Modal visible={confirmDialog.visible} transparent animationType="fade">
          <View style={styles.confirmOverlay}>
              <View style={styles.confirmBox}>
                  <Text style={styles.confirmTitle}>{confirmDialog.title}</Text>
                  <Text style={styles.confirmMsg}>{confirmDialog.msg}</Text>
                  <View style={styles.confirmActions}>
                      {confirmDialog.onConfirm && (
                          <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#f1f5f9'}]} onPress={() => setConfirmDialog({ ...confirmDialog, visible: false })}>
                              <Text style={[styles.confirmBtnText, {color: '#64748b'}]}>Hủy bỏ</Text>
                          </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#2563eb'}]} onPress={() => {
                          const action = confirmDialog.onConfirm;
                          if (action) action();
                          else setConfirmDialog({ ...confirmDialog, visible: false });
                      }}>
                          <Text style={[styles.confirmBtnText, {color: '#fff'}]}>Đồng ý</Text>
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

      <ManualAddModal isOpen={manualModalData !== null} onClose={() => setManualModalData(null)} onAddExtra={handleAddExtraManual} modalData={manualModalData} settings={settings} employees={shiftEmployees} extraAssignments={extraAssignments} />

      {/* BANNER NỔI MÀU TÍM KHI ĐANG DI CHUYỂN */}
      {selectedMoveItem && isAdmin && (
        <View style={styles.floatingBanner}>
            <Feather name="mouse-pointer" size={16} color="#fff" />
            <Text style={styles.floatingText}>Đang chọn: {selectedMoveItem.name}</Text>
            <Text style={styles.floatingSub}>(Chạm ô đích để chuyển)</Text>
            <TouchableOpacity onPress={() => setSelectedMoveItem(null)} style={styles.closeFloat}><Feather name="x" size={14} color="#fff" /></TouchableOpacity>
        </View>
      )}

      {/* BANNER TRẠNG THÁI KHÓA LỊCH CÓ MÀU SẮC MẠNH MẼ */}
      {isAdmin && isPublished && (
          <View style={[styles.statusBanner, { backgroundColor: '#f59e0b' }]}>
              <Feather name="lock" size={14} color="#fff" />
              <Text style={styles.statusBannerText}>LỊCH ĐÃ PHÁT HÀNH - ĐANG KHÓA CHỈNH SỬA</Text>
          </View>
      )}
      {!isAdmin && (
          <View style={[styles.statusBanner, { backgroundColor: '#10b981' }]}>
              <Feather name="eye" size={14} color="#fff" />
              <Text style={styles.statusBannerText}>CHẾ ĐỘ XEM - LỊCH TOÀN ĐƠN VỊ</Text>
          </View>
      )}

      {/* 🌟 THANH TOOLBAR ĐA SẮC MÀU (COLORFUL UI) 🌟 */}
      <View style={styles.toolbar}>
        <View style={styles.topBar}>
          <View style={[styles.tabGroup, (isPublished || !isAdmin) && {opacity: 0.5}]}>
            {['7_DAYS', '14_DAYS', '30_DAYS'].map(mode => (
              <TouchableOpacity key={mode} style={[styles.tabBtn, viewMode === mode && styles.tabBtnActive]} onPress={() => {if(!isPublishedRef.current && isAdmin) setViewMode(mode);}}>
                <Text style={[styles.tabText, viewMode === mode && styles.tabTextActive]}>{mode.replace('_DAYS', ' Ngày')}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dateBox}>
              <Feather name="calendar" size={14} color="#64748b" />
              <Text style={styles.dateText}>{startDate.getDate()}/{startDate.getMonth() + 1}/{startDate.getFullYear()}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionContent}>
          {isAdmin ? (
              <>
                  <TouchableOpacity style={[styles.colorBtn, {backgroundColor: isPublished ? '#f59e0b' : '#10b981'}]} onPress={togglePublishState}>
                    <Feather name={isPublished ? "unlock" : "send"} size={14} color="#fff" />
                    <Text style={styles.colorBtnText}>{isPublished ? 'Mở Khóa Lịch' : 'Phát Hành'}</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.divider} />
                  
                  <TouchableOpacity style={[styles.colorBtn, {backgroundColor: '#8b5cf6', opacity: (history.length === 0 || isPublished) ? 0.4 : 1}]} onPress={handleUndo} disabled={history.length === 0 || isPublished}>
                    <Feather name="corner-up-left" size={14} color="#fff" />
                    <Text style={styles.colorBtnText}>Hoàn tác ({history.length})</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={[styles.colorBtn, {backgroundColor: isHighlightEnabled ? '#6366f1' : '#94a3b8'}]} onPress={() => setIsHighlightEnabled(!isHighlightEnabled)}>
                    <Feather name={isHighlightEnabled ? "eye" : "eye-off"} size={14} color="#fff" />
                    <Text style={styles.colorBtnText}>Cảnh báo</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.divider} />
                  
                  <TouchableOpacity style={[styles.colorBtn, {backgroundColor: '#ef4444', opacity: isPublished ? 0.5 : 1}]} onPress={() => { 
                      if(isPublishedRef.current){ setConfirmDialog({visible: true, title: 'Lịch đang Khóa', msg: 'Vui lòng nhấn Mở khóa lịch.', onConfirm: null}); return;}
                      setConfirmDialog({ visible: true, title: 'Xóa lịch', msg: 'Bạn có chắc chắn muốn xóa trống lưới lịch?', onConfirm: () => { saveToHistory(); setScheduleData({}); setExtraAssignments({}); } });
                  }} disabled={isPublished}>
                    <Feather name="eraser" size={14} color="#fff" />
                    <Text style={styles.colorBtnText}>Xóa lưới</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={[styles.colorBtn, {backgroundColor: '#2563eb', opacity: isPublished ? 0.5 : 1}]} onPress={attemptAutoFill} disabled={isPublished}>
                    <Feather name="zap" size={14} color="#fff" />
                    <Text style={styles.colorBtnText}>Xếp tự động</Text>
                  </TouchableOpacity>
                  <View style={styles.divider} />
              </>
          ) : null}

          <TouchableOpacity style={[styles.colorBtn, {backgroundColor: '#14b8a6'}]} onPress={() => handleFeature('JPG')}>
            <Feather name="image" size={14} color="#fff" />
            <Text style={styles.colorBtnText}>Xuất JPG</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.colorBtn, {backgroundColor: '#ec4899'}]} onPress={() => handleFeature('PDF')}>
            <Feather name="file-text" size={14} color="#fff" />
            <Text style={styles.colorBtnText}>Xuất PDF</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* KHU VỰC LƯỚI & GHI CHÚ */}
      <ScrollView style={styles.scrollArea}>
        {weekChunks.map((weekDays, wIndex) => (
          <View key={wIndex} style={[styles.chunkContainer, isPublished && {borderColor: '#bbf7d0', borderWidth: 2}]}>
            <View style={styles.chunkHeader}>
              <View style={styles.chunkAccent} />
              <Text style={styles.chunkTitle}>Giai đoạn {wIndex + 1}: {weekDays[0].label} - {weekDays[weekDays.length - 1].label}</Text>
            </View>
            <RosterGrid 
              daysArray={weekDays} settings={settings} employees={shiftEmployees} scheduleData={scheduleData} extraAssignments={extraAssignments} activities={activities}
              selectedMoveItem={selectedMoveItem} onSelectForMove={handleSelectForMove} onExecuteMove={handleExecuteMove} onOpenManualAdd={handleOpenManualAddWrapper}
              removeExtraAssignment={removeExtraAssignment}
              getPatternForDate={getPatternForDate} getTeamForShift={getTeamForShift} rotateStartTeam={rotateStartTeam} isFirstChunk={wIndex === 0}
              shortNameMap={shortNameMap} isHighlightEnabled={isHighlightEnabled} recentExtraMap={recentExtraMap}
              isAdmin={isAdmin}
            />
          </View>
        ))}

        {/* 🌟 NÂNG CẤP GIAO DIỆN BẢNG GHI CHÚ */}
        <View style={styles.notesContainer}>
            <View style={styles.notesHeader}>
                <View style={styles.notesIconBox}><Feather name="edit-3" size={16} color="#fff" /></View>
                <Text style={styles.notesTitle}>BẢNG GHI CHÚ BIẾN ĐỘNG NHÂN SỰ CHUNG</Text>
            </View>
            <View style={styles.notesTable}>
                <View style={styles.notesRowHeader}>
                    <Text style={[styles.notesColHeader, { flex: 2, paddingLeft: 10 }]}>Nhân sự</Text>
                    <Text style={[styles.notesColHeader, { flex: 1.5 }]}>Loại hình</Text>
                    <Text style={[styles.notesColHeader, { flex: 2 }]}>Thời gian</Text>
                    <Text style={[styles.notesColHeader, { flex: 3 }]}>Ghi chú chi tiết</Text>
                </View>
                {visibleActivities.map((act, index) => {
                    const emp = employees.find(e => e.id === act.empId);
                    const actConf = getActivityConfig(act.type);
                    const isEven = index % 2 === 0;
                    return (
                        <View key={act.id || index} style={[styles.notesRow, isEven ? {backgroundColor: '#fff'} : {backgroundColor: '#f8fafc'}]}>
                            <View style={{ flex: 2, paddingLeft: 10 }}>
                                <Text style={styles.notesEmpName}>{emp?.name || act.empId}</Text>
                                {emp?.icaoCode && <Text style={styles.notesEmpId}>{emp.icaoCode}</Text>}
                            </View>
                            <View style={{ flex: 1.5, alignItems: 'flex-start', paddingRight: 4 }}>
                                <View style={[styles.actBadge, { backgroundColor: actConf.bg }]}><Text style={[styles.actBadgeText, { color: actConf.text }]}>{actConf.label}</Text></View>
                            </View>
                            <Text style={[styles.notesCell, { flex: 2, color: '#475569', fontWeight: '500' }]}>{formatDateDisplay(act.startDate)} - {formatDateDisplay(act.endDate)}</Text>
                            <Text style={[styles.notesCell, { flex: 3, color: '#64748b', fontStyle: 'italic' }]}>{act.note || '-'}</Text>
                        </View>
                    );
                })}
                {visibleActivities.length === 0 && (
                    <View style={styles.emptyNoteBox}>
                        <Feather name="check-circle" size={24} color="#10b981" style={{marginBottom: 8}}/>
                        <Text style={styles.emptyNoteText}>Lưới trực ổn định. Không có biến động nhân sự.</Text>
                    </View>
                )}
            </View>
        </View>

        <View style={{height: 40}}/>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  confirmBox: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, elevation: 10, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.1, shadowRadius: 20 },
  confirmTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
  confirmMsg: { fontFamily: 'Times New Roman', fontSize: 14, color: '#475569', marginBottom: 24, lineHeight: 22 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  confirmBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  confirmBtnText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold' },

  // Banners
  statusBanner: { paddingVertical: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, elevation: 2, zIndex: 11 },
  statusBannerText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  floatingBanner: { position: 'absolute', top: 20, alignSelf: 'center', zIndex: 100, backgroundColor: '#8b5cf6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 30, flexDirection: 'row', alignItems: 'center', elevation: 10, shadowColor: '#8b5cf6', shadowOpacity: 0.4, shadowOffset: {width:0, height:4}, shadowRadius: 8 },
  floatingText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#fff', marginLeft: 8 },
  floatingSub: { fontFamily: 'Times New Roman', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginLeft: 6 },
  closeFloat: { marginLeft: 16, backgroundColor: 'rgba(255,255,255,0.2)', padding: 6, borderRadius: 12 },

  // Toolbar
  toolbar: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0', zIndex: 10, elevation: 2 },
  topBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 16, gap: 12, justifyContent: 'space-between' },
  tabGroup: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 4 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  tabBtnActive: { backgroundColor: '#fff', elevation: 1 },
  tabText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  tabTextActive: { color: '#2563eb' },
  dateBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  dateText: { fontFamily: 'Courier New', fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  
  // Nút hành động đa sắc màu (Colorful Buttons)
  actionContent: { alignItems: 'center', gap: 10, paddingBottom: 4 },
  colorBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, elevation: 1 },
  colorBtnText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#fff' },
  divider: { width: 1, backgroundColor: '#e2e8f0', marginHorizontal: 2, height: 24, alignSelf: 'center' },

  // Lưới
  scrollArea: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  chunkContainer: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 24, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: {width:0, height:2}, shadowRadius: 8 },
  chunkHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  chunkAccent: { width: 4, height: 18, backgroundColor: '#3b82f6', borderRadius: 2, marginRight: 10 },
  chunkTitle: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b' },

  // Ghi chú Biến động
  notesContainer: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', marginTop: 10, elevation: 1 },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  notesIconBox: { backgroundColor: '#d97706', padding: 8, borderRadius: 8 },
  notesTitle: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  notesTable: { width: '100%' },
  notesRowHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  notesColHeader: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' },
  notesRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
  notesCell: { fontFamily: 'Times New Roman', fontSize: 13 },
  notesEmpName: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  notesEmpId: { fontFamily: 'Courier New', fontSize: 11, color: '#94a3b8', marginTop: 2 },
  actBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  actBadgeText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold' },
  emptyNoteBox: { padding: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  emptyNoteText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }
});