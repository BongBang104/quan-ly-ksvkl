import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import React from 'react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }) {
  return (
    <Modal visible={isOpen} maxWidth="440px">
        <div style={styles.modalContainer}>
          <div style={styles.header}>
            <Icon name="alert-triangle" size={24} color="#dc2626" />
            <span style={styles.title}>{title}</span>
          </div>
          <span style={styles.message}>{message}</span>
          
          <div style={styles.buttonRow}>
            {onCancel && (
              <button type="button" style={{ ...styles.button, ...styles.btnCancel }} onClick={onCancel}>
                <span style={styles.btnCancelText}>Hủy bỏ</span>
              </button>
            )}
            {onConfirm && (
              <button type="button" style={{ ...styles.button, ...styles.btnConfirm }} onClick={onConfirm}>
                <span style={styles.btnConfirmText}>Xác nhận</span>
              </button>
            )}
          </div>
        </div>
    </Modal>
  );
}

const styles = {
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '100%', maxWidth: 400, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#dc2626', marginLeft: 10 },
  message: { fontFamily: 'Times New Roman', fontSize: 14, color: '#4b5563', marginBottom: 20, lineHeight: '20px' },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  button: { paddingTop: 8, paddingBottom: 8, paddingLeft: 16, paddingRight: 16, borderRadius: 8, marginLeft: 10 },
  btnCancel: { backgroundColor: '#f3f4f6' },
  btnCancelText: { fontFamily: 'Times New Roman', color: '#374151', fontWeight: 'bold' },
  btnConfirm: { backgroundColor: '#dc2626' },
  btnConfirmText: { fontFamily: 'Times New Roman', color: '#fff', fontWeight: 'bold' }
};

