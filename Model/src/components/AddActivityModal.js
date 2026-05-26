import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { toYMD } from '../utils/helpers'; // Gọi hàm tiện ích từ file helpers

export default function AddActivityModal({ isOpen, employee, onClose, onSave, activityTypes = [] }) {
  const [formData, setFormData] = useState({ type: '', startDate: '', endDate: '', note: '' });

  useEffect(() => { 
    if(isOpen) { 
      const today = toYMD(new Date()); 
      setFormData({ type: activityTypes[0]?.id || '', startDate: today, endDate: today, note: '' }); 
    } 
  }, [isOpen, activityTypes]);

  if (!isOpen || !employee) return null;

  const handleSave = () => {
    onSave({ ...formData, empId: employee.id, id: Date.now().toString() });
    onClose();
  };

  return (
    <Modal visible={isOpen} transparent={true} animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Cập nhật Trạng thái</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            {/* Thông tin nhân sự */}
            <View style={styles.empCard}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{employee.name.charAt(0)}</Text></View>
              <View>
                <Text style={styles.empName}>{employee.name}</Text>
                <Text style={styles.empDesc}>{employee.team} • {employee.id}</Text>
              </View>
            </View>

            {/* Loại hình (Trượt ngang) */}
            <Text style={styles.label}>LOẠI HÌNH VẮNG MẶT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
              {activityTypes.map(type => {
                const isSelected = formData.type === type.id;
                return (
                  <TouchableOpacity 
                    key={type.id} 
                    style={[styles.typeChip, isSelected ? styles.typeChipActive : {}]}
                    onPress={() => setFormData({...formData, type: type.id})}
                  >
                    <Text style={[styles.typeChipText, isSelected ? styles.typeChipTextActive : {}]}>
                      {type.label} ({type.code})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Ngày tháng */}
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>TỪ NGÀY (YYYY-MM-DD)</Text>
                <TextInput 
                  style={styles.input} 
                  value={formData.startDate} 
                  onChangeText={(text) => setFormData({...formData, startDate: text})} 
                  placeholder="VD: 2026-03-02"
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>ĐẾN NGÀY (YYYY-MM-DD)</Text>
                <TextInput 
                  style={styles.input} 
                  value={formData.endDate} 
                  onChangeText={(text) => setFormData({...formData, endDate: text})} 
                  placeholder="VD: 2026-03-05"
                />
              </View>
            </View>

            {/* Ghi chú */}
            <Text style={styles.label}>GHI CHÚ CHI TIẾT</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              multiline={true}
              numberOfLines={3}
              value={formData.note} 
              onChangeText={(text) => setFormData({...formData, note: text})} 
              placeholder="Nhập lý do..."
            />
          </ScrollView>

          {/* Nút bấm */}
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.button, styles.btnCancel]} onPress={onClose}>
              <Text style={styles.btnCancelText}>Hủy bỏ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.btnSave]} onPress={handleSave}>
              <Text style={styles.btnSaveText}>Lưu dữ liệu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 400, overflow: 'hidden', maxHeight: '90%' },
  header: { backgroundColor: '#2563eb', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: 'Times New Roman', color: '#fff', fontSize: 18, fontWeight: 'bold' },
  closeBtn: { padding: 4 },
  formContainer: { padding: 16 },
  empCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', padding: 12, borderRadius: 8, borderColor: '#bfdbfe', borderWidth: 1, marginBottom: 16 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontFamily: 'Times New Roman', color: '#fff', fontSize: 18, fontWeight: 'bold' },
  empName: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e3a8a' },
  empDesc: { fontFamily: 'Times New Roman', fontSize: 12, color: '#1d4ed8', marginTop: 2 },
  label: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#6b7280', marginBottom: 6 },
  typeScroll: { flexDirection: 'row', marginBottom: 16 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', marginRight: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  typeChipActive: { backgroundColor: '#dbeafe', borderColor: '#3b82f6' },
  typeChipText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#4b5563' },
  typeChipTextActive: { fontFamily: 'Times New Roman', color: '#1d4ed8', fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  col: { width: '48%' },
  input: { fontFamily: 'Times New Roman', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fff', color: '#1f2937' },
  textArea: { height: 80, textAlignVertical: 'top', marginBottom: 20 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, borderColor: '#f3f4f6', backgroundColor: '#f9fafb' },
  button: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginLeft: 10 },
  btnCancel: { backgroundColor: '#e5e7eb' },
  btnCancelText: { fontFamily: 'Times New Roman', color: '#4b5563', fontWeight: 'bold' },
  btnSave: { backgroundColor: '#2563eb' },
  btnSaveText: { fontFamily: 'Times New Roman', color: '#fff', fontWeight: 'bold' }
});