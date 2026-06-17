import Spinner from "../components/Spinner.jsx";
import Icon from '../components/Icon.jsx';
import React, { useState } from 'react';

import { DataService } from '../services/DataService';

// ==========================================
// COMPONENT PHỤ: EDITOR CHO DANH SÁCH (TỔ CHỨC)
// ==========================================
const OrgListEditor = ({ title, listKey, settings, setSettings }) => {
    const [val, setVal] = useState('');
    const handleAdd = () => {
        if (!val.trim()) return;
        const currentList = settings[listKey] || [];
        if (currentList.includes(val.trim())) {
            window.alert('Trùng lặp\\nGiá trị này đã tồn tại trong danh sách.');
            return;
        }
        setSettings(prev => ({ ...prev, [listKey]: [...currentList, val.trim()] }));
        setVal('');
    };
    return (
        <div style={styles.card}>
            <span style={styles.cardTitle}>{title}</span>
            <div style={styles.chipRow}>
                {settings[listKey]?.map(item => (
                    <div key={item} style={styles.miniChip}>
                        <span style={styles.miniChipText}>{item}</span>
                        <button type="button" onClick={() => setSettings(prev => ({...prev, [listKey]: prev[listKey].filter(i => i !== item)}))}>
                            <Icon name="x" size={14} color="#ef4444" />
                        </button>
                    </div>
                ))}
                {(!settings[listKey] || settings[listKey].length === 0) && <span style={{fontStyle: 'italic', color: '#cbd5e1', fontSize: 12, fontFamily: 'Times New Roman'}}>Chưa có dữ liệu</span>}
            </div>
            <div style={styles.inputRow}>
                <input style={styles.input} placeholder="Thêm giá trị mới..." value={val} onChange={(e) => setVal(e.target.value)} />
                <button type="button" style={styles.btnAdd} onClick={handleAdd}><Icon name="plus" size={18} color="#fff"/></button>
            </div>
        </div>
    );
};

// ==========================================
// COMPONENT CHÍNH: SETTINGS SCREEN
// ==========================================
export default function SettingsScreen({ settings, setSettings, currentUser }) {
    const [activeSubTab, setActiveSubTab] = useState('ORG');
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [newShiftForm, setNewShiftForm] = useState({ code: '', label: '', startTime: '07:00', endTime: '19:00' });

    const isSuperAdmin = currentUser?.role === 'superadmin';

    const [networkConfig, setNetworkConfig] = useState({
        apiBaseUrl: settings.apiBaseUrl || 'http://localhost:3000',
    });

    const updateConfig = (key, subKey, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: subKey ? { ...prev[key], [subKey]: value } : value
        }));
    };

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            await DataService.saveData(settings, "atc_system", "settings", { config: settings });
            window.alert("Thành công\\nĐã lưu cấu hình!");
        } catch (error) {
            window.alert("Cảnh báo\\n" + (error.message || "Lưu cục bộ thành công nhưng chưa thể đồng bộ mạng."));
        } finally {
            setIsSaving(false);
        }
    };

    const handleApplyNetworkSync = async () => {
        if (!networkConfig.apiBaseUrl.trim()) {
            window.alert('Lỗi\\nVui lòng nhập URL của NestJS API Server.'); return;
        }
        setIsSyncing(true);
        try {
            const newSettings = { ...settings, apiBaseUrl: networkConfig.apiBaseUrl.trim() };
            setSettings(newSettings);
            await DataService.saveData(newSettings, 'atc_system', 'settings', { config: newSettings });
            window.alert('Hoàn tất!\\nĐã cập nhật địa chỉ API Server thành công.');
        } catch (e) { window.alert('Lỗi\\n' + e.message); } finally { setIsSyncing(false); }
    };

    const handleAddShift = () => {
        const { code, label, startTime, endTime } = newShiftForm;
        if (!code || !label) { window.alert('Thiếu thông tin\\nVui lòng nhập Mã và Tên ca.'); return; }
        const upperCode = code.toUpperCase().trim();
        if (settings.shiftTypes?.some(s => s.code === upperCode)) { window.alert('Trùng lặp\\nMã ca này đã tồn tại.'); return; }

        const nextIndex = settings.shiftTypes.length;

        setSettings(prev => ({
            ...prev,
            shiftTypes: [...(prev.shiftTypes || []), { code: upperCode, label, startTime, endTime, icon: 'Sun', color: 'blue' }],
            minStaffing: { ...prev.minStaffing, [upperCode]: 15 },
            autoFillRules: { ...prev.autoFillRules, [upperCode]: nextIndex }
        }));
        setNewShiftForm({ code: '', label: '', startTime: '07:00', endTime: '19:00' });
    };

    const handleRemoveShift = (code) => {
        if (!window.confirm(`Xác nhận\\nXóa ca ${code}?`)) return;
        setSettings(prev => {
            const newShifts = prev.shiftTypes.filter(s => s.code !== code);
            const newMinStaff = { ...prev.minStaffing }; delete newMinStaff[code];
            const newRules = { ...prev.autoFillRules }; delete newRules[code];
            return { ...prev, shiftTypes: newShifts, minStaffing: newMinStaff, autoFillRules: newRules };
        });
    };

    // 🌟 VÁ LỖI HIỂN THỊ KHOẢNG TRỐNG: ĐÓNG GÓI SCROLLVIEW VÀO VIEW CONTAINER
    const renderSubTabMenu = () => (
        <div style={styles.subTabContainer}>
            <div style={Object.assign({}, styles.subTabScrollContent, { display: 'flex', flexDirection: 'row', flexWrap: 'wrap' })}>
                {[
                    { id: 'ORG', label: 'Tổ chức', icon: 'users' },
                    { id: 'ROSTER', label: 'Lịch trực', icon: 'calendar' },
                    { id: 'SAFETY', label: 'An toàn', icon: 'shield' },
                    { id: 'SYSTEM', label: 'Hệ thống', icon: 'settings' },
                ].map(tab => (
                    <button type="button" key={tab.id} style={{...styles.subTabBtn, ...(activeSubTab === tab.id && styles.subTabBtnActive)}} onClick={() => setActiveSubTab(tab.id)}>
                        <Icon name={tab.icon} size={14} color={activeSubTab === tab.id ? '#2563eb' : '#64748b'} />
                        <span style={{...styles.subTabText, ...(activeSubTab === tab.id && styles.subTabTextActive)}}>{tab.label.toUpperCase()}</span>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderOrgTab = () => (
        <div style={styles.tabContent}>
            <OrgListEditor title="Danh sách Kíp trực" listKey="teams" settings={settings} setSettings={setSettings} />
            <OrgListEditor title="Chức danh nghiệp vụ" listKey="positions" settings={settings} setSettings={setSettings} />
            <OrgListEditor title="Năng định chuyên môn" listKey="qualifications" settings={settings} setSettings={setSettings} />
            <OrgListEditor title="Cột vị trí trực" listKey="rosterColumns" settings={settings} setSettings={setSettings} />

            <div style={styles.card}>
                <span style={styles.cardTitle}><Icon name="activity" size={16}/> Loại hình biến động (Activities)</span>
                {settings.activityTypes?.map((act, idx) => (
                    <div key={act.id} style={styles.settingRow}>
                        <div style={{flex: 1}}>
                            <input style={styles.itemTextBold} value={act.label} onChange={(e) => { const newTypes = [...settings.activityTypes]; newTypes[idx].label = e.target.value; updateConfig('activityTypes', null, newTypes); }} />
                        </div>
                        <div style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: true ? 0 : 8}}>
                             <span style={styles.subLabel}>Mã:</span>
                             <input style={styles.codeScaleInput} value={act.code} maxLength={2} onChange={(e) => { const newTypes = [...settings.activityTypes]; newTypes[idx].code = e.target.value.toUpperCase(); updateConfig('activityTypes', null, newTypes); }} />
                        </div>
                    </div>
                ))}
            </div>
            <div style={{height: 40}} />
        </div>
    );

    const renderSafetyTab = () => (
        <div style={styles.tabContent}>
            <div style={styles.card}>
                <span style={styles.cardTitle}><Icon name="alert-octagon" size={16}/> Chống mệt mỏi</span>
                <div style={styles.settingRow}>
                    <div style={{flex: 1, paddingRight: 10}}>
                        <span style={styles.itemTextBold}>Nghỉ tối thiểu giữa 2 ca (Giờ)</span>
                        <span style={styles.subLabel}>Cảnh báo nếu khoảng cách ca {"<"} X giờ</span>
                    </div>
                    <input style={styles.smallInput} value={String(settings.safety?.minRestHours || 12)} onChange={(e) => updateConfig('safety', 'minRestHours', parseInt(e.target.value) || 0)} />
                </div>
            </div>
        </div>
    );
    const renderRosterTab = () => (
        <div style={styles.tabContent}>

            <div style={styles.card}>
                <span style={styles.cardTitle}><Icon name="git-branch" size={16}/> Quy Tắc Bước Nhảy (Xếp Ca Tự Động)</span>
                <div style={{backgroundColor: '#e0f2fe', padding: 12, borderRadius: 8, marginBottom: 16}}>
                    <span style={{fontFamily: 'Times New Roman', fontSize: 13, color: '#0369a1', fontStyle: 'italic', lineHeight: '20px'}}>
                        Định nghĩa Kíp trực cho từng ca dựa trên khoảng cách (Offset) so với Kíp đầu chu kỳ.
                        {"\n"}Ví dụ: Mốc là Kíp A (Bước 0). Nhập <span style={{fontWeight: 'bold'}}>0</span> = Gọi Kíp A, Nhập <span style={{fontWeight: 'bold'}}>1</span> = Gọi Kíp B, Nhập <span style={{fontWeight: 'bold'}}>-1</span> = Gọi Kíp lùi lại.
                    </span>
                </div>
                {settings.shiftTypes?.map((shift, idx) => {
                    const defaultVal = idx === 1 ? -1 : idx;
                    const val = settings.autoFillRules?.[shift.code] !== undefined ? settings.autoFillRules[shift.code] : defaultVal;

                    return (
                        <div key={shift.code} style={styles.settingRow}>
                            <span style={styles.itemText}>Ca {shift.label} ({shift.code})</span>
                            <input
                                style={styles.smallInput}
                                value={String(val)}
                                onChange={(t) => {
                                    if(t === '' || t === '-') return;
                                    const parsed = parseInt(t);
                                    if(!isNaN(parsed)) updateConfig('autoFillRules', shift.code, parsed);
                                }}
                                onEndEditing={(e) => {
                                    const t = e.nativeEvent.text;
                                    const parsed = parseInt(t);
                                    updateConfig('autoFillRules', shift.code, isNaN(parsed) ? defaultVal : parsed);
                                }}
                            />
                        </div>
                    );
                })}
            </div>

            <div style={styles.card}>
                <div style={styles.cardHeaderRow}>
                    <span style={styles.cardTitle}><Icon name="clock" size={16}/> Quản lý Ca & Khung giờ</span>
                    <div style={styles.badgeCount}><span style={styles.badgeCountText}>{settings.shiftTypes?.length || 0} Ca</span></div>
                </div>
                {settings.shiftTypes?.map((shift, index) => (
                    <div key={shift.code} style={styles.shiftManagerRow}>
                        <div style={styles.shiftInfoMain}>
                            <span style={styles.shiftCodeTag}>{shift.code}</span>
                            <div style={{flex: 1}}>
                                <input style={styles.itemTextBold} value={shift.label} onChange={(e) => { const newShifts = [...settings.shiftTypes]; newShifts[index].label = e.target.value; updateConfig('shiftTypes', null, newShifts); }} />
                                <div style={styles.timeInputsRow}>
                                    <input style={styles.timeInputSmall} value={shift.startTime} onChange={(e) => { const newShifts = [...settings.shiftTypes]; newShifts[index].startTime = e.target.value; updateConfig('shiftTypes', null, newShifts); }} />
                                    <span style={{color: '#94a3b8', fontSize: 12}}>đến</span>
                                    <input style={styles.timeInputSmall} value={shift.endTime} onChange={(e) => { const newShifts = [...settings.shiftTypes]; newShifts[index].endTime = e.target.value; updateConfig('shiftTypes', null, newShifts); }} />
                                </div>
                            </div>
                        </div>
                        <button type="button" style={styles.btnDeleteShift} onClick={() => handleRemoveShift(shift.code)}><Icon name="trash-2" size={18} color="#ef4444" /></button>
                    </div>
                ))}

                <div style={styles.addShiftBox}>
                    <span style={styles.addShiftTitle}>Thêm Ca Trực Mới</span>
                    <div style={styles.inputWrapRow}>
                        <input style={Object.assign({}, styles.input, {flex: 1, minWidth: 100})} placeholder="Mã (VD: C)" value={newShiftForm.code} onChange={(e) => setNewShiftForm({...newShiftForm, code: e.target.value})} maxLength={2} />
                        <input style={Object.assign({}, styles.input, {flex: 2, minWidth: 150})} placeholder="Tên ca (VD: Ca Chiều)" value={newShiftForm.label} onChange={(e) => setNewShiftForm({...newShiftForm, label: e.target.value})} />
                    </div>
                    <div style={styles.inputWrapRow}>
                        <input style={Object.assign({}, styles.input, {flex: 1, minWidth: 100})} placeholder="Bắt đầu (HH:MM)" value={newShiftForm.startTime} onChange={(e) => setNewShiftForm({...newShiftForm, startTime: e.target.value})} />
                        <input style={Object.assign({}, styles.input, {flex: 1, minWidth: 100})} placeholder="Kết thúc (HH:MM)" value={newShiftForm.endTime} onChange={(e) => setNewShiftForm({...newShiftForm, endTime: e.target.value})} />
                        <button type="button" style={styles.btnConfirmAdd} onClick={handleAddShift}><Icon name="plus" size={20} color="#fff" /></button>
                    </div>
                </div>
            </div>

            <div style={styles.card}>
                <span style={styles.cardTitle}><Icon name="users" size={16}/> Định mức Quân số tối thiểu</span>
                {settings.shiftTypes?.map(s => (
                    <div key={s.code} style={styles.settingRow}>
                        <span style={styles.itemText}>Ca {s.label} ({s.code})</span>
                        <input style={styles.smallInput} value={String(settings.minStaffing?.[s.code] || 0)} onChange={(e) => updateConfig('minStaffing', s.code, parseInt(e.target.value) || 0)} />
                    </div>
                ))}
            </div>

            <div style={styles.card}>
                <span style={styles.cardTitle}><Icon name="phone-incoming" size={16}/> Định mức On-Call (Dự bị)</span>
                <div style={styles.settingRow}>
                    <span style={styles.itemText}>Số lượng Kíp trưởng (QL)</span>
                    <input style={styles.smallInput} value={String(settings.onCallRules?.managerQty || 1)} onChange={(e) => updateConfig('onCallRules', 'managerQty', parseInt(e.target.value) || 0)} />
                </div>
                <div style={styles.settingRow}>
                    <span style={styles.itemText}>Số lượng Kiểm soát viên (KSV)</span>
                    <input style={styles.smallInput} value={String(settings.onCallRules?.staffQty || 3)} onChange={(e) => updateConfig('onCallRules', 'staffQty', parseInt(e.target.value) || 0)} />
                </div>
            </div>
            <div style={{height: 40}} />
        </div>
    );

    const renderSystemTab = () => (
        <div style={styles.tabContent}>
            {isSuperAdmin && (
                <div style={styles.card}>
                    <span style={styles.cardTitle}><Icon name="shield" size={16}/> Cấu hình Mạng & Lưu trữ (Dành riêng superadmin)</span>

                    <div style={styles.configInputBox}>
                        <span style={styles.label}>URL NestJS API Server</span>
                        <input
                            style={{...styles.input, fontFamily: 'Courier New', color: '#059669', fontWeight: 'bold'}}
                            placeholder="VD: http://localhost:3000 hoặc http://14.232.x.x:3000"
                            value={networkConfig.apiBaseUrl}
                            onChange={(e) => setNetworkConfig({...networkConfig, apiBaseUrl: e.target.value})}
                        />
                    </div>

                    <button type="button" style={styles.btnSyncNetwork} onClick={handleApplyNetworkSync} disabled={isSyncing}>
                        {isSyncing ? <Spinner color="#fff" size="small" /> : <><Icon name="refresh-cw" size={16} color="#fff" /><span style={{color: '#fff', fontWeight: 'bold'}}>ĐỒNG BỘ MẠNG</span></>}
                    </button>
                </div>
            )}

            <div style={styles.card}>
                <span style={styles.cardTitle}><Icon name="type" size={16}/> Tùy biến Thuật ngữ</span>
                <div style={styles.settingRow}>
                    <span style={styles.itemText}>Nhãn đơn vị</span>
                    <input style={{...styles.input, flex: 1, maxWidth: 150}} value={settings.labels?.teamGroup || 'Kíp'} onChange={(t) => updateConfig('labels', 'teamGroup', t)} />
                </div>
                <div style={styles.settingRow}>
                    <span style={styles.itemText}>Nhãn định danh</span>
                    <input style={{...styles.input, flex: 1, maxWidth: 150}} value={settings.labels?.employeeId || 'Mã ICAO'} onChange={(t) => updateConfig('labels', 'employeeId', t)} />
                </div>
            </div>

            <div style={styles.card}>
                <span style={styles.cardTitle}><Icon name="database" size={16}/> Chế độ Vận hành</span>
                <div style={styles.settingRow}>
                    <div style={{flex: 1, paddingRight: 10}}><span style={styles.itemTextBold}>Chế độ nghiêm ngặt (Strict Mode)</span></div>
                    <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                        <input type="checkbox" checked={settings.strictMode || false} onChange={(e) => updateConfig('strictMode', null, e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                        <span style={{ position: 'absolute', inset: 0, backgroundColor: settings.strictMode ? '#4f46e5' : '#cbd5e1', borderRadius: 24, transition: 'background .2s' }}>
                            <span style={{ position: 'absolute', width: 18, height: 18, backgroundColor: '#fff', borderRadius: '50%', top: 3, left: settings.strictMode ? 23 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
                        </span>
                    </label>
                </div>
            </div>
            <div style={{height: 40}}/>
        </div>
    );

    // HÀM RENDER CHÍNH CỦA COMPONENT SETTINGS
    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div style={{flexDirection: 'row', alignItems: 'center', gap: 15, flex: 1}}>
                    <div style={styles.headerIconBox}><Icon name="settings" size={24} color="#fff" /></div>
                    <div style={{flex: 1}}>
                        <span style={styles.headerTitle}>Cấu Hình Hệ Thống</span>
                        <span style={styles.headerSub}>Thiết lập logic thuật toán và tham số</span>
                    </div>
                </div>
                <button type="button" style={{...styles.btnSave, ...(isSaving && styles.btnDisabled)}} onClick={handleSaveSettings} disabled={isSaving}>
                    {isSaving ? <Spinner color="#fff" size="small" /> : <><Icon name="save" size={16} color="#fff" /><span style={styles.btnSaveText}>Lưu Thay Đổi</span></>}
                </button>
            </div>

            {renderSubTabMenu()}

            <div style={styles.mainContentWrapper}>
                {activeSubTab === 'ORG' && renderOrgTab()}
                {activeSubTab === 'ROSTER' && renderRosterTab()}
                {activeSubTab === 'SAFETY' && renderSafetyTab()}
                {activeSubTab === 'SYSTEM' && renderSystemTab()}
            </div>
        </div>
    );
}

// TOÀN BỘ STYLESHEET ĐƯỢC CHUYỂN XUỐNG DƯỚI CÙNG, ĐẢM BẢO HOẠT ĐỘNG HOÀN HẢO
const styles = {
    container: { flex: 1, backgroundColor: '#f1f5f9' },

    header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
    headerIconBox: { backgroundColor: '#1e293b', padding: 12, borderRadius: 12 },
    headerTitle: { fontFamily: 'Times New Roman', fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    headerSub: { fontFamily: 'Times New Roman', fontSize: 13, color: '#64748b', marginTop: 4 },

    btnSave: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#10b981', paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, borderRadius: 10, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
    btnSaveText: { color: '#fff', fontFamily: 'Times New Roman', fontWeight: 'bold', fontSize: 14 },
    btnDisabled: { opacity: 0.7 },

    // 🌟 ĐÃ FIX: Bọc thanh menu vào một View cố định chiều cao, chấm dứt việc tự do giãn nở (Flex Stretch)
    subTabContainer: { backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0', paddingLeft: 16 , paddingRight: 16 ,},
    subTabScrollContent: { flexGrow: 1, alignItems: 'center' },
    subTabBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 16, paddingBottom: 16, marginRight: 24, borderBottomWidth: 2, borderColor: 'transparent' },
    subTabBtnActive: { borderColor: '#2563eb' },
    subTabText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#64748b' },
    subTabTextActive: { color: '#2563eb' },

    // 🌟 ĐÃ FIX: Đảm bảo nội dung luôn bám theo không gian còn lại
    mainContentWrapper: { flex: 1, backgroundColor: '#f1f5f9', overflowY: 'auto', display: 'block' },
    tabContent: { flex: 1, padding: 16 },

    card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
    cardHeaderRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 12 },
    cardTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 16, borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    settingRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderColor: '#f8fafc', gap: 10 },

    itemText: { fontFamily: 'Times New Roman', fontSize: 15, color: '#475569', flex: 1, minWidth: 150 },
    itemTextBold: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
    subLabel: { fontFamily: 'Times New Roman', fontSize: 12, color: '#94a3b8', marginTop: 4 },

    input: { fontFamily: 'Times New Roman', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingLeft: 14, paddingRight: 14, height: 42, fontSize: 14 },
    smallInput: { width: 70, height: 40, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, textAlign: 'center', fontFamily: 'Courier New', fontSize: 15, fontWeight: 'bold', color: '#2563eb' },
    codeScaleInput: { width: 60, height: 40, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, textAlign: 'center', fontFamily: 'Courier New', fontSize: 15, fontWeight: 'bold', color: '#b45309' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
    miniChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f1f5f9', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    miniChipText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#334155', fontWeight: 'bold' },

    // Tối ưu Flex Wrap cho Mobile
    inputRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    inputWrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
    btnAdd: { width: 42, height: 42, backgroundColor: '#2563eb', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

    connectionToggle: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: '#f1f5f9', borderRadius: 10, padding: 6 },
    toggleBtn: { paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8 },
    toggleBtnActive: { backgroundColor: '#2563eb' },
    toggleBtnActiveLocal: { backgroundColor: '#059669' },
    toggleText: { fontFamily: 'Courier New', fontSize: 13, fontWeight: 'bold', color: '#64748b' },

    configInputBox: { marginTop: 16, padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    label: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
    btnSyncNetwork: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: '#1e293b', paddingTop: 16, paddingBottom: 16, borderRadius: 10, marginTop: 24, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},

    badgeCount: { backgroundColor: '#eff6ff', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 16, borderWidth: 1, borderColor: '#bfdbfe' },
    badgeCountText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#2563eb' },
    shiftManagerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', padding: 14, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
    shiftInfoMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minWidth: 200 },
    shiftCodeTag: { width: 36, height: 36, backgroundColor: '#1e293b', color: '#fff', textAlign: 'center', lineHeight: '36px', borderRadius: 18, fontWeight: 'bold', fontFamily: 'Courier New', fontSize: 18, overflow: 'hidden' },
    timeInputsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' },
    timeInputSmall: { width: 80, height: 32, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center', fontFamily: 'Courier New', fontSize: 14, color: '#0369a1', fontWeight: 'bold' },
    btnDeleteShift: { padding: 10, backgroundColor: '#fee2e2', borderRadius: 10 },
    addShiftBox: { marginTop: 24, padding: 16, backgroundColor: '#f0f9ff', borderRadius: 12, borderWidth: 1, borderColor: '#bae6fd' },
    addShiftTitle: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#0369a1', marginBottom: 10 },
    btnConfirmAdd: { backgroundColor: '#16a34a', width: 42, height: 42, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }
};
