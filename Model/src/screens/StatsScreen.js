import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function StatsScreen({ employees = [], settings, activities = [], scheduleData, schedule }) {
  // AN TOÀN DỮ LIỆU
  const safeSchedule = scheduleData || schedule || {};

  // LỌC THỜI GIAN
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-03-31');
  const [filterTeam, setFilterTeam] = useState('ALL');
  const [activeQuickDate, setActiveQuickDate] = useState('Q1'); 

  const getOverlapDays = (actStart, actEnd, filterStart, filterEnd) => {
      const aStart = actStart < filterStart ? filterStart : actStart;
      const aEnd = actEnd > filterEnd ? filterEnd : actEnd;
      const d1 = new Date(aStart);
      const d2 = new Date(aEnd);
      if (isNaN(d1) || isNaN(d2) || d1 > d2) return 0;
      return Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
  };

  // THUẬT TOÁN QUÉT VÀ THỐNG KÊ (Giữ nguyên logic chính xác của bạn)
  const statsData = useMemo(() => {
    let totalS = 0, totalD = 0, totalExtra = 0, totalLeave = 0;

    const staffOnly = employees.filter(emp => 
        emp.team !== 'Ban Giám Đốc' && 
        !emp.position?.toLowerCase().includes('lãnh đạo') &&
        emp.team !== 'Trung tâm'
    );

    const empStats = staffOnly
        .filter(emp => filterTeam === 'ALL' || emp.team === filterTeam)
        .map(emp => {
            let stats = { S: 0, D: 0, TC: 0, OC: 0, P: 0, O: 0, CT: 0, H: 0, totalShifts: 0 };

            Object.keys(safeSchedule).forEach(month => {
                const empMonthData = safeSchedule[month]?.[emp.id] || {};
                Object.keys(empMonthData).forEach(dateStr => {
                    if (dateStr >= startDate && dateStr <= endDate) {
                        const shift = empMonthData[dateStr];
                        if (shift === 'S') stats.S++;
                        else if (shift === 'D') stats.D++;
                        else if (shift === 'TC') stats.TC++; 
                        else if (shift === 'OC') stats.OC++; 
                    }
                });
            });

            activities.forEach(act => {
                if (act.empId === emp.id && act.status !== 'REJECTED') {
                    const actStart = act.startDate;
                    const actEnd = act.endDate || act.startDate;

                    if (actStart <= endDate && actEnd >= startDate) {
                        const overlapDays = getOverlapDays(actStart, actEnd, startDate, endDate);
                        const type = act.type;
                        if (type === 'LEAVE' || type === 'Nghỉ phép') stats.P += overlapDays; 
                        else if (type === 'SICK') stats.O += overlapDays; 
                        else if (type === 'TRIP') stats.CT += overlapDays; 
                        else if (type === 'STUDY') stats.H += overlapDays; 
                        else if (type === 'CHANGE' || type === 'TC' || type === 'Đổi ca') stats.TC += overlapDays; 
                        else if (type === 'ONCALL' || type === 'OC') stats.OC += overlapDays; 
                    }
                }
            });

            stats.totalShifts = stats.S + stats.D + stats.TC;

            totalS += stats.S;
            totalD += stats.D;
            totalExtra += stats.TC;
            totalLeave += (stats.P + stats.O);

            return { ...emp, ...stats };
        });

    empStats.sort((a, b) => b.totalShifts - a.totalShifts);
    return { list: empStats, summary: { totalS, totalD, totalExtra, totalLeave } };
  }, [employees, safeSchedule, activities, startDate, endDate, filterTeam]);

  const setQuickDate = (mode) => {
      setActiveQuickDate(mode);
      const y = new Date().getFullYear().toString(); 
      let start = ''; let end = '';

      switch (mode) {
          case 'Q1': start = `${y}-01-01`; end = `${y}-03-31`; break;
          case 'Q2': start = `${y}-04-01`; end = `${y}-06-30`; break;
          case 'Q3': start = `${y}-07-01`; end = `${y}-09-30`; break;
          case 'Q4': start = `${y}-10-01`; end = `${y}-12-31`; break;
          case 'H1': start = `${y}-01-01`; end = `${y}-06-30`; break;
          case 'H2': start = `${y}-07-01`; end = `${y}-12-31`; break;
          case 'YEAR': start = `${y}-01-01`; end = `${y}-12-31`; break;
          default: return;
      }
      setStartDate(start);
      setEndDate(end);
  };

  const handleManualDateChange = (val, type) => {
      setActiveQuickDate(null);
      if (type === 'start') setStartDate(val);
      else setEndDate(val);
  };

  return (
    <View style={styles.container}>
      
      {/* HEADER MỚI GỌN GÀNG HƠN */}
      <View style={styles.headerArea}>
          <View style={styles.headerTitleBox}>
              <View style={styles.iconBox}><Feather name="pie-chart" size={24} color="#fff" /></View>
              <View>
                  <Text style={styles.headerTitle}>Báo Cáo & Thống Kê</Text>
                  <Text style={styles.headerSub}>Theo dõi năng suất và biến động nhân sự</Text>
              </View>
          </View>
          {/* Nút chuẩn bị cho Giai đoạn 5 */}
          <TouchableOpacity style={styles.btnExport}>
              <Feather name="download" size={16} color="#fff" />
              <Text style={styles.btnExportText}>Xuất Excel</Text>
          </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          
          {/* KHỐI BỘ LỌC (TÁCH BIỆT RÕ RÀNG) */}
          <View style={styles.filterCard}>
              <View style={styles.filterSection}>
                  <Text style={styles.filterLabel}><Feather name="calendar" size={14}/> KHUNG THỜI GIAN</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'YEAR'].map(mode => {
                          const labels = { Q1: 'Quý I', Q2: 'Quý II', Q3: 'Quý III', Q4: 'Quý IV', H1: '6 Tháng Đầu', H2: '6 Tháng Cuối', YEAR: 'Cả năm' };
                          return (
                              <TouchableOpacity key={mode} style={[styles.quickDateBtn, activeQuickDate === mode && styles.quickDateBtnActive]} onPress={() => setQuickDate(mode)}>
                                  <Text style={[styles.quickDateText, activeQuickDate === mode && styles.quickDateTextActive]}>{labels[mode]}</Text>
                              </TouchableOpacity>
                          )
                      })}
                  </ScrollView>
                  
                  <View style={styles.customDateRow}>
                      <View style={styles.dateInputBox}>
                          <Text style={styles.dateInputLabel}>Từ ngày</Text>
                          <TextInput style={styles.dateInput} value={startDate} onChangeText={(t) => handleManualDateChange(t, 'start')} placeholder="YYYY-MM-DD" />
                      </View>
                      <Feather name="arrow-right" size={16} color="#cbd5e1" style={{marginHorizontal: 12, marginTop: 20}} />
                      <View style={styles.dateInputBox}>
                          <Text style={styles.dateInputLabel}>Đến ngày</Text>
                          <TextInput style={styles.dateInput} value={endDate} onChangeText={(t) => handleManualDateChange(t, 'end')} placeholder="YYYY-MM-DD" />
                      </View>
                  </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.filterSection}>
                  <Text style={styles.filterLabel}><Feather name="users" size={14}/> LỌC ĐƠN VỊ</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <TouchableOpacity style={[styles.teamFilterBtn, filterTeam === 'ALL' && styles.teamFilterBtnActive]} onPress={() => setFilterTeam('ALL')}>
                          <Text style={[styles.teamFilterText, filterTeam === 'ALL' && styles.teamFilterTextActive]}>Tất cả Kíp</Text>
                      </TouchableOpacity>
                      {settings?.teams?.filter(t => t !== 'Ban Giám Đốc' && t !== 'Trung tâm').map(t => (
                          <TouchableOpacity key={t} style={[styles.teamFilterBtn, filterTeam === t && styles.teamFilterBtnActive]} onPress={() => setFilterTeam(t)}>
                              <Text style={[styles.teamFilterText, filterTeam === t && styles.teamFilterTextActive]}>{t}</Text>
                          </TouchableOpacity>
                      ))}
                  </ScrollView>
              </View>
          </View>

          {/* KHỐI TỔNG HỢP NHANH (SUMMARY CARDS) */}
          <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                  <View style={[styles.summaryIconWrap, {backgroundColor: '#e0f2fe'}]}><Feather name="sun" size={20} color="#0284c7" /></View>
                  <View style={styles.summaryData}>
                      <Text style={styles.summaryLabel}>CA SÁNG</Text>
                      <Text style={[styles.summaryValue, {color: '#0284c7'}]}>{statsData.summary.totalS}</Text>
                  </View>
              </View>
              <View style={styles.summaryCard}>
                  <View style={[styles.summaryIconWrap, {backgroundColor: '#e0e7ff'}]}><Feather name="moon" size={20} color="#4338ca" /></View>
                  <View style={styles.summaryData}>
                      <Text style={styles.summaryLabel}>CA ĐÊM</Text>
                      <Text style={[styles.summaryValue, {color: '#4338ca'}]}>{statsData.summary.totalD}</Text>
                  </View>
              </View>
              <View style={styles.summaryCard}>
                  <View style={[styles.summaryIconWrap, {backgroundColor: '#ffedd5'}]}><Feather name="zap" size={20} color="#ea580c" /></View>
                  <View style={styles.summaryData}>
                      <Text style={styles.summaryLabel}>TĂNG CƯỜNG</Text>
                      <Text style={[styles.summaryValue, {color: '#ea580c'}]}>{statsData.summary.totalExtra}</Text>
                  </View>
              </View>
              <View style={styles.summaryCard}>
                  <View style={[styles.summaryIconWrap, {backgroundColor: '#fee2e2'}]}><Feather name="user-minus" size={20} color="#dc2626" /></View>
                  <View style={styles.summaryData}>
                      <Text style={styles.summaryLabel}>NGHỈ / ỐM</Text>
                      <Text style={[styles.summaryValue, {color: '#dc2626'}]}>{statsData.summary.totalLeave}</Text>
                  </View>
              </View>
          </View>

          {/* BẢNG DỮ LIỆU CHI TIẾT (DATA GRID) */}
          <View style={styles.tableCard}>
              <View style={styles.tableHeaderSection}>
                  <Text style={styles.tableTitle}>BẢNG CHI TIẾT NHÂN SỰ</Text>
                  <Text style={styles.tableSubTitle}>Sắp xếp giảm dần theo Tổng ca</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
                  <View style={{ minWidth: 900, paddingBottom: 10 }}>
                      
                      {/* Tiêu đề cột */}
                      <View style={styles.tableHead}>
                          <Text style={[styles.th, {width: 180, paddingLeft: 16}]}>HỌ VÀ TÊN</Text>
                          <Text style={[styles.th, {width: 100}]}>ĐƠN VỊ</Text>
                          <Text style={[styles.th, {width: 70, textAlign: 'center'}]}>SÁNG</Text>
                          <Text style={[styles.th, {width: 70, textAlign: 'center'}]}>ĐÊM</Text>
                          <Text style={[styles.th, {width: 100, textAlign: 'center'}]}>T.CƯỜNG</Text>
                          <Text style={[styles.th, {width: 80, textAlign: 'center'}]}>ON-CALL</Text>
                          <Text style={[styles.th, {width: 70, textAlign: 'center'}]}>PHÉP</Text>
                          <Text style={[styles.th, {width: 70, textAlign: 'center'}]}>ỐM</Text>
                          <Text style={[styles.th, {width: 90, textAlign: 'center'}]}>C.TÁC</Text>
                          <Text style={[styles.th, {width: 70, textAlign: 'center'}]}>HỌC</Text>
                          <Text style={[styles.th, {flex: 1, textAlign: 'center', color: '#16a34a'}]}>TỔNG CA</Text>
                      </View>

                      {/* Dữ liệu */}
                      {statsData.list.map((emp, index) => {
                          const isEven = index % 2 === 0;
                          return (
                              <View key={emp.id} style={[styles.tableRow, isEven ? styles.rowEven : styles.rowOdd]}>
                                  <View style={[styles.td, {width: 180, paddingLeft: 16}]}>
                                      <Text style={styles.nameText} numberOfLines={1}>{emp.name}</Text>
                                      <Text style={styles.idText}>{emp.icaoCode || emp.id}</Text>
                                  </View>
                                  <View style={[styles.td, {width: 100}]}>
                                      <View style={styles.teamBadge}><Text style={styles.teamBadgeText}>{emp.team.replace('Kíp ', 'K.')}</Text></View>
                                  </View>
                                  
                                  {/* Các con số được làm mờ nếu bằng 0 để dễ nhìn */}
                                  <View style={[styles.td, {width: 70}]}><Text style={[styles.statNum, emp.S === 0 && styles.statZero]}>{emp.S}</Text></View>
                                  <View style={[styles.td, {width: 70}]}><Text style={[styles.statNum, emp.D === 0 && styles.statZero]}>{emp.D}</Text></View>
                                  <View style={[styles.td, {width: 100}]}><Text style={[styles.statNum, emp.TC === 0 && styles.statZero]}>{emp.TC}</Text></View>
                                  <View style={[styles.td, {width: 80}]}><Text style={[styles.statNum, emp.OC === 0 && styles.statZero]}>{emp.OC}</Text></View>
                                  <View style={[styles.td, {width: 70}]}><Text style={[styles.statNum, emp.P === 0 && styles.statZero, emp.P > 0 && {color: '#ef4444'}]}>{emp.P}</Text></View>
                                  <View style={[styles.td, {width: 70}]}><Text style={[styles.statNum, emp.O === 0 && styles.statZero, emp.O > 0 && {color: '#f43f5e'}]}>{emp.O}</Text></View>
                                  <View style={[styles.td, {width: 90}]}><Text style={[styles.statNum, emp.CT === 0 && styles.statZero, emp.CT > 0 && {color: '#0d9488'}]}>{emp.CT}</Text></View>
                                  <View style={[styles.td, {width: 70}]}><Text style={[styles.statNum, emp.H === 0 && styles.statZero, emp.H > 0 && {color: '#0284c7'}]}>{emp.H}</Text></View>

                                  <View style={[styles.td, {flex: 1}]}>
                                      <View style={[styles.totalBadge, emp.totalShifts === 0 && styles.totalBadgeZero]}>
                                          <Text style={[styles.totalBadgeText, emp.totalShifts === 0 && styles.totalTextZero]}>{emp.totalShifts}</Text>
                                      </View>
                                  </View>
                              </View>
                          );
                      })}

                      {statsData.list.length === 0 && (
                          <View style={styles.emptyWrap}>
                              <Feather name="inbox" size={40} color="#cbd5e1" />
                              <Text style={styles.emptyText}>Không có dữ liệu nhân sự cho bộ lọc này.</Text>
                          </View>
                      )}
                  </View>
              </ScrollView>
          </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scrollArea: { flex: 1, paddingHorizontal: 16 },

  headerArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderColor: '#e2e8f0', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  headerTitleBox: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { backgroundColor: '#8b5cf6', padding: 12, borderRadius: 12, marginRight: 16 },
  headerTitle: { fontFamily: 'Times New Roman', fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  headerSub: { fontFamily: 'Times New Roman', fontSize: 13, color: '#64748b', marginTop: 4 },
  btnExport: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#10b981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  btnExportText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#fff' },

  filterCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, marginBottom: 20, elevation: 1 },
  filterSection: { marginBottom: 4 },
  filterLabel: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#94a3b8', marginBottom: 12, letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 16 },
  
  quickDateBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 10 },
  quickDateBtnActive: { backgroundColor: '#e0e7ff', borderColor: '#818cf8' },
  quickDateText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  quickDateTextActive: { color: '#4f46e5' },
  
  customDateRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  dateInputBox: { flex: 1, minWidth: 120 },
  dateInputLabel: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', marginBottom: 6 },
  dateInput: { fontFamily: 'Courier New', fontSize: 14, fontWeight: 'bold', color: '#1e293b', backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },

  teamFilterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 10 },
  teamFilterBtnActive: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
  teamFilterText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  teamFilterTextActive: { color: '#fff' },

  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 20 },
  summaryCard: { flex: 1, minWidth: 150, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, elevation: 1 },
  summaryIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  summaryData: { flex: 1 },
  summaryLabel: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 4 },
  summaryValue: { fontFamily: 'Times New Roman', fontSize: 24, fontWeight: 'bold' },

  tableCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', elevation: 1 },
  tableHeaderSection: { padding: 20, borderBottomWidth: 1, borderColor: '#f1f5f9', backgroundColor: '#fff' },
  tableTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  tableSubTitle: { fontFamily: 'Times New Roman', fontSize: 12, color: '#94a3b8', marginTop: 4 },
  
  tableScroll: { backgroundColor: '#f8fafc' },
  tableHead: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f1f5f9' },
  th: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b', paddingHorizontal: 8 },
  
  tableRow: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
  rowEven: { backgroundColor: '#fff' },
  rowOdd: { backgroundColor: '#fdfdfd' },
  td: { paddingHorizontal: 8, justifyContent: 'center' },
  
  nameText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  idText: { fontFamily: 'Courier New', fontSize: 11, color: '#94a3b8', marginTop: 4 },
  teamBadge: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, alignSelf: 'flex-start' },
  teamBadgeText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#475569' },
  
  statNum: { fontFamily: 'Courier New', fontSize: 15, fontWeight: 'bold', color: '#1e293b', textAlign: 'center' },
  statZero: { color: '#cbd5e1', fontWeight: 'normal' },
  
  totalBadge: { backgroundColor: '#ecfccb', paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#bef264', alignItems: 'center' },
  totalBadgeText: { fontFamily: 'Courier New', fontSize: 16, fontWeight: 'bold', color: '#4d7c0f' },
  totalBadgeZero: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  totalTextZero: { color: '#94a3b8', fontWeight: 'normal' },

  emptyWrap: { padding: 60, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#94a3b8', fontStyle: 'italic', marginTop: 16 },
});