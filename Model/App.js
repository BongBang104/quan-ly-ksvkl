import React, { useState, useContext } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, ScrollView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppProvider, AppContext } from './src/context/AppContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import SchedulerScreen from './src/screens/SchedulerScreen';
import TeamsScreen from './src/screens/TeamsScreen';
import ManagerDataScreen from './src/screens/ManagerDataScreen';
import StatsScreen from './src/screens/StatsScreen';
import TasksScreen from './src/screens/TasksScreen';
import AccountManagerScreen from './src/screens/AccountManagerScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotificationLogModal from './src/components/NotificationLogModal'; 

// 🌟 THÊM MỚI: Import Banner xin quyền thông báo chạy ngầm
import NotificationPermissionBanner from './src/components/NotificationPermissionBanner';

function MainApp() {
  const {
      isLoading, currentUser, setCurrentUser, handleLogout,
      settings, setSettings, employees, setEmployees,
      activities, setActivities, requests, setRequests,
      scheduleData, setScheduleData, extraAssignments, setExtraAssignments,
      isPublished, setIsPublished, addNotification, handleUpdateEmployeeId,
      notifications, isNotifOpen, setIsNotifOpen 
  } = useContext(AppContext);

  const [activeTab, setActiveTab] = useState('DASHBOARD');

  const performLogout = () => {
      handleLogout();
      setActiveTab('DASHBOARD');
  };

  const getNavItems = () => {
      const role = currentUser?.role || 'STAFF';
      const allMenus = [
          { id: 'DASHBOARD', icon: 'home', label: 'Tổng quan' },
          { id: 'SCHEDULER', icon: 'calendar', label: 'Phân ca' },
          { id: 'TEAMS', icon: 'users', label: 'Quản lý' },
          { id: 'TASKS', icon: 'clipboard', label: 'Nhiệm vụ' },
          { id: 'STATS', icon: 'bar-chart-2', label: 'Thống kê' },
          { id: 'MANAGER_DATA', icon: 'database', label: 'Nhân sự' },
          { id: 'ACCOUNTS', icon: 'shield', label: 'Tài khoản' },
          { id: 'SETTINGS', icon: 'settings', label: 'Cài đặt' }
      ];

      // Phân quyền hiển thị Menu: Admin thấy hết, Staff/Leader chỉ thấy 4 tab cơ bản
      if (role === 'ADMIN') return allMenus;
      return allMenus.filter(m => ['DASHBOARD', 'SCHEDULER', 'TEAMS', 'TASKS'].includes(m.id));
  };

  const renderScreen = () => {
      const commonProps = { 
          employees, setEmployees, 
          settings, setSettings, 
          activities, setActivities, 
          addNotification, 
          requests, setRequests, 
          currentUser 
      };
      
      switch (activeTab) {
          case 'DASHBOARD': return <DashboardScreen {...commonProps} scheduleData={scheduleData} extraAssignments={extraAssignments} smsReports={[]} />;
          case 'SCHEDULER': return <SchedulerScreen {...commonProps} scheduleData={scheduleData} setScheduleData={setScheduleData} extraAssignments={extraAssignments} setExtraAssignments={setExtraAssignments} isPublished={isPublished} setIsPublished={setIsPublished} />;
          case 'TEAMS': return <TeamsScreen {...commonProps} scheduleData={scheduleData} extraAssignments={extraAssignments} />;
          case 'MANAGER_DATA': return <ManagerDataScreen {...commonProps} onUpdateEmployeeId={handleUpdateEmployeeId} />;
          case 'STATS': return <StatsScreen {...commonProps} scheduleData={scheduleData} />;
          case 'TASKS': return <TasksScreen {...commonProps} />;
          case 'ACCOUNTS': return <AccountManagerScreen employees={employees} setEmployees={setEmployees} settings={settings} />;
          case 'SETTINGS': return <SettingsScreen settings={settings} setSettings={setSettings} currentUser={currentUser} />;
          default: return <DashboardScreen {...commonProps} scheduleData={scheduleData} extraAssignments={extraAssignments} />;
      }
  };
  if (isLoading) {
      return (
          <View style={styles.centerScreen}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Đang tải hệ thống ATC PRO...</Text>
          </View>
      );
  }

  if (!currentUser) {
      return <LoginScreen employees={employees} setEmployees={setEmployees} settings={settings} onLogin={(user) => { setCurrentUser(user); setActiveTab('DASHBOARD'); }} />;
  }

  return (
      <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle={Platform.OS === 'web' ? "dark-content" : "light-content"} backgroundColor="#1e293b" />
          <View style={styles.appContainer}>
              
              {Platform.OS === 'web' ? (
                  // ==========================================
                  // BỐ CỤC WEB: SIDEBAR CĂN TRÁI CHUẨN UX
                  // ==========================================
                  <>
                      <View style={styles.sidebar}>
                          <View style={styles.logoBox}>
                              <View style={styles.logoIcon}><Feather name="radio" size={20} color="#2563eb" /></View>
                              <Text style={styles.logoText}>ATC PRO</Text>
                          </View>

                          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.navScroll}>
                              {getNavItems().map(item => {
                                  const isActive = activeTab === item.id;
                                  return (
                                      <TouchableOpacity key={item.id} style={[styles.navItem, isActive && styles.navItemActive]} onPress={() => setActiveTab(item.id)}>
                                          <View style={{width: 24, alignItems: 'center'}}>
                                              <Feather name={item.icon} size={18} color={isActive ? '#fff' : '#94a3b8'} />
                                          </View>
                                          <Text style={[styles.navText, isActive && styles.navTextActive]}>{item.label}</Text>
                                      </TouchableOpacity>
                                  );
                              })}

                              <TouchableOpacity 
                                  style={[styles.navItem, isNotifOpen && styles.navItemActive]} 
                                  onPress={() => setIsNotifOpen(true)}
                              >
                                  <View style={{width: 24, alignItems: 'center'}}>
                                      <Feather name="bell" size={18} color={isNotifOpen ? '#fff' : '#94a3b8'} />
                                      {notifications.length > 0 && (
                                          <View style={[styles.navBellBadge, isNotifOpen && {borderColor: '#2563eb'}]}>
                                              <Text style={styles.navBellBadgeText}>{notifications.length > 99 ? '99+' : notifications.length}</Text>
                                          </View>
                                      )}
                                  </View>
                                  <Text style={[styles.navText, isNotifOpen && styles.navTextActive]}>Thông báo</Text>
                              </TouchableOpacity>
                          </ScrollView>

                          <View style={styles.userBox}>
                              <View style={styles.avatar}><Text style={styles.avatarText}>{currentUser.name?.charAt(0).toUpperCase() || 'U'}</Text></View>
                              <View style={styles.userInfo}>
                                  <Text style={styles.userName} numberOfLines={1}>{currentUser.name}</Text>
                                  <Text style={styles.userRole}>{currentUser.role === 'ADMIN' ? 'Quản trị viên' : (currentUser.role === 'LEADER' ? 'Kíp trưởng' : 'Nhân sự')}</Text>
                              </View>
                              <TouchableOpacity style={styles.btnLogout} onPress={performLogout}><Feather name="log-out" size={16} color="#ef4444" /></TouchableOpacity>
                          </View>
                      </View>

                      <View style={styles.contentArea}>
                          {renderScreen()}
                          <NotificationLogModal isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} notifications={notifications} />
                      </View>
                  </>
              ) : (
                  // ==========================================
                  // BỐ CỤC MOBILE: BOTTOM NAV GIỮ NGUYÊN
                  // ==========================================
                  <>
                      <View style={styles.contentArea}>
                          {renderScreen()}
                          <NotificationLogModal isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} notifications={notifications} />
                      </View>

                      <View style={styles.sidebar}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navScroll}>
                              {getNavItems().map(item => {
                                  const isActive = activeTab === item.id;
                                  return (
                                      <TouchableOpacity key={item.id} style={[styles.navItem, isActive && styles.navItemActive]} onPress={() => setActiveTab(item.id)}>
                                          <Feather name={item.icon} size={22} color={isActive ? '#fff' : '#94a3b8'} />
                                      </TouchableOpacity>
                                  );
                              })}

                              <TouchableOpacity style={[styles.navItem, isNotifOpen && styles.navItemActive]} onPress={() => setIsNotifOpen(true)}>
                                  <View>
                                      <Feather name="bell" size={22} color={isNotifOpen ? '#fff' : '#94a3b8'} />
                                      {notifications.length > 0 && (
                                          <View style={[styles.navBellBadge, isNotifOpen && {borderColor: '#2563eb'}]}>
                                              <Text style={styles.navBellBadgeText}>{notifications.length > 99 ? '99+' : notifications.length}</Text>
                                          </View>
                                      )}
                                  </View>
                              </TouchableOpacity>

                              <TouchableOpacity style={styles.navItem} onPress={performLogout}>
                                  <Feather name="log-out" size={22} color="#ef4444" />
                              </TouchableOpacity>
                          </ScrollView>
                      </View>
                  </>
              )}

              {/* 🌟 THÊM MỚI: Đặt Banner Xin quyền thông báo ngay Cổng chính (App.js) */}
              <NotificationPermissionBanner />

          </View>
      </SafeAreaView>
  );
}

export default function App() {
    return (
        <AppProvider>
            <MainApp />
        </AppProvider>
    );
}

const styles = StyleSheet.create({
  safeArea: { 
      flex: 1, 
      backgroundColor: '#1e293b',
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 
  },
  centerScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#64748b', marginTop: 15, fontStyle: 'italic' },
  appContainer: { flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column', backgroundColor: '#f1f5f9' },
  
  // Tối ưu Sidebar Web: Độ rộng 220px chuẩn SaaS Dashboard
  sidebar: { 
      width: Platform.OS === 'web' ? 220 : '100%', 
      backgroundColor: '#1e293b', 
      paddingTop: Platform.OS === 'web' ? 24 : 10, 
      paddingBottom: Platform.OS === 'web' ? 0 : 10, 
      flexDirection: Platform.OS === 'web' ? 'column' : 'row', 
      borderRightWidth: Platform.OS === 'web' ? 1 : 0, 
      borderTopWidth: Platform.OS === 'web' ? 0 : 1, 
      borderColor: '#0f172a',
      justifyContent: 'center',
      elevation: Platform.OS === 'web' ? 5 : 10,
      zIndex: 50
  },
  
  logoBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 24, display: Platform.OS === 'web' ? 'flex' : 'none' },
  logoIcon: { backgroundColor: '#e0f2fe', padding: 6, borderRadius: 8, marginRight: 10 },
  logoText: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  
  navScroll: { 
      paddingHorizontal: 12, 
      gap: Platform.OS === 'web' ? 4 : 12, 
      flexDirection: Platform.OS === 'web' ? 'column' : 'row',
      alignItems: Platform.OS === 'web' ? 'stretch' : 'center' 
  },
  
  navItem: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: Platform.OS === 'web' ? 'flex-start' : 'center',
      paddingVertical: Platform.OS === 'web' ? 10 : 12, 
      paddingHorizontal: Platform.OS === 'web' ? 12 : 14, 
      borderRadius: 8, 
      marginBottom: Platform.OS === 'web' ? 4 : 0, 
      marginRight: Platform.OS === 'web' ? 0 : 4 
  },
  navItemActive: { backgroundColor: '#2563eb' },
  navText: { 
      fontFamily: 'Times New Roman', 
      fontSize: 14, 
      color: '#94a3b8', 
      marginLeft: 10, 
      fontWeight: 'bold', 
      display: Platform.OS === 'web' ? 'flex' : 'none' 
  },
  navTextActive: { color: '#fff' },
  
  navBellBadge: { 
      position: 'absolute', top: -6, right: -10, 
      backgroundColor: '#ef4444', minWidth: 16, height: 16, 
      borderRadius: 8, justifyContent: 'center', alignItems: 'center', 
      borderWidth: 2, borderColor: '#1e293b', paddingHorizontal: 2 
  },
  navBellBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold', fontFamily: 'Times New Roman' },

  userBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderColor: '#0f172a', backgroundColor: '#0f172a', marginTop: 'auto', display: Platform.OS === 'web' ? 'flex' : 'none' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#fff' },
  userInfo: { flex: 1 },
  userName: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#f8fafc' },
  userRole: { fontFamily: 'Times New Roman', fontSize: 11, color: '#94a3b8', marginTop: 2 },
  btnLogout: { padding: 8, backgroundColor: '#450a0a', borderRadius: 8 },
  
  contentArea: { flex: 1, backgroundColor: '#f1f5f9', overflow: 'hidden' }
});