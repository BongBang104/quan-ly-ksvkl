import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import React, { useState, useEffect } from 'react';

import { toYMD } from '../utils/helpers';

export default function AddActivityModal({ isOpen, employee, onClose, onSave, activityTypes = [] }) {
  const [formData, setFormData] = useState({ type: '', startDate: '', endDate: '', note: '' });

  useEffect(() => {
    if(isOpen) {
      const today = toYMD(new Date());
      setFormData({ type: activityTypes[0]?.id || '', startDate: today, endDate: today, note: '' });
    }
  }, [isOpen, activityTypes]);

  if (!isOpen || !employee) return null;

  const handleSave = () => {
    onSave({ ...formData, empId: employee.id, id: Date.now().toString() });
    onClose();
  };

  return (
    <Modal visible={isOpen} maxWidth="440px">
        <div style={styles.modalContainer}>
          <div style={styles.header}>
            <span style={styles.title}>Cập nhật Trạng thái</span>
            <button type="button" onClick={onClose} style={styles.closeBtn}>
              <Icon name="x" size={20} color="#fff" />
            </button>
          </div>

          <div style={styles.formContainer}>
            <div style={styles.empCard}>
              <div style={styles.avatar}><span style={styles.avatarText}>{employee.name.charAt(0)}</span></div>
              <div>
                <span style={styles.empName}>{employee.name}</span>
                <span style={styles.empDesc}>{employee.team} • {employee.id}</span>
              </div>
            </div>

            <span style={styles.label}>LOẠI HÌNH VẮNG MẶT</span>
            <div style={Object.assign({}, styles.typeScroll, { display: 'flex', flexWrap: 'wrap' })}>
              {activityTypes.map(type => {
                const isSelected = formData.type === type.id;
                return (
                  <button type="button"
                    key={type.id}
                    style={{...styles.typeChip, ...(isSelected ? styles.typeChipActive : {})}}
                    onClick={() => setFormData({...formData, type: type.id})}
                  >
                    <span style={{...styles.typeChipText, ...(isSelected ? styles.typeChipTextActive : {})}}>
                      {type.label} ({type.code})
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={styles.row}>
              <div style={styles.col}>
                <span style={styles.label}>TỪ NGÀY (YYYY-MM-DD)</span>
                <input
                  style={styles.input}
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  placeholder="VD: 2026-03-02"
                />
              </div>
              <div style={styles.col}>
                <span style={styles.label}>ĐẾN NGÀY (YYYY-MM-DD)</span>
                <input
                  style={styles.input}
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  placeholder="VD: 2026-03-05"
                />
              </div>
            </div>

            <span style={styles.label}>GHI CHÚ CHI TIẾT</span>
            <textarea
              style={{...styles.input, ...styles.textArea}}
              rows={4}
              value={formData.note}
              onChange={(e) => setFormData({...formData, note: e.target.value})}
              placeholder="Nhập lý do..."
            />
          </div>

          <div style={styles.footer}>
            <button type="button" style={{...styles.button, ...styles.btnCancel}} onClick={onClose}>
              <span style={styles.btnCancelText}>Hủy bỏ</span>
            </button>
            <button type="button" style={{...styles.button, ...styles.btnSave}} onClick={handleSave}>
              <span style={styles.btnSaveText}>Lưu dữ liệu</span>
            </button>
          </div>
        </div>
    </Modal>
  );
}

const styles = {
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 400 },
  header: { backgroundColor: '#2563eb', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: 'Times New Roman', color: '#fff', fontSize: 18, fontWeight: 'bold' },
  closeBtn: { padding: 4 },
  formContainer: { padding: 16 },
  empCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', padding: 12, borderRadius: 8, borderColor: '#bfdbfe', borderWidth: 1, marginBottom: 16 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontFamily: 'Times New Roman', color: '#fff', fontSize: 18, fontWeight: 'bold' },
  empName: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e3a8a' },
  empDesc: { fontFamily: 'Times New Roman', fontSize: 12, color: '#1d4ed8', marginTop: 2 },
  label: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#6b7280', marginBottom: 6 },
  typeScroll: { flexDirection: 'row', marginBottom: 16 },
  typeChip: { paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 20, backgroundColor: '#f3f4f6', marginRight: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  typeChipActive: { backgroundColor: '#dbeafe', borderColor: '#3b82f6' },
  typeChipText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#4b5563' },
  typeChipTextActive: { fontFamily: 'Times New Roman', color: '#1d4ed8', fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  col: { width: '48%' },
  input: { fontFamily: 'Times New Roman', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fff', color: '#1f2937' },
  textArea: { height: 80, textAlignVertical: 'top', marginBottom: 20 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, borderColor: '#f3f4f6', backgroundColor: '#f9fafb' },
  button: { paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20, borderRadius: 8, marginLeft: 10 },
  btnCancel: { backgroundColor: '#e5e7eb' },
  btnCancelText: { fontFamily: 'Times New Roman', color: '#4b5563', fontWeight: 'bold' },
  btnSave: { backgroundColor: '#2563eb' },
  btnSaveText: { fontFamily: 'Times New Roman', color: '#fff', fontWeight: 'bold' }
};
