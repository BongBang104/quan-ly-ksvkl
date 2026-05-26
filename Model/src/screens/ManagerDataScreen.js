import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DataService } from '../services/DataService';

export default function ManagerDataScreen({ employees, setEmployees, settings, onUpdateEmployeeId }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false); 
    
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTeam, setFilterTeam] = useState('ALL');

    const [formData, setFormData] = useState({ 
        id: '', icaoCode: '', name: '', phone: '', email: '', 
        position: 'Kiểm soát viên', qualification: '', isChief: false, isVip: false 
    });
    const [originalId, setOriginalId] = useState(null); 

    // LẤY DANH SÁCH NĂNG ĐỊNH TỪ CÀI ĐẶT (Có fallback nếu chưa cài đặt)
    const qualificationsList = settings?.qualifications?.length > 0 
        ? settings.qualifications 
        : ['Full', 'TWR', 'APP', 'TWR/APP', 'GND', 'Học viên'];

    const stats = useMemo(() => {
        return {
            total: employees.length,
            admins: employees.filter(e => e.role === 'ADMIN').length,
            leaders: employees.filter(e => e.role === 'LEADER' || e.isChief).length,
        };
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const matchSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                emp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (emp.icaoCode && emp.icaoCode.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchTeam = filterTeam === 'ALL' || emp.team === filterTeam;
            return matchSearch && matchTeam;
        });
    }, [employees, searchQuery, filterTeam]);

    const handleEdit = (emp) => {
        setFormData({ 
            id: emp.id, 
            icaoCode: emp.icaoCode || '',
            name: emp.name, 
            phone: emp.phone || '', 
            email: emp.email || '', 
            position: emp.position || 'Kiểm soát viên',
            qualification: emp.qualification || qualificationsList[0] || '', // Mặc định lấy cái đầu tiên nếu rỗng
            isChief: emp.isChief || false,
            isVip: emp.isVip || false
        });
        setOriginalId(emp.id);
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        Alert.alert("Xác nhận", "Bạn có chắc chắn muốn xóa nhân sự này khỏi hệ thống?", [
            { text: "Hủy", style: "cancel" },
            { 
                text: "Xóa", 
                style: "destructive",
                onPress: async () => {
                    const newList = employees.filter(e => e.id !== id);
                    setEmployees(newList);
                    await DataService.saveData(settings, "atc_system", "employees", { list: newList });
                }
            }
        ]);
    };

    const handleSaveProfile = async () => {
        if (!formData.name.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập Họ tên nhân sự.');
            return;
        }

        setIsSaving(true);

        try {
            let updatedList = [...employees];
            
            if (originalId) {
                const index = updatedList.findIndex(e => e.id === originalId);
                if (index > -1) {
                    const oldEmpData = updatedList[index];
                    updatedList[index] = { 
                        ...oldEmpData, 
                        name: formData.name,
                        icaoCode: (formData.icaoCode || '').toUpperCase(), // Sửa lỗi an toàn khi rỗng
                        phone: formData.phone,
                        email: formData.email,
                        position: formData.position,
                        qualification: formData.qualification,
                        isChief: formData.isChief,
                        isVip: formData.isVip
                    };
                }
            } else {
                Alert.alert('Lưu ý', 'Vui lòng sang tab Quản lý Tài Khoản để tạo nhân sự mới.');
                setIsSaving(false);
                return;
            }

            await DataService.saveData(settings, "atc_system", "employees", { list: updatedList });

            setEmployees(updatedList);
            setIsModalOpen(false);
        } catch (error) {
            Alert.alert("Lỗi", "Không thể kết nối máy chủ để lưu dữ liệu.");
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const getRoleConfig = (role) => {
        if (role === 'ADMIN') return { label: 'Quản lý', bg: '#fee2e2', text: '#dc2626' };
        if (role === 'LEADER') return { label: 'Kíp trưởng', bg: '#dbeafe', text: '#2563eb' };
        return { label: 'Nhân viên', bg: '#f1f5f9', text: '#64748b' };
    };

    return (
        <View style={styles.container}>
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { borderBottomColor: '#2563eb' }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#eff6ff' }]}><Feather name="users" size={20} color="#2563eb" /></View>
                    <View>
                        <Text style={styles.statValue}>{stats.total}</Text>
                        <Text style={styles.statLabel}>Tổng Nhân sự</Text>
                    </View>
                </View>
                <View style={[styles.statCard, { borderBottomColor: '#ef4444' }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#fef2f2' }]}><Feather name="shield" size={20} color="#ef4444" /></View>
                    <View>
                        <Text style={styles.statValue}>{stats.admins}</Text>
                        <Text style={styles.statLabel}>Quản trị viên</Text>
                    </View>
                </View>
                <View style={[styles.statCard, { borderBottomColor: '#10b981' }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#f0fdf4' }]}><Feather name="star" size={20} color="#10b981" /></View>
                    <View>
                        <Text style={styles.statValue}>{stats.leaders}</Text>
                        <Text style={styles.statLabel}>Kíp trưởng</Text>
                    </View>
                </View>
            </View>

            <View style={styles.toolbar}>
                <View style={styles.searchBox}>
                    <Feather name="search" size={18} color="#64748b" />
                    <TextInput 
                        style={styles.searchInput} 
                        placeholder="Tìm kiếm theo Tên, Tài khoản hoặc Mã ICAO..." 
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}><Feather name="x" size={16} color="#94a3b8"/></TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.filterRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['ALL', ...(settings?.teams?.filter(t => t !== 'Trung tâm') || [])].map(team => (
                        <TouchableOpacity 
                            key={team} 
                            style={[styles.filterChip, filterTeam === team && styles.filterChipActive]}
                            onPress={() => setFilterTeam(team)}
                        >
                            <Text style={[styles.filterChipText, filterTeam === team && styles.filterChipTextActive]}>
                                {team === 'ALL' ? 'Tất cả Kíp' : team}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
                {filteredEmployees.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Feather name="users" size={40} color="#cbd5e1" />
                        <Text style={styles.emptyStateText}>Không tìm thấy nhân sự nào phù hợp.</Text>
                    </View>
                ) : (
                    <View style={styles.gridContainer}>
                        {filteredEmployees.map((emp) => {
                            const roleConf = getRoleConfig(emp.role);
                            return (
                                <View key={emp.id} style={styles.empCard}>
                                    <View style={styles.empCardHeader}>
                                        <View style={[styles.empAvatar, emp.isChief && {backgroundColor: '#fef08a'}]}>
                                            <Text style={[styles.empAvatarText, emp.isChief && {color: '#854d0e'}]}>
                                                {emp.name ? emp.name.charAt(0).toUpperCase() : 'U'}
                                            </Text>
                                        </View>
                                        <View style={styles.empHeaderInfo}>
                                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                                                <Text style={styles.empName} numberOfLines={1}>{emp.name}</Text>
                                                {emp.icaoCode ? (
                                                    <View style={styles.icaoBadge}><Text style={styles.icaoBadgeText}>{emp.icaoCode}</Text></View>
                                                ) : null}
                                            </View>
                                            <Text style={styles.empId}>Tài khoản: {emp.id}</Text>
                                        </View>
                                        <View style={[styles.roleBadge, { backgroundColor: roleConf.bg }]}>
                                            <Text style={[styles.roleBadgeText, { color: roleConf.text }]}>{roleConf.label}</Text>
                                        </View>
                                    </View>
                                    
                                    <View style={styles.empCardBody}>
                                        <View style={styles.infoRow}>
                                            <Feather name="map-pin" size={14} color="#64748b" />
                                            <Text style={styles.infoText}>{emp.team || 'Chưa xếp kíp'}</Text>
                                        </View>
                                        
                                        <View style={styles.tagsRow}>
                                            <View style={styles.tagBase}><Text style={styles.tagBaseText}>{emp.position || 'KSVKL'}</Text></View>
                                            <View style={styles.tagBase}><Text style={styles.tagBaseText}>{emp.qualification || 'Chưa gán'}</Text></View>
                                            {emp.isChief && <View style={[styles.tagBase, {borderColor: '#fde047', backgroundColor: '#fefce8'}]}><Text style={[styles.tagBaseText, {color: '#a16207'}]}>Kíp trưởng</Text></View>}
                                            {emp.isVip && <View style={styles.tagVip}><Feather name="send" size={10} color="#7e22ce"/><Text style={styles.tagVipText}> VIP</Text></View>}
                                        </View>
                                    </View>

                                    <View style={styles.empCardFooter}>
                                        <TouchableOpacity style={[styles.btnAction, {backgroundColor: '#eff6ff', borderColor: '#bfdbfe'}]} onPress={() => handleEdit(emp)}>
                                            <Feather name="edit-2" size={14} color="#2563eb" />
                                            <Text style={[styles.btnActionText, {color: '#2563eb'}]}>Bổ sung thông tin</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
                <View style={{height: 40}} />
            </ScrollView>

            <Modal visible={isModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Bổ sung Hồ sơ Chuyên Môn</Text>
                            <TouchableOpacity onPress={() => setIsModalOpen(false)} disabled={isSaving}>
                                <Feather name="x" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <View style={{flexDirection: 'row', gap: 10}}>
                                <View style={{flex: 1}}>
                                    <Text style={styles.label}>Tài khoản đăng nhập</Text>
                                    <TextInput style={[styles.input, {backgroundColor: '#f1f5f9', color: '#64748b'}]} value={formData.id} editable={false} />
                                </View>
                                <View style={{flex: 0.5}}>
                                    <Text style={styles.label}>Mã ICAO</Text>
                                    <TextInput style={styles.input} value={formData.icaoCode} onChangeText={t => setFormData({...formData, icaoCode: t})} placeholder="VD: P01" maxLength={4} />
                                </View>
                            </View>

                            <Text style={styles.label}>Họ và tên (*)</Text>
                            <TextInput style={styles.input} value={formData.name} onChangeText={t => setFormData({...formData, name: t})} editable={!isSaving} />

                            <View style={styles.divider} />

                            <Text style={styles.label}>Chức danh / Vị trí</Text>
                            <TextInput 
                                style={styles.input} 
                                value={formData.position} 
                                onChangeText={t => setFormData({...formData, position: t})} 
                                placeholder="VD: Kiểm soát viên, Lãnh đạo..." 
                            />

                            <Text style={styles.label}>Năng định (Chuyên môn)</Text>
                            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15}}>
                                {qualificationsList.map(q => (
                                    <TouchableOpacity 
                                        key={q} 
                                        style={[styles.qualChip, formData.qualification === q && styles.qualChipActive]} 
                                        onPress={() => setFormData({...formData, qualification: q})}
                                    >
                                        <Text style={[styles.qualChipText, formData.qualification === q && {color: '#fff'}]}>{q}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Tùy chọn đặc biệt</Text>
                            <View style={{flexDirection: 'row', gap: 12, marginBottom: 10}}>
                                <TouchableOpacity style={[styles.checkboxBtn, formData.isChief && styles.checkboxBtnActive]} onPress={() => setFormData({...formData, isChief: !formData.isChief})}>
                                    <Feather name={formData.isChief ? "check-square" : "square"} size={18} color={formData.isChief ? "#ea580c" : "#94a3b8"} />
                                    <Text style={[styles.checkboxText, formData.isChief && {color: '#ea580c'}]}>Là Kíp trưởng</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.checkboxBtn, formData.isVip && styles.checkboxBtnActive]} onPress={() => setFormData({...formData, isVip: !formData.isVip})}>
                                    <Feather name={formData.isVip ? "check-square" : "square"} size={18} color={formData.isVip ? "#7e22ce" : "#94a3b8"} />
                                    <Text style={[styles.checkboxText, formData.isVip && {color: '#7e22ce'}]}>Điều hành VIP</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.divider} />

                            <Text style={styles.label}>Số điện thoại liên hệ</Text>
                            <TextInput style={styles.input} value={formData.phone} onChangeText={t => setFormData({...formData, phone: t})} keyboardType="phone-pad" editable={!isSaving} />

                            <Text style={styles.label}>Email</Text>
                            <TextInput style={styles.input} value={formData.email} onChangeText={t => setFormData({...formData, email: t})} keyboardType="email-address" editable={!isSaving} />
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.btnCancel} onPress={() => setIsModalOpen(false)} disabled={isSaving}>
                                <Text style={styles.btnCancelText}>Hủy Bỏ</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btnSave, isSaving && styles.btnSaveDisabled]} onPress={handleSaveProfile} disabled={isSaving}>
                                {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <><Feather name="save" size={16} color="#fff" /><Text style={styles.btnSaveText}>Lưu Hồ Sơ</Text></>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
    statsRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
    statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', borderBottomWidth: 4, elevation: 1, gap: 15 },
    statIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    statValue: { fontFamily: 'Times New Roman', fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    statLabel: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontWeight: 'bold', marginTop: 2 },
    toolbar: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', height: 46 },
    searchInput: { flex: 1, fontFamily: 'Times New Roman', fontSize: 14, marginLeft: 10, color: '#1e293b' },
    filterRow: { marginBottom: 20 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', marginRight: 10 },
    filterChipActive: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
    filterChipText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#64748b' },
    filterChipTextActive: { color: '#fff' },
    listContainer: { flex: 1 },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    empCard: { width: '100%', maxWidth: 350, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, elevation: 1 },
    empCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    empAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    empAvatarText: { color: '#3730a3', fontWeight: 'bold', fontSize: 18, fontFamily: 'Times New Roman' },
    empHeaderInfo: { flex: 1 },
    empName: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 2 },
    icaoBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#fde68a' },
    icaoBadgeText: { fontFamily: 'Courier New', fontSize: 10, fontWeight: 'bold', color: '#b45309' },
    empId: { fontFamily: 'Courier New', fontSize: 11, color: '#64748b', fontWeight: 'bold' },
    roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    roleBadgeText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold' },
    empCardBody: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, gap: 8, marginBottom: 15 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    infoText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#475569' },
    
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 6 },
    tagBase: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    tagBaseText: { fontFamily: 'Times New Roman', fontSize: 10, color: '#475569', fontWeight: 'bold' },
    tagVip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3e8ff', borderWidth: 1, borderColor: '#e9d5ff', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    tagVipText: { fontFamily: 'Times New Roman', fontSize: 10, color: '#7e22ce', fontWeight: 'bold' },

    empCardFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, borderTopWidth: 1, borderColor: '#f1f5f9', paddingTop: 12 },
    btnAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
    btnActionText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold' },
    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyStateText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#94a3b8', marginTop: 12, fontStyle: 'italic' },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90%', elevation: 10, overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    modalTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    modalBody: { padding: 20 },
    label: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 8, marginTop: 10 },
    input: { fontFamily: 'Times New Roman', backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 15, height: 48, fontSize: 14, color: '#1e293b' },
    helperText: { fontFamily: 'Times New Roman', fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: 4 },
    divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 15 },
    
    qualChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
    qualChipActive: { backgroundColor: '#2563eb', borderColor: '#1d4ed8' },
    qualChipText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontWeight: 'bold' },
    checkboxBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
    checkboxBtnActive: { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
    checkboxText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#475569', fontWeight: 'bold' },

    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: 20, borderTopWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', gap: 12 },
    btnCancel: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
    btnCancelText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#64748b' },
    btnSave: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, backgroundColor: '#10b981' },
    btnSaveDisabled: { backgroundColor: '#94a3b8' },
    btnSaveText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#fff' }
});