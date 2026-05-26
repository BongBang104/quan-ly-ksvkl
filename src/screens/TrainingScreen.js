import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import React, { useState, useMemo } from 'react';



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
    <div style={styles.container}>

      <Modal visible={confirmDialog.visible} transparent animationType="fade">
          <div style={styles.confirmOverlay}>
              <div style={styles.confirmBox}>
                  <span style={{...styles.confirmTitle, ...(confirmDialog.isWarning && {color: '#dc2626'})}}>{confirmDialog.title}</span>
                  <span style={styles.confirmMsg}>{confirmDialog.msg}</span>
                  <div style={styles.confirmActions}>
                      {confirmDialog.onConfirm && (
                          <button type="button" style={{...styles.confirmBtn, backgroundColor: '#f1f5f9'}} onClick={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}>
                              <span style={{...styles.confirmBtnText, color: '#64748b'}}>Hủy bỏ</span>
                          </button>
                      )}
                      <button type="button" style={{...styles.confirmBtn, backgroundColor: confirmDialog.isWarning ? '#ef4444' : '#2563eb'}} onClick={() => {
                          if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                          setConfirmDialog(prev => ({ ...prev, visible: false }));
                      }}>
                          <span style={{...styles.confirmBtnText, color: '#fff'}}>{confirmDialog.confirmText}</span>
                      </button>
                  </div>
              </div>
          </div>
      </Modal>

      <div style={styles.userSimulator}>
          <span style={styles.userSimLabel}><Icon name="user-check" size={12}/> Đang đóng vai:</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
              {simulatedUsers.map(emp => {
                  const isManager = emp.isChief || emp.position?.toLowerCase().includes('quản lý');
                  const isLD = emp.id === 'ADMIN_01';
                  return (
                      <button type="button" key={emp.id} onClick={() => setCurrentUser(emp)} style={{...styles.userSimChip, ...(currentUser?.id === emp.id && styles.userSimChipActive), ...(isLD && !currentUser?.id.includes('ADMIN') && {backgroundColor: '#fef3c7', borderColor: '#fde68a'})}}>
                          <span style={{...styles.userSimText, ...(currentUser?.id === emp.id && styles.userSimTextActive), ...(isLD && !currentUser?.id.includes('ADMIN') && {color: '#b45309'})}}>
                              {emp.name} {isManager && !isLD ? '(QL)' : ''}
                          </span>
                      </button>
                  );
              })}
          </div>
      </div>

      <div style={styles.topTabs}>
          <button type="button" style={{...styles.mainTab, ...(activeTab === 'PROFILES' && styles.mainTabActive)}} onClick={() => setActiveTab('PROFILES')}>
              <Icon name="user" size={16} color={activeTab === 'PROFILES' ? '#2563eb' : '#64748b'} />
              <span style={{...styles.mainTabText, ...(activeTab === 'PROFILES' && styles.mainTabTextActive)}}>HỒ SƠ TỪNG CÁ NHÂN</span>
          </button>
          <button type="button" style={{...styles.mainTab, ...(activeTab === 'COURSES' && styles.mainTabActive)}} onClick={() => setActiveTab('COURSES')}>
              <Icon name="book-open" size={16} color={activeTab === 'COURSES' ? '#2563eb' : '#64748b'} />
              <span style={{...styles.mainTabText, ...(activeTab === 'COURSES' && styles.mainTabTextActive)}}>QUẢN LÝ KHÓA HỌC & ĐIỂM DANH</span>
          </button>
      </div>

      <div style={styles.mainLayout}>

          <div style={styles.leftColumn}>
              <div style={styles.leftHeader}>
                  <span style={styles.leftTitle}>{activeTab === 'PROFILES' ? 'Nhân Sự Huấn Luyện' : 'Danh Sách Khóa Học'}</span>
                  {activeTab === 'PROFILES' && (
                      <div style={styles.searchWrapper}>
                          <Icon name="search" size={14} color="#94a3b8" />
                          <input style={styles.searchInputSmall} placeholder="Tìm nhân sự..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                      </div>
                  )}
                  {(activeTab === 'COURSES' && isCenterManager) && (
                      <button type="button" style={styles.btnAddSmall} onClick={() => { setCourseFormData({ id: '', name: '', type: 'Định kỳ', startDate: '', endDate: '' }); setIsCourseModalOpen(true); }}>
                          <Icon name="plus" size={12} color="#fff" /><span style={styles.btnAddSmallText}>Tạo Khóa</span>
                      </button>
                  )}
              </div>

              <div style={styles.listArea}>
                  {activeTab === 'PROFILES' ? (
                      filteredStaff.map(emp => {
                          const isActive = selectedEmpId === emp.id;
                          return (
                              <button type="button" key={emp.id} style={{...styles.listItem, ...(isActive && styles.listItemActive)}} onClick={() => setSelectedEmpId(emp.id)}>
                                  <div style={{...styles.listAvatar, ...(isActive && {backgroundColor: '#2563eb'})}}><span style={{...styles.listAvatarText, ...(isActive && {color: '#fff'})}}>{emp.name.charAt(0)}</span></div>
                                  <div style={{flex: 1}}>
                                      <span style={{...styles.listTitle, ...(isActive && {color: '#1e293b'})}} >{emp.name}</span>
                                      <span style={styles.listSub}>{emp.id} - {emp.team}</span>
                                  </div>
                              </button>
                          );
                      })
                  ) : (
                      courses.map(course => {
                          const isActive = selectedCourseId === course.id;
                          return (
                              <button type="button" key={course.id} style={{...styles.listItem, ...(isActive && styles.listItemActive)}} onClick={() => setSelectedCourseId(course.id)}>
                                  <div style={{...styles.listAvatar, backgroundColor: '#f1f5f9', ...(isActive && {backgroundColor: '#dbeafe'})}}><Icon name="bookmark" size={14} color={isActive ? '#2563eb' : '#64748b'} /></div>
                                  <div style={{flex: 1}}>
                                      <span style={{...styles.listTitle, ...(isActive && {color: '#1e293b'})}} >{course.name}</span>
                                      <span style={styles.listSub}>{course.startDate} đến {course.endDate}</span>
                                  </div>
                              </button>
                          );
                      })
                  )}
              </div>
          </div>

          <div style={styles.rightColumn}>
              {activeTab === 'PROFILES' ? (
                  activeEmp ? (
                      <div style={{ padding: 20 }}>
                          <div style={styles.profileHeader}>
                              <div style={styles.profileAvatarLg}><span style={styles.profileAvatarTextLg}>{activeEmp.name.charAt(0)}</span></div>
                              <div style={{flex: 1}}>
                                  <span style={styles.profileName}>{activeEmp.name}</span>
                                  <div style={styles.tagsRow}>
                                      <div style={styles.tag}><span style={styles.tagText}>{activeEmp.id}</span></div>
                                      <div style={styles.tag}><span style={styles.tagText}>{activeEmp.team}</span></div>
                                      <div style={styles.tag}><span style={styles.tagText}>{activeEmp.position}</span></div>
                                  </div>
                              </div>
                              {isCenterManager && (
                                  <button type="button" style={styles.btnEditOutline} onClick={() => { setStatsFormData({...profileStats[activeEmp.id]}); setIsStatsModalOpen(true); }}>
                                      <Icon name="edit-3" size={14} color="#2563eb" /><span style={styles.btnEditOutlineText}>Sửa TA/SIM</span>
                                  </button>
                              )}
                          </div>

                          <div style={styles.statsGrid}>
                              <div style={styles.statBox}>
                                  <div style={styles.statIconBox}><Icon name="mic" size={16} color="#d97706" /></div>
                                  <div>
                                      <span style={styles.statBoxLabel}>Tiếng Anh ICAO</span>
                                      <span style={styles.statBoxValue}>{profileStats[activeEmp.id]?.englishLevel}</span>
                                      <span style={styles.statBoxSub}>Hạn: {profileStats[activeEmp.id]?.englishExp}</span>
                                  </div>
                              </div>
                              <div style={styles.statBox}>
                                  <div style={{...styles.statIconBox, backgroundColor: '#e0e7ff'}}><Icon name="monitor" size={16} color="#4f46e5" /></div>
                                  <div>
                                      <span style={styles.statBoxLabel}>Kết quả SIM</span>
                                      <span style={{...styles.statBoxValue, color: '#4f46e5'}}>{profileStats[activeEmp.id]?.simStatus}</span>
                                  </div>
                              </div>
                              <div style={styles.statBox}>
                                  <div style={{...styles.statIconBox, backgroundColor: '#dcfce7'}}><Icon name="bar-chart" size={16} color="#16a34a" /></div>
                                  <div style={{flex: 1}}>
                                      <div style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                          <span style={styles.statBoxLabel}>Tiến độ Tổng</span>
                                          <span style={{...styles.statBoxValue, color: '#16a34a'}}>{calculateProgress(activeEmp.id)}%</span>
                                      </div>
                                      <div style={styles.progressWrap}>
                                          <div style={{...styles.progressBar, width: `${calculateProgress(activeEmp.id)}%`}} />
                                      </div>
                                  </div>
                              </div>
                          </div>

                          <div style={styles.courseProgressSection}>
                              <span style={styles.sectionTitle}>CHI TIẾT CÁC KHÓA HUẤN LUYỆN ĐƯỢC GIAO</span>

                              {getEmpCourses(activeEmp.id).length === 0 ? (
                                  <span style={styles.emptyTextLine}>Nhân sự này chưa được phân bổ vào khóa huấn luyện nào.</span>
                              ) : (
                                  getEmpCourses(activeEmp.id).map(course => (
                                      <div key={course.id} style={styles.empCourseCard}>
                                          <div style={styles.empCourseHeader}>
                                              <div style={{flex: 1}}>
                                                  <span style={styles.empCourseName}>{course.name}</span>
                                                  <span style={styles.empCourseSub}>Loại: {course.type} • Tới {course.endDate}</span>
                                              </div>
                                              <div style={styles.empCourseProgressText}>
                                                  <span style={styles.empCourseProgressValue}>{course.progress}%</span>
                                                  <span style={styles.empCourseProgressFraction}>{course.attendedDays}/{course.totalDays} buổi</span>
                                              </div>
                                          </div>
                                          <div style={styles.progressWrap}>
                                              <div style={{...styles.progressBar, width: `${course.progress}%`, backgroundColor: course.progress === 100 ? '#16a34a' : '#3b82f6'}} />
                                          </div>

                                          <div style={Object.assign({}, styles.attDetailRow, { display: 'flex', flexWrap: 'wrap' })}>
                                              {course.attendanceDetails.map(att => {
                                                  let badgeColor = '#f1f5f9'; let textColor = '#64748b'; let icon = '-';
                                                  if (att.status.startsWith('Có mặt')) { badgeColor = '#dcfce7'; textColor = '#16a34a'; icon = '✔'; }
                                                  else if (att.status === 'Vắng') { badgeColor = '#fee2e2'; textColor = '#dc2626'; icon = '✖'; }
                                                  else if (att.status === 'Có phép') { badgeColor = '#fef3c7'; textColor = '#d97706'; icon = 'P'; }

                                                  return (
                                                      <div key={att.date} style={{...styles.attDetailBadge, backgroundColor: badgeColor}}>
                                                          <span style={{...styles.attDetailDate, color: textColor}}>{att.date.split('-').slice(1).join('/')}</span>
                                                          <span style={{...styles.attDetailStatus, color: textColor}}>{icon}</span>
                                                      </div>
                                                  )
                                              })}
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>

                      </div>
                  ) : (<div style={styles.emptyView}><span style={styles.emptyText}>Chọn nhân sự để xem hồ sơ</span></div>)
              ) : (
                  activeCourse ? (
                      <div>
                          <div style={styles.courseDetailHeader}>
                              <span style={styles.courseDetailTitle}>{activeCourse.name}</span>
                              <span style={styles.courseDetailSub}>Loại: {activeCourse.type}  •  Thời gian: {activeCourse.startDate} đến {activeCourse.endDate}</span>
                          </div>

                          <div style={styles.sectionArea}>
                              <div style={styles.sectionHeaderRow}>
                                  <span style={styles.sectionTitle}>LỊCH HUẤN LUYỆN ĐÃ GIAO</span>
                                  {isCenterManager && (
                                      <button type="button" style={styles.btnAddSmall} onClick={() => setIsAssignModalOpen(true)}>
                                          <Icon name="calendar" size={12} color="#fff" /><span style={styles.btnAddSmallText}>Giao Lịch Mới</span>
                                      </button>
                                  )}
                              </div>
                              {activeCourse.assignments.length === 0 ? (
                                  <span style={styles.emptyTextLine}>Chưa có lịch huấn luyện nào được phân bổ cho khóa này.</span>
                              ) : (
                                  activeCourse.assignments.map(ass => (
                                      <div key={ass.id} style={styles.assignRow}>
                                          <div style={{flex: 1}}>
                                              <span style={styles.assignTarget}>{ass.targetType === 'TEAM' ? 'Giao cho Kíp:' : 'Giao cho Cá nhân:'} <span style={{color: '#1e293b'}}>{ass.targetValue}</span></span>
                                              <span style={styles.assignDates}>Ngày học: {ass.dates.join(', ')}</span>
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>

                          <div style={{...styles.sectionArea, backgroundColor: '#f8fafc'}}>
                              <span style={{...styles.sectionTitle, color: '#4338ca', marginBottom: 12}}>SỔ ĐIỂM DANH LỚP HỌC</span>

                              {!isCenterManager && !isTeamManager ? (
                                  <span style={{...styles.emptyTextLine, color: '#ef4444'}}>Chỉ cấp Quản lý Kíp hoặc Lãnh đạo mới có quyền điểm danh.</span>
                              ) : activeCourse.assignments.length === 0 ? (
                                  <span style={styles.emptyTextLine}>Chưa có lịch để điểm danh.</span>
                              ) : (
                                  activeCourse.assignments.map(ass => (
                                      (!isCenterManager && ass.targetType === 'TEAM' && ass.targetValue !== currentUser.team) ? null : (
                                          <div key={`att_${ass.id}`} style={styles.attBlock}>
                                              <span style={styles.attBlockTitle}>Danh sách: {ass.targetValue}</span>
                                              {ass.dates.map(date => {
                                                  let expectedEmps = [];
                                                  if (ass.targetType === 'TEAM') expectedEmps = staffEmployees.filter(e => e.team === ass.targetValue);
                                                  else expectedEmps = staffEmployees.filter(e => e.id === ass.targetValue);

                                                  return (
                                                      <div key={date} style={styles.attDateGroup}>
                                                          <div style={styles.attDateHeader}><Icon name="calendar" size={12} color="#0284c7" /><span style={styles.attDateText}>{date}</span></div>
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
                                                                  <div key={emp.id} style={styles.attEmpRow}>
                                                                      <div style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                                                                          <span style={styles.attEmpName}>{emp.name}</span>
                                                                          {actLabel && (
                                                                              <div style={styles.warningTag}><span style={styles.warningTagText}>[{actLabel}]</span></div>
                                                                          )}
                                                                      </div>

                                                                      <div style={styles.attBtnGroup}>
                                                                          <button type="button" style={{...styles.attBtn, ...(isPresent && {backgroundColor: '#16a34a', borderColor: '#16a34a'})}} onClick={() => markAttendance(activeCourse.id, date, emp.id, 'Có mặt')}>
                                                                              <span style={{...styles.attBtnText, ...(isPresent && {color: '#fff'})}}>{currentStatus?.startsWith('Có mặt (') ? currentStatus : 'Có mặt'}</span>
                                                                          </button>
                                                                          <button type="button" style={{...styles.attBtn, ...(currentStatus === 'Vắng' && {backgroundColor: '#ef4444', borderColor: '#ef4444'})}} onClick={() => markAttendance(activeCourse.id, date, emp.id, 'Vắng')}>
                                                                              <span style={{...styles.attBtnText, ...(currentStatus === 'Vắng' && {color: '#fff'})}}>Vắng</span>
                                                                          </button>
                                                                          <button type="button" style={{...styles.attBtn, ...(currentStatus === 'Có phép' && {backgroundColor: '#f59e0b', borderColor: '#f59e0b'})}} onClick={() => markAttendance(activeCourse.id, date, emp.id, 'Có phép')}>
                                                                              <span style={{...styles.attBtnText, ...(currentStatus === 'Có phép' && {color: '#fff'})}}>Có phép</span>
                                                                          </button>
                                                                      </div>
                                                                  </div>
                                                              )
                                                          })}
                                                      </div>
                                                  )
                                              })}
                                          </div>
                                      )
                                  ))
                              )}
                          </div>
                      </div>
                  ) : (<div style={styles.emptyView}><span style={styles.emptyText}>Chọn khóa học để xem chi tiết</span></div>)
              )}
          </div>
      </div>

      <Modal visible={isStatsModalOpen} transparent animationType="fade">
          <div style={styles.modalOverlay}>
              <div style={styles.modalBox}>
                  <div style={styles.modalHeader}><span style={styles.modalTitle}>Cập nhật TA/SIM</span></div>
                  <div style={styles.modalBody}>
                      <span style={styles.label}>Tiếng Anh ICAO (Mức)</span>
                      <input style={styles.input} value={statsFormData.englishLevel} onChange={(e) => setStatsFormData(p => ({...p, englishLevel: e.target.value}))} />
                      <span style={styles.label}>Hạn Tiếng Anh (YYYY-MM-DD)</span>
                      <input style={styles.input} value={statsFormData.englishExp} onChange={(e) => setStatsFormData(p => ({...p, englishExp: e.target.value}))} />
                      <span style={styles.label}>Trạng thái SIM</span>
                      <input style={styles.input} value={statsFormData.simStatus} onChange={(e) => setStatsFormData(p => ({...p, simStatus: e.target.value}))} />
                  </div>
                  <div style={styles.modalFooter}>
                      <button type="button" style={styles.btnCancel} onClick={() => setIsStatsModalOpen(false)}><span style={styles.btnCancelText}>Hủy</span></button>
                      <button type="button" style={styles.btnSave} onClick={saveStats}><span style={styles.btnSaveText}>Lưu</span></button>
                  </div>
              </div>
          </div>
      </Modal>

      <Modal visible={isCourseModalOpen} transparent animationType="fade">
          <div style={styles.modalOverlay}>
              <div style={styles.modalBox}>
                  <div style={styles.modalHeader}><span style={styles.modalTitle}>Tạo Khóa Huấn Luyện</span></div>
                  <div style={styles.modalBody}>
                      <span style={styles.label}>Tên khóa học</span>
                      <input style={styles.input} value={courseFormData.name} onChange={(e) => setCourseFormData(p => ({...p, name: e.target.value}))} placeholder="VD: Năng định kỳ 1" />
                      <span style={styles.label}>Từ ngày</span>
                      <input style={styles.input} value={courseFormData.startDate} onChange={(e) => setCourseFormData(p => ({...p, startDate: e.target.value}))} placeholder="YYYY-MM-DD" />
                      <span style={styles.label}>Đến ngày</span>
                      <input style={styles.input} value={courseFormData.endDate} onChange={(e) => setCourseFormData(p => ({...p, endDate: e.target.value}))} placeholder="YYYY-MM-DD" />
                  </div>
                  <div style={styles.modalFooter}>
                      <button type="button" style={styles.btnCancel} onClick={() => setIsCourseModalOpen(false)}><span style={styles.btnCancelText}>Hủy</span></button>
                      <button type="button" style={styles.btnSave} onClick={saveCourse}><span style={styles.btnSaveText}>Tạo Khóa</span></button>
                  </div>
              </div>
          </div>
      </Modal>

      <Modal visible={isAssignModalOpen} transparent animationType="fade">
          <div style={styles.modalOverlay}>
              <div style={styles.modalBox}>
                  <div style={styles.modalHeader}><span style={styles.modalTitle}>Phân Bổ Lịch Huấn Luyện</span></div>
                  <div style={styles.modalBody}>
                      <span style={styles.label}>Hình thức giao</span>
                      <div style={{flexDirection: 'row', gap: 10, marginBottom: 12}}>
                          <button type="button" style={{...styles.tabBtn, ...(assignFormData.targetType === 'TEAM' && styles.tabBtnActive)}} onClick={() => setAssignFormData(p => ({...p, targetType: 'TEAM', targetValue: settings?.teams?.[1] || ''}))}><span style={styles.tabBtnText}>Theo Kíp</span></button>
                          <button type="button" style={{...styles.tabBtn, ...(assignFormData.targetType === 'EMP' && styles.tabBtnActive)}} onClick={() => setAssignFormData(p => ({...p, targetType: 'EMP', targetValue: staffEmployees[0]?.id || ''}))}><span style={styles.tabBtnText}>Từng Cá nhân</span></button>
                      </div>

                      <span style={styles.label}>Đối tượng ({assignFormData.targetType === 'TEAM' ? 'Tên Kíp' : 'Mã ICAO'})</span>
                      <input style={styles.input} value={assignFormData.targetValue} onChange={(e) => setAssignFormData(p => ({...p, targetValue: e.target.value}))} placeholder={assignFormData.targetType === 'TEAM' ? "VD: Kíp A" : "VD: HA"} />

                      <span style={styles.label}>Các ngày huấn luyện (Cách nhau bằng dấu phẩy)</span>
                      <input style={styles.input} value={assignFormData.dates} onChange={(e) => setAssignFormData(p => ({...p, dates: e.target.value}))} placeholder="VD: 2026-03-02, 2026-03-05" />
                  </div>
                  <div style={styles.modalFooter}>
                      <button type="button" style={styles.btnCancel} onClick={() => setIsAssignModalOpen(false)}><span style={styles.btnCancelText}>Hủy</span></button>
                      <button type="button" style={styles.btnSave} onClick={saveAssignment}><span style={styles.btnSaveText}>Lưu Lịch</span></button>
                  </div>
              </div>
          </div>
      </Modal>

    </div>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#f1f5f9' },

  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  confirmBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 350, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  confirmTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
  confirmMsg: { fontFamily: 'Times New Roman', fontSize: 14, color: '#475569', marginBottom: 20, lineHeight: '20px' },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  confirmBtn: { paddingTop: 8, paddingBottom: 8, paddingLeft: 16, paddingRight: 16, borderRadius: 6 },
  confirmBtnText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold' },

  userSimulator: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  userSimLabel: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#64748b', marginRight: 10 },
  userSimChip: { paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: 12, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  userSimChipActive: { backgroundColor: '#3b82f6' },
  userSimText: { fontFamily: 'Times New Roman', fontSize: 11, color: '#475569', fontWeight: 'bold' },
  userSimTextActive: { color: '#fff' },

  topTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0', paddingLeft: 16, paddingRight: 16, paddingTop: 10, gap: 20 },
  mainTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 2, borderColor: 'transparent' },
  mainTabActive: { borderColor: '#2563eb' },
  mainTabText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  mainTabTextActive: { color: '#2563eb' },

  mainLayout: { flex: 1, flexDirection: 'row', padding: 16, gap: 16 },

  leftColumn: { width: 300, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  leftHeader: { padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  leftTitle: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingLeft: 10, paddingRight: 10, height: 36 },
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
  tag: { backgroundColor: '#f1f5f9', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  tagText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#475569' },
  btnEditOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12, borderRadius: 6, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
  btnEditOutlineText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#2563eb' },
  statsGrid: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  statBox: { flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
  statIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  statBoxLabel: { fontFamily: 'Times New Roman', fontSize: 11, color: '#64748b', fontWeight: 'bold', marginBottom: 4 },
  statBoxValue: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#d97706' },
  statBoxSub: { fontFamily: 'Courier New', fontSize: 11, fontWeight: 'bold', marginTop: 4, color: '#64748b' },

  progressWrap: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#16a34a', borderRadius: 4 },

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
  attDetailBadge: { paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 6, alignItems: 'center', minWidth: 45 },
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
  warningTag: { backgroundColor: '#fee2e2', paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 4 },
  warningTagText: { fontFamily: 'Times New Roman', fontSize: 10, color: '#dc2626', fontWeight: 'bold' },
  attBtnGroup: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 250 },
  attBtn: { paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10, borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', justifyContent: 'center' },
  attBtnText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#64748b' },

  btnAddSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10b981', paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10, borderRadius: 6 },
  btnAddSmallText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#fff' },
  tabBtn: { paddingTop: 6, paddingBottom: 6, paddingLeft: 12, paddingRight: 12, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  tabBtnActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  tabBtnText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#475569' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 450, overflow: 'hidden', boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  modalHeader: { padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  modalTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  modalBody: { padding: 20 },
  label: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 8, marginTop: 12 },
  input: { fontFamily: 'Times New Roman', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fff' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', gap: 10 },
  btnCancel: { paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 16, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  btnCancelText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569' },
  btnSave: { paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20, borderRadius: 6, backgroundColor: '#2563eb' },
  btnSaveText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#fff' }
};
