import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function EmployeeProfile({ employee, onBack, onEdit }) {
  if (!employee) return null;

  // Hàm kiểm tra tình trạng hạn
  const getExpiryStatus = (dateStr) => {
    if (!dateStr) return { text: 'Chưa cập nhật', color: '#94a3b8', bg: '#f1f5f9', icon: 'help-circle' };
    const d = new Date(dateStr);
    const diff = d - new Date();
    const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return { text: `Đã hết hạn (${dateStr})`, color: '#dc2626', bg: '#fef2f2', icon: 'x-circle' };
    if (daysLeft <= 30) return { text: `Sắp hết hạn (${dateStr})`, color: '#d97706', bg: '#fffbeb', icon: 'alert-triangle' };
    return { text: `An toàn (${dateStr})`, color: '#16a34a', bg: '#f0fdf4', icon: 'check-circle' };
  };

  const engStatus = getExpiryStatus(employee.englishExp);
  const healthStatus = getExpiryStatus(employee.healthExp);

  return (
    <View style={styles.container}>
      {/* THANH ĐIỀU HƯỚNG */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navBtn} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#1e293b" />
          <Text style={styles.navText}>Quay lại</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(employee)}>
          <Feather name="edit-2" size={16} color="#fff" />
          <Text style={styles.editBtnText}>Chỉnh sửa</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* KHỐI HEADER (COVER & AVATAR) */}
        <View style={styles.profileHeader}>
          <View style={styles.coverPhoto}></View>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, employee.isChief && styles.avatarChief]}>
              <Text style={[styles.avatarText, employee.isChief && {color: '#854d0e'}]}>{employee.id}</Text>
            </View>
          </View>
          
          <View style={styles.nameSection}>
            <Text style={styles.empName}>{employee.name}</Text>
            <Text style={styles.empRole}>{employee.position} • {employee.team}</Text>
            
            <View style={styles.badgeRow}>
              <View style={styles.badge}><Text style={styles.badgeText}>{employee.qualification}</Text></View>
              {employee.isChief && <View style={[styles.badge, styles.badgeChief]}><Feather name="star" size={12} color="#854d0e"/><Text style={styles.badgeTextChief}> Kíp trưởng</Text></View>}
              {employee.isVip && <View style={[styles.badge, styles.badgeVip]}><Text style={styles.badgeTextVip}>Chuyên cơ</Text></View>}
            </View>
          </View>
        </View>

        {/* KHỐI THÔNG TIN LIÊN HỆ */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Thông tin Cá nhân</Text>
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Feather name="phone" size={16} color="#64748b" /></View>
            <View>
              <Text style={styles.infoLabel}>Số điện thoại</Text>
              <Text style={styles.infoValue}>{employee.phone || 'Chưa cập nhật'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Feather name="calendar" size={16} color="#64748b" /></View>
            <View>
              <Text style={styles.infoLabel}>Ngày sinh</Text>
              <Text style={styles.infoValue}>{employee.dob || 'Chưa cập nhật'}</Text>
            </View>
          </View>
        </View>

        {/* KHỐI CHUYÊN MÔN & GIẤY PHÉP */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Chứng chỉ & Giấy phép</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Feather name="award" size={16} color="#64748b" /></View>
            <View>
              <Text style={styles.infoLabel}>Số giấy phép KSVKL</Text>
              <Text style={styles.infoValueBold}>{employee.licenseNo || 'Chưa cập nhật'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Feather name="globe" size={16} color="#64748b" /></View>
            <View style={styles.flex1}>
              <Text style={styles.infoLabel}>Tiếng Anh Hàng không</Text>
              <View style={[styles.statusBadge, {backgroundColor: engStatus.bg}]}>
                <Feather name={engStatus.icon} size={14} color={engStatus.color} />
                <Text style={[styles.statusText, {color: engStatus.color}]}>{engStatus.text}</Text>
              </View>
            </View>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Feather name="heart" size={16} color="#64748b" /></View>
            <View style={styles.flex1}>
              <Text style={styles.infoLabel}>Khám Sức khỏe</Text>
              <View style={[styles.statusBadge, {backgroundColor: healthStatus.bg}]}>
                <Feather name={healthStatus.icon} size={14} color={healthStatus.color} />
                <Text style={[styles.statusText, {color: healthStatus.color}]}>{healthStatus.text}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{height: 40}}/>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0', zIndex: 10 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navText: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  editBtnText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#fff' },
  
  scrollArea: { flex: 1 },
  
  profileHeader: { backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0', marginBottom: 16, paddingBottom: 20 },
  coverPhoto: { height: 100, backgroundColor: '#1e293b' },
  avatarContainer: { alignItems: 'center', marginTop: -40 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#fff', elevation: 4 },
  avatarChief: { backgroundColor: '#fef08a' },
  avatarText: { fontFamily: 'Times New Roman', fontSize: 24, fontWeight: 'bold', color: '#3730a3' },
  nameSection: { alignItems: 'center', marginTop: 12 },
  empName: { fontFamily: 'Times New Roman', fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  empRole: { fontFamily: 'Times New Roman', fontSize: 14, color: '#64748b', marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  badge: { backgroundColor: '#f1f5f9', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  badgeText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#475569' },
  badgeChief: { backgroundColor: '#fef9c3', flexDirection: 'row', alignItems: 'center' },
  badgeTextChief: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#854d0e' },
  badgeVip: { backgroundColor: '#f3e8ff' },
  badgeTextVip: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#6b21a8' },

  infoCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  cardTitle: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginBottom: 16, borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  flex1: { flex: 1 },
  infoLabel: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', marginBottom: 2 },
  infoValue: { fontFamily: 'Times New Roman', fontSize: 15, color: '#1e293b', fontWeight: '500' },
  infoValueBold: { fontFamily: 'Times New Roman', fontSize: 15, color: '#1e293b', fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12, marginLeft: 48 },
  
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginTop: 4, alignSelf: 'flex-start' },
  statusText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold' }
});