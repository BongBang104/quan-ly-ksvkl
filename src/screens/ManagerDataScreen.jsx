import Spinner from "../components/Spinner.jsx";
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import React, { useState, useMemo } from 'react';

import { DataService } from '../services/DataService';

export default function ManagerDataScreen({ employees, setEmployees, settings, onUpdateEmployeeId, addNotification }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterTeam, setFilterTeam] = useState('ALL');

    const [formData, setFormData] = useState({
        id: '', icaoCode: '', name: '', phone: '', email: '',
        position: 'Kiểm soát viên', qualification: '', isChief: false, isVip: false
    });
    const [originalId, setOriginalId] = useState(null);

    const qualificationsList = settings?.qualifications?.length > 0
        ? settings.qualifications
        : ['Full', 'TWR', 'APP', 'TWR/APP', 'GND', 'Học viên'];

    const stats = useMemo(() => {
        return {
            total: employees.length,
            admins: employees.filter(e => e.role === 'ADMIN').length,
            leaders: employees.filter(e => e.role === 'CHIEF' || e.isChief).length,  // CHIEF = kíp trưởng
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
            qualification: emp.qualification || qualificationsList[0] || '',
            isChief: emp.isChief || false,
            isVip: emp.isVip || false
        });
        setOriginalId(emp.id);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Xác nhận\nBạn có chắc chắn muốn xóa nhân sự này khỏi hệ thống?')) return;
        const newList = employees.filter(e => e.id !== id);
        setEmployees(newList);
        await DataService.saveData(settings, "atc_system", "employees", { list: newList });
    };

    const handleSaveProfile = async () => {
        if (!formData.name.trim()) {
            addNotification('Thiếu thông tin', 'Vui lòng nhập Họ tên nhân sự.', 'warning');
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
                        icaoCode: (formData.icaoCode || '').toUpperCase(),
                        phone: formData.phone,
                        email: formData.email,
                        position: formData.position,
                        qualification: formData.qualification,
                        isChief: formData.isChief,
                        isVip: formData.isVip
                    };
                }
            } else {
                addNotification('Lưu ý', 'Vui lòng sang tab Quản lý Tài Khoản để tạo nhân sự mới.', 'info');
                setIsSaving(false);
                return;
            }

            await DataService.saveData(settings, "atc_system", "employees", { list: updatedList });

            setEmployees(updatedList);
            setIsModalOpen(false);
        } catch (error) {
            addNotification('Lỗi', 'Không thể kết nối máy chủ để lưu dữ liệu.', 'error');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const getRoleConfig = (role) => {
        if (role === 'ADMIN') return { label: 'Quản lý', bg: '#fee2e2', text: '#dc2626' };
        if (role === 'CHIEF') return { label: 'Kíp trưởng', bg: '#dbeafe', text: '#2563eb' };
        return { label: 'Nhân viên', bg: '#f1f5f9', text: '#64748b' };
    };

    return (
        <div style={styles.container}>
            <div style={styles.statsRow}>
                <div style={{...styles.statCard, borderBottomColor: '#2563eb'}}>
                    <div style={{...styles.statIconBox, backgroundColor: '#eff6ff'}}><Icon name="users" size={20} color="#2563eb" /></div>
                    <div>
                        <span style={styles.statValue}>{stats.total}</span>
                        <span style={styles.statLabel}>Tổng Nhân sự</span>
                    </div>
                </div>
                <div style={{...styles.statCard, borderBottomColor: '#ef4444'}}>
                    <div style={{...styles.statIconBox, backgroundColor: '#fef2f2'}}><Icon name="shield" size={20} color="#ef4444" /></div>
                    <div>
                        <span style={styles.statValue}>{stats.admins}</span>
                        <span style={styles.statLabel}>Quản trị viên</span>
                    </div>
                </div>
                <div style={{...styles.statCard, borderBottomColor: '#10b981'}}>
                    <div style={{...styles.statIconBox, backgroundColor: '#f0fdf4'}}><Icon name="star" size={20} color="#10b981" /></div>
                    <div>
                        <span style={styles.statValue}>{stats.leaders}</span>
                        <span style={styles.statLabel}>Kíp trưởng</span>
                    </div>
                </div>
            </div>

            <div style={styles.toolbar}>
                <div style={styles.searchBox}>
                    <Icon name="search" size={18} color="#64748b" />
                    <input
                        style={styles.searchInput}
                        placeholder="Tìm kiếm theo Tên, Tài khoản hoặc Mã ICAO..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery.length > 0 && (
                        <button type="button" onClick={() => setSearchQuery('')}><Icon name="x" size={16} color="#94a3b8"/></button>
                    )}
                </div>
            </div>

            <div style={styles.filterRow}>
                <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
                    {['ALL', ...(settings?.teams?.filter(t => t !== 'Trung tâm') || [])].map(team => (
                        <button type="button"
                            key={team}
                            style={{...styles.filterChip, ...(filterTeam === team && styles.filterChipActive)}}
                            onClick={() => setFilterTeam(team)}
                        >
                            <span style={{...styles.filterChipText, ...(filterTeam === team && styles.filterChipTextActive)}}>
                                {team === 'ALL' ? 'Tất cả Kíp' : team}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div style={styles.listContainer}>
                {filteredEmployees.length === 0 ? (
                    <div style={styles.emptyState}>
                        <Icon name="users" size={40} color="#cbd5e1" />
                        <span style={styles.emptyStateText}>Không tìm thấy nhân sự nào phù hợp.</span>
                    </div>
                ) : (
                    <div style={styles.gridContainer}>
                        {filteredEmployees.map((emp) => {
                            const roleConf = getRoleConfig(emp.role);
                            return (
                                <div key={emp.id} style={styles.empCard}>
                                    <div style={styles.empCardHeader}>
                                        <div style={Object.assign({}, styles.empAvatar, emp.isChief ? {backgroundColor: '#fef08a'} : {})}>
                                            <span style={Object.assign({}, styles.empAvatarText, emp.isChief ? {color: '#854d0e'} : {})}>
                                                {emp.name ? emp.name.charAt(0).toUpperCase() : 'U'}
                                            </span>
                                        </div>
                                        <div style={styles.empHeaderInfo}>
                                            <div style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                                                <span style={styles.empName} >{emp.name}</span>
                                                {emp.icaoCode ? (
                                                    <div style={styles.icaoBadge}><span style={styles.icaoBadgeText}>{emp.icaoCode}</span></div>
                                                ) : null}
                                            </div>
                                            <span style={styles.empId}>Tài khoản: {emp.id}</span>
                                        </div>
                                        <div style={Object.assign({}, styles.roleBadge, { backgroundColor: roleConf.bg })}>
                                            <span style={Object.assign({}, styles.roleBadgeText, { color: roleConf.text })}>{roleConf.label}</span>
                                        </div>
                                    </div>

                                    <div style={styles.empCardBody}>
                                        <div style={styles.infoRow}>
                                            <Icon name="map-pin" size={14} color="#64748b" />
                                            <span style={styles.infoText}>{emp.team || 'Chưa xếp kíp'}</span>
                                        </div>

                                        <div style={styles.tagsRow}>
                                            <div style={styles.tagBase}><span style={styles.tagBaseText}>{emp.position || 'KSVKL'}</span></div>
                                            <div style={styles.tagBase}><span style={styles.tagBaseText}>{emp.qualification || 'Chưa gán'}</span></div>
                                            {emp.isChief && <div style={Object.assign({}, styles.tagBase, {borderColor: '#fde047', backgroundColor: '#fefce8'})}><span style={Object.assign({}, styles.tagBaseText, {color: '#a16207'})}>Kíp trưởng</span></div>}
                                            {emp.isVip && <div style={styles.tagVip}><Icon name="send" size={10} color="#7e22ce"/><span style={styles.tagVipText}> VIP</span></div>}
                                        </div>
                                    </div>

                                    <div style={styles.empCardFooter}>
                                        <button type="button" style={Object.assign({}, styles.btnAction, {backgroundColor: '#eff6ff', borderColor: '#bfdbfe'})} onClick={() => handleEdit(emp)}>
                                            <Icon name="edit-2" size={14} color="#2563eb" />
                                            <span style={Object.assign({}, styles.btnActionText, {color: '#2563eb'})}>Bổ sung thông tin</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div style={{height: 40}} />
            </div>

            <Modal visible={isModalOpen} maxWidth="550px">
                    <div style={styles.modalContent}>
                        <div style={styles.modalHeader}>
                            <span style={styles.modalTitle}>Bổ sung Hồ sơ Chuyên Môn</span>
                            <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                                <Icon name="x" size={24} color="#64748b" />
                            </button>
                        </div>

                        <div style={styles.modalBody}>
                            <div style={{flexDirection: 'row', gap: 10}}>
                                <div style={{flex: 1}}>
                                    <span style={styles.label}>Tài khoản đăng nhập</span>
                                    <input style={Object.assign({}, styles.input, {backgroundColor: '#f1f5f9', color: '#64748b'})} value={formData.id} disabled={true} />
                                </div>
                                <div style={{flex: 0.5}}>
                                    <span style={styles.label}>Mã ICAO</span>
                                    <input style={styles.input} value={formData.icaoCode} onChange={(e) => setFormData({...formData, icaoCode: e.target.value})} placeholder="VD: P01" maxLength={4} />
                                </div>
                            </div>

                            <span style={styles.label}>Họ và tên (*)</span>
                            <input style={styles.input} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} disabled={isSaving} />

                            <div style={styles.divider} />

                            <span style={styles.label}>Chức danh / Vị trí</span>
                            <input
                                style={styles.input}
                                value={formData.position}
                                onChange={(e) => setFormData({...formData, position: e.target.value})}
                                placeholder="VD: Kiểm soát viên, Lãnh đạo..."
                            />

                            <span style={styles.label}>Năng định (Chuyên môn)</span>
                            <div style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15}}>
                                {qualificationsList.map(q => (
                                    <button type="button"
                                        key={q}
                                        style={{...styles.qualChip, ...(formData.qualification === q && styles.qualChipActive)}}
                                        onClick={() => setFormData({...formData, qualification: q})}
                                    >
                                        <span style={{...styles.qualChipText, ...(formData.qualification === q && {color: '#fff'})}}>{q}</span>
                                    </button>
                                ))}
                            </div>

                            <span style={styles.label}>Tùy chọn đặc biệt</span>
                            <div style={{flexDirection: 'row', gap: 12, marginBottom: 10}}>
                                <button type="button" style={{...styles.checkboxBtn, ...(formData.isChief && styles.checkboxBtnActive)}} onClick={() => setFormData({...formData, isChief: !formData.isChief})}>
                                    <Icon name={formData.isChief ? "check-square" : "square"} size={18} color={formData.isChief ? "#ea580c" : "#94a3b8"} />
                                    <span style={{...styles.checkboxText, ...(formData.isChief && {color: '#ea580c'})}}>Là Kíp trưởng</span>
                                </button>

                                <button type="button" style={{...styles.checkboxBtn, ...(formData.isVip && styles.checkboxBtnActive)}} onClick={() => setFormData({...formData, isVip: !formData.isVip})}>
                                    <Icon name={formData.isVip ? "check-square" : "square"} size={18} color={formData.isVip ? "#7e22ce" : "#94a3b8"} />
                                    <span style={{...styles.checkboxText, ...(formData.isVip && {color: '#7e22ce'})}}>Điều hành VIP</span>
                                </button>
                            </div>

                            <div style={styles.divider} />

                            <span style={styles.label}>Số điện thoại liên hệ</span>
                            <input style={styles.input} value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} disabled={isSaving} />

                            <span style={styles.label}>Email</span>
                            <input style={styles.input} value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} disabled={isSaving} />
                        </div>

                        <div style={styles.modalFooter}>
                            <button type="button" style={styles.btnCancel} onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                                <span style={styles.btnCancelText}>Hủy Bỏ</span>
                            </button>
                            <button type="button" style={{...styles.btnSave, ...(isSaving && styles.btnSaveDisabled)}} onClick={handleSaveProfile} disabled={isSaving}>
                                {isSaving ? <Spinner color="#fff" size="small" /> : <><Icon name="save" size={16} color="#fff" /><span style={styles.btnSaveText}>Lưu Hồ Sơ</span></>}
                            </button>
                        </div>
                    </div>
            </Modal>

        </div>
    );
}

const styles = {
    container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
    statsRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
    statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', borderBottomWidth: 4, boxShadow: "0 4px 6px rgba(0,0,0,0.08)", gap: 15 },
    statIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    statValue: { fontFamily: 'Times New Roman', fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    statLabel: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontWeight: 'bold', marginTop: 2 },
    toolbar: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingLeft: 15, paddingRight: 15, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', height: 46 },
    searchInput: { flex: 1, fontFamily: 'Times New Roman', fontSize: 14, marginLeft: 10, color: '#1e293b' },
    filterRow: { marginBottom: 20 },
    filterChip: { paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', marginRight: 10 },
    filterChipActive: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
    filterChipText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#64748b' },
    filterChipTextActive: { color: '#fff' },
    listContainer: { flex: 1, overflowY: 'auto', display: 'block' },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    empCard: { width: '100%', maxWidth: 350, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
    empCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    empAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    empAvatarText: { color: '#3730a3', fontWeight: 'bold', fontSize: 18, fontFamily: 'Times New Roman' },
    empHeaderInfo: { flex: 1 },
    empName: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 2 },
    icaoBadge: { backgroundColor: '#fef3c7', paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4, borderWidth: 1, borderColor: '#fde68a' },
    icaoBadgeText: { fontFamily: 'Courier New', fontSize: 10, fontWeight: 'bold', color: '#b45309' },
    empId: { fontFamily: 'Courier New', fontSize: 11, color: '#64748b', fontWeight: 'bold' },
    roleBadge: { paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 6 },
    roleBadgeText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold' },
    empCardBody: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, gap: 8, marginBottom: 15 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    infoText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#475569' },

    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 6 },
    tagBase: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 },
    tagBaseText: { fontFamily: 'Times New Roman', fontSize: 10, color: '#475569', fontWeight: 'bold' },
    tagVip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3e8ff', borderWidth: 1, borderColor: '#e9d5ff', borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 },
    tagVipText: { fontFamily: 'Times New Roman', fontSize: 10, color: '#7e22ce', fontWeight: 'bold' },

    empCardFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, borderTopWidth: 1, borderColor: '#f1f5f9', paddingTop: 12 },
    btnAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, borderWidth: 1 },
    btnActionText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold' },
    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyStateText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#94a3b8', marginTop: 12, fontStyle: 'italic' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, boxShadow: "0 4px 6px rgba(0,0,0,0.08)" },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    modalTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    modalBody: { padding: 20 },
    label: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 8, marginTop: 10 },
    input: { fontFamily: 'Times New Roman', backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingLeft: 15, paddingRight: 15, height: 48, fontSize: 14, color: '#1e293b' },
    helperText: { fontFamily: 'Times New Roman', fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: 4 },
    divider: { height: 1, backgroundColor: '#e2e8f0', marginTop: 15, marginBottom: 15 },

    qualChip: { paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
    qualChipActive: { backgroundColor: '#2563eb', borderColor: '#1d4ed8' },
    qualChipText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontWeight: 'bold' },
    checkboxBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
    checkboxBtnActive: { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
    checkboxText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#475569', fontWeight: 'bold' },

    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: 20, borderTopWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', gap: 12 },
    btnCancel: { paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
    btnCancelText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#64748b' },
    btnSave: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, borderRadius: 8, backgroundColor: '#10b981' },
    btnSaveDisabled: { backgroundColor: '#94a3b8' },
    btnSaveText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#fff' }
};
