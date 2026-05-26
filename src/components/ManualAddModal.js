import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import React, { useState } from 'react';

const toDateKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };

export default function ManualAddModal({ isOpen, onClose, onAddExtra, modalData, settings, employees, extraAssignments }) {
  const [step, setStep] = useState(1);
  const [source, setSource] = useState(null);
  const [customName, setCustomName] = useState('');

  if (!isOpen || !modalData) return null;
  const { shiftCode, label, dateObj, roleType } = modalData;

  // LẤY ĐÚNG NHÂN SỰ ĐANG NẰM TRONG Ô ON-CALL CỦA CA ĐÓ
  const getOnCallEmployees = () => {
    const dateKeyPart = toDateKey(dateObj);
    const onCallKey = `${dateKeyPart}_${shiftCode}_RESERVE`;
    return extraAssignments[onCallKey] || [];
  };

  const handleSelectSource = (src) => {
    setSource(src);
    setStep(2);
  };

  const handleConfirm = (empOrName) => {
    const newUId = Date.now() + Math.random().toString(36).substr(2, 9);
    
    let newItem;
    if (typeof empOrName === 'string') {
        newItem = { type: 'custom', name: empOrName, uId: newUId };
    } else {
        newItem = { type: 'emp', id: empOrName.id, name: empOrName.name, team: empOrName.team, uId: newUId };
    }

    // Gửi kèm uId cũ (nếu có) để hệ thống biết đường rút người đó khỏi ô cũ
    onAddExtra(newItem, source, empOrName.uId || null);
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep(1);
    setSource(null);
    setCustomName('');
    onClose();
  };

  return (
    <Modal visible={isOpen} maxWidth="400px">
        <div style={styles.modalContainer}>
          <div style={styles.header}>
            <div style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
              {step === 2 && <button type="button" onClick={() => setStep(1)}><Icon name="arrow-left" size={20} color="#fff"/></button>}
              <span style={styles.headerTitle}>{step === 1 ? 'Chọn Nguồn Nhân Sự' : `Chọn từ ${source === 'ON_CALL_LIST' ? 'ON-CALL' : source}`}</span>
            </div>
            <button type="button" onClick={resetAndClose}><Icon name="x" size={20} color="#fff" /></button>
          </div>
          
          <div style={styles.subHeader}>
            <span style={styles.subHeaderText}>Đang thêm vào: <span style={{fontWeight: 'bold'}}>Ca {shiftCode} - {label}</span></span>
          </div>
          
          <div style={styles.body}>
            {step === 1 ? (
              <div style={styles.grid}>
                {roleType !== 'RESERVE' && (
                    <button type="button" style={styles.btnOnCall} onClick={() => handleSelectSource('ON_CALL_LIST')}>
                      <Icon name="phone-call" size={16} color="#c2410c" />
                      <span style={styles.btnOnCallText}>Điều động từ danh sách ON-CALL</span>
                    </button>
                )}
                <div style={styles.teamGrid}>
                  {settings.teams.map(t => (
                    <button type="button" key={t} style={styles.btnTeam} onClick={() => handleSelectSource(t)}><span style={styles.btnTeamText}>{t}</span></button>
                  ))}
                </div>
                <button type="button" style={styles.btnCustom} onClick={() => handleSelectSource('CUSTOM')}>
                  <Icon name="edit-3" size={16} color="#7e22ce" />
                  <span style={styles.btnCustomText}>Nhập tên thủ công (Người ngoài)</span>
                </button>
              </div>
            ) : (
              source === 'CUSTOM' ? (
                <div>
                  <input style={styles.input} autoFocus placeholder="Nhập họ tên KSVKL..." value={customName} onChange={(e) => setCustomName(e.target.value)} />
                  <button type="button" style={styles.btnSave} onClick={() => handleConfirm(customName)}><span style={styles.btnSaveText}>Xác nhận chèn vào lịch</span></button>
                </div>
              ) : (
                <div style={styles.listArea}>
                  {(source === 'ON_CALL_LIST' ? getOnCallEmployees() : employees.filter(e => e.team === source)).map((e, idx) => (
                    <button type="button" key={e.uId || e.id || idx} style={styles.listItem} onClick={() => handleConfirm(e)}>
                      <span style={styles.listItemText}>
                          {e.name} <span style={{color: '#64748b', fontSize: 12, fontWeight: 'normal'}}>
                              ({source === 'ON_CALL_LIST' ? 'Đang trực ON-CALL' : e.position})
                          </span>
                      </span>
                      <Icon name="chevron-right" size={16} color="#cbd5e1"/>
                    </button>
                  ))}
                  {(source === 'ON_CALL_LIST' ? getOnCallEmployees() : employees.filter(e => e.team === source)).length === 0 && (
                    <span style={styles.emptyText}>Không có nhân sự nào trong danh sách này.</span>
                  )}
                </div>
              )
            )}
          </div>
        </div>
    </Modal>
  );
}

const styles = {
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 350, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  header: { backgroundColor: '#4f46e5', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontFamily: 'Times New Roman', color: '#fff', fontSize: 15, fontWeight: 'bold' },
  subHeader: { backgroundColor: '#e0e7ff', padding: 10, borderBottomWidth: 1, borderColor: '#c7d2fe' },
  subHeaderText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#3730a3', textAlign: 'center' },
  body: { padding: 16 },
  grid: { gap: 10 },
  btnOnCall: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff7ed', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#fdba74' },
  btnOnCallText: { fontFamily: 'Times New Roman', color: '#c2410c', fontWeight: 'bold', fontSize: 14 },
  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  btnTeam: { flexBasis: '48%', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  btnTeamText: { fontFamily: 'Times New Roman', color: '#334155', fontWeight: 'bold' },
  btnCustom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#faf5ff', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#d8b4fe', borderStyle: 'dashed' },
  btnCustomText: { fontFamily: 'Times New Roman', color: '#7e22ce', fontWeight: 'bold', fontSize: 14 },
  input: { fontFamily: 'Times New Roman', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#fff', marginBottom: 12 },
  btnSave: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnSaveText: { fontFamily: 'Times New Roman', color: '#fff', fontWeight: 'bold' },
  listArea: { maxHeight: 250 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  listItemText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#1e293b', fontWeight: 'bold' },
  emptyText: { fontFamily: 'Times New Roman', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', padding: 20 }
};

