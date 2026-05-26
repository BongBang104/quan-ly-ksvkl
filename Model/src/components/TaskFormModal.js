import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function TaskFormModal({ isOpen, onClose, onSave, settings, employees, currentUser }) {
  // PHÂN QUYỀN CỨNG NHẮC DỰA VÀO CƠ SỞ DỮ LIỆU
  const isAdmin = currentUser?.role === 'ADMIN';
  const isLeader = currentUser?.role === 'LEADER';
  const isStaff = currentUser?.role === 'STAFF';

  const [type, setType] = useState('REPORT');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetTeams, setTargetTeams] = useState([]);
  const [selectedEmps, setSelectedEmps] = useState([]);
  
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');

  useEffect(() => {
    if (isOpen) {
      setType('REPORT');
      setTitle('');
      setContent('');
      setDeadlineDate('');
      setDeadlineTime('');
      setSelectedEmps([]);
      
      if (!isStaff && currentUser?.team && settings?.teams?.includes(currentUser.team)) {
          setTargetTeams([currentUser.team]);
      } else {
          setTargetTeams([]);
      }
    }
  }, [isOpen, currentUser, settings, isStaff]);

  const toggleTeam = (team) => setTargetTeams(prev => prev.includes(team) ? prev.filter(t => t !== team) : [...prev, team]);
  const toggleEmp = (empId) => setSelectedEmps(prev => prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]);

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ Tiêu đề và Nội dung.');
      return;
    }

    let finalTargetIds = [];
    let notifMessage = "";

    if (isStaff) {
        const autoIds = employees.filter(e => e.role === 'ADMIN' || (e.role === 'LEADER' && e.team === currentUser?.team)).map(e => e.id);
        finalTargetIds = [...new Set([...autoIds, ...selectedEmps])];
        notifMessage = `${currentUser?.name} (Nhân viên) vừa nộp Báo cáo: "${title.trim()}"`;
    } else {
        const teamIds = employees.filter(e => targetTeams.includes(e.team)).map(e => e.id);
        finalTargetIds = [...new Set([...teamIds, ...selectedEmps])];
        
        if (finalTargetIds.length === 0) {
            Alert.alert('Lỗi', 'Vui lòng chỉ định ít nhất 1 Kíp hoặc 1 Cá nhân nhận.');
            return;
        }
        notifMessage = `${currentUser?.name} (${isAdmin ? 'Lãnh đạo' : 'Kíp trưởng'}) vừa ban hành ${type === 'REPORT' ? 'Báo cáo' : type === 'DEBRIEF' ? 'Bình giảng' : 'Nhiệm vụ'}: "${title.trim()}"`;
    }

    const newTask = {
      id: 'TASK_' + Date.now(),
      type: isStaff ? 'REPORT' : type, // STAFF CHỈ CÓ THỂ LƯU TYPE LÀ REPORT
      title: title.trim(),
      content: content.trim(),
      date: new Date().toISOString().split('T')[0],
      deadlineDate: type === 'TASK' ? deadlineDate : '',
      deadlineTime: type === 'TASK' ? deadlineTime : '',
      status: 'PUBLISHED',
      targetEmpIds: finalTargetIds,
      authorId: currentUser?.id,
      authorName: currentUser?.name,
      authorRole: isAdmin ? 'Quản lý' : (isLeader ? 'Kíp trưởng' : 'Nhân viên'),
      comments: [],
      isChatLocked: false
    };

    onSave(newTask, notifMessage);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Tạo Bài Đăng Mới</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={24} color="#64748b" /></TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>LOẠI BÀI ĐĂNG</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity style={[styles.typeBtn, type === 'REPORT' && styles.typeBtnActive]} onPress={() => setType('REPORT')} disabled={isStaff}>
                <Feather name="file-text" size={14} color={type === 'REPORT' ? '#fff' : '#64748b'} />
                <Text style={[styles.typeText, type === 'REPORT' && styles.typeTextActive]}>Báo cáo</Text>
              </TouchableOpacity>
              
              {/* STAFF KHÔNG ĐƯỢC PHÉP NHÌN THẤY 2 NÚT NÀY */}
              {!isStaff && (
                  <>
                      <TouchableOpacity style={[styles.typeBtn, type === 'DEBRIEF' && styles.typeBtnActive]} onPress={() => setType('DEBRIEF')}>
                        <Feather name="book-open" size={14} color={type === 'DEBRIEF' ? '#fff' : '#64748b'} />
                        <Text style={[styles.typeText, type === 'DEBRIEF' && styles.typeTextActive]}>Bình giảng</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.typeBtn, type === 'TASK' && styles.typeBtnActive]} onPress={() => setType('TASK')}>
                        <Feather name="clipboard" size={14} color={type === 'TASK' ? '#fff' : '#64748b'} />
                        <Text style={[styles.typeText, type === 'TASK' && styles.typeTextActive]}>Nhiệm vụ</Text>
                      </TouchableOpacity>
                  </>
              )}
            </View>

            <Text style={styles.label}>1. GIAO CHO KÍP</Text>
            {isStaff ? (
                <View style={styles.autoAssignBox}>
                    <Feather name="info" size={14} color="#0369a1" />
                    <Text style={styles.autoAssignText}>Hệ thống tự động gửi tới <Text style={{fontWeight: 'bold'}}>Quản lý</Text> và <Text style={{fontWeight: 'bold'}}>Kíp trưởng ({currentUser?.team || 'Kíp của bạn'})</Text>.</Text>
                </View>
            ) : (
                <View style={styles.targetRow}>
                  {settings?.teams?.filter(t => t !== 'Trung tâm').map(t => (
                      <TouchableOpacity key={t} style={[styles.targetBtn, targetTeams.includes(t) && styles.targetBtnActive]} onPress={() => toggleTeam(t)}>
                        <Text style={[styles.targetText, targetTeams.includes(t) && {color:'#fff'}]}>{t}</Text>
                      </TouchableOpacity>
                  ))}
                </View>
            )}

            <Text style={styles.label}>2. GIAO CHO CÁ NHÂN CHỈ ĐỊNH (TÙY CHỌN)</Text>
            <View style={styles.targetRow}>
                {employees.filter(e => e.id !== currentUser?.id).map(emp => (
                    <TouchableOpacity key={emp.id} style={[styles.empBtn, selectedEmps.includes(emp.id) && styles.empBtnActive]} onPress={() => toggleEmp(emp.id)}>
                        <Text style={[styles.empText, selectedEmps.includes(emp.id) && {color:'#1d4ed8', fontWeight:'bold'}]}>{emp.name}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {type === 'TASK' && !isStaff && (
                <View style={styles.deadlineRow}>
                    <View style={{flex: 1, marginRight: 10}}><Text style={styles.label}>HẠN CHÓT (NGÀY)</Text><TextInput style={styles.input} placeholder="YYYY-MM-DD" value={deadlineDate} onChangeText={setDeadlineDate} /></View>
                    <View style={{flex: 1}}><Text style={styles.label}>HẠN CHÓT (GIỜ)</Text><TextInput style={styles.input} placeholder="HH:MM" value={deadlineTime} onChangeText={setDeadlineTime} /></View>
                </View>
            )}

            <Text style={styles.label}>TIÊU ĐỀ</Text>
            <TextInput style={styles.input} placeholder="Nhập tiêu đề..." value={title} onChangeText={setTitle} />

            <Text style={styles.label}>NỘI DUNG CHI TIẾT</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Nội dung..." multiline textAlignVertical="top" value={content} onChangeText={setContent} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose}><Text style={styles.btnCancelText}>Hủy Bỏ</Text></TouchableOpacity>
            <TouchableOpacity style={styles.btnSave} onPress={handleSave}><Feather name="send" size={14} color="#fff" /><Text style={styles.btnSaveText}>Phát Hành / Gửi Báo Cáo</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  container: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 700, maxHeight: '90%', overflow: 'hidden', elevation: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  headerTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  body: { padding: 20 },
  label: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 8, marginTop: 16 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  typeBtnActive: { backgroundColor: '#2563eb', borderColor: '#1d4ed8' },
  typeText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569' },
  typeTextActive: { color: '#fff' },
  targetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  targetBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1' },
  targetBtnActive: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
  targetText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontWeight: 'bold' },
  targetTextActive: { color: '#fff' },
  empBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  empBtnActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  empText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#475569' },
  empTextActive: { color: '#1d4ed8', fontWeight: 'bold' },
  autoAssignBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e0f2fe', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd' },
  autoAssignText: { flex: 1, fontFamily: 'Times New Roman', fontSize: 13, color: '#0369a1', lineHeight: 20 },
  deadlineRow: { flexDirection: 'row' },
  input: { fontFamily: 'Times New Roman', fontSize: 14, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  textArea: { height: 120 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  btnCancel: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  btnCancelText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569' },
  btnSave: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#2563eb' },
  btnSaveText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#fff' }
});