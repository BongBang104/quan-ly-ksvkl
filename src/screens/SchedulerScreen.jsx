import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import React, { useState, useMemo, useCallback, useEffect, useContext, useRef } from 'react';

import RosterGrid from '../components/RosterGrid';
import ManualAddModal from '../components/ManualAddModal';
import { AppContext } from '../context/AppContext';
import api, { reviewMacroRoster } from '../services/ApiService';
import { DataService } from '../services/DataService';
import ReviewResultPanel from '../components/ReviewResultPanel.jsx';

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
      isPublished, setIsPublished, addNotification,
      requests,
      reloadSchedule,
  } = useContext(AppContext);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'superadmin';
  const canEditRoster = currentUser?.role === 'ADMIN' || currentUser?.role === 'superadmin' || currentUser?.role === 'CHIEF';
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
  const [startDate, setStartDate] = useState(() => {
    const saved = localStorage.getItem('scheduler_startDate');
    if (saved) { const d = new Date(saved); return isNaN(d.getTime()) ? new Date() : d; }
    return new Date();
  });
  const [macroReview, setMacroReview] = useState(null);
  const [macroReviewing, setMacroReviewing] = useState(false);
  const [startCycleTeam, setStartCycleTeam] = useState(
    () => localStorage.getItem('scheduler_startCycleTeam') || 'Kíp A'
  );
  const [selectedMoveItem, setSelectedMoveItem] = useState(null);
  const [manualModalData, setManualModalData] = useState(null);
  const [isHighlightEnabled, setIsHighlightEnabled] = useState(settings?.highlightRules?.enabled ?? true);
  const [history, setHistory] = useState([]);

  // Sync localStorage khi startCycleTeam hoặc startDate thay đổi
  useEffect(() => { localStorage.setItem('scheduler_startCycleTeam', startCycleTeam); }, [startCycleTeam]);
  useEffect(() => { localStorage.setItem('scheduler_startDate', startDate.toISOString()); }, [startDate]);

  // ── Tính monthKey cho tháng đang xem ──────────────────────────────────
  const monthKey = useMemo(() => {
      const d = startDate;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [startDate]);

  // ── Load lịch từ backend khi monthKey thay đổi ────────────────────────
  useEffect(() => {
      const loadSchedule = async () => {
          try {
              const { data } = await api.get(`/api/schedules/${monthKey}`);
              const payload = data?.data ?? {};
              setScheduleData(payload.scheduleData ?? {});
              setExtraAssignments(payload.extraAssignments ?? {});
              if (payload.isPublished !== undefined) setIsPublished(payload.isPublished);
              else setIsPublished(false);
              if (payload.startCycleTeam) {
                setStartCycleTeam(payload.startCycleTeam);
                localStorage.setItem('scheduler_startCycleTeam', payload.startCycleTeam);
              }
          } catch (error) {
              console.error('Failed loading schedule for', monthKey, error);
              setScheduleData({});
              setExtraAssignments({});
              setIsPublished(false);
          }
      };
      loadSchedule();
  }, [monthKey]); // eslint-disable-line

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

  const approvedSwaps = useMemo(() =>
      (requests || []).filter(r => r.status === 'APPROVED' && (r.type === 'Đổi ca' || r.type === 'CHANGE')),
      [requests]
  );

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
                  if (role === 'STAFF') return (ePos === roleName || ePos.includes('ksvkl') || ePos.includes('nhânviên') || ePos.includes('kiểmsoát') || ePos.includes('ksv')) && !e.isChief;
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

  const handleAddExtraManual = async (newItem, sourceKey, oldUId) => {
      if (!isAdmin) return;
      saveToHistory();
      const targetDateKey = toDateKey(manualModalData.dateObj);
      const targetKey = `${targetDateKey}_${manualModalData.shiftCode}_${manualModalData.roleType}`;
      const targetDateYMD = toYMDLocal(manualModalData.dateObj);
      const sourceText = sourceKey === 'ON_CALL_LIST' ? 'từ ON-CALL' : (sourceKey === 'CUSTOM' ? 'người ngoài' : `từ ${sourceKey}`);
      const actData = { id: `TC-${Date.now()}`, empId: newItem.type === 'emp' ? newItem.id : newItem.name, type: 'EXTRA', startDate: targetDateYMD, endDate: targetDateYMD, note: `Tăng cường Ca ${manualModalData.shiftCode} (${sourceText})` };
      let savedActivity = actData;
      try { savedActivity = await DataService.createItem('activities', actData); } catch {}
      setActivities(prev => [...prev, savedActivity]);

      const itemWithActivity = { ...newItem, relatedActivityId: savedActivity.id };

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
      const dateDisp = `${String(manualModalData.dateObj.getDate()).padStart(2,'0')}/${String(manualModalData.dateObj.getMonth()+1).padStart(2,'0')}`;
      if (addNotification) addNotification('Tăng cường thêm', `Đã gọi ${newItem.name} tăng cường ca ${manualModalData.shiftCode} (${manualModalData.label || manualModalData.roleType}) ngày ${dateDisp}.`, 'info');
  };

  const removeExtraAssignment = async (dateObj, shiftCode, roleType, item) => {
      if (!isAdmin) return;
      if (isPublishedRef.current) { setConfirmDialog({ visible: true, title: 'Lịch đang Khóa', msg: 'Vui lòng nhấn "Mở khóa Lịch" (Màu cam) để thao tác.', onConfirm: null }); return; }
      saveToHistory();
      if (item.relatedActivityId) {
          setActivities(prev => prev.filter(act => act.id !== item.relatedActivityId));
          try { await DataService.deleteItem('activities', item.relatedActivityId); } catch {}
      }
      const key = `${toDateKey(dateObj)}_${shiftCode}_${roleType}`;
      setExtraAssignments(prev => {
          const currentList = prev[key] || [];
          return { ...prev, [key]: currentList.filter(i => i.uId !== item.uId) };
      });
      const dateDisp = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}`;
      if (addNotification) addNotification('Xóa tăng cường', `Đã xóa ${item.name} khỏi tăng cường ca ${shiftCode} ngày ${dateDisp}.`, 'info');
  };

  const handleMacroReview = useCallback(async () => {
    setMacroReviewing(true);
    setMacroReview(null);
    try {
      const assignments = [];
      for (const [key, shiftCode] of Object.entries(scheduleData)) {
        if (!shiftCode) continue;
        const underIdx = key.indexOf('_');
        if (underIdx === -1) continue;
        const controllerId = key.slice(0, underIdx);
        const dateParts = key.slice(underIdx + 1).split('-').map(Number);
        if (dateParts.length !== 3) continue;
        const [y, m, d] = dateParts;
        // toDateKey dùng month 0-indexed → cộng 1 khi format ISO
        const isoDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        assignments.push({ date: isoDate, controller_id: String(controllerId), shift_kind: shiftCode });
      }
      const periodStart = toYMDLocal(startDate);
      const periodEnd   = toYMDLocal(viewEndDate);
      const result = await reviewMacroRoster({ period_start: periodStart, period_end: periodEnd, assignments });
      setMacroReview(result);
    } catch (e) {
      window.alert('Lỗi rà soát: ' + (e?.response?.data?.message ?? e.message));
    } finally {
      setMacroReviewing(false);
    }
  }, [scheduleData, startDate, viewEndDate]);

  const togglePublishState = async () => {
    if (!isAdmin) return;
    if (isPublished) {
        try {
            await api.put(`/api/schedules/${monthKey}`, { data: { scheduleData, extraAssignments, isPublished: false, startCycleTeam } });
            setIsPublished(false);
            if (addNotification) addNotification('Mở khóa Lịch', 'Bạn đang ở chế độ chỉnh sửa. Nhớ Phát hành lại sau khi hoàn tất.', 'warning');
        } catch (error) {
            if (addNotification) addNotification('Lỗi mở khóa lịch', error?.response?.data?.message || error?.message || 'Không thể mở khóa lịch.', 'error');
        }
    } else {
        try {
            await api.put(`/api/schedules/${monthKey}`, { data: { scheduleData, extraAssignments, isPublished: true, startCycleTeam } });

            // Reload lại từ server để state local = server state
            await reloadSchedule(monthKey);

            const extraCount = Object.entries(extraAssignments).filter(([k]) => !k.endsWith('_RESERVE')).reduce((sum, [, v]) => sum + (Array.isArray(v) ? v.length : 0), 0);
            const extraNote = extraCount > 0 ? ` Có ${extraCount} lượt tăng cường được gọi.` : '';
            if (addNotification) addNotification('Phát hành Lịch mới', `Đã phát hành Lịch trực tháng ${monthKey} thành công.${extraNote}`, 'info');
            setConfirmDialog({ visible: true, title: 'Đã Phát hành Lịch', msg: `Đã phát hành Lịch trực tháng ${monthKey} thành công.${extraNote}`, onConfirm: null });
            setIsPublished(true);
            setSelectedMoveItem(null);
        } catch (error) {
            if (addNotification) addNotification('Lỗi phát hành lịch', error?.response?.data?.message || error?.message || 'Không thể phát hành lịch.', 'error');
        }
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
    <div style={styles.container}>
      <Modal visible={confirmDialog.visible} maxWidth="400px">
          <div style={styles.confirmBox}>
                  <span style={styles.confirmTitle}>{confirmDialog.title}</span>
                  <span style={styles.confirmMsg}>{confirmDialog.msg}</span>
                  <div style={styles.confirmActions}>
                      {confirmDialog.onConfirm && (
                          <button type="button" style={{...styles.confirmBtn, backgroundColor: '#f1f5f9'}} onClick={() => setConfirmDialog({ ...confirmDialog, visible: false })}>
                              <span style={{...styles.confirmBtnText, color: '#64748b'}}>Hủy bỏ</span>
                          </button>
                      )}
                      <button type="button" style={{...styles.confirmBtn, backgroundColor: '#2563eb'}} onClick={() => {
                          const action = confirmDialog.onConfirm;
                          if (action) action();
                          else setConfirmDialog({ ...confirmDialog, visible: false });
                      }}>
                          <span style={{...styles.confirmBtnText, color: '#fff'}}>Đồng ý</span>
                      </button>
                  </div>
              </div>
      </Modal>

      <ManualAddModal isOpen={manualModalData !== null} onClose={() => setManualModalData(null)} onAddExtra={handleAddExtraManual} modalData={manualModalData} settings={settings} employees={shiftEmployees} extraAssignments={extraAssignments} />

      {selectedMoveItem && isAdmin && (
        <div style={styles.floatingBanner}>
            <Icon name="mouse-pointer" size={16} color="#fff" />
            <span style={styles.floatingText}>Đang chọn: {selectedMoveItem.name}</span>
            <span style={styles.floatingSub}>(Chạm ô đích để chuyển)</span>
            <button type="button" onClick={() => setSelectedMoveItem(null)} style={styles.closeFloat}><Icon name="x" size={14} color="#fff" /></button>
        </div>
      )}

      {isAdmin && isPublished && (
          <div style={{...styles.statusBanner, backgroundColor: '#f59e0b'}}>
              <Icon name="lock" size={14} color="#fff" />
              <span style={styles.statusBannerText}>LỊCH ĐÃ PHÁT HÀNH - ĐANG KHÓA CHỈNH SỬA</span>
          </div>
      )}
      {!isAdmin && (
          <div style={{...styles.statusBanner, backgroundColor: '#10b981'}}>
              <Icon name="eye" size={14} color="#fff" />
              <span style={styles.statusBannerText}>CHẾ ĐỘ XEM - LỊCH TOÀN ĐƠN VỊ</span>
          </div>
      )}

      <div style={styles.toolbar}>
        <div style={styles.topBar}>
          <div style={{...styles.tabGroup, ...((isPublished || !isAdmin) && {opacity: 0.5})}}>
            {['7_DAYS', '14_DAYS', '30_DAYS'].map(mode => (
              <button type="button" key={mode} style={{...styles.tabBtn, ...(viewMode === mode && styles.tabBtnActive)}} onClick={() => {if(!isPublishedRef.current && isAdmin) setViewMode(mode);}}>
                <span style={{...styles.tabText, ...(viewMode === mode && styles.tabTextActive)}}>{mode.replace('_DAYS', ' Ngày')}</span>
              </button>
            ))}
          </div>
          <div style={styles.dateBox}>
              <Icon name="calendar" size={14} color="#64748b" />
              <span style={styles.dateText}>{startDate.getDate()}/{startDate.getMonth() + 1}/{startDate.getFullYear()}</span>
          </div>
        </div>

        <div style={Object.assign({}, styles.actionContent, { display: 'flex', flexDirection: 'row', overflowX: 'auto', flexWrap: 'nowrap' })}>
          {isAdmin ? (
              <>
                  <button type="button" style={{...styles.colorBtn, backgroundColor: isPublished ? '#f59e0b' : '#10b981'}} onClick={togglePublishState}>
                    <Icon name={isPublished ? "unlock" : "send"} size={14} color="#fff" />
                    <span style={styles.colorBtnText}>{isPublished ? 'Mở Khóa Lịch' : 'Phát Hành'}</span>
                  </button>

                  <button type="button"
                          style={{...styles.colorBtn, backgroundColor: '#0ea5e9',
                                  opacity: macroReviewing ? 0.6 : 1}}
                          onClick={handleMacroReview} disabled={macroReviewing}>
                    <Icon name="shield" size={14} color="#fff" />
                    <span style={styles.colorBtnText}>{macroReviewing ? 'Đang rà soát…' : 'Rà soát chu kỳ'}</span>
                  </button>

                  <div style={styles.divider} />

                  <button type="button" style={{...styles.colorBtn, backgroundColor: '#8b5cf6', opacity: (history.length === 0 || isPublished) ? 0.4 : 1}} onClick={handleUndo} disabled={history.length === 0 || isPublished}>
                    <Icon name="corner-up-left" size={14} color="#fff" />
                    <span style={styles.colorBtnText}>Hoàn tác ({history.length})</span>
                  </button>

                  <button type="button" style={{...styles.colorBtn, backgroundColor: isHighlightEnabled ? '#6366f1' : '#94a3b8'}} onClick={() => setIsHighlightEnabled(!isHighlightEnabled)}>
                    <Icon name={isHighlightEnabled ? "eye" : "eye-off"} size={14} color="#fff" />
                    <span style={styles.colorBtnText}>Cảnh báo</span>
                  </button>

                  <div style={styles.divider} />

                  <button type="button" style={{...styles.colorBtn, backgroundColor: '#ef4444', opacity: isPublished ? 0.5 : 1}} onClick={() => {
                      if(isPublishedRef.current){ setConfirmDialog({visible: true, title: 'Lịch đang Khóa', msg: 'Vui lòng nhấn Mở khóa lịch.', onConfirm: null}); return;}
                      setConfirmDialog({ visible: true, title: 'Xóa lịch', msg: 'Bạn có chắc chắn muốn xóa trống lưới lịch?', onConfirm: () => { saveToHistory(); setScheduleData({}); setExtraAssignments({}); } });
                  }} disabled={isPublished}>
                    <Icon name="eraser" size={14} color="#fff" />
                    <span style={styles.colorBtnText}>Xóa lưới</span>
                  </button>

                  <button type="button" style={{...styles.colorBtn, backgroundColor: '#2563eb', opacity: isPublished ? 0.5 : 1}} onClick={attemptAutoFill} disabled={isPublished}>
                    <Icon name="zap" size={14} color="#fff" />
                    <span style={styles.colorBtnText}>Xếp tự động</span>
                  </button>
                  <div style={styles.divider} />
              </>
          ) : null}

          <button type="button" style={{...styles.colorBtn, backgroundColor: '#14b8a6'}} onClick={() => handleFeature('JPG')}>
            <Icon name="image" size={14} color="#fff" />
            <span style={styles.colorBtnText}>Xuất JPG</span>
          </button>
          <button type="button" style={{...styles.colorBtn, backgroundColor: '#ec4899'}} onClick={() => handleFeature('PDF')}>
            <Icon name="file-text" size={14} color="#fff" />
            <span style={styles.colorBtnText}>Xuất PDF</span>
          </button>
        </div>
      </div>

      <div style={styles.scrollArea}>
        {weekChunks.map((weekDays, wIndex) => (
          <div key={wIndex} style={{...styles.chunkContainer, ...(isPublished && {borderColor: '#bbf7d0', borderWidth: 2})}}>
            <div style={styles.chunkHeader}>
              <div style={styles.chunkAccent} />
              <span style={styles.chunkTitle}>Giai đoạn {wIndex + 1}: {weekDays[0].label} - {weekDays[weekDays.length - 1].label}</span>
            </div>
            <RosterGrid
              daysArray={weekDays} settings={settings} employees={shiftEmployees} scheduleData={scheduleData} extraAssignments={extraAssignments} activities={activities}
              selectedMoveItem={selectedMoveItem} onSelectForMove={handleSelectForMove} onExecuteMove={handleExecuteMove} onOpenManualAdd={handleOpenManualAddWrapper}
              removeExtraAssignment={removeExtraAssignment}
              getPatternForDate={getPatternForDate} getTeamForShift={getTeamForShift} rotateStartTeam={rotateStartTeam} isFirstChunk={wIndex === 0}
              shortNameMap={shortNameMap} isHighlightEnabled={isHighlightEnabled} recentExtraMap={recentExtraMap}
              isAdmin={isAdmin} approvedSwaps={approvedSwaps}
            />
          </div>
        ))}

        <div style={styles.notesContainer}>
            <div style={styles.notesHeader}>
                <div style={styles.notesIconBox}><Icon name="edit-3" size={16} color="#fff" /></div>
                <span style={styles.notesTitle}>BẢNG GHI CHÚ BIẾN ĐỘNG NHÂN SỰ CHUNG</span>
            </div>
            <div style={styles.notesTable}>
                <div style={styles.notesRowHeader}>
                    <span style={{...styles.notesColHeader, flex: 2, paddingLeft: 10}}>Nhân sự</span>
                    <span style={{...styles.notesColHeader, flex: 1.5}}>Loại hình</span>
                    <span style={{...styles.notesColHeader, flex: 2}}>Thời gian</span>
                    <span style={{...styles.notesColHeader, flex: 3}}>Ghi chú chi tiết</span>
                </div>
                {visibleActivities.map((act, index) => {
                    const emp = employees.find(e => e.id === act.empId);
                    const actConf = getActivityConfig(act.type);
                    const isEven = index % 2 === 0;
                    return (
                        <div key={act.id || index} style={{...styles.notesRow, ...(isEven ? {backgroundColor: '#fff'} : {backgroundColor: '#f8fafc'})}}>
                            <div style={{ flex: 2, paddingLeft: 10 }}>
                                <span style={styles.notesEmpName}>{emp?.name || act.empId}</span>
                                {emp?.icaoCode && <span style={styles.notesEmpId}>{emp.icaoCode}</span>}
                            </div>
                            <div style={{ flex: 1.5, alignItems: 'flex-start', paddingRight: 4 }}>
                                <div style={{...styles.actBadge, backgroundColor: actConf.bg}}><span style={{...styles.actBadgeText, color: actConf.text}}>{actConf.label}</span></div>
                            </div>
                            <span style={{...styles.notesCell, flex: 2, color: '#475569', fontWeight: '500'}}>{formatDateDisplay(act.startDate)} - {formatDateDisplay(act.endDate)}</span>
                            <span style={{...styles.notesCell, flex: 3, color: '#64748b', fontStyle: 'italic'}}>{act.note || '-'}</span>
                        </div>
                    );
                })}
                {visibleActivities.length === 0 && (
                    <div style={styles.emptyNoteBox}>
                        <Icon name="check-circle" size={24} color="#10b981" style={{marginBottom: 8}}/>
                        <span style={styles.emptyNoteText}>Lưới trực ổn định. Không có biến động nhân sự.</span>
                    </div>
                )}
            </div>
        </div>

        <div style={{height: 40}}/>

        {macroReview && (
          <div style={{ margin: '0 16px 24px' }}>
            <ReviewResultPanel result={macroReview} />
            {macroReview.coverage_warnings?.length > 0 && (
              <div style={{ marginTop: 8, padding: 12, background: '#fffbeb',
                            border: '1px solid #fde68a', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
                  Cảnh báo phủ sóng năng định:
                </div>
                {macroReview.coverage_warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#78350f', marginBottom: 4 }}>
                    • {w.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  confirmBox: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, boxShadow: "0 4px 6px rgba(0,0,0,0.08)", shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.1, shadowRadius: 20 },
  confirmTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
  confirmMsg: { fontFamily: 'Times New Roman', fontSize: 14, color: '#475569', marginBottom: 24, lineHeight: '22px' },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  confirmBtn: { paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20, borderRadius: 8 },
  confirmBtnText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold' },

  statusBanner: { paddingTop: 8, paddingBottom: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, boxShadow: "0 4px 6px rgba(0,0,0,0.08)", zIndex: 11 },
  statusBannerText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  floatingBanner: { position: 'absolute', top: 20, alignSelf: 'center', zIndex: 100, backgroundColor: '#8b5cf6', paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20, borderRadius: 30, flexDirection: 'row', alignItems: 'center', boxShadow: "0 4px 6px rgba(0,0,0,0.08)", shadowColor: '#8b5cf6', shadowOpacity: 0.4, shadowOffset: {width:0, height:4}, shadowRadius: 8 },
  floatingText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#fff', marginLeft: 8 },
  floatingSub: { fontFamily: 'Times New Roman', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginLeft: 6 },
  closeFloat: { marginLeft: 16, backgroundColor: 'rgba(255,255,255,0.2)', padding: 6, borderRadius: 12 },

  toolbar: {
    backgroundColor: '#fff', padding: '14px 18px',
    borderBottomWidth: 1, borderColor: '#e8eef4',
    zIndex: 10, boxShadow: '0 2px 8px rgba(15,23,42,.06)',
  },
  topBar: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    marginBottom: 14, gap: 12, justifyContent: 'space-between',
  },
  tabGroup: {
    flexDirection: 'row', backgroundColor: '#f1f5f9',
    borderRadius: 10, padding: 3,
    borderWidth: 1, borderColor: '#e8eef4',
  },
  tabBtn: { paddingTop: 7, paddingBottom: 7, paddingLeft: 16, paddingRight: 16, borderRadius: 8 },
  tabBtnActive: {
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    boxShadow: '0 2px 8px rgba(37,99,235,.35)',
  },
  tabText: { fontSize: 13, fontWeight: 600, color: '#64748b' },
  tabTextActive: { color: '#fff' },
  dateBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 8, paddingBottom: 8, paddingLeft: 14, paddingRight: 14,
    borderRadius: 10, backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  dateText: { fontFamily: 'Courier New', fontSize: 14, fontWeight: 700, color: '#0f172a' },

  actionContent: { alignItems: 'center', gap: 8, paddingBottom: 2 },
  colorBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 9, paddingBottom: 9, paddingLeft: 14, paddingRight: 14,
    borderRadius: 9, boxShadow: '0 2px 6px rgba(0,0,0,.15)',
  },
  colorBtnText: { fontSize: 12, fontWeight: 700, color: '#fff' },
  divider: {
    width: 1, backgroundColor: '#e2e8f0',
    marginLeft: 4, marginRight: 4, height: 22, alignSelf: 'center',
  },

  scrollArea: { flex: 1, padding: 18, backgroundColor: '#f0f4f8', overflowY: 'auto', display: 'block' },
  chunkContainer: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e8eef4', marginBottom: 22, overflowX: 'auto', boxShadow: '0 2px 8px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)' },
  chunkHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: '11px 14px', borderBottomWidth: 1, borderColor: '#e8eef4' },
  chunkAccent: { width: 4, height: 18, backgroundColor: '#3b82f6', borderRadius: 2, marginRight: 10 },
  chunkTitle: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b' },

  notesContainer: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', marginTop: 10, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  notesIconBox: { backgroundColor: '#d97706', padding: 8, borderRadius: 8 },
  notesTitle: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  notesTable: { width: '100%' },
  notesRowHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  notesColHeader: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' },
  notesRow: { flexDirection: 'row', paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
  notesCell: { fontFamily: 'Times New Roman', fontSize: 13 },
  notesEmpName: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  notesEmpId: { fontFamily: 'Courier New', fontSize: 11, color: '#94a3b8', marginTop: 2 },
  actBadge: { paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  actBadgeText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold' },
  emptyNoteBox: { padding: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  emptyNoteText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }
};
