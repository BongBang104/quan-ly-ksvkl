import React, { useState, useEffect, useRef, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import TaskFormModal from '../components/TaskFormModal';
import { DataService } from '../services/DataService'; 
import { AppContext } from '../context/AppContext'; 

const FloatingToast = ({ toast }) => {
    if (!toast) return null;
    const isSuccess = toast.type === 'success';
    return (
        <View style={[styles.toastContainer, { borderLeftColor: isSuccess ? '#10b981' : '#3b82f6' }]}>
            <Feather name={isSuccess ? "check-circle" : "info"} size={20} color={isSuccess ? '#10b981' : '#3b82f6'} />
            <View style={{ marginLeft: 12 }}>
                <Text style={styles.toastTitle}>{toast.title}</Text>
                <Text style={styles.toastMsg}>{toast.msg}</Text>
            </View>
        </View>
    );
};

const SmsReportModal = ({ isOpen, onClose, onSaveReport, setConfirmDialog, showToast }) => {
  const { employees, settings, activities, currentUser } = useContext(AppContext);

  const defaultShift = settings?.shiftTypes?.[0]?.code || 'S';
  const defaultTeam = currentUser?.team || settings?.teams?.[0] || 'Kíp A';

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], shift: defaultShift, team: defaultTeam,
    weather: 'Tốt, đủ tiêu chuẩn HĐB.', equipment: 'Hoạt động bình thường. Các hệ thống dự phòng tốt.',
    operations: 'Điều hành bay an toàn, điều hòa, không có sự cố.', notes: 'Không có.'
  });

  const [staffInfo, setStaffInfo] = useState({ total: 0, present: 0, absentList: [] });
  const [generatedReport, setGeneratedReport] = useState('');

  useEffect(() => {
      if (currentUser?.team && settings?.teams?.includes(currentUser.team)) {
          setFormData(prev => ({ ...prev, team: currentUser.team }));
      }
  }, [currentUser, settings]);

  useEffect(() => {
    if (!isOpen) return;
    const teamMembers = employees.filter(e => e.team === formData.team);
    const absences = [];
    teamMembers.forEach(emp => {
        const isAbsent = activities.find(a => a.empId === emp.id && a.startDate <= formData.date && a.endDate >= formData.date && a.type !== 'CHANGE');
        if (isAbsent) {
            const typeLabel = settings?.activityTypes?.find(t => t.id === isAbsent.type)?.label || 'Nghỉ';
            absences.push(`${emp.name} (${typeLabel})`);
        }
    });
    setStaffInfo({ total: teamMembers.length, present: teamMembers.length - absences.length, absentList: absences });
  }, [formData.team, formData.date, employees, activities, settings, isOpen]);

  const handleGenerate = () => {
    const shiftLabel = settings?.shiftTypes?.find(s => s.code === formData.shift)?.label || formData.shift;
    let absentStr = staffInfo.absentList.length > 0 ? `\n   - Vắng: ${staffInfo.absentList.length} (${staffInfo.absentList.join(', ')})` : `\n   - Vắng: 0`;

    const report = `BÁO CÁO CA TRỰC\n---------------------------------------\n▶ Ngày: ${formData.date}\n▶ Ca trực: ${shiftLabel} (${formData.team})\n---------------------------------------\n1. QUÂN SỐ:\n   - Tổng số/Có mặt: ${staffInfo.present}/${staffInfo.total}${absentStr}\n\n2. THỜI TIẾT:\n   - ${formData.weather}\n\n3. TRANG THIẾT BỊ:\n   - ${formData.equipment}\n\n4. HOẠT ĐỘNG BAY:\n   - ${formData.operations}\n\n5. GHI CHÚ:\n   - ${formData.notes}\n---------------------------------------\nNgười lập báo cáo:\n${currentUser?.name || 'Không xác định'}`; 
    setGeneratedReport(report);
  };

  const handleSubmitReport = () => {
      if (!generatedReport) { setConfirmDialog({ visible: true, title: 'Thông báo', msg: 'Vui lòng tạo Bản nháp báo cáo trước khi gửi.', onConfirm: null }); return; }
      
      const shiftLabel = settings?.shiftTypes?.find(s => s.code === formData.shift)?.label || formData.shift;
      
      let targetEmpIds = [];
      if (currentUser?.role === 'STAFF') {
          targetEmpIds = employees.filter(e => e.role === 'ADMIN' || (e.role === 'LEADER' && e.team === currentUser.team)).map(e => e.id);
      } else {
          targetEmpIds = employees.filter(e => e.team === formData.team).map(e => e.id);
      }

      const newReportTask = {
          id: 'RPT' + Date.now(), type: 'REPORT', title: `Báo cáo Tổng hợp - ${formData.team} (Ca ${shiftLabel})`,
          date: formData.date, author: currentUser?.name || `Kíp trưởng ${formData.team}`, content: generatedReport,
          status: 'PUBLISHED', conclusion: '', acknowledgments: [], comments: [], targetEmpIds: targetEmpIds, isChatLocked: false, authorId: currentUser?.id 
      };

      onSaveReport(newReportTask, `${currentUser?.name} vừa nộp Báo cáo ca trực ngày ${formData.date}`);
      showToast('Nộp thành công', 'Báo cáo ca trực đã được gửi đi.', 'success');
      onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} transparent animationType="slide">
      <View style={smsStyles.overlay}>
        <View style={smsStyles.container}>
          <View style={smsStyles.header}>
            <Text style={smsStyles.headerTitle}>Tạo Báo Cáo Cuối Ca</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={24} color="#64748b"/></TouchableOpacity>
          </View>
          <View style={{flexDirection: Platform.OS === 'web' ? 'row' : 'column', flex: 1}}>
            <ScrollView style={smsStyles.formCol} showsVerticalScrollIndicator={false}>
              <View style={smsStyles.row}>
                 <View style={{flex: 1, marginRight: 10}}>
                     <Text style={smsStyles.label}>NGÀY</Text>
                     <TextInput style={smsStyles.input} value={formData.date} onChangeText={t => setFormData({...formData, date: t})} />
                 </View>
                 <View style={{flex: 1}}>
                     <Text style={smsStyles.label}>CA TRỰC</Text>
                     <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6}}>
                       {settings?.shiftTypes?.map(s => (
                          <TouchableOpacity key={s.code} style={[smsStyles.chip, formData.shift === s.code && smsStyles.chipActive]} onPress={() => setFormData({...formData, shift: s.code})}>
                             <Text style={[smsStyles.chipText, formData.shift === s.code && {color: '#fff'}]}>{s.label}</Text>
                          </TouchableOpacity>
                       ))}
                    </View>
                 </View>
              </View>
              
              <Text style={smsStyles.label}>KÍP TRỰC</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10}}>
                 {settings?.teams?.map(t => (
                    <TouchableOpacity key={t} style={[smsStyles.chip, formData.team === t && smsStyles.chipActive]} onPress={() => setFormData({...formData, team: t})}>
                       <Text style={[smsStyles.chipText, formData.team === t && {color: '#fff'}]}>{t}</Text>
                    </TouchableOpacity>
                 ))}
              </ScrollView>

              <View style={smsStyles.infoBox}>
                  <Text style={{fontFamily: 'Times New Roman', fontSize: 12, color: '#0369a1', lineHeight: 18}}>
                      <Feather name="info" size={12}/> Hệ thống tự quét: Có mặt <Text style={{fontWeight:'bold'}}>{staffInfo.present}/{staffInfo.total}</Text> người. Vắng: {staffInfo.absentList.length}
                  </Text>
              </View>

              <Text style={smsStyles.label}>THỜI TIẾT</Text>
              <TextInput style={smsStyles.textArea} value={formData.weather} onChangeText={t => setFormData({...formData, weather: t})} multiline />
              
              <Text style={smsStyles.label}>TRANG THIẾT BỊ</Text>
              <TextInput style={smsStyles.textArea} value={formData.equipment} onChangeText={t => setFormData({...formData, equipment: t})} multiline />
              
              <Text style={smsStyles.label}>HOẠT ĐỘNG BAY</Text>
              <TextInput style={smsStyles.textArea} value={formData.operations} onChangeText={t => setFormData({...formData, operations: t})} multiline />
              
              <Text style={smsStyles.label}>GHI CHÚ</Text>
              <TextInput style={smsStyles.textArea} value={formData.notes} onChangeText={t => setFormData({...formData, notes: t})} multiline />

              <TouchableOpacity style={smsStyles.btnGenerate} onPress={handleGenerate}>
                  <Feather name="cpu" size={16} color="#fff" />
                  <Text style={smsStyles.btnGenerateText}>Tạo Bản Nháp Báo Cáo</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={smsStyles.previewCol}>
               <View style={smsStyles.previewHeader}>
                  <Text style={smsStyles.label}>XEM TRƯỚC BÁO CÁO</Text>
                  <TouchableOpacity style={smsStyles.btnSubmit} onPress={handleSubmitReport}>
                      <Feather name="upload-cloud" size={14} color="#fff" />
                      <Text style={{color:'#fff', fontFamily:'Times New Roman', fontSize: 12, fontWeight:'bold', marginLeft:6}}>Gửi Lên Quản Lý</Text>
                  </TouchableOpacity>
               </View>
               <TextInput 
                   style={smsStyles.previewArea} 
                   value={generatedReport} 
                   onChangeText={setGeneratedReport} 
                   multiline 
                   textAlignVertical="top" 
                   placeholder="Bản xem trước sẽ hiện ở đây..." 
               />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function TasksScreen() {
  const { currentUser, employees, settings, addNotification } = useContext(AppContext);
  
  const isAdmin = currentUser?.role === 'ADMIN';
  const isLeader = currentUser?.role === 'LEADER';
  const myRoleLabel = isAdmin ? 'Quản lý' : (isLeader ? 'Kíp trưởng' : 'Nhân sự');

  const [tasks, setTasks] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const viewingTaskRef = useRef(null);
  
  const [toast, setToast] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const showToast = (title, msg, type = 'success') => {
      setToast({ title, msg, type });
      setTimeout(() => setToast(null), 3000);
  };

  const fetchTasksData = async (isInitial = false) => {
      try {
          const res = await DataService.fetchData(settings, "atc_system", "tasks");
          if (res && res.list) {
              setTasks(res.list);
              if (viewingTaskRef.current) {
                  const updated = res.list.find(t => t.id === viewingTaskRef.current.id);
                  if (updated) setViewingTask(updated);
              }
          }
      } catch (e) { console.log(e); } finally { if (isInitial) setIsLoadingData(false); }
  };

  useEffect(() => {
      fetchTasksData(true);
      const interval = setInterval(() => fetchTasksData(false), 5000); 
      return () => clearInterval(interval);
  }, [settings]);

  const updateTasksToCloud = async (newTasks) => {
      setTasks(newTasks);
      await DataService.saveData(settings, "atc_system", "tasks", { list: newTasks });
  };

  const [filter, setFilter] = useState('ALL'); 
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState(null);
  const [newConclusion, setNewConclusion] = useState(''); 
  const [newComment, setNewComment] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ visible: false, title: '', msg: '', onConfirm: null });

  const filteredTasks = tasks.filter(t => {
      if (filter !== 'ALL' && t.type !== filter) return false;
      if (isAdmin) return true; 
      return (t.targetEmpIds || []).includes(currentUser?.id) || t.authorId === currentUser?.id;
  });

  const getTypeConfig = (type) => {
    switch (type) {
      case 'REPORT': return { label: 'BÁO CÁO / SỰ CỐ', icon: 'alert-circle', color: '#dc2626', bg: '#fef2f2' };
      case 'DEBRIEF': return { label: 'BÌNH GIẢNG', icon: 'book-open', color: '#0284c7', bg: '#f0f9ff' };
      case 'TASK': return { label: 'THÔNG BÁO / NHIỆM VỤ', icon: 'briefcase', color: '#d97706', bg: '#fffbeb' };
      default: return { label: 'KHÁC', icon: 'file', color: '#475569', bg: '#f8fafc' };
    }
  };

  const handleSaveNewTask = (newTask, customNotifMessage) => {
    const newTasksArray = [newTask, ...tasks];
    updateTasksToCloud(newTasksArray);
    showToast('Tạo thành công', 'Bài đăng mới đã được phát hành.', 'success');
    if (addNotification && customNotifMessage) addNotification('Hệ thống', customNotifMessage, 'success');
  };

  const handleSaveConclusion = async () => {
      if (!newConclusion.trim()) return;
      setIsProcessing(true);
      const updatedTask = { ...viewingTask, conclusion: newConclusion };
      const newTasksArray = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
      await updateTasksToCloud(newTasksArray);
      setViewingTask(updatedTask);
      viewingTaskRef.current = updatedTask;
      setNewConclusion('');
      setIsProcessing(false);
      showToast('Đã lưu', 'Đã cập nhật Kết luận quán triệt.', 'success'); 
  };

  const toggleChatLock = async () => {
      if (!isAdmin) return;
      const updatedTask = { ...viewingTask, isChatLocked: !viewingTask.isChatLocked };
      await updateTasksToCloud(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
      setViewingTask(updatedTask);
      viewingTaskRef.current = updatedTask;
      showToast('Thành công', updatedTask.isChatLocked ? 'Đã khóa bình luận.' : 'Đã mở khóa bình luận.', 'info');
  };

  const handleSendComment = async () => {
      if (!newComment.trim() || viewingTask.isChatLocked) return;
      setIsProcessing(true);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const commentObj = { id: Date.now(), authorId: currentUser.id, authorName: currentUser.name, authorRole: myRoleLabel, text: newComment.trim(), time: timeStr };
      const updatedTask = { ...viewingTask, comments: [...(viewingTask.comments || []), commentObj] };
      await updateTasksToCloud(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
      setViewingTask(updatedTask);
      viewingTaskRef.current = updatedTask;
      setNewComment('');
      setIsProcessing(false);
      if (addNotification && viewingTask.authorId !== currentUser.id) {
           const smartMsg = `${currentUser.name} (${myRoleLabel}) vừa bình luận: "${commentObj.text.substring(0,25)}..."`;
           addNotification('Tin nhắn mới', smartMsg, 'info');
      }
  };

  const handleAcknowledge = async (empId, empName) => {
      const currentAcks = viewingTask.acknowledgments || [];
      if (currentAcks.includes(empId)) return; 
      setIsProcessing(true);
      const isSelfAck = empId === currentUser?.id;
      const updatedTask = { ...viewingTask, acknowledgments: [...currentAcks, empId] };
      const newTasksArray = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
      await updateTasksToCloud(newTasksArray);
      setViewingTask(updatedTask);
      viewingTaskRef.current = updatedTask;
      setIsProcessing(false);
      if (isSelfAck) {
          showToast('Đã xác nhận', 'Hệ thống đã ghi nhận bạn đọc nội dung này.', 'success');
          if (addNotification && viewingTask.authorId !== currentUser.id) { addNotification('Báo nhận mới', `${currentUser.name} đã xác nhận đọc bài: "${viewingTask.title}"`, 'info'); }
      } else { showToast('Thành công', `Đã xác nhận hộ cho ${empName}.`, 'success'); }
  };

  const handleAcknowledgeAll = (teamMembersList, teamName) => {
      const teamMemberIds = teamMembersList.map(e => e.id);
      const currentAcks = viewingTask.acknowledgments || [];
      setConfirmDialog({
          visible: true, title: 'Mô phỏng Toàn Kíp Báo nhận',
          msg: `Mô phỏng toàn bộ ${teamMembersList.length} nhân sự thuộc ${teamName} đồng loạt xác nhận "Đã đọc". Bạn muốn tiếp tục?`,
          onConfirm: async () => {
              const newAcks = [...new Set([...currentAcks, ...teamMemberIds])];
              const updatedTask = { ...viewingTask, acknowledgments: newAcks };
              const newTasksArray = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
              await updateTasksToCloud(newTasksArray);
              setViewingTask(updatedTask);
              viewingTaskRef.current = updatedTask;
              setConfirmDialog({ visible: false, title: '', msg: '', onConfirm: null });
              showToast('Mô phỏng hoàn tất', `Cả kíp ${teamName} đã được đánh dấu Đã đọc.`, 'success');
          }
      });
  };

  const confirmDeleteTask = (taskId, taskTitle) => {
      if (!isAdmin) return; 
      setConfirmDialog({
          visible: true, title: 'Xóa Bài Đăng',
          msg: `Bạn có chắc chắn muốn xóa bài: "${taskTitle}"? Hành động này không thể hoàn tác.`,
          onConfirm: async () => {
              const newTasksArray = tasks.filter(t => t.id !== taskId);
              await updateTasksToCloud(newTasksArray);
              setViewingTask(null);
              viewingTaskRef.current = null;
              setConfirmDialog({ visible: false, title: '', msg: '', onConfirm: null });
              showToast('Đã xóa', 'Bài đăng đã bị gỡ khỏi hệ thống.', 'success');
          }
      });
  };

  const openTask = (task) => { setViewingTask(task); viewingTaskRef.current = task; };
  const closeTask = () => { setViewingTask(null); viewingTaskRef.current = null; };

  if (isLoadingData) return <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <View style={styles.container}>
      <FloatingToast toast={toast} />

      <Modal visible={confirmDialog.visible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
              <View style={styles.confirmBox}>
                  <Text style={styles.confirmTitle}>{confirmDialog.title}</Text>
                  <Text style={styles.confirmMsg}>{confirmDialog.msg}</Text>
                  <View style={styles.confirmActions}>
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#f1f5f9'}]} onPress={() => setConfirmDialog({ ...confirmDialog, visible: false })}><Text style={[styles.modalBtnText, {color: '#64748b'}]}>Hủy bỏ</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#ef4444'}]} onPress={() => confirmDialog.onConfirm && confirmDialog.onConfirm()}><Text style={[styles.modalBtnText, {color: '#fff'}]}>Đồng ý</Text></TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

      <TaskFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSave={handleSaveNewTask} settings={settings} employees={employees} currentUser={currentUser} />
      
      <SmsReportModal 
         isOpen={isSmsModalOpen} onClose={() => setIsSmsModalOpen(false)} 
         onSaveReport={handleSaveNewTask} setConfirmDialog={setConfirmDialog} showToast={showToast}
      />

      {/* CHI TIẾT TASK MODAL - ĐÃ ĐƯỢC LÀM MỚI */}
      <Modal visible={!!viewingTask} transparent animationType="fade">
         <View style={detailStyles.overlay}>
             <View style={detailStyles.container}>
                {viewingTask && (() => {
                    const config = getTypeConfig(viewingTask.type);
                    const validEmpIds = viewingTask.targetEmpIds || [];
                    const acks = viewingTask.acknowledgments || [];
                    const myAck = acks.includes(currentUser?.id);

                    return (
                        <>
                            <View style={detailStyles.header}>
                                <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1}}>
                                    <View style={[detailStyles.headerIcon, {backgroundColor: config.bg}]}><Feather name={config.icon} size={18} color={config.color} /></View>
                                    <View style={{flex: 1}}>
                                        <Text style={detailStyles.headerTitle} numberOfLines={1}>{viewingTask.title}</Text>
                                        <Text style={detailStyles.headerSub}>{config.label} • {viewingTask.date}</Text>
                                    </View>
                                </View>
                                <View style={{flexDirection: 'row', gap: 12}}>
                                    {isAdmin && (
                                        <TouchableOpacity onPress={() => confirmDeleteTask(viewingTask.id, viewingTask.title)}>
                                            <Feather name="trash-2" size={20} color="#ef4444" />
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity onPress={closeTask}><Feather name="x" size={24} color="#64748b" /></TouchableOpacity>
                                </View>
                            </View>

                            <ScrollView style={detailStyles.body} showsVerticalScrollIndicator={false}>
                                {/* NỘI DUNG CHÍNH */}
                                <View style={detailStyles.contentCard}>
                                    <View style={detailStyles.authorRow}>
                                        <View style={detailStyles.avatar}><Text style={detailStyles.avatarText}>{viewingTask.author?.charAt(0) || 'U'}</Text></View>
                                        <View>
                                            <Text style={detailStyles.authorName}>{viewingTask.author || viewingTask.authorName}</Text>
                                            <Text style={detailStyles.authorRole}>Người đăng</Text>
                                        </View>
                                    </View>
                                    
                                    {viewingTask.type === 'TASK' && (viewingTask.deadlineDate || viewingTask.deadlineTime) && (
                                        <View style={detailStyles.deadlineBox}>
                                            <Feather name="alert-circle" size={14} color="#b91c1c" />
                                            <Text style={detailStyles.deadlineText}>Hạn hoàn thành: <Text style={{fontWeight: 'bold'}}>{viewingTask.deadlineTime} {viewingTask.deadlineDate}</Text></Text>
                                        </View>
                                    )}

                                    <Text style={detailStyles.contentText}>{viewingTask.content}</Text>
                                </View>

                                {/* KẾT LUẬN (CHỈ ADMIN/LEADER ĐƯỢC SỬA) */}
                                {(viewingTask.conclusion || isAdmin || isLeader) && (
                                    <View style={detailStyles.conclusionCard}>
                                        <View style={detailStyles.conclusionHeader}>
                                            <Feather name="flag" size={16} color="#d97706" />
                                            <Text style={detailStyles.conclusionTitle}>Kết Luận Quán Triệt</Text>
                                        </View>
                                        {viewingTask.conclusion ? (
                                            <Text style={detailStyles.conclusionText}>{viewingTask.conclusion}</Text>
                                        ) : (
                                            <View>
                                                <TextInput style={detailStyles.conclusionInput} placeholder="Thêm kết luận chỉ đạo..." value={newConclusion} onChangeText={setNewConclusion} multiline />
                                                <TouchableOpacity style={detailStyles.btnSaveConcl} onPress={handleSaveConclusion} disabled={isProcessing}>
                                                    {isProcessing ? <ActivityIndicator size="small" color="#fff"/> : <Text style={detailStyles.btnSaveConclText}>Lưu kết luận</Text>}
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* BÁO NHẬN */}
                                {validEmpIds.length > 0 && (
                                    <View style={detailStyles.ackCard}>
                                        <View style={detailStyles.ackHeader}>
                                            <Text style={detailStyles.ackTitle}>Tiến Độ Báo Nhận</Text>
                                            <Text style={detailStyles.ackCount}><Text style={{color: '#16a34a'}}>{acks.filter(id => validEmpIds.includes(id)).length}</Text> / {validEmpIds.length}</Text>
                                        </View>
                                        
                                        <View style={detailStyles.ackList}>
                                            {settings?.teams?.filter(t => t !== 'Ban Giám Đốc' && t !== 'Trung tâm').map(team => {
                                                const teamMembers = employees.filter(e => e.team === team && validEmpIds.includes(e.id));
                                                if (teamMembers.length === 0) return null;
                                                const teamAcks = teamMembers.filter(e => acks.includes(e.id)).length;
                                                
                                                return (
                                                    <View key={team} style={detailStyles.ackTeamGroup}>
                                                        <View style={detailStyles.ackTeamHeader}>
                                                            <Text style={detailStyles.ackTeamName}>{team} ({teamAcks}/{teamMembers.length})</Text>
                                                            {(isAdmin || isLeader) && teamAcks < teamMembers.length && (
                                                                <TouchableOpacity style={detailStyles.btnSimulateAck} onPress={() => handleAcknowledgeAll(teamMembers, team)}>
                                                                    <Text style={detailStyles.btnSimulateAckText}>Mô phỏng cả kíp đọc</Text>
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                        <View style={detailStyles.ackPillContainer}>
                                                            {teamMembers.map(emp => {
                                                                const isAcked = acks.includes(emp.id);
                                                                return (
                                                                    <TouchableOpacity key={emp.id} style={[detailStyles.ackPill, isAcked ? detailStyles.ackPillDone : detailStyles.ackPillPending]} onPress={() => (isAdmin || isLeader) ? handleAcknowledge(emp.id, emp.name) : null} disabled={isAcked || (!isAdmin && !isLeader)}>
                                                                        <Feather name={isAcked ? "check" : "clock"} size={10} color={isAcked ? "#16a34a" : "#b45309"} />
                                                                        <Text style={[detailStyles.ackPillText, isAcked ? {color: '#16a34a'} : {color: '#b45309'}]}>{emp.name}</Text>
                                                                    </TouchableOpacity>
                                                                );
                                                            })}
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>

                                        {!myAck && validEmpIds.includes(currentUser?.id) && (
                                            <TouchableOpacity style={detailStyles.btnSelfAck} onPress={() => handleAcknowledge(currentUser.id, currentUser.name)} disabled={isProcessing}>
                                                {isProcessing ? <ActivityIndicator size="small" color="#fff"/> : <><Feather name="check-square" size={16} color="#fff"/><Text style={detailStyles.btnSelfAckText}>Xác nhận Tôi Đã Đọc</Text></>}
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}

                                {/* BÌNH LUẬN */}
                                <View style={detailStyles.commentSection}>
                                    <View style={detailStyles.commentHeader}>
                                        <Text style={detailStyles.commentTitle}><Feather name="message-circle" size={16}/> Thảo luận ({viewingTask.comments?.length || 0})</Text>
                                        {isAdmin && (
                                            <TouchableOpacity style={detailStyles.btnLockChat} onPress={toggleChatLock}>
                                                <Feather name={viewingTask.isChatLocked ? "lock" : "unlock"} size={14} color="#64748b" />
                                                <Text style={detailStyles.btnLockChatText}>{viewingTask.isChatLocked ? 'Mở khóa' : 'Khóa mõm'}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {viewingTask.comments?.map(cmt => (
                                        <View key={cmt.id} style={detailStyles.commentBubble}>
                                            <View style={detailStyles.commentBubbleHeader}>
                                                <Text style={detailStyles.commentAuthor}>{cmt.authorName} <Text style={{color:'#94a3b8', fontSize: 11, fontWeight: 'normal'}}>({cmt.authorRole})</Text></Text>
                                                <Text style={detailStyles.commentTime}>{cmt.time}</Text>
                                            </View>
                                            <Text style={detailStyles.commentText}>{cmt.text}</Text>
                                        </View>
                                    ))}
                                    
                                    {!viewingTask.comments?.length && <Text style={detailStyles.emptyComment}>Chưa có thảo luận nào.</Text>}

                                    {!viewingTask.isChatLocked ? (
                                        <View style={detailStyles.commentInputRow}>
                                            <TextInput style={detailStyles.commentInput} placeholder="Nhập ý kiến..." value={newComment} onChangeText={setNewComment} onSubmitEditing={handleSendComment} />
                                            <TouchableOpacity style={detailStyles.btnSendComment} onPress={handleSendComment} disabled={isProcessing || !newComment.trim()}>
                                                {isProcessing ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={16} color="#fff" />}
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={detailStyles.chatLockedBox}><Feather name="lock" size={14} color="#94a3b8" /><Text style={detailStyles.chatLockedText}>Tính năng bình luận đã bị khóa.</Text></View>
                                    )}
                                </View>
                            </ScrollView>
                        </>
                    );
                })()}
             </View>
         </View>
      </Modal>

      {/* HEADER CARD MỚI CHO GIAO DIỆN TASK */}
      <View style={styles.headerCard}>
        <View style={styles.headerInfo}>
          <View style={styles.iconBox}><Feather name="layers" size={24} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Hệ Thống Nhiệm Vụ & Báo Cáo</Text>
            <Text style={styles.headerSub}>Theo dõi tiến độ, nộp báo cáo và rút kinh nghiệm trực ca</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
            <TouchableOpacity style={[styles.addBtn, {backgroundColor: '#10b981'}]} onPress={() => setIsSmsModalOpen(true)}>
                <Feather name="file-text" size={16} color="#fff" />
                <Text style={styles.addBtnText}>Nộp Báo Cáo Cuối Ca</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => setIsFormOpen(true)}>
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.addBtnText}>Tạo Bài Đăng Mới</Text>
            </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingBottom: 4 }}>
          {['ALL', 'REPORT', 'DEBRIEF', 'TASK'].map(f => {
            const isSelected = filter === f;
            const labels = { ALL: 'Tất cả Danh mục', REPORT: 'Báo Cáo / Sự Cố', DEBRIEF: 'Bình giảng / Quán triệt', TASK: 'Nhiệm vụ & Deadline' };
            return (
              <TouchableOpacity key={f} style={[styles.filterChip, isSelected && styles.filterChipActive]} onPress={() => setFilter(f)}>
                <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>{labels[f]}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* DANH SÁCH BÀI VIẾT (TỐI ƯU UI GRID/LIST) */}
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {filteredTasks.map(task => {
          const config = getTypeConfig(task.type);
          const isDraft = task.status === 'DRAFT';
          
          const validEmpIds = task.targetEmpIds || [];
          const totalEmp = validEmpIds.length;
          const ackCount = task.acknowledgments ? task.acknowledgments.filter(id => validEmpIds.includes(id)).length : 0;
          const unreadCount = totalEmp - ackCount;
          const isAllRead = totalEmp > 0 && ackCount === totalEmp;
          
          return (
            <TouchableOpacity key={task.id} style={styles.taskCard} activeOpacity={0.7} onPress={() => openTask(task)}>
              <View style={styles.cardHeader}>
                <View style={[styles.typeBadge, { backgroundColor: config.bg, borderColor: config.color }]}><Feather name={config.icon} size={12} color={config.color} style={{ marginRight: 6 }} /><Text style={[styles.typeText, { color: config.color }]}>{config.label}</Text></View>
                <View style={[styles.statusBadge, isDraft ? {backgroundColor: '#fffbeb', borderColor: '#fde68a'} : {backgroundColor: '#f0fdf4', borderColor: '#bbf7d0'}]}>
                    <Text style={[styles.statusText, isDraft ? { color: '#d97706' } : { color: '#16a34a' }]}>{isDraft ? '📝 Bản nháp' : '✅ Đã ban hành'}</Text>
                </View>
              </View>

              <Text style={styles.taskTitle}>{task.title}</Text>
              
              {task.type === 'TASK' && (task.deadlineDate || task.deadlineTime) && (
                  <View style={styles.deadlineBadge}>
                      <Feather name="clock" size={12} color="#dc2626" />
                      <Text style={styles.deadlineBadgeText}>Hạn chót: {task.deadlineTime} {task.deadlineDate}</Text>
                  </View>
              )}

              <Text style={styles.taskContent} numberOfLines={2}>{task.content}</Text>
              
              <View style={styles.cardFooter}>
                <View style={styles.footerMetaGroup}>
                    <View style={styles.footerMetaItem}><Feather name="calendar" size={12} color="#64748b" /><Text style={styles.footerText}>{task.date}</Text></View>
                    <View style={styles.footerMetaItem}><Feather name="user" size={12} color="#64748b" /><Text style={styles.footerText}>{task.authorName || task.author}</Text></View>
                    {task.comments?.length > 0 && (
                        <View style={styles.footerMetaItem}><Feather name="message-circle" size={12} color="#2563eb" /><Text style={[styles.footerText, {color: '#2563eb'}]}>{task.comments.length}</Text></View>
                    )}
                </View>
                
                {!isDraft && totalEmp > 0 && (
                    <View style={[styles.ackSummary, isAllRead ? styles.ackSummaryAll : styles.ackSummaryPending, {marginTop: Platform.OS === 'web' ? 0 : 10}]}>
                        <Feather name={isAllRead ? "check-circle" : "eye-off"} size={12} color={isAllRead ? "#16a34a" : "#b45309"} />
                        <Text style={[styles.ackSummaryText, isAllRead ? {color: '#16a34a'} : {color: '#b45309'}]}>
                            {isAllRead ? 'Đã nhận đủ' : `Thiếu: ${unreadCount}/${totalEmp}`}
                        </Text>
                    </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {filteredTasks.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}><Feather name="inbox" size={40} color="#94a3b8" /></View>
            <Text style={styles.emptyTitle}>Chưa có Dữ Liệu</Text>
            <Text style={styles.emptyText}>Không tìm thấy bài đăng nào phù hợp với bộ lọc hoặc quyền hạn của bạn.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 16 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  confirmBox: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, elevation: 10, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.1, shadowRadius: 20 },
  confirmTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
  confirmMsg: { fontFamily: 'Times New Roman', fontSize: 14, color: '#475569', marginBottom: 24, lineHeight: 22 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalBtnText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold' },

  toastContainer: { position: 'absolute', top: 20, alignSelf: 'center', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: {width: 0, height: 4}, borderLeftWidth: 4, zIndex: 1000 },
  toastTitle: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  toastMsg: { fontFamily: 'Times New Roman', fontSize: 12, color: '#475569', marginTop: 2 },

  headerCard: { 
      flexDirection: 'row', 
      flexWrap: 'wrap', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      backgroundColor: '#fff', 
      padding: 20, 
      borderRadius: 16, 
      borderWidth: 1, 
      borderColor: '#e2e8f0', 
      marginBottom: 16, 
      elevation: 2,
      shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: {width: 0, height: 2}, shadowRadius: 8,
      gap: 16 
  },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 260 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: Platform.OS === 'web' ? 0 : 4 },
  
  iconBox: { backgroundColor: '#2563eb', padding: 12, borderRadius: 12, marginRight: 16 },
  headerTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  headerSub: { fontFamily: 'Times New Roman', fontSize: 13, color: '#64748b', marginTop: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, elevation: 1 },
  addBtnText: { fontFamily: 'Times New Roman', color: '#fff', fontWeight: 'bold', fontSize: 13, marginLeft: 8 },
  
  filterWrapper: { marginBottom: 16 },
  filterScroll: { flexDirection: 'row' },
  filterChip: { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24, borderWidth: 1, borderColor: '#cbd5e1', marginRight: 10 },
  filterChipActive: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
  filterText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  filterTextActive: { color: '#fff' },
  
  listContainer: { flex: 1 },
  taskCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: {width: 0, height: 2}, shadowRadius: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  typeText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  statusText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold' },
  taskTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, lineHeight: 24 },
  deadlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12, gap: 6, borderWidth: 1, borderColor: '#fecaca' },
  deadlineBadgeText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#b91c1c' },
  taskContent: { fontFamily: 'Times New Roman', fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 16 },
  
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderColor: '#f1f5f9' },
  footerMetaGroup: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  footerMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontWeight: 'bold' },
  ackSummary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1 },
  ackSummaryPending: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
  ackSummaryAll: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  ackSummaryText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold' },
  
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIconWrap: { backgroundColor: '#e2e8f0', padding: 20, borderRadius: 40, marginBottom: 16 },
  emptyTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#334155' },
  emptyText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#94a3b8', marginTop: 8, textAlign: 'center', maxWidth: 300, lineHeight: 20 }
});

const detailStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: Platform.OS === 'web' ? 40 : 16 },
  container: { backgroundColor: '#f8fafc', borderRadius: 16, width: '100%', maxWidth: 800, height: '90%', overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: {width: 0, height: 10}, shadowRadius: 20 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  headerIcon: { padding: 10, borderRadius: 10 },
  headerTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  headerSub: { fontFamily: 'Courier New', fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: 'bold' },
  
  body: { flex: 1, padding: 20 },
  
  contentCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#fff' },
  authorName: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  authorRole: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b' },
  deadlineBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#fecaca' },
  deadlineText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#991b1b' },
  contentText: { fontFamily: 'Times New Roman', fontSize: 15, color: '#334155', lineHeight: 26 },

  conclusionCard: { backgroundColor: '#fffbeb', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#fde68a' },
  conclusionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  conclusionTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#b45309' },
  conclusionText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#92400e', lineHeight: 24, fontStyle: 'italic', backgroundColor: '#fef3c7', padding: 16, borderRadius: 8 },
  conclusionInput: { fontFamily: 'Times New Roman', backgroundColor: '#fff', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 8, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 12 },
  btnSaveConcl: { backgroundColor: '#d97706', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnSaveConclText: { fontFamily: 'Times New Roman', color: '#fff', fontWeight: 'bold', fontSize: 13 },

  ackCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  ackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  ackTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  ackCount: { fontFamily: 'Courier New', fontSize: 16, fontWeight: 'bold', color: '#64748b' },
  ackList: { marginBottom: 16 },
  ackTeamGroup: { marginBottom: 16 },
  ackTeamHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ackTeamName: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569' },
  btnSimulateAck: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  btnSimulateAckText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#475569' },
  ackPillContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ackPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  ackPillDone: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  ackPillPending: { backgroundColor: '#fff', borderColor: '#cbd5e1' },
  ackPillText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold' },
  btnSelfAck: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 8, elevation: 2 },
  btnSelfAckText: { fontFamily: 'Times New Roman', color: '#fff', fontWeight: 'bold', fontSize: 14 },

  commentSection: { backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  commentTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  btnLockChat: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  btnLockChatText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#475569' },
  commentBubble: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  commentBubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  commentAuthor: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#334155' },
  commentTime: { fontFamily: 'Courier New', fontSize: 10, color: '#94a3b8' },
  commentText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#1e293b', lineHeight: 22 },
  emptyComment: { fontFamily: 'Times New Roman', fontSize: 13, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginVertical: 10 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  commentInput: { flex: 1, fontFamily: 'Times New Roman', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14 },
  btnSendComment: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  chatLockedBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, marginTop: 10 },
  chatLockedText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontStyle: 'italic' }
});

const smsStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: Platform.OS === 'web' ? 40 : 16 },
  container: { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 900, height: Platform.OS === 'web' ? '85%' : '90%', overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: {width: 0, height: 10}, shadowRadius: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#f1f5f9', backgroundColor: '#fff' },
  headerTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  formCol: { flex: 1.2, padding: 20, borderRightWidth: Platform.OS === 'web' ? 1 : 0, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  previewCol: { flex: 1, padding: 20, backgroundColor: '#fff', borderTopWidth: Platform.OS === 'web' ? 0 : 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 10 },
  label: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 6, letterSpacing: 0.5 },
  input: { fontFamily: 'Courier New', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fff', fontWeight: 'bold' },
  textArea: { fontFamily: 'Times New Roman', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#fff', height: 70, textAlignVertical: 'top', marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', marginRight: 8, marginBottom: 8 },
  chipActive: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
  chipText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569' },
  infoBox: { backgroundColor: '#f0f9ff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd', marginBottom: 16 },
  btnGenerate: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#10b981', padding: 14, borderRadius: 8, gap: 8, elevation: 1 },
  btnGenerateText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#fff' },
  previewHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 },
  btnSubmit: { flexDirection: 'row', backgroundColor: '#0284c7', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center', elevation: 2 },
  previewArea: { flex: 1, fontFamily: 'Courier New', fontSize: 13, color: '#1e293b', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, lineHeight: 22, minHeight: 150 }
});