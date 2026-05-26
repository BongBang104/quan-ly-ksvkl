import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../components/Icon.jsx';
import Spinner from '../components/Spinner.jsx';
import analyticsApi from '../services/AnalyticsService';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'compliance',     label: 'Tuân thủ',   icon: 'shield',      desc: 'Kiểm tra vi phạm quy định nghỉ ngơi và ca trực theo từng tháng.' },
  { id: 'fairness',       label: 'Công bằng',  icon: 'bar-chart-2', desc: 'Phân tích phân bổ giờ trực giữa các KSVKL để đảm bảo công bằng.' },
  { id: 'qualifications', label: 'Năng định',  icon: 'award',       desc: 'Theo dõi trạng thái năng định và cảnh báo hết hạn của KSVKL.' },
  { id: 'optimizer',      label: 'Tối ưu hóa', icon: 'zap',         desc: 'Đề xuất phân ca tự động dựa trên quy định nghỉ ngơi và năng định.' },
];

const SEV_STYLE = {
  CRITICAL: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', dot: '#dc2626' },
  WARNING:  { bg: '#fffbeb', text: '#d97706', border: '#fde68a', dot: '#f59e0b' },
  INFO:     { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', dot: '#3b82f6' },
  INACTIVE: { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0', dot: '#94a3b8' },
  EXPIRED:  { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', dot: '#dc2626' },
};

const SEV_LABEL = {
  INACTIVE: 'Không hoạt động',
  EXPIRED:  'Đã hết hạn',
  CRITICAL: 'Nguy cấp',
  WARNING:  'Cảnh báo',
  INFO:     'Thông tin',
};

const POS_LABEL = {
  APP: 'Tiếp cận (APP)',
  CTL: 'Kiểm soát (CTL)',
  TWR: 'Đài chỉ huy (TWR)',
  GCU: 'Mặt đất (GCU)',
};

const pad = n => String(n).padStart(2, '0');

const apiErr = e => {
  if (e.response) {
    const detail = e.response.data?.detail;
    return detail || `Lỗi server: HTTP ${e.response.status} — ${e.response.statusText || 'Internal Server Error'}`;
  }
  return 'Không thể kết nối Analytics Service (cổng 8001). Đảm bảo đã chạy: uvicorn app.main:app --port 8001';
};

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

const mkDisplay = mk => {
  if (!mk) return '';
  const [y, m] = mk.split('-');
  const names = ['','Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                 'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
  return `${names[parseInt(m)] || m}/${y}`;
};

// ─── Shared UI ────────────────────────────────────────────────────────────────

function SummCard({ label, value, color = '#64748b', bg = '#f8fafc' }) {
  return (
    <div style={{ flex: 1, minWidth: 110, backgroundColor: bg, borderRadius: 12,
                  border: `1.5px solid ${color}33`, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 6,
                    letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: 'Courier New', fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function ErrBox({ msg }) {
  return (
    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                  padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
      ⚠️ {msg}
    </div>
  );
}

function InfoBox({ msg }) {
  return (
    <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
                  padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
      {msg}
    </div>
  );
}

function Empty({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', alignItems: 'center' }}>
      <Icon name={icon} size={40} color="#cbd5e1" />
      <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 16, fontStyle: 'italic' }}>{text}</div>
    </div>
  );
}

function HowTo({ steps }) {
  return (
    <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10,
                  padding: '12px 16px', marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 8 }}>HƯỚNG DẪN SỬ DỤNG</div>
      {steps.map((s, i) => (
        <div key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0284c7', minWidth: 20 }}>{i + 1}.</span>
          <span style={{ fontSize: 12, color: '#0369a1', flex: 1 }}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function ViolationRow({ v }) {
  const s = SEV_STYLE[v.severity] || SEV_STYLE.INFO;
  return (
    <div style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9', borderLeft: `4px solid ${s.dot}` }}>
      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                     backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
        {SEV_LABEL[v.severity] || v.severity}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{v.controller_name || v.controller_id}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{v.message}</div>
      </div>
      <span style={{ fontFamily: 'Courier New', fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{v.rule}</span>
    </div>
  );
}

// ─── Compliance Tab ───────────────────────────────────────────────────────────

function ComplianceTab() {
  const [mk, setMk] = useState(currentMonth());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [res, setRes] = useState(null);

  const run = async () => {
    setLoading(true); setErr(null); setRes(null);
    try {
      const { data } = await analyticsApi.post('/analytics/compliance/check', {
        month_key: mk, include_report: false,
      });
      setRes(data);
    } catch (e) {
      setErr(apiErr(e));
    } finally { setLoading(false); }
  };

  const viols = res?.violations || [];
  const cnt = { CRITICAL: 0, WARNING: 0, INFO: 0 };
  viols.forEach(v => { if (v.severity in cnt) cnt[v.severity]++; });

  return (
    <div style={{ padding: 20 }}>
      <HowTo steps={[
        'Chọn tháng cần kiểm tra.',
        'Nhấn "Kiểm tra tuân thủ" — hệ thống đọc lịch trực từ DB và đối chiếu quy định.',
        'Xem danh sách vi phạm theo mức độ: CRITICAL (nguy cấp) → WARNING (cảnh báo) → INFO (thông tin).',
      ]} />

      <div style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
        <div style={{ gap: 4 }}>
          <label style={T.lbl}>Tháng kiểm tra</label>
          <input type="month" style={T.inp} value={mk} onChange={e => setMk(e.target.value)} />
        </div>
        <button type="button" style={{ ...T.btn, opacity: loading ? 0.6 : 1 }} onClick={run} disabled={loading}>
          {loading ? <Spinner size={15} color="#fff" /> : <Icon name="shield" size={15} color="#fff" />}
          <span style={{ marginLeft: 8 }}>{loading ? 'Đang kiểm tra…' : 'Kiểm tra tuân thủ'}</span>
        </button>
      </div>

      {err && <ErrBox msg={err} />}

      {res && (
        <>
          <div style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <SummCard label="Tổng vi phạm" value={res.violation_count} />
            <SummCard label="Critical"  value={cnt.CRITICAL} color="#dc2626" bg="#fef2f2" />
            <SummCard label="Warning"   value={cnt.WARNING}  color="#d97706" bg="#fffbeb" />
            <SummCard label="Info"      value={cnt.INFO}     color="#2563eb" bg="#eff6ff" />
          </div>
          {viols.length === 0
            ? <Empty icon="check-circle" text={`Không có vi phạm trong ${mkDisplay(mk)}.`} />
            : (
              <div style={T.card}>
                <div style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                              padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={T.cardTitle}>VI PHẠM — {mkDisplay(mk).toUpperCase()}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{viols.length} mục</span>
                </div>
                {viols.map((v, i) => <ViolationRow key={i} v={v} />)}
              </div>
            )
          }
        </>
      )}

      {!res && !loading && !err && (
        <Empty icon="shield" text="Chọn tháng và nhấn 'Kiểm tra tuân thủ' để xem kết quả." />
      )}
    </div>
  );
}

// ─── Fairness Tab ─────────────────────────────────────────────────────────────

function FairnessTab() {
  const [mk, setMk] = useState(currentMonth());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [res, setRes] = useState(null);

  const run = async () => {
    setLoading(true); setErr(null); setRes(null);
    try {
      const { data } = await analyticsApi.post('/analytics/fairness/summary', { month_key: mk });
      setRes(data);
    } catch (e) {
      setErr(apiErr(e));
    } finally { setLoading(false); }
  };

  const ctrls = res ? [...res.controllers].sort((a, b) => b.total_hours - a.total_hours) : [];

  return (
    <div style={{ padding: 20 }}>
      <HowTo steps={[
        'Chọn tháng cần phân tích.',
        'Nhấn "Phân tích công bằng" — hệ thống tính tổng giờ trực của từng KSVKL.',
        'Người có giờ cao hơn TB+1σ hiển thị màu đỏ, thấp hơn TB−1σ hiển thị màu xanh.',
        'Chênh lệch Max nên dưới 24h để đảm bảo công bằng.',
      ]} />

      <div style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
        <div style={{ gap: 4 }}>
          <label style={T.lbl}>Tháng phân tích</label>
          <input type="month" style={T.inp} value={mk} onChange={e => setMk(e.target.value)} />
        </div>
        <button type="button" style={{ ...T.btn, opacity: loading ? 0.6 : 1 }} onClick={run} disabled={loading}>
          {loading ? <Spinner size={15} color="#fff" /> : <Icon name="bar-chart-2" size={15} color="#fff" />}
          <span style={{ marginLeft: 8 }}>{loading ? 'Đang phân tích…' : 'Phân tích công bằng'}</span>
        </button>
      </div>

      {err && <ErrBox msg={err} />}

      {res && (
        <>
          <div style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <SummCard label="TB Giờ / Người"  value={`${res.avg_hours.toFixed(1)}h`}       color="#0284c7" bg="#e0f2fe" />
            <SummCard label="Độ lệch chuẩn"  value={`${res.std_hours.toFixed(1)}h`}       color="#7c3aed" bg="#ede9fe" />
            <SummCard label="Chênh lệch Max"
              value={`${res.max_delta_hours.toFixed(1)}h`}
              color={res.max_delta_hours > 24 ? '#dc2626' : '#16a34a'}
              bg={res.max_delta_hours > 24 ? '#fef2f2' : '#dcfce7'} />
          </div>
          {ctrls.length === 0
            ? <Empty icon="bar-chart-2" text={`Không có dữ liệu ca trực trong ${mkDisplay(mk)}.`} />
            : (
              <div style={T.card}>
                <div style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                              padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={T.cardTitle}>PHÂN BỔ GIỜ TRỰC — {mkDisplay(mk).toUpperCase()}</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <th style={T.th}>KSVKL</th>
                      <th style={{ ...T.th, textAlign: 'right' }}>TỔNG GIỜ</th>
                      <th style={{ ...T.th, textAlign: 'right' }}>CA ĐÊM</th>
                      <th style={{ ...T.th, textAlign: 'right' }}>SỐ CA</th>
                      <th style={{ ...T.th, textAlign: 'right' }}>NGÀY TRỰC</th>
                      <th style={{ ...T.th, width: 120 }}>PHÂN BỔ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ctrls.map((c, i) => {
                      const maxH = ctrls[0]?.total_hours || 1;
                      const pct  = Math.round((c.total_hours / maxH) * 100);
                      const hi   = c.total_hours > res.avg_hours + res.std_hours;
                      const lo   = c.total_hours < res.avg_hours - res.std_hours;
                      return (
                        <tr key={c.controller_id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          <td style={T.td}>{c.controller_name || c.controller_id}</td>
                          <td style={{ ...T.td, textAlign: 'right', fontWeight: 700,
                                       color: hi ? '#dc2626' : lo ? '#0284c7' : '#1e293b' }}>
                            {c.total_hours.toFixed(1)}h
                          </td>
                          <td style={{ ...T.td, textAlign: 'right', color: c.night_shifts > 0 ? '#7c3aed' : '#cbd5e1' }}>{c.night_shifts}</td>
                          <td style={{ ...T.td, textAlign: 'right' }}>{c.shift_count}</td>
                          <td style={{ ...T.td, textAlign: 'right' }}>{c.work_days}</td>
                          <td style={T.td}>
                            <div style={{ height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`,
                                           backgroundColor: hi ? '#ef4444' : '#3b82f6', borderRadius: 4 }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </>
      )}

      {!res && !loading && !err && (
        <Empty icon="bar-chart-2" text="Chọn tháng và nhấn 'Phân tích công bằng' để xem kết quả." />
      )}
    </div>
  );
}

// ─── Qualifications Tab ───────────────────────────────────────────────────────

function QualificationsTab() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [coverage, setCoverage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const [aRes, cRes] = await Promise.all([
        analyticsApi.get('/analytics/ratings/expiring?days=60'),
        analyticsApi.get('/analytics/ratings/coverage'),
      ]);
      setAlerts(aRes.data);
      setCoverage(cRes.data);
    } catch (e) {
      setErr(apiErr(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 20 }}>
      <HowTo steps={[
        'Dữ liệu tự động tải từ DB — không cần thao tác thêm.',
        'Phần "Phủ sóng": xem có đủ KSVKL đủ năng định cho từng vị trí không (APP/CTL/TWR/GCU).',
        'Phần "Cảnh báo": danh sách KSVKL sắp hết hạn năng định trong 60 ngày tới.',
        'Nhấn "Tải lại" để cập nhật dữ liệu mới nhất.',
      ]} />

      <div style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button type="button" style={{ ...T.btn, backgroundColor: '#475569', opacity: loading ? 0.6 : 1 }}
                onClick={load} disabled={loading}>
          <Icon name="refresh-cw" size={15} color="#fff" />
          <span style={{ marginLeft: 8 }}>Tải lại</span>
        </button>
      </div>

      {loading && (
        <div style={{ alignItems: 'center', padding: 40 }}>
          <Spinner size={32} color="#2563eb" />
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 12 }}>Đang tải dữ liệu…</div>
        </div>
      )}
      {err && <ErrBox msg={err} />}

      {coverage && (
        <div style={{ ...T.card, marginBottom: 16 }}>
          <div style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <span style={T.cardTitle}>PHỦ SÓNG NĂNG ĐỊNH THEO VỊ TRÍ</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              {coverage.total_controllers} KSVKL · {coverage.total_active_full} FULL
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, padding: 16 }}>
            {coverage.positions.map(pos => (
              <div key={pos.position} style={{
                backgroundColor: pos.is_sufficient ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${pos.is_sufficient ? '#bbf7d0' : '#fecaca'}`,
                borderRadius: 12, padding: 16,
              }}>
                <div style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{POS_LABEL[pos.position] || pos.position}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: pos.is_sufficient ? '#16a34a' : '#dc2626' }}>
                    {pos.is_sufficient ? '✓ ĐỦ' : '✗ THIẾU'}
                  </span>
                </div>
                <div style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontFamily: 'Courier New', fontSize: 28, fontWeight: 800,
                                 color: pos.is_sufficient ? '#15803d' : '#dc2626' }}>{pos.active_count}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>/ {pos.qualified_count} người</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts && (
        <div style={T.card}>
          <div style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <span style={T.cardTitle}>CẢNH BÁO HẾT HẠN NĂNG ĐỊNH</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{alerts.alert_count} cảnh báo</span>
          </div>
          {alerts.alerts.length === 0
            ? <div style={{ padding: '32px 20px', alignItems: 'center', fontSize: 14, color: '#94a3b8', fontStyle: 'italic' }}>
                Không có cảnh báo hết hạn năng định.
              </div>
            : alerts.alerts.map((a, i) => {
              const s = SEV_STYLE[a.severity] || SEV_STYLE.INFO;
              return (
                <div key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14,
                                      padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                                      borderLeft: `4px solid ${s.dot}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                                 backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
                    {SEV_LABEL[a.severity] || a.severity}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{a.controller_name || a.controller_id}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{a.qualification_label}</div>
                  </div>
                  <div style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'Courier New', fontSize: 13, fontWeight: 700, color: s.text }}>
                      {a.days_remaining != null
                        ? (a.days_remaining <= 0 ? 'Đã hết hạn' : `Còn ${a.days_remaining} ngày`)
                        : 'Không rõ'}
                    </div>
                    {a.expires_at && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{a.expires_at}</div>}
                  </div>
                </div>
              );
            })
          }
        </div>
      )}
    </div>
  );
}

// ─── Optimizer Tab ────────────────────────────────────────────────────────────

function OptimizerTab({ employees = [] }) {
  const today = new Date();
  const y = today.getFullYear(), mo = today.getMonth() + 1;
  const lastDay = new Date(y, mo, 0).getDate();

  const [start, setStart]     = useState(`${y}-${pad(mo)}-01`);
  const [end,   setEnd]       = useState(`${y}-${pad(mo)}-${pad(lastDay)}`);
  const [inclS, setInclS]     = useState(true);
  const [inclD, setInclD]     = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState(null);
  const [res, setRes]         = useState(null);

  const qualified = employees.filter(e =>
    e.qualification &&
    e.team !== 'Ban Giám Đốc' && e.team !== 'Trung tâm' &&
    !e.position?.toLowerCase().includes('lãnh đạo')
  );

  const [sel, setSel] = useState(new Set());
  useEffect(() => {
    setSel(new Set(qualified.map(e => String(e.id))));
  }, [employees.length]); // eslint-disable-line

  const toggle = id => setSel(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const buildSlots = () => {
    const slots = [];
    const cur = new Date(start + 'T12:00:00');
    const fin = new Date(end   + 'T12:00:00');
    while (cur <= fin) {
      const d  = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
      const nxt = new Date(cur); nxt.setDate(nxt.getDate() + 1);
      const nd = `${nxt.getFullYear()}-${pad(nxt.getMonth() + 1)}-${pad(nxt.getDate())}`;
      if (inclS) slots.push({ slot_id: `${d}_S`, start: `${d}T07:00:00`, end: `${d}T19:00:00`, is_night: false, required_positions: [] });
      if (inclD) slots.push({ slot_id: `${d}_D`, start: `${d}T19:00:00`, end: `${nd}T07:00:00`, is_night: true,  required_positions: [] });
      cur.setDate(cur.getDate() + 1);
    }
    return slots;
  };

  const run = async () => {
    if (!inclS && !inclD) { setErr('Chọn ít nhất một loại ca.'); return; }
    if (sel.size === 0)   { setErr('Chọn ít nhất một KSVKL.');   return; }
    setLoading(true); setErr(null); setRes(null);
    try {
      const { data } = await analyticsApi.post('/analytics/optimize/roster', {
        slots: buildSlots(),
        controllers: qualified.filter(e => sel.has(String(e.id))).map(e => ({
          controller_id:    String(e.id),
          controller_name:  e.name,
          qualification:    (e.qualification || 'FULL').toUpperCase(),
          unavailable_dates: [],
        })),
        time_limit_seconds: 30,
      });
      setRes(data);
    } catch (e) {
      setErr(apiErr(e));
    } finally { setLoading(false); }
  };

  // Build day → { S: name, D: name } from assignments
  const dayMap = {};
  Object.entries(res?.assignments || {}).forEach(([sid, cid]) => {
    const parts = sid.split('_');
    const type  = parts[parts.length - 1];
    const d     = parts.slice(0, -1).join('_');
    if (!dayMap[d]) dayMap[d] = {};
    const emp = qualified.find(e => String(e.id) === cid);
    dayMap[d][type] = emp?.name || cid;
  });
  const days = Object.keys(dayMap).sort();
  const DOW  = ['CN','T2','T3','T4','T5','T6','T7'];

  return (
    <div style={{ padding: 20 }}>
      <HowTo steps={[
        'Chọn khoảng ngày cần lên lịch (mặc định: tháng hiện tại).',
        'Chọn loại ca: Ca Sáng (07:00–19:00) và/hoặc Ca Đêm (19:00–07:00 hôm sau).',
        'Tích chọn KSVKL tham gia vào lịch (mặc định: tất cả có năng định).',
        'Nhấn "Tối ưu hóa" — CP-SAT gán 1 KSVKL trực chính cho mỗi ô ca, phân bổ công bằng nhất có thể (tối đa 30 giây). Mỗi ngày tối đa 2 người: 1 ca Sáng + 1 ca Đêm.',
        '⚠️ Kết quả là ĐỀ XUẤT phân công trực chính — kíp trưởng phải duyệt và bổ sung nhân sự phụ trước khi áp dụng chính thức.',
      ]} />

      <InfoBox msg="⚠️ Mọi ngưỡng quy định (giờ nghỉ tối thiểu, giờ trực tối đa…) là giá trị ví dụ. Cần thay bằng số liệu VATM/CAAV/ICAO chính thức trước khi dùng thật." />

      {/* Controls card */}
      <div style={{ ...T.card, padding: 20, marginBottom: 16 }}>

        {/* Date range + shift type */}
        <div style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div style={{ gap: 4 }}>
            <label style={T.lbl}>Từ ngày</label>
            <input type="date" style={T.inp} value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div style={{ gap: 4 }}>
            <label style={T.lbl}>Đến ngày</label>
            <input type="date" style={T.inp} value={end} onChange={e => setEnd(e.target.value)} />
          </div>
          <div style={{ gap: 4 }}>
            <label style={T.lbl}>Loại ca</label>
            <div style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
              <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={inclS} onChange={e => setInclS(e.target.checked)} />
                <span>Ca Sáng (S)</span>
              </label>
              <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={inclD} onChange={e => setInclD(e.target.checked)} />
                <span>Ca Đêm (D)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Controller selection */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label style={T.lbl}>KSVKL THAM GIA ({sel.size}/{qualified.length})</label>
            <div style={{ flexDirection: 'row', gap: 8 }}>
              <button type="button" style={T.smlBtn}
                      onClick={() => setSel(new Set(qualified.map(e => String(e.id))))}>Chọn tất cả</button>
              <button type="button" style={T.smlBtn}
                      onClick={() => setSel(new Set())}>Bỏ chọn</button>
            </div>
          </div>
          {qualified.length === 0
            ? <span style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>
                Không tìm thấy KSVKL nào có năng định.
              </span>
            : (
              <div style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {qualified.map(emp => {
                  const sid = String(emp.id); const on = sel.has(sid);
                  return (
                    <label key={sid} style={{
                      display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'pointer',
                      padding: '5px 12px', borderRadius: 8, fontSize: 12,
                      border: `1px solid ${on ? '#93c5fd' : '#e2e8f0'}`,
                      backgroundColor: on ? '#eff6ff' : '#f8fafc',
                    }}>
                      <input type="checkbox" checked={on} onChange={() => toggle(sid)} style={{ margin: 0 }} />
                      <span>{emp.name}</span>
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>({emp.qualification})</span>
                    </label>
                  );
                })}
              </div>
            )
          }
        </div>

        <button type="button"
                style={{ ...T.btn, width: '100%', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}
                onClick={run} disabled={loading}>
          {loading ? <Spinner size={15} color="#fff" /> : <Icon name="zap" size={15} color="#fff" />}
          <span style={{ marginLeft: 8 }}>
            {loading ? 'Đang tối ưu hóa (tối đa 30 giây)…' : 'Tối ưu hóa phân ca'}
          </span>
        </button>
      </div>

      {err && <ErrBox msg={err} />}

      {res && (
        <>
          {/* Status summary */}
          <div style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <SummCard label="Trạng thái" value={res.status}
              color={res.status === 'OPTIMAL' ? '#16a34a' : res.status === 'FEASIBLE' ? '#0284c7' : '#dc2626'}
              bg={res.status === 'OPTIMAL' ? '#dcfce7' : res.status === 'FEASIBLE' ? '#e0f2fe' : '#fef2f2'} />
            <SummCard label="Solver"     value={res.solver_used} color="#7c3aed" bg="#ede9fe" />
            <SummCard label="Ô ca đã phân" value={`${Object.keys(res.assignments || {}).length} ca`} color="#16a34a" bg="#dcfce7" />
            <SummCard label="Chưa phân" value={`${(res.unassigned_slots || []).length} ca`}
              color={(res.unassigned_slots || []).length > 0 ? '#dc2626' : '#94a3b8'} />
          </div>

          {res.has_critical && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                          padding: '10px 16px', marginBottom: 12, fontSize: 13, color: '#dc2626', fontWeight: 700 }}>
              ⚠️ Phương án có vi phạm CRITICAL — cần xem xét lại trước khi áp dụng.
            </div>
          )}

          {/* Assignment table */}
          {days.length > 0 && (
            <div style={{ ...T.card, marginBottom: 16 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={T.cardTitle}>ĐỀ XUẤT PHÂN CA TRỰC CHÍNH</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>1 KSVKL / ô ca</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                  Mỗi ô là KSVKL trực chính (ca trưởng) — chưa bao gồm nhân sự phụ và kíp hỗ trợ.
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={T.th}>NGÀY</th>
                    {inclS && <th style={{ ...T.th, textAlign: 'center' }}>CA SÁNG 07:00–19:00 · TRỰC CHÍNH</th>}
                    {inclD && <th style={{ ...T.th, textAlign: 'center' }}>CA ĐÊM 19:00–07:00 · TRỰC CHÍNH</th>}
                  </tr>
                </thead>
                <tbody>
                  {days.map((d, i) => {
                    const dObj = new Date(d + 'T12:00:00');
                    const dow  = DOW[dObj.getDay()];
                    const isWe = dObj.getDay() === 0 || dObj.getDay() === 6;
                    return (
                      <tr key={d} style={{ backgroundColor: isWe ? '#faf5ff' : i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                        <td style={{ ...T.td, fontFamily: 'Courier New', fontWeight: 700 }}>
                          <span style={{ color: isWe ? '#9333ea' : '#475569' }}>{dow}</span>
                          {' '}{d.slice(8)}/{d.slice(5, 7)}
                        </td>
                        {inclS && (
                          <td style={{ ...T.td, textAlign: 'center' }}>
                            {dayMap[d]?.S
                              ? <span style={{ backgroundColor: '#e0f2fe', color: '#0284c7', padding: '4px 14px',
                                              borderRadius: 6, fontSize: 13, fontWeight: 700 }}>{dayMap[d].S}</span>
                              : <span style={{ color: '#dc2626', fontSize: 12, fontStyle: 'italic' }}>chưa phân</span>}
                          </td>
                        )}
                        {inclD && (
                          <td style={{ ...T.td, textAlign: 'center' }}>
                            {dayMap[d]?.D
                              ? <span style={{ backgroundColor: '#ede9fe', color: '#7c3aed', padding: '4px 14px',
                                              borderRadius: 6, fontSize: 13, fontWeight: 700 }}>{dayMap[d].D}</span>
                              : <span style={{ color: '#dc2626', fontSize: 12, fontStyle: 'italic' }}>chưa phân</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Hours metrics */}
          {res.metrics?.hours_per_controller && Object.keys(res.metrics.hours_per_controller).length > 0 && (
            <div style={T.card}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={T.cardTitle}>PHÂN BỔ GIỜ ĐỀ XUẤT</span>
              </div>
              <div style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 }}>
                {Object.entries(res.metrics.hours_per_controller).map(([cid, h]) => {
                  const emp = qualified.find(e => String(e.id) === cid);
                  return (
                    <div key={cid} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
                                           borderRadius: 10, padding: '10px 16px', minWidth: 120 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>{emp?.name || cid}</div>
                      <div style={{ fontFamily: 'Courier New', fontSize: 22, fontWeight: 800, color: '#0284c7' }}>{h}h</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {!res && !loading && !err && (
        <Empty icon="zap" text="Cấu hình và nhấn 'Tối ưu hóa phân ca' để xem đề xuất." />
      )}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const T = {
  lbl:      { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' },
  inp:      { fontFamily: 'Courier New', fontSize: 14, color: '#1e293b', border: '1px solid #e2e8f0',
              borderRadius: 8, padding: '8px 12px', backgroundColor: '#fff' },
  btn:      { flexDirection: 'row', alignItems: 'center', padding: '10px 20px', backgroundColor: '#2563eb',
              border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700 },
  smlBtn:   { flexDirection: 'row', alignItems: 'center', padding: '4px 12px', backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#475569' },
  card:     { backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
              overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  cardTitle:{ fontSize: 14, fontWeight: 700, color: '#1e293b' },
  th:       { fontSize: 11, fontWeight: 700, color: '#64748b', padding: '12px 16px',
              textAlign: 'left', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' },
  td:       { fontSize: 13, color: '#1e293b', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AnalyticsScreen({ employees = [] }) {
  const [tab, setTab] = useState('compliance');
  const active = TABS.find(t => t.id === tab);

  return (
    <div style={{ flex: 1, backgroundColor: '#f1f5f9', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ backgroundColor: '#fff', padding: '18px 24px',
                    borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <div style={{ backgroundColor: '#0f172a', padding: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="activity" size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Phân tích ATQK</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{active?.desc}</div>
          </div>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div style={{ backgroundColor: '#fff', borderBottom: '2px solid #e2e8f0',
                    flexDirection: 'row', flexShrink: 0 }}>
        {TABS.map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              padding: '12px 20px', border: 'none',
              borderBottom: `3px solid ${on ? '#2563eb' : 'transparent'}`,
              marginBottom: -2,
              backgroundColor: 'transparent', cursor: 'pointer',
              fontSize: 13, fontWeight: on ? 700 : 500,
              color: on ? '#2563eb' : '#64748b',
            }}>
              <Icon name={t.icon} size={14} color={on ? '#2563eb' : '#94a3b8'} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'compliance'     && <ComplianceTab />}
        {tab === 'fairness'       && <FairnessTab />}
        {tab === 'qualifications' && <QualificationsTab />}
        {tab === 'optimizer'      && <OptimizerTab employees={employees} />}
      </div>
    </div>
  );
}
