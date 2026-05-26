import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function EmployeeFormModal({ isOpen, onClose, onSave, initialData, settings }) {
  const [formData, setFormData] = useState({
    id: '', name: '', team: '', position: '', qualification: '', isChief: false, isVip: false,
    phone: '', dob: '', licenseNo: '', englishExp: '', healthExp: '' // Bổ sung trường mới
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(initialData);
      } else {
        setFormData({
          id: '', name: '', 
          team: settings?.teams[0] || '', position: settings?.positions[0] || '', qualification: settings?.qualifications[0] || '', 
          isChief: false, isVip: false, phone: '', dob: '', licenseNo: '', englishExp: '', healthExp: ''
        });
      }
    }
  }, [isOpen, initialData, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!formData.id || !formData.name) {
      alert('Vui lòng nhập tối thiểu Tên và Mã ICAO!');
      return;
    }
    onSave({ ...formData, id: formData.id.toUpperCase() });
    onClose();
  };

  const renderChipSelector = (label, items, fieldKey) => (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {items.map(item => {
          const isSelected = formData[fieldKey] === item;
          return (
            <TouchableOpacity key={item} style={[styles.chip, isSelected && styles.chipActive]} onPress={() => setFormData({...formData, [fieldKey]: item})}>
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={isOpen} transparent={true} animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{initialData ? 'Sửa thông tin Nhân sự' : 'Thêm mới Nhân sự'}</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={24} color="#fff" /></TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* THÔNG TIN CƠ BẢN */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>1. Thông tin cơ bản</Text>
              <View style={styles.row}>
                <View style={[styles.fieldBlock, { flex: 2, marginRight: 10 }]}>
                  <Text style={styles.label}>HỌ VÀ TÊN (*)</Text>
                  <TextInput style={styles.input} placeholder="Nguyễn Văn A" value={formData.name} onChangeText={(t) => setFormData({...formData, name: t})} />
                </View>
                <View style={[styles.fieldBlock, { flex: 1 }]}>
                  <Text style={styles.label}>MÃ ICAO (*)</Text>
                  <TextInput style={[styles.input, styles.inputBold]} placeholder="VA" maxLength={4} value={formData.id} onChangeText={(t) => setFormData({...formData, id: t.toUpperCase()})} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={[styles.fieldBlock, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>NGÀY SINH</Text>
                  <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={formData.dob} onChangeText={(t) => setFormData({...formData, dob: t})} />
                </View>
                <View style={[styles.fieldBlock, { flex: 1 }]}>
                  <Text style={styles.label}>SỐ ĐIỆN THOẠI</Text>
                  <TextInput style={styles.input} placeholder="09xxxx..." keyboardType="phone-pad" value={formData.phone} onChangeText={(t) => setFormData({...formData, phone: t})} />
                </View>
              </View>
            </View>

            {/* CHUYÊN MÔN & CA KÍP */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>2. Phân công & Chuyên môn</Text>
              {renderChipSelector('KÍP TRỰC', settings?.teams || [], 'team')}
              {renderChipSelector('CHỨC DANH', settings?.positions || [], 'position')}
              {renderChipSelector('NĂNG ĐỊNH', settings?.qualifications || [], 'qualification')}
              
              <View style={styles.switchRow}>
                <View style={styles.switchBlock}>
                  <Text style={styles.switchLabel}><Feather name="star" size={14} color="#eab308"/> Kíp trưởng</Text>
                  <Switch value={formData.isChief} onValueChange={(val) => setFormData({...formData, isChief: val})} />
                </View>
                <View style={styles.switchBlock}>
                  <Text style={styles.switchLabel}><Feather name="award" size={14} color="#a855f7"/> Chuyên cơ</Text>
                  <Switch value={formData.isVip} onValueChange={(val) => setFormData({...formData, isVip: val})} />
                </View>
              </View>
            </View>

            {/* CHỨNG CHỈ & GIẤY PHÉP */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>3. Giấy phép & Chứng chỉ</Text>
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>SỐ GIẤY PHÉP KSVKL</Text>
                <TextInput style={styles.input} placeholder="VD: 1234/CHK" value={formData.licenseNo} onChangeText={(t) => setFormData({...formData, licenseNo: t})} />
              </View>
              <View style={styles.row}>
                <View style={[styles.fieldBlock, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>HẠN TIẾNG ANH</Text>
                  <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={formData.englishExp} onChangeText={(t) => setFormData({...formData, englishExp: t})} />
                </View>
                <View style={[styles.fieldBlock, { flex: 1 }]}>
                  <Text style={styles.label}>HẠN SỨC KHỎE</Text>
                  <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={formData.healthExp} onChangeText={(t) => setFormData({...formData, healthExp: t})} />
                </View>
              </View>
            </View>
            <View style={{height: 20}} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose}><Text style={styles.btnCancelText}>Hủy</Text></TouchableOpacity>
            <TouchableOpacity style={styles.btnSave} onPress={handleSave}><Text style={styles.btnSaveText}>Lưu Thông Tin</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#f8fafc', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  header: { backgroundColor: '#1e293b', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  headerTitle: { fontFamily: 'Times New Roman', color: '#fff', fontSize: 18, fontWeight: 'bold' },
  body: { padding: 16 },
  sectionBox: { backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
  sectionTitle: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e40af', marginBottom: 12, borderBottomWidth: 1, borderColor: '#eff6ff', paddingBottom: 6 },
  row: { flexDirection: 'row' },
  fieldBlock: { marginBottom: 12 },
  label: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#64748b', marginBottom: 4 },
  input: { fontFamily: 'Times New Roman', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 14, color: '#1e293b' },
  inputBold: { fontWeight: 'bold', color: '#2563eb', textAlign: 'center' },
  chipRow: { flexDirection: 'row' },
  chip: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginRight: 8 },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#1d4ed8' },
  chipText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontWeight: 'bold' },
  chipTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  switchBlock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchLabel: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#334155' },
  footer: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e2e8f0' },
  btnCancel: { flex: 1, padding: 14, backgroundColor: '#f1f5f9', borderRadius: 10, marginRight: 10, alignItems: 'center' },
  btnCancelText: { fontFamily: 'Times New Roman', color: '#475569', fontWeight: 'bold', fontSize: 15 },
  btnSave: { flex: 2, padding: 14, backgroundColor: '#2563eb', borderRadius: 10, alignItems: 'center' },
  btnSaveText: { fontFamily: 'Times New Roman', color: '#fff', fontWeight: 'bold', fontSize: 15 }
});