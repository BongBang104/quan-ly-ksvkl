import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

const toDateKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
const toYMDLocal = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };

const CELL_WIDTH = 120;
const SHIFT_COL_WIDTH = 50;
const ROLE_COL_WIDTH = 75;
const HEADER_LEFT_WIDTH = SHIFT_COL_WIDTH + ROLE_COL_WIDTH;

// ==========================================
// THUẬT TOÁN STICKY COLUMN (DÀNH CHO WEB/EXPO)
// ==========================================
const stickyHeaderLeft = Platform.OS === 'web' ? { position: 'sticky', left: 0, zIndex: 20 } : {};
const stickyShiftCol = Platform.OS === 'web' ? { position: 'sticky', left: 0, zIndex: 10 } : {};
const stickyRoleCol = Platform.OS === 'web' ? { position: 'sticky', left: SHIFT_COL_WIDTH, zIndex: 10 } : {};

// ==========================================
// COMPONENT Ô LƯỚI TỐI ƯU HIỆU SUẤT (MEMOIZATION) - LOGIC GIỮ NGUYÊN 100%
// ==========================================
const RosterCell = React.memo((props) => {
    const {
        dateObj, shiftCode, roleType, officials, extras, activityMap,
        selectedMoveItem, isHighlightEnabled, recentExtraMap, settings, shortNameMap,
        onOpenManualAdd, onExecuteMove, onSelectForMove, removeExtraAssignment,
        dynamicFontSize, dynamicRowHeight
    } = props;

    const isTargetMode = selectedMoveItem !== null;
    const dateKey = toDateKey(dateObj);
    
    const isTargetCell = isTargetMode && (selectedMoveItem.fromShift !== shiftCode || selectedMoveItem.fromDateKey !== dateKey || (selectedMoveItem.isExtra && roleType === 'RESERVE'));

    const hasSelectedEmployee = isTargetMode && isHighlightEnabled && (
        officials.some(emp => emp.id === selectedMoveItem.id) ||
        extras.some(ext => (ext.type === 'emp' ? ext.id : ext.name) === selectedMoveItem.id)
    );

    return (
        <TouchableOpacity 
            style={[
                styles.cell, 
                { minHeight: dynamicRowHeight }, 
                isTargetCell && !hasSelectedEmployee && styles.cellTargetValid, 
                isTargetCell && hasSelectedEmployee && styles.cellWarningHighlight, 
                isTargetMode && !isTargetCell && styles.cellTargetInvalid 
            ]}
            activeOpacity={0.7}
            onPress={() => {
                if (isTargetMode && roleType !== 'RESERVE') {
                    if (isTargetCell) onExecuteMove(dateObj, shiftCode, roleType);
                } else {
                    onOpenManualAdd(dateObj, shiftCode, roleType);
                }
            }}
        >
            <View style={styles.tagContainer}>
                {officials.map(emp => {
                    const activity = activityMap[emp.id];
                    const isSelectedMoveId = isTargetMode && selectedMoveItem.id === emp.id;
                    const isExactSource = isSelectedMoveId && !selectedMoveItem.isExtra && selectedMoveItem.fromDateKey === dateKey;
                    
                    const isWarningTag = isHighlightEnabled && isSelectedMoveId && !isExactSource;
                    
                    const isRecentExtraHighlight = isHighlightEnabled && recentExtraMap[emp.id] && recentExtraMap[emp.id].some(t => {
                        const diff = Math.round((new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime() - t) / 86400000);
                        return diff >= -(settings.highlightRules?.daysBefore || 1) && diff <= (settings.highlightRules?.daysAfter || 5);
                    });

                    let actConf = activity ? settings.activityTypes.find(a => a.id === activity.type) : null;
                    if (activity && activity.type === 'CHANGE') actConf = { code: 'Đ/C' };

                    return (
                        <TouchableOpacity 
                            key={`off-${emp.id}`} 
                            style={[
                                styles.tag, 
                                isRecentExtraHighlight && !isWarningTag && styles.tagHighlight,
                                isWarningTag && styles.tagWarningHighlight, 
                                isExactSource ? styles.tagSelected : (activity ? styles.tagStrikethrough : styles.tagOfficial)
                            ]} 
                            onPress={(e) => {
                                if (roleType === 'RESERVE') return;
                                if (!activity) { e.stopPropagation(); onSelectForMove(emp, false, dateObj, shiftCode, roleType); }
                            }}>
                            <Text style={[
                                { fontFamily: 'Times New Roman', fontSize: dynamicFontSize },
                                styles.tagText, 
                                isExactSource && styles.tagTextSelected, 
                                emp.isChief && styles.textBold, 
                                activity && styles.textStrikethrough,
                                isRecentExtraHighlight && !isExactSource && !isWarningTag && styles.textHighlight,
                                isWarningTag && styles.textWarningHighlight 
                            ]}>
                                {shortNameMap[emp.id] || emp.name} {emp.isChief ? <Text style={{color: '#eab308'}}>★</Text> : ''}
                            </Text>
                            {activity && <Text style={styles.actSup}>({actConf?.code})</Text>}
                        </TouchableOpacity>
                    );
                })}

                {extras.map((ext, idx) => {
                    const extId = ext.type === 'emp' ? ext.id : ext.name;
                    const isSelectedMoveId = isTargetMode && selectedMoveItem.id === extId;
                    const isExactSource = isTargetMode && selectedMoveItem.isExtra && selectedMoveItem.fromDateKey === dateKey && (ext.uId ? selectedMoveItem.uId === ext.uId : selectedMoveItem.name === ext.name);
                    const isWarningTag = isHighlightEnabled && isSelectedMoveId && !isExactSource;
                    
                    const isOC = roleType === 'RESERVE';
                    const displayName = ext.type === 'emp' ? (shortNameMap[ext.id] || ext.name) : ext.name;

                    return (
                        <TouchableOpacity 
                            key={`ext-${idx}-${ext.uId}`} 
                            style={[
                                styles.tag, 
                                isOC ? styles.tagOfficial : styles.tagExtra, 
                                isWarningTag && styles.tagWarningHighlight,
                                isExactSource && styles.tagSelected
                            ]} 
                            onPress={(e) => {
                                if (roleType === 'RESERVE') return;
                                e.stopPropagation(); onSelectForMove(ext, true, dateObj, shiftCode, roleType);
                            }}>
                            <Text style={[
                                { fontFamily: 'Times New Roman', fontSize: dynamicFontSize },
                                isOC ? styles.tagText : styles.tagTextExtra, 
                                isExactSource && styles.tagTextSelected,
                                isWarningTag && styles.textWarningHighlight
                            ]}>
                                {displayName} {!isOC && <Text style={styles.supText}>TC</Text>}
                            </Text>
                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); removeExtraAssignment(dateObj, shiftCode, roleType, ext); }} style={{marginLeft: 4}}>
                                <Feather name="x" size={10} color={isExactSource ? "#2563eb" : (isOC ? "#94a3b8" : "#ef4444")} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </TouchableOpacity>
    );
}, (prev, next) => {
    if (prev.isHighlightEnabled !== next.isHighlightEnabled) return false;
    const prevTargetMode = prev.selectedMoveItem !== null;
    const nextTargetMode = next.selectedMoveItem !== null;
    if (prevTargetMode !== nextTargetMode) return false;
    if (nextTargetMode && prev.selectedMoveItem !== next.selectedMoveItem) return false; 
    if (prev.officials.length !== next.officials.length) return false;
    if (prev.extras.length !== next.extras.length) return false;
    
    const prevOffIds = prev.officials.map(o => o.id).join(',');
    const nextOffIds = next.officials.map(o => o.id).join(',');
    if (prevOffIds !== nextOffIds) return false;

    const prevExtIds = prev.extras.map(e => e.uId || e.name).join(',');
    const nextExtIds = next.extras.map(e => e.uId || e.name).join(',');
    if (prevExtIds !== nextExtIds) return false;

    if (JSON.stringify(prev.activityMap) !== JSON.stringify(next.activityMap)) return false;

    return true; 
});


// ==========================================
// COMPONENT CHÍNH
// ==========================================
export default function RosterGrid({ 
  daysArray = [], settings = {}, employees = [], scheduleData = {}, extraAssignments = {}, activities = [], 
  selectedMoveItem = null, onSelectForMove, onExecuteMove, onOpenManualAdd, removeExtraAssignment,
  getPatternForDate, getTeamForShift, rotateStartTeam, isFirstChunk,
  shortNameMap = {}, isHighlightEnabled, recentExtraMap, isAdmin
}) {

  const dynamicFontSize = settings.fontSize || 13; // Tăng nhẹ font mặc định cho dễ nhìn
  const dynamicRowHeight = settings.rowHeight || 50; // Hàng cao hơn chút xíu để thoáng
  const safeShifts = settings?.shiftTypes || [];

  const getShortRoleName = (role) => {
    if (!role) return '';
    const lower = role.toLowerCase();
    if (lower.includes('quản lý') || lower.includes('trưởng')) return 'QL';
    if (lower.includes('ksv') || lower.includes('nhân viên')) return 'KSV';
    if (lower.includes('on-call') || lower.includes('dự bị')) return 'OC';
    return role;
  };

  const getOfficialEmployees = (dateObj, shiftCode, roleType) => {
    if (!dateObj || !employees) return [];
    const dateKey = toDateKey(dateObj);
    const matched = employees.filter(emp => {
      const empShift = scheduleData[`${emp.id}_${dateKey}`];
      if (empShift !== shiftCode) return false;

      const empPos = (emp.position || '').toLowerCase();
      const roleIndex = roleType === 'MANAGER' ? 0 : roleType === 'STAFF' ? 1 : 2;
      const roleName = (settings?.positions?.[roleIndex] || '').toLowerCase();

      let roleMatch = false;
      if (roleType === 'MANAGER') roleMatch = empPos === roleName || empPos.includes('quản lý') || empPos.includes('trưởng') || emp.isChief;
      else if (roleType === 'STAFF') roleMatch = (empPos === roleName || empPos.includes('ksvkl') || empPos.includes('nhân viên')) && !emp.isChief;
      else if (roleType === 'RESERVE') roleMatch = empPos === roleName || empPos.includes('on-call') || empPos.includes('dự bị') || empPos.includes('ojt');

      return roleMatch;
    });
    return matched.sort((a,b) => (a.isChief === b.isChief ? 0 : a.isChief ? -1 : 1));
  };

  const getActivityForEmp = (empId, dateObj) => {
      const dateYMD = toYMDLocal(dateObj);
      return activities.find(act => act.empId === empId && dateYMD >= act.startDate && dateYMD <= act.endDate);
  };

  const calculateStaffCount = (dateObj, shiftCode) => {
      let count = 0;
      ['MANAGER', 'STAFF'].forEach(roleType => {
          const officials = getOfficialEmployees(dateObj, shiftCode, roleType);
          officials.forEach(emp => { if (!getActivityForEmp(emp.id, dateObj)) count++; });
          count += (extraAssignments[`${toDateKey(dateObj)}_${shiftCode}_${roleType}`] || []).length;
      });
      return count;
  };

  // Cấu hình màu sắc theo hàng Vị trí (Row Coloring)
  const roleColors = {
      0: { bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8' }, // MANAGER: Tím nhạt
      1: { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' }, // STAFF: Xanh nhạt
      2: { bg: '#f8fafc', border: '#e2e8f0', text: '#475569' }  // RESERVE: Xám nhạt
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={true} bounces={false} style={styles.container}>
      <View style={styles.gridWrapper}>
        
        {/* HÀNG TIÊU ĐỀ (HEADER ROW) */}
        <View style={styles.headerRow}>
          <View style={[styles.headerLeftCorner, stickyHeaderLeft]}>
              <Text style={styles.headerText}>CA / VỊ TRÍ</Text>
          </View>
          {daysArray.map(day => (
            <View key={`header-${day.label}`} style={[styles.headerCell, day.isWeekend ? styles.bgWeekend : styles.bgNormal]}>
              <Text style={[styles.headerDayText, day.isWeekend && {color: '#ea580c'}]}>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][day.dayOfWeek]}</Text>
              <Text style={[styles.headerDateText, day.isWeekend && {color: '#9a3412'}]}>{day.label}</Text>
            </View>
          ))}
        </View>

        {/* CÁC CA TRỰC */}
        {safeShifts.map(shift => {
          let shiftBg = '#e0e7ff'; let shiftColor = '#3730a3';
          if (shift.color) {
              if (shift.color.includes('indigo')) { shiftBg = '#e0e7ff'; shiftColor = '#4338ca'; }
              else if (shift.color.includes('blue')) { shiftBg = '#dbeafe'; shiftColor = '#1d4ed8'; }
          }

          return (
            <View key={`shift-${shift.code}`} style={styles.shiftBlockRow}>
              
              {/* CỘT TÊN CA BÊN TRÁI */}
              <View style={[styles.shiftNameCol, { backgroundColor: shiftBg }, stickyShiftCol]}>
                <Feather name={shift.icon === 'Moon' ? 'moon' : 'sun'} size={16} color={shiftColor} style={{marginBottom: 6}} />
                <Text style={[styles.shiftCodeText, { color: shiftColor }]}>{shift.code}</Text>
              </View>

              <View style={styles.shiftContentCol}>
                
                {/* HÀNG TÊN KÍP TRỰC */}
                <View style={[styles.contentRow, {backgroundColor: '#f8fafc'}]}>
                  <View style={[styles.roleCol, stickyRoleCol]} />
                  {daysArray.map((day, idx) => {
                    const { cycleIndex } = getPatternForDate(day.dateObj);
                    const teamName = getTeamForShift(cycleIndex, shift.code);
                    
                    const count = calculateStaffCount(day.dateObj, shift.code);
                    const minRequired = settings.minStaffing?.[shift.code] ?? 15;
                    const isLowStaff = count < minRequired;
                    const isFirstCell = isFirstChunk && idx === 0 && shift.code === safeShifts[0].code;
                    const shortTeamName = teamName.replace('Kíp ', ''); 

                    return (
                      <View key={`team-${shift.code}-${day.label}`} style={[styles.teamCell, isLowStaff ? {backgroundColor: '#ffedd5'} : {backgroundColor: '#f1f5f9'}]}>
                        {isFirstCell ? (
                            <TouchableOpacity onPress={rotateStartTeam} style={[styles.btnRotate, isLowStaff && {backgroundColor: '#ea580c'}]}>
                                <Feather name="refresh-cw" size={10} color="#fff" />
                                <Text style={styles.btnRotateText}>Kíp {shortTeamName} {isLowStaff ? '⚠️' : ''}</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text style={[styles.teamBadgeText, isLowStaff && {color: '#c2410c'}]}>Kíp {shortTeamName} {isLowStaff ? '⚠️' : ''}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* CÁC HÀNG VỊ TRÍ (QL, KSV, OC) */}
                {[0, 1, 2].map(roleIdx => {
                  const roleType = roleIdx === 0 ? 'MANAGER' : roleIdx === 1 ? 'STAFF' : 'RESERVE';
                  const rowColorConfig = roleColors[roleIdx];

                  return (
                    <View key={`role-${shift.code}-${roleIdx}`} style={styles.contentRow}>
                      
                      {/* TIÊU ĐỀ HÀNG (QL/KSV/OC) VỚI MÀU SẮC RIÊNG */}
                      <View style={[styles.roleCol, {backgroundColor: rowColorConfig.bg, borderColor: rowColorConfig.border}, stickyRoleCol]}>
                          <Text style={[styles.roleText, {color: rowColorConfig.text}]}>{getShortRoleName(settings?.positions[roleIdx])}</Text>
                      </View>
                      
                      {/* CÁC Ô LƯỚI TRONG HÀNG ĐÓ */}
                      {daysArray.map(day => {
                          const officials = getOfficialEmployees(day.dateObj, shift.code, roleType);
                          const extras = extraAssignments[`${toDateKey(day.dateObj)}_${shift.code}_${roleType}`] || [];
                          const activityMap = {};
                          officials.forEach(emp => { activityMap[emp.id] = getActivityForEmp(emp.id, day.dateObj); });

                          return (
                              <View key={`cellWrapper-${shift.code}-${roleType}-${day.dateObj.getTime()}`} style={{backgroundColor: roleType === 'RESERVE' ? '#f8fafc' : '#fff'}}>
                                  <RosterCell
                                      dateObj={day.dateObj} shiftCode={shift.code} roleType={roleType}
                                      officials={officials} extras={extras} activityMap={activityMap}
                                      selectedMoveItem={selectedMoveItem} isHighlightEnabled={isHighlightEnabled}
                                      recentExtraMap={recentExtraMap} settings={settings} shortNameMap={shortNameMap}
                                      onOpenManualAdd={onOpenManualAdd} onExecuteMove={onExecuteMove}
                                      onSelectForMove={onSelectForMove} removeExtraAssignment={removeExtraAssignment}
                                      dynamicFontSize={dynamicFontSize} dynamicRowHeight={dynamicRowHeight}
                                  />
                              </View>
                          );
                      })}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  gridWrapper: { flexDirection: 'column' },
  
  // Header
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#cbd5e1' },
  headerLeftCorner: { width: HEADER_LEFT_WIDTH, backgroundColor: '#1e293b', borderRightWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center', padding: 8 },
  headerText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#f8fafc', letterSpacing: 1 },
  headerCell: { width: CELL_WIDTH, borderRightWidth: 1, borderColor: '#cbd5e1', paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  bgWeekend: { backgroundColor: '#ffedd5' }, // Màu nổi cho cuối tuần
  bgNormal: { backgroundColor: '#f8fafc' },
  headerDayText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' },
  headerDateText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginTop: 2 },
  
  // Row/Col structure
  shiftBlockRow: { flexDirection: 'row', borderBottomWidth: 2, borderColor: '#94a3b8' }, // Viền chia ca đậm hơn
  shiftNameCol: { width: SHIFT_COL_WIDTH, borderRightWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', padding: 4 },
  shiftCodeText: { fontFamily: 'Courier New', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  shiftContentCol: { flexDirection: 'column' },
  contentRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e7eb' },
  
  // Colored Role Column
  roleCol: { width: ROLE_COL_WIDTH, borderRightWidth: 1, justifyContent: 'center', alignItems: 'center' },
  roleText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold' },
  
  // Team Badge Row
  teamCell: { width: CELL_WIDTH, borderRightWidth: 1, borderColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', paddingVertical: 6 },
  teamBadgeText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#0f172a' }, 
  btnRotate: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4, elevation: 2 },
  btnRotateText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#fff' },
  
  // Cell Base
  cell: { width: CELL_WIDTH, borderRightWidth: 1, borderColor: '#e5e7eb', padding: 6 },
  cellReserve: { opacity: 0.9 }, // Reserve hơi mờ đi 1 chút
  
  // Highlight Borders
  cellTargetValid: { backgroundColor: '#f0fdf4', borderWidth: 2, borderColor: '#22c55e', borderStyle: 'dashed' },
  cellWarningHighlight: { backgroundColor: '#fee2e2', borderWidth: 2, borderColor: '#ef4444', borderStyle: 'dashed' },
  cellTargetInvalid: { opacity: 0.3 }, // Làm mờ sâu hơn để tập trung vào ô hợp lệ
  
  // Tags (Pill Shape Modern)
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  
  tagOfficial: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  tagExtra: { backgroundColor: '#fffbeb', borderColor: '#fde68a' }, // Màu hổ phách cho Tăng cường
  tagSelected: { backgroundColor: '#eff6ff', borderColor: '#3b82f6', elevation: 3 }, // Nhấn chìm/nổi
  tagHighlight: { backgroundColor: '#dcfce7', borderColor: '#86efac' }, // Xanh lá mạ cho Recent
  tagWarningHighlight: { backgroundColor: '#fca5a5', borderColor: '#ef4444', elevation: 2 }, 
  tagStrikethrough: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', opacity: 0.7 },
  
  tagText: { color: '#334155', fontWeight: 'bold' },
  tagTextExtra: { color: '#92400e', fontWeight: 'bold' },
  tagTextSelected: { color: '#1d4ed8', fontWeight: 'bold' },
  textBold: { fontWeight: 'bold' },
  textStrikethrough: { textDecorationLine: 'line-through', color: '#94a3b8', fontWeight: 'normal' },
  textHighlight: { color: '#166534' },
  textWarningHighlight: { color: '#7f1d1d', fontWeight: 'bold' }, 
  
  supText: { fontSize: 8, color: '#d97706', fontWeight: 'bold' }, // Ký hiệu TC
  actSup: { fontSize: 9, fontWeight: 'bold', marginLeft: 4, color: '#475569' } // Ký hiệu (P), (O)
});