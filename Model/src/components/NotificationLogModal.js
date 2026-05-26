import React, { useState, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

// Hàm định dạng thời gian chuẩn (VD: 09:30 - 06/04/2026)
const formatDateTime = (dateString) => {
    if (!dateString) return '--:--';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${time} - ${date}`;
};

export default function NotificationLogModal({ isOpen, onClose, notifications = [] }) {
  const [filter, setFilter] = useState('ALL'); // ALL, URGENT, NORMAL

  // 🌟 THUẬT TOÁN LỌC VÀ SẮP XẾP (Mới nhất lên đầu)
  const displayNotifs = useMemo(() => {
      let filtered = notifications;
      if (filter === 'URGENT') {
          filtered = notifications.filter(n => n.type === 'URGENT_UPDATE');
      } else if (filter === 'NORMAL') {
          filtered = notifications.filter(n => n.type !== 'URGENT_UPDATE');
      }
      
      // Sắp xếp giảm dần theo thời gian tạo
      return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [notifications, filter]);

  const urgentCount = notifications.filter(n => n.type === 'URGENT_UPDATE').length;

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          
          {/* HEADER */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.iconBox}>
                  <Feather name="bell" size={20} color="#2563eb" />
              </View>
              <View>
                  <Text style={styles.title}>Trung Tâm Thông Báo</Text>
                  <Text style={styles.subTitle}>Nhật ký sự kiện và cảnh báo hệ thống</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* BỘ LỌC (FILTERS) */}
          <View style={styles.filterContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                  <TouchableOpacity 
                      style={[styles.filterChip, filter === 'ALL' && styles.filterChipActive]} 
                      onPress={() => setFilter('ALL')}
                  >
                      <Text style={[styles.filterText, filter === 'ALL' && styles.filterTextActive]}>Tất cả ({notifications.length})</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                      style={[styles.filterChip, filter === 'URGENT' && styles.filterChipUrgent]} 
                      onPress={() => setFilter('URGENT')}
                  >
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                          {urgentCount > 0 && <View style={styles.urgentDot} />}
                          <Text style={[styles.filterText, filter === 'URGENT' && styles.filterTextUrgent]}>Khẩn cấp ({urgentCount})</Text>
                      </View>
                  </TouchableOpacity>

                  <TouchableOpacity 
                      style={[styles.filterChip, filter === 'NORMAL' && styles.filterChipActive]} 
                      onPress={() => setFilter('NORMAL')}
                  >
                      <Text style={[styles.filterText, filter === 'NORMAL' && styles.filterTextActive]}>Hệ thống ({notifications.length - urgentCount})</Text>
                  </TouchableOpacity>
              </ScrollView>
          </View>
          
          {/* DANH SÁCH THÔNG BÁO */}
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {displayNotifs.length === 0 ? (
              <View style={styles.emptyState}>
                  <Feather name="inbox" size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>Chưa có thông báo nào trong mục này.</Text>
              </View>
            ) : (
              displayNotifs.map(notif => {
                  const isUrgent = notif.type === 'URGENT_UPDATE';
                  return (
                    <View key={notif.id} style={[styles.notifCard, isUrgent ? styles.bgUrgent : styles.bgNormal]}>
                        
                        <View style={styles.cardIcon}>
                            <Feather name={isUrgent ? "alert-triangle" : "info"} size={18} color={isUrgent ? '#ea580c' : '#2563eb'} />
                        </View>

                        <View style={styles.cardContent}>
                            <View style={styles.notifHeader}>
                                <Text style={[styles.notifTitle, isUrgent ? {color: '#9a3412'} : {color: '#1e3a8a'}]} numberOfLines={1}>
                                    {notif.title}
                                </Text>
                                <Text style={styles.timeText}>{formatDateTime(notif.createdAt)}</Text>
                            </View>
                            
                            <Text style={styles.bodyText}>{notif.body}</Text>
                            
                            {notif.targetAudiences && notif.targetAudiences.length > 0 && (
                                <View style={styles.targetBadge}>
                                    <Feather name="users" size={10} color="#64748b" />
                                    <Text style={styles.targetText}>Gửi đến: {notif.targetAudiences.join(', ')}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                  );
              })
            )}
            <View style={{ height: 20 }} />
          </ScrollView>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { 
      flex: 1, 
      backgroundColor: 'rgba(15, 23, 42, 0.6)', // Tối màu nền hơn một chút để nổi bật Modal
      justifyContent: 'center', 
      alignItems: 'center', 
      padding: Platform.OS === 'web' ? 40 : 20 
  },
  modalContainer: { 
      backgroundColor: '#fff', 
      borderRadius: 16, 
      width: '100%', 
      maxWidth: 550, 
      maxHeight: '85%', 
      overflow: 'hidden',
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 20
  },
  
  // Header
  header: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      backgroundColor: '#fff', 
      padding: 20, 
      borderBottomWidth: 1, 
      borderColor: '#f1f5f9' 
  },
  iconBox: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: '#eff6ff',
      justifyContent: 'center',
      alignItems: 'center'
  },
  title: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  subTitle: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', marginTop: 2 },
  closeBtn: { padding: 8, backgroundColor: '#f8fafc', borderRadius: 20 },

  // Filters
  filterContainer: {
      backgroundColor: '#f8fafc',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderColor: '#e2e8f0'
  },
  filterScroll: { paddingHorizontal: 20, gap: 10 },
  filterChip: { 
      paddingHorizontal: 16, 
      paddingVertical: 8, 
      borderRadius: 20, 
      backgroundColor: '#fff', 
      borderWidth: 1, 
      borderColor: '#cbd5e1' 
  },
  filterChipActive: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
  filterChipUrgent: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  filterText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  filterTextActive: { color: '#fff' },
  filterTextUrgent: { color: '#dc2626' },
  urgentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#dc2626' },

  // List
  scrollArea: { padding: 20 },
  emptyState: { alignItems: 'center', marginTop: 60, padding: 20 },
  emptyText: { fontFamily: 'Times New Roman', textAlign: 'center', color: '#94a3b8', fontSize: 14, fontStyle: 'italic', marginTop: 12 },
  
  // Cards
  notifCard: { 
      flexDirection: 'row',
      padding: 16, 
      borderRadius: 12, 
      borderWidth: 1, 
      marginBottom: 12 
  },
  bgUrgent: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  bgNormal: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  
  cardIcon: { marginRight: 16, marginTop: 2 },
  cardContent: { flex: 1 },
  
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  notifTitle: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', flex: 1, paddingRight: 10 },
  timeText: { fontFamily: 'Courier New', fontSize: 11, fontWeight: 'bold', color: '#94a3b8' },
  
  bodyText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 10 },
  
  targetBadge: { 
      alignSelf: 'flex-start',
      flexDirection: 'row', 
      alignItems: 'center', 
      gap: 4, 
      backgroundColor: 'rgba(255,255,255,0.6)', 
      paddingHorizontal: 8, 
      paddingVertical: 4, 
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.05)'
  },
  targetText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b' }
});