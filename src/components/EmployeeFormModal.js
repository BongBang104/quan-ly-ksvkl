import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import React, { useState, useEffect } from 'react';

export default function EmployeeFormModal({ isOpen, onClose, onSave, initialData, settings }) {
  const [formData, setFormData] = useState({
    id: '', name: '', team: '', position: '', qualification: '', isChief: false, isVip: false,
    phone: '', dob: '', licenseNo: '', englishExp: '', healthExp: '' // Bổ sung trường mới
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(initialData);
      } else {
        setFormData({
          id: '', name: '',
          team: settings?.teams[0] || '', position: settings?.positions[0] || '', qualification: settings?.qualifications[0] || '',
          isChief: false, isVip: false, phone: '', dob: '', licenseNo: '', englishExp: '', healthExp: ''
        });
      }
    }
  }, [isOpen, initialData, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!formData.id || !formData.name) {
      alert('Vui lòng nhập tối thiểu Tên và Mã ICAO!');
      return;
    }
    onSave({ ...formData, id: formData.id.toUpperCase() });
    onClose();
  };

  const renderChipSelector = (label, items, fieldKey) => (
    <div style={styles.fieldBlock}>
      <span style={styles.label}>{label}</span>
      <div style={Object.assign({}, styles.chipRow, { display: 'flex', flexWrap: 'wrap' })}>
        {items.map(item => {
          const isSelected = formData[fieldKey] === item;
          return (
            <button type="button" key={item} style={{ ...styles.chip, ...(isSelected ? styles.chipActive : {}) }} onClick={() => setFormData({...formData, [fieldKey]: item})}>
              <span style={{ ...styles.chipText, ...(isSelected ? styles.chipTextActive : {}) }}>{item}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <Modal visible={isOpen} maxWidth="600px">
        <div style={styles.modalContainer}>
          <div style={styles.header}>
            <span style={styles.headerTitle}>{initialData ? 'Sửa thông tin Nhân sự' : 'Thêm mới Nhân sự'}</span>
            <button type="button" onClick={onClose}><Icon name="x" size={24} color="#fff" /></button>
          </div>

          <div style={styles.body}>
            {/* THÔNG TIN CƠ BẢN */}
            <div style={styles.sectionBox}>
              <span style={styles.sectionTitle}>1. Thông tin cơ bản</span>
              <div style={styles.row}>
                <div style={{ ...styles.fieldBlock, flex: 2, marginRight: 10 }}>
                  <span style={styles.label}>HỌ VÀ TÊN (*)</span>
                  <input style={styles.input} placeholder="Nguyễn Văn A" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div style={{ ...styles.fieldBlock, flex: 1 }}>
                  <span style={styles.label}>MÃ ICAO (*)</span>
                  <input style={Object.assign({}, styles.input, styles.inputBold)} placeholder="VA" maxLength={4} value={formData.id} onChange={(e) => setFormData({...formData, id: e.target.value.toUpperCase()})} />
                </div>
              </div>
              <div style={styles.row}>
                <div style={{ ...styles.fieldBlock, flex: 1, marginRight: 10 }}>
                  <span style={styles.label}>NGÀY SINH</span>
                  <input style={styles.input} placeholder="YYYY-MM-DD" value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value})} />
                </div>
                <div style={{ ...styles.fieldBlock, flex: 1 }}>
                  <span style={styles.label}>SỐ ĐIỆN THOẠI</span>
                  <input style={styles.input} placeholder="09xxxx..." value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
            </div>

            {/* CHUYÊN MÔN & CA KÍP */}
            <div style={styles.sectionBox}>
              <span style={styles.sectionTitle}>2. Phân công & Chuyên môn</span>
              {renderChipSelector('KÍP TRỰC', settings?.teams || [], 'team')}
              {renderChipSelector('CHỨC DANH', settings?.positions || [], 'position')}
              {renderChipSelector('NĂNG ĐỊNH', settings?.qualifications || [], 'qualification')}

              <div style={styles.switchRow}>
                <div style={styles.switchBlock}>
                  <span style={styles.switchLabel}><Icon name="star" size={14} color="#eab308"/> Kíp trưởng</span>
                  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.isChief} onChange={(e) => setFormData({...formData, isChief: e.target.checked})} style={{ opacity: 0, width: 0, height: 0 }} />
                    <span style={{ position: 'absolute', inset: 0, backgroundColor: formData.isChief ? '#eab308' : '#cbd5e1', borderRadius: 24, transition: 'background .2s' }}>
                      <span style={{ position: 'absolute', width: 18, height: 18, backgroundColor: '#fff', borderRadius: '50%', top: 3, left: formData.isChief ? 23 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
                    </span>
                  </label>
                </div>
                <div style={styles.switchBlock}>
                  <span style={styles.switchLabel}><Icon name="award" size={14} color="#a855f7"/> Chuyên cơ</span>
                  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.isVip} onChange={(e) => setFormData({...formData, isVip: e.target.checked})} style={{ opacity: 0, width: 0, height: 0 }} />
                    <span style={{ position: 'absolute', inset: 0, backgroundColor: formData.isVip ? '#a855f7' : '#cbd5e1', borderRadius: 24, transition: 'background .2s' }}>
                      <span style={{ position: 'absolute', width: 18, height: 18, backgroundColor: '#fff', borderRadius: '50%', top: 3, left: formData.isVip ? 23 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* CHỨNG CHỈ & GIẤY PHÉP */}
            <div style={styles.sectionBox}>
              <span style={styles.sectionTitle}>3. Giấy phép & Chứng chỉ</span>
              <div style={styles.fieldBlock}>
                <span style={styles.label}>SỐ GIẤY PHÉP KSVKL</span>
                <input style={styles.input} placeholder="VD: 1234/CHK" value={formData.licenseNo} onChange={(e) => setFormData({...formData, licenseNo: e.target.value})} />
              </div>
              <div style={styles.row}>
                <div style={{ ...styles.fieldBlock, flex: 1, marginRight: 10 }}>
                  <span style={styles.label}>HẠN TIẾNG ANH</span>
                  <input style={styles.input} placeholder="YYYY-MM-DD" value={formData.englishExp} onChange={(e) => setFormData({...formData, englishExp: e.target.value})} />
                </div>
                <div style={{ ...styles.fieldBlock, flex: 1 }}>
                  <span style={styles.label}>HẠN SỨC KHỎE</span>
                  <input style={styles.input} placeholder="YYYY-MM-DD" value={formData.healthExp} onChange={(e) => setFormData({...formData, healthExp: e.target.value})} />
                </div>
              </div>
            </div>
            <div style={{height: 20}} />
          </div>

          <div style={styles.footer}>
            <button type="button" style={styles.btnCancel} onClick={onClose}><span style={styles.btnCancelText}>Hủy</span></button>
            <button type="button" style={styles.btnSave} onClick={handleSave}><span style={styles.btnSaveText}>Lưu Thông Tin</span></button>
          </div>
        </div>
    </Modal>
  );
}

const styles = {
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#f8fafc', borderRadius: 16 },
  header: { backgroundColor: '#1e293b', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  headerTitle: { fontFamily: 'Times New Roman', color: '#fff', fontSize: 18, fontWeight: 'bold' },
  body: { padding: 16 },
  sectionBox: { backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
  sectionTitle: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e40af', marginBottom: 12, borderBottomWidth: 1, borderColor: '#eff6ff', paddingBottom: 6 },
  row: { flexDirection: 'row' },
  fieldBlock: { marginBottom: 12 },
  label: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold', color: '#64748b', marginBottom: 4 },
  input: { fontFamily: 'Times New Roman', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 14, color: '#1e293b' },
  inputBold: { fontWeight: 'bold', color: '#2563eb', textAlign: 'center' },
  chipRow: { flexDirection: 'row' },
  chip: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingTop: 6, paddingBottom: 6, paddingLeft: 12, paddingRight: 12, borderRadius: 20, marginRight: 8 },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#1d4ed8' },
  chipText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontWeight: 'bold' },
  chipTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  switchBlock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchLabel: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#334155' },
  footer: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e2e8f0' },
  btnCancel: { flex: 1, padding: 14, backgroundColor: '#f1f5f9', borderRadius: 10, marginRight: 10, alignItems: 'center' },
  btnCancelText: { fontFamily: 'Times New Roman', color: '#475569', fontWeight: 'bold', fontSize: 15 },
  btnSave: { flex: 2, padding: 14, backgroundColor: '#2563eb', borderRadius: 10, alignItems: 'center' },
  btnSaveText: { fontFamily: 'Times New Roman', color: '#fff', fontWeight: 'bold', fontSize: 15 }
};
