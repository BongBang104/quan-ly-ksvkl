import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import React, { useState, useEffect } from 'react';



export default function TaskFormModal({ isOpen, onClose, onSave, settings, employees, currentUser, addNotification }) {
  // PHÂN QUYỀN CỨNG NHẮC DỰA VÀO CƠ SỞ DỮ LIỆU
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'superadmin';
  const isLeader = currentUser?.role === 'CHIEF';
  const isStaff = currentUser?.role === 'STAFF';

  const [type, setType] = useState('REPORT');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetTeams, setTargetTeams] = useState([]);
  const [selectedEmps, setSelectedEmps] = useState([]);

  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [visibility, setVisibility] = useState('team');

  useEffect(() => {
    if (isOpen) {
      setType('REPORT');
      setTitle('');
      setContent('');
      setDeadlineDate('');
      setDeadlineTime('');
      setVisibility('team');
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
      if (addNotification) addNotification('Lỗi', 'Vui lòng nhập đầy đủ Tiêu đề và Nội dung.', 'error');
    }

    let finalTargetIds = [];
    let notifMessage = "";

    if (isStaff) {
        const autoIds = employees.filter(e => e.role === 'ADMIN' || (e.role === 'CHIEF' && e.team === currentUser?.team)).map(e => e.id);
        finalTargetIds = [...new Set([...autoIds, ...selectedEmps])];
        notifMessage = `${currentUser?.name} (Nhân viên) vừa nộp Báo cáo: "${title.trim()}"`;
    } else {
        const teamIds = employees.filter(e => targetTeams.includes(e.team)).map(e => e.id);
        finalTargetIds = [...new Set([...teamIds, ...selectedEmps])];

        if (finalTargetIds.length === 0) {
            if (addNotification) addNotification('Lỗi', 'Vui lòng chỉ định ít nhất 1 Kíp hoặc 1 Cá nhân nhận.', 'error');
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
      isChatLocked: false,
      visibility: isStaff ? 'private' : visibility,
    };

    onSave(newTask, notifMessage);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} maxWidth="740px">
        <div style={styles.container}>
          <div style={styles.header}>
            <span style={styles.headerTitle}>Tạo Bài Đăng Mới</span>
            <button type="button" onClick={onClose}><Icon name="x" size={24} color="#64748b" /></button>
          </div>

          <div style={styles.body}>
            <span style={styles.label}>LOẠI BÀI ĐĂNG</span>
            <div style={styles.typeRow}>
<button type="button" style={Object.assign({}, styles.typeBtn, type === 'REPORT' ? styles.typeBtnActive : {})} onClick={() => setType('REPORT')} disabled={isStaff}>
                <Icon name="file-text" size={14} color={type === 'REPORT' ? '#fff' : '#64748b'} />
                <span style={Object.assign({}, styles.typeText, type === 'REPORT' ? styles.typeTextActive : {})}>Báo cáo</span>
              </button>

              {/* STAFF KHÔNG ĐƯỢC PHÉP NHÌN THẤY 2 NÚT NÀY */}
              {!isStaff && (
                  <>
                      <button type="button" style={Object.assign({}, styles.typeBtn, type === 'DEBRIEF' ? styles.typeBtnActive : {})} onClick={() => setType('DEBRIEF')}>
                        <Icon name="book-open" size={14} color={type === 'DEBRIEF' ? '#fff' : '#64748b'} />
                        <span style={Object.assign({}, styles.typeText, type === 'DEBRIEF' ? styles.typeTextActive : {})}>Bình giảng</span>
                      </button>
                      <button type="button" style={Object.assign({}, styles.typeBtn, type === 'TASK' ? styles.typeBtnActive : {})} onClick={() => setType('TASK')}>
                        <Icon name="clipboard" size={14} color={type === 'TASK' ? '#fff' : '#64748b'} />
                        <span style={Object.assign({}, styles.typeText, type === 'TASK' ? styles.typeTextActive : {})}>Nhiệm vụ</span>
                      </button>
                  </>
              )}
            </div>

            {!isStaff && (
              <>
                <span style={styles.label}>PHẠM VI HIỂN THỊ</span>
                <div style={{ ...styles.typeRow, marginBottom: 4 }}>
                  {[
                    { id: 'team',    label: 'Nội bộ kíp',  desc: 'Chỉ kíp của bạn thấy' },
                    { id: 'unit',    label: 'Toàn đơn vị', desc: 'Mọi tài khoản đều thấy' },
                    { id: 'private', label: 'Riêng tư',    desc: 'Chỉ người được chỉ định' },
                  ].map(opt => (
                    <button key={opt.id} type="button" title={opt.desc}
                      onClick={() => setVisibility(opt.id)}
                      style={{ ...styles.typeBtn, ...(visibility === opt.id ? styles.typeBtnActive : {}) }}>
                      <span style={{ ...styles.typeText, ...(visibility === opt.id ? styles.typeTextActive : {}) }}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <span style={styles.label}>1. GIAO CHO KÍP</span>
            {isStaff ? (
                <div style={styles.autoAssignBox}>
                    <Icon name="info" size={14} color="#0369a1" />
                    <span style={styles.autoAssignText}>Hệ thống tự động gửi tới <span style={{fontWeight: 'bold'}}>Quản lý</span> và <span style={{fontWeight: 'bold'}}>Kíp trưởng ({currentUser?.team || 'Kíp của bạn'})</span>.</span>
                </div>
            ) : (
                <div style={styles.targetRow}>
                  {settings?.teams?.filter(t => t !== 'Trung tâm').map(t => (
                      <button type="button" key={t} style={{...styles.targetBtn, ...(targetTeams.includes(t) && styles.targetBtnActive)}} onClick={() => toggleTeam(t)}>
                        <span style={{...styles.targetText, ...(targetTeams.includes(t) && {color:'#fff'})}}>{t}</span>
                      </button>
                  ))}
                </div>
            )}

            <span style={styles.label}>2. GIAO CHO CÁ NHÂN CHỈ ĐỊNH (TÙY CHỌN)</span>
            <div style={styles.targetRow}>
                {employees.filter(e => e.id !== currentUser?.id).map(emp => (
                    <button type="button" key={emp.id} style={Object.assign({}, styles.empBtn, selectedEmps.includes(emp.id) ? styles.empBtnActive : {})} onClick={() => toggleEmp(emp.id)}>
                        <span style={Object.assign({}, styles.empText, selectedEmps.includes(emp.id) ? {color:'#1d4ed8', fontWeight:'bold'} : {})}>{emp.name}</span>
                    </button>
                ))}
            </div>

            {type === 'TASK' && !isStaff && (
                <div style={{ display: 'flex', marginBottom: 15 }}>
                    <div style={{ flex: 1, marginRight: 10 }}><span style={styles.label}>HẠN CHÓT (NGÀY)</span><input style={styles.input} placeholder="YYYY-MM-DD" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} /></div>
                    <div style={{ flex: 1 }}><span style={styles.label}>HẠN CHÓT (GIỜ)</span><input style={styles.input} placeholder="HH:MM" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} /></div>
                </div>
            )}

            <span style={styles.label}>TIÊU ĐỀ</span>
            <input style={styles.input} placeholder="Nhập tiêu đề..." value={title} onChange={(e) => setTitle(e.target.value)} />

            <span style={styles.label}>NỘI DUNG CHI TIẾT</span>
            <textarea style={Object.assign({}, styles.input, styles.textArea)} placeholder="Nội dung..." value={content} onChange={(e) => setContent(e.target.value)} />
          </div>

          <div style={styles.footer}>
            <button type="button" style={styles.btnCancel} onClick={onClose}><span style={styles.btnCancelText}>Hủy Bỏ</span></button>
            <button type="button" style={styles.btnSave} onClick={handleSave}><Icon name="send" size={14} color="#fff" /><span style={styles.btnSaveText}>Phát Hành / Gửi Báo Cáo</span></button>
          </div>
        </div>
    </Modal>
  );
}

const styles = {
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  container: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 700, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  headerTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  body: { padding: 20 },
  label: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 8, marginTop: 16 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  typeBtnActive: { backgroundColor: '#2563eb', borderColor: '#1d4ed8' },
  typeText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569' },
  typeTextActive: { color: '#fff' },
  targetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  targetBtn: { paddingTop: 6, paddingBottom: 6, paddingLeft: 12, paddingRight: 12, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1' },
  targetBtnActive: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
  targetText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontWeight: 'bold' },
  targetTextActive: { color: '#fff' },
  empBtn: { paddingTop: 6, paddingBottom: 6, paddingLeft: 12, paddingRight: 12, borderRadius: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  empBtnActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  empText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#475569' },
  empTextActive: { color: '#1d4ed8', fontWeight: 'bold' },
  autoAssignBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e0f2fe', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd' },
  autoAssignText: { flex: 1, fontFamily: 'Times New Roman', fontSize: 13, color: '#0369a1', lineHeight: '20px' },
  deadlineRow: { flexDirection: 'row' },
  input: { fontFamily: 'Times New Roman', fontSize: 14, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  textArea: { height: 120 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  btnCancel: { paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 16, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  btnCancelText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569' },
  btnSave: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20, borderRadius: 8, backgroundColor: '#2563eb' },
  btnSaveText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#fff' }
};
