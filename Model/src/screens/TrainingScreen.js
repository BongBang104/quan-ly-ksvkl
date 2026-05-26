import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function TrainingScreen({ employees = [], settings, activities = [], addNotification }) {
  const staffEmployees = useMemo(() => {
      return employees.filter(emp => emp.team !== 'Ban Giám Đốc' && !emp.position?.toLowerCase().includes('lãnh đạo'));
  }, [employees]);

  const simulatedUsers = [
      { id: 'ADMIN_01', name: 'Giám đốc Trung tâm', position: 'Lãnh đạo Trung tâm', team: 'Ban Giám Đốc', isChief: true },
      ...staffEmployees
  ];
  const [currentUser, setCurrentUser] = useState(simulatedUsers[0]);
  const isCenterManager = currentUser?.position?.toLowerCase().includes('lãnh đạo');
  const isTeamManager = currentUser?.isChief || currentUser?.position?.toLowerCase().includes('trưởng');

  const [activeTab, setActiveTab] = useState('PROFILES'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState(staffEmployees.length > 0 ? staffEmployees[0].id : null);
  const [selectedCourseId, setSelectedCourseId] = useState('c1');

  // CUSTOM CONFIRM DIALOG 
  const [confirmDialog, setConfirmDialog] = useState({ visible: false, title: '', msg: '', onConfirm: null, confirmText: 'Đóng', isWarning: false });

  const showMsg = (title, msg, onConfirm = null, isWarning = false, confirmText = 'Đóng') => {
      setConfirmDialog({ visible: true, title, msg, onConfirm, isWarning, confirmText });
  };

  const [profileStats, setProfileStats] = useState(() => {
      const initial = {};
      staffEmployees.forEach(emp => {
          initial[emp.id] = { englishLevel: 'Mức 4', englishExp: `2026-12-31`, simStatus: 'Chưa đánh giá' };
      });
      return initial;
  });

  const [courses, setCourses] = useState([
      { 
          id: 'c1', name: 'Huấn luyện Năng định kỳ 1/2026', type: 'Định kỳ', 
          startDate: '2026-03-01', endDate: '2026-03-31',
          assignments: [
              { id: 'a1', targetType: 'TEAM', targetValue: 'Kíp A', dates: ['2026-03-16', '2026-03-18'] },
              { id: 'a2', targetType: 'TEAM', targetValue: 'Kíp B', dates: ['2026-03-17', '2026-03-19'] }
          ],
          attendance: {}
      }
  ]);

  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [statsFormData, setStatsFormData] = useState({});
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [courseFormData, setCourseFormData] = useState({ id: '', name: '', type: 'Định kỳ', startDate: '', endDate: '' });
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignFormData, setAssignFormData] = useState({ targetType: 'TEAM', targetValue: settings?.teams?.[1] || '', dates: '' });

  // TÍNH TOÁN TIẾN ĐỘ CHUNG
  const calculateProgress = (empId) => {
      const emp = staffEmployees.find(e => e.id === empId);
      if (!emp) return 0;
      let expectedDays = 0, attendedDays = 0;

      courses.forEach(course => {
          let assignedDates = new Set();
          course.assignments.forEach(assign => {
              if ((assign.targetType === 'TEAM' && assign.targetValue === emp.team) || (assign.targetType === 'EMP' && assign.targetValue === emp.id)) {
                  assign.dates.forEach(d => assignedDates.add(d));
              }
          });
          expectedDays += assignedDates.size;
          assignedDates.forEach(date => {
              const attKey = `${date}_${emp.id}`;
              if (course.attendance[attKey] && course.attendance[attKey].startsWith('Có mặt')) attendedDays++;
          });
      });

      if (expectedDays === 0) return 100; 
      return Math.round((attendedDays / expectedDays) * 100);
  };

  // LẤY DANH SÁCH CHI TIẾT TỪNG KHÓA HỌC CỦA NHÂN SỰ
  const getEmpCourses = (empId) => {
      const emp = staffEmployees.find(e => e.id === empId);
      if (!emp) return [];

      let empCourses = [];

      courses.forEach(course => {
          let assignedDates = new Set();
          course.assignments.forEach(assign => {
              if ((assign.targetType === 'TEAM' && assign.targetValue === emp.team) ||
                  (assign.targetType === 'EMP' && assign.targetValue === emp.id)) {
                  assign.dates.forEach(d => assignedDates.add(d));
              }
          });

          if (assignedDates.size > 0) {
              let attendedDays = 0;
              let attendanceDetails = [];
              const sortedDates = Array.from(assignedDates).sort();

              sortedDates.forEach(date => {
                  const attKey = `${date}_${emp.id}`;
                  const status = course.attendance[attKey] || 'Chưa điểm danh';
                  if (status.startsWith('Có mặt')) attendedDays++;
                  attendanceDetails.push({ date, status });
              });

              empCourses.push({
                  id: course.id,
                  name: course.name,
                  type: course.type,
                  startDate: course.startDate,
                  endDate: course.endDate,
                  totalDays: assignedDates.size,
                  attendedDays: attendedDays,
                  progress: Math.round((attendedDays / assignedDates.size) * 100),
                  attendanceDetails
              });
          }
      });

      return empCourses;
  };

  const filteredStaff = useMemo(() => staffEmployees.filter(emp => emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || emp.id.toLowerCase().includes(searchTerm.toLowerCase())), [staffEmployees, searchTerm]);
  const activeEmp = useMemo(() => staffEmployees.find(e => e.id === selectedEmpId), [selectedEmpId, staffEmployees]);
  const activeCourse = useMemo(() => courses.find(c => c.id === selectedCourseId), [selectedCourseId, courses]);

  const getActivityLabel = (typeCode) => {
      const found = settings?.activityTypes?.find(t => t.id === typeCode);
      return found ? found.label : typeCode;
  };

  const saveStats = () => {
      setProfileStats(prev => ({ ...prev, [selectedEmpId]: statsFormData }));
      setIsStatsModalOpen(false); 
      showMsg('Thành công', 'Đã cập nhật dữ liệu Tiếng Anh và SIM.', null, false, 'Tuyệt vời');
  };

  const saveCourse = () => {
      if (!courseFormData.name || !courseFormData.startDate || !courseFormData.endDate) { 
          showMsg('Thiếu thông tin', 'Vui lòng điền đủ Tên khóa, Ngày bắt đầu và Ngày kết thúc.', null, true, 'Đã hiểu'); return; 
      }
      setCourses(prev => {
          if (courseFormData.id) return prev.map(c => c.id === courseFormData.id ? { ...c, ...courseFormData } : c);
          return [{ ...courseFormData, id: Date.now().toString(), assignments: [], attendance: {} }, ...prev];
      });
      setIsCourseModalOpen(false);
      showMsg('Thành công', 'Đã lưu thông tin Khóa huấn luyện.', null, false, 'Đóng');
  };

  const saveAssignment = () => {
      if (!assignFormData.dates.trim()) { showMsg('Thiếu thông tin', 'Vui lòng nhập ngày huấn luyện.', null, true, 'Đã hiểu'); return; }
      const datesArray = assignFormData.dates.split(',').map(d => d.trim()).filter(d => d);
      
      setCourses(prev => prev.map(c => {
          if (c.id === selectedCourseId) {
              return { ...c, assignments: [...c.assignments, { id: Date.now().toString(), targetType: assignFormData.targetType, targetValue: assignFormData.targetValue, dates: datesArray }] };
          }
          return c;
      }));
      setIsAssignModalOpen(false); 
      showMsg('Thành công', 'Đã phân lịch huấn luyện thành công.', null, false, 'Đóng');
  };

  const executeAttendance = (courseId, date, emp, status, courseName, warningMsg = null) => {
      setCourses(prev => prev.map(c => {
          if (c.id === courseId) {
              return { ...c, attendance: { ...c.attendance, [`${date}_${emp.id}`]: status } };
          }
          return c;
      }));

      if (addNotification) {
          const title = warningMsg ? 'Xác nhận: Tham gia huấn luyện khi đang nghỉ' : 'Cập nhật Điểm danh';
          const type = warningMsg ? 'warning' : 'info';
          const msg = warningMsg 
              ? `Quản lý kíp ${currentUser.name} xác nhận ${emp.name} "CÓ MẶT" tại lớp [${courseName}] ngày ${date}, MẶC DÙ đang có lịch [${warningMsg}]. Đã ghi nhận ngoại lệ.`
              : `Quản lý kíp ${currentUser.name} vừa điểm danh "${status}" cho ${emp.name} (Khóa: ${courseName} - Ngày: ${date}).`;
          addNotification(title, msg, type);
      }
  };

  const markAttendance = (courseId, date, empId, status) => {
      const course = courses.find(c => c.id === courseId);
      const emp = staffEmployees.find(e => e.id === empId);

      const overlappingActivity = activities.find(act => 
          act.empId === empId && 
          act.status !== 'REJECTED' && 
          act.type !== 'CHANGE' &&
          date >= act.startDate && 
          date <= (act.endDate || act.startDate)
      );

      if (overlappingActivity && status === 'Có mặt') {
          const actLabel = getActivityLabel(overlappingActivity.type);
          showMsg(
              'Xác nhận Điểm danh Ngoại lệ!',
              `Nhân sự ${emp.name} đang có ghi nhận "[${actLabel}]" vào ngày ${date}.\n\nBạn có chắc chắn người này VẪN CÓ MẶT tại buổi huấn luyện không?`,
              () => executeAttendance(courseId, date, emp, `Có mặt (${actLabel})`, course.name, actLabel),
              true,
              'Vẫn điểm danh'
          );
          return;
      }

      executeAttendance(courseId, date, emp, status, course.name);
  };

  return (
    <View style={styles.container}>
      
      <Modal visible={confirmDialog.visible} transparent animationType="fade">
          <View style={styles.confirmOverlay}>
              <View style={styles.confirmBox}>
                  <Text style={[styles.confirmTitle, confirmDialog.isWarning && {color: '#dc2626'}]}>{confirmDialog.title}</Text>
                  <Text style={styles.confirmMsg}>{confirmDialog.msg}</Text>
                  <View style={styles.confirmActions}>
                      {confirmDialog.onConfirm && (
                          <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#f1f5f9'}]} onPress={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}>
                              <Text style={[styles.confirmBtnText, {color: '#64748b'}]}>Hủy bỏ</Text>
                          </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: confirmDialog.isWarning ? '#ef4444' : '#2563eb'}]} onPress={() => {
                          if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                          setConfirmDialog(prev => ({ ...prev, visible: false }));
                      }}>
                          <Text style={[styles.confirmBtnText, {color: '#fff'}]}>{confirmDialog.confirmText}</Text>
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

      <View style={styles.userSimulator}>
          <Text style={styles.userSimLabel}><Feather name="user-check" size={12}/> Đang đóng vai:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{alignItems: 'center'}}>
              {simulatedUsers.map(emp => {
                  const isManager = emp.isChief || emp.position?.toLowerCase().includes('quản lý');
                  const isLD = emp.id === 'ADMIN_01';
                  return (
                      <TouchableOpacity key={emp.id} onPress={() => setCurrentUser(emp)} style={[styles.userSimChip, currentUser?.id === emp.id && styles.userSimChipActive, isLD && !currentUser?.id.includes('ADMIN') && {backgroundColor: '#fef3c7', borderColor: '#fde68a'}]}>
                          <Text style={[styles.userSimText, currentUser?.id === emp.id && styles.userSimTextActive, isLD && !currentUser?.id.includes('ADMIN') && {color: '#b45309'}]}>
                              {emp.name} {isManager && !isLD ? '(QL)' : ''}
                          </Text>
                      </TouchableOpacity>
                  );
              })}
          </ScrollView>
      </View>

      <View style={styles.topTabs}>
          <TouchableOpacity style={[styles.mainTab, activeTab === 'PROFILES' && styles.mainTabActive]} onPress={() => setActiveTab('PROFILES')}>
              <Feather name="user" size={16} color={activeTab === 'PROFILES' ? '#2563eb' : '#64748b'} />
              <Text style={[styles.mainTabText, activeTab === 'PROFILES' && styles.mainTabTextActive]}>HỒ SƠ TỪNG CÁ NHÂN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.mainTab, activeTab === 'COURSES' && styles.mainTabActive]} onPress={() => setActiveTab('COURSES')}>
              <Feather name="book-open" size={16} color={activeTab === 'COURSES' ? '#2563eb' : '#64748b'} />
              <Text style={[styles.mainTabText, activeTab === 'COURSES' && styles.mainTabTextActive]}>QUẢN LÝ KHÓA HỌC & ĐIỂM DANH</Text>
          </TouchableOpacity>
      </View>

      <View style={styles.mainLayout}>
          
          <View style={styles.leftColumn}>
              <View style={styles.leftHeader}>
                  <Text style={styles.leftTitle}>{activeTab === 'PROFILES' ? 'Nhân Sự Huấn Luyện' : 'Danh Sách Khóa Học'}</Text>
                  {activeTab === 'PROFILES' && (
                      <View style={styles.searchWrapper}>
                          <Feather name="search" size={14} color="#94a3b8" />
                          <TextInput style={styles.searchInputSmall} placeholder="Tìm nhân sự..." value={searchTerm} onChangeText={setSearchTerm} />
                      </View>
                  )}
                  {(activeTab === 'COURSES' && isCenterManager) && (
                      <TouchableOpacity style={styles.btnAddSmall} onPress={() => { setCourseFormData({ id: '', name: '', type: 'Định kỳ', startDate: '', endDate: '' }); setIsCourseModalOpen(true); }}>
                          <Feather name="plus" size={12} color="#fff" /><Text style={styles.btnAddSmallText}>Tạo Khóa</Text>
                      </TouchableOpacity>
                  )}
              </View>
              
              <ScrollView showsVerticalScrollIndicator={false} style={styles.listArea}>
                  {activeTab === 'PROFILES' ? (
                      filteredStaff.map(emp => {
                          const isActive = selectedEmpId === emp.id;
                          return (
                              <TouchableOpacity key={emp.id} style={[styles.listItem, isActive && styles.listItemActive]} onPress={() => setSelectedEmpId(emp.id)}>
                                  <View style={[styles.listAvatar, isActive && {backgroundColor: '#2563eb'}]}><Text style={[styles.listAvatarText, isActive && {color: '#fff'}]}>{emp.name.charAt(0)}</Text></View>
                                  <View style={{flex: 1}}>
                                      <Text style={[styles.listTitle, isActive && {color: '#1e293b'}]} numberOfLines={1}>{emp.name}</Text>
                                      <Text style={styles.listSub}>{emp.id} - {emp.team}</Text>
                                  </View>
                              </TouchableOpacity>
                          );
                      })
                  ) : (
                      courses.map(course => {
                          const isActive = selectedCourseId === course.id;
                          return (
                              <TouchableOpacity key={course.id} style={[styles.listItem, isActive && styles.listItemActive]} onPress={() => setSelectedCourseId(course.id)}>
                                  <View style={[styles.listAvatar, {backgroundColor: '#f1f5f9'}, isActive && {backgroundColor: '#dbeafe'}]}><Feather name="bookmark" size={14} color={isActive ? '#2563eb' : '#64748b'} /></View>
                                  <View style={{flex: 1}}>
                                      <Text style={[styles.listTitle, isActive && {color: '#1e293b'}]} numberOfLines={2}>{course.name}</Text>
                                      <Text style={styles.listSub}>{course.startDate} đến {course.endDate}</Text>
                                  </View>
                              </TouchableOpacity>
                          );
                      })
                  )}
              </ScrollView>
          </View>

          <View style={styles.rightColumn}>
              {activeTab === 'PROFILES' ? (
                  activeEmp ? (
                      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding: 20}}>
                          <View style={styles.profileHeader}>
                              <View style={styles.profileAvatarLg}><Text style={styles.profileAvatarTextLg}>{activeEmp.name.charAt(0)}</Text></View>
                              <View style={{flex: 1}}>
                                  <Text style={styles.profileName}>{activeEmp.name}</Text>
                                  <View style={styles.tagsRow}>
                                      <View style={styles.tag}><Text style={styles.tagText}>{activeEmp.id}</Text></View>
                                      <View style={styles.tag}><Text style={styles.tagText}>{activeEmp.team}</Text></View>
                                      <View style={styles.tag}><Text style={styles.tagText}>{activeEmp.position}</Text></View>
                                  </View>
                              </View>
                              {isCenterManager && (
                                  <TouchableOpacity style={styles.btnEditOutline} onPress={() => { setStatsFormData({...profileStats[activeEmp.id]}); setIsStatsModalOpen(true); }}>
                                      <Feather name="edit-3" size={14} color="#2563eb" /><Text style={styles.btnEditOutlineText}>Sửa TA/SIM</Text>
                                  </TouchableOpacity>
                              )}
                          </View>

                          <View style={styles.statsGrid}>
                              <View style={styles.statBox}>
                                  <View style={styles.statIconBox}><Feather name="mic" size={16} color="#d97706" /></View>
                                  <View>
                                      <Text style={styles.statBoxLabel}>Tiếng Anh ICAO</Text>
                                      <Text style={styles.statBoxValue}>{profileStats[activeEmp.id]?.englishLevel}</Text>
                                      <Text style={styles.statBoxSub}>Hạn: {profileStats[activeEmp.id]?.englishExp}</Text>
                                  </View>
                              </View>
                              <View style={styles.statBox}>
                                  <View style={[styles.statIconBox, {backgroundColor: '#e0e7ff'}]}><Feather name="monitor" size={16} color="#4f46e5" /></View>
                                  <View>
                                      <Text style={styles.statBoxLabel}>Kết quả SIM</Text>
                                      <Text style={[styles.statBoxValue, {color: '#4f46e5'}]}>{profileStats[activeEmp.id]?.simStatus}</Text>
                                  </View>
                              </View>
                              <View style={styles.statBox}>
                                  <View style={[styles.statIconBox, {backgroundColor: '#dcfce7'}]}><Feather name="bar-chart" size={16} color="#16a34a" /></View>
                                  <View style={{flex: 1}}>
                                      <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                          <Text style={styles.statBoxLabel}>Tiến độ Tổng</Text>
                                          <Text style={[styles.statBoxValue, {color: '#16a34a'}]}>{calculateProgress(activeEmp.id)}%</Text>
                                      </View>
                                      <View style={styles.progressWrap}>
                                          <View style={[styles.progressBar, {width: `${calculateProgress(activeEmp.id)}%`}]} />
                                      </View>
                                  </View>
                              </View>
                          </View>

                          {/* CHI TIẾT CÁC KHÓA HUẤN LUYỆN */}
                          <View style={styles.courseProgressSection}>
                              <Text style={styles.sectionTitle}>CHI TIẾT CÁC KHÓA HUẤN LUYỆN ĐƯỢC GIAO</Text>
                              
                              {getEmpCourses(activeEmp.id).length === 0 ? (
                                  <Text style={styles.emptyTextLine}>Nhân sự này chưa được phân bổ vào khóa huấn luyện nào.</Text>
                              ) : (
                                  getEmpCourses(activeEmp.id).map(course => (
                                      <View key={course.id} style={styles.empCourseCard}>
                                          <View style={styles.empCourseHeader}>
                                              <View style={{flex: 1}}>
                                                  <Text style={styles.empCourseName}>{course.name}</Text>
                                                  <Text style={styles.empCourseSub}>Loại: {course.type} • Tới {course.endDate}</Text>
                                              </View>
                                              <View style={styles.empCourseProgressText}>
                                                  <Text style={styles.empCourseProgressValue}>{course.progress}%</Text>
                                                  <Text style={styles.empCourseProgressFraction}>{course.attendedDays}/{course.totalDays} buổi</Text>
                                              </View>
                                          </View>
                                          <View style={styles.progressWrap}>
                                              <View style={[styles.progressBar, {width: `${course.progress}%`, backgroundColor: course.progress === 100 ? '#16a34a' : '#3b82f6'}]} />
                                          </View>

                                          {/* LỊCH SỬ ĐIỂM DANH MINI */}
                                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attDetailRow}>
                                              {course.attendanceDetails.map(att => {
                                                  let badgeColor = '#f1f5f9'; let textColor = '#64748b'; let icon = '-';
                                                  if (att.status.startsWith('Có mặt')) { badgeColor = '#dcfce7'; textColor = '#16a34a'; icon = '✔'; }
                                                  else if (att.status === 'Vắng') { badgeColor = '#fee2e2'; textColor = '#dc2626'; icon = '✖'; }
                                                  else if (att.status === 'Có phép') { badgeColor = '#fef3c7'; textColor = '#d97706'; icon = 'P'; }

                                                  return (
                                                      <View key={att.date} style={[styles.attDetailBadge, {backgroundColor: badgeColor}]}>
                                                          <Text style={[styles.attDetailDate, {color: textColor}]}>{att.date.split('-').slice(1).join('/')}</Text>
                                                          <Text style={[styles.attDetailStatus, {color: textColor}]}>{icon}</Text>
                                                      </View>
                                                  )
                                              })}
                                          </ScrollView>
                                      </View>
                                  ))
                              )}
                          </View>

                      </ScrollView>
                  ) : (<View style={styles.emptyView}><Text style={styles.emptyText}>Chọn nhân sự để xem hồ sơ</Text></View>)
              ) : (
                  activeCourse ? (
                      <ScrollView showsVerticalScrollIndicator={false}>
                          <View style={styles.courseDetailHeader}>
                              <Text style={styles.courseDetailTitle}>{activeCourse.name}</Text>
                              <Text style={styles.courseDetailSub}>Loại: {activeCourse.type}  •  Thời gian: {activeCourse.startDate} đến {activeCourse.endDate}</Text>
                          </View>

                          <View style={styles.sectionArea}>
                              <View style={styles.sectionHeaderRow}>
                                  <Text style={styles.sectionTitle}>LỊCH HUẤN LUYỆN ĐÃ GIAO</Text>
                                  {isCenterManager && (
                                      <TouchableOpacity style={styles.btnAddSmall} onPress={() => setIsAssignModalOpen(true)}>
                                          <Feather name="calendar" size={12} color="#fff" /><Text style={styles.btnAddSmallText}>Giao Lịch Mới</Text>
                                      </TouchableOpacity>
                                  )}
                              </View>
                              {activeCourse.assignments.length === 0 ? (
                                  <Text style={styles.emptyTextLine}>Chưa có lịch huấn luyện nào được phân bổ cho khóa này.</Text>
                              ) : (
                                  activeCourse.assignments.map(ass => (
                                      <View key={ass.id} style={styles.assignRow}>
                                          <View style={{flex: 1}}>
                                              <Text style={styles.assignTarget}>{ass.targetType === 'TEAM' ? 'Giao cho Kíp:' : 'Giao cho Cá nhân:'} <Text style={{color: '#1e293b'}}>{ass.targetValue}</Text></Text>
                                              <Text style={styles.assignDates}>Ngày học: {ass.dates.join(', ')}</Text>
                                          </View>
                                      </View>
                                  ))
                              )}
                          </View>

                          <View style={[styles.sectionArea, {backgroundColor: '#f8fafc'}]}>
                              <Text style={[styles.sectionTitle, {color: '#4338ca', marginBottom: 12}]}>SỔ ĐIỂM DANH LỚP HỌC</Text>
                              
                              {!isCenterManager && !isTeamManager ? (
                                  <Text style={[styles.emptyTextLine, {color: '#ef4444'}]}>Chỉ cấp Quản lý Kíp hoặc Lãnh đạo mới có quyền điểm danh.</Text>
                              ) : activeCourse.assignments.length === 0 ? (
                                  <Text style={styles.emptyTextLine}>Chưa có lịch để điểm danh.</Text>
                              ) : (
                                  activeCourse.assignments.map(ass => (
                                      (!isCenterManager && ass.targetType === 'TEAM' && ass.targetValue !== currentUser.team) ? null : (
                                          <View key={`att_${ass.id}`} style={styles.attBlock}>
                                              <Text style={styles.attBlockTitle}>Danh sách: {ass.targetValue}</Text>
                                              {ass.dates.map(date => {
                                                  let expectedEmps = [];
                                                  if (ass.targetType === 'TEAM') expectedEmps = staffEmployees.filter(e => e.team === ass.targetValue);
                                                  else expectedEmps = staffEmployees.filter(e => e.id === ass.targetValue);

                                                  return (
                                                      <View key={date} style={styles.attDateGroup}>
                                                          <View style={styles.attDateHeader}><Feather name="calendar" size={12} color="#0284c7" /><Text style={styles.attDateText}>{date}</Text></View>
                                                          {expectedEmps.map(emp => {
                                                              const attKey = `${date}_${emp.id}`;
                                                              const currentStatus = activeCourse.attendance[attKey];
                                                              const isPresent = currentStatus?.startsWith('Có mặt');
                                                              
                                                              const overlappingActivity = activities.find(act => 
                                                                  act.empId === emp.id && act.status !== 'REJECTED' && act.type !== 'CHANGE' &&
                                                                  date >= act.startDate && date <= (act.endDate || act.startDate)
                                                              );
                                                              const actLabel = overlappingActivity ? getActivityLabel(overlappingActivity.type) : null;

                                                              return (
                                                                  <View key={emp.id} style={styles.attEmpRow}>
                                                                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                                                                          <Text style={styles.attEmpName}>{emp.name}</Text>
                                                                          {actLabel && (
                                                                              <View style={styles.warningTag}><Text style={styles.warningTagText}>[{actLabel}]</Text></View>
                                                                          )}
                                                                      </View>
                                                                      
                                                                      <View style={styles.attBtnGroup}>
                                                                          <TouchableOpacity style={[styles.attBtn, isPresent && {backgroundColor: '#16a34a', borderColor: '#16a34a'}]} onPress={() => markAttendance(activeCourse.id, date, emp.id, 'Có mặt')}>
                                                                              <Text style={[styles.attBtnText, isPresent && {color: '#fff'}]}>{currentStatus?.startsWith('Có mặt (') ? currentStatus : 'Có mặt'}</Text>
                                                                          </TouchableOpacity>
                                                                          <TouchableOpacity style={[styles.attBtn, currentStatus === 'Vắng' && {backgroundColor: '#ef4444', borderColor: '#ef4444'}]} onPress={() => markAttendance(activeCourse.id, date, emp.id, 'Vắng')}>
                                                                              <Text style={[styles.attBtnText, currentStatus === 'Vắng' && {color: '#fff'}]}>Vắng</Text>
                                                                          </TouchableOpacity>
                                                                          <TouchableOpacity style={[styles.attBtn, currentStatus === 'Có phép' && {backgroundColor: '#f59e0b', borderColor: '#f59e0b'}]} onPress={() => markAttendance(activeCourse.id, date, emp.id, 'Có phép')}>
                                                                              <Text style={[styles.attBtnText, currentStatus === 'Có phép' && {color: '#fff'}]}>Có phép</Text>
                                                                          </TouchableOpacity>
                                                                      </View>
                                                                  </View>
                                                              )
                                                          })}
                                                      </View>
                                                  )
                                              })}
                                          </View>
                                      )
                                  ))
                              )}
                          </View>
                      </ScrollView>
                  ) : (<View style={styles.emptyView}><Text style={styles.emptyText}>Chọn khóa học để xem chi tiết</Text></View>)
              )}
          </View>
      </View>

      <Modal visible={isStatsModalOpen} transparent animationType="fade">
          <View style={styles.modalOverlay}>
              <View style={styles.modalBox}>
                  <View style={styles.modalHeader}><Text style={styles.modalTitle}>Cập nhật TA/SIM</Text></View>
                  <View style={styles.modalBody}>
                      <Text style={styles.label}>Tiếng Anh ICAO (Mức)</Text>
                      <TextInput style={styles.input} value={statsFormData.englishLevel} onChangeText={t => setStatsFormData(p => ({...p, englishLevel: t}))} />
                      <Text style={styles.label}>Hạn Tiếng Anh (YYYY-MM-DD)</Text>
                      <TextInput style={styles.input} value={statsFormData.englishExp} onChangeText={t => setStatsFormData(p => ({...p, englishExp: t}))} />
                      <Text style={styles.label}>Trạng thái SIM</Text>
                      <TextInput style={styles.input} value={statsFormData.simStatus} onChangeText={t => setStatsFormData(p => ({...p, simStatus: t}))} />
                  </View>
                  <View style={styles.modalFooter}>
                      <TouchableOpacity style={styles.btnCancel} onPress={() => setIsStatsModalOpen(false)}><Text style={styles.btnCancelText}>Hủy</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.btnSave} onPress={saveStats}><Text style={styles.btnSaveText}>Lưu</Text></TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

      <Modal visible={isCourseModalOpen} transparent animationType="fade">
          <View style={styles.modalOverlay}>
              <View style={styles.modalBox}>
                  <View style={styles.modalHeader}><Text style={styles.modalTitle}>Tạo Khóa Huấn Luyện</Text></View>
                  <View style={styles.modalBody}>
                      <Text style={styles.label}>Tên khóa học</Text>
                      <TextInput style={styles.input} value={courseFormData.name} onChangeText={t => setCourseFormData(p => ({...p, name: t}))} placeholder="VD: Năng định kỳ 1" />
                      <Text style={styles.label}>Từ ngày</Text>
                      <TextInput style={styles.input} value={courseFormData.startDate} onChangeText={t => setCourseFormData(p => ({...p, startDate: t}))} placeholder="YYYY-MM-DD" />
                      <Text style={styles.label}>Đến ngày</Text>
                      <TextInput style={styles.input} value={courseFormData.endDate} onChangeText={t => setCourseFormData(p => ({...p, endDate: t}))} placeholder="YYYY-MM-DD" />
                  </View>
                  <View style={styles.modalFooter}>
                      <TouchableOpacity style={styles.btnCancel} onPress={() => setIsCourseModalOpen(false)}><Text style={styles.btnCancelText}>Hủy</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.btnSave} onPress={saveCourse}><Text style={styles.btnSaveText}>Tạo Khóa</Text></TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

      <Modal visible={isAssignModalOpen} transparent animationType="fade">
          <View style={styles.modalOverlay}>
              <View style={styles.modalBox}>
                  <View style={styles.modalHeader}><Text style={styles.modalTitle}>Phân Bổ Lịch Huấn Luyện</Text></View>
                  <View style={styles.modalBody}>
                      <Text style={styles.label}>Hình thức giao</Text>
                      <View style={{flexDirection: 'row', gap: 10, marginBottom: 12}}>
                          <TouchableOpacity style={[styles.tabBtn, assignFormData.targetType === 'TEAM' && styles.tabBtnActive]} onPress={() => setAssignFormData(p => ({...p, targetType: 'TEAM', targetValue: settings?.teams?.[1] || ''}))}><Text style={styles.tabBtnText}>Theo Kíp</Text></TouchableOpacity>
                          <TouchableOpacity style={[styles.tabBtn, assignFormData.targetType === 'EMP' && styles.tabBtnActive]} onPress={() => setAssignFormData(p => ({...p, targetType: 'EMP', targetValue: staffEmployees[0]?.id || ''}))}><Text style={styles.tabBtnText}>Từng Cá nhân</Text></TouchableOpacity>
                      </View>

                      <Text style={styles.label}>Đối tượng ({assignFormData.targetType === 'TEAM' ? 'Tên Kíp' : 'Mã ICAO'})</Text>
                      <TextInput style={styles.input} value={assignFormData.targetValue} onChangeText={t => setAssignFormData(p => ({...p, targetValue: t}))} placeholder={assignFormData.targetType === 'TEAM' ? "VD: Kíp A" : "VD: HA"} />

                      <Text style={styles.label}>Các ngày huấn luyện (Cách nhau bằng dấu phẩy)</Text>
                      <TextInput style={styles.input} value={assignFormData.dates} onChangeText={t => setAssignFormData(p => ({...p, dates: t}))} placeholder="VD: 2026-03-02, 2026-03-05" />
                  </View>
                  <View style={styles.modalFooter}>
                      <TouchableOpacity style={styles.btnCancel} onPress={() => setIsAssignModalOpen(false)}><Text style={styles.btnCancelText}>Hủy</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.btnSave} onPress={saveAssignment}><Text style={styles.btnSaveText}>Lưu Lịch</Text></TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },

  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  confirmBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 350, elevation: 10 },
  confirmTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
  confirmMsg: { fontFamily: 'Times New Roman', fontSize: 14, color: '#475569', marginBottom: 20, lineHeight: 20 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  confirmBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  confirmBtnText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold' },

  userSimulator: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  userSimLabel: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#64748b', marginRight: 10 },
  userSimChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  userSimChipActive: { backgroundColor: '#3b82f6' },
  userSimText: { fontFamily: 'Times New Roman', fontSize: 11, color: '#475569', fontWeight: 'bold' },
  userSimTextActive: { color: '#fff' },

  topTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 16, paddingTop: 10, gap: 20 },
  mainTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, borderBottomWidth: 2, borderColor: 'transparent' },
  mainTabActive: { borderColor: '#2563eb' },
  mainTabText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  mainTabTextActive: { color: '#2563eb' },

  mainLayout: { flex: 1, flexDirection: 'row', padding: 16, gap: 16 },

  leftColumn: { width: 300, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  leftHeader: { padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  leftTitle: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 10, height: 36 },
  searchInputSmall: { flex: 1, fontFamily: 'Times New Roman', fontSize: 13, marginLeft: 6 },
  listArea: { flex: 1 },
  listItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  listItemActive: { backgroundColor: '#eff6ff' },
  listAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  listAvatarText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569' },
  listTitle: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569' },
  listSub: { fontFamily: 'Times New Roman', fontSize: 11, color: '#94a3b8', marginTop: 2 },

  rightColumn: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  emptyView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#94a3b8', fontStyle: 'italic' },

  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingBottom: 20, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  profileAvatarLg: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  profileAvatarTextLg: { fontFamily: 'Times New Roman', fontSize: 24, fontWeight: 'bold', color: '#fff' },
  profileName: { fontFamily: 'Times New Roman', fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  tagsRow: { flexDirection: 'row', gap: 8 },
  tag: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  tagText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#475569' },
  btnEditOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
  btnEditOutlineText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#2563eb' },
  statsGrid: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  statBox: { flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
  statIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  statBoxLabel: { fontFamily: 'Times New Roman', fontSize: 11, color: '#64748b', fontWeight: 'bold', marginBottom: 4 },
  statBoxValue: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#d97706' },
  statBoxSub: { fontFamily: 'Courier New', fontSize: 11, fontWeight: 'bold', marginTop: 4, color: '#64748b' },
  
  progressWrap: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#16a34a', borderRadius: 4 },

  // COURSE PROGRESS SECTION (MỚI THÊM)
  courseProgressSection: { marginTop: 10 },
  sectionTitle: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#94a3b8', marginBottom: 12, letterSpacing: 1 },
  empCourseCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  empCourseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  empCourseName: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  empCourseSub: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', marginTop: 4 },
  empCourseProgressText: { alignItems: 'flex-end' },
  empCourseProgressValue: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#2563eb' },
  empCourseProgressFraction: { fontFamily: 'Times New Roman', fontSize: 11, color: '#94a3b8' },
  attDetailRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  attDetailBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignItems: 'center', minWidth: 45 },
  attDetailDate: { fontFamily: 'Courier New', fontSize: 10, fontWeight: 'bold' },
  attDetailStatus: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', marginTop: 2 },

  courseDetailHeader: { padding: 20, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  courseDetailTitle: { fontFamily: 'Times New Roman', fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  courseDetailSub: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', marginTop: 6 },
  sectionArea: { padding: 20, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  assignRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
  assignTarget: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  assignDates: { fontFamily: 'Times New Roman', fontSize: 12, color: '#0284c7', marginTop: 4 },
  emptyTextLine: { fontFamily: 'Times New Roman', fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  
  attBlock: { marginBottom: 20, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  attBlockTitle: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#1e293b', backgroundColor: '#e0e7ff', padding: 10 },
  attDateGroup: { borderBottomWidth: 1, borderColor: '#f1f5f9' },
  attDateHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0f9ff', padding: 8, borderBottomWidth: 1, borderColor: '#e0f2fe' },
  attDateText: { fontFamily: 'Courier New', fontSize: 12, fontWeight: 'bold', color: '#0369a1' },
  attEmpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: '#f8fafc' },
  attEmpName: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569' },
  warningTag: { backgroundColor: '#fee2e2', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  warningTagText: { fontFamily: 'Times New Roman', fontSize: 10, color: '#dc2626', fontWeight: 'bold' },
  attBtnGroup: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 250 },
  attBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', justifyContent: 'center' },
  attBtnText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#64748b' },

  btnAddSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10b981', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  btnAddSmallText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#fff' },
  tabBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  tabBtnActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  tabBtnText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#475569' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 450, overflow: 'hidden', elevation: 5 },
  modalHeader: { padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  modalTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  modalBody: { padding: 20 },
  label: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 8, marginTop: 12 },
  input: { fontFamily: 'Times New Roman', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fff' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', gap: 10 },
  btnCancel: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  btnCancelText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569' },
  btnSave: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, backgroundColor: '#2563eb' },
  btnSaveText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#fff' }
});