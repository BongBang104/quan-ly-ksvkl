import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Switch, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
            Alert.alert('Trùng lặp', 'Giá trị này đã tồn tại trong danh sách.'); 
            return; 
        }
        setSettings(prev => ({ ...prev, [listKey]: [...currentList, val.trim()] }));
        setVal('');
    };
    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            <View style={styles.chipRow}>
                {settings[listKey]?.map(item => (
                    <View key={item} style={styles.miniChip}>
                        <Text style={styles.miniChipText}>{item}</Text>
                        <TouchableOpacity onPress={() => setSettings(prev => ({...prev, [listKey]: prev[listKey].filter(i => i !== item)}))}>
                            <Feather name="x" size={14} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                ))}
                {(!settings[listKey] || settings[listKey].length === 0) && <Text style={{fontStyle: 'italic', color: '#cbd5e1', fontSize: 12, fontFamily: 'Times New Roman'}}>Chưa có dữ liệu</Text>}
            </View>
            <View style={styles.inputRow}>
                <TextInput style={styles.input} placeholder="Thêm giá trị mới..." value={val} onChangeText={setVal} onSubmitEditing={handleAdd} />
                <TouchableOpacity style={styles.btnAdd} onPress={handleAdd}><Feather name="plus" size={18} color="#fff"/></TouchableOpacity>
            </View>
        </View>
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
    
    const isSuperAdmin = currentUser?.id === 'tctsvip';

    const [networkConfig, setNetworkConfig] = useState({
        mode: settings.connectionMode || 'CLOUD',
        firebaseConfig: settings.firebaseConfig || '',
        localServerUrl: settings.localServerUrl || ''
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
            Alert.alert("Thành công", "Đã lưu cấu hình!");
        } catch (error) {
            Alert.alert("Cảnh báo", error.message || "Lưu cục bộ thành công nhưng chưa thể đồng bộ mạng.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleApplyNetworkSync = async () => {
        if (networkConfig.mode === 'CLOUD' && !networkConfig.firebaseConfig.trim()) {
            Alert.alert('Lỗi', 'Vui lòng dán cấu hình API Firestore (JSON).'); return;
        }
        if (networkConfig.mode === 'LOCAL' && !networkConfig.localServerUrl.trim()) {
            Alert.alert('Lỗi', 'Vui lòng nhập URL/IP của Máy chủ Riêng.'); return;
        }

        Alert.alert(
            "Xác nhận Đồng bộ",
            `Hệ thống sẽ chuyển sang kết nối ${networkConfig.mode === 'LOCAL' ? 'MÁY CHỦ RIÊNG' : 'CLOUD'} và tự động đồng bộ dữ liệu.`,
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Đồng bộ ngay",
                    onPress: async () => {
                        setIsSyncing(true);
                        try {
                            const newSettings = { ...settings, connectionMode: networkConfig.mode, firebaseConfig: networkConfig.firebaseConfig, localServerUrl: networkConfig.localServerUrl };
                            setSettings(newSettings);
                            await DataService.syncAllDataToNewServer(newSettings);
                            Alert.alert("Hoàn tất!", `Đã chuyển đổi kết nối thành công.`);
                        } catch (e) { Alert.alert("Lỗi", e.message); } finally { setIsSyncing(false); }
                    }
                }
            ]
        );
    };

    const handleAddShift = () => {
        const { code, label, startTime, endTime } = newShiftForm;
        if (!code || !label) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập Mã và Tên ca.'); return; }
        const upperCode = code.toUpperCase().trim();
        if (settings.shiftTypes?.some(s => s.code === upperCode)) { Alert.alert('Trùng lặp', 'Mã ca này đã tồn tại.'); return; }
        
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
        Alert.alert('Xác nhận', `Xóa ca ${code}?`, [
            { text: 'Hủy' },
            { text: 'Xóa', style: 'destructive', onPress: () => {
                    setSettings(prev => {
                        const newShifts = prev.shiftTypes.filter(s => s.code !== code);
                        const newMinStaff = { ...prev.minStaffing }; delete newMinStaff[code];
                        const newRules = { ...prev.autoFillRules }; delete newRules[code];
                        return { ...prev, shiftTypes: newShifts, minStaffing: newMinStaff, autoFillRules: newRules };
                    });
                }
            }
        ]);
    };

    // 🌟 VÁ LỖI HIỂN THỊ KHOẢNG TRỐNG: ĐÓNG GÓI SCROLLVIEW VÀO VIEW CONTAINER
    const renderSubTabMenu = () => (
        <View style={styles.subTabContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabScrollContent}>
                {[
                    { id: 'ORG', label: 'Tổ chức', icon: 'users' },
                    { id: 'ROSTER', label: 'Lịch trực', icon: 'calendar' },
                    { id: 'SAFETY', label: 'An toàn', icon: 'shield' },
                    { id: 'SYSTEM', label: 'Hệ thống', icon: 'settings' },
                ].map(tab => (
                    <TouchableOpacity key={tab.id} style={[styles.subTabBtn, activeSubTab === tab.id && styles.subTabBtnActive]} onPress={() => setActiveSubTab(tab.id)}>
                        <Feather name={tab.icon} size={14} color={activeSubTab === tab.id ? '#2563eb' : '#64748b'} />
                        <Text style={[styles.subTabText, activeSubTab === tab.id && styles.subTabTextActive]}>{tab.label.toUpperCase()}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    const renderOrgTab = () => (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <OrgListEditor title="Danh sách Kíp trực" listKey="teams" settings={settings} setSettings={setSettings} />
            <OrgListEditor title="Chức danh nghiệp vụ" listKey="positions" settings={settings} setSettings={setSettings} />
            <OrgListEditor title="Năng định chuyên môn" listKey="qualifications" settings={settings} setSettings={setSettings} />
            <OrgListEditor title="Cột vị trí Radar" listKey="rosterColumns" settings={settings} setSettings={setSettings} />
            
            <View style={styles.card}>
                <Text style={styles.cardTitle}><Feather name="activity" size={16}/> Loại hình biến động (Activities)</Text>
                {settings.activityTypes?.map((act, idx) => (
                    <View key={act.id} style={styles.settingRow}>
                        <View style={{flex: 1}}>
                            <TextInput style={styles.itemTextBold} value={act.label} onChangeText={(t) => { const newTypes = [...settings.activityTypes]; newTypes[idx].label = t; updateConfig('activityTypes', null, newTypes); }} />
                        </View>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Platform.OS === 'web' ? 0 : 8}}>
                             <Text style={styles.subLabel}>Mã:</Text>
                             <TextInput style={styles.codeScaleInput} value={act.code} maxLength={2} onChangeText={(t) => { const newTypes = [...settings.activityTypes]; newTypes[idx].code = t.toUpperCase(); updateConfig('activityTypes', null, newTypes); }} />
                        </View>
                    </View>
                ))}
            </View>
            <View style={{height: 40}} />
        </ScrollView>
    );

    const renderSafetyTab = () => (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
                <Text style={styles.cardTitle}><Feather name="alert-octagon" size={16}/> Chống mệt mỏi</Text>
                <View style={styles.settingRow}>
                    <View style={{flex: 1, paddingRight: 10}}>
                        <Text style={styles.itemTextBold}>Nghỉ tối thiểu giữa 2 ca (Giờ)</Text>
                        <Text style={styles.subLabel}>Cảnh báo nếu khoảng cách ca {"<"} X giờ</Text>
                    </View>
                    <TextInput style={styles.smallInput} keyboardType="numeric" value={String(settings.safety?.minRestHours || 12)} onChangeText={(t) => updateConfig('safety', 'minRestHours', parseInt(t) || 0)} />
                </View>
            </View>
        </ScrollView>
    );
    const renderRosterTab = () => (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            
            <View style={styles.card}>
                <Text style={styles.cardTitle}><Feather name="git-branch" size={16}/> Quy Tắc Bước Nhảy (Xếp Ca Tự Động)</Text>
                <View style={{backgroundColor: '#e0f2fe', padding: 12, borderRadius: 8, marginBottom: 16}}>
                    <Text style={{fontFamily: 'Times New Roman', fontSize: 13, color: '#0369a1', fontStyle: 'italic', lineHeight: 20}}>
                        Định nghĩa Kíp trực cho từng ca dựa trên khoảng cách (Offset) so với Kíp đầu chu kỳ. 
                        {"\n"}Ví dụ: Mốc là Kíp A (Bước 0). Nhập <Text style={{fontWeight: 'bold'}}>0</Text> = Gọi Kíp A, Nhập <Text style={{fontWeight: 'bold'}}>1</Text> = Gọi Kíp B, Nhập <Text style={{fontWeight: 'bold'}}>-1</Text> = Gọi Kíp lùi lại.
                    </Text>
                </View>
                {settings.shiftTypes?.map((shift, idx) => {
                    const defaultVal = idx === 1 ? -1 : idx; 
                    const val = settings.autoFillRules?.[shift.code] !== undefined ? settings.autoFillRules[shift.code] : defaultVal;
                    
                    return (
                        <View key={shift.code} style={styles.settingRow}>
                            <Text style={styles.itemText}>Ca {shift.label} ({shift.code})</Text>
                            <TextInput
                                style={styles.smallInput}
                                value={String(val)}
                                onChangeText={(t) => {
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
                        </View>
                    );
                })}
            </View>

            <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}><Feather name="clock" size={16}/> Quản lý Ca & Khung giờ</Text>
                    <View style={styles.badgeCount}><Text style={styles.badgeCountText}>{settings.shiftTypes?.length || 0} Ca</Text></View>
                </View>
                {settings.shiftTypes?.map((shift, index) => (
                    <View key={shift.code} style={styles.shiftManagerRow}>
                        <View style={styles.shiftInfoMain}>
                            <Text style={styles.shiftCodeTag}>{shift.code}</Text>
                            <View style={{flex: 1}}>
                                <TextInput style={styles.itemTextBold} value={shift.label} onChangeText={(t) => { const newShifts = [...settings.shiftTypes]; newShifts[index].label = t; updateConfig('shiftTypes', null, newShifts); }} />
                                <View style={styles.timeInputsRow}>
                                    <TextInput style={styles.timeInputSmall} value={shift.startTime} onChangeText={(t) => { const newShifts = [...settings.shiftTypes]; newShifts[index].startTime = t; updateConfig('shiftTypes', null, newShifts); }} />
                                    <Text style={{color: '#94a3b8', fontSize: 12}}>đến</Text>
                                    <TextInput style={styles.timeInputSmall} value={shift.endTime} onChangeText={(t) => { const newShifts = [...settings.shiftTypes]; newShifts[index].endTime = t; updateConfig('shiftTypes', null, newShifts); }} />
                                </View>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.btnDeleteShift} onPress={() => handleRemoveShift(shift.code)}><Feather name="trash-2" size={18} color="#ef4444" /></TouchableOpacity>
                    </View>
                ))}
                
                <View style={styles.addShiftBox}>
                    <Text style={styles.addShiftTitle}>Thêm Ca Trực Mới</Text>
                    <View style={styles.inputWrapRow}>
                        <TextInput style={[styles.input, {flex: 1, minWidth: 100}]} placeholder="Mã (VD: C)" value={newShiftForm.code} onChangeText={t => setNewShiftForm({...newShiftForm, code: t})} maxLength={2} />
                        <TextInput style={[styles.input, {flex: 2, minWidth: 150}]} placeholder="Tên ca (VD: Ca Chiều)" value={newShiftForm.label} onChangeText={t => setNewShiftForm({...newShiftForm, label: t})} />
                    </View>
                    <View style={styles.inputWrapRow}>
                        <TextInput style={[styles.input, {flex: 1, minWidth: 100}]} placeholder="Bắt đầu (HH:MM)" value={newShiftForm.startTime} onChangeText={t => setNewShiftForm({...newShiftForm, startTime: t})} />
                        <TextInput style={[styles.input, {flex: 1, minWidth: 100}]} placeholder="Kết thúc (HH:MM)" value={newShiftForm.endTime} onChangeText={t => setNewShiftForm({...newShiftForm, endTime: t})} />
                        <TouchableOpacity style={styles.btnConfirmAdd} onPress={handleAddShift}><Feather name="plus" size={20} color="#fff" /></TouchableOpacity>
                    </View>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}><Feather name="users" size={16}/> Định mức Quân số tối thiểu</Text>
                {settings.shiftTypes?.map(s => (
                    <View key={s.code} style={styles.settingRow}>
                        <Text style={styles.itemText}>Ca {s.label} ({s.code})</Text>
                        <TextInput style={styles.smallInput} keyboardType="numeric" value={String(settings.minStaffing?.[s.code] || 0)} onChangeText={(t) => updateConfig('minStaffing', s.code, parseInt(t) || 0)} />
                    </View>
                ))}
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}><Feather name="phone-incoming" size={16}/> Định mức On-Call (Dự bị)</Text>
                <View style={styles.settingRow}>
                    <Text style={styles.itemText}>Số lượng Kíp trưởng (QL)</Text>
                    <TextInput style={styles.smallInput} keyboardType="numeric" value={String(settings.onCallRules?.managerQty || 1)} onChangeText={(t) => updateConfig('onCallRules', 'managerQty', parseInt(t) || 0)} />
                </View>
                <View style={styles.settingRow}>
                    <Text style={styles.itemText}>Số lượng Kiểm soát viên (KSV)</Text>
                    <TextInput style={styles.smallInput} keyboardType="numeric" value={String(settings.onCallRules?.staffQty || 3)} onChangeText={(t) => updateConfig('onCallRules', 'staffQty', parseInt(t) || 0)} />
                </View>
            </View>
            <View style={{height: 40}} />
        </ScrollView>
    );

    const renderSystemTab = () => (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            {isSuperAdmin && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}><Feather name="shield" size={16}/> Cấu hình Mạng & Lưu trữ (Dành riêng tctsvip)</Text>
                    
                    <View style={styles.settingRow}>
                        <View style={{flex: 1}}>
                            <Text style={styles.itemTextBold}>Giao thức Server:</Text>
                        </View>
                        <View style={styles.connectionToggle}>
                            <TouchableOpacity style={[styles.toggleBtn, networkConfig.mode === 'CLOUD' && styles.toggleBtnActive]} onPress={() => setNetworkConfig({...networkConfig, mode: 'CLOUD'})}><Text style={[styles.toggleText, networkConfig.mode === 'CLOUD' && {color: '#fff'}]}>CLOUD</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.toggleBtn, networkConfig.mode === 'LOCAL' && styles.toggleBtnActiveLocal]} onPress={() => setNetworkConfig({...networkConfig, mode: 'LOCAL'})}><Text style={[styles.toggleText, networkConfig.mode === 'LOCAL' && {color: '#fff'}]}>PRIVATE SERVER</Text></TouchableOpacity>
                        </View>
                    </View>

                    {networkConfig.mode === 'CLOUD' && (
                        <View style={styles.configInputBox}>
                            <Text style={styles.label}>Cấu hình API Firestore (Chuỗi JSON)</Text>
                            <TextInput style={[styles.input, {height: 120, textAlignVertical: 'top', fontFamily: 'Courier New', fontSize: 12}]} multiline placeholder='{"apiKey": "AIzaSy...", "projectId": "..."}' value={networkConfig.firebaseConfig} onChangeText={(t) => setNetworkConfig({...networkConfig, firebaseConfig: t})} />
                        </View>
                    )}

                    {networkConfig.mode === 'LOCAL' && (
                        <View style={styles.configInputBox}>
                            <Text style={styles.label}>URL Máy Chủ / Địa chỉ IP Public</Text>
                            <TextInput style={[styles.input, {fontFamily: 'Courier New', color: '#059669', fontWeight: 'bold'}]} placeholder="VD: http://14.232.x.x:5000/api" value={networkConfig.localServerUrl} onChangeText={(t) => setNetworkConfig({...networkConfig, localServerUrl: t})} />
                        </View>
                    )}

                    <TouchableOpacity style={styles.btnSyncNetwork} onPress={handleApplyNetworkSync} disabled={isSyncing}>
                        {isSyncing ? <ActivityIndicator color="#fff" size="small" /> : <><Feather name="refresh-cw" size={16} color="#fff" /><Text style={{color: '#fff', fontWeight: 'bold'}}>ĐỒNG BỘ MẠNG</Text></>}
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.card}>
                <Text style={styles.cardTitle}><Feather name="type" size={16}/> Tùy biến Thuật ngữ</Text>
                <View style={styles.settingRow}>
                    <Text style={styles.itemText}>Nhãn đơn vị</Text>
                    <TextInput style={[styles.input, {flex: 1, maxWidth: 150}]} value={settings.labels?.teamGroup || 'Kíp'} onChangeText={(t) => updateConfig('labels', 'teamGroup', t)} />
                </View>
                <View style={styles.settingRow}>
                    <Text style={styles.itemText}>Nhãn định danh</Text>
                    <TextInput style={[styles.input, {flex: 1, maxWidth: 150}]} value={settings.labels?.employeeId || 'Mã ICAO'} onChangeText={(t) => updateConfig('labels', 'employeeId', t)} />
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}><Feather name="database" size={16}/> Chế độ Vận hành</Text>
                <View style={styles.settingRow}>
                    <View style={{flex: 1, paddingRight: 10}}><Text style={styles.itemTextBold}>Chế độ nghiêm ngặt (Strict Mode)</Text></View>
                    <Switch value={settings.strictMode || false} onValueChange={(v) => updateConfig('strictMode', null, v)} />
                </View>
            </View>
            <View style={{height: 40}}/>
        </ScrollView>
    );

    // HÀM RENDER CHÍNH CỦA COMPONENT SETTINGS
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 15, flex: 1}}>
                    <View style={styles.headerIconBox}><Feather name="settings" size={24} color="#fff" /></View>
                    <View style={{flex: 1}}>
                        <Text style={styles.headerTitle}>Cấu Hình Hệ Thống</Text>
                        <Text style={styles.headerSub}>Thiết lập logic thuật toán và tham số</Text>
                    </View>
                </View>
                <TouchableOpacity style={[styles.btnSave, isSaving && styles.btnDisabled]} onPress={handleSaveSettings} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <><Feather name="save" size={16} color="#fff" /><Text style={styles.btnSaveText}>Lưu Thay Đổi</Text></>}
                </TouchableOpacity>
            </View>
            
            {renderSubTabMenu()}
            
            <View style={styles.mainContentWrapper}>
                {activeSubTab === 'ORG' && renderOrgTab()}
                {activeSubTab === 'ROSTER' && renderRosterTab()}
                {activeSubTab === 'SAFETY' && renderSafetyTab()}
                {activeSubTab === 'SYSTEM' && renderSystemTab()}
            </View>
        </View>
    );
}

// TOÀN BỘ STYLESHEET ĐƯỢC CHUYỂN XUỐNG DƯỚI CÙNG, ĐẢM BẢO HOẠT ĐỘNG HOÀN HẢO
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    
    header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
    headerIconBox: { backgroundColor: '#1e293b', padding: 12, borderRadius: 12 },
    headerTitle: { fontFamily: 'Times New Roman', fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    headerSub: { fontFamily: 'Times New Roman', fontSize: 13, color: '#64748b', marginTop: 4 },
    
    btnSave: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#10b981', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, elevation: 1 },
    btnSaveText: { color: '#fff', fontFamily: 'Times New Roman', fontWeight: 'bold', fontSize: 14 },
    btnDisabled: { opacity: 0.7 },

    // 🌟 ĐÃ FIX: Bọc thanh menu vào một View cố định chiều cao, chấm dứt việc tự do giãn nở (Flex Stretch)
    subTabContainer: { backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 16 },
    subTabScrollContent: { flexGrow: 1, alignItems: 'center' },
    subTabBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16, marginRight: 24, borderBottomWidth: 2, borderColor: 'transparent' },
    subTabBtnActive: { borderColor: '#2563eb' },
    subTabText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#64748b' },
    subTabTextActive: { color: '#2563eb' },
    
    // 🌟 ĐÃ FIX: Đảm bảo nội dung luôn bám theo không gian còn lại
    mainContentWrapper: { flex: 1, backgroundColor: '#f1f5f9' },
    tabContent: { flex: 1, padding: 16 },
    
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
    cardHeaderRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 12 },
    cardTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 16, borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    settingRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#f8fafc', gap: 10 },
    
    itemText: { fontFamily: 'Times New Roman', fontSize: 15, color: '#475569', flex: 1, minWidth: 150 },
    itemTextBold: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
    subLabel: { fontFamily: 'Times New Roman', fontSize: 12, color: '#94a3b8', marginTop: 4 },
    
    input: { fontFamily: 'Times New Roman', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 14, height: 42, fontSize: 14 },
    smallInput: { width: 70, height: 40, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, textAlign: 'center', fontFamily: 'Courier New', fontSize: 15, fontWeight: 'bold', color: '#2563eb' },
    codeScaleInput: { width: 60, height: 40, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, textAlign: 'center', fontFamily: 'Courier New', fontSize: 15, fontWeight: 'bold', color: '#b45309' },
    
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
    miniChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    miniChipText: { fontFamily: 'Times New Roman', fontSize: 13, color: '#334155', fontWeight: 'bold' },
    
    // Tối ưu Flex Wrap cho Mobile
    inputRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    inputWrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
    btnAdd: { width: 42, height: 42, backgroundColor: '#2563eb', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

    connectionToggle: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: '#f1f5f9', borderRadius: 10, padding: 6 },
    toggleBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    toggleBtnActive: { backgroundColor: '#2563eb' },
    toggleBtnActiveLocal: { backgroundColor: '#059669' },
    toggleText: { fontFamily: 'Courier New', fontSize: 13, fontWeight: 'bold', color: '#64748b' },

    configInputBox: { marginTop: 16, padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    label: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
    btnSyncNetwork: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: '#1e293b', paddingVertical: 16, borderRadius: 10, marginTop: 24, elevation: 2 },
    
    badgeCount: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#bfdbfe' },
    badgeCountText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#2563eb' },
    shiftManagerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', padding: 14, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
    shiftInfoMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minWidth: 200 },
    shiftCodeTag: { width: 36, height: 36, backgroundColor: '#1e293b', color: '#fff', textAlign: 'center', lineHeight: 36, borderRadius: 18, fontWeight: 'bold', fontFamily: 'Courier New', fontSize: 18, overflow: 'hidden' },
    timeInputsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' },
    timeInputSmall: { width: 80, height: 32, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center', fontFamily: 'Courier New', fontSize: 14, color: '#0369a1', fontWeight: 'bold' },
    btnDeleteShift: { padding: 10, backgroundColor: '#fee2e2', borderRadius: 10 },
    addShiftBox: { marginTop: 24, padding: 16, backgroundColor: '#f0f9ff', borderRadius: 12, borderWidth: 1, borderColor: '#bae6fd' },
    addShiftTitle: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#0369a1', marginBottom: 10 },
    btnConfirmAdd: { backgroundColor: '#16a34a', width: 42, height: 42, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }
});