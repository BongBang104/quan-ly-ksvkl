import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Modal, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { toYMD } from '../utils/helpers';
import DetailedRosterModal from '../components/DetailedRosterModal'; 

const formatDateDisplay = (dateStr) => {
    if(!dateStr) return '';
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}` : '';
}

export default function TeamsScreen({ currentUser, employees, settings: globalSettings, activities, setActivities, addNotification, requests, setRequests }) {
  
  // KIỂM TRA QUYỀN (CHỈ ADMIN MỚI ĐƯỢC DUYỆT ĐƠN/ĐỔI TRẠNG THÁI TỔNG)
  const isAdmin = currentUser?.role === 'ADMIN';
  
  // LEADER CÓ QUYỀN PHÂN VỊ TRÍ TRONG CA TRỰC CHI TIẾT
  const canEditRoster = currentUser?.role === 'ADMIN' || currentUser?.role === 'LEADER';

  const settings = useMemo(() => ({
      ...globalSettings,
      teams: globalSettings?.teams?.filter(t => t !== 'Trung tâm') || [],
      positions: ['QL', 'KSV', 'ON-CALL']
  }), [globalSettings]);

  const shiftEmployees = useMemo(() => {
      return employees.filter(emp => emp.team !== 'Trung tâm' && !emp.position?.toLowerCase().includes('lãnh đạo'));
  }, [employees]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [detailedRosterTeam, setDetailedRosterTeam] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ visible: false, title: '', msg: '', onConfirm: null });
  const [formData, setFormData] = useState({ type: '', startDate: '', endDate: '', note: '' });

  const [detailedRosters, setDetailedRosters] = useState({});

  const safeActivities = useMemo(() => Array.isArray(activities) ? activities : [], [activities]);
  
  const sortedActivities = useMemo(() => {
      return [...safeActivities].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  }, [safeActivities]);

  const getActivityConfig = (type) => {
      const found = settings.activityTypes.find(a => a.id === type);
      if (found) {
          if (found.id === 'LEAVE') return { ...found, bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
          if (found.id === 'TRIP') return { ...found, bg: '#faf5ff', text: '#9333ea', border: '#e9d5ff' };
          if (found.id === 'STUDY') return { ...found, bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
          if (found.id === 'COMP') return { ...found, bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' };
          if (found.id === 'SICK') return { ...found, bg: '#f0fdfa', text: '#0d9488', border: '#ccfbf1' };
          if (found.id === 'CHANGE') return { ...found, bg: '#f3f4f6', text: '#4b5563', border: '#e5e7eb' };
      }
      return { code: type, label: type, bg: '#f3f4f6', text: '#4b5563', border: '#e5e7eb' };
  };

  // 🌟 VÁ LỖI LOGIC: Admin duyệt đơn Sinh ra Activity Đổi Ca
  const handleApprove = (id) => {
    if (!isAdmin) return;
    const req = requests.find(r => r.id === id);
    
    if (req?.type === 'LEAVE' || req?.type === 'Nghỉ phép') { 
        const newAct = { 
            id: Date.now().toString(), 
            empId: req.requesterId, 
            type: req.leaveType === 'SICK' ? 'SICK' : 'LEAVE', 
            startDate: req.startDate || req.date, 
            endDate: req.endDate || req.date, 
            note: req.note || req.reason 
        };
        setActivities(prev => [newAct, ...(prev || [])]);
    } 
    else if (req?.type === 'Đổi ca' || req?.type === 'CHANGE') {
        const act1 = { id: 'ACT'+Date.now(), empId: req.requesterId, type: 'CHANGE', startDate: req.date, endDate: req.date, note: `Đổi ca với ${req.targetEmpName}` };
        const act2 = { id: 'ACT'+(Date.now()+1), empId: req.targetEmpId, type: 'CHANGE', startDate: req.date, endDate: req.date, note: `Đổi ca với ${req.requesterName}` };
        setActivities(prev => [...(prev || []), act1, act2]);
    }

    setRequests(p => p.filter(r => r.id !== id));
    Alert.alert('Thành công', 'Đã phê duyệt yêu cầu.');
    if (addNotification) addNotification('Phê duyệt thành công', `Đã duyệt đơn của ${req.requesterName}`, 'success');
  };

  const handleReject = (id) => { 
      if (!isAdmin) return;
      setRequests(p => p.filter(r => r.id !== id)); 
      Alert.alert('Đã từ chối', 'Yêu cầu đã bị hủy bỏ.'); 
  };

  const openActivityModal = (emp) => {
      if (!isAdmin) {
          Alert.alert("Quyền hạn", "Chỉ Quản trị viên mới được trực tiếp cập nhật trạng thái nhân sự.");
          return;
      }
      const today = toYMD(new Date());
      setFormData({ type: settings.activityTypes[0]?.id || '', startDate: today, endDate: today, note: '' });
      setSelectedEmp(emp);
  };

  const handleSaveActivity = () => {
      if (!formData.type || !formData.startDate || !formData.endDate) {
          Alert.alert('Lỗi', 'Vui lòng điền đủ thông tin bắt buộc.');
          return;
      }
      const newAct = {
          id: Date.now().toString(), empId: selectedEmp.id, type: formData.type,
          startDate: formData.startDate, endDate: formData.endDate, note: formData.note
      };
      setActivities(prev => [newAct, ...(prev || [])]);
      setSelectedEmp(null);
  };

  const confirmDeleteActivity = (id) => {
      if (!isAdmin) {
          Alert.alert("Quyền hạn", "Chỉ Quản trị viên mới được xóa trạng thái nhân sự.");
          return;
      }
      setConfirmDialog({
          visible: true, title: 'Xóa trạng thái', msg: 'Bạn có chắc chắn muốn xóa ghi nhận này không?',
          onConfirm: () => {
              setActivities(prev => prev.filter(a => a.id !== id));
              setConfirmDialog({ visible: false, title: '', msg: '', onConfirm: null });
          }
      });
  };

  return (
    <View style={styles.container}>
      <Modal visible={confirmDialog.visible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
              <View style={styles.confirmBox}>
                  <Text style={styles.confirmTitle}>{confirmDialog.title}</Text>
                  <Text style={styles.confirmMsg}>{confirmDialog.msg}</Text>
                  <View style={styles.confirmActions}>
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#f1f5f9'}]} onPress={() => setConfirmDialog({ ...confirmDialog, visible: false })}><Text style={[styles.modalBtnText, {color: '#64748b'}]}>Hủy bỏ</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#ef4444'}]} onPress={() => confirmDialog.onConfirm && confirmDialog.onConfirm()}><Text style={[styles.modalBtnText, {color: '#fff'}]}>Xóa</Text></TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

      <Modal visible={!!selectedEmp} transparent animationType="slide">
          <View style={styles.modalOverlay}>
              <View style={styles.activityBox}>
                  <View style={styles.activityHeader}>
                      <Text style={styles.activityTitle}>Cập nhật trạng thái</Text>
                      <TouchableOpacity onPress={() => setSelectedEmp(null)}><Feather name="x" size={20} color="#64748b"/></TouchableOpacity>
                  </View>
                  {selectedEmp && (<View style={styles.activityEmpInfo}><Text style={styles.activityEmpText}>{selectedEmp.name} - {selectedEmp.team}</Text></View>)}
                  <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>LOẠI HÌNH</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 12}}>
                          {settings?.activityTypes.map(type => (
                              <TouchableOpacity key={type.id} style={[styles.typeChip, formData.type === type.id && styles.typeChipActive]} onPress={() => setFormData({...formData, type: type.id})}>
                                  <Text style={[styles.typeChipText, formData.type === type.id && {color: '#fff'}]}>{type.label}</Text>
                              </TouchableOpacity>
                          ))}
                      </ScrollView>
                      <View style={styles.dateRow}>
                          <View style={{flex: 1, marginRight: 10}}><Text style={styles.formLabel}>TỪ NGÀY (YYYY-MM-DD)</Text><TextInput style={styles.input} value={formData.startDate} onChangeText={t => setFormData({...formData, startDate: t})} /></View>
                          <View style={{flex: 1}}><Text style={styles.formLabel}>ĐẾN NGÀY (YYYY-MM-DD)</Text><TextInput style={styles.input} value={formData.endDate} onChangeText={t => setFormData({...formData, endDate: t})} /></View>
                      </View>
                      <Text style={styles.formLabel}>GHI CHÚ CHI TIẾT</Text>
                      <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} placeholder="Lý do chi tiết..." multiline value={formData.note} onChangeText={t => setFormData({...formData, note: t})} />
                  </View>
                  <View style={styles.activityFooter}>
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#f1f5f9', flex: 1, marginRight: 10, alignItems: 'center'}]} onPress={() => setSelectedEmp(null)}><Text style={[styles.modalBtnText, {color: '#64748b'}]}>Hủy</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#2563eb', flex: 2, alignItems: 'center'}]} onPress={handleSaveActivity}><Text style={[styles.modalBtnText, {color: '#fff'}]}>Lưu trạng thái</Text></TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

      <DetailedRosterModal 
          team={detailedRosterTeam} 
          isOpen={!!detailedRosterTeam} 
          onClose={() => setDetailedRosterTeam(null)} 
          employees={shiftEmployees}
          activities={safeActivities}
          settings={settings}
          detailedRosters={detailedRosters}
          setDetailedRosters={setDetailedRosters}
          addNotification={addNotification}
          isAdmin={canEditRoster} 
      />

      {/* 🌟 ĐÃ FIX: Header Card cho Quản lý Kíp tự rớt dòng thanh tìm kiếm */}
      <View style={styles.headerCard}>
        <View style={styles.headerInfo}>
            <View style={styles.iconBox}><Feather name="users" size={20} color="#2563eb" /></View>
            <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Danh Sách & Phân Vị Trí</Text>
                <Text style={styles.headerSub}>Quản lý nhân sự, Duyệt đơn & Lịch trực ca</Text>
            </View>
        </View>
        <View style={styles.searchBox}>
            <Feather name="search" size={16} color="#9ca3af" />
            <TextInput style={styles.searchInput} placeholder="Tìm kiếm Tên / Mã ICAO..." value={searchTerm} onChangeText={setSearchTerm} />
            {searchTerm !== '' && <TouchableOpacity onPress={() => setSearchTerm('')}><Feather name="x" size={16} color="#9ca3af"/></TouchableOpacity>}
        </View>
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        
        {isAdmin && (
            <View style={styles.sectionCard}>
            <View style={[styles.sectionHeader, { backgroundColor: '#fffbeb', borderBottomColor: '#fde68a' }]}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                    <Feather name="bell" size={16} color="#d97706" />
                    <Text style={[styles.sectionTitle, { color: '#92400e' }]}>Hòm Thư Xét Duyệt</Text>
                </View>
                <View style={styles.inboxBadge}><Text style={styles.inboxBadgeText}>{requests.length} chờ duyệt</Text></View>
            </View>
            <View style={styles.sectionBody}>
                {requests.map(req => {
                    const requester = employees.find(e => e.id === req.requesterId);
                    const displayName = requester ? (requester.icaoCode ? `${requester.name} (${requester.icaoCode})` : requester.name) : req.requesterId;
                    
                    const isLeave = req.type === 'LEAVE' || req.type === 'Nghỉ phép';

                    return (
                        <View key={req.id} style={styles.reqCard}>
                            <View style={styles.reqHeader}>
                                <View style={styles.reqTypeBadge}>
                                    <Text style={styles.reqTypeText}>{isLeave ? 'XIN NGHỈ' : 'ĐỔI CA'}</Text>
                                </View>
                                <Text style={styles.reqDate}>Ngày: {req.startDate || req.date}</Text>
                            </View>
                            
                            {isLeave ? (
                                <Text style={styles.reqMainText}>
                                    <Text style={{fontWeight: 'bold', color: '#dc2626'}}>{displayName}</Text> xin {req.leaveType === 'SICK' ? 'Nghỉ Ốm' : 'Nghỉ Phép'}.
                                </Text>
                            ) : (
                                <Text style={styles.reqMainText}>
                                    <Text style={{fontWeight: 'bold', color: '#dc2626'}}>{displayName}</Text> đề nghị Đổi Ca với <Text style={{fontWeight: 'bold', color: '#2563eb'}}>{req.targetEmpName}</Text>.
                                </Text>
                            )}

                            <Text style={styles.reqNote}>Lý do: "{req.note || req.reason}"</Text>
                            
                            <View style={styles.reqActions}>
                                <TouchableOpacity style={styles.btnReject} onPress={() => handleReject(req.id)}><Text style={styles.btnRejectText}>Từ chối</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.btnApprove} onPress={() => handleApprove(req.id)}><Text style={styles.btnApproveText}>Phê duyệt</Text></TouchableOpacity>
                            </View>
                        </View>
                    );
                })}
                {requests.length === 0 && <Text style={styles.emptyText}>Không có yêu cầu nào đang chờ xử lý.</Text>}
            </View>
            </View>
        )}

        <View style={styles.teamsGrid}>
          {settings?.teams.map(team => {
            const teamMembers = shiftEmployees.filter(e => e.team === team && (!searchTerm || e.name.toLowerCase().includes(searchTerm.toLowerCase()) || (e.icaoCode && e.icaoCode.toLowerCase().includes(searchTerm.toLowerCase()))));
            const managerCount = teamMembers.filter(e => (e.position && (e.position.toLowerCase().includes('quản lý') || e.position.toLowerCase().includes('trưởng'))) || e.isChief).length;
            const vipCount = teamMembers.filter(e => e.isVip).length;
            const qualStats = teamMembers.reduce((acc, curr) => {
                const q = curr.qualification || 'Khác';
                acc[q] = (acc[q] || 0) + 1;
                return acc;
            }, {});

            return (
              <View key={team} style={styles.teamCard}>
                <View style={styles.teamHeader}>
                  <Text style={styles.teamTitle}>{team}</Text>
                  <View style={styles.teamActions}>
                    <TouchableOpacity style={styles.btnDetail} onPress={() => setDetailedRosterTeam(team)}>
                      <Feather name="layout" size={12} color="#4338ca" />
                      <Text style={styles.btnDetailText}>{canEditRoster ? 'Phân vị trí' : 'Lịch trực ca chi tiết'}</Text>
                    </TouchableOpacity>
                    <View style={styles.countBadge}><Text style={styles.countText}>{teamMembers.length} TV</Text></View>
                  </View>
                </View>
                
                <View style={styles.statsBar}>
                  <View style={styles.statItem}><Feather name="star" size={12} color="#1d4ed8" /><Text style={styles.statTextBold}>{managerCount} QL</Text></View>
                  <View style={styles.statItem}><Feather name="send" size={12} color="#7e22ce" /><Text style={[styles.statTextBold, {color: '#7e22ce'}]}>{vipCount} VIP</Text></View>
                  <View style={styles.statDivider} />
                  <View style={styles.qualWrap}>
                    {Object.entries(qualStats).map(([q, count]) => (
                        <View key={q} style={styles.qualBadge}><Text style={styles.qualBadgeText}>{q}: <Text style={{fontWeight: 'bold'}}>{count}</Text></Text></View>
                    ))}
                  </View>
                </View>
                
                <View style={styles.memberList}>
                  {teamMembers.map(emp => {
                    const initial = emp.name.charAt(0).toUpperCase();
                    const empRecentActivities = sortedActivities.filter(a => a.empId === emp.id).slice(0, 5);

                    return (
                      <View key={emp.id} style={styles.memberItem}>
                        <View style={styles.memberHeaderRow}>
                            <View style={styles.memberInfo}>
                                <View style={[styles.avatar, emp.isChief ? styles.avatarChief : styles.avatarNormal]}>
                                    <Text style={styles.avatarText}>{initial}</Text>
                                </View>
                                <View>
                                    <Text style={styles.memberName}>
                                        {emp.name} {emp.icaoCode && <Text style={{color: '#2563eb', fontSize: 13}}>({emp.icaoCode})</Text>}
                                    </Text>
                                    <View style={styles.tagsRow}>
                                        <View style={styles.tagBase}><Text style={styles.tagBaseText}>{emp.position}</Text></View>
                                        <View style={styles.tagBase}><Text style={styles.tagBaseText}>{emp.qualification}</Text></View>
                                        {emp.isVip && <View style={styles.tagVip}><Feather name="send" size={8} color="#7e22ce"/><Text style={styles.tagVipText}> VIP</Text></View>}
                                    </View>
                                </View>
                            </View>
                            
                            {isAdmin && (
                                <TouchableOpacity style={styles.btnStatus} onPress={() => openActivityModal(emp)}>
                                    <Feather name="plus" size={12} color="#2563eb" />
                                    <Text style={styles.btnStatusText}>Trạng thái</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        
                        {empRecentActivities.length > 0 && (
                            <View style={styles.recentActsBox}>
                                {empRecentActivities.map((act, i) => {
                                    const conf = getActivityConfig(act.type);
                                    return (
                                        <View key={act.id || i} style={styles.miniActRow}>
                                            <View style={styles.miniActDot} />
                                            <Text style={styles.miniActDate}>{formatDateDisplay(act.startDate)}</Text>
                                            <View style={[styles.miniActBadge, {backgroundColor: conf.bg}]}><Text style={[styles.miniActBadgeText, {color: conf.text}]}>{conf.label}</Text></View>
                                            <Text style={styles.miniActNote} numberOfLines={1}>{act.note}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                      </View>
                    );
                  })}
                  {teamMembers.length === 0 && <Text style={styles.emptyText}>Không tìm thấy nhân sự.</Text>}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}><Feather name="file-text" size={18} color="#1e293b" /><Text style={styles.tableTitle}>Bảng Tổng Hợp Trạng Thái Gần Đây</Text></View>
          </View>
          
          <View style={styles.tableHeadRow}>
              <Text style={[styles.thCell, {flex: 2}]}>Nhân viên</Text>
              <Text style={[styles.thCell, {flex: 1.5}]}>Loại hình</Text>
              <Text style={[styles.thCell, {flex: 2}]}>Thời gian</Text>
              <Text style={[styles.thCell, {flex: 2}]}>Ghi chú</Text>
              {isAdmin && <Text style={[styles.thCell, {width: 40, textAlign: 'center'}]}>Xóa</Text>}
          </View>

          <View style={styles.tableBody}>
            {sortedActivities.slice(0, 50).map(act => { 
              const emp = employees.find(e => e.id === act.empId);
              const conf = getActivityConfig(act.type);
              
              const displayName = emp ? (emp.icaoCode ? `${emp.name} (${emp.icaoCode})` : emp.name) : act.empId;

              return (
                <View key={act.id} style={styles.tableRow}>
                  <Text style={[styles.tdCell, {flex: 2, fontWeight: 'bold', color: '#1e293b'}]}>{displayName}</Text>
                  <View style={{flex: 1.5, alignItems: 'flex-start'}}>
                      <View style={[styles.actBadge, {backgroundColor: conf.bg, borderColor: conf.border}]}><Text style={[styles.actBadgeText, {color: conf.text}]}>{conf.label}</Text></View>
                  </View>
                  <Text style={[styles.tdCell, {flex: 2, color: '#475569'}]}>{formatDateDisplay(act.startDate)} {act.endDate !== act.startDate ? `- ${formatDateDisplay(act.endDate)}` : ''}</Text>
                  <Text style={[styles.tdCell, {flex: 2, color: '#64748b', fontStyle: 'italic'}]}>{act.note || '-'}</Text>
                  
                  {isAdmin && (
                      <TouchableOpacity style={styles.tdAction} onPress={() => confirmDeleteActivity(act.id)}>
                          <View style={styles.trashBtn}><Feather name="trash-2" size={14} color="#ef4444" /></View>
                      </TouchableOpacity>
                  )}
                </View>
              );
            })}
            {sortedActivities.length === 0 && <Text style={styles.emptyText}>Chưa có ghi nhận nào.</Text>}
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 12 },
  
  // 🌟 CSS ĐÃ ĐƯỢC TỐI ƯU HÓA MOBILE (FLEX WRAP) 🌟
  headerCard: { 
      flexDirection: 'row', 
      flexWrap: 'wrap', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      backgroundColor: '#fff', 
      padding: 16, 
      borderRadius: 12, 
      borderWidth: 1, 
      borderColor: '#e2e8f0', 
      marginBottom: 12, 
      elevation: 1,
      gap: 12
  },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 250 },
  searchBox: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: '#f8fafc', 
      borderWidth: 1, 
      borderColor: '#e2e8f0', 
      borderRadius: 8, 
      paddingHorizontal: 12, 
      height: 40, 
      flex: 1, 
      minWidth: Platform.OS === 'web' ? 250 : '100%' // Ép tràn 100% trên màn hình hẹp
  },
  
  iconBox: { backgroundColor: '#dbeafe', padding: 8, borderRadius: 8, marginRight: 12 },
  headerTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  headerSub: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b' },
  searchInput: { flex: 1, fontFamily: 'Times New Roman', marginLeft: 8, fontSize: 14 },
  scrollArea: { flex: 1 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  confirmBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 320, elevation: 5 },
  confirmTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
  confirmMsg: { fontFamily: 'Times New Roman', fontSize: 14, color: '#475569', marginBottom: 20, lineHeight: 20 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  modalBtnText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold' },

  activityBox: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 350, overflow: 'hidden', elevation: 5 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  activityTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  activityEmpInfo: { backgroundColor: '#eff6ff', padding: 10, borderBottomWidth: 1, borderColor: '#bfdbfe' },
  activityEmpText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#1d4ed8', textAlign: 'center' },
  formGroup: { padding: 16 },
  formLabel: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#64748b', marginBottom: 6, marginTop: 4 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8, backgroundColor: '#f8fafc' },
  typeChipActive: { backgroundColor: '#2563eb', borderColor: '#1d4ed8' },
  typeChipText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#475569', fontWeight: 'bold' },
  dateRow: { flexDirection: 'row', marginBottom: 10 },
  input: { fontFamily: 'Times New Roman', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 10, fontSize: 14, backgroundColor: '#fff' },
  activityFooter: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },

  sectionCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  sectionTitle: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  inboxBadge: { backgroundColor: '#fef3c7', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 12 },
  inboxBadgeText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#b45309' },
  sectionBody: { padding: 12 },
  reqCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 10 },
  reqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reqTypeBadge: { backgroundColor: '#fee2e2', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  reqTypeText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#b91c1c' },
  reqDate: { fontFamily: 'Times New Roman', fontSize: 11, color: '#94a3b8', fontWeight: 'bold' },
  reqMainText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#1e293b', marginBottom: 4 },
  reqNote: { fontFamily: 'Times New Roman', fontSize: 11, color: '#64748b', fontStyle: 'italic', backgroundColor: '#f8fafc', padding: 6, borderRadius: 4, marginBottom: 10 },
  reqActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  btnReject: { backgroundColor: '#f1f5f9', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  btnRejectText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  btnApprove: { backgroundColor: '#2563eb', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  btnApproveText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#fff' },

  teamsGrid: { gap: 16, marginBottom: 20 },
  teamCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', elevation: 1 },
  teamHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  teamTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  teamActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnDetail: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e0e7ff', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#c7d2fe' },
  btnDetailText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#4338ca' },
  countBadge: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  countText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b' },
  
  statsBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#dbeafe', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statTextBold: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#1d4ed8' },
  statDivider: { width: 1, height: 12, backgroundColor: '#bfdbfe' },
  qualWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  qualBadge: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  qualBadgeText: { fontFamily: 'Times New Roman', fontSize: 9, color: '#334155' },

  memberList: { },
  memberItem: { padding: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  memberHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  memberInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarNormal: { backgroundColor: '#3b82f6' }, 
  avatarChief: { backgroundColor: '#eab308' },
  avatarText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#fff' },
  memberName: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  tagsRow: { flexDirection: 'row', marginTop: 6, gap: 6 },
  tagBase: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagBaseText: { fontFamily: 'Times New Roman', fontSize: 10, color: '#475569', fontWeight: 'bold' },
  tagVip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3e8ff', borderWidth: 1, borderColor: '#e9d5ff', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagVipText: { fontFamily: 'Times New Roman', fontSize: 10, color: '#7e22ce', fontWeight: 'bold' },
  btnStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  btnStatusText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#2563eb' },

  recentActsBox: { marginTop: 10, marginLeft: 48, backgroundColor: '#f8fafc', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#f1f5f9' },
  miniActRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  miniActDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1' },
  miniActDate: { fontFamily: 'Times New Roman', fontSize: 10, color: '#64748b', width: 35 },
  miniActBadge: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  miniActBadgeText: { fontFamily: 'Times New Roman', fontSize: 9, fontWeight: 'bold' },
  miniActNote: { flex: 1, fontFamily: 'Times New Roman', fontSize: 11, color: '#475569', fontStyle: 'italic' },

  tableCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', elevation: 1 },
  tableHeader: { backgroundColor: '#f8fafc', padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  tableTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  tableHeadRow: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  thCell: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' },
  tableBody: { },
  tableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
  tdCell: { fontFamily: 'Times New Roman', fontSize: 13 },
  actBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  actBadgeText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold' },
  tdAction: { width: 40, alignItems: 'center' },
  trashBtn: { padding: 6, backgroundColor: '#fef2f2', borderRadius: 20 },

  emptyText: { fontFamily: 'Times New Roman', fontSize: 12, fontStyle: 'italic', color: '#94a3b8', textAlign: 'center', padding: 16 }
});