import Icon from './Icon.jsx';
import React from 'react';

const toDateKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
const toYMDLocal = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };

const SHIFT_COL_WIDTH = 50;
const ROLE_COL_WIDTH = 75;
const HEADER_LEFT_WIDTH = SHIFT_COL_WIDTH + ROLE_COL_WIDTH;

const stickyHeaderLeft = { position: 'sticky', left: 0, zIndex: 20 };
const stickyShiftCol  = { position: 'sticky', left: 0, zIndex: 10 };
const stickyRoleCol   = { position: 'sticky', left: SHIFT_COL_WIDTH, zIndex: 10 };

// ==========================================
// COMPONENT Ô LƯỚI TỐI ƯU HIỆU SUẤT (MEMOIZATION)
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

    const isTargetCell = isTargetMode && (
        selectedMoveItem.fromShift !== shiftCode ||
        selectedMoveItem.fromDateKey !== dateKey ||
        (selectedMoveItem.isExtra && roleType === 'RESERVE')
    );
    const hasSelectedEmployee = isTargetMode && isHighlightEnabled && (
        officials.some(emp => emp.id === selectedMoveItem.id) ||
        extras.some(ext => (ext.type === 'emp' ? ext.id : ext.name) === selectedMoveItem.id)
    );

    // ── Build flat list: officials + extras ──────────────────────
    const officialItems = officials.map(emp => {
        const activity = activityMap[emp.id];
        const isSelId  = isTargetMode && selectedMoveItem.id === emp.id;
        const isExact  = isSelId && !selectedMoveItem.isExtra && selectedMoveItem.fromDateKey === dateKey;
        const isWarn   = isHighlightEnabled && isSelId && !isExact;
        const isRecent = isHighlightEnabled && recentExtraMap[emp.id] && recentExtraMap[emp.id].some(t => {
            const diff = Math.round((new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime() - t) / 86400000);
            return diff >= -(settings.highlightRules?.daysBefore || 1) && diff <= (settings.highlightRules?.daysAfter || 5);
        });
        let actConf = activity ? settings.activityTypes.find(a => a.id === activity.type) : null;
        if (activity?.type === 'CHANGE') actConf = { code: 'Đ/C' };
        return { kind: 'off', emp, activity, actConf, isExact, isWarn, isRecent };
    });

    const extraItems = extras.map((ext, idx) => {
        const extId   = ext.type === 'emp' ? ext.id : ext.name;
        const isSelId = isTargetMode && selectedMoveItem.id === extId;
        const isExact = isTargetMode && selectedMoveItem.isExtra && selectedMoveItem.fromDateKey === dateKey &&
                        (ext.uId ? selectedMoveItem.uId === ext.uId : selectedMoveItem.name === ext.name);
        const isWarn  = isHighlightEnabled && isSelId && !isExact;
        const isOC    = roleType === 'RESERVE';
        const displayName = ext.type === 'emp' ? (shortNameMap[ext.id] || ext.name) : ext.name;
        return { kind: 'ext', ext, idx, isExact, isWarn, isOC, displayName };
    });

    const allItems = [...officialItems, ...extraItems];

    return (
      <div role="button" tabIndex={0}
        style={{
          ...styles.cell,
          minHeight: dynamicRowHeight,
          ...(isTargetCell && !hasSelectedEmployee && styles.cellTargetValid),
          ...(isTargetCell && hasSelectedEmployee && styles.cellWarningHighlight),
          ...(isTargetMode && !isTargetCell && styles.cellTargetInvalid),
          cursor: 'pointer',
        }}
        onClick={() => {
          if (isTargetMode && roleType !== 'RESERVE') {
            if (isTargetCell) onExecuteMove(dateObj, shiftCode, roleType);
          } else {
            onOpenManualAdd(dateObj, shiftCode, roleType);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isTargetMode && roleType !== 'RESERVE') {
              if (isTargetCell) onExecuteMove(dateObj, shiftCode, roleType);
            } else {
              onOpenManualAdd(dateObj, shiftCode, roleType);
            }
          }
        }}
      >
            <div style={styles.tagContainer}>
                {allItems.map((item, gi) => {
                    if (item.kind === 'off') {
                        const { emp, activity, actConf, isExact, isWarn, isRecent } = item;
                        const nameColor = isExact ? '#1d4ed8' : isWarn ? '#b91c1c' : isRecent ? '#166534' : '#1e293b';
                        const nameBg    = isExact ? '#eff6ff' : isWarn ? '#fca5a5' : isRecent ? '#dcfce7' : 'transparent';
                        return (
                            <React.Fragment key={`off-${emp.id}`}>
                                {gi > 0 && <span style={styles.sep}>·</span>}
                                <button type="button"
                                    style={styles.nameBtn}
                                    onClick={(e) => {
                                        if (roleType === 'RESERVE') return;
                                        if (!activity) { e.stopPropagation(); onSelectForMove(emp, false, dateObj, shiftCode, roleType); }
                                    }}>
                                    <span style={{
                                        fontFamily: 'Times New Roman',
                                        fontSize: dynamicFontSize,
                                        color: emp._isSwapped ? '#7c3aed' : nameColor,
                                        fontWeight: emp.isChief ? 'bold' : '600',
                                        textDecoration: (activity && !emp._isSwapped) ? 'line-through' : 'none',
                                        backgroundColor: emp._isSwapped ? '#f5f3ff' : nameBg,
                                        borderRadius: (emp._isSwapped || nameBg !== 'transparent') ? 3 : 0,
                                        padding: (emp._isSwapped || nameBg !== 'transparent') ? '0 2px' : 0,
                                    }}>
                                        {shortNameMap[emp.id] || emp.name}
                                        {emp._isSwapped ? <span style={{ fontSize: dynamicFontSize - 2, color: '#7c3aed' }}>↔</span> : null}
                                        {emp.isChief ? <span style={{ color: '#eab308' }}>★</span> : null}
                                        {actConf ? <span style={styles.actSup}>({actConf.code})</span> : null}
                                    </span>
                                </button>
                            </React.Fragment>
                        );
                    } else {
                        const { ext, idx, isExact, isWarn, isOC, displayName } = item;
                        const nameColor = isExact ? '#1d4ed8' : isWarn ? '#b91c1c' : isOC ? '#334155' : '#92400e';
                        const nameBg    = isExact ? '#eff6ff' : isWarn ? '#fca5a5' : 'transparent';
                        return (
                            <React.Fragment key={`ext-${idx}-${ext.uId}`}>
                                {gi > 0 && <span style={styles.sep}>·</span>}
                                <button type="button"
                                    style={styles.nameBtn}
                                    onClick={(e) => {
                                        if (isOC) return;
                                        e.stopPropagation(); onSelectForMove(ext, true, dateObj, shiftCode, roleType);
                                    }}>
                                    <span style={{
                                        fontFamily: 'Times New Roman',
                                        fontSize: dynamicFontSize,
                                        color: nameColor,
                                        fontWeight: 'bold',
                                        backgroundColor: nameBg,
                                        borderRadius: nameBg !== 'transparent' ? 3 : 0,
                                        padding: nameBg !== 'transparent' ? '0 2px' : 0,
                                    }}>
                                        {displayName}
                                        {!isOC && <span style={styles.supText}>TC</span>}
                                    </span>
                                    {!isOC && (
                                        <button type="button"
                                            onClick={(e) => { e.stopPropagation(); removeExtraAssignment(dateObj, shiftCode, roleType, ext); }}
                                            style={{ marginLeft: 2 }}>
                                            <Icon name="x" size={8} color={isExact ? '#2563eb' : '#ef4444'} />
                                        </button>
                                    )}
                                </button>
                            </React.Fragment>
                        );
                    }
                })}
            </div>
        </button>
    );
}, (prev, next) => {
    if (prev.isHighlightEnabled !== next.isHighlightEnabled) return false;
    const prevTM = prev.selectedMoveItem !== null;
    const nextTM = next.selectedMoveItem !== null;
    if (prevTM !== nextTM) return false;
    if (nextTM && prev.selectedMoveItem !== next.selectedMoveItem) return false;
    if (prev.officials.length !== next.officials.length) return false;
    if (prev.extras.length !== next.extras.length) return false;
    if (prev.officials.map(o => o.id).join(',') !== next.officials.map(o => o.id).join(',')) return false;
    if (prev.extras.map(e => e.uId || e.name).join(',') !== next.extras.map(e => e.uId || e.name).join(',')) return false;
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
  shortNameMap = {}, isHighlightEnabled, recentExtraMap, isAdmin,
  approvedSwaps = [],
}) {

  const dynamicFontSize  = settings.fontSize  || 13;
  const dynamicRowHeight = settings.rowHeight  || 40;
  const safeShifts       = settings?.shiftTypes || [];

  const getShortRoleName = (role) => {
    if (!role) return '';
    const lower = role.toLowerCase();
    if (lower.includes('quản lý') || lower.includes('trưởng')) return 'QL';
    if (lower.includes('ksv') || lower.includes('nhân viên')) return 'KSV';
    if (lower.includes('on-call') || lower.includes('dự bị')) return 'OC';
    return role;
  };

  const matchesRole = (emp, roleType, settings) => {
    const empPos   = (emp.position || '').toLowerCase();
    const roleIndex = roleType === 'MANAGER' ? 0 : roleType === 'STAFF' ? 1 : 2;
    const roleName  = (settings?.positions?.[roleIndex] || '').toLowerCase();
    if (roleType === 'MANAGER') return empPos === roleName || empPos.includes('quản lý') || empPos.includes('trưởng') || emp.isChief;
    if (roleType === 'STAFF')   return (empPos === roleName || empPos.includes('ksvkl') || empPos.includes('nhân viên') || empPos.includes('kiểm soát') || empPos.includes('ksv')) && !emp.isChief;
    if (roleType === 'RESERVE') return empPos === roleName || empPos.includes('on-call') || empPos.includes('dự bị') || empPos.includes('ojt');
    return false;
  };

  const getOfficialEmployees = (dateObj, shiftCode, roleType) => {
    if (!dateObj || !employees) return [];
    const dateKey = toDateKey(dateObj);
    const dateYMD = toYMDLocal(dateObj);

    let matched = employees.filter(emp => {
      const empShift = scheduleData[`${emp.id}_${dateKey}`];
      if (empShift !== shiftCode) return false;
      return matchesRole(emp, roleType, settings);
    }).sort((a, b) => (a.isChief === b.isChief ? 0 : a.isChief ? -1 : 1));

    // Áp dụng swap hiển thị cho các đơn đổi ca / trả ca đã được duyệt
    approvedSwaps.forEach(swap => {
      const isSwapDate   = swap.date      === dateYMD;
      const isReturnDate = swap.returnDate === dateYMD;
      if (!isSwapDate && !isReturnDate) return;

      const reqIdx = matched.findIndex(e => e.id === swap.requesterId);
      const tgtIdx = matched.findIndex(e => e.id === swap.targetEmpId);

      if (reqIdx >= 0) {
        const sub = employees.find(e => e.id === swap.targetEmpId);
        matched[reqIdx] = sub
          ? { ...sub, _isSwapped: true, _swapPartner: swap.requesterName }
          : matched[reqIdx];
      }
      if (tgtIdx >= 0) {
        const sub = employees.find(e => e.id === swap.requesterId);
        matched[tgtIdx] = sub
          ? { ...sub, _isSwapped: true, _swapPartner: swap.targetEmpName }
          : matched[tgtIdx];
      }
    });

    return matched;
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

  const roleColors = {
      0: { bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8' },
      1: { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' },
      2: { bg: '#f8fafc', border: '#e2e8f0', text: '#475569' },
  };

  return (
    <div style={styles.container}>
      <div style={styles.gridWrapper}>

        {/* HÀNG TIÊU ĐỀ */}
        <div style={styles.headerRow}>
          <div style={{ ...styles.headerLeftCorner, ...stickyHeaderLeft }}>
              <span style={styles.headerText}>CA / VỊ TRÍ</span>
          </div>
          {daysArray.map(day => (
            <div key={`header-${day.label}`} style={{ ...styles.headerCell, ...(day.isWeekend ? styles.bgWeekend : styles.bgNormal) }}>
              <span style={{ ...styles.headerDayText, ...(day.isWeekend && { color: '#ea580c' }) }}>
                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][day.dayOfWeek]}
              </span>
              <span style={{ ...styles.headerDateText, ...(day.isWeekend && { color: '#9a3412' }) }}>{day.label}</span>
            </div>
          ))}
        </div>

        {/* CÁC CA TRỰC */}
        {safeShifts.map(shift => {
          let shiftBg = '#e0e7ff'; let shiftColor = '#3730a3';
          if (shift.color) {
              if (shift.color.includes('indigo')) { shiftBg = '#e0e7ff'; shiftColor = '#4338ca'; }
              else if (shift.color.includes('blue')) { shiftBg = '#dbeafe'; shiftColor = '#1d4ed8'; }
          }

          return (
            <div key={`shift-${shift.code}`} style={styles.shiftBlockRow}>

              <div style={{ ...styles.shiftNameCol, backgroundColor: shiftBg, ...stickyShiftCol }}>
                <Icon name={shift.icon === 'Moon' ? 'moon' : 'sun'} size={16} color={shiftColor} style={{ marginBottom: 6 }} />
                <span style={{ ...styles.shiftCodeText, color: shiftColor }}>{shift.code}</span>
              </div>

              <div style={styles.shiftContentCol}>

                {/* HÀNG KÍP TRỰC */}
                <div style={{ ...styles.contentRow, backgroundColor: '#f8fafc' }}>
                  <div style={{ ...styles.roleCol, ...stickyRoleCol }} />
                  {daysArray.map((day, idx) => {
                    const { cycleIndex } = getPatternForDate(day.dateObj);
                    const teamName  = getTeamForShift(cycleIndex, shift.code);
                    const count     = calculateStaffCount(day.dateObj, shift.code);
                    const minReq    = settings.minStaffing?.[shift.code] ?? 15;
                    const isLow     = count < minReq;
                    const isFirst   = isFirstChunk && idx === 0 && shift.code === safeShifts[0].code;
                    const shortName = teamName.replace('Kíp ', '');

                    return (
                      <div key={`team-${shift.code}-${day.label}`}
                           style={{ ...styles.teamCell, backgroundColor: isLow ? '#ffedd5' : '#f1f5f9' }}>
                        {isFirst ? (
                            <button type="button" onClick={rotateStartTeam}
                                    style={{ ...styles.btnRotate, ...(isLow && { backgroundColor: '#ea580c' }) }}>
                                <Icon name="refresh-cw" size={10} color="#fff" />
                                <span style={styles.btnRotateText}>Kíp {shortName} {isLow ? '⚠️' : ''}</span>
                            </button>
                        ) : (
                            <span style={{ ...styles.teamBadgeText, ...(isLow && { color: '#c2410c' }) }}>
                                Kíp {shortName} {isLow ? '⚠️' : ''}
                            </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* HÀNG VỊ TRÍ (QL, KSV, OC) */}
                {[0, 1, 2].map(roleIdx => {
                  const roleType      = roleIdx === 0 ? 'MANAGER' : roleIdx === 1 ? 'STAFF' : 'RESERVE';
                  const rowColorConfig = roleColors[roleIdx];

                  return (
                    <div key={`role-${shift.code}-${roleIdx}`} style={styles.contentRow}>

                      <div style={{ ...styles.roleCol, backgroundColor: rowColorConfig.bg, borderColor: rowColorConfig.border, ...stickyRoleCol }}>
                          <span style={{ ...styles.roleText, color: rowColorConfig.text }}>{getShortRoleName(settings?.positions[roleIdx])}</span>
                      </div>

                      {daysArray.map(day => {
                          const officials = getOfficialEmployees(day.dateObj, shift.code, roleType);
                          const extras    = extraAssignments[`${toDateKey(day.dateObj)}_${shift.code}_${roleType}`] || [];
                          const activityMap = {};
                          officials.forEach(emp => { activityMap[emp.id] = getActivityForEmp(emp.id, day.dateObj); });

                          return (
                              <div key={`cw-${shift.code}-${roleType}-${day.dateObj.getTime()}`}
                                   style={{ ...styles.cellWrapper, backgroundColor: roleType === 'RESERVE' ? '#f8fafc' : '#fff' }}>
                                  <RosterCell
                                      dateObj={day.dateObj} shiftCode={shift.code} roleType={roleType}
                                      officials={officials} extras={extras} activityMap={activityMap}
                                      selectedMoveItem={selectedMoveItem} isHighlightEnabled={isHighlightEnabled}
                                      recentExtraMap={recentExtraMap} settings={settings} shortNameMap={shortNameMap}
                                      onOpenManualAdd={onOpenManualAdd} onExecuteMove={onExecuteMove}
                                      onSelectForMove={onSelectForMove} removeExtraAssignment={removeExtraAssignment}
                                      dynamicFontSize={dynamicFontSize} dynamicRowHeight={dynamicRowHeight}
                                  />
                              </div>
                          );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container:   { flex: 1, backgroundColor: '#fff' },
  gridWrapper: { flexDirection: 'column' },

  // Header
  headerRow:        { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#cbd5e1' },
  headerLeftCorner: { width: HEADER_LEFT_WIDTH, flexShrink: 0, backgroundColor: '#1e293b', borderRightWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center', padding: 8 },
  headerText:       { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#f8fafc', letterSpacing: 1 },
  // flex: 1 → grow to fill row equally; minWidth: 60 → fallback on very narrow screens
  headerCell:       { flex: 1, minWidth: 60, flexShrink: 1, borderRightWidth: 1, borderColor: '#cbd5e1', paddingTop: 10, paddingBottom: 10, alignItems: 'center', justifyContent: 'center' },
  bgWeekend:        { backgroundColor: '#ffedd5' },
  bgNormal:         { backgroundColor: '#f8fafc' },
  headerDayText:    { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' },
  headerDateText:   { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginTop: 2 },

  // Row/Col structure
  shiftBlockRow:  { flexDirection: 'row', borderBottomWidth: 2, borderColor: '#94a3b8' },
  shiftNameCol:   { width: SHIFT_COL_WIDTH, flexShrink: 0, borderRightWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', padding: 4 },
  shiftCodeText:  { fontFamily: 'Courier New', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  shiftContentCol:{ flexDirection: 'column', flex: 1, minWidth: 0 },
  contentRow:     { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e7eb' },

  // Colored role column (sticky)
  roleCol:  { width: ROLE_COL_WIDTH, flexShrink: 0, borderRightWidth: 1, justifyContent: 'center', alignItems: 'center' },
  roleText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold' },

  // Team badge row — flex: 1 matches headerCell
  teamCell:      { flex: 1, minWidth: 60, flexShrink: 1, borderRightWidth: 1, borderColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', paddingTop: 5, paddingBottom: 5 },
  teamBadgeText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
  btnRotate:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: 12, gap: 3, boxShadow: '0 2px 4px rgba(0,0,0,.1)' },
  btnRotateText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#fff' },

  // Cell wrapper — flex: 1 so date cells fill available width
  cellWrapper: { flex: 1, minWidth: 60, flexShrink: 1 },

  // Cell button fills wrapper
  cell:                { width: '100%', borderRightWidth: 1, borderColor: '#e5e7eb', padding: '4px 6px', textAlign: 'left', background: 'none', border: 'none', borderRight: '1px solid #e5e7eb', cursor: 'pointer' },
  cellTargetValid:     { backgroundColor: '#f0fdf4', outline: '2px dashed #22c55e' },
  cellWarningHighlight:{ backgroundColor: '#fee2e2', outline: '2px dashed #ef4444' },
  cellTargetInvalid:   { opacity: 0.3 },

  // Name display: horizontal, separated by ·
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 0 },
  sep:          { color: '#94a3b8', fontSize: 11, lineHeight: '1', padding: '0 3px', userSelect: 'none', flexShrink: 0 },
  nameBtn:      { background: 'none', border: 'none', padding: '1px 0', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 },

  supText: { fontSize: 8, color: '#d97706', fontWeight: 'bold', verticalAlign: 'super' },
  actSup:  { fontSize: 9, fontWeight: 'bold', marginLeft: 2, color: '#475569' },
};
