import Icon from '../components/Icon.jsx';
import React, { useState, useMemo, useEffect } from 'react';
import api from '../services/ApiService';

const getMonthsInRange = (start, end) => {
    const months = [];
    const startD = new Date(start);
    const endD = new Date(end);
    if (isNaN(startD) || isNaN(endD)) return months;
    let cur = new Date(startD.getFullYear(), startD.getMonth(), 1);
    while (cur <= endD) {
        months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
        cur.setMonth(cur.getMonth() + 1);
    }
    return months;
};



export default function StatsScreen({ employees = [], settings, activities = [] }) {
  // LỌC THỜI GIAN
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-03-31');
  const [filterTeam, setFilterTeam] = useState('ALL');
  const [activeQuickDate, setActiveQuickDate] = useState('Q1');

  // Lịch trực: tải tất cả tháng trong khoảng thời gian đã chọn
  const [multiMonthSchedule, setMultiMonthSchedule] = useState({});
  useEffect(() => {
      if (!startDate || !endDate) return;
      let cancelled = false;
      const months = getMonthsInRange(startDate, endDate);
      Promise.all(months.map(m => api.get(`/api/schedules/${m}`).catch(() => ({ data: null }))))
          .then(results => {
              if (cancelled) return;
              const combined = {};
              results.forEach(({ data }) => {
                  const payload = data?.data ?? {};
                  Object.assign(combined, payload.scheduleData || {});
              });
              setMultiMonthSchedule(combined);
          });
      return () => { cancelled = true; };
  }, [startDate, endDate]);

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
        emp.team &&
        emp.team !== 'Ban Giám Đốc' &&
        !emp.position?.toLowerCase().includes('lãnh đạo') &&
        emp.team !== 'Trung tâm'
    );

    const empStats = staffOnly
        .filter(emp => filterTeam === 'ALL' || emp.team === filterTeam)
        .map(emp => {
            let stats = { S: 0, D: 0, TC: 0, OC: 0, P: 0, O: 0, CT: 0, H: 0, totalShifts: 0 };

            // scheduleData keys: "${empId}_${year}-${month0indexed}-${day}"
            const empIdStr = String(emp.id);
            Object.keys(multiMonthSchedule).forEach(flatKey => {
                const uIdx = flatKey.indexOf('_');
                if (flatKey.substring(0, uIdx) !== empIdStr) return;
                const [yr, mo0, da] = flatKey.substring(uIdx + 1).split('-').map(Number);
                const isoDate = `${yr}-${String(mo0 + 1).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
                if (isoDate >= startDate && isoDate <= endDate) {
                    const shift = multiMonthSchedule[flatKey];
                    if (shift === 'S') stats.S++;
                    else if (shift === 'D') stats.D++;
                    else if (shift === 'TC') stats.TC++;
                    else if (shift === 'OC') stats.OC++;
                }
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
  }, [employees, multiMonthSchedule, activities, startDate, endDate, filterTeam]);

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
    <div style={styles.container}>

      {/* HEADER MỚI GỌN GÀNG HƠN */}
      <div style={styles.headerArea}>
          <div style={styles.headerTitleBox}>
              <div style={styles.iconBox}><Icon name="pie-chart" size={24} color="#fff" /></div>
              <div>
                  <span style={styles.headerTitle}>Báo Cáo & Thống Kê</span>
                  <span style={styles.headerSub}>Theo dõi năng suất và biến động nhân sự</span>
              </div>
          </div>
          {/* Nút chuẩn bị cho Giai đoạn 5 */}
          <button type="button" style={styles.btnExport}>
              <Icon name="download" size={16} color="#fff" />
              <span style={styles.btnExportText}>Xuất Excel</span>
          </button>
      </div>

      <div style={styles.scrollArea}>

          {/* KHỐI BỘ LỌC (TÁCH BIỆT RÕ RÀNG) */}
          <div style={styles.filterCard}>
              <div style={styles.filterSection}>
                  <span style={styles.filterLabel}><Icon name="calendar" size={14}/> KHUNG THỜI GIAN</span>
                  <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
                      {['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'YEAR'].map(mode => {
                          const labels = { Q1: 'Quý I', Q2: 'Quý II', Q3: 'Quý III', Q4: 'Quý IV', H1: '6 Tháng Đầu', H2: '6 Tháng Cuối', YEAR: 'Cả năm' };
                          return (
                              <button type="button" key={mode} style={{...styles.quickDateBtn, ...(activeQuickDate === mode && styles.quickDateBtnActive)}} onClick={() => setQuickDate(mode)}>
                                  <span style={{...styles.quickDateText, ...(activeQuickDate === mode && styles.quickDateTextActive)}}>{labels[mode]}</span>
                              </button>
                          )
                      })}
                  </div>

                  <div style={styles.customDateRow}>
                      <div style={styles.dateInputBox}>
                          <span style={styles.dateInputLabel}>Từ ngày</span>
                          <input style={styles.dateInput} value={startDate} onChange={(e) => handleManualDateChange(e.target.value, 'start')} placeholder="YYYY-MM-DD" />
                      </div>
                      <Icon name="arrow-right" size={16} color="#cbd5e1" style={{marginLeft: 12, marginRight: 12, marginTop: 20}} />
                      <div style={styles.dateInputBox}>
                          <span style={styles.dateInputLabel}>Đến ngày</span>
                          <input style={styles.dateInput} value={endDate} onChange={(e) => handleManualDateChange(e.target.value, 'end')} placeholder="YYYY-MM-DD" />
                      </div>
                  </div>
              </div>

              <div style={styles.divider} />

              <div style={styles.filterSection}>
                  <span style={styles.filterLabel}><Icon name="users" size={14}/> LỌC ĐƠN VỊ</span>
                  <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
                      <button type="button" style={{...styles.teamFilterBtn, ...(filterTeam === 'ALL' && styles.teamFilterBtnActive)}} onClick={() => setFilterTeam('ALL')}>
                          <span style={{...styles.teamFilterText, ...(filterTeam === 'ALL' && styles.teamFilterTextActive)}}>Tất cả Kíp</span>
                      </button>
                      {settings?.teams?.filter(t => t !== 'Ban Giám Đốc' && t !== 'Trung tâm').map(t => (
                          <button type="button" key={t} style={{...styles.teamFilterBtn, ...(filterTeam === t && styles.teamFilterBtnActive)}} onClick={() => setFilterTeam(t)}>
                              <span style={{...styles.teamFilterText, ...(filterTeam === t && styles.teamFilterTextActive)}}>{t}</span>
                          </button>
                      ))}
                  </div>
              </div>
          </div>

          {/* KHỐI TỔNG HỢP NHANH (SUMMARY CARDS) */}
          <div style={styles.summaryRow}>
              <div style={styles.summaryCard}>
                  <div style={{...styles.summaryIconWrap, backgroundColor: '#e0f2fe'}}><Icon name="sun" size={20} color="#0284c7" /></div>
                  <div style={styles.summaryData}>
                      <span style={styles.summaryLabel}>CA SÁNG</span>
                      <span style={{...styles.summaryValue, color: '#0284c7'}}>{statsData.summary.totalS}</span>
                  </div>
              </div>
              <div style={styles.summaryCard}>
                  <div style={{...styles.summaryIconWrap, backgroundColor: '#e0e7ff'}}><Icon name="moon" size={20} color="#4338ca" /></div>
                  <div style={styles.summaryData}>
                      <span style={styles.summaryLabel}>CA ĐÊM</span>
                      <span style={{...styles.summaryValue, color: '#4338ca'}}>{statsData.summary.totalD}</span>
                  </div>
              </div>
              <div style={styles.summaryCard}>
                  <div style={{...styles.summaryIconWrap, backgroundColor: '#ffedd5'}}><Icon name="zap" size={20} color="#ea580c" /></div>
                  <div style={styles.summaryData}>
                      <span style={styles.summaryLabel}>TĂNG CƯỜNG</span>
                      <span style={{...styles.summaryValue, color: '#ea580c'}}>{statsData.summary.totalExtra}</span>
                  </div>
              </div>
              <div style={styles.summaryCard}>
                  <div style={{...styles.summaryIconWrap, backgroundColor: '#fee2e2'}}><Icon name="user-minus" size={20} color="#dc2626" /></div>
                  <div style={styles.summaryData}>
                      <span style={styles.summaryLabel}>NGHỈ / ỐM</span>
                      <span style={{...styles.summaryValue, color: '#dc2626'}}>{statsData.summary.totalLeave}</span>
                  </div>
              </div>
          </div>

          {/* BẢNG DỮ LIỆU CHI TIẾT (DATA GRID) */}
          <div style={styles.tableCard}>
              <div style={styles.tableHeaderSection}>
                  <span style={styles.tableTitle}>BẢNG CHI TIẾT NHÂN SỰ</span>
                  <span style={styles.tableSubTitle}>Sắp xếp giảm dần theo Tổng ca</span>
              </div>
              <div horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
                  <div style={{ minWidth: 900, paddingBottom: 10 }}>

                      {/* Tiêu đề cột */}
                      <div style={styles.tableHead}>
                          <span style={{...styles.th, width: 180, paddingLeft: 16}}>HỌ VÀ TÊN</span>
                          <span style={{...styles.th, width: 100}}>ĐƠN VỊ</span>
                          <span style={{...styles.th, width: 70, textAlign: 'center'}}>SÁNG</span>
                          <span style={{...styles.th, width: 70, textAlign: 'center'}}>ĐÊM</span>
                          <span style={{...styles.th, width: 100, textAlign: 'center'}}>T.CƯỜNG</span>
                          <span style={{...styles.th, width: 80, textAlign: 'center'}}>ON-CALL</span>
                          <span style={{...styles.th, width: 70, textAlign: 'center'}}>PHÉP</span>
                          <span style={{...styles.th, width: 70, textAlign: 'center'}}>ỐM</span>
                          <span style={{...styles.th, width: 90, textAlign: 'center'}}>C.TÁC</span>
                          <span style={{...styles.th, width: 70, textAlign: 'center'}}>HỌC</span>
                          <span style={{...styles.th, flex: 1, textAlign: 'center', color: '#16a34a'}}>TỔNG CA</span>
                      </div>

                      {/* Dữ liệu */}
                      {statsData.list.map((emp, index) => {
                          const isEven = index % 2 === 0;
                          return (
                              <div key={emp.id} style={{...styles.tableRow, ...(isEven ? styles.rowEven : styles.rowOdd)}}>
                                  <div style={{...styles.td, width: 180, paddingLeft: 16}}>
                                      <span style={styles.nameText}>{emp.name}</span>
                                      <span style={styles.idText}>{emp.icaoCode || emp.id}</span>
                                  </div>
                                  <div style={{...styles.td, width: 100}}>
                                      <div style={styles.teamBadge}><span style={styles.teamBadgeText}>{(emp.team || '—').replace('Kíp ', 'K.')}</span></div>
                                  </div>

                                  {/* Các con số được làm mờ nếu bằng 0 để dễ nhìn */}
                                  <div style={{...styles.td, width: 70}}><span style={{...styles.statNum, ...(emp.S === 0 && styles.statZero)}}>{emp.S}</span></div>
                                  <div style={{...styles.td, width: 70}}><span style={{...styles.statNum, ...(emp.D === 0 && styles.statZero)}}>{emp.D}</span></div>
                                  <div style={{...styles.td, width: 100}}><span style={{...styles.statNum, ...(emp.TC === 0 && styles.statZero)}}>{emp.TC}</span></div>
                                  <div style={{...styles.td, width: 80}}><span style={{...styles.statNum, ...(emp.OC === 0 && styles.statZero)}}>{emp.OC}</span></div>
                                  <div style={{...styles.td, width: 70}}><span style={{...styles.statNum, ...(emp.P === 0 && styles.statZero), ...(emp.P > 0 && {color: '#ef4444'})}}>{emp.P}</span></div>
                                  <div style={{...styles.td, width: 70}}><span style={{...styles.statNum, ...(emp.O === 0 && styles.statZero), ...(emp.O > 0 && {color: '#f43f5e'})}}>{emp.O}</span></div>
                                  <div style={{...styles.td, width: 90}}><span style={{...styles.statNum, ...(emp.CT === 0 && styles.statZero), ...(emp.CT > 0 && {color: '#0d9488'})}}>{emp.CT}</span></div>
                                  <div style={{...styles.td, width: 70}}><span style={{...styles.statNum, ...(emp.H === 0 && styles.statZero), ...(emp.H > 0 && {color: '#0284c7'})}}>{emp.H}</span></div>

                                  <div style={{...styles.td, flex: 1}}>
                                      <div style={{...styles.totalBadge, ...(emp.totalShifts === 0 && styles.totalBadgeZero)}}>
                                          <span style={{...styles.totalBadgeText, ...(emp.totalShifts === 0 && styles.totalTextZero)}}>{emp.totalShifts}</span>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}

                      {statsData.list.length === 0 && (
                          <div style={styles.emptyWrap}>
                              <Icon name="inbox" size={40} color="#cbd5e1" />
                              <span style={styles.emptyText}>Không có dữ liệu nhân sự cho bộ lọc này.</span>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scrollArea: { flex: 1, paddingLeft: 16, paddingRight: 16, overflowY: 'auto', display: 'block' },

  headerArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderColor: '#e2e8f0', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  headerTitleBox: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { backgroundColor: '#8b5cf6', padding: 12, borderRadius: 12, marginRight: 16 },
  headerTitle: { fontFamily: 'Times New Roman', fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  headerSub: { fontFamily: 'Times New Roman', fontSize: 13, color: '#64748b', marginTop: 4 },
  btnExport: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#10b981', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8 },
  btnExportText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#fff' },

  filterCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, marginBottom: 20, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  filterSection: { marginBottom: 4 },
  filterLabel: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#94a3b8', marginBottom: 12, letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginTop: 16, marginBottom: 16 },

  quickDateBtn: { paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 20, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 10 },
  quickDateBtnActive: { backgroundColor: '#e0e7ff', borderColor: '#818cf8' },
  quickDateText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  quickDateTextActive: { color: '#4f46e5' },

  customDateRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  dateInputBox: { flex: 1, minWidth: 120 },
  dateInputLabel: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', marginBottom: 6 },
  dateInput: { fontFamily: 'Courier New', fontSize: 14, fontWeight: 'bold', color: '#1e293b', backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 },

  teamFilterBtn: { paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 10 },
  teamFilterBtnActive: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
  teamFilterText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  teamFilterTextActive: { color: '#fff' },

  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 20 },
  summaryCard: { flex: 1, minWidth: 150, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  summaryIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  summaryData: { flex: 1 },
  summaryLabel: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 4 },
  summaryValue: { fontFamily: 'Times New Roman', fontSize: 24, fontWeight: 'bold' },

  tableCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  tableHeaderSection: { padding: 20, borderBottomWidth: 1, borderColor: '#f1f5f9', backgroundColor: '#fff' },
  tableTitle: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  tableSubTitle: { fontFamily: 'Times New Roman', fontSize: 12, color: '#94a3b8', marginTop: 4 },

  tableScroll: { backgroundColor: '#f8fafc' },
  tableHead: { flexDirection: 'row', paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f1f5f9' },
  th: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#64748b', paddingLeft: 8, paddingRight: 8 },

  tableRow: { flexDirection: 'row', paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
  rowEven: { backgroundColor: '#fff' },
  rowOdd: { backgroundColor: '#fdfdfd' },
  td: { paddingLeft: 8, paddingRight: 8, justifyContent: 'center' },

  nameText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  idText: { fontFamily: 'Courier New', fontSize: 11, color: '#94a3b8', marginTop: 4 },
  teamBadge: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8, borderRadius: 6, alignSelf: 'flex-start' },
  teamBadgeText: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#475569' },

  statNum: { fontFamily: 'Courier New', fontSize: 15, fontWeight: 'bold', color: '#1e293b', textAlign: 'center' },
  statZero: { color: '#cbd5e1', fontWeight: 'normal' },

  totalBadge: { backgroundColor: '#ecfccb', paddingTop: 6, paddingBottom: 6, borderRadius: 8, borderWidth: 1, borderColor: '#bef264', alignItems: 'center' },
  totalBadgeText: { fontFamily: 'Courier New', fontSize: 16, fontWeight: 'bold', color: '#4d7c0f' },
  totalBadgeZero: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  totalTextZero: { color: '#94a3b8', fontWeight: 'normal' },

  emptyWrap: { padding: 60, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: 'Times New Roman', fontSize: 14, color: '#94a3b8', fontStyle: 'italic', marginTop: 16 },
};
