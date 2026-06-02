import React from 'react';

const STATUS_LABEL = {
  pass: { text: 'Đạt',       color: '#15803d', bg: '#dcfce7' },
  fail: { text: 'Không đạt', color: '#dc2626', bg: '#fef2f2' },
  na:   { text: 'N/A',       color: '#64748b', bg: '#f1f5f9' },
};

const thStyle = {
  textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700,
  color: '#475569', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f1f5f9',
};
const tdStyle = {
  padding: '8px 12px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top',
  fontSize: 13,
};

export default function ChecklistViewer({ data, onPrint }) {
  if (!data) return null;
  const { header, summary, sections } = data;

  const overallLabel = summary?.overall_status === 'pass' ? 'ĐẠT'
    : summary?.overall_status === 'fail' ? 'KHÔNG ĐẠT' : 'CẦN RÀ SOÁT';
  const overallColor = summary?.overall_status === 'pass' ? '#15803d'
    : summary?.overall_status === 'fail' ? '#dc2626' : '#d97706';

  const ri = header?.roster_info || {};
  const handlePrint = onPrint || (() => window.print());

  return (
    <div className="checklist-viewer" style={{ backgroundColor: '#fff', padding: 24, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>CHECK LIST ĐÁNH GIÁ LỊCH TRỰC</h1>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          (Roster Assessment — {header?.source})
        </div>
        {(ri.team || ri.shift_date || ri.shift_code || ri.period) && (
          <div style={{ fontSize: 13, marginTop: 12 }}>
            {ri.team       && <span>Kíp: <strong>{ri.team}</strong> · </span>}
            {ri.shift_date && <span>Ngày: <strong>{ri.shift_date}</strong> · </span>}
            {ri.shift_code && <span>Ca: <strong>{ri.shift_code}</strong></span>}
            {ri.period     && <span>Chu kỳ: <strong>{ri.period}</strong></span>}
          </div>
        )}
      </div>

      {/* Summary */}
      <div style={{
        display: 'flex', gap: 20, marginBottom: 24,
        padding: 16, backgroundColor: '#f8fafc', borderRadius: 8, alignItems: 'center',
      }}>
        <span><strong>{summary?.total_items}</strong> tiêu chí</span>
        <span style={{ color: '#15803d' }}><strong>{summary?.pass_count}</strong> Đạt</span>
        <span style={{ color: '#dc2626' }}><strong>{summary?.fail_count}</strong> Không đạt</span>
        <span style={{ color: '#64748b' }}><strong>{summary?.na_count}</strong> N/A</span>
        <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 15, color: overallColor }}>
          KẾT QUẢ: {overallLabel}
        </span>
      </div>

      {/* Sections */}
      {(sections || []).map(section => (
        <div key={section.code} style={{ marginBottom: 24 }}>
          <h2 style={{
            fontSize: 15, fontWeight: 700, marginBottom: 8,
            padding: '8px 12px', backgroundColor: '#e2e8f0', borderRadius: 6,
          }}>
            {section.code}. {section.title}
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 60 }}>STT</th>
                <th style={thStyle}>Tiêu chí</th>
                <th style={{ ...thStyle, width: 130 }}>Yêu cầu</th>
                <th style={{ ...thStyle, width: 100 }}>Kết quả</th>
                <th style={thStyle}>Nhận xét</th>
              </tr>
            </thead>
            <tbody>
              {(section.items || []).map(item => {
                const st = STATUS_LABEL[item.status] || STATUS_LABEL.na;
                return (
                  <tr key={item.code}>
                    <td style={tdStyle}><strong>{item.code}</strong></td>
                    <td style={tdStyle}>{item.criterion}</td>
                    <td style={tdStyle}>{item.requirement}</td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                        fontWeight: 600, fontSize: 12,
                        color: st.color, backgroundColor: st.bg,
                      }}>
                        {st.text}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: '#475569' }}>{item.note || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Footer */}
      {header?.generated_at && (
        <div style={{ marginTop: 28, paddingTop: 14, borderTop: '1px solid #e2e8f0',
                      fontSize: 11, color: '#94a3b8' }}>
          Sinh tự động {new Date(header.generated_at).toLocaleString('vi-VN')}.
          Căn cứ: {header.source}. Hiệu lực từ {header.effective_from}.
          Quyết định cuối thuộc kíp trưởng/cán bộ cơ sở (QĐ 2288 Điều 5.1).
        </div>
      )}

      {/* Print button */}
      <div className="no-print" style={{ marginTop: 20, textAlign: 'right' }}>
        <button onClick={handlePrint} style={{
          padding: '10px 20px', backgroundColor: '#2563eb', color: '#fff',
          border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
        }}>
          In / Xuất PDF
        </button>
      </div>

      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </div>
  );
}
