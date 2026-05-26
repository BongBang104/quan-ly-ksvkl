import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import React, { useState, useEffect } from 'react';


import { DataService } from '../services/DataService';

const generateDefaultId = (name) => {
    if (!name) return '';
    const cleanName = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, '');
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
            window.alert('Lỗi\nVui lòng nhập ID Đăng nhập và Họ tên.');
            return;
        }

        let newEmps = [...employees];
        if (editingEmp) {
            newEmps = newEmps.map(e => e.id === editingEmp.id ? { ...e, ...formData, icaoCode: formData.icaoCode.toUpperCase() } : e);
        } else {
            if (employees.some(e => e.id === formData.id)) {
                window.alert('Lỗi\nID Đăng nhập này đã tồn tại!');
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
        window.alert('Thành công\n' + (editingEmp ? 'Đã lưu thông tin tài khoản.' : 'Đã tạo tài khoản với Mật khẩu mặc định: tctsdn123'));
        setIsModalOpen(false);
    };

    const handleSaveBulk = async () => {
        if (!bulkData.trim()) {
            window.alert('Lỗi\nVui lòng nhập danh sách nhân sự.');
            return;
        }

        // Normalize \r\n and \r to \n, then split lines
        const lines = bulkData
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .split('\n')
            .filter(line => line.trim() !== '');
        let newEmps = [...employees];
        let addedCount = 0;
        let errorLines = [];

        lines.forEach((line, index) => {
            // Auto-detect separator: tab (from Excel/table paste) or comma
            const sep = line.includes('\t') ? '\t' : ',';
            const parts = line.split(sep).map(p => p.trim()).filter((_, i) => i < 4);
            if (parts.length >= 1 && parts[0]) {
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
            window.alert('Thành công\n' + `Đã tạo thành công ${addedCount} tài khoản.\nMật khẩu mặc định: tctsdn123\n${errorLines.length > 0 ? `Lỗi định dạng ở dòng: ${errorLines.join(', ')}` : ''}`);
            setIsModalOpen(false);
        } else {
            window.alert('Lỗi\nKhông có tài khoản nào được tạo do sai định dạng.');
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
                window.alert('Thành công\nĐã reset mật khẩu về tctsdn123.');
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
        <div style={styles.container}>
            {/* MODAL XÁC NHẬN CUSTOM */}
            <Modal visible={confirmDialog.visible} maxWidth="400px">
                    <div style={styles.confirmBox}>
                        <div style={{flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10}}>
                            <Icon name={confirmDialog.type === 'danger' ? 'alert-triangle' : 'key'} size={20} color={confirmDialog.type === 'danger' ? '#ef4444' : '#d97706'} />
                            <span style={styles.confirmTitle}>{confirmDialog.title}</span>
                        </div>
                        <span style={styles.confirmMsg}>{confirmDialog.msg}</span>
                        <div style={styles.confirmActions}>
                            <button type="button" style={{...styles.confirmBtn, backgroundColor: '#f1f5f9'}} onClick={() => setConfirmDialog({ ...confirmDialog, visible: false })}>
                                <span style={{...styles.confirmBtnText, color: '#64748b'}}>Hủy bỏ</span>
                            </button>
                            <button type="button" style={Object.assign({}, styles.confirmBtn, {backgroundColor: confirmDialog.type === 'danger' ? '#ef4444' : '#2563eb'})} onClick={() => {
                                if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                                else setConfirmDialog({ ...confirmDialog, visible: false });
                            }}>
                                <span style={Object.assign({}, styles.confirmBtnText, {color: '#fff'})}>Đồng ý</span>
                            </button>
                        </div>
                    </div>
            </Modal>

            <div style={styles.headerCard}>
                <div style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                    <div style={styles.iconBox}><Icon name="shield" size={24} color="#fff" /></div>
                    <div>
                        <span style={styles.headerTitle}>Quản Lý Phân Quyền Tài Khoản</span>
                        <span style={styles.headerSub}>Thiết lập Tài khoản và Phân quyền (Role) cho hệ thống</span>
                    </div>
                </div>
                <button type="button" style={styles.addBtn} onClick={() => openModal()}>
                    <Icon name="plus" size={16} color="#fff" />
                    <span style={styles.addBtnText}>Tạo Tài Khoản</span>
                </button>
            </div>

            <div style={styles.searchBox}>
                <Icon name="search" size={16} color="#64748b" />
                <input style={styles.searchInput} placeholder="Tìm kiếm theo Tên đăng nhập, Tên NV, Mã ICAO..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div style={{flex: 1, overflowY: 'auto', display: 'block'}}>
                <div style={styles.table}>
                    <div style={styles.tableHead}>
                        <span style={Object.assign({}, styles.th, {flex: 1.2})}>TÊN ĐĂNG NHẬP</span>
                        <span style={Object.assign({}, styles.th, {flex: 2})}>HỌ VÀ TÊN</span>
                        <span style={Object.assign({}, styles.th, {flex: 0.8})}>MÃ ICAO</span>
                        <span style={Object.assign({}, styles.th, {flex: 1})}>KÍP TRỰC</span>
                        <span style={Object.assign({}, styles.th, {flex: 1.5})}>PHÂN QUYỀN</span>
                        <span style={Object.assign({}, styles.th, {width: 100, textAlign: 'center'})}>THAO TÁC</span>
                    </div>
                    {filteredEmps.map(emp => {
                        const roleConf = roles.find(r => r.id === (emp.role || 'STAFF')) || roles[2];
                        return (
                            <div key={emp.id} style={styles.tableRow}>
                                <div style={{flex: 1.2}}>
                                    <span style={{fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#1e293b'}}>{emp.id}</span>
                                    {emp.isFirstLogin && <span style={{fontFamily: 'Times New Roman', fontSize: 9, color: '#ef4444', fontStyle: 'italic'}}>Chưa đổi pass</span>}
                                </div>
                                <span style={{...styles.td, flex: 2}}>{emp.name}</span>
                                <span style={{...styles.td, flex: 0.8, color: '#2563eb', fontWeight: 'bold'}}>{emp.icaoCode || '-'}</span>
                                <span style={{...styles.td, flex: 1}}>{emp.team}</span>
                                <div style={{flex: 1.5, alignItems: 'flex-start'}}>
                                    <div style={{...styles.roleBadge, backgroundColor: roleConf.bg, borderColor: roleConf.color}}>
                                        <span style={{...styles.roleText, color: roleConf.color}}>{roleConf.label}</span>
                                    </div>
                                </div>
                                <div style={{width: 100, flexDirection: 'row', justifyContent: 'center', gap: 12}}>
                                    <button type="button" onClick={() => handleResetPassword(emp.id)} title="Reset Pass"><Icon name="key" size={16} color="#d97706" /></button>
                                    <button type="button" onClick={() => openModal(emp)} title="Sửa"><Icon name="edit" size={16} color="#2563eb" /></button>
                                    <button type="button" onClick={() => handleDelete(emp.id)} title="Xóa"><Icon name="trash-2" size={16} color="#ef4444" /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <Modal visible={isModalOpen} maxWidth="520px">
                    <div style={styles.modalContent}>
                        <span style={styles.modalTitle}>{editingEmp ? 'Chỉnh sửa Tài khoản' : 'Thêm Tài khoản mới'}</span>

                        {!editingEmp && (
                            <div style={styles.modeTabs}>
                                <button type="button" style={Object.assign({}, styles.modeTab, createMode === 'SINGLE' ? styles.modeTabActive : {})} onClick={() => setCreateMode('SINGLE')}>
                                    <span style={Object.assign({}, styles.modeTabText, createMode === 'SINGLE' ? styles.modeTabTextActive : {})}>Tạo đơn lẻ</span>
                                </button>
                                <button type="button" style={Object.assign({}, styles.modeTab, createMode === 'BULK' ? styles.modeTabActive : {})} onClick={() => setCreateMode('BULK')}>
                                    <span style={Object.assign({}, styles.modeTabText, createMode === 'BULK' ? styles.modeTabTextActive : {})}>Tạo hàng loạt</span>
                                </button>
                            </div>
                        )}

                        {createMode === 'SINGLE' ? (
                            <>
                                <span style={styles.label}>Họ và Tên (*)</span>
                                <input style={styles.input} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="VD: Nguyễn Văn A" />

                                <div style={{flexDirection: 'row', gap: 10}}>
                                    <div style={{flex: 1}}>
                                        <span style={styles.label}>ID Đăng nhập (*)</span>
                                        <input style={Object.assign({}, styles.input, {backgroundColor: editingEmp ? '#f8fafc' : '#e0f2fe'})} value={formData.id} onChange={(e) => setFormData({...formData, id: e.target.value.toLowerCase()})} disabled={editingEmp} />
                                    </div>
                                    <div style={{flex: 0.6}}>
                                        <span style={styles.label}>Mã ICAO</span>
                                        <input style={styles.input} value={formData.icaoCode} onChange={(e) => setFormData({...formData, icaoCode: e.target.value})} placeholder="VD: P01" maxLength={4} />
                                    </div>
                                </div>

                                <span style={styles.label}>Trực thuộc Kíp</span>
                                <div style={{display: 'flex', flexDirection: 'row', maxHeight: 40, marginBottom: 15}}>
                                    {['Trung tâm', ...(settings?.teams || [])].map(t => (
                                        <button type="button" key={t} style={Object.assign({}, styles.chip, formData.team === t ? styles.chipActive : {})} onClick={() => setFormData({...formData, team: t})}>
                                            <span style={Object.assign({}, styles.chipText, formData.team === t ? {color: '#fff'} : {})}>{t}</span>
                                        </button>
                                    ))}
                                </div>

                                <span style={styles.label}>Phân Quyền (Role)</span>
                                <div style={{gap: 8, marginBottom: 20}}>
                                    {roles.map(r => (
                                        <button type="button" key={r.id} style={Object.assign({}, styles.roleSelectBtn, formData.role === r.id ? {borderColor: r.color, backgroundColor: r.bg} : {})} onClick={() => setFormData({...formData, role: r.id})}>
                                            <div style={Object.assign({}, styles.radio, formData.role === r.id ? {borderColor: r.color} : {})}>
                                                {formData.role === r.id && <div style={Object.assign({}, styles.radioDot, {backgroundColor: r.color})} />}
                                            </div>
                                            <span style={Object.assign({}, styles.roleSelectText, formData.role === r.id ? {fontWeight: 'bold', color: r.color} : {})}>{r.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={styles.infoBox}>
                                    <Icon name="info" size={14} color="#0369a1" />
                                    <span style={styles.infoBoxText}>Hỗ trợ paste từ Excel/bảng hoặc nhập tay.{'\n'}Định dạng mỗi dòng (tab hoặc dấu phẩy):{'\n'}<span style={{fontWeight:'bold'}}>Họ Tên, Tên Kíp, Phân quyền, Mã ICAO</span>{'\n'}VD: Nguyễn Văn A, Kíp A, STAFF, P01</span>
                                </div>
                                <textarea
                                    style={{...styles.input, height: 150, fontFamily: 'Courier New', resize: 'vertical', verticalAlign: 'top'}}
                                    placeholder={`Nguyễn Văn A, Kíp A, STAFF, P01\nTrần Văn B, Kíp B, LEADER, NA`}
                                    value={bulkData}
                                    onChange={(e) => setBulkData(e.target.value)}
                                />
                            </>
                        )}

                        <div style={styles.modalActions}>
                            <button type="button" style={styles.btnCancel} onClick={() => setIsModalOpen(false)}><span style={{fontFamily: 'Times New Roman', fontWeight:'bold', color: '#64748b'}}>Hủy</span></button>
                            <button type="button" style={styles.btnSave} onClick={createMode === 'SINGLE' ? handleSaveSingle : handleSaveBulk}>
                                <span style={{fontFamily: 'Times New Roman', fontWeight:'bold', color: '#fff'}}>
                                    {createMode === 'SINGLE' ? 'Lưu Tài Khoản' : 'Tạo Hàng Loạt'}
                                </span>
                            </button>
                        </div>
                    </div>
            </Modal>
        </div>
    );
}

const styles = {
    container: { flex: 1, backgroundColor: '#f1f5f9', padding: 16 },

    // Custom Confirm Modal Styles
    confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    confirmBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 360, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
    confirmTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    confirmMsg: { fontFamily: 'Times New Roman', fontSize: 14, color: '#475569', marginBottom: 20, lineHeight: '22px' },
    confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    confirmBtn: { paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 16, borderRadius: 8 },
    confirmBtnText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold' },

    headerCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    iconBox: { backgroundColor: '#1e293b', padding: 12, borderRadius: 10 },
    headerTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    headerSub: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', marginTop: 4 },
    addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 16, borderRadius: 8, gap: 8 },
    addBtnText: { fontFamily: 'Times New Roman', color: '#fff', fontWeight: 'bold', fontSize: 13 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16, gap: 10 },
    searchInput: { flex: 1, fontFamily: 'Times New Roman', fontSize: 14 },
    table: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
    tableHead: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 12, borderBottomWidth: 1, borderColor: '#e2e8f0' },
    th: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b' },
    tableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
    td: { fontFamily: 'Times New Roman', fontSize: 13, color: '#1e293b' },
    roleBadge: { paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 20, borderWidth: 1 },
    roleText: { fontFamily: 'Times New Roman', fontSize: 10, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', width: '100%', maxWidth: 480, padding: 20, borderRadius: 12 },
    modalTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    modeTabs: { flexDirection: 'row', marginBottom: 15, backgroundColor: '#f1f5f9', borderRadius: 8, padding: 4 },
    modeTab: { flex: 1, paddingTop: 8, paddingBottom: 8, alignItems: 'center', borderRadius: 6 },
    modeTabActive: { backgroundColor: '#fff', boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
    modeTabText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#64748b', fontWeight: 'bold' },
    modeTabTextActive: { color: '#2563eb' },
    infoBox: { flexDirection: 'row', backgroundColor: '#e0f2fe', padding: 12, borderRadius: 8, gap: 8, marginBottom: 10 },
    infoBoxText: { flex: 1, fontFamily: 'Times New Roman', fontSize: 12, color: '#0369a1', lineHeight: '18px' },
    label: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 6, marginTop: 10 },
    input: { fontFamily: 'Times New Roman', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#f8fafc' },
    chip: { paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', marginRight: 8 },
    chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    chipText: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', fontWeight: 'bold' },
    roleSelectBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
    radioDot: { width: 10, height: 10, borderRadius: 5 },
    roleSelectText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#475569' },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 15 },
    btnCancel: { padding: 10, paddingLeft: 20, paddingRight: 20, borderRadius: 8, backgroundColor: '#f1f5f9' },
    btnSave: { padding: 10, paddingLeft: 20, paddingRight: 20, borderRadius: 8, backgroundColor: '#2563eb' }
};
