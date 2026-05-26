import Spinner from "../components/Spinner.jsx";
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import React, { useState, useEffect, useRef, useContext } from 'react';


import TaskFormModal from '../components/TaskFormModal';
import { DataService } from '../services/DataService';
import { AppContext } from '../context/AppContext';

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const FloatingToast = ({ toast }) => {
    if (!toast) return null;
    const isSuccess = toast.type === 'success';
    return (
        <div style={{...styles.toastContainer, borderLeftColor: isSuccess ? '#10b981' : '#3b82f6'}}>
            <Icon name={isSuccess ? "check-circle" : "info"} size={20} color={isSuccess ? '#10b981' : '#3b82f6'} />
            <div style={{ marginLeft: 12 }}>
                <span style={styles.toastTitle}>{toast.title}</span>
                <span style={styles.toastMsg}>{toast.msg}</span>
            </div>
        </div>
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
    <Modal visible={isOpen}>
      <div style={smsStyles.header}>
        <span style={smsStyles.headerTitle}>Tạo Báo Cáo Cuối Ca</span>
        <button type="button" onClick={onClose}><Icon name="x" size={24} color="#64748b"/></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', maxHeight: '72vh' }}>
            <div style={{ ...smsStyles.formCol, overflowY: 'auto' }}>
              <div style={smsStyles.row}>
                 <div style={{flex: 1, marginRight: 10}}>
                     <span style={smsStyles.label}>NGÀY</span>
                     <input style={smsStyles.input} value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                 </div>
                 <div style={{flex: 1}}>
                     <span style={smsStyles.label}>CA TRỰC</span>
                     <div style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6}}>
                       {settings?.shiftTypes?.map(s => (
                          <button type="button" key={s.code} style={{...smsStyles.chip, ...(formData.shift === s.code && smsStyles.chipActive)}} onClick={() => setFormData({...formData, shift: s.code})}>
                             <span style={{...smsStyles.chipText, ...(formData.shift === s.code && {color: '#fff'})}}>{s.label}</span>
                          </button>
                       ))}
                    </div>
                 </div>
              </div>

              <span style={smsStyles.label}>KÍP TRỰC</span>
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
                 {settings?.teams?.map(t => (
                    <button type="button" key={t} style={{...smsStyles.chip, ...(formData.team === t && smsStyles.chipActive)}} onClick={() => setFormData({...formData, team: t})}>
                       <span style={{...smsStyles.chipText, ...(formData.team === t && {color: '#fff'})}}>{t}</span>
                    </button>
                 ))}
              </div>

              <div style={smsStyles.infoBox}>
                  <span style={{fontFamily: 'Times New Roman', fontSize: 12, color: '#0369a1', lineHeight: '18px'}}>
                      <Icon name="info" size={12}/> Hệ thống tự quét: Có mặt <span style={{fontWeight:'bold'}}>{staffInfo.present}/{staffInfo.total}</span> người. Vắng: {staffInfo.absentList.length}
                  </span>
              </div>

              <span style={smsStyles.label}>THỜI TIẾT</span>
              <input style={smsStyles.textArea} value={formData.weather} onChange={(e) => setFormData({...formData, weather: e.target.value})}  />

              <span style={smsStyles.label}>TRANG THIẾT BỊ</span>
              <input style={smsStyles.textArea} value={formData.equipment} onChange={(e) => setFormData({...formData, equipment: e.target.value})}  />

              <span style={smsStyles.label}>HOẠT ĐỘNG BAY</span>
              <input style={smsStyles.textArea} value={formData.operations} onChange={(e) => setFormData({...formData, operations: e.target.value})}  />

              <span style={smsStyles.label}>GHI CHÚ</span>
              <input style={smsStyles.textArea} value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})}  />

              <button type="button" style={smsStyles.btnGenerate} onClick={handleGenerate}>
                  <Icon name="cpu" size={16} color="#fff" />
                  <span style={smsStyles.btnGenerateText}>Tạo Bản Nháp Báo Cáo</span>
              </button>
            </div>

            <div style={{ ...smsStyles.previewCol, overflowY: 'auto' }}>
               <div style={smsStyles.previewHeader}>
                  <span style={smsStyles.label}>XEM TRƯỚC BÁO CÁO</span>
                  <button type="button" style={smsStyles.btnSubmit} onClick={handleSubmitReport}>
                      <Icon name="upload-cloud" size={14} color="#fff" />
                      <span style={{color:'#fff', fontFamily:'Times New Roman', fontSize: 12, fontWeight:'bold', marginLeft:6}}>Gửi Lên Quản Lý</span>
                  </button>
               </div>
               <input
                   style={smsStyles.previewArea}
                   value={generatedReport}
                   onChange={(e) => setGeneratedReport(e.target.value)}


                   placeholder="Bản xem trước sẽ hiện ở đây..."
               />
            </div>
          </div>
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
          const res = await DataService.fetchData(null, null, "tasks");
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
  }, []); // eslint-disable-line

  // ── Cập nhật task riêng lẻ (tránh race condition bulk-replace) ────────
  const persistTaskUpdate = async (updatedTask) => {
      try { await DataService.updateItem('tasks', updatedTask.id, updatedTask); } catch {}
  };

  const persistNewTask = async (task) => {
      try { return await DataService.createItem('tasks', task); } catch { return task; }
  };

  const persistDeleteTask = async (id) => {
      try { await DataService.deleteItem('tasks', id); } catch {}
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

  const handleSaveNewTask = async (newTask, customNotifMessage) => {
    setTasks(prev => [newTask, ...prev]);
    await persistNewTask(newTask);
    showToast('Tạo thành công', 'Bài đăng mới đã được phát hành.', 'success');
    if (addNotification && customNotifMessage) addNotification('Hệ thống', customNotifMessage, 'success');
  };

  const handleSaveConclusion = async () => {
      if (!newConclusion.trim()) return;
      setIsProcessing(true);
      const updatedTask = { ...viewingTask, conclusion: newConclusion };
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      await persistTaskUpdate(updatedTask);
      setViewingTask(updatedTask);
      viewingTaskRef.current = updatedTask;
      setNewConclusion('');
      setIsProcessing(false);
      showToast('Đã lưu', 'Đã cập nhật Kết luận quán triệt.', 'success');
  };

  const toggleChatLock = async () => {
      if (!isAdmin) return;
      const updatedTask = { ...viewingTask, isChatLocked: !viewingTask.isChatLocked };
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      await persistTaskUpdate(updatedTask);
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
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      await persistTaskUpdate(updatedTask);
      setViewingTask(updatedTask);
      viewingTaskRef.current = updatedTask;
      setNewComment('');
      setIsProcessing(false);
  };

  const handleAcknowledge = async (empId, empName) => {
      const currentAcks = viewingTask.acknowledgments || [];
      if (currentAcks.includes(empId)) return;
      setIsProcessing(true);
      const isSelfAck = empId === currentUser?.id;
      const updatedTask = { ...viewingTask, acknowledgments: [...currentAcks, empId] };
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      await persistTaskUpdate(updatedTask);
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
              setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
              await persistTaskUpdate(updatedTask);
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
              setTasks(prev => prev.filter(t => t.id !== taskId));
              await persistDeleteTask(taskId);
              setViewingTask(null);
              viewingTaskRef.current = null;
              setConfirmDialog({ visible: false, title: '', msg: '', onConfirm: null });
              showToast('Đã xóa', 'Bài đăng đã bị gỡ khỏi hệ thống.', 'success');
          }
      });
  };

  const openTask = (task) => { setViewingTask(task); viewingTaskRef.current = task; };
  const closeTask = () => { setViewingTask(null); viewingTaskRef.current = null; };

  if (isLoadingData) return <div style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><Spinner size="large" color="#2563eb" /></div>;

  return (
    <div style={styles.container}>
      <FloatingToast toast={toast} />

      <Modal visible={confirmDialog.visible} maxWidth="400px" zIndex={10001}>
          <div style={styles.confirmBox}>
              <span style={styles.confirmTitle}>{confirmDialog.title}</span>
              <span style={styles.confirmMsg}>{confirmDialog.msg}</span>
              <div style={styles.confirmActions}>
                  <button type="button" style={{...styles.modalBtn, backgroundColor: '#f1f5f9'}} onClick={() => setConfirmDialog({ ...confirmDialog, visible: false })}><span style={{...styles.modalBtnText, color: '#64748b'}}>Hủy bỏ</span></button>
                  <button type="button" style={{...styles.modalBtn, backgroundColor: '#ef4444'}} onClick={() => confirmDialog.onConfirm && confirmDialog.onConfirm()}><span style={{...styles.modalBtnText, color: '#fff'}}>Đồng ý</span></button>
              </div>
          </div>
      </Modal>

      <TaskFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSave={handleSaveNewTask} settings={settings} employees={employees} currentUser={currentUser} />

      <SmsReportModal
         isOpen={isSmsModalOpen} onClose={() => setIsSmsModalOpen(false)}
         onSaveReport={handleSaveNewTask} setConfirmDialog={setConfirmDialog} showToast={showToast}
      />

      {/* CHI TIẾT TASK MODAL - ĐÃ ĐƯỢC LÀM MỚI */}
      <Modal visible={!!viewingTask} maxWidth="860px">
         <div style={{ backgroundColor: '#f8fafc' }}>
                {viewingTask && (() => {
                    const config = getTypeConfig(viewingTask.type);
                    const validEmpIds = viewingTask.targetEmpIds || [];
                    const acks = viewingTask.acknowledgments || [];
                    const myAck = acks.includes(currentUser?.id);

                    return (
                        <>
                            <div style={detailStyles.header}>
                                <div style={{flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1}}>
                                    <div style={{...detailStyles.headerIcon, backgroundColor: config.bg}}><Icon name={config.icon} size={18} color={config.color} /></div>
                                    <div style={{flex: 1}}>
                                        <span style={detailStyles.headerTitle} >{viewingTask.title}</span>
                                        <span style={detailStyles.headerSub}>{config.label} • {formatDate(viewingTask.date || viewingTask.dueDate)}</span>
                                    </div>
                                </div>
                                <div style={{flexDirection: 'row', gap: 12}}>
                                    {isAdmin && (
                                        <button type="button" onClick={() => confirmDeleteTask(viewingTask.id, viewingTask.title)}>
                                            <Icon name="trash-2" size={20} color="#ef4444" />
                                        </button>
                                    )}
                                    <button type="button" onClick={closeTask}><Icon name="x" size={24} color="#64748b" /></button>
                                </div>
                            </div>

                            <div style={detailStyles.body}>
                                {/* NỘI DUNG CHÍNH */}
                                <div style={detailStyles.contentCard}>
                                    <div style={detailStyles.authorRow}>
                                        <div style={detailStyles.avatar}><span style={detailStyles.avatarText}>{viewingTask.author?.charAt(0) || 'U'}</span></div>
                                        <div>
                                            <span style={detailStyles.authorName}>{viewingTask.author || viewingTask.authorName}</span>
                                            <span style={detailStyles.authorRole}>Người đăng</span>
                                        </div>
                                    </div>

                                    {viewingTask.type === 'TASK' && (viewingTask.deadlineDate || viewingTask.deadlineTime) && (
                                        <div style={detailStyles.deadlineBox}>
                                            <Icon name="alert-circle" size={14} color="#b91c1c" />
                                            <span style={detailStyles.deadlineText}>Hạn hoàn thành: <span style={{fontWeight: 'bold'}}>{viewingTask.deadlineTime} {viewingTask.deadlineDate}</span></span>
                                        </div>
                                    )}

                                    <span style={detailStyles.contentText}>{viewingTask.content}</span>
                                </div>

                                {/* KẾT LUẬN (CHỈ ADMIN/LEADER ĐƯỢC SỬA) */}
                                {(viewingTask.conclusion || isAdmin || isLeader) && (
                                    <div style={detailStyles.conclusionCard}>
                                        <div style={detailStyles.conclusionHeader}>
                                            <Icon name="flag" size={16} color="#d97706" />
                                            <span style={detailStyles.conclusionTitle}>Kết Luận Quán Triệt</span>
                                        </div>
                                        {viewingTask.conclusion ? (
                                            <span style={detailStyles.conclusionText}>{viewingTask.conclusion}</span>
                                        ) : (
                                            <div>
                                                <input style={detailStyles.conclusionInput} placeholder="Thêm kết luận chỉ đạo..." value={newConclusion} onChange={(e) => setNewConclusion(e.target.value)}  />
                                                <button type="button" style={detailStyles.btnSaveConcl} onClick={handleSaveConclusion} disabled={isProcessing}>
                                                    {isProcessing ? <Spinner size="small" color="#fff"/> : <span style={detailStyles.btnSaveConclText}>Lưu kết luận</span>}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* BÁO NHẬN */}
                                {validEmpIds.length > 0 && (
                                    <div style={detailStyles.ackCard}>
                                        <div style={detailStyles.ackHeader}>
                                            <span style={detailStyles.ackTitle}>Tiến Độ Báo Nhận</span>
                                            <span style={detailStyles.ackCount}><span style={{color: '#16a34a'}}>{acks.filter(id => validEmpIds.includes(id)).length}</span> / {validEmpIds.length}</span>
                                        </div>

                                        <div style={detailStyles.ackList}>
                                            {settings?.teams?.filter(t => t !== 'Ban Giám Đốc' && t !== 'Trung tâm').map(team => {
                                                const teamMembers = employees.filter(e => e.team === team && validEmpIds.includes(e.id));
                                                if (teamMembers.length === 0) return null;
                                                const teamAcks = teamMembers.filter(e => acks.includes(e.id)).length;

                                                return (
                                                    <div key={team} style={detailStyles.ackTeamGroup}>
                                                        <div style={detailStyles.ackTeamHeader}>
                                                            <span style={detailStyles.ackTeamName}>{team} ({teamAcks}/{teamMembers.length})</span>
                                                            {(isAdmin || isLeader) && teamAcks < teamMembers.length && (
                                                                <button type="button" style={detailStyles.btnSimulateAck} onClick={() => handleAcknowledgeAll(teamMembers, team)}>
                                                                    <span style={detailStyles.btnSimulateAckText}>Mô phỏng cả kíp đọc</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div style={detailStyles.ackPillContainer}>
                                                            {teamMembers.map(emp => {
                                                                const isAcked = acks.includes(emp.id);
                                                                return (
                                                                    <button type="button" key={emp.id} style={{...detailStyles.ackPill, ...(isAcked ? detailStyles.ackPillDone : detailStyles.ackPillPending)}} onClick={() => (isAdmin || isLeader) ? handleAcknowledge(emp.id, emp.name) : null} disabled={isAcked || (!isAdmin && !isLeader)}>
                                                                        <Icon name={isAcked ? "check" : "clock"} size={10} color={isAcked ? "#16a34a" : "#b45309"} />
                                                                        <span style={{...detailStyles.ackPillText, ...(isAcked ? {color: '#16a34a'} : {color: '#b45309'})}}>{emp.name}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {!myAck && validEmpIds.includes(currentUser?.id) && (
                                            <button type="button" style={detailStyles.btnSelfAck} onClick={() => handleAcknowledge(currentUser.id, currentUser.name)} disabled={isProcessing}>
                                                {isProcessing ? <Spinner size="small" color="#fff"/> : <><Icon name="check-square" size={16} color="#fff"/><span style={detailStyles.btnSelfAckText}>Xác nhận Tôi Đã Đọc</span></>}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* BÌNH LUẬN */}
                                <div style={detailStyles.commentSection}>
                                    <div style={detailStyles.commentHeader}>
                                        <span style={detailStyles.commentTitle}><Icon name="message-circle" size={16}/> Thảo luận ({viewingTask.comments?.length || 0})</span>
                                        {isAdmin && (
                                            <button type="button" style={detailStyles.btnLockChat} onClick={toggleChatLock}>
                                                <Icon name={viewingTask.isChatLocked ? "lock" : "unlock"} size={14} color="#64748b" />
                                                <span style={detailStyles.btnLockChatText}>{viewingTask.isChatLocked ? 'Mở khóa' : 'Khóa chat'}</span>
                                            </button>
                                        )}
                                    </div>

                                    {viewingTask.comments?.map(cmt => (
                                        <div key={cmt.id} style={detailStyles.commentBubble}>
                                            <div style={detailStyles.commentBubbleHeader}>
                                                <span style={detailStyles.commentAuthor}>{cmt.authorName} <span style={{color:'#94a3b8', fontSize: 11, fontWeight: 'normal'}}>({cmt.authorRole})</span></span>
                                                <span style={detailStyles.commentTime}>{cmt.time}</span>
                                            </div>
                                            <span style={detailStyles.commentText}>{cmt.text}</span>
                                        </div>
                                    ))}

                                    {!viewingTask.comments?.length && <span style={detailStyles.emptyComment}>Chưa có thảo luận nào.</span>}

                                    {!viewingTask.isChatLocked ? (
                                        <div style={detailStyles.commentInputRow}>
                                            <input style={detailStyles.commentInput} placeholder="Nhập ý kiến..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                                            <button type="button" style={detailStyles.btnSendComment} onClick={handleSendComment} disabled={isProcessing || !newComment.trim()}>
                                                {isProcessing ? <Spinner size="small" color="#fff" /> : <Icon name="send" size={16} color="#fff" />}
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={detailStyles.chatLockedBox}><Icon name="lock" size={14} color="#94a3b8" /><span style={detailStyles.chatLockedText}>Tính năng bình luận đã bị khóa.</span></div>
                                    )}
                                </div>
                            </div>
                        </>
                    );
                })()}
         </div>
      </Modal>

      {/* HEADER CARD MỚI CHO GIAO DIỆN TASK */}
      <div style={styles.headerCard}>
        <div style={styles.headerInfo}>
          <div style={styles.iconBox}><Icon name="layers" size={24} color="#fff" /></div>
          <div style={{ flex: 1 }}>
            <span style={styles.headerTitle}>Hệ Thống Nhiệm Vụ & Báo Cáo</span>
            <span style={styles.headerSub}>Theo dõi tiến độ, nộp báo cáo và rút kinh nghiệm trực ca</span>
          </div>
        </div>

        <div style={styles.headerActions}>
            <button type="button" style={{...styles.addBtn, backgroundColor: '#10b981'}} onClick={() => setIsSmsModalOpen(true)}>
                <Icon name="file-text" size={16} color="#fff" />
                <span style={styles.addBtnText}>Nộp Báo Cáo Cuối Ca</span>
            </button>
            <button type="button" style={styles.addBtn} onClick={() => setIsFormOpen(true)}>
                <Icon name="plus" size={16} color="#fff" />
                <span style={styles.addBtnText}>Tạo Bài Đăng Mới</span>
            </button>
        </div>
      </div>

      <div style={styles.filterWrapper}>
        <div style={Object.assign({}, styles.filterScroll, { display: 'flex', flexWrap: 'wrap', paddingBottom: 4 })}>
          {['ALL', 'REPORT', 'DEBRIEF', 'TASK'].map(f => {
            const isSelected = filter === f;
            const labels = { ALL: 'Tất cả Danh mục', REPORT: 'Báo Cáo / Sự Cố', DEBRIEF: 'Bình giảng / Quán triệt', TASK: 'Nhiệm vụ & Deadline' };
            return (
              <button type="button" key={f} style={{...styles.filterChip, ...(isSelected && styles.filterChipActive)}} onClick={() => setFilter(f)}>
                <span style={{...styles.filterText, ...(isSelected && styles.filterTextActive)}}>{labels[f]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* DANH SÁCH BÀI VIẾT (TỐI ƯU UI GRID/LIST) */}
      <div style={Object.assign({}, styles.listContainer, { paddingBottom: 40 })}>
        {filteredTasks.map(task => {
          const config = getTypeConfig(task.type);
          const isDraft = task.status === 'DRAFT';

          const validEmpIds = task.targetEmpIds || [];
          const totalEmp = validEmpIds.length;
          const ackCount = task.acknowledgments ? task.acknowledgments.filter(id => validEmpIds.includes(id)).length : 0;
          const unreadCount = totalEmp - ackCount;
          const isAllRead = totalEmp > 0 && ackCount === totalEmp;

          return (
            <button type="button" key={task.id} style={styles.taskCard} activeOpacity={0.7} onClick={() => openTask(task)}>
              <div style={styles.cardHeader}>
                <div style={{...styles.typeBadge, backgroundColor: config.bg, borderColor: config.color}}><Icon name={config.icon} size={12} color={config.color} style={{ marginRight: 6 }} /><span style={{...styles.typeText, color: config.color}}>{config.label}</span></div>
                <div style={{...styles.statusBadge, ...(isDraft ? {backgroundColor: '#fffbeb', borderColor: '#fde68a'} : {backgroundColor: '#f0fdf4', borderColor: '#bbf7d0'})}}>
                    <span style={{...styles.statusText, ...(isDraft ? {color: '#d97706'} : {color: '#16a34a'})}}>{isDraft ? '📝 Bản nháp' : '✅ Đã ban hành'}</span>
                </div>
              </div>

              <span style={styles.taskTitle}>{task.title}</span>

              {task.type === 'TASK' && (task.deadlineDate || task.deadlineTime) && (
                  <div style={styles.deadlineBadge}>
                      <Icon name="clock" size={12} color="#dc2626" />
                      <span style={styles.deadlineBadgeText}>Hạn chót: {task.deadlineTime} {task.deadlineDate}</span>
                  </div>
              )}

              <span style={styles.taskContent} >{task.content}</span>

              <div style={styles.cardFooter}>
                <div style={styles.footerMetaGroup}>
                    <div style={styles.footerMetaItem}><Icon name="calendar" size={12} color="#64748b" /><span style={styles.footerText}>{formatDate(task.date || task.dueDate)}</span></div>
                    <div style={styles.footerMetaItem}><Icon name="user" size={12} color="#64748b" /><span style={styles.footerText}>{task.authorName || task.author}</span></div>
                    {task.comments?.length > 0 && (
                        <div style={styles.footerMetaItem}><Icon name="message-circle" size={12} color="#2563eb" /><span style={{...styles.footerText, color: '#2563eb'}}>{task.comments.length}</span></div>
                    )}
                </div>

                {!isDraft && totalEmp > 0 && (
                    <div style={{...styles.ackSummary, ...(isAllRead ? styles.ackSummaryAll : styles.ackSummaryPending), marginTop: 0}}>
                        <Icon name={isAllRead ? "check-circle" : "eye-off"} size={12} color={isAllRead ? "#16a34a" : "#b45309"} />
                        <span style={{...styles.ackSummaryText, ...(isAllRead ? {color: '#16a34a'} : {color: '#b45309'})}}>
                            {isAllRead ? 'Đã nhận đủ' : `Thiếu: ${unreadCount}/${totalEmp}`}
                        </span>
                    </div>
                )}
              </div>
            </button>
          );
        })}

        {filteredTasks.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIconWrap}><Icon name="inbox" size={40} color="#94a3b8" /></div>
            <span style={styles.emptyTitle}>Chưa có Dữ Liệu</span>
            <span style={styles.emptyText}>Không tìm thấy bài đăng nào phù hợp với bộ lọc hoặc quyền hạn của bạn.</span>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  confirmBox: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, boxShadow: "0 4px 6px rgba(0,0,0,0.08)", shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.1, shadowRadius: 20 },
  confirmTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
  confirmMsg: { fontFamily: 'Times New Roman', fontSize: 14, color: '#475569', marginBottom: 24, lineHeight: '22px' },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtn: { paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20, borderRadius: 8 },
  modalBtnText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold' },

  toastContainer: { position: 'absolute', top: 20, alignSelf: 'center', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 12, paddingLeft: 20, paddingRight: 20, borderRadius: 8, boxShadow: "0 4px 6px rgba(0,0,0,0.08)", shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: {width: 0, height: 4}, borderLeftWidth: 4, zIndex: 1000 },
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
      boxShadow: "0 4px 6px rgba(0,0,0,0.08)",
      shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: {width: 0, height: 2}, shadowRadius: 8,
      gap: 16
  },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 260 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: true ? 0 : 4 },

  iconBox: { backgroundColor: '#2563eb', padding: 12, borderRadius: 12, marginRight: 16 },
  headerTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  headerSub: { fontFamily: 'Times New Roman', fontSize: 13, color: '#64748b', marginTop: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingTop: 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16, borderRadius: 10, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  addBtnText: { fontFamily: 'Times New Roman', color: '#fff', fontWeight: 'bold', fontSize: 13, marginLeft: 8 },

  filterWrapper: { marginBottom: 16 },
  filterScroll: { flexDirection: 'row' },
  filterChip: { backgroundColor: '#fff', paddingTop: 10, paddingBottom: 10, paddingLeft: 18, paddingRight: 18, borderRadius: 24, borderWidth: 1, borderColor: '#cbd5e1', marginRight: 10 },
  filterChipActive: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
  filterText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  filterTextActive: { color: '#fff' },

  listContainer: { flex: 1, overflowY: 'auto', display: 'block' },
  taskCard: { display: 'block', width: '100%', textAlign: 'left', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, marginBottom: 16, boxShadow: "0 4px 6px rgba(0,0,0,0.08)", shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: {width: 0, height: 2}, shadowRadius: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10, borderRadius: 8, borderWidth: 1 },
  typeText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
  statusBadge: { paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10, borderRadius: 8, borderWidth: 1 },
  statusText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold' },
  taskTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, lineHeight: '24px', display: 'block' },
  deadlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12, gap: 6, borderWidth: 1, borderColor: '#fecaca' },
  deadlineBadgeText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#b91c1c' },
  taskContent: { fontFamily: 'Times New Roman', fontSize: 14, color: '#475569', lineHeight: '22px', marginBottom: 16, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderColor: '#f1f5f9' },
  footerMetaGroup: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  footerMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontWeight: 'bold' },
  ackSummary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6, paddingBottom: 6, paddingLeft: 12, paddingRight: 12, borderRadius: 16, borderWidth: 1 },
  ackSummaryPending: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
  ackSummaryAll: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  ackSummaryText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold' },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIconWrap: { backgroundColor: '#e2e8f0', padding: 20, borderRadius: 40, marginBottom: 16 },
  emptyTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#334155' },
  emptyText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#94a3b8', marginTop: 8, textAlign: 'center', maxWidth: 300, lineHeight: '20px' }
};

const detailStyles = {
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: true ? 40 : 16 },
  container: { backgroundColor: '#f8fafc', borderRadius: 16, width: '100%', maxWidth: 800, height: '90%', overflow: 'hidden', boxShadow: "0 4px 6px rgba(0,0,0,0.08)", shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: {width: 0, height: 10}, shadowRadius: 20 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  headerIcon: { padding: 10, borderRadius: 10 },
  headerTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  headerSub: { fontFamily: 'Courier New', fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: 'bold' },

  body: { padding: 20, overflowY: 'auto', maxHeight: 'calc(90vh - 80px)' },

  contentCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#fff' },
  authorName: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  authorRole: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b' },
  deadlineBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#fecaca' },
  deadlineText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#991b1b' },
  contentText: { fontFamily: 'Times New Roman', fontSize: 15, color: '#334155', lineHeight: '26px', display: 'block', whiteSpace: 'pre-wrap' },

  conclusionCard: { backgroundColor: '#fffbeb', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#fde68a' },
  conclusionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  conclusionTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#b45309' },
  conclusionText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#92400e', lineHeight: '24px', fontStyle: 'italic', backgroundColor: '#fef3c7', padding: 16, borderRadius: 8, display: 'block' },
  conclusionInput: { fontFamily: 'Times New Roman', backgroundColor: '#fff', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 8, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 12 },
  btnSaveConcl: { backgroundColor: '#d97706', paddingTop: 10, paddingBottom: 10, borderRadius: 8, alignItems: 'center' },
  btnSaveConclText: { fontFamily: 'Times New Roman', color: '#fff', fontWeight: 'bold', fontSize: 13 },

  ackCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  ackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  ackTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  ackCount: { fontFamily: 'Courier New', fontSize: 16, fontWeight: 'bold', color: '#64748b' },
  ackList: { marginBottom: 16 },
  ackTeamGroup: { marginBottom: 16 },
  ackTeamHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ackTeamName: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569' },
  btnSimulateAck: { backgroundColor: '#f1f5f9', paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  btnSimulateAckText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#475569' },
  ackPillContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ackPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 16, borderWidth: 1 },
  ackPillDone: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  ackPillPending: { backgroundColor: '#fff', borderColor: '#cbd5e1' },
  ackPillText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold' },
  btnSelfAck: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#10b981', paddingTop: 14, paddingBottom: 14, borderRadius: 8, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  btnSelfAckText: { fontFamily: 'Times New Roman', color: '#fff', fontWeight: 'bold', fontSize: 14 },

  commentSection: { backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  commentTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  btnLockChat: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f1f5f9', paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: 6 },
  btnLockChatText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#475569' },
  commentBubble: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  commentBubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  commentAuthor: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#334155' },
  commentTime: { fontFamily: 'Courier New', fontSize: 10, color: '#94a3b8' },
  commentText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#1e293b', lineHeight: '22px', display: 'block' },
  emptyComment: { fontFamily: 'Times New Roman', fontSize: 13, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginTop: 10 , marginBottom: 10 ,},
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  commentInput: { flex: 1, fontFamily: 'Times New Roman', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 20, paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, fontSize: 14 },
  btnSendComment: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  chatLockedBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, marginTop: 10 },
  chatLockedText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontStyle: 'italic' }
};

const smsStyles = {
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: true ? 40 : 16 },
  container: { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 900, height: true ? '85%' : '90%', overflow: 'hidden', boxShadow: "0 4px 6px rgba(0,0,0,0.08)", shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: {width: 0, height: 10}, shadowRadius: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#f1f5f9', backgroundColor: '#fff' },
  headerTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  formCol: { flex: 1.2, padding: 20, borderRightWidth: true ? 1 : 0, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  previewCol: { flex: 1, padding: 20, backgroundColor: '#fff', borderTopWidth: true ? 0 : 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 10 },
  label: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 6, letterSpacing: 0.5 },
  input: { fontFamily: 'Courier New', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fff', fontWeight: 'bold' },
  textArea: { fontFamily: 'Times New Roman', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#fff', height: 70, textAlignVertical: 'top', marginBottom: 16 },
  chip: { paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', marginRight: 8, marginBottom: 8 },
  chipActive: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
  chipText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569' },
  infoBox: { backgroundColor: '#f0f9ff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd', marginBottom: 16 },
  btnGenerate: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#10b981', padding: 14, borderRadius: 8, gap: 8, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  btnGenerateText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#fff' },
  previewHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 },
  btnSubmit: { flexDirection: 'row', backgroundColor: '#0284c7', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, alignItems: 'center', boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  previewArea: { flex: 1, fontFamily: 'Courier New', fontSize: 13, color: '#1e293b', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, lineHeight: '22px', minHeight: 150 }
};


