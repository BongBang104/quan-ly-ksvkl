import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../components/Icon.jsx';
import Spinner from '../components/Spinner.jsx';
import api, { getMacroChecklist } from '../services/ApiService';
import ChecklistViewer from '../components/ChecklistViewer.jsx';
import KssScale        from '../components/KssScale.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const TAB_GROUPS = [
  {
    id: 'analysis', label: 'Phân tích & Giám sát',
    desc: 'Theo dõi tuân thủ, công bằng, năng định, tối ưu hóa và chỉ số an toàn FMP.',
    tabs: [
      { id: 'compliance',     label: 'Tuân thủ',      icon: 'shield',       desc: 'Kiểm tra vi phạm quy định nghỉ ngơi và ca trực theo từng tháng.' },
      { id: 'fairness',       label: 'Công bằng',     icon: 'bar-chart-2',  desc: 'Phân tích phân bổ giờ trực giữa các KSVKL để đảm bảo công bằng.' },
      { id: 'qualifications', label: 'Năng định',     icon: 'award',        desc: 'Theo dõi trạng thái năng định và cảnh báo hết hạn của KSVKL.' },
      { id: 'optimizer',      label: 'Tối ưu hóa',   icon: 'zap',          desc: 'Đề xuất phân ca tự động dựa trên QĐ 2288.' },
      { id: 'spi',            label: 'Dashboard SPI', icon: 'activity',     desc: 'Chỉ số hiệu suất an toàn theo QĐ 2288 Điều 24.' },
    ],
  },
  {
    id: 'forms', label: 'Biểu mẫu & Quy trình',
    desc: 'Các biểu mẫu pháp lý theo Phụ lục QĐ 2288 và QĐ 2701.',
    tabs: [
      { id: 'checklist', label: 'Đánh giá lịch trực', icon: 'check-square',    desc: 'Checklist Phụ lục I — QĐ 2288.' },
      { id: 'fatigue',   label: 'Báo cáo mệt mỏi',    icon: 'alert-triangle', desc: 'Báo cáo theo Phụ lục III — QĐ 2288. Bảo mật, không trừng phạt.' },
      { id: 'exchange',  label: 'Đổi ca / Trực thay', icon: 'repeat',         desc: 'Theo Phụ lục I — QĐ 2701.' },
      { id: 'briefing',  label: 'Bình giảng sau ca',  icon: 'file-text',      desc: 'Theo Phụ lục II — QĐ 2701.' },
      { id: 'handover',  label: 'Giao nhận ca (WEST)', icon: 'arrow-right-circle', desc: 'Giao nhận ca theo mô hình WEST — QĐ 2701 Điều 10-12.' },
    ],
  },
];

// Backward-compat: code cũ tham chiếu TABS — giữ flat list
const TABS = TAB_GROUPS.flatMap(g => g.tabs);

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

function PrecheckPanel({ result }) {
  if (!result) return null;

  const canApprove = result.can_approve ?? result.canApprove ?? false;
  const warnings = result.warnings ?? [];
  const qualification = result.qualification_check ?? result.qualificationCheck ?? {};
  const applicantViolations = result.new_violations_applicant ?? result.newViolationsApplicant ?? [];
  const counterpartyViolations = result.new_violations_counterparty ?? result.newViolationsCounterparty ?? [];
  const notes = result.notes ?? [];
  const allViolations = [...applicantViolations, ...counterpartyViolations];

  return (
    <div style={{ marginTop: 16, padding: 16, borderRadius: 10,
                  border: `1px solid ${canApprove ? '#86efac' : '#fecaca'}`,
                  backgroundColor: canApprove ? '#f0fdf4' : '#fef2f2' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: canApprove ? '#166534' : '#991b1b' }}>
          {canApprove
            ? '✓ Precheck: cho phép đổi ca (cần kíp trưởng phê duyệt)'
            : '✗ Precheck: KHÔNG cho phép đổi ca'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Năng định applicant</div>
          <div style={{ fontSize: 14, color: qualification.applicant_has_required ? '#166534' : '#b91c1c' }}>
            {qualification.applicant_has_required ? '✓ Đủ điều kiện' : '✗ Thiếu điều kiện'}
          </div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{qualification.required_for_applicant || ''}</div>
        </div>
        <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Năng định counterparty</div>
          <div style={{ fontSize: 14, color: qualification.counterparty_has_required ? '#166534' : '#b91c1c' }}>
            {qualification.counterparty_has_required ? '✓ Đủ điều kiện' : '✗ Thiếu điều kiện'}
          </div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{qualification.required_for_counterparty || ''}</div>
        </div>
      </div>

      {allViolations.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Vi phạm mới phát sinh:</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {allViolations.map((violation, idx) => (
              <div key={idx} style={{ padding: 10, borderRadius: 8, backgroundColor: '#fff', border: `1px solid ${violation.severity === 'CRITICAL' ? '#fecaca' : '#fde68a'}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: violation.severity === 'CRITICAL' ? '#991b1b' : '#92400e' }}>
                  [{violation.severity}] {violation.rule || violation.message}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{violation.message ?? ''}</div>
                {violation.legal_basis && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>📜 {violation.legal_basis}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div style={{ padding: 12, borderRadius: 10, backgroundColor: '#fffbeb', border: '1px solid #fde68a', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Cảnh báo</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#92400e', fontSize: 13 }}>
            {warnings.map((warning, idx) => <li key={idx}>{warning}</li>)}
          </ul>
        </div>
      )}

      {notes.length > 0 && (
        <div style={{ fontSize: 12, color: '#475569' }}>
          {notes.map((note, idx) => <div key={idx}>ℹ️ {note}</div>)}
        </div>
      )}
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
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9', borderLeft: `4px solid ${s.dot}` }}>
      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                     marginTop: 2, backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
        {SEV_LABEL[v.severity] || v.severity}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{v.controller_name || v.controller_id}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.45 }}>{v.message}</div>
        {v.legal_basis && (
          <span style={{
            display: 'inline-block', marginTop: 5,
            fontSize: 11, fontWeight: 600, color: '#64748b',
            backgroundColor: '#f1f5f9', padding: '1px 7px',
            borderRadius: 3, border: '1px solid #e2e8f0',
          }}>
            {v.legal_basis}
          </span>
        )}
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
      const { data } = await api.get(`/api/schedules/macro-compliance/${mk}`);
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
      const { data } = await api.get(`/api/schedules/macro-fairness/${mk}`);
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
            <SummCard label="Chênh lệch Max"  value={`${res.max_delta_hours.toFixed(1)}h`} color="#7c3aed" bg="#ede9fe" />
          </div>
          <InfoBox msg="Dữ liệu phục vụ giám sát công bằng phân ca (FSAG — QĐ 2289 Chương I.III.1). Chênh lệch lớn không tự động là vi phạm — cần đánh giá cùng các yếu tố khác (nguyện vọng cá nhân, đào tạo, công tác)." />
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
                      <th style={{ ...T.th, textAlign: 'right' }}>GIỜ ĐÊM</th>
                      <th style={{ ...T.th, textAlign: 'right' }}>SỐ CA ĐÊM</th>
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
                          <td style={{ ...T.td, textAlign: 'right', fontFamily: 'Courier New',
                                       color: (c.night_hours ?? 0) > 0 ? '#7c3aed' : '#cbd5e1' }}>
                            {(c.night_hours ?? 0).toFixed(1)}h
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
  const [daysAhead, setDaysAhead] = useState(60);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const [aRes, cRes] = await Promise.all([
        api.get(`/api/schedules/ratings-expiring?days=${daysAhead}`),
        api.get('/api/schedules/ratings-coverage'),
      ]);
      setAlerts(aRes.data);
      setCoverage(cRes.data);
    } catch (e) {
      setErr(apiErr(e));
    } finally { setLoading(false); }
  }, [daysAhead]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 20 }}>
      <HowTo steps={[
        'Dữ liệu tự động tải từ DB — không cần thao tác thêm.',
        'Phần "Phủ sóng": xem có đủ KSVKL đủ năng định cho từng vị trí không (APP/CTL/TWR/GCU).',
        'Phần "Cảnh báo": danh sách KSVKL sắp hết hạn năng định trong khoảng thời gian đã chọn.',
        'Nhấn "Tải lại" để cập nhật dữ liệu mới nhất.',
      ]} />

      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <label style={T.lbl}>Cảnh báo trong vòng:</label>
          <select value={daysAhead} onChange={e => setDaysAhead(parseInt(e.target.value))}
                  style={{ ...T.inp, padding: '8px 12px' }}>
            <option value={30}>30 ngày</option>
            <option value={60}>60 ngày</option>
            <option value={90}>90 ngày</option>
          </select>
        </div>
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
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{pos.position_label || POS_LABEL[pos.position] || pos.position}</span>
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
          {coverage.note_auxiliary && (
            <div style={{ padding: '10px 16px', fontSize: 12, color: '#64748b',
                          fontStyle: 'italic', borderTop: '1px solid #f1f5f9' }}>
              ℹ️ {coverage.note_auxiliary}
            </div>
          )}
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
      const { data } = await api.post('/api/schedules/optimize-roster', {
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

      <InfoBox msg="Áp dụng giới hạn theo QĐ 2288/QĐ-QLB ngày 25/3/2026: nghỉ ≥ 12h giữa 2 ca, ≤ 3 ca đêm liên tiếp, ≤ 6 ngày làm việc liên tiếp, ≤ 180h/30 ngày. Phương án là ĐỀ XUẤT tham khảo — kíp trưởng/cán bộ cơ sở quyết định cuối cùng (QĐ 2288 Điều 5.1)." />

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

// ─── ChecklistTab (Phase C4) ──────────────────────────────────────────────────

function ChecklistTab() {
  const [mk, setMk] = useState(currentMonth());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [data, setData] = useState(null);

  const run = async () => {
    setLoading(true); setErr(null); setData(null);
    try {
      // Lấy lịch tháng từ backend, chuyển thành assignments[]
      const { data: schedule } = await api.get(`/api/schedules/${mk}`);
      const payload = schedule?.data ?? {};
      const sd = payload.scheduleData ?? {};
      const assignments = [];
      for (const [key, shiftCode] of Object.entries(sd)) {
        if (!shiftCode) continue;
        const underIdx = key.indexOf('_');
        if (underIdx === -1) continue;
        const controllerId = key.slice(0, underIdx);
        const parts = key.slice(underIdx + 1).split('-').map(Number);
        if (parts.length !== 3) continue;
        const [y, m, d] = parts;
        const isoDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        assignments.push({ date: isoDate, controller_id: String(controllerId), shift_kind: shiftCode });
      }
      const lastDay = new Date(parseInt(mk.split('-')[0]), parseInt(mk.split('-')[1]), 0).getDate();
      const { data: checklist } = await api.post('/api/schedules/macro-checklist', {
        period_start: mk + '-01',
        period_end: mk + '-' + String(lastDay).padStart(2, '0'),
        assignments,
      });
      setData(checklist);
    } catch (e) {
      setErr(e?.response?.data?.message ?? e.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: 20 }}>
      <HowTo steps={[
        'Chọn tháng cần đánh giá.',
        'Nhấn "Sinh Checklist" — hệ thống đọc lịch trực, đối chiếu QĐ 2288 Phụ lục I.',
        'Xem kết quả: 5 nhóm tiêu chí A-E, tổng cộng 23 mục.',
        'Nhấn "In / Xuất PDF" để in checklist A4 (gửi Ban An toàn-Chất lượng).',
      ]} />
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap',
                    alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
        <div style={{ gap: 4 }}>
          <label style={T.lbl}>Tháng đánh giá</label>
          <input type="month" style={T.inp} value={mk} onChange={e => setMk(e.target.value)} />
        </div>
        <button type="button" style={{ ...T.btn, opacity: loading ? 0.6 : 1 }}
                onClick={run} disabled={loading}>
          {loading ? <Spinner size={15} color="#fff" /> : <Icon name="check-square" size={15} color="#fff" />}
          <span style={{ marginLeft: 8 }}>{loading ? 'Đang sinh…' : 'Sinh Checklist'}</span>
        </button>
      </div>
      {err && <ErrBox msg={err} />}
      {data && <ChecklistViewer data={data} />}
      {!data && !loading && !err && (
        <Empty icon="check-square" text="Chọn tháng và nhấn 'Sinh Checklist' để xem kết quả." />
      )}
    </div>
  );
}

// ─── SpiDashboardTab (Phase G2) ────────────────────────────────────────────────

function SpiCard({ indicator }) {
  const STATUS_COLORS = {
    ok:       { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
    warning:  { bg: '#fffbeb', border: '#fde68a', text: '#d97706' },
    critical: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
  };
  const s = STATUS_COLORS[indicator.status] || STATUS_COLORS.ok;
  const val = indicator.value;
  return (
    <div style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`,
                  borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{indicator.label}</div>
      <div style={{ fontFamily: 'Courier New', fontSize: 32, fontWeight: 800, color: s.text }}>
        {val === null || val === undefined ? '—'
         : typeof val === 'number' && indicator.label?.includes('%') ? `${val.toFixed(0)}%` : val}
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
        {indicator.legal_basis}
      </div>
    </div>
  );
}

function SpiDashboardTab() {
  const [mk, setMk] = useState(currentMonth());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const { data: res } = await api.get(`/api/schedules/spi-summary/${mk}`);
      setData(res);
    } catch (e) {
      setErr(e?.response?.data?.message ?? e.message);
    } finally { setLoading(false); }
  }, [mk]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 20 }}>
      <HowTo steps={[
        'Dashboard hiển thị các chỉ số hiệu suất an toàn (SPI) liên quan mệt mỏi.',
        'Cơ sở: QĐ 2288/QĐ-QLB Điều 24 — chỉ số FMP/FRMS.',
        'Một số chỉ số (báo cáo mệt mỏi, đào tạo) sẽ có dữ liệu khi module tương ứng được triển khai.',
      ]} />
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
        <div style={{ gap: 4 }}>
          <label style={T.lbl}>Tháng</label>
          <input type="month" style={T.inp} value={mk} onChange={e => setMk(e.target.value)} />
        </div>
        <button type="button" onClick={load} disabled={loading} style={{ ...T.btn, opacity: loading ? 0.6 : 1 }}>
          <Icon name="refresh-cw" size={15} color="#fff" />
          <span style={{ marginLeft: 8 }}>Tải lại</span>
        </button>
      </div>
      {err && <ErrBox msg={err} />}
      {data?.spi && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {Object.entries(data.spi).map(([key, ind]) => <SpiCard key={key} indicator={ind} />)}
        </div>
      )}
      {!data && !loading && !err && (
        <Empty icon="activity" text="Đang tải dữ liệu SPI…" />
      )}
    </div>
  );
}

// ─── FatigueReportTab (Phase D4) ─────────────────────────────────────────────

function FactorGroup({ title, options, selected, onChange }) {
  const toggle = (opt) => {
    const next = new Set(selected);
    next.has(opt) ? next.delete(opt) : next.add(opt);
    onChange(next);
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{title}</div>
      {options.map(opt => (
        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8,
                                  padding: '5px 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={selected.has(opt)} onChange={() => toggle(opt)} />
          <span style={{ fontSize: 13 }}>{opt}</span>
        </label>
      ))}
    </div>
  );
}

function FatigueReportTab({ currentUser }) {
  const [view, setView] = useState('form');
  const isChief = currentUser?.isChief || ['ADMIN', 'superadmin', 'CHIEF'].includes(currentUser?.role);
  const isAdmin = ['ADMIN', 'superadmin'].includes(currentUser?.role);
  const [facility, setFacility] = useState('');
  const [shiftType, setShiftType] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd,   setShiftEnd]   = useState('');
  const [contact, setContact]       = useState('');
  const [fatigueOnset, setFatigueOnset] = useState('');
  const [kssScore, setKssScore]     = useState(null);
  const [sleepHours72, setSleepHours72] = useState('');
  const [sleepHours24, setSleepHours24] = useState('');
  const [sleepQuality, setSleepQuality] = useState('');
  const [impactDescription, setImpactDescription] = useState('');
  const [factorsSchedule, setFactorsSchedule]   = useState(new Set());
  const [factorsOperation, setFactorsOperation] = useState(new Set());
  const [factorsPersonal, setFactorsPersonal]   = useState(new Set());
  const [factorsOther, setFactorsOther]         = useState('');
  const [immediateAction, setImmediateAction]   = useState('');
  const [agreed, setAgreed]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const submit = async () => {
    if (!fatigueOnset || !kssScore || !impactDescription) {
      window.alert('Vui lòng điền các trường bắt buộc (Phần B).');
      return;
    }
    if (!agreed) { window.alert('Vui lòng xác nhận cam kết (Phần C).'); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/fatigue-reports', {
        facility: facility || null, shiftType: shiftType || null,
        shiftStart: shiftStart || null, shiftEnd: shiftEnd || null,
        contact: contact || null, fatigueOnset, kssScore,
        sleepHours72: sleepHours72 ? parseFloat(sleepHours72) : null,
        sleepHours24: sleepHours24 ? parseFloat(sleepHours24) : null,
        sleepQuality: sleepQuality || null, impactDescription,
        factorsSchedule: [...factorsSchedule], factorsOperation: [...factorsOperation],
        factorsPersonal: [...factorsPersonal], factorsOther: factorsOther || null,
        immediateAction: immediateAction || null,
      });
      setSubmitResult(data);
    } catch (e) {
      window.alert('Lỗi gửi báo cáo: ' + (e?.response?.data?.message ?? e.message));
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      {/* Just Culture disclaimer */}
      <div style={{ padding: 16, backgroundColor: '#f0f9ff', border: '1px solid #bae6fd',
                    borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0c4a6e', marginBottom: 6 }}>
          Báo cáo mệt mỏi — Văn hóa An toàn Công bằng (Just Culture)
        </div>
        <div style={{ fontSize: 13, color: '#0c4a6e', lineHeight: 1.5 }}>
          Báo cáo mệt mỏi <strong>không phải là thừa nhận lỗi</strong>. Mục đích duy nhất: nhận diện và kiểm soát rủi ro mệt mỏi (QĐ 2289 Chương VI mục I).
          Báo cáo <strong>không được sử dụng để xử lý kỷ luật</strong>, trừ trường hợp gian dối hoặc vi phạm "Ranh giới đỏ" (QĐ 2289 Chương VI mục VII).
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 12, flexWrap: 'wrap' }}>
        {[
          { id: 'form', label: 'Gửi báo cáo mới' },
          { id: 'mine', label: 'Lịch sử của tôi' },
          ...(isChief ? [{ id: 'forChief', label: 'Cần xử lý' }] : []),
          ...(isAdmin ? [{ id: 'summary', label: 'Tổng hợp ẩn danh' }] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            color: view === t.id ? '#fff' : '#475569',
            backgroundColor: view === t.id ? '#2563eb' : '#fff',
            border: '1px solid ' + (view === t.id ? '#2563eb' : '#e2e8f0'),
            borderRadius: 6,
          }}>{t.label}</button>
        ))}
      </div>

      {view === 'mine'     && <FatigueMineList />}
      {view === 'forChief' && isChief && <FatigueForChiefList />}
      {view === 'summary'  && isAdmin  && <FatigueSummary />}

      {view === 'form' && (submitResult ? (
        <div style={{ padding: 24, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
                      borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <h3 style={{ margin: 0, marginBottom: 8 }}>Báo cáo đã được ghi nhận</h3>
          <div style={{ color: '#15803d', marginBottom: 12 }}>
            Mã ẩn danh: <strong style={{ fontFamily: 'Courier New', fontSize: 18 }}>
              {submitResult.anonCode}
            </strong>
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
            Kíp trưởng đã được thông báo. Tra cứu qua mã ẩn danh ở "Lịch sử của tôi".
          </div>
          <button onClick={() => { setSubmitResult(null); setFatigueOnset(''); setKssScore(null);
                                    setImpactDescription(''); setAgreed(false); }}
                  style={T.btn}>Tạo báo cáo mới</button>
        </div>
      ) : (
        <>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 0 }}>Phần A — Thông tin chung (tùy chọn)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={T.lbl}>Cơ sở / Vị trí</label>
              <input type="text" style={T.inp} value={facility} onChange={e => setFacility(e.target.value)} placeholder="VD: Đà Nẵng APP" />
            </div>
            <div>
              <label style={T.lbl}>Loại ca</label>
              <select style={T.inp} value={shiftType} onChange={e => setShiftType(e.target.value)}>
                <option value="">Chọn…</option>
                <option value="DAY">Ca ngày</option>
                <option value="NIGHT">Ca đêm</option>
                <option value="ONCALL">On-call</option>
              </select>
            </div>
            <div>
              <label style={T.lbl}>Giờ bắt đầu ca</label>
              <input type="datetime-local" style={T.inp} value={shiftStart} onChange={e => setShiftStart(e.target.value)} />
            </div>
            <div>
              <label style={T.lbl}>Giờ kết thúc ca</label>
              <input type="datetime-local" style={T.inp} value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={T.lbl}>Thông tin liên hệ (tùy chọn)</label>
            <input type="text" style={{ ...T.inp, width: '100%' }} value={contact}
                   onChange={e => setContact(e.target.value)} placeholder="Email hoặc số điện thoại (không bắt buộc)" />
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Phần B — Tình trạng mệt mỏi (bắt buộc) <span style={{ color: '#dc2626' }}>*</span></h3>

          <div style={{ marginBottom: 16 }}>
            <label style={T.lbl}>Thời điểm xuất hiện mệt mỏi <span style={{ color: '#dc2626' }}>*</span></label>
            <input type="text" style={{ ...T.inp, width: '100%' }}
                   placeholder="Ghi cụ thể thời gian và số giờ đã thức tính đến thời điểm đó"
                   value={fatigueOnset} onChange={e => setFatigueOnset(e.target.value)} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={T.lbl}>Mức độ mệt mỏi — Thang KSS <span style={{ color: '#dc2626' }}>*</span></label>
            <KssScale value={kssScore} onChange={setKssScore} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
            <div>
              <label style={T.lbl}>Giờ ngủ 72h qua</label>
              <input type="number" step="0.5" min="0" max="72" style={T.inp}
                     placeholder="Số giờ" value={sleepHours72} onChange={e => setSleepHours72(e.target.value)} />
            </div>
            <div>
              <label style={T.lbl}>Giờ ngủ 24h qua</label>
              <input type="number" step="0.5" min="0" max="24" style={T.inp}
                     placeholder="Số giờ" value={sleepHours24} onChange={e => setSleepHours24(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={T.lbl}>Chất lượng giấc ngủ gần nhất</label>
            <select style={T.inp} value={sleepQuality} onChange={e => setSleepQuality(e.target.value)}>
              <option value="">Chọn…</option>
              <option value="good">Tốt</option>
              <option value="fair">Trung bình</option>
              <option value="poor">Kém</option>
              <option value="very_poor">Rất kém</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={T.lbl}>Mô tả ảnh hưởng đến hiệu suất <span style={{ color: '#dc2626' }}>*</span></label>
            <textarea rows={3} style={{ ...T.inp, width: '100%' }}
                      value={impactDescription} onChange={e => setImpactDescription(e.target.value)} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={T.lbl}>Các yếu tố góp phần</label>
            <FactorGroup title="Lịch làm việc"
              options={['Nhiều kíp đêm liên tiếp', 'Chuyển đổi ca nhanh', 'Thời gian nghỉ không đủ', 'Làm thêm giờ/thay đổi đột xuất']}
              selected={factorsSchedule} onChange={setFactorsSchedule} />
            <FactorGroup title="Khai thác"
              options={['Khối lượng công việc cao', 'Khối lượng công việc quá thấp/đơn điệu', 'Không đủ nghỉ giải lao']}
              selected={factorsOperation} onChange={setFactorsOperation} />
            <FactorGroup title="Cá nhân / Môi trường"
              options={['Chất lượng giấc ngủ kém (lý do cá nhân)', 'Môi trường làm việc']}
              selected={factorsPersonal} onChange={setFactorsPersonal} />
            <div style={{ marginTop: 6 }}>
              <label style={T.lbl}>Khác</label>
              <input type="text" style={{ ...T.inp, width: '100%' }}
                     value={factorsOther} onChange={e => setFactorsOther(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={T.lbl}>Hành động khắc phục tức thời</label>
            <textarea rows={2} style={{ ...T.inp, width: '100%' }}
                      placeholder="VD: Đã nghỉ 30 phút; Đổi vị trí; Được thay thế khỏi kíp trực"
                      value={immediateAction} onChange={e => setImmediateAction(e.target.value)} />
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Phần C — Cam kết</h3>
          <div style={{ padding: 14, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 10, fontSize: 13 }}>
            <strong>1. Cam kết của KSVKL:</strong> "Tôi cam kết tình trạng mệt mỏi này là thực tế và tôi đã tuân thủ đúng quy định về thời gian nghỉ ngơi, không làm việc riêng trước ca trực. Tôi chịu trách nhiệm trước Tổng công ty về tính trung thực của báo cáo này."
          </div>
          <div style={{ padding: 14, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            <strong>2. Cam kết của Tổng công ty:</strong> "Báo cáo này được sử dụng chỉ cho mục đích an toàn, tuân thủ nguyên tắc bảo mật, không trừng phạt và văn hóa an toàn công bằng theo FRMS của Tổng công ty."
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
            <span style={{ fontSize: 13 }}>Tôi xác nhận đã đọc và đồng ý với cam kết tại Phần C.</span>
          </label>

          <button onClick={submit} disabled={submitting || !agreed}
                  style={{ ...T.btn, opacity: (submitting || !agreed) ? 0.5 : 1 }}>
            {submitting ? <Spinner size={15} color="#fff" /> : <Icon name="send" size={15} color="#fff" />}
            <span style={{ marginLeft: 8 }}>{submitting ? 'Đang gửi…' : 'Gửi báo cáo'}</span>
          </button>
        </>
      ))}
    </div>
  );
}

// ─── Fatigue helper components (M1) ──────────────────────────────────────────

function FatigueMineList() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { const { data } = await api.get('/api/fatigue-reports/mine'); setReports(data); }
      catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, []);
  if (loading) return <Spinner size={32} color="#2563eb" />;
  if (!reports?.length) return <div style={{ color: '#64748b', padding: 16 }}>Bạn chưa gửi báo cáo mệt mỏi nào.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {reports.map(r => (
        <div key={r.id} style={{ padding: 14, backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong style={{ fontFamily: 'Courier New' }}>{r.anonCode}</strong>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
                           backgroundColor: _fatStatusBg(r.status), color: _fatStatusText(r.status) }}>
              {_fatStatusLabel(r.status)}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#475569' }}>
            KSS: <strong>{r.kssScore}</strong> · Cơ sở: {r.facility || '—'} ·
            Thời điểm: {new Date(r.createdAt).toLocaleString('vi-VN')}
          </div>
          {r.acknowledgedAt && (
            <div style={{ fontSize: 12, color: '#15803d', marginTop: 6 }}>
              ✓ Kíp trưởng đã xác nhận: {new Date(r.acknowledgedAt).toLocaleString('vi-VN')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FatigueForChiefList() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ackingId, setAckingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get('/api/fatigue-reports/for-chief'); setReports(data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleAck = async (id) => {
    setAckingId(id);
    try { await api.put(`/api/fatigue-reports/${id}/acknowledge`); await load(); }
    catch (e) { window.alert('Lỗi xác nhận: ' + (e?.response?.data?.message ?? e.message)); }
    finally { setAckingId(null); }
  };

  if (loading) return <Spinner size={32} color="#2563eb" />;
  if (!reports?.length) return <div style={{ color: '#64748b', padding: 16 }}>Không có báo cáo cần xử lý.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {reports.map(r => (
        <div key={r.id} style={{ padding: 14, backgroundColor: '#fff',
          border: '1px solid ' + (r.status === 'submitted' ? '#fcd34d' : '#e2e8f0'),
          borderLeft: '4px solid ' + (r.kssScore >= 7 ? '#dc2626' : '#fcd34d'), borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong style={{ fontFamily: 'Courier New' }}>{r.anonCode}</strong>
            <span style={{ fontSize: 13 }}>KSS = <strong style={{ color: r.kssScore >= 7 ? '#dc2626' : '#475569' }}>{r.kssScore}</strong></span>
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>
            <div>Cơ sở: <strong>{r.facility || '—'}</strong></div>
            <div>Thời điểm mệt: {r.fatigueOnset}</div>
            <div style={{ marginTop: 6 }}>{r.impactDescription}</div>
            {r.factorsSchedule?.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12 }}><strong>Yếu tố lịch:</strong> {r.factorsSchedule.join(', ')}</div>
            )}
            {r.immediateAction && (
              <div style={{ marginTop: 6, fontSize: 12, fontStyle: 'italic' }}>Hành động tức thời: {r.immediateAction}</div>
            )}
          </div>
          {r.status === 'submitted' && (
            <button onClick={() => handleAck(r.id)} disabled={ackingId === r.id}
                    style={{ padding: '6px 12px', backgroundColor: '#16a34a', color: '#fff',
                             border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
              {ackingId === r.id ? 'Đang xử lý…' : '✓ Tôi đã xem & ghi nhận'}
            </button>
          )}
          {r.status === 'acknowledged' && (
            <div style={{ fontSize: 12, color: '#15803d' }}>✓ Đã xác nhận lúc {new Date(r.acknowledgedAt).toLocaleString('vi-VN')}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function FatigueSummary() {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      const end   = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      try { const { data: arr } = await api.get(`/api/fatigue-reports/summary?start=${start}&end=${end}`); setData(arr); }
      catch (e) { console.error(e); }
    })();
  }, []);
  if (!data) return <Spinner size={32} color="#2563eb" />;
  const dist = {};
  for (let i = 1; i <= 9; i++) dist[i] = 0;
  data.forEach(r => { dist[r.kssScore] = (dist[r.kssScore] || 0) + 1; });
  const maxV = Math.max(1, ...Object.values(dist));
  return (
    <div>
      <div style={{ padding: 12, backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
        Tổng hợp ẩn danh — không hiển thị tên người báo cáo (QĐ 2289 Chương VI mục III).
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Tổng báo cáo (30 ngày)', value: data.length, color: '#2563eb', bg: '#eff6ff' },
          { label: 'KSS ≥ 7', value: data.filter(r => r.kssScore >= 7).length, color: '#dc2626', bg: '#fef2f2' },
          { label: 'Đã xử lý', value: data.filter(r => ['acknowledged','analyzed'].includes(r.status)).length, color: '#16a34a', bg: '#f0fdf4' },
        ].map(c => (
          <div key={c.label} style={{ padding: 16, borderRadius: 8, backgroundColor: c.bg, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>
      <h3 style={{ fontSize: 14, marginBottom: 12 }}>Phân bố điểm KSS</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 180, padding: 12, backgroundColor: '#f8fafc', borderRadius: 8 }}>
        {Object.entries(dist).map(([k, v]) => (
          <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 11, marginBottom: 4 }}>{v}</div>
            <div style={{ width: '100%', height: `${Math.max(2, (v / maxV) * 140)}px`,
                          backgroundColor: parseInt(k) >= 7 ? '#dc2626' : parseInt(k) >= 5 ? '#f97316' : '#16a34a',
                          borderRadius: '4px 4px 0 0' }} />
            <div style={{ fontSize: 11, marginTop: 4 }}>{k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function _fatStatusLabel(s) { return ({ submitted:'Đã gửi', acknowledged:'Đã xác nhận', analyzed:'Đã phân tích', closed:'Đã đóng' })[s] || s; }
function _fatStatusBg(s)    { return ({ submitted:'#fef3c7', acknowledged:'#dcfce7', analyzed:'#dbeafe', closed:'#f1f5f9' })[s] || '#f1f5f9'; }
function _fatStatusText(s)  { return ({ submitted:'#92400e', acknowledged:'#166534', analyzed:'#1e40af', closed:'#475569' })[s] || '#475569'; }

// ─── ShiftExchangeTab (Phase E4) ──────────────────────────────────────────────

function ShiftExchangeTab({ currentUser }) {
  const [view, setView] = useState('list');
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('EXCHANGE');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [appShiftDate, setAppShiftDate] = useState('');
  const [appShiftCode, setAppShiftCode] = useState('S');
  const [cpShiftDate, setCpShiftDate] = useState('');
  const [cpShiftCode, setCpShiftCode] = useState('S');
  const [committed, setCommitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [prechecking, setPrechecking] = useState(false);
  const [precheckResult, setPrecheckResult] = useState(null);
  const [approvalOpen, setApprovalOpen] = useState({});
  const [overrideReasons, setOverrideReasons] = useState({});
  const [approving, setApproving] = useState({});
  const [detailsOpen, setDetailsOpen] = useState({});
  const [rejectModalId, setRejectModalId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [agreeing, setAgreeing] = useState({});

  // Xác định biểu mẫu dựa trên position/role của currentUser
  const pos = (currentUser?.position || '').toLowerCase();
  const isChief = currentUser?.isChief || currentUser?.role === 'ADMIN' || currentUser?.role === 'superadmin';
  const facilityType = pos.includes('twr') && !pos.includes('app') ? 'TWR_ONLY' : 'ACC_APP_TWR';
  const formTypeLabel = isChief ? 'Vị trí trực Kíp trưởng' : facilityType === 'TWR_ONLY' ? 'KSVKL tại TWR' : 'KSVKL tại ACC/APP/TWR';

  const loadMine = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/shift-exchanges/mine');
      setExchanges(data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMine(); }, [loadMine]);

  const runPrecheck = async () => {
    if (!appShiftDate || !counterpartyId || !counterpartyName) {
      window.alert('Vui lòng điền đầy đủ thông tin trước khi kiểm tra điều kiện.');
      return;
    }
    if (type === 'EXCHANGE' && !cpShiftDate) {
      window.alert('Vui lòng chọn ngày ca hoàn trả cho yêu cầu Đổi ca.');
      return;
    }

    setPrechecking(true);
    setPrecheckResult(null);
    try {
      const { data } = await api.post('/api/shift-exchanges/precheck', {
        type,
        applicantShiftDate: appShiftDate,
        applicantShiftCode: appShiftCode,
        counterpartyId,
        counterpartyShiftDate: type === 'EXCHANGE' ? cpShiftDate : undefined,
        counterpartyShiftCode: type === 'EXCHANGE' ? cpShiftCode : undefined,
      });
      setPrecheckResult(data);
    } catch (e) {
      window.alert('Lỗi kiểm tra điều kiện: ' + (e?.response?.data?.message ?? e.message));
    } finally {
      setPrechecking(false);
    }
  };

  const toggleApproval = (id) => {
    setApprovalOpen(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleDetails = (id) => {
    setDetailsOpen(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApprove = async (ex) => {
    const reason = overrideReasons[ex.id] || '';
    if (!reason && ((ex.precheckResult?.warnings?.length ?? 0) > 0 || ex.precheckResult?.can_approve === false)) {
      window.alert('Yêu cầu phải có lý do ghi đè khi precheck có cảnh báo hoặc không thể approve.');
      return;
    }

    setApproving(prev => ({ ...prev, [ex.id]: true }));
    try {
      await api.put(`/api/shift-exchanges/${ex.id}/approve`, {
        override_reason: reason || undefined,
      });
      window.alert('Phê duyệt thành công.');
      setApprovalOpen(prev => ({ ...prev, [ex.id]: false }));
      loadMine();
    } catch (e) {
      window.alert('Lỗi phê duyệt: ' + (e?.response?.data?.message ?? e.message));
    } finally {
      setApproving(prev => ({ ...prev, [ex.id]: false }));
    }
  };

  const updateOverrideReason = (id, value) => {
    setOverrideReasons(prev => ({ ...prev, [id]: value }));
  };

  const handleAgree = async (id) => {
    if (!window.confirm('Bạn xác nhận đồng ý nhận đổi ca này?')) return;
    setAgreeing(prev => ({ ...prev, [id]: true }));
    try {
      await api.put(`/api/shift-exchanges/${id}/agree`);
      loadMine();
    } catch (e) {
      window.alert('Lỗi: ' + (e?.response?.data?.message ?? e.message));
    } finally { setAgreeing(prev => ({ ...prev, [id]: false })); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { window.alert('Vui lòng ghi lý do từ chối.'); return; }
    try {
      await api.put(`/api/shift-exchanges/${rejectModalId}/reject`, { reason: rejectReason });
      setRejectModalId(null); setRejectReason('');
      loadMine();
    } catch (e) {
      window.alert('Lỗi: ' + (e?.response?.data?.message ?? e.message));
    }
  };

  const submit = async () => {
    if (!appShiftDate || !counterpartyId || !counterpartyName) {
      window.alert('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    if (!committed) { window.alert('Vui lòng xác nhận cam kết.'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/shift-exchanges', {
        type, applicantShiftDate: appShiftDate, applicantShiftCode: appShiftCode,
        counterpartyId, counterpartyName,
        counterpartyShiftDate: type === 'EXCHANGE' ? cpShiftDate : null,
        counterpartyShiftCode: type === 'EXCHANGE' ? cpShiftCode : null,
        facilityType,
      });
      window.alert('Đã gửi yêu cầu. Người nhận sẽ được thông báo.');
      setView('list');
      loadMine();
    } catch (e) {
      window.alert('Lỗi: ' + (e?.response?.data?.message ?? e.message));
    } finally { setSubmitting(false); }
  };

  const STATUS_LABEL = {
    pending: 'Chờ xác nhận', counterparty_agreed: 'Đã đồng ý — Chờ kíp trưởng',
    chief_1_approved: 'KT 1 đã duyệt', chief_approved: 'Đã phê duyệt',
    rejected: 'Từ chối', cancelled: 'Đã hủy',
  };

  return (
    <div style={{ padding: 20, maxWidth: 800 }}>
      <HowTo steps={[
        'Tab này dành cho yêu cầu Đổi ca / Trực thay theo QĐ 2701 Phụ lục I.',
        'Đổi ca: 2 KSVKL hoán đổi — có hoàn trả. Trực thay: 1 người trực thay — không hoàn trả.',
        'Sau khi gửi, người nhận xác nhận, rồi kíp trưởng phê duyệt.',
      ]} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button type="button" style={{ ...T.btn, backgroundColor: view === 'list' ? '#2563eb' : '#64748b' }}
                onClick={() => setView('list')}>Danh sách</button>
        <button type="button" style={{ ...T.btn, backgroundColor: view === 'create' ? '#2563eb' : '#64748b' }}
                onClick={() => setView('create')}>+ Tạo yêu cầu mới</button>
      </div>

      {view === 'list' && (
        <div style={T.card}>
          {loading ? <div style={{ padding: 20 }}><Spinner size={24} color="#2563eb" /></div>
            : exchanges.length === 0
              ? <Empty icon="repeat" text="Chưa có yêu cầu đổi ca nào." />
              : exchanges.map((ex, i) => (
                <div key={ex.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b',
                                   backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>
                      {ex.type === 'EXCHANGE' ? 'Đổi ca' : 'Trực thay'}
                    </span>
                    <span style={{ flex: 1, fontSize: 13 }}>
                      {ex.applicantShiftDate} ca {ex.applicantShiftCode} ↔ {ex.counterpartyName}
                    </span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      {STATUS_LABEL[ex.status] || ex.status}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gap: 6, marginBottom: 6 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#475569' }}>
                        Precheck:{' '}
                        <strong style={{ color: ex.precheckResult?.can_approve === false ? '#991b1b' : ex.precheckResult?.can_approve ? '#166534' : '#475569' }}>
                          {ex.precheckResult?.can_approve === false ? 'Không cho phép' : ex.precheckResult?.can_approve ? 'Cho phép' : 'Chưa kiểm tra'}
                        </strong>
                      </span>
                      <span style={{ fontSize: 12, color: '#475569' }}>
                        Cảnh báo: {ex.precheckResult?.warnings?.length ?? 0}
                      </span>
                      <span style={{ fontSize: 12, color: '#475569' }}>
                        Vi phạm mới: {(ex.precheckResult?.new_violations_applicant?.length ?? 0) + (ex.precheckResult?.new_violations_counterparty?.length ?? 0)}
                      </span>
                      <button type="button" style={{ ...T.btn, backgroundColor: '#3b82f6' }} onClick={() => toggleDetails(ex.id)}>
                        {detailsOpen[ex.id] ? 'Ẩn chi tiết precheck' : 'Xem chi tiết precheck'}
                      </button>
                    </div>
                    {detailsOpen[ex.id] && ex.precheckResult && (
                      <PrecheckPanel result={ex.precheckResult} />
                    )}
                  </div>
                  {/* M2: Agree (counterparty) / Reject / Approve (chief) */}
                  {(() => {
                    const isCounterparty = ex.counterpartyId === currentUser?.id;
                    const isApplicant    = ex.applicantId    === currentUser?.id;
                    return (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                        {ex.status === 'pending' && isCounterparty && (
                          <button type="button" disabled={agreeing[ex.id]}
                                  style={{ ...T.btn, backgroundColor: '#16a34a', opacity: agreeing[ex.id] ? 0.6 : 1 }}
                                  onClick={() => handleAgree(ex.id)}>
                            {agreeing[ex.id] ? 'Đang xử lý…' : '✓ Đồng ý nhận đổi ca'}
                          </button>
                        )}
                        {['pending', 'counterparty_agreed', 'chief_1_approved'].includes(ex.status) &&
                         (isCounterparty || isChief || isApplicant) && (
                          <button type="button"
                                  style={{ ...T.btn, backgroundColor: '#dc2626' }}
                                  onClick={() => { setRejectModalId(ex.id); setRejectReason(''); }}>
                            ✗ Từ chối / Hủy
                          </button>
                        )}
                      </div>
                    );
                  })()}
                  {(isChief && ['counterparty_agreed', 'chief_1_approved'].includes(ex.status)) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <button type="button" style={{ ...T.btn, backgroundColor: '#2563eb' }}
                              onClick={() => toggleApproval(ex.id)}>
                        {approvalOpen[ex.id] ? 'Đóng phê duyệt' : '✓ Phê duyệt'}
                      </button>
                      {(ex.precheckResult?.warnings?.length ?? 0) > 0 && (
                        <span style={{ fontSize: 12, color: '#92400e' }}>⚠️ Có cảnh báo precheck</span>
                      )}
                    </div>
                  )}
                  {approvalOpen[ex.id] && (
                    <div style={{ display: 'grid', gap: 10, marginTop: 10, padding: 12, borderRadius: 10, backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}>
                      <textarea
                        rows={3}
                        style={{ width: '100%', ...T.inp }}
                        placeholder="Lý do phê duyệt (bắt buộc nếu có cảnh báo/precheck không approve)"
                        value={overrideReasons[ex.id] || ''}
                        onChange={e => updateOverrideReason(ex.id, e.target.value)}
                      />
                      <button type="button" onClick={() => handleApprove(ex)}
                              disabled={approving[ex.id]}
                              style={{ ...T.btn, backgroundColor: '#2563eb', opacity: approving[ex.id] ? 0.5 : 1 }}>
                        {approving[ex.id] ? 'Đang phê duyệt…' : 'Xác nhận phê duyệt'}
                      </button>
                    </div>
                  )}
                </div>
              ))
          }
        </div>
      )}

      {view === 'create' && (
        <div>
          <InfoBox msg={`Biểu mẫu áp dụng: ${formTypeLabel} (QĐ 2701 Phụ lục I)`} />
          <div style={{ marginBottom: 12 }}>
            <label style={T.lbl}>Loại</label>
            <select style={T.inp} value={type} onChange={e => setType(e.target.value)}>
              <option value="EXCHANGE">Đổi ca (có hoàn trả)</option>
              <option value="COVER">Trực thay (không hoàn trả)</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={T.lbl}>Ca của tôi cần đổi — Ngày</label>
              <input type="date" style={T.inp} value={appShiftDate} onChange={e => setAppShiftDate(e.target.value)} />
            </div>
            <div>
              <label style={T.lbl}>Ca</label>
              <select style={T.inp} value={appShiftCode} onChange={e => setAppShiftCode(e.target.value)}>
                <option value="S">Ca S (ngày)</option>
                <option value="D">Ca D (đêm)</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={T.lbl}>Người nhận — ID/Mã ICAO</label>
              <input type="text" style={T.inp} value={counterpartyId}
                     onChange={e => setCounterpartyId(e.target.value)} placeholder="Employee ID" />
            </div>
            <div>
              <label style={T.lbl}>Tên người nhận</label>
              <input type="text" style={T.inp} value={counterpartyName}
                     onChange={e => setCounterpartyName(e.target.value)} placeholder="Họ và tên" />
            </div>
          </div>
          {type === 'EXCHANGE' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={T.lbl}>Ca người nhận sẽ hoàn trả — Ngày</label>
                <input type="date" style={T.inp} value={cpShiftDate} onChange={e => setCpShiftDate(e.target.value)} />
              </div>
              <div>
                <label style={T.lbl}>Ca hoàn trả</label>
                <select style={T.inp} value={cpShiftCode} onChange={e => setCpShiftCode(e.target.value)}>
                  <option value="S">Ca S</option>
                  <option value="D">Ca D</option>
                </select>
              </div>
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
            <input type="checkbox" checked={committed} onChange={e => setCommitted(e.target.checked)} style={{ marginTop: 3 }} />
            <span style={{ fontSize: 13 }}>Cam kết việc đổi ca/trực thay đã đảm bảo đúng quy định về thời giờ làm việc, nghỉ ngơi (QĐ 2701 Điều 8.1.c).</span>
          </label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <button type="button" onClick={runPrecheck} disabled={prechecking}
                    style={{ ...T.btn, backgroundColor: '#2563eb', opacity: prechecking ? 0.5 : 1 }}>
              {prechecking ? 'Đang kiểm tra…' : '🔍 Kiểm tra điều kiện'}
            </button>
            <button onClick={submit} disabled={submitting || !committed}
                    style={{ ...T.btn, opacity: (submitting || !committed) ? 0.5 : 1 }}>
              {submitting ? <Spinner size={15} color="#fff" /> : <Icon name="send" size={15} color="#fff" />}
              <span style={{ marginLeft: 8 }}>Gửi yêu cầu</span>
            </button>
          </div>
          {precheckResult && <PrecheckPanel result={precheckResult} />}
        </div>
      )}

      {/* M2: Reject modal overlay */}
      {rejectModalId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: 12, padding: 24,
            width: 440, maxWidth: '92vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            display: 'grid', gap: 14,
          }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
              Từ chối / Hủy yêu cầu đổi ca
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Vui lòng ghi rõ lý do. Lý do này sẽ được lưu vào hồ sơ.
            </p>
            <textarea
              rows={4}
              style={{ ...T.inp, resize: 'vertical' }}
              placeholder="Nhập lý do từ chối / hủy..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button"
                      style={{ ...T.btn, backgroundColor: '#94a3b8' }}
                      onClick={() => { setRejectModalId(null); setRejectReason(''); }}>
                Huỷ bỏ
              </button>
              <button type="button"
                      style={{ ...T.btn, backgroundColor: '#dc2626' }}
                      onClick={handleReject}>
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ShiftBriefingTab (Phase F3) ──────────────────────────────────────────────

function ShiftBriefingTab({ currentUser }) {
  const [view, setView] = useState('list');
  const [briefings, setBriefings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    team: '', shiftDate: '', shiftCode: 'S', chairId: currentUser?.id ?? '',
    chairName: currentUser?.name ?? '', level: 'light',
    briefingContent: '', recommendations: '',
    hasSafetyEvent: false, safetyEventSummary: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadRecent = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/shift-briefings?days=30');
      setBriefings(data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  const save = async (asLevel) => {
    if (!formData.team || !formData.shiftDate) {
      window.alert('Vui lòng điền kíp và ngày ca.'); return;
    }
    setSubmitting(true);
    try {
      if (!formData.id) {
        const { data: created } = await api.post('/api/shift-briefings', {
          ...formData, level: asLevel,
        });
        setFormData(prev => ({ ...prev, id: created.id }));
      } else {
        await api.put(`/api/shift-briefings/${formData.id}`, { ...formData, level: asLevel });
      }
      window.alert(asLevel === 'formal' ? 'Đã lưu Báo cáo chính thức.' : 'Đã lưu ghi chép nội bộ.');
      loadRecent();
      setView('list');
    } catch (e) {
      window.alert('Lỗi: ' + (e?.response?.data?.message ?? e.message));
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <HowTo steps={[
        'Bình giảng sau ca: ghi nhận nội dung thảo luận sau mỗi kíp trực.',
        'Lưu ghi chép nhẹ: lưu nội bộ, không gửi đi. Báo cáo chính thức: gửi Giám đốc + 2 Phòng.',
        'Khi có sự kiện an toàn, tích "Có sự kiện an toàn" và mô tả chi tiết.',
      ]} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button type="button" style={{ ...T.btn, backgroundColor: view === 'list' ? '#2563eb' : '#64748b' }}
                onClick={() => setView('list')}>Danh sách gần đây</button>
        <button type="button" style={{ ...T.btn, backgroundColor: view === 'create' ? '#2563eb' : '#64748b' }}
                onClick={() => { setFormData({ team: '', shiftDate: '', shiftCode: 'S',
                                              chairId: currentUser?.id ?? '', chairName: currentUser?.name ?? '',
                                              level: 'light', briefingContent: '', recommendations: '',
                                              hasSafetyEvent: false, safetyEventSummary: '' }); setView('create'); }}>
          + Tạo bình giảng mới
        </button>
      </div>

      {view === 'list' && (
        <div style={T.card}>
          {loading ? <div style={{ padding: 20 }}><Spinner size={24} color="#2563eb" /></div>
            : briefings.length === 0
              ? <Empty icon="file-text" text="Chưa có bình giảng nào trong 30 ngày gần đây." />
              : briefings.map(br => (
                <div key={br.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                                          display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                 backgroundColor: br.level === 'formal' ? '#fef2f2' : '#f1f5f9',
                                 color: br.level === 'formal' ? '#dc2626' : '#64748b' }}>
                    {br.level === 'formal' ? 'Chính thức' : 'Nội bộ'}
                  </span>
                  <span style={{ fontSize: 13, flex: 1 }}>Kíp {br.team} — {br.shiftDate} ca {br.shiftCode}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {br.hasSafetyEvent && '⚠️ Sự kiện an toàn'}
                  </span>
                </div>
              ))
          }
        </div>
      )}

      {view === 'create' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={T.lbl}>Kíp trực</label>
              <input type="text" style={T.inp} value={formData.team}
                     onChange={e => setFormData(p => ({ ...p, team: e.target.value }))} placeholder="A / B / C / D" />
            </div>
            <div>
              <label style={T.lbl}>Ngày</label>
              <input type="date" style={T.inp} value={formData.shiftDate}
                     onChange={e => setFormData(p => ({ ...p, shiftDate: e.target.value }))} />
            </div>
            <div>
              <label style={T.lbl}>Ca</label>
              <select style={T.inp} value={formData.shiftCode}
                      onChange={e => setFormData(p => ({ ...p, shiftCode: e.target.value }))}>
                <option value="S">Ca S</option>
                <option value="D">Ca D</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={T.lbl}>Nội dung bình giảng</label>
            <textarea rows={5} style={{ ...T.inp, width: '100%' }}
                      placeholder="Ghi nội dung thảo luận, nhận xét về ca trực…"
                      value={formData.briefingContent}
                      onChange={e => setFormData(p => ({ ...p, briefingContent: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={T.lbl}>Ý kiến đề xuất, kiến nghị</label>
            <textarea rows={2} style={{ ...T.inp, width: '100%' }}
                      value={formData.recommendations}
                      onChange={e => setFormData(p => ({ ...p, recommendations: e.target.value }))} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={formData.hasSafetyEvent}
                   onChange={e => setFormData(p => ({ ...p, hasSafetyEvent: e.target.checked }))} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Có sự kiện liên quan an toàn bay</span>
          </label>
          {formData.hasSafetyEvent && (
            <div style={{ marginBottom: 16 }}>
              <label style={T.lbl}>Mô tả sự kiện an toàn</label>
              <textarea rows={3} style={{ ...T.inp, width: '100%' }}
                        value={formData.safetyEventSummary}
                        onChange={e => setFormData(p => ({ ...p, safetyEventSummary: e.target.value }))} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => save('light')} disabled={submitting}
                    style={{ ...T.btn, backgroundColor: '#475569', opacity: submitting ? 0.6 : 1 }}>
              <Icon name="save" size={15} color="#fff" />
              <span style={{ marginLeft: 8 }}>Lưu ghi chép nội bộ</span>
            </button>
            {formData.hasSafetyEvent && (
              <button onClick={() => save('formal')} disabled={submitting}
                      style={{ ...T.btn, backgroundColor: '#dc2626', opacity: submitting ? 0.6 : 1 }}>
                <Icon name="file-text" size={15} color="#fff" />
                <span style={{ marginLeft: 8 }}>Tạo Báo cáo chính thức</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WestHandoverTab (V2 Mục 5.5) ────────────────────────────────────────────

const WEST_FIELDS = [
  { key: 'weather',   label: 'W — Weather (Thời tiết)',      placeholder: 'Tình hình thời tiết, diễn biến dự báo…' },
  { key: 'equipment', label: 'E — Equipment (Thiết bị)',     placeholder: 'Trạng thái hệ thống radar, ADS-B, sóng vô tuyến, đài dẫn đường…' },
  { key: 'situation', label: 'S — Situation (Tình huống)',   placeholder: 'Khu vực quân sự, chuyến bay đặc biệt, NOTAM/SNOWTAM, VIP…' },
  { key: 'traffic',   label: 'T — Traffic (Tình trạng bay)', placeholder: 'Lưu lượng hiện tại, xu hướng, huấn lệnh đã cấp, đường CHC đang sử dụng…' },
];

function WestHandoverTab({ currentUser }) {
  const [team, setTeam] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shiftCode, setShiftCode] = useState('S');
  const [handover, setHandover] = useState(null);
  const [fields, setFields] = useState({ weather: '', equipment: '', situation: '', traffic: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadOrCreate = async () => {
    if (!team) { window.alert('Vui lòng nhập tên kíp.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/api/shift-handovers', { team, handoverDate: date, shiftCode });
      setHandover(data);
      setFields({ weather: data.weather || '', equipment: data.equipment || '',
                  situation: data.situation || '', traffic: data.traffic || '' });
    } catch (e) {
      window.alert('Lỗi: ' + (e?.response?.data?.message ?? e.message));
    } finally { setLoading(false); }
  };

  const save = async () => {
    if (!handover) return;
    setSaving(true);
    try {
      await api.put(`/api/shift-handovers/${handover.id}`, fields);
      window.alert('Đã lưu nội dung giao ca.');
    } catch (e) {
      window.alert('Lỗi: ' + (e?.response?.data?.message ?? e.message));
    } finally { setSaving(false); }
  };

  const signOutgoing = async () => {
    if (!handover) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/api/shift-handovers/${handover.id}/sign-outgoing`);
      setHandover(data);
      window.alert('Đã ký xác nhận (kíp giao). Chờ kíp nhận xác nhận.');
    } catch (e) {
      window.alert('Lỗi: ' + (e?.response?.data?.message ?? e.message));
    } finally { setSaving(false); }
  };

  const signIncoming = async () => {
    if (!handover) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/api/shift-handovers/${handover.id}/sign-incoming`);
      setHandover(data);
      window.alert('Giao nhận ca hoàn tất. Biên bản đã được ghi nhận.');
    } catch (e) {
      window.alert('Lỗi: ' + (e?.response?.data?.message ?? e.message));
    } finally { setSaving(false); }
  };

  const isSigned = handover?.status === 'both_signed';

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <HowTo steps={[
        'Mô hình WEST (Weather-Equipment-Situation-Traffic) — QĐ 2701 Điều 10-12.',
        'Kíp giao điền 4 trường trước ca kết thúc, nhấn "Lưu nội dung".',
        'Sau cuộc họp giao ca, kíp giao nhấn "Ký xác nhận (Kíp giao)".',
        'Kíp nhận xác nhận hiểu rõ → nhấn "Ký xác nhận (Kíp nhận)". Biên bản hoàn tất.',
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12,
                    alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <label style={T.lbl}>Kíp</label>
          <input type="text" style={T.inp} value={team} onChange={e => setTeam(e.target.value)}
                 placeholder="A / B / C / D" />
        </div>
        <div>
          <label style={T.lbl}>Ngày giao ca</label>
          <input type="date" style={T.inp} value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label style={T.lbl}>Ca</label>
          <select style={T.inp} value={shiftCode} onChange={e => setShiftCode(e.target.value)}>
            <option value="S">Ca S (ngày)</option>
            <option value="D">Ca D (đêm)</option>
          </select>
        </div>
        <button type="button" style={{ ...T.btn, opacity: loading ? 0.6 : 1 }}
                onClick={loadOrCreate} disabled={loading}>
          {loading ? <Spinner size={15} color="#fff" /> : <Icon name="arrow-right" size={15} color="#fff" />}
          <span style={{ marginLeft: 8 }}>Mở biểu mẫu</span>
        </button>
      </div>

      {handover && (
        <>
          {isSigned && (
            <div style={{ padding: 12, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
                          borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#15803d', fontWeight: 700 }}>
              ✓ Giao nhận ca hoàn tất — Hai bên đã ký xác nhận.
            </div>
          )}
          {WEST_FIELDS.map(f => (
            <div key={f.key} style={{ marginBottom: 16 }}>
              <label style={{ ...T.lbl, fontSize: 12 }}>{f.label}</label>
              <textarea rows={3} style={{ ...T.inp, width: '100%' }}
                        placeholder={f.placeholder}
                        value={fields[f.key]}
                        onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                        disabled={isSigned} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={save} disabled={saving || isSigned}
                    style={{ ...T.btn, backgroundColor: '#475569', opacity: (saving || isSigned) ? 0.5 : 1 }}>
              <Icon name="save" size={15} color="#fff" />
              <span style={{ marginLeft: 8 }}>Lưu nội dung</span>
            </button>
            {handover.status === 'draft' && (
              <button onClick={signOutgoing} disabled={saving}
                      style={{ ...T.btn, backgroundColor: '#d97706', opacity: saving ? 0.5 : 1 }}>
                <Icon name="pen-tool" size={15} color="#fff" />
                <span style={{ marginLeft: 8 }}>Ký xác nhận (Kíp giao)</span>
              </button>
            )}
            {handover.status === 'outgoing_signed' && (
              <button onClick={signIncoming} disabled={saving}
                      style={{ ...T.btn, backgroundColor: '#16a34a', opacity: saving ? 0.5 : 1 }}>
                <Icon name="check-circle" size={15} color="#fff" />
                <span style={{ marginLeft: 8 }}>Ký xác nhận (Kíp nhận)</span>
              </button>
            )}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
            Trạng thái: {
              handover.status === 'draft' ? 'Bản nháp'
              : handover.status === 'outgoing_signed' ? 'Kíp giao đã ký — chờ kíp nhận'
              : 'Hai bên đã ký — Hoàn tất'
            }
          </div>
        </>
      )}

      {!handover && !loading && (
        <Empty icon="arrow-right-circle" text="Nhập tên kíp, ngày và nhấn 'Mở biểu mẫu' để bắt đầu giao ca." />
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

export default function AnalyticsScreen({ employees = [], currentUser }) {
  const [groupId, setGroupId] = useState('analysis');
  const [tab, setTab] = useState('compliance');

  const currentGroup = TAB_GROUPS.find(g => g.id === groupId) ?? TAB_GROUPS[0];
  const activeTab    = TABS.find(t => t.id === tab);

  const switchGroup = (gid) => {
    const g = TAB_GROUPS.find(x => x.id === gid);
    if (!g) return;
    setGroupId(gid);
    setTab(g.tabs[0].id);
  };

  return (
    <div style={{ flex: 1, backgroundColor: '#f1f5f9', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ backgroundColor: '#fff', padding: '14px 24px',
                    borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <div style={{ backgroundColor: '#0f172a', padding: 10, borderRadius: 10 }}>
            <Icon name="activity" size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1e293b' }}>Báo cáo & Phân tích ATQK</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{activeTab?.desc}</div>
          </div>
        </div>
      </div>

      {/* Group tab bar */}
      <div style={{ backgroundColor: '#fff', display: 'flex', flexWrap: 'wrap', borderBottom: '2px solid #e2e8f0', flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {TAB_GROUPS.map(g => {
          const active = groupId === g.id;
          return (
            <button key={g.id} type="button" onClick={() => switchGroup(g.id)} style={{
              padding: '12px 24px', fontSize: 14, fontWeight: 700, border: 'none',
              color: active ? '#1e293b' : '#64748b',
              backgroundColor: active ? '#fff' : 'transparent',
              borderBottom: active ? '3px solid #2563eb' : '3px solid transparent',
              marginBottom: -2, cursor: 'pointer',
            }}>
              {g.label}
            </button>
          );
        })}
      </div>

      {/* Sub-tab bar */}
      <div style={{ backgroundColor: '#f8fafc', display: 'flex', flexWrap: 'wrap', gap: 6,
                    padding: '8px 12px', borderBottom: '1px solid #e2e8f0', flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {currentGroup.tabs.map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{
              display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6,
              padding: '7px 14px', fontSize: 13, fontWeight: 600,
              color: on ? '#fff' : '#475569',
              backgroundColor: on ? '#2563eb' : '#fff',
              border: `1px solid ${on ? '#2563eb' : '#e2e8f0'}`,
              borderRadius: 8, cursor: 'pointer',
            }}>
              <Icon name={t.icon} size={13} color={on ? '#fff' : '#475569'} />
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
        {tab === 'spi'            && <SpiDashboardTab />}
        {tab === 'checklist'      && <ChecklistTab />}
        {tab === 'fatigue'        && <FatigueReportTab currentUser={currentUser} />}
        {tab === 'exchange'       && <ShiftExchangeTab currentUser={currentUser} />}
        {tab === 'briefing'       && <ShiftBriefingTab currentUser={currentUser} />}
        {tab === 'handover'       && <WestHandoverTab currentUser={currentUser} />}
      </div>
    </div>
  );
}
