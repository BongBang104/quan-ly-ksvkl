import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DataService } from '../services/DataService';

const generateDefaultId = (name) => {
    if (!name) return '';
    const cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, '');
    return `tctsdn.${cleanName}`;
};

export default function AccountManagerScreen({ employees, setEmployees, settings }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmp, setEditingEmp] = useState(null);
    const [createMode, setCreateMode] = useState('SINGLE'); 
    
    const [formData, setFormData] = useState({ id: '', name: '', icaoCode: '', team: 'Kíp A', role: 'STAFF' });
    const [bulkData, setBulkData] = useState('');
    const [search, setSearch] = useState('');

    // Hộp thoại Confirm Custom thay cho Alert mặc định
    const [confirmDialog, setConfirmDialog] = useState({ visible: false, title: '', msg: '', onConfirm: null, type: 'info' });

    const roles = [
        { id: 'ADMIN', label: 'Quản trị viên (Admin)', color: '#ef4444', bg: '#fef2f2' },
        { id: 'LEADER', label: 'Kíp trưởng (Leader)', color: '#2563eb', bg: '#eff6ff' },
        { id: 'STAFF', label: 'Nhân viên (Staff)', color: '#10b981', bg: '#f0fdf4' }
    ];

    useEffect(() => {
        if (!editingEmp && createMode === 'SINGLE' && formData.name) {
            setFormData(prev => ({ ...prev, id: generateDefaultId(formData.name) }));
        }
    }, [formData.name, createMode, editingEmp]);

    const openModal = (emp = null) => {
        setCreateMode('SINGLE');
        if (emp) {
            setEditingEmp(emp);
            setFormData({ id: emp.id, name: emp.name, icaoCode: emp.icaoCode || '', team: emp.team || 'Trung tâm', role: emp.role || 'STAFF' });
        } else {
            setEditingEmp(null);
            setFormData({ id: '', name: '', icaoCode: '', team: settings?.teams?.[0] || 'Kíp A', role: 'STAFF' });
            setBulkData('');
        }
        setIsModalOpen(true);
    };

    const handleSaveSingle = async () => {
        if (!formData.id || !formData.name) {
            Alert.alert('Lỗi', 'Vui lòng nhập ID Đăng nhập và Họ tên.');
            return;
        }

        let newEmps = [...employees];
        if (editingEmp) {
            newEmps = newEmps.map(e => e.id === editingEmp.id ? { ...e, ...formData, icaoCode: formData.icaoCode.toUpperCase() } : e);
        } else {
            if (employees.some(e => e.id === formData.id)) {
                Alert.alert('Lỗi', 'ID Đăng nhập này đã tồn tại!');
                return;
            }
            newEmps.push({ 
                ...formData, 
                icaoCode: formData.icaoCode.toUpperCase(),
                position: formData.role === 'LEADER' ? 'Kíp trưởng' : (formData.role === 'ADMIN' ? 'Lãnh đạo' : 'Kiểm soát viên'),
                password: 'tctsdn123',
                isFirstLogin: true
            });
        }

        setEmployees(newEmps);
        await DataService.saveData(settings, "atc_system", "employees", { list: newEmps });
        Alert.alert('Thành công', editingEmp ? 'Đã lưu thông tin tài khoản.' : 'Đã tạo tài khoản với Mật khẩu mặc định: tctsdn123');
        setIsModalOpen(false);
    };

    const handleSaveBulk = async () => {
        if (!bulkData.trim()) {
            Alert.alert('Lỗi', 'Vui lòng nhập danh sách nhân sự.');
            return;
        }

        const lines = bulkData.split('\n').filter(line => line.trim() !== '');
        let newEmps = [...employees];
        let addedCount = 0;
        let errorLines = [];

        lines.forEach((line, index) => {
            const parts = line.split(',').map(p => p.trim());
            if (parts.length >= 1) {
                const name = parts[0];
                const team = parts[1] || (settings?.teams?.[0] || 'Kíp A');
                const roleInput = (parts[2] || 'STAFF').toUpperCase();
                const role = ['ADMIN', 'LEADER', 'STAFF'].includes(roleInput) ? roleInput : 'STAFF';
                const icaoCode = (parts[3] || '').toUpperCase(); 
                
                let id = generateDefaultId(name);
                let counter = 1;
                while (newEmps.some(e => e.id === id)) {
                    id = `${generateDefaultId(name)}${counter}`;
                    counter++;
                }

                newEmps.push({
                    id, name, team, role, icaoCode,
                    position: role === 'LEADER' ? 'Kíp trưởng' : (role === 'ADMIN' ? 'Lãnh đạo' : 'Kiểm soát viên'),
                    password: 'tctsdn123',
                    isFirstLogin: true
                });
                addedCount++;
            } else {
                errorLines.push(index + 1);
            }
        });

        if (addedCount > 0) {
            setEmployees(newEmps);
            await DataService.saveData(settings, "atc_system", "employees", { list: newEmps });
            Alert.alert('Thành công', `Đã tạo thành công ${addedCount} tài khoản.\nMật khẩu mặc định: tctsdn123\n${errorLines.length > 0 ? `Lỗi định dạng ở dòng: ${errorLines.join(', ')}` : ''}`);
            setIsModalOpen(false);
        } else {
            Alert.alert('Lỗi', 'Không có tài khoản nào được tạo do sai định dạng.');
        }
    };

    const handleResetPassword = (empId) => {
        setConfirmDialog({
            visible: true,
            type: 'warning',
            title: 'Khôi phục Mật khẩu',
            msg: `Bạn có chắc chắn muốn đưa mật khẩu của tài khoản [${empId}] về mặc định là "tctsdn123"?\n\nNgười dùng sẽ bị bắt buộc đổi lại mật khẩu ở lần đăng nhập tiếp theo.`,
            onConfirm: async () => {
                const newEmps = employees.map(e => e.id === empId ? { ...e, password: 'tctsdn123', isFirstLogin: true } : e);
                setEmployees(newEmps);
                await DataService.saveData(settings, "atc_system", "employees", { list: newEmps });
                setConfirmDialog({ visible: false, title: '', msg: '', onConfirm: null });
                Alert.alert('Thành công', 'Đã reset mật khẩu về tctsdn123.');
            }
        });
    };

    const handleDelete = (id) => {
        setConfirmDialog({
            visible: true,
            type: 'danger',
            title: 'Xóa tài khoản',
            msg: `Hành động này sẽ xóa hoàn toàn tài khoản [${id}] khỏi hệ thống.\n\nBạn có chắc chắn muốn tiếp tục?`,
            onConfirm: async () => {
                const newEmps = employees.filter(e => e.id !== id);
                setEmployees(newEmps);
                await DataService.saveData(settings, "atc_system", "employees", { list: newEmps });
                setConfirmDialog({ visible: false, title: '', msg: '', onConfirm: null });
            }
        });
    };

    const filteredEmps = employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase()) || (e.icaoCode && e.icaoCode.toLowerCase().includes(search.toLowerCase())));

    return (
        <View style={styles.container}>
            {/* MODAL XÁC NHẬN CUSTOM */}
            <Modal visible={confirmDialog.visible} transparent animationType="fade">
                <View style={styles.confirmOverlay}>
                    <View style={styles.confirmBox}>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10}}>
                            <Feather name={confirmDialog.type === 'danger' ? 'alert-triangle' : 'key'} size={20} color={confirmDialog.type === 'danger' ? '#ef4444' : '#d97706'} />
                            <Text style={styles.confirmTitle}>{confirmDialog.title}</Text>
                        </View>
                        <Text style={styles.confirmMsg}>{confirmDialog.msg}</Text>
                        <View style={styles.confirmActions}>
                            <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#f1f5f9'}]} onPress={() => setConfirmDialog({ ...confirmDialog, visible: false })}>
                                <Text style={[styles.confirmBtnText, {color: '#64748b'}]}>Hủy bỏ</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: confirmDialog.type === 'danger' ? '#ef4444' : '#2563eb'}]} onPress={() => {
                                if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                                else setConfirmDialog({ ...confirmDialog, visible: false });
                            }}>
                                <Text style={[styles.confirmBtnText, {color: '#fff'}]}>Đồng ý</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <View style={styles.headerCard}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                    <View style={styles.iconBox}><Feather name="shield" size={24} color="#fff" /></View>
                    <View>
                        <Text style={styles.headerTitle}>Quản Lý Phân Quyền Tài Khoản</Text>
                        <Text style={styles.headerSub}>Thiết lập Tài khoản và Phân quyền (Role) cho hệ thống</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
                    <Feather name="plus" size={16} color="#fff" />
                    <Text style={styles.addBtnText}>Tạo Tài Khoản</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
                <Feather name="search" size={16} color="#64748b" />
                <TextInput style={styles.searchInput} placeholder="Tìm kiếm theo Tên đăng nhập, Tên NV, Mã ICAO..." value={search} onChangeText={setSearch} />
            </View>

            <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>
                <View style={styles.table}>
                    <View style={styles.tableHead}>
                        <Text style={[styles.th, {flex: 1.2}]}>TÊN ĐĂNG NHẬP</Text>
                        <Text style={[styles.th, {flex: 2}]}>HỌ VÀ TÊN</Text>
                        <Text style={[styles.th, {flex: 0.8}]}>MÃ ICAO</Text>
                        <Text style={[styles.th, {flex: 1}]}>KÍP TRỰC</Text>
                        <Text style={[styles.th, {flex: 1.5}]}>PHÂN QUYỀN</Text>
                        <Text style={[styles.th, {width: 100, textAlign: 'center'}]}>THAO TÁC</Text>
                    </View>
                    {filteredEmps.map(emp => {
                        const roleConf = roles.find(r => r.id === (emp.role || 'STAFF')) || roles[2];
                        return (
                            <View key={emp.id} style={styles.tableRow}>
                                <View style={{flex: 1.2}}>
                                    <Text style={{fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#1e293b'}}>{emp.id}</Text>
                                    {emp.isFirstLogin && <Text style={{fontFamily: 'Times New Roman', fontSize: 9, color: '#ef4444', fontStyle: 'italic'}}>Chưa đổi pass</Text>}
                                </View>
                                <Text style={[styles.td, {flex: 2}]}>{emp.name}</Text>
                                <Text style={[styles.td, {flex: 0.8, color: '#2563eb', fontWeight: 'bold'}]}>{emp.icaoCode || '-'}</Text>
                                <Text style={[styles.td, {flex: 1}]}>{emp.team}</Text>
                                <View style={{flex: 1.5, alignItems: 'flex-start'}}>
                                    <View style={[styles.roleBadge, {backgroundColor: roleConf.bg, borderColor: roleConf.color}]}>
                                        <Text style={[styles.roleText, {color: roleConf.color}]}>{roleConf.label}</Text>
                                    </View>
                                </View>
                                <View style={{width: 100, flexDirection: 'row', justifyContent: 'center', gap: 12}}>
                                    <TouchableOpacity onPress={() => handleResetPassword(emp.id)} title="Reset Pass"><Feather name="key" size={16} color="#d97706" /></TouchableOpacity>
                                    <TouchableOpacity onPress={() => openModal(emp)} title="Sửa"><Feather name="edit" size={16} color="#2563eb" /></TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDelete(emp.id)} title="Xóa"><Feather name="trash-2" size={16} color="#ef4444" /></TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            <Modal visible={isModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editingEmp ? 'Chỉnh sửa Tài khoản' : 'Thêm Tài khoản mới'}</Text>
                        
                        {!editingEmp && (
                            <View style={styles.modeTabs}>
                                <TouchableOpacity style={[styles.modeTab, createMode === 'SINGLE' && styles.modeTabActive]} onPress={() => setCreateMode('SINGLE')}>
                                    <Text style={[styles.modeTabText, createMode === 'SINGLE' && styles.modeTabTextActive]}>Tạo đơn lẻ</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modeTab, createMode === 'BULK' && styles.modeTabActive]} onPress={() => setCreateMode('BULK')}>
                                    <Text style={[styles.modeTabText, createMode === 'BULK' && styles.modeTabTextActive]}>Tạo hàng loạt</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {createMode === 'SINGLE' ? (
                            <>
                                <Text style={styles.label}>Họ và Tên (*)</Text>
                                <TextInput style={styles.input} value={formData.name} onChangeText={t => setFormData({...formData, name: t})} placeholder="VD: Nguyễn Văn A" />

                                <View style={{flexDirection: 'row', gap: 10}}>
                                    <View style={{flex: 1}}>
                                        <Text style={styles.label}>ID Đăng nhập (*)</Text>
                                        <TextInput style={[styles.input, {backgroundColor: editingEmp ? '#f8fafc' : '#e0f2fe'}]} value={formData.id} onChangeText={t => setFormData({...formData, id: t.toLowerCase()})} editable={!editingEmp} />
                                    </View>
                                    <View style={{flex: 0.6}}>
                                        <Text style={styles.label}>Mã ICAO</Text>
                                        <TextInput style={styles.input} value={formData.icaoCode} onChangeText={t => setFormData({...formData, icaoCode: t})} placeholder="VD: P01" maxLength={4} />
                                    </View>
                                </View>

                                <Text style={styles.label}>Trực thuộc Kíp</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{maxHeight: 40, marginBottom: 15}}>
                                    {['Trung tâm', ...(settings?.teams || [])].map(t => (
                                        <TouchableOpacity key={t} style={[styles.chip, formData.team === t && styles.chipActive]} onPress={() => setFormData({...formData, team: t})}>
                                            <Text style={[styles.chipText, formData.team === t && {color: '#fff'}]}>{t}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <Text style={styles.label}>Phân Quyền (Role)</Text>
                                <View style={{gap: 8, marginBottom: 20}}>
                                    {roles.map(r => (
                                        <TouchableOpacity key={r.id} style={[styles.roleSelectBtn, formData.role === r.id && {borderColor: r.color, backgroundColor: r.bg}]} onPress={() => setFormData({...formData, role: r.id})}>
                                            <View style={[styles.radio, formData.role === r.id && {borderColor: r.color}]}>
                                                {formData.role === r.id && <View style={[styles.radioDot, {backgroundColor: r.color}]} />}
                                            </View>
                                            <Text style={[styles.roleSelectText, formData.role === r.id && {fontWeight: 'bold', color: r.color}]}>{r.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        ) : (
                            <>
                                <View style={styles.infoBox}>
                                    <Feather name="info" size={14} color="#0369a1" />
                                    <Text style={styles.infoBoxText}>Định dạng mỗi dòng:{'\n'}<Text style={{fontWeight:'bold'}}>Họ Tên, Tên Kíp, Phân quyền, Mã ICAO</Text>{'\n'}VD: Nguyễn Văn A, Kíp A, STAFF, P01</Text>
                                </View>
                                <TextInput 
                                    style={[styles.input, {height: 150, textAlignVertical: 'top', fontFamily: 'Courier New'}]} 
                                    multiline 
                                    placeholder={`Nguyễn Văn A, Kíp A, STAFF, P01\nTrần Văn B, Kíp B, LEADER, NA`}
                                    value={bulkData}
                                    onChangeText={setBulkData}
                                />
                            </>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnCancel} onPress={() => setIsModalOpen(false)}><Text style={{fontFamily: 'Times New Roman', fontWeight:'bold', color: '#64748b'}}>Hủy</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.btnSave} onPress={createMode === 'SINGLE' ? handleSaveSingle : handleSaveBulk}>
                                <Text style={{fontFamily: 'Times New Roman', fontWeight:'bold', color: '#fff'}}>
                                    {createMode === 'SINGLE' ? 'Lưu Tài Khoản' : 'Tạo Hàng Loạt'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9', padding: 16 },
    
    // Custom Confirm Modal Styles
    confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    confirmBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 360, elevation: 10 },
    confirmTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    confirmMsg: { fontFamily: 'Times New Roman', fontSize: 14, color: '#475569', marginBottom: 20, lineHeight: 22 },
    confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    confirmBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
    confirmBtnText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold' },

    headerCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    iconBox: { backgroundColor: '#1e293b', padding: 12, borderRadius: 10 },
    headerTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    headerSub: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', marginTop: 4 },
    addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, gap: 8 },
    addBtnText: { fontFamily: 'Times New Roman', color: '#fff', fontWeight: 'bold', fontSize: 13 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16, gap: 10 },
    searchInput: { flex: 1, fontFamily: 'Times New Roman', fontSize: 14 },
    table: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
    tableHead: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 12, borderBottomWidth: 1, borderColor: '#e2e8f0' },
    th: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b' },
    tableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
    td: { fontFamily: 'Times New Roman', fontSize: 13, color: '#1e293b' },
    roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
    roleText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', width: '100%', maxWidth: 480, padding: 20, borderRadius: 12 },
    modalTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    modeTabs: { flexDirection: 'row', marginBottom: 15, backgroundColor: '#f1f5f9', borderRadius: 8, padding: 4 },
    modeTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
    modeTabActive: { backgroundColor: '#fff', elevation: 1 },
    modeTabText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#64748b', fontWeight: 'bold' },
    modeTabTextActive: { color: '#2563eb' },
    infoBox: { flexDirection: 'row', backgroundColor: '#e0f2fe', padding: 12, borderRadius: 8, gap: 8, marginBottom: 10 },
    infoBoxText: { flex: 1, fontFamily: 'Times New Roman', fontSize: 12, color: '#0369a1', lineHeight: 18 },
    label: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 6, marginTop: 10 },
    input: { fontFamily: 'Times New Roman', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#f8fafc' },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', marginRight: 8 },
    chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    chipText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontWeight: 'bold' },
    roleSelectBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
    radioDot: { width: 10, height: 10, borderRadius: 5 },
    roleSelectText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#475569' },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 15 },
    btnCancel: { padding: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#f1f5f9' },
    btnSave: { padding: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#2563eb' }
});