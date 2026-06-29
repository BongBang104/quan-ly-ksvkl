import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import React, { useState, useEffect, useCallback } from 'react';

import { toYMD } from '../utils/helpers';
import { DataService } from '../services/DataService';
import api, { reviewRosterDraft, getRosterChecklist } from '../services/ApiService';
import ReviewResultPanel from './ReviewResultPanel.jsx';

// Format total minutes → "HHMM" (times stored as UTC, no conversion needed)
const fmtHMM = (min) => { const m = ((min % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + String(m % 60).padStart(2, '0'); };

// Generate 1-hour slots from exact start to end ("HH:MM" UTC format)
const generateHourlySlots = (startStr, endStr) => {
    if (!startStr || !endStr) return [];
    const [sH, sM] = startStr.split(':').map(n => parseInt(n) || 0);
    const [eH, eM] = endStr.split(':').map(n => parseInt(n) || 0);
    let startMin = sH * 60 + sM;
    let endMin   = eH * 60 + eM;
    if (endMin <= startMin) endMin += 24 * 60;
    const slots = [];
    for (let m = startMin; m < endMin; m += 60) {
        slots.push(`${fmtHMM(m)}-${fmtHMM(m + 60)}`);
    }
    return slots;
};

export default function DetailedRosterModal({ team, isOpen, onClose, employees, activities, settings, addNotification, isAdmin }) {
  const [gridData, setGridData] = useState([]);
  const [status, setStatus] = useState('DRAFT');
  const [currentDate, setCurrentDate] = useState('');
  const [currentShift, setCurrentShift] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [reviewResult, setReviewResult] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [exportingChecklist, setExportingChecklist] = useState(false);

  const customCols = settings?.rosterColumns?.length > 0 ? settings.rosterColumns : ['CTL', 'APP', 'TWR', 'GCU'];
  const COL_LABELS = React.useMemo(() => ['GIỜ (UTC)', ...customCols], [customCols]);
  const COL_KEYS = React.useMemo(() => ['time', ...customCols], [customCols]);

  const getEmptyRow = useCallback(() => {
      const row = {};
      COL_KEYS.forEach(k => row[k] = '');
      return row;
  }, [COL_KEYS]);

  const populateGrid = useCallback((shiftCode) => {
      const shiftConfig = settings?.shiftTypes?.find(s => s.code === shiftCode);
      if (shiftConfig && shiftConfig.startTime && shiftConfig.endTime) {
          const hourlySlots = generateHourlySlots(shiftConfig.startTime, shiftConfig.endTime);
          setGridData(hourlySlots.map(timeStr => ({ ...getEmptyRow(), time: timeStr })));
      } else {
          setGridData([{ ...getEmptyRow(), time: '0000-0100' }]);
      }
  }, [settings, getEmptyRow]);

  // THUẬT TOÁN TẢI DỮ LIỆU TRỰC TIẾP TỪ CLOUD
  const loadRosterData = useCallback(async (d, s) => {
      const key = `${team}_${d}_${s}`;
      try {
          const res = await api.get('/api/schedules/detailed_rosters');
          const globalData = res.data?.data ?? res.data ?? {};
          if (globalData[key]) {
              setGridData(globalData[key].data);
              setStatus(globalData[key].status);
          } else {
              setStatus(isAdmin ? 'DRAFT' : 'PUBLISHED');
              populateGrid(s);
          }
      } catch(e) {
          setStatus(isAdmin ? 'DRAFT' : 'PUBLISHED');
          populateGrid(s);
      }
  }, [team, populateGrid, isAdmin]);

  useEffect(() => {
    if (isOpen) {
        const initDate = toYMD(new Date());
        const validCodes = settings?.shiftTypes?.map(s => s.code) || ['S'];
        const initShift = currentShift && validCodes.includes(currentShift) ? currentShift : validCodes[0];

        setCurrentDate(initDate);
        setCurrentShift(initShift);
        setWarnings([]);

        loadRosterData(initDate, initShift);
    }
  }, [isOpen]);

  useEffect(() => {
      if (!gridData || gridData.length === 0 || !team) { setWarnings([]); return; }
      const newWarnings = [];

      gridData.forEach((row) => {
          COL_KEYS.forEach(key => {
              if (key === 'time') return;
              const cellVal = (row[key] || '').trim().toUpperCase();
              if (!cellVal) return;

              const codes = cellVal.match(/\b[A-Z0-9_]+\b/g) || [];
              codes.forEach(code => {
                  const emp = employees.find(e => ((e.icaoCode && e.icaoCode.toUpperCase() === code) || String(e.id).toUpperCase() === code) && e.team === team);
                  if (emp) {
                      const currentAbsence = activities.find(a => a.empId === emp.id && a.startDate <= currentDate && a.endDate >= currentDate);
                      if (currentAbsence && currentAbsence.type !== 'CHANGE') {
                          const actConf = settings.activityTypes.find(t => t.id === currentAbsence.type);
                          newWarnings.push(`KSV [${emp.id}] có tên ở vị trí ${key} nhưng đang có lịch: ${actConf?.label || 'Nghỉ/Vắng'}!`);
                      }
                  }
              });
          });
      });
      setWarnings([...new Set(newWarnings)]);
  }, [gridData, team, employees, activities, settings, currentDate, COL_KEYS]);

  const handleCellChange = (val, rIdx, cKey) => {
      if (!isAdmin) return;
      if (val.includes('\t') || val.includes('\n')) {
          const rowsStr = val.split(/\r?\n/);
          if (rowsStr.length > 0 && rowsStr[rowsStr.length - 1] === '') rowsStr.pop();

          let newData = [...gridData];
          let startRow = rIdx;

          rowsStr.forEach((rowStr) => {
              const cells = rowStr.split('\t');
              if (!newData[startRow]) newData.push(getEmptyRow());

              let startCol = COL_KEYS.indexOf(cKey);
              cells.forEach(cellVal => {
                  if (startCol < COL_KEYS.length) newData[startRow][COL_KEYS[startCol]] = cellVal.trim();
                  startCol++;
              });
              startRow++;
          });

          if (rIdx === 0 && cKey === 'time') {
               newData = newData.slice(0, startRow);
          }
          setGridData(newData);
          return;
      }
      const newData = [...gridData];
      newData[rIdx][cKey] = val.replace(/[\r\n]+/g, '');
      setGridData(newData);
  };

  const addRow = () => { if (isAdmin) setGridData([...gridData, getEmptyRow()]); };
  const removeRow = (index) => {
      if (!isAdmin) return;
      const newData = [...gridData];
      newData.splice(index, 1);
      setGridData(newData);
  };

  const saveToGlobal = async (newStatus) => {
      setStatus(newStatus);
      const key = `${team}_${currentDate}_${currentShift}`;
      try {
          const res = await api.get('/api/schedules/detailed_rosters');
          const globalData = res.data?.data ?? res.data ?? {};
          globalData[key] = { data: gridData, status: newStatus };
          await api.put('/api/schedules/detailed_rosters', { data: globalData });
      } catch (e) {
          console.error(e);
      }
  };

  const handleDraftSave = () => {
      if (!isAdmin) return;
      saveToGlobal('DRAFT');
      if (addNotification) addNotification('Thành công', 'Đã lưu nháp bảng phân vị trí lên Cloud.', 'success');
  };

  const handleReview = useCallback(async () => {
      setReviewing(true);
      setReviewResult(null);
      try {
          const result = await reviewRosterDraft({
              team, shift_code: currentShift, shift_date: currentDate,
              rows: gridData,
          });
          setReviewResult(result);
      } catch (e) {
          if (addNotification) addNotification('Lỗi rà soát', e?.response?.data?.message ?? e.message, 'error');
      } finally {
          setReviewing(false);
      }
  }, [gridData, team, currentShift, currentDate]);

  const handleExportChecklist = useCallback(async () => {
      setExportingChecklist(true);
      try {
          const checklist = await getRosterChecklist({
              team, shift_code: currentShift, shift_date: currentDate,
              rows: gridData,
          });
          const { renderChecklistHtml } = await import('../utils/checklistHtml.js');
          const w = window.open('', '_blank', 'width=960,height=900');
          if (!w) { if (addNotification) addNotification('Thông báo', 'Trình duyệt chặn cửa sổ mới. Cho phép pop-up và thử lại.', 'warning'); return; }
          w.document.title = `Checklist — ${team} ${currentDate} ${currentShift}`;
          w.document.body.innerHTML = renderChecklistHtml(checklist);
          w.document.close();
          setTimeout(() => w.print(), 500);
      } catch (e) {
          if (addNotification) addNotification('Lỗi sinh checklist', e?.response?.data?.message ?? e.message, 'error');
      } finally {
          setExportingChecklist(false);
      }
  }, [gridData, team, currentShift, currentDate]);

  const handlePublish = async () => {
      if (!isAdmin) return;

      const executePublish = async () => {
          await saveToGlobal('PUBLISHED');

          // Build per-employee UTC assignment map for targeted WS notifications
          const empAssignments = {};
          gridData.forEach(row => {
              const utcTime = row.time || '';
              COL_KEYS.forEach(k => {
                  if (k === 'time') return;
                  const cellVal = (row[k] || '').trim().toUpperCase();
                  if (!cellVal) return;
                  const codes = cellVal.match(/\b[A-Z0-9_]+\b/g) || [];
                  codes.forEach(code => {
                      const emp = employees.find(e => (e.icaoCode && e.icaoCode.toUpperCase() === code) || String(e.id).toUpperCase() === code);
                      if (emp) {
                          if (!empAssignments[emp.id]) empAssignments[emp.id] = [];
                          empAssignments[emp.id].push({ utcTime, position: k });
                      }
                  });
              });
          });

          // Emit targeted WebSocket notification via backend
          try {
              await api.post('/api/schedules/notify-roster', {
                  team, date: currentDate, shift: currentShift, empAssignments
              });
          } catch {}

          const assignedCount = Object.keys(empAssignments).length;
          if (addNotification) {
              addNotification(
                  'Phát hành Lịch Vị Trí',
                  `Đã ban hành bảng phân vị trí Ca ${currentShift} Kíp ${team} ngày ${currentDate}. Thông báo gửi đến ${assignedCount} KSVKL.`,
                  'info'
              );
          }
          if (addNotification) addNotification('Thành công', `Đã chốt bảng và phát thông báo đến ${assignedCount} KSVKL có liên quan.`, 'success');
      };

      if (warnings.length > 0) {
          if (window.confirm('Cảnh báo An toàn\nHệ thống phát hiện nhân sự đang nghỉ phép bị xếp vào vị trí. Bạn có chắc chắn muốn phát hành?')) {
              await executePublish();
          }
      } else {
          await executePublish();
      }
  };

  const toggleShift = async () => {
      if (!isAdmin && status === 'DRAFT') return;
      const validCodes = settings?.shiftTypes?.map(s => s.code) || ['S'];
      const nextShift = validCodes[(validCodes.indexOf(currentShift) + 1) % validCodes.length];
      setCurrentShift(nextShift);
      await loadRosterData(currentDate, nextShift);
  };

  if (!isOpen || !team) return null;

  return (
    <Modal visible={isOpen} maxWidth="1020px">
        <div style={styles.modalContainer}>

          <div style={styles.header}>
              <div>
                  <span style={styles.headerTitle}>Lịch Phân Vị Trí ({team})</span>
                  <span style={styles.headerSub}>
                      Trạng thái: <span style={{color: status === 'PUBLISHED' ? '#22c55e' : '#f59e0b', fontWeight: 'bold'}}>{status === 'PUBLISHED' ? 'Đã phát hành' : (isAdmin ? 'Đang soạn thảo' : 'Chưa có dữ liệu')}</span>
                  </span>
              </div>
              <button type="button" style={styles.btnClose} onClick={onClose}><Icon name="x" size={20} color="#94a3b8" /></button>
          </div>

          {!isAdmin && (
              <div style={styles.viewOnlyBanner}>
                  <Icon name="eye" size={14} color="#059669" />
                  <span style={styles.viewOnlyText}>CHẾ ĐỘ XEM (VIEW ONLY)</span>
              </div>
          )}

          <div style={styles.controlBar}>
              <div style={styles.controlBox}>
                  <input
                    style={styles.inputControl}
                    value={currentDate}
                    onChange={(e) => setCurrentDate(e.target.value)}
                    placeholder="YYYY-MM-DD"
                    disabled={!isAdmin || status !== 'DRAFT'}
                  />
              </div>
              <div style={styles.controlBox}>
                  <button type="button" style={styles.inputControl} onClick={toggleShift}>
                      <span style={{color: '#f8fafc', fontWeight: 'bold', textAlign: 'center'}}>CA {currentShift}</span>
                  </button>
              </div>
              {isAdmin && status === 'DRAFT' && (
                  <div style={styles.rowControls}>
                      <button type="button" style={styles.iconBtn} onClick={addRow} title="Thêm hàng ngang"><Icon name="plus" size={16} color="#f8fafc"/></button>
                  </div>
              )}
          </div>

          {/* BODY — cuộn dọc, flex: 1 lấp đầy khoảng giữa controlBar và footer */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

            {/* Bảng grid — cuộn ngang riêng */}
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, flexShrink: 0 }}>
              <div style={styles.table}>
                  <div style={styles.tableHeadRow}>
                      {COL_LABELS.map((label, i) => (
                          <div key={i} style={{...styles.thCell, ...(i === 0 ? {width: 120} : {width: 100})}}>
                              <span style={styles.thText}>{label}</span>
                          </div>
                      ))}
                      {isAdmin && status === 'DRAFT' && <div style={{width: 40}} />}
                  </div>

                  {gridData.map((row, rIdx) => (
                      <div key={rIdx} style={styles.tableBodyRow}>
                          {COL_KEYS.map((cKey, cIdx) => (
                              <div key={cKey} style={{...styles.tdCell, ...(cIdx === 0 ? {width: 120} : {width: 100})}}>
                                  <input
                                      style={Object.assign({}, styles.cellInput, cIdx === 0 ? styles.cellInputTime : {})}
                                      value={row[cKey]}
                                      onChange={(e) => handleCellChange(e.target.value, rIdx, cKey)}
                                      onPaste={(e) => {
                                          const text = e.clipboardData.getData('text');
                                          if (text.includes('\t') || text.includes('\n')) {
                                              e.preventDefault();
                                              handleCellChange(text, rIdx, cKey);
                                          }
                                      }}
                                      disabled={!isAdmin || status !== 'DRAFT'}
                                  />
                              </div>
                          ))}
                          {isAdmin && status === 'DRAFT' && (
                              <button type="button" style={styles.tdAction} onClick={() => removeRow(rIdx)}>
                                  <Icon name="trash-2" size={14} color="#ef4444"/>
                              </button>
                          )}
                      </div>
                  ))}
                  {gridData.length === 0 && <span style={{color: '#64748b', padding: 20, textAlign: 'center'}}>Bảng đang trống.</span>}
              </div>
            </div>

            {/* ReviewResultPanel — ngay dưới bảng, trong cùng scroll area */}
            {reviewResult && (
              <div style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 16, paddingTop: 4, flexShrink: 0 }}>
                  <ReviewResultPanel result={reviewResult} />
              </div>
            )}

            {isAdmin && warnings.length > 0 && (
              <div style={{ ...styles.warningArea, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Icon name="alert-triangle" size={14} color="#ef4444" />
                      <span style={styles.warningTitle}>Phát hiện xung đột</span>
                  </div>
                  {warnings.map((w, i) => <span key={i} style={styles.warningText}>• {w}</span>)}
              </div>
            )}
          </div>{/* end BODY */}

          <div style={styles.footer}>
              {/* Nút rà soát và xuất checklist */}
              {isAdmin && (
                  <>
                      <button type="button"
                              style={{ ...styles.btnDraft, marginRight: 'auto',
                                       borderColor: '#334155', opacity: reviewing ? 0.6 : 1 }}
                              onClick={handleReview} disabled={reviewing || !gridData.length}>
                          <Icon name="shield" size={14} color="#94a3b8" />
                          <span style={{ ...styles.btnDraftText, fontSize: 12 }}>
                              {reviewing ? 'Đang rà soát…' : 'Rà soát'}
                          </span>
                      </button>
                      {reviewResult && (
                          <button type="button"
                                  style={{ ...styles.btnDraft, opacity: exportingChecklist ? 0.6 : 1 }}
                                  onClick={handleExportChecklist} disabled={exportingChecklist}>
                              <Icon name="check-square" size={14} color="#94a3b8" />
                              <span style={{ ...styles.btnDraftText, fontSize: 12 }}>
                                  {exportingChecklist ? 'Đang tạo…' : 'Xuất Checklist (PL I)'}
                              </span>
                          </button>
                      )}
                  </>
              )}
              {isAdmin && status === 'DRAFT' ? (
                  <>
                      <button type="button" style={styles.btnDraft} onClick={handleDraftSave}><Icon name="save" size={16} color="#f8fafc" /><span style={styles.btnDraftText}>Lưu nháp</span></button>
                      <button type="button" style={{...styles.btnPublish, ...(warnings.length > 0 && {backgroundColor: '#dc2626'})}} onClick={handlePublish}><Icon name="send" size={16} color="#fff" /><span style={styles.btnPublishText}>{warnings.length > 0 ? 'Bỏ qua cảnh báo & Phát hành' : 'Phát hành'}</span></button>
                  </>
              ) : (
                  <>
                      <button type="button" style={styles.btnDraft} onClick={onClose}><span style={styles.btnDraftText}>Đóng</span></button>
                      {isAdmin && <button type="button" style={styles.btnEdit} onClick={() => saveToGlobal('DRAFT')}><Icon name="unlock" size={16} color="#fff" /><span style={styles.btnPublishText}>Mở khóa & Chỉnh sửa</span></button>}
                  </>
              )}
          </div>
        </div>
    </Modal>
  );
}

const styles = {
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { backgroundColor: '#0f172a', borderRadius: 12, width: '100%', maxWidth: 1020, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #1e293b', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' },
  header: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottom: '1px solid #1e293b', flexShrink: 0, backgroundColor: '#0f172a' },
  headerTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#f8fafc' },
  headerSub: { fontFamily: 'Times New Roman', fontSize: 12, color: '#94a3b8', marginTop: 4 },
  btnClose: { backgroundColor: '#1e293b', padding: 8, borderRadius: 20 },
  viewOnlyBanner: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#064e3b', paddingTop: 6, paddingBottom: 6, flexShrink: 0 },
  viewOnlyText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#34d399', letterSpacing: 1 },
  controlBar: { display: 'flex', flexDirection: 'row', padding: 16, gap: 12, alignItems: 'center', flexShrink: 0, borderBottom: '1px solid #1e293b' },
  controlBox: { flex: 1, maxWidth: 200 },
  inputControl: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, color: '#f8fafc', fontFamily: 'Times New Roman', fontSize: 14, textAlign: 'center' },
  rowControls: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
  iconBtn: { backgroundColor: '#3b82f6', padding: 10, borderRadius: 8 },
  table: { borderWidth: 1, borderColor: '#334155', borderRadius: 8, overflow: 'hidden', backgroundColor: '#1e293b' },
  tableHeadRow: { flexDirection: 'row', backgroundColor: '#0f172a', borderBottomWidth: 1, borderColor: '#334155' },
  thCell: { padding: 12, borderRightWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  thText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#38bdf8', textTransform: 'uppercase', textAlign: 'center' },
  tableBodyRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#334155', alignItems: 'stretch' },
  tdCell: { borderRightWidth: 1, borderColor: '#334155', justifyContent: 'center' },
  cellInput: { flex: 1, color: '#1e293b', fontFamily: 'Times New Roman', fontSize: 13, padding: 10, textAlign: 'center', fontWeight: 'bold', minHeight: 40 },
  cellInputTime: { color: '#475569', fontWeight: 'normal' },
  tdAction: { width: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b' },
  warningArea: { margin: 16, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: '#ef4444', borderRadius: 8, padding: 12 },
  warningTitle: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#ef4444' },
  warningText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#fca5a5', marginTop: 2, fontStyle: 'italic' },
  footer: { display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTop: '1px solid #1e293b', backgroundColor: '#0f172a', gap: 12, flexShrink: 0, flexWrap: 'wrap' },
  btnDraft: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 16, borderRadius: 8, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1e293b' },
  btnDraftText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#f8fafc' },
  btnPublish: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20, borderRadius: 8, backgroundColor: '#16a34a' },
  btnEdit: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20, borderRadius: 8, backgroundColor: '#f59e0b' },
  btnPublishText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#fff' }
};
