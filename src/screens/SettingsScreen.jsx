import Spinner from "../components/Spinner.jsx";
import Icon from '../components/Icon.jsx';
import React, { useState, useEffect } from 'react';

import { DataService } from '../services/DataService';
import api from '../services/ApiService';

// ==========================================
// COMPONENT PHỤ: PUSH STATUS WIDGET
// ==========================================
function PushStatusWidget() {
    const [status, setStatus] = useState('checking');
    useEffect(() => {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) { setStatus('unsupported'); return; }
        setStatus(Notification.permission);
    }, []);
    const colors = {
        granted:     { bg: '#f0fdf4', text: '#15803d', icon: 'check-circle', label: 'Đã bật — đang nhận push' },
        denied:      { bg: '#fef2f2', text: '#dc2626', icon: 'x-circle',     label: 'Bị chặn — vào trình duyệt để cho phép' },
        default:     { bg: '#fffbeb', text: '#92400e', icon: 'alert-circle',  label: 'Chưa cấp quyền' },
        unsupported: { bg: '#f8fafc', text: '#64748b', icon: 'wifi-off',      label: 'Trình duyệt không hỗ trợ' },
        checking:    { bg: '#f8fafc', text: '#64748b', icon: 'loader',        label: 'Đang kiểm tra...' },
    };
    const s = colors[status] || colors.checking;
    return (
        <div style={{ padding: '8px 12px', borderRadius: 8, backgroundColor: s.bg, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Icon name={s.icon} size={16} color={s.text} />
            <span style={{ fontSize: 13, color: s.text, fontWeight: 600 }}>{s.label}</span>
        </div>
    );
}

// ==========================================
// COMPONENT PHỤ: SYSTEM HEALTH PANEL
// ==========================================
function SystemHealthPanel() {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchHealth = () => {
        setLoading(true);
        Promise.all([
            api.get('/api/health').catch(() => null),
            api.get('/analytics/health').catch(() => null),
        ]).then(([backend, analytics]) => {
            setHealth({
                backend:   backend?.data?.status === 'ok',
                analytics: analytics?.data?.status === 'ok',
                db:        backend?.data?.db === 'ok',
            });
        }).finally(() => setLoading(false));
    };

    useEffect(() => { fetchHealth(); }, []);

    const cards = [
        { key: 'backend',   label: 'NestJS Backend',   icon: 'server',   port: ':3000' },
        { key: 'db',        label: 'PostgreSQL',        icon: 'database', port: 'DB'    },
        { key: 'analytics', label: 'FastAPI Analytics', icon: 'activity', port: ':8001' },
    ];

    return (
        <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#334155' }}>
                    <Icon name="activity" size={16}/> Trạng thái hệ thống
                </span>
                <button type="button" onClick={fetchHealth} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', cursor: 'pointer', fontSize: 12 }}>
                    <Icon name="refresh-cw" size={13} color="#64748b" /> Làm mới
                </button>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {cards.map(c => {
                    const ok = !loading && health?.[c.key];
                    const unknown = loading || health === null;
                    return (
                        <div key={c.key} style={{ flex: '1 1 140px', padding: '14px 16px', borderRadius: 10,
                                                   border: '1px solid ' + (unknown ? '#e2e8f0' : ok ? '#bbf7d0' : '#fecaca'),
                                                   backgroundColor: unknown ? '#f8fafc' : ok ? '#f0fdf4' : '#fef2f2' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <Icon name={c.icon} size={16} color={unknown ? '#94a3b8' : ok ? '#16a34a' : '#dc2626'} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{c.label}</span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: unknown ? '#94a3b8' : ok ? '#16a34a' : '#dc2626' }}>
                                {unknown ? '...' : ok ? '✓ Online' : '✗ Offline'}
                            </span>
                            <span style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>{c.port}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ==========================================
// COMPONENT PHỤ: QUICK STATS PANEL
// ==========================================
function QuickStatsPanel({ employees, requests, activities }) {
    const activeEmps    = employees.filter(e => e.isApproved !== false).length;
    const pendingReqs   = requests.filter(r => r.status === 'pending').length;
    const today         = new Date().toISOString().slice(0, 10);
    const ongoingActs   = activities.filter(a => a.startDate <= today && a.endDate >= today).length;

    const stats = [
        { label: 'Nhân sự active',     value: activeEmps,   icon: 'users',        color: '#2563eb' },
        { label: 'Yêu cầu chờ duyệt',  value: pendingReqs,  icon: 'clock',        color: '#f59e0b', urgent: pendingReqs > 0 },
        { label: 'Biến động hôm nay',   value: ongoingActs,  icon: 'alert-circle', color: '#8b5cf6' },
    ];

    return (
        <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <span style={{ fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 12, display: 'block' }}>
                <Icon name="bar-chart-2" size={16}/> Số liệu nhanh
            </span>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {stats.map(s => (
                    <div key={s.label} style={{ flex: '1 1 120px', padding: '12px 14px', borderRadius: 10, backgroundColor: s.color + '10', border: '1px solid ' + s.color + '30', position: 'relative' }}>
                        {s.urgent && <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }} />}
                        <Icon name={s.icon} size={18} color={s.color} />
                        <div style={{ fontSize: 28, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ==========================================
// COMPONENT PHỤ: INLINE AUDIT LOG
// ==========================================
function InlineAuditLog() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/api/audit?limit=50')
            .then(r => setLogs(r.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const ACTION_COLORS = { LOGIN_SUCCESS: '#10b981', LOGIN_FAIL: '#ef4444', CHANGE_PASSWORD: '#2563eb', RESET_PASSWORD: '#f59e0b', CREATE_EMPLOYEE: '#8b5cf6', DELETE_EMPLOYEE: '#dc2626', APPROVE_EMPLOYEE: '#059669' };

    return (
        <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#334155' }}>
                    <Icon name="file-text" size={16}/> Hoạt động gần đây
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>50 dòng gần nhất</span>
            </div>
            {loading ? <Spinner size={24} color="#2563eb" /> : (
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {logs.length === 0 && <span style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>Chưa có nhật ký nào.</span>}
                    {logs.slice(0, 50).map(log => (
                        <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, backgroundColor: (ACTION_COLORS[log.action] || '#94a3b8') + '18', color: ACTION_COLORS[log.action] || '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {(log.action || '').replace(/_/g, ' ')}
                            </span>
                            <span style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {log.actorName || log.actorId || '—'}
                            </span>
                            <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {new Date(log.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

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
// TOGGLE COMPONENT DÙNG CHUNG
// ==========================================
function Toggle({ value, onChange, disabled = false }) {
  return (
    <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24,
                    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, flexShrink: 0 }}>
      <input type="checkbox" checked={!!value} disabled={disabled}
             onChange={e => onChange(e.target.checked)}
             style={{ opacity: 0, width: 0, height: 0 }} />
      <span style={{ position: 'absolute', inset: 0, backgroundColor: value ? '#2563eb' : '#cbd5e1',
                     borderRadius: 24, transition: 'background .2s' }}>
        <span style={{ position: 'absolute', width: 18, height: 18, backgroundColor: '#fff',
                       borderRadius: '50%', top: 3, left: value ? 23 : 3,
                       transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
      </span>
    </label>
  );
}

// ==========================================
// COMPONENT CHÍNH: SETTINGS SCREEN
// ==========================================
export default function SettingsScreen({ settings, setSettings, currentUser, employees = [], requests = [], activities = [] }) {
    const [activeSubTab, setActiveSubTab] = useState('ORG');
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [newShiftForm, setNewShiftForm] = useState({ code: '', label: '', startTime: '07:00', endTime: '19:00' });

    const isSuperAdmin = currentUser?.role === 'superadmin';
    const isAdmin = currentUser?.role === 'ADMIN' || isSuperAdmin;
    const isChief = currentUser?.role === 'CHIEF';

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
    const renderSubTabMenu = () => {
        const tabs = [
            { id: 'ORG',      label: 'Tổ chức',   icon: 'users',        show: true },
            { id: 'ROSTER',   label: 'Lịch trực', icon: 'calendar',     show: true },
            { id: 'SAFETY',   label: 'An toàn',   icon: 'shield',       show: true },
            { id: 'NOTIFY',   label: 'Thông báo', icon: 'bell',         show: true },
            { id: 'MONITOR',  label: 'Giám sát',  icon: 'activity',     show: isAdmin },
            { id: 'FEATURES', label: 'Tính năng', icon: 'toggle-right', show: isSuperAdmin },
            { id: 'SYSTEM',   label: 'Hệ thống',  icon: 'settings',     show: isAdmin },
        ].filter(t => t.show);
        return (
            <div style={styles.subTabContainer}>
                <div style={Object.assign({}, styles.subTabScrollContent, { display: 'flex', flexDirection: 'row', flexWrap: 'wrap' })}>
                    {tabs.map(tab => (
                        <button type="button" key={tab.id} style={{...styles.subTabBtn, ...(activeSubTab === tab.id && styles.subTabBtnActive)}} onClick={() => setActiveSubTab(tab.id)}>
                            <Icon name={tab.icon} size={14} color={activeSubTab === tab.id ? '#2563eb' : '#64748b'} />
                            <span style={{...styles.subTabText, ...(activeSubTab === tab.id && styles.subTabTextActive)}}>{tab.label.toUpperCase()}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const renderOrgTab = () => (
        <div style={styles.tabContent}>
            {isAdmin && (
                <div style={styles.card}>
                    <span style={styles.cardTitle}><Icon name="briefcase" size={16}/> Thông tin Đơn vị</span>
                    {[
                        { key: 'unitName',     label: 'Tên đơn vị',   placeholder: 'Trung tâm KSTC-TS Đà Nẵng' },
                        { key: 'unitCode',     label: 'Mã đơn vị',    placeholder: 'DAN-APP' },
                        { key: 'icaoLocation', label: 'ICAO Location', placeholder: 'VVDN' },
                        { key: 'contactEmail', label: 'Email liên hệ', placeholder: 'atc@vatm.vn' },
                    ].map(({ key, label, placeholder }) => (
                        <div key={key} style={styles.settingRow}>
                            <span style={styles.itemText}>{label}</span>
                            <input style={{ ...styles.input, flex: 1, maxWidth: 260 }} placeholder={placeholder}
                                   value={settings.unit?.[key] || ''}
                                   onChange={e => updateConfig('unit', key, e.target.value)} />
                        </div>
                    ))}
                </div>
            )}
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

            {isAdmin && (
                <div style={styles.card}>
                    <span style={styles.cardTitle}><Icon name="alert-triangle" size={16}/> Ngưỡng Mệt mỏi (KSS)</span>
                    <div style={styles.settingRow}>
                        <div style={{ flex: 1 }}>
                            <span style={styles.itemTextBold}>Ngưỡng cảnh báo (WARNING)</span>
                            <span style={styles.subLabel}>KSS ≥ X → màu vàng trong báo cáo</span>
                        </div>
                        <input style={styles.smallInput} value={String(settings.fatigue?.warnKss || 5)}
                               onChange={e => updateConfig('fatigue', 'warnKss', parseInt(e.target.value) || 5)} />
                    </div>
                    <div style={styles.settingRow}>
                        <div style={{ flex: 1 }}>
                            <span style={styles.itemTextBold}>Ngưỡng nghiêm trọng (CRITICAL)</span>
                            <span style={styles.subLabel}>KSS ≥ X → màu đỏ, bắt buộc CHIEF xử lý</span>
                        </div>
                        <input style={styles.smallInput} value={String(settings.fatigue?.criticalKss || 7)}
                               onChange={e => updateConfig('fatigue', 'criticalKss', parseInt(e.target.value) || 7)} />
                    </div>
                </div>
            )}

            {isAdmin && (
                <div style={styles.card}>
                    <span style={styles.cardTitle}><Icon name="book-open" size={16}/> Tham chiếu Quy định</span>
                    {[
                        { key: 'qd2288', label: 'Số hiệu QĐ phân ca',   placeholder: 'QĐ 2288/QĐ-VATM' },
                        { key: 'qd2701', label: 'Số hiệu QĐ quy trình', placeholder: 'QĐ 2701/QĐ-VATM' },
                        { key: 'qd2289', label: 'Số hiệu QĐ mệt mỏi',   placeholder: 'QĐ 2289/QĐ-VATM' },
                    ].map(({ key, label, placeholder }) => (
                        <div key={key} style={styles.settingRow}>
                            <span style={styles.itemText}>{label}</span>
                            <input style={{ ...styles.input, flex: 1, maxWidth: 200, fontFamily: 'Courier New', fontSize: 12 }}
                                   placeholder={placeholder} value={settings.regulations?.[key] || ''}
                                   onChange={e => updateConfig('regulations', key, e.target.value)} />
                        </div>
                    ))}
                    <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, display: 'block', fontStyle: 'italic' }}>
                        Dùng để điền tự động vào header các biểu mẫu xuất ra.
                    </span>
                </div>
            )}
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
            {isAdmin && (
                <div style={styles.card}>
                    <span style={styles.cardTitle}><Icon name="layout" size={16}/> Tuỳ chỉnh hiển thị lưới</span>
                    <div style={styles.settingRow}>
                        <div style={{ flex: 1 }}>
                            <span style={styles.itemTextBold}>Cỡ chữ trong ô lưới</span>
                            <span style={styles.subLabel}>Ảnh hưởng toàn bộ bảng phân ca</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button type="button" style={styles.btnMini} onClick={() => updateConfig('fontSize', null, Math.max(10, (settings.fontSize||13)-1))}>−</button>
                            <span style={{ fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{settings.fontSize || 13}</span>
                            <button type="button" style={styles.btnMini} onClick={() => updateConfig('fontSize', null, Math.min(18, (settings.fontSize||13)+1))}>+</button>
                        </div>
                    </div>
                    <div style={styles.settingRow}>
                        <div style={{ flex: 1 }}>
                            <span style={styles.itemTextBold}>Chiều cao hàng</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button type="button" style={styles.btnMini} onClick={() => updateConfig('rowHeight', null, Math.max(32, (settings.rowHeight||40)-4))}>−</button>
                            <span style={{ fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{settings.rowHeight || 40}</span>
                            <button type="button" style={styles.btnMini} onClick={() => updateConfig('rowHeight', null, Math.min(72, (settings.rowHeight||40)+4))}>+</button>
                        </div>
                    </div>
                </div>
            )}

            {isAdmin && (
                <div style={styles.card}>
                    <span style={styles.cardTitle}><Icon name="repeat" size={16}/> Chu kỳ lịch trực</span>
                    <div style={styles.settingRow}>
                        <span style={styles.itemText}>Ngày bắt đầu tuần</span>
                        <select value={settings.weekStartDay || 1} onChange={e => updateConfig('weekStartDay', null, parseInt(e.target.value))} style={{ ...styles.input, maxWidth: 140 }}>
                            <option value={1}>Thứ Hai</option>
                            <option value={0}>Chủ Nhật</option>
                        </select>
                    </div>
                    <div style={styles.settingRow}>
                        <span style={styles.itemText}>Số ngày hiển thị mặc định</span>
                        <select value={settings.defaultViewMode || '14_DAYS'} onChange={e => updateConfig('defaultViewMode', null, e.target.value)} style={{ ...styles.input, maxWidth: 140 }}>
                            <option value="7_DAYS">7 ngày</option>
                            <option value="14_DAYS">14 ngày</option>
                            <option value="30_DAYS">30 ngày</option>
                        </select>
                    </div>
                </div>
            )}

            <div style={{height: 40}} />
        </div>
    );

    const renderNotifyTab = () => (
        <div style={styles.tabContent}>
            <div style={styles.card}>
                <span style={styles.cardTitle}><Icon name="bell" size={16}/> Thông báo của tôi</span>
                {[
                    { key: 'notifyNewTask',       label: 'Nhiệm vụ mới được giao' },
                    { key: 'notifySchedule',      label: 'Lịch trực mới được phát hành' },
                    { key: 'notifyRequest',       label: 'Yêu cầu đổi ca / nghỉ phép' },
                    { key: 'notifyRosterPublish', label: 'Lịch chi tiết kíp được ban hành' },
                    { key: 'notifyTaskComment',   label: 'Bình luận mới trong nhiệm vụ' },
                ].map(({ key, label }) => (
                    <div key={key} style={styles.settingRow}>
                        <span style={styles.itemText}>{label}</span>
                        <Toggle value={settings.notifications?.[key] !== false}
                                onChange={v => updateConfig('notifications', key, v)} />
                    </div>
                ))}
            </div>

            <div style={styles.card}>
                <span style={styles.cardTitle}><Icon name="smartphone" size={16}/> Web Push Notifications</span>
                <PushStatusWidget />
                <div style={{ padding: 10, backgroundColor: '#f0f9ff', borderRadius: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: '#0369a1' }}>
                        iOS: Cần "Add to Home Screen" và iOS 16.4+ để nhận Push.
                        Android Chrome/Firefox hoạt động ngay kể cả khi tắt màn hình.
                    </span>
                </div>
            </div>

            {isAdmin && (
                <div style={styles.card}>
                    <span style={styles.cardTitle}><Icon name="radio" size={16}/> Broadcast Thông báo (Admin)</span>
                    <div style={styles.settingRow}>
                        <div style={{ flex: 1 }}>
                            <span style={styles.itemTextBold}>Push khi phát hành lịch trực</span>
                            <span style={styles.subLabel}>Gửi push đến tất cả nhân sự khi ADMIN publish lịch</span>
                        </div>
                        <Toggle value={settings.pushRules?.onSchedulePublish !== false}
                                onChange={v => updateConfig('pushRules', 'onSchedulePublish', v)} />
                    </div>
                    <div style={styles.settingRow}>
                        <div style={{ flex: 1 }}>
                            <span style={styles.itemTextBold}>Push khi có nhiệm vụ khẩn</span>
                            <span style={styles.subLabel}>Priority = URGENT → push ngay cả khi app đóng</span>
                        </div>
                        <Toggle value={settings.pushRules?.onUrgentTask !== false}
                                onChange={v => updateConfig('pushRules', 'onUrgentTask', v)} />
                    </div>
                </div>
            )}
        </div>
    );

    const renderMonitorTab = () => (
        <div style={styles.tabContent}>
            <SystemHealthPanel />
            <QuickStatsPanel employees={employees} requests={requests} activities={activities} />
            <InlineAuditLog />
        </div>
    );

    const renderFeaturesTab = () => {
        if (!isSuperAdmin) return null;
        const flags = [
            { key: 'analyticsEnabled',  label: 'Analytics FastAPI',          icon: 'activity',     desc: 'Bật tab Phân tích. Yêu cầu service :8001 đang chạy.', default: true },
            { key: 'pwaEnabled',        label: 'PWA (Add to Home Screen)',   icon: 'smartphone',   desc: 'Cho phép cài app lên màn hình điện thoại.', default: true },
            { key: 'webPushEnabled',    label: 'Web Push Notifications',     icon: 'bell',         desc: 'Gửi push kể cả khi app đóng. Cần VAPID keys.', default: true },
            { key: 'safetyUnitEnabled', label: 'Cơ quan An toàn',            icon: 'shield',       desc: 'Mở luồng mệt mỏi đến Safety Officer. Cần role=SAFETY.', default: false, badge: 'STUB' },
            { key: 'auditLogEnabled',   label: 'Ghi nhật ký hệ thống',       icon: 'file-text',    desc: 'Lưu mọi thao tác quan trọng. Nên luôn bật trong production.', default: true },
            { key: 'strictModeEnabled', label: 'Chế độ nghiêm ngặt',         icon: 'lock',         desc: 'Cấm chỉnh sửa lịch đã publish trừ superadmin.', default: false },
        ];
        return (
            <div style={styles.tabContent}>
                <div style={styles.card}>
                    <span style={styles.cardTitle}><Icon name="toggle-right" size={16}/> Tính năng hệ thống</span>
                    <div style={{ marginBottom: 12, padding: 10, backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                        Thay đổi tính năng có hiệu lực ngay sau khi lưu. Một số tính năng yêu cầu khởi động lại service.
                    </div>
                    {flags.map(f => (
                        <div key={f.key} style={{ ...styles.settingRow, paddingTop: 12, paddingBottom: 12, borderBottom: '1px solid #f1f5f9', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, paddingRight: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Icon name={f.icon} size={14} color="#475569" />
                                    <span style={styles.itemTextBold}>{f.label}</span>
                                    {f.badge && (
                                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>{f.badge}</span>
                                    )}
                                </div>
                                <span style={{ ...styles.subLabel, marginTop: 3 }}>{f.desc}</span>
                            </div>
                            <Toggle value={settings.features?.[f.key] !== undefined ? settings.features[f.key] : f.default}
                                    onChange={v => updateConfig('features', f.key, v)} />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

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
            <div style={styles.card}>
                <span style={styles.cardTitle}><Icon name="info" size={16}/> Về hệ thống</span>
                {[
                    { label: 'Phiên bản',  value: import.meta.env?.VITE_APP_VERSION || '1.0.0' },
                    { label: 'Build',      value: import.meta.env?.VITE_BUILD_DATE || '—' },
                    { label: 'Backend',    value: 'NestJS + TypeORM + PostgreSQL' },
                    { label: 'Analytics', value: 'FastAPI + SQLAlchemy + psycopg3' },
                ].map(({ label, value }) => (
                    <div key={label} style={styles.settingRow}>
                        <span style={styles.itemText}>{label}</span>
                        <span style={{ fontFamily: 'Courier New', fontSize: 12, color: '#475569' }}>{value}</span>
                    </div>
                ))}
            </div>

            {isSuperAdmin && (
                <div style={styles.card}>
                    <span style={styles.cardTitle}><Icon name="download" size={16}/> Sao lưu & Khôi phục cấu hình</span>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                        <button type="button" style={styles.btnSecondary} onClick={() => {
                            const blob = new Blob([JSON.stringify({ version: '1.0', exportedAt: new Date().toISOString(), settings: { teams: settings.teams, positions: settings.positions, qualifications: settings.qualifications, shiftTypes: settings.shiftTypes, minStaffing: settings.minStaffing, autoFillRules: settings.autoFillRules, onCallRules: settings.onCallRules, safety: settings.safety, fatigue: settings.fatigue, features: settings.features, regulations: settings.regulations, unit: settings.unit } }, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url; a.download = `atcpro-config-${new Date().toISOString().slice(0,10)}.json`; a.click();
                            URL.revokeObjectURL(url);
                        }}>
                            <Icon name="download" size={14} color="#2563eb" />
                            <span style={{ color: '#2563eb', fontWeight: 'bold', fontSize: 13 }}>Export JSON</span>
                        </button>
                        <label style={{ ...styles.btnSecondary, cursor: 'pointer' }}>
                            <Icon name="upload" size={14} color="#2563eb" />
                            <span style={{ color: '#2563eb', fontWeight: 'bold', fontSize: 13 }}>Import JSON</span>
                            <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => {
                                const file = e.target.files[0]; if (!file) return;
                                const reader = new FileReader();
                                reader.onload = evt => {
                                    try {
                                        const data = JSON.parse(evt.target.result);
                                        if (!data.settings) { window.alert('File không hợp lệ.'); return; }
                                        if (!window.confirm('Ghi đè toàn bộ cấu hình hiện tại bằng file này?')) return;
                                        setSettings(prev => ({ ...prev, ...data.settings }));
                                        window.alert('Đã import. Nhấn "Lưu Thay Đổi" để áp dụng.');
                                    } catch { window.alert('File JSON không đúng định dạng.'); }
                                };
                                reader.readAsText(file);
                                e.target.value = '';
                            }} />
                        </label>
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, display: 'block' }}>
                        Export bao gồm: ca trực, quy tắc, kíp, định mức — KHÔNG bao gồm dữ liệu nhân sự hay lịch.
                    </span>
                </div>
            )}

            {isSuperAdmin && (
                <div style={{ ...styles.card, borderColor: '#fecaca', backgroundColor: '#fef2f2' }}>
                    <span style={{ ...styles.cardTitle, color: '#dc2626' }}>
                        <Icon name="alert-triangle" size={16} color="#dc2626"/> Vùng nguy hiểm
                    </span>
                    <button type="button"
                            style={{ ...styles.btnSecondary, borderColor: '#dc2626', color: '#dc2626' }}
                            onClick={() => {
                                if (window.confirm('Reset toàn bộ cài đặt về mặc định? Không thể hoàn tác.')) {
                                    setSettings({ teams: ['Kíp A', 'Kíp B', 'Kíp C', 'Kíp D'], shiftTypes: [{ code: 'S', label: 'Sáng', startTime: '07:00', endTime: '19:00' }, { code: 'D', label: 'Đêm', startTime: '19:00', endTime: '07:00' }], qualifications: ['Full', 'TWR', 'APP'], positions: ['QL', 'KSV', 'ON-CALL'] });
                                }
                            }}>
                        <Icon name="refresh-cw" size={14} color="#dc2626" />
                        <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: 13 }}>Reset về mặc định</span>
                    </button>
                </div>
            )}

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
                {activeSubTab === 'ORG'      && renderOrgTab()}
                {activeSubTab === 'ROSTER'   && renderRosterTab()}
                {activeSubTab === 'SAFETY'   && renderSafetyTab()}
                {activeSubTab === 'NOTIFY'   && renderNotifyTab()}
                {activeSubTab === 'MONITOR'  && isAdmin && renderMonitorTab()}
                {activeSubTab === 'FEATURES' && isSuperAdmin && renderFeaturesTab()}
                {activeSubTab === 'SYSTEM'   && isAdmin && renderSystemTab()}
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
    btnConfirmAdd: { backgroundColor: '#16a34a', width: 42, height: 42, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    btnMini: { width: 30, height: 30, backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, fontWeight: 'bold', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    btnSecondary: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 16, borderRadius: 8, border: '1px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer' },
};
