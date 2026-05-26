import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }) {
  return (
    <Modal visible={isOpen} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Feather name="alert-triangle" size={24} color="#dc2626" />
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.message}>{message}</Text>
          
          <View style={styles.buttonRow}>
            {onCancel && (
              <TouchableOpacity style={[styles.button, styles.btnCancel]} onPress={onCancel}>
                <Text style={styles.btnCancelText}>Hủy bỏ</Text>
              </TouchableOpacity>
            )}
            {onConfirm && (
              <TouchableOpacity style={[styles.button, styles.btnConfirm]} onPress={onConfirm}>
                <Text style={styles.btnConfirmText}>Xác nhận</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '100%', maxWidth: 400, elevation: 5 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#dc2626', marginLeft: 10 },
  message: { fontFamily: 'Times New Roman', fontSize: 14, color: '#4b5563', marginBottom: 20, lineHeight: 20 },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  button: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, marginLeft: 10 },
  btnCancel: { backgroundColor: '#f3f4f6' },
  btnCancelText: { fontFamily: 'Times New Roman', color: '#374151', fontWeight: 'bold' },
  btnConfirm: { backgroundColor: '#dc2626' },
  btnConfirmText: { fontFamily: 'Times New Roman', color: '#fff', fontWeight: 'bold' }
});