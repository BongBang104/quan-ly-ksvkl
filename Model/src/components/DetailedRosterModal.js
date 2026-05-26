import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { toYMD } from '../utils/helpers';
import { DataService } from '../services/DataService'; 

const generateHourlySlots = (startStr, endStr) => {
    if (!startStr || !endStr) return [];
    let startH = parseInt(startStr.split(':')[0]) || 0;
    let endH = parseInt(endStr.split(':')[0]) || 0;
    let slots = [];
    if (endH <= startH) endH += 24; 
    for (let i = startH; i < endH; i++) {
        let h1 = String(i % 24).padStart(2, '0') + '00';
        let h2 = String((i + 1) % 24).padStart(2, '0') + '00';
        slots.push(`${h1}-${h2}`);
    }
    return slots;
};

export default function DetailedRosterModal({ team, isOpen, onClose, employees, activities, settings, addNotification, isAdmin }) {
  const { width } = useWindowDimensions();
  const [gridData, setGridData] = useState([]);
  const [status, setStatus] = useState('DRAFT');
  const [currentDate, setCurrentDate] = useState('');
  const [currentShift, setCurrentShift] = useState('');
  const [warnings, setWarnings] = useState([]);

  const customCols = settings?.rosterColumns?.length > 0 ? settings.rosterColumns : ['CTL', 'APP', 'TWR', 'GCU'];
  const COL_LABELS = ['KHUNG GIỜ', ...customCols];
  const COL_KEYS = ['time', ...customCols];

  const getEmptyRow = useCallback(() => {
      const row = {};
      COL_KEYS.forEach(k => row[k] = '');
      return row;
  }, [settings?.rosterColumns]);

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
          const globalData = await DataService.fetchData(settings, "atc_system", "detailed_rosters") || {};
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
  }, [team, populateGrid, isAdmin, settings]);

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
                  const emp = employees.find(e => e.id.toUpperCase() === code && e.team === team);
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
          const globalData = await DataService.fetchData(settings, "atc_system", "detailed_rosters") || {};
          globalData[key] = { data: gridData, status: newStatus };
          await DataService.saveData(settings, "atc_system", "detailed_rosters", globalData);
      } catch (e) {
          console.error(e);
      }
  };

  const handleDraftSave = () => {
      if (!isAdmin) return;
      saveToGlobal('DRAFT');
      Alert.alert('Thành công', 'Đã lưu nháp bảng phân vị trí lên Cloud.');
  };

  const handlePublish = () => {
      if (!isAdmin) return;

      const executePublish = () => {
          saveToGlobal('PUBLISHED');

          let assignedCodes = new Set();
          gridData.forEach(row => {
              COL_KEYS.forEach(k => {
                  if(k === 'time') return;
                  const cellVal = (row[k] || '').trim().toUpperCase();
                  if(!cellVal) return;
                  const codes = cellVal.match(/\b[A-Z0-9_]+\b/g) || [];
                  codes.forEach(c => assignedCodes.add(c));
              });
          });

          let assignedNames = [];
          assignedCodes.forEach(code => {
              const emp = employees.find(e => e.id.toUpperCase() === code);
              if(emp) assignedNames.push(emp.name);
          });

          if (addNotification && assignedNames.length > 0) {
              addNotification(
                  'Cập nhật Vị Trí Ca Trực',
                  `Kíp trưởng đã ban hành sơ đồ vị trí cho Kíp ${team} (Ca ${currentShift}). Bấm vào Bảng chi tiết để xem.`,
                  'success'
              );
          }
          Alert.alert('Thành công', `Đã chốt bảng và phát thông báo đến ${assignedNames.length} KSVKL có liên quan.`);
      };

      if (warnings.length > 0) {
          Alert.alert('Cảnh báo An toàn', 'Hệ thống phát hiện nhân sự đang nghỉ phép bị xếp vào vị trí. Bạn có chắc chắn muốn phát hành?', [
              { text: 'Hủy (Sửa lại)', style: 'cancel' },
              { text: 'Vẫn Phát hành', style: 'destructive', onPress: executePublish }
          ]);
      } else {
          executePublish();
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
    <Modal visible={isOpen} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          
          <View style={styles.header}>
              <View>
                  <Text style={styles.headerTitle}>Lịch Phân Vị Trí ({team})</Text>
                  <Text style={styles.headerSub}>
                      Trạng thái: <Text style={{color: status === 'PUBLISHED' ? '#22c55e' : '#f59e0b', fontWeight: 'bold'}}>{status === 'PUBLISHED' ? 'Đã phát hành' : (isAdmin ? 'Đang soạn thảo' : 'Chưa có dữ liệu')}</Text>
                  </Text>
              </View>
              <TouchableOpacity style={styles.btnClose} onPress={onClose}><Feather name="x" size={20} color="#94a3b8" /></TouchableOpacity>
          </View>

          {!isAdmin && (
              <View style={styles.viewOnlyBanner}>
                  <Feather name="eye" size={14} color="#059669" />
                  <Text style={styles.viewOnlyText}>CHẾ ĐỘ XEM (VIEW ONLY)</Text>
              </View>
          )}

          <View style={styles.controlBar}>
              <View style={styles.controlBox}>
                  <TextInput style={styles.inputControl} value={currentDate} onChangeText={setCurrentDate} placeholder="YYYY-MM-DD" editable={isAdmin && status === 'DRAFT'} />
              </View>
              <View style={styles.controlBox}>
                  <TouchableOpacity style={styles.inputControl} onPress={toggleShift} activeOpacity={(isAdmin && status === 'DRAFT') || !isAdmin ? 0.7 : 1}>
                      <Text style={{color: '#f8fafc', fontWeight: 'bold', textAlign: 'center'}}>CA {currentShift}</Text>
                  </TouchableOpacity>
              </View>
              {isAdmin && status === 'DRAFT' && (
                  <View style={styles.rowControls}>
                      <TouchableOpacity style={styles.iconBtn} onPress={addRow} title="Thêm hàng ngang"><Feather name="plus" size={16} color="#f8fafc"/></TouchableOpacity>
                  </View>
              )}
          </View>

          <ScrollView horizontal style={styles.tableWrapper} showsHorizontalScrollIndicator={true}>
              <ScrollView showsVerticalScrollIndicator={true} style={{flex: 1}}>
                  <View style={styles.table}>
                      <View style={styles.tableHeadRow}>
                          {COL_LABELS.map((label, i) => (
                              <View key={i} style={[styles.thCell, i === 0 ? {width: 100} : {width: 70}]}>
                                  <Text style={styles.thText}>{label}</Text>
                              </View>
                          ))}
                          {isAdmin && status === 'DRAFT' && <View style={{width: 40}} />}
                      </View>

                      {gridData.map((row, rIdx) => (
                          <View key={rIdx} style={styles.tableBodyRow}>
                              {COL_KEYS.map((cKey, cIdx) => (
                                  <View key={cKey} style={[styles.tdCell, cIdx === 0 ? {width: 100} : {width: 70}]}>
                                      <TextInput
                                          style={[styles.cellInput, cIdx === 0 && styles.cellInputTime]}
                                          value={row[cKey]}
                                          onChangeText={(val) => handleCellChange(val, rIdx, cKey)}
                                          editable={isAdmin && status === 'DRAFT'}
                                          multiline={true} 
                                          blurOnSubmit={true} 
                                      />
                                  </View>
                              ))}
                              {isAdmin && status === 'DRAFT' && (
                                  <TouchableOpacity style={styles.tdAction} onPress={() => removeRow(rIdx)}>
                                      <Feather name="trash-2" size={14} color="#ef4444"/>
                                  </TouchableOpacity>
                              )}
                          </View>
                      ))}
                      {gridData.length === 0 && <Text style={{color: '#64748b', padding: 20, textAlign: 'center'}}>Bảng đang trống.</Text>}
                  </View>
              </ScrollView>
          </ScrollView>

          {isAdmin && warnings.length > 0 && (
              <View style={styles.warningArea}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4}}>
                      <Feather name="alert-triangle" size={14} color="#ef4444" />
                      <Text style={styles.warningTitle}>Phát hiện xung đột</Text>
                  </View>
                  {warnings.map((w, i) => <Text key={i} style={styles.warningText}>• {w}</Text>)}
              </View>
          )}

          <View style={styles.footer}>
              {isAdmin && status === 'DRAFT' ? (
                  <>
                      <TouchableOpacity style={styles.btnDraft} onPress={handleDraftSave}><Feather name="save" size={16} color="#f8fafc" /><Text style={styles.btnDraftText}>Lưu nháp</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.btnPublish, warnings.length > 0 && {backgroundColor: '#dc2626'}]} onPress={handlePublish}><Feather name="send" size={16} color="#fff" /><Text style={styles.btnPublishText}>{warnings.length > 0 ? 'Bỏ qua cảnh báo & Phát hành' : 'Phát hành'}</Text></TouchableOpacity>
                  </>
              ) : (
                  <>
                      <TouchableOpacity style={styles.btnDraft} onPress={onClose}><Text style={styles.btnDraftText}>Đóng</Text></TouchableOpacity>
                      {isAdmin && <TouchableOpacity style={styles.btnEdit} onPress={() => saveToGlobal('DRAFT')}><Feather name="unlock" size={16} color="#fff" /><Text style={styles.btnPublishText}>Mở khóa & Chỉnh sửa</Text></TouchableOpacity>}
                  </>
              )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { backgroundColor: '#0f172a', borderRadius: 12, width: '100%', maxWidth: 1000, maxHeight: '90%', overflow: 'hidden', borderWidth: 1, borderColor: '#1e293b', elevation: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#1e293b' },
  headerTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#f8fafc' },
  headerSub: { fontFamily: 'Times New Roman', fontSize: 12, color: '#94a3b8', marginTop: 4 },
  btnClose: { backgroundColor: '#1e293b', padding: 8, borderRadius: 20 },
  viewOnlyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#064e3b', paddingVertical: 6 },
  viewOnlyText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#34d399', letterSpacing: 1 },
  controlBar: { flexDirection: 'row', padding: 16, gap: 12, alignItems: 'center' },
  controlBox: { flex: 1, maxWidth: 200 },
  inputControl: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, color: '#f8fafc', fontFamily: 'Times New Roman', fontSize: 14, textAlign: 'center' },
  rowControls: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
  iconBtn: { backgroundColor: '#3b82f6', padding: 10, borderRadius: 8 },
  tableWrapper: { backgroundColor: '#0f172a', flex: 1, paddingHorizontal: 16 },
  table: { borderWidth: 1, borderColor: '#334155', borderRadius: 8, overflow: 'hidden', backgroundColor: '#1e293b' },
  tableHeadRow: { flexDirection: 'row', backgroundColor: '#0f172a', borderBottomWidth: 1, borderColor: '#334155' },
  thCell: { padding: 12, borderRightWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  thText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#38bdf8', textTransform: 'uppercase', textAlign: 'center' },
  tableBodyRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#334155', alignItems: 'stretch' },
  tdCell: { borderRightWidth: 1, borderColor: '#334155', justifyContent: 'center' },
  cellInput: { flex: 1, color: '#f8fafc', fontFamily: 'Times New Roman', fontSize: 13, padding: 10, textAlign: 'center', fontWeight: 'bold', minHeight: 40 },
  cellInputTime: { color: '#94a3b8', fontWeight: 'normal' },
  tdAction: { width: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b' },
  warningArea: { margin: 16, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: '#ef4444', borderRadius: 8, padding: 12 },
  warningTitle: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#ef4444' },
  warningText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#fca5a5', marginTop: 2, fontStyle: 'italic' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, borderColor: '#1e293b', backgroundColor: '#0f172a', gap: 12 },
  btnDraft: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1e293b' },
  btnDraftText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#f8fafc' },
  btnPublish: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#16a34a' },
  btnEdit: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#f59e0b' },
  btnPublishText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#fff' }
});