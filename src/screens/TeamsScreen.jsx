import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import React, { useState, useMemo } from 'react';

import { toYMD } from '../utils/helpers';
import DetailedRosterModal from '../components/DetailedRosterModal';
import { DataService } from '../services/DataService';

const formatDateDisplay = (dateStr) => {
    if(!dateStr) return '';
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}` : '';
}

export default function TeamsScreen({ currentUser, employees, settings: globalSettings, activities, setActivities, addNotification, requests, setRequests }) {

  // KIỂM TRA QUYỀN (CHỈ ADMIN MỚI ĐƯỢC DUYỆT ĐƠN/ĐỔI TRẠNG THÁI TỔNG)
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'superadmin';

  // CHIEF CÓ QUYỀN PHÂN VỊ TRÍ TRONG CA TRỰC CHI TIẾT
  const canEditRoster = currentUser?.role === 'ADMIN' || currentUser?.role === 'superadmin' || currentUser?.role === 'CHIEF';

  const settings = useMemo(() => ({
      ...globalSettings,
      teams: globalSettings?.teams?.filter(t => t !== 'Trung tâm') || [],
      positions: ['QL', 'KSV', 'ON-CALL']
  }), [globalSettings]);

  const shiftEmployees = useMemo(() => {
      return employees.filter(emp => emp.team !== 'Trung tâm' && !emp.position?.toLowerCase().includes('lãnh đạo'));
  }, [employees]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [detailedRosterTeam, setDetailedRosterTeam] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ visible: false, title: '', msg: '', onConfirm: null });
  const [formData, setFormData] = useState({ type: '', startDate: '', endDate: '', note: '' });

  const [detailedRosters, setDetailedRosters] = useState({});

  const safeActivities = useMemo(() => Array.isArray(activities) ? activities : []);

  const sortedActivities = useMemo(() => {
      return [...safeActivities].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  }, [safeActivities]);

  const getActivityConfig = (type) => {
      if (type === 'EXTRA') return { id: 'EXTRA', code: 'TC', label: 'Tăng cường', bg: '#fef3c7', text: '#d97706', border: '#fde68a' };
      const found = settings.activityTypes.find(a => a.id === type);
      if (found) {
          if (found.id === 'LEAVE') return { ...found, bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
          if (found.id === 'TRIP') return { ...found, bg: '#faf5ff', text: '#9333ea', border: '#e9d5ff' };
          if (found.id === 'STUDY') return { ...found, bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
          if (found.id === 'COMP') return { ...found, bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' };
          if (found.id === 'SICK') return { ...found, bg: '#f0fdfa', text: '#0d9488', border: '#ccfbf1' };
          if (found.id === 'CHANGE') return { ...found, bg: '#f3f4f6', text: '#4b5563', border: '#e5e7eb' };
      }
      return { code: type, label: type, bg: '#f3f4f6', text: '#4b5563', border: '#e5e7eb' };
  };

  // ── ADMIN DUYỆT ĐƠN: tạo activity + xóa request khỏi DB ─────────────
  const handleApprove = async (id) => {
    if (!isAdmin) return;
    const req = requests.find(r => r.id === id);
    const newActivities = [];

    if (req?.type === 'LEAVE' || req?.type === 'Nghỉ phép') {
        newActivities.push({
            id: Date.now().toString(),
            empId: req.requesterId,
            type: req.leaveType === 'SICK' ? 'SICK' : 'LEAVE',
            startDate: req.startDate || req.date,
            endDate: req.endDate || req.date,
            note: req.note || req.reason
        });
    } else if (req?.type === 'Đổi ca' || req?.type === 'CHANGE') {
        const shiftInfo = req.shiftCode ? ` (ca ${req.shiftCode})` : '';
        newActivities.push({ id: 'ACT'+Date.now(), empId: req.requesterId, type: 'CHANGE', startDate: req.date, endDate: req.date, note: `Đổi ca${shiftInfo} với ${req.targetEmpName}` });
        newActivities.push({ id: 'ACT'+(Date.now()+1), empId: req.targetEmpId, type: 'CHANGE', startDate: req.date, endDate: req.date, note: `Đổi ca${shiftInfo} với ${req.requesterName}` });
        if (req.returnDate) {
            const retInfo = req.returnShiftCode ? ` (ca ${req.returnShiftCode})` : '';
            newActivities.push({ id: 'ACT'+(Date.now()+2), empId: req.requesterId, type: 'CHANGE', startDate: req.returnDate, endDate: req.returnDate, note: `Trả ca${retInfo} với ${req.targetEmpName}` });
            newActivities.push({ id: 'ACT'+(Date.now()+3), empId: req.targetEmpId, type: 'CHANGE', startDate: req.returnDate, endDate: req.returnDate, note: `Trả ca${retInfo} với ${req.requesterName}` });
        }
    }

    const approvedReq = { ...req, status: 'APPROVED' };
    try {
        for (const act of newActivities) await DataService.createItem('activities', act);
        // Giữ lại đơn đổi ca đã duyệt để tab Phân ca dùng hiển thị swap
        if (req?.type === 'Đổi ca' || req?.type === 'CHANGE') {
            await DataService.updateItem('requests', id, approvedReq);
        } else {
            await DataService.deleteItem('requests', id);
        }
    } catch {}

    if (newActivities.length) setActivities(prev => [...newActivities, ...(prev || [])]);
    if (req?.type === 'Đổi ca' || req?.type === 'CHANGE') {
        setRequests(p => p.map(r => r.id === id ? approvedReq : r));
    } else {
        setRequests(p => p.filter(r => r.id !== id));
    }
    window.alert('Thành công\nĐã phê duyệt yêu cầu.');
    if (addNotification) {
        if (req?.type === 'Đổi ca' || req?.type === 'CHANGE') {
            const shiftInfo = req.shiftCode ? ` ca ${req.shiftCode}` : '';
            const returnInfo = req.returnDate ? ` (trả ca ${req.returnDate}${req.returnShiftCode ? ` [${req.returnShiftCode}]` : ''})` : '';
            addNotification('Đổi ca được duyệt', `Đã phê duyệt đổi ca${shiftInfo} giữa ${req.requesterName} và ${req.targetEmpName} ngày ${req.date}${returnInfo}.`, 'info');
        } else {
            const typeLabel = req?.type === 'LEAVE' || req?.type === 'Nghỉ phép' ? 'nghỉ phép' : 'yêu cầu';
            addNotification('Phê duyệt thành công', `Đã duyệt đơn ${typeLabel} của ${req?.requesterName} từ ngày ${req?.startDate || req?.date}.`, 'info');
        }
    }
  };

  const handleReject = async (id) => {
      if (!isAdmin) return;
      const req = requests.find(r => r.id === id);
      try { await DataService.deleteItem('requests', id); } catch {}
      setRequests(p => p.filter(r => r.id !== id));
      window.alert('Đã từ chối\nYêu cầu đã bị hủy bỏ.');
      if (addNotification) {
          const typeLabel = req?.type === 'Đổi ca' || req?.type === 'CHANGE' ? 'đổi ca' : 'nghỉ phép';
          addNotification('Từ chối đơn', `Đã từ chối đơn ${typeLabel} của ${req?.requesterName || 'nhân sự'} ngày ${req?.date || req?.startDate || ''}.`, 'info');
      }
  };

  const openActivityModal = (emp) => {
      if (!isAdmin) {
          window.alert("Quyền hạn\\nChỉ Quản trị viên mới được trực tiếp cập nhật trạng thái nhân sự.");
          return;
      }
      const today = toYMD(new Date());
      setFormData({ type: settings.activityTypes[0]?.id || '', startDate: today, endDate: today, note: '' });
      setSelectedEmp(emp);
  };

  const handleSaveActivity = async () => {
      if (!formData.type || !formData.startDate || !formData.endDate) {
          window.alert('Lỗi\nVui lòng điền đủ thông tin bắt buộc.');
          return;
      }
      const newAct = {
          id: Date.now().toString(), empId: selectedEmp.id, type: formData.type,
          startDate: formData.startDate, endDate: formData.endDate, note: formData.note
      };
      try {
          const saved = await DataService.createItem('activities', newAct);
          setActivities(prev => [saved || newAct, ...(prev || [])]);
      } catch {
          setActivities(prev => [newAct, ...(prev || [])]);
      }
      setSelectedEmp(null);
  };

  const confirmDeleteActivity = (id) => {
      if (!isAdmin) {
          window.alert("Quyền hạn\nChỉ Quản trị viên mới được xóa trạng thái nhân sự.");
          return;
      }
      setConfirmDialog({
          visible: true, title: 'Xóa trạng thái', msg: 'Bạn có chắc chắn muốn xóa ghi nhận này không?',
          onConfirm: async () => {
              try { await DataService.deleteItem('activities', id); } catch {}
              setActivities(prev => prev.filter(a => a.id !== id));
              setConfirmDialog({ visible: false, title: '', msg: '', onConfirm: null });
          }
      });
  };

  return (
    <div style={styles.container}>
      <Modal visible={confirmDialog.visible} maxWidth="380px">
          <div style={styles.confirmBox}>
              <span style={styles.confirmTitle}>{confirmDialog.title}</span>
              <span style={styles.confirmMsg}>{confirmDialog.msg}</span>
              <div style={styles.confirmActions}>
                  <button type="button" style={{...styles.modalBtn, backgroundColor: '#f1f5f9'}} onClick={() => setConfirmDialog({ ...confirmDialog, visible: false })}><span style={{...styles.modalBtnText, color: '#64748b'}}>Hủy bỏ</span></button>
                  <button type="button" style={{...styles.modalBtn, backgroundColor: '#ef4444'}} onClick={() => confirmDialog.onConfirm && confirmDialog.onConfirm()}><span style={{...styles.modalBtnText, color: '#fff'}}>Xóa</span></button>
              </div>
          </div>
      </Modal>

      <Modal visible={!!selectedEmp} maxWidth="420px">
          <div style={styles.activityBox}>
                  <div style={styles.activityHeader}>
                      <span style={styles.activityTitle}>Cập nhật trạng thái</span>
                      <button type="button" onClick={() => setSelectedEmp(null)}><Icon name="x" size={20} color="#64748b"/></button>
                  </div>
                  {selectedEmp && (<div style={styles.activityEmpInfo}><span style={styles.activityEmpText}>{selectedEmp.name} - {selectedEmp.team}</span></div>)}
                  <div style={styles.formGroup}>
                      <span style={styles.formLabel}>LOẠI HÌNH</span>
                      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
                          {settings?.activityTypes.map(type => (
                              <button type="button" key={type.id} style={{...styles.typeChip, ...(formData.type === type.id && styles.typeChipActive)}} onClick={() => setFormData({...formData, type: type.id})}>
                                  <span style={{...styles.typeChipText, ...(formData.type === type.id && {color: '#fff'})}}>{type.label}</span>
                              </button>
                          ))}
                      </div>
                      <div style={styles.dateRow}>
                          <div style={{flex: 1, marginRight: 10}}><span style={styles.formLabel}>TỪ NGÀY (YYYY-MM-DD)</span><input style={styles.input} value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} /></div>
                          <div style={{flex: 1}}><span style={styles.formLabel}>ĐẾN NGÀY (YYYY-MM-DD)</span><input style={styles.input} value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} /></div>
                      </div>
                      <span style={styles.formLabel}>GHI CHÚ CHI TIẾT</span>
                      <input style={Object.assign({}, styles.input, { height: 60 })} placeholder="Lý do chi tiết..." value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} />
                  </div>
                  <div style={styles.activityFooter}>
                      <button type="button" style={{...styles.modalBtn, backgroundColor: '#f1f5f9', flex: 1, marginRight: 10, alignItems: 'center'}} onClick={() => setSelectedEmp(null)}><span style={{...styles.modalBtnText, color: '#64748b'}}>Hủy</span></button>
                      <button type="button" style={{...styles.modalBtn, backgroundColor: '#2563eb', flex: 2, alignItems: 'center'}} onClick={handleSaveActivity}><span style={{...styles.modalBtnText, color: '#fff'}}>Lưu trạng thái</span></button>
                  </div>
              </div>
      </Modal>

      <DetailedRosterModal
          team={detailedRosterTeam}
          isOpen={!!detailedRosterTeam}
          onClose={() => setDetailedRosterTeam(null)}
          employees={shiftEmployees}
          activities={safeActivities}
          settings={settings}
          detailedRosters={detailedRosters}
          setDetailedRosters={setDetailedRosters}
          addNotification={addNotification}
          isAdmin={canEditRoster}
      />

      {/* 🌟 ĐÃ FIX: Header Card cho Quản lý Kíp tự rớt dòng thanh tìm kiếm */}
      <div style={styles.headerCard}>
        <div style={styles.headerInfo}>
            <div style={styles.iconBox}><Icon name="users" size={20} color="#2563eb" /></div>
            <div style={{ flex: 1 }}>
                <span style={styles.headerTitle}>Danh Sách & Phân Vị Trí</span>
                <span style={styles.headerSub}>Quản lý nhân sự, Duyệt đơn & Lịch trực ca</span>
            </div>
        </div>
        <div style={styles.searchBox}>
            <Icon name="search" size={16} color="#9ca3af" />
            <input style={styles.searchInput} placeholder="Tìm kiếm Tên / Mã ICAO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {searchTerm !== '' && <button type="button" onClick={() => setSearchTerm('')}><Icon name="x" size={16} color="#9ca3af"/></button>}
        </div>
      </div>

      <div style={Object.assign({}, styles.scrollArea, { paddingBottom: 60 })}>

        {isAdmin && (
            <div style={styles.sectionCard}>
            <div style={{...styles.sectionHeader, backgroundColor: '#fffbeb', borderBottomColor: '#fde68a'}}>
                <div style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                    <Icon name="bell" size={16} color="#d97706" />
                    <span style={{...styles.sectionTitle, color: '#92400e'}}>Hòm Thư Xét Duyệt</span>
                </div>
                <div style={styles.inboxBadge}><span style={styles.inboxBadgeText}>{requests.filter(r => r.status !== 'APPROVED').length} chờ duyệt</span></div>
            </div>
            <div style={styles.sectionBody}>
                {requests.filter(r => r.status !== 'APPROVED').map(req => {
                    const requester = employees.find(e => e.id === req.requesterId);
                    const displayName = requester ? (requester.icaoCode ? `${requester.name} (${requester.icaoCode})` : requester.name) : req.requesterId;

                    const isLeave = req.type === 'LEAVE' || req.type === 'Nghỉ phép';

                    return (
                        <div key={req.id} style={styles.reqCard}>
                            <div style={styles.reqHeader}>
                                <div style={styles.reqTypeBadge}>
                                    <span style={styles.reqTypeText}>{isLeave ? 'XIN NGHỈ' : 'ĐỔI CA'}</span>
                                </div>
                                <span style={styles.reqDate}>Ngày: {req.startDate || req.date}</span>
                            </div>

                            {isLeave ? (
                                <span style={styles.reqMainText}>
                                    <span style={{fontWeight: 'bold', color: '#dc2626'}}>{displayName}</span> xin {req.leaveType === 'SICK' ? 'Nghỉ Ốm' : 'Nghỉ Phép'}.
                                </span>
                            ) : (
                                <>
                                    <span style={styles.reqMainText}>
                                        <span style={{fontWeight: 'bold', color: '#dc2626'}}>{displayName}</span> đề nghị Đổi Ca với <span style={{fontWeight: 'bold', color: '#2563eb'}}>{req.targetEmpName}</span>.
                                        {req.shiftCode && <span style={{color: '#0369a1', fontWeight: 'bold'}}> [{req.shiftCode}]</span>}
                                    </span>
                                    {req.returnDate && (
                                        <span style={{...styles.reqNote, color: '#7c3aed'}}>
                                            Trả ca: {req.returnDate}{req.returnShiftCode ? ` [${req.returnShiftCode}]` : ''}
                                        </span>
                                    )}
                                </>
                            )}

                            <span style={styles.reqNote}>Lý do: "{req.note || req.reason}"</span>

                            <div style={styles.reqActions}>
                                <button type="button" style={styles.btnReject} onClick={() => handleReject(req.id)}><span style={styles.btnRejectText}>Từ chối</span></button>
                                <button type="button" style={styles.btnApprove} onClick={() => handleApprove(req.id)}><span style={styles.btnApproveText}>Phê duyệt</span></button>
                            </div>
                        </div>
                    );
                })}
                {requests.filter(r => r.status !== 'APPROVED').length === 0 && <span style={styles.emptyText}>Không có yêu cầu nào đang chờ xử lý.</span>}
            </div>
            </div>
        )}

        <div style={styles.teamsGrid}>
          {settings?.teams.map(team => {
            const teamMembers = shiftEmployees.filter(e => e.team === team && (!searchTerm || e.name.toLowerCase().includes(searchTerm.toLowerCase()) || (e.icaoCode && e.icaoCode.toLowerCase().includes(searchTerm.toLowerCase()))));
            const managerCount = teamMembers.filter(e => (e.position && (e.position.toLowerCase().includes('quản lý') || e.position.toLowerCase().includes('trưởng'))) || e.isChief).length;
            const vipCount = teamMembers.filter(e => e.isVip).length;
            const qualStats = teamMembers.reduce((acc, curr) => {
                const q = curr.qualification || 'Khác';
                acc[q] = (acc[q] || 0) + 1;
                return acc;
            }, {});

            return (
              <div key={team} style={styles.teamCard}>
                <div style={styles.teamHeader}>
                  <span style={styles.teamTitle}>{team}</span>
                  <div style={styles.teamActions}>
                    <button type="button" style={styles.btnDetail} onClick={() => setDetailedRosterTeam(team)}>
                      <Icon name="layout" size={12} color="#4338ca" />
                      <span style={styles.btnDetailText}>{canEditRoster ? 'Phân vị trí' : 'Lịch trực ca chi tiết'}</span>
                    </button>
                    <div style={styles.countBadge}><span style={styles.countText}>{teamMembers.length} TV</span></div>
                  </div>
                </div>

                <div style={styles.statsBar}>
                  <div style={styles.statItem}><Icon name="star" size={12} color="#1d4ed8" /><span style={styles.statTextBold}>{managerCount} QL</span></div>
                  <div style={styles.statItem}><Icon name="send" size={12} color="#7e22ce" /><span style={{...styles.statTextBold, color: '#7e22ce'}}>{vipCount} VIP</span></div>
                  <div style={styles.statDivider} />
                  <div style={styles.qualWrap}>
                    {Object.entries(qualStats).map(([q, count]) => (
                        <div key={q} style={styles.qualBadge}><span style={styles.qualBadgeText}>{q}: <span style={{fontWeight: 'bold'}}>{count}</span></span></div>
                    ))}
                  </div>
                </div>

                <div style={styles.memberList}>
                  {teamMembers.map(emp => {
                    const initial = emp.name.charAt(0).toUpperCase();
                    const empRecentActivities = sortedActivities.filter(a => a.empId === emp.id).slice(0, 5);

                    return (
                      <div key={emp.id} style={styles.memberItem}>
                        <div style={styles.memberHeaderRow}>
                            <div style={styles.memberInfo}>
                                <div style={{...styles.avatar, ...(emp.isChief ? styles.avatarChief : styles.avatarNormal)}}>
                                    <span style={styles.avatarText}>{initial}</span>
                                </div>
                                <div>
                                    <span style={styles.memberName}>
                                        {emp.name} {emp.icaoCode && <span style={{color: '#2563eb', fontSize: 13}}>({emp.icaoCode})</span>}
                                    </span>
                                    <div style={styles.tagsRow}>
                                        <div style={styles.tagBase}><span style={styles.tagBaseText}>{emp.position}</span></div>
                                        <div style={styles.tagBase}><span style={styles.tagBaseText}>{emp.qualification}</span></div>
                                        {emp.isVip && <div style={styles.tagVip}><Icon name="send" size={8} color="#7e22ce"/><span style={styles.tagVipText}> VIP</span></div>}
                                    </div>
                                </div>
                            </div>

                            {isAdmin && (
                                <button type="button" style={styles.btnStatus} onClick={() => openActivityModal(emp)}>
                                    <Icon name="plus" size={12} color="#2563eb" />
                                    <span style={styles.btnStatusText}>Trạng thái</span>
                                </button>
                            )}
                        </div>

                        {empRecentActivities.length > 0 && (
                            <div style={styles.recentActsBox}>
                                {empRecentActivities.map((act, i) => {
                                    const conf = getActivityConfig(act.type);
                                    return (
                                        <div key={act.id || i} style={styles.miniActRow}>
                                            <div style={styles.miniActDot} />
                                            <span style={styles.miniActDate}>{formatDateDisplay(act.startDate)}</span>
                                            <div style={{...styles.miniActBadge, backgroundColor: conf.bg}}><span style={{...styles.miniActBadgeText, color: conf.text}}>{conf.label}</span></div>
                                            <span style={styles.miniActNote}>{act.note}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                      </div>
                    );
                  })}
                  {teamMembers.length === 0 && <span style={styles.emptyText}>Không tìm thấy nhân sự.</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={styles.tableCard}>
          <div style={styles.tableHeader}>
              <div style={{flexDirection: 'row', alignItems: 'center', gap: 8}}><Icon name="file-text" size={18} color="#1e293b" /><span style={styles.tableTitle}>Bảng Tổng Hợp Trạng Thái Gần Đây</span></div>
          </div>

          <div style={styles.tableHeadRow}>
              <span style={{...styles.thCell, flex: 2}}>Nhân viên</span>
              <span style={{...styles.thCell, flex: 1.5}}>Loại hình</span>
              <span style={{...styles.thCell, flex: 2}}>Thời gian</span>
              <span style={{...styles.thCell, flex: 2}}>Ghi chú</span>
              {isAdmin && <span style={{...styles.thCell, width: 40, textAlign: 'center'}}>Xóa</span>}
          </div>

          <div style={styles.tableBody}>
            {sortedActivities.slice(0, 50).map(act => {
              const emp = employees.find(e => e.id === act.empId);
              const conf = getActivityConfig(act.type);

              const displayName = emp ? (emp.icaoCode ? `${emp.name} (${emp.icaoCode})` : emp.name) : act.empId;

              return (
                <div key={act.id} style={styles.tableRow}>
                  <span style={{...styles.tdCell, flex: 2, fontWeight: 'bold', color: '#1e293b'}}>{displayName}</span>
                  <div style={{flex: 1.5, alignItems: 'flex-start'}}>
                      <div style={{...styles.actBadge, backgroundColor: conf.bg, borderColor: conf.border}}><span style={{...styles.actBadgeText, color: conf.text}}>{conf.label}</span></div>
                  </div>
                  <span style={{...styles.tdCell, flex: 2, color: '#475569'}}>{formatDateDisplay(act.startDate)} {act.endDate !== act.startDate ? `- ${formatDateDisplay(act.endDate)}` : ''}</span>
                  <span style={{...styles.tdCell, flex: 2, color: '#64748b', fontStyle: 'italic'}}>{act.note || '-'}</span>

                  {isAdmin && (
                      <button type="button" style={styles.tdAction} onClick={() => confirmDeleteActivity(act.id)}>
                          <div style={styles.trashBtn}><Icon name="trash-2" size={14} color="#ef4444" /></div>
                      </button>
                  )}
                </div>
              );
            })}
            {sortedActivities.length === 0 && <span style={styles.emptyText}>Chưa có ghi nhận nào.</span>}
          </div>
        </div>

      </div>
    </div>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 12 },

  // 🌟 CSS ĐÃ ĐƯỢC TỐI ƯU HÓA MOBILE (FLEX WRAP) 🌟
  headerCard: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#fff',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      marginBottom: 12,
      boxShadow: "0 4px 6px rgba(0,0,0,0.08)",
      gap: 12
  },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 250 },
  searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 8,
      paddingLeft: 12, paddingRight: 12,
      height: 40,
      flex: 1,
      minWidth: true ? 250 : '100%' // Ép tràn 100% trên màn hình hẹp
  },

  iconBox: { backgroundColor: '#dbeafe', padding: 8, borderRadius: 8, marginRight: 12 },
  headerTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  headerSub: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b' },
  searchInput: { flex: 1, fontFamily: 'Times New Roman', marginLeft: 8, fontSize: 14 },
  scrollArea: { flex: 1, overflowY: 'auto', display: 'block' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  confirmBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 320, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  confirmTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
  confirmMsg: { fontFamily: 'Times New Roman', fontSize: 14, color: '#475569', marginBottom: 20, lineHeight: '20px' },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: { paddingTop: 8, paddingBottom: 8, paddingLeft: 16, paddingRight: 16, borderRadius: 6 },
  modalBtnText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold' },

  activityBox: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 350, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  activityTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  activityEmpInfo: { backgroundColor: '#eff6ff', padding: 10, borderBottomWidth: 1, borderColor: '#bfdbfe' },
  activityEmpText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#1d4ed8', textAlign: 'center' },
  formGroup: { padding: 16 },
  formLabel: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#64748b', marginBottom: 6, marginTop: 4 },
  typeChip: { paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8, backgroundColor: '#f8fafc' },
  typeChipActive: { backgroundColor: '#2563eb', borderColor: '#1d4ed8' },
  typeChipText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#475569', fontWeight: 'bold' },
  dateRow: { flexDirection: 'row', marginBottom: 10 },
  input: { fontFamily: 'Times New Roman', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 10, fontSize: 14, backgroundColor: '#fff' },
  activityFooter: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },

  sectionCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  sectionTitle: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  inboxBadge: { backgroundColor: '#fef3c7', paddingTop: 2, paddingBottom: 2, paddingLeft: 8, paddingRight: 8, borderRadius: 12 },
  inboxBadgeText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#b45309' },
  sectionBody: { padding: 12 },
  reqCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 10 },
  reqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reqTypeBadge: { backgroundColor: '#fee2e2', paddingTop: 2, paddingBottom: 2, paddingLeft: 6, paddingRight: 6, borderRadius: 4 },
  reqTypeText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#b91c1c' },
  reqDate: { fontFamily: 'Times New Roman', fontSize: 11, color: '#94a3b8', fontWeight: 'bold' },
  reqMainText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#1e293b', marginBottom: 4 },
  reqNote: { fontFamily: 'Times New Roman', fontSize: 11, color: '#64748b', fontStyle: 'italic', backgroundColor: '#f8fafc', padding: 6, borderRadius: 4, marginBottom: 10 },
  reqActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  btnReject: { backgroundColor: '#f1f5f9', paddingTop: 6, paddingBottom: 6, paddingLeft: 12, paddingRight: 12, borderRadius: 6 },
  btnRejectText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  btnApprove: { backgroundColor: '#2563eb', paddingTop: 6, paddingBottom: 6, paddingLeft: 12, paddingRight: 12, borderRadius: 6 },
  btnApproveText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#fff' },

  teamsGrid: { gap: 16, marginBottom: 20 },
  teamCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  teamHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  teamTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  teamActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnDetail: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e0e7ff', paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10, borderRadius: 6, borderWidth: 1, borderColor: '#c7d2fe' },
  btnDetailText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#4338ca' },
  countBadge: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8, borderRadius: 6 },
  countText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b' },

  statsBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#eff6ff', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderColor: '#dbeafe', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statTextBold: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#1d4ed8' },
  statDivider: { width: 1, height: 12, backgroundColor: '#bfdbfe' },
  qualWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  qualBadge: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4 },
  qualBadgeText: { fontFamily: 'Times New Roman', fontSize: 9, color: '#334155' },

  memberList: { },
  memberItem: { padding: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  memberHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  memberInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarNormal: { backgroundColor: '#3b82f6' },
  avatarChief: { backgroundColor: '#eab308' },
  avatarText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#fff' },
  memberName: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  tagsRow: { flexDirection: 'row', marginTop: 6, gap: 6 },
  tagBase: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 },
  tagBaseText: { fontFamily: 'Times New Roman', fontSize: 10, color: '#475569', fontWeight: 'bold' },
  tagVip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3e8ff', borderWidth: 1, borderColor: '#e9d5ff', borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 },
  tagVipText: { fontFamily: 'Times New Roman', fontSize: 10, color: '#7e22ce', fontWeight: 'bold' },
  btnStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10, borderRadius: 6 },
  btnStatusText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#2563eb' },

  recentActsBox: { marginTop: 10, marginLeft: 48, backgroundColor: '#f8fafc', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#f1f5f9' },
  miniActRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  miniActDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1' },
  miniActDate: { fontFamily: 'Times New Roman', fontSize: 10, color: '#64748b', width: 35 },
  miniActBadge: { paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: 4 },
  miniActBadgeText: { fontFamily: 'Times New Roman', fontSize: 9, fontWeight: 'bold' },
  miniActNote: { flex: 1, fontFamily: 'Times New Roman', fontSize: 11, color: '#475569', fontStyle: 'italic' },

  tableCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  tableHeader: { backgroundColor: '#f8fafc', padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  tableTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  tableHeadRow: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  thCell: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' },
  tableBody: { },
  tableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
  tdCell: { fontFamily: 'Times New Roman', fontSize: 13 },
  actBadge: { paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 6, borderWidth: 1 },
  actBadgeText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold' },
  tdAction: { width: 40, alignItems: 'center' },
  trashBtn: { padding: 6, backgroundColor: '#fef2f2', borderRadius: 20 },

  emptyText: { fontFamily: 'Times New Roman', fontSize: 12, fontStyle: 'italic', color: '#94a3b8', textAlign: 'center', padding: 16 }
};
