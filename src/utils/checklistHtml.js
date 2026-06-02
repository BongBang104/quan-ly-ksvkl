/**
 * renderChecklistHtml — render checklist QĐ 2288 Phụ lục I thành HTML tĩnh cho cửa sổ in.
 * @param {object} data — kết quả từ /checklist endpoint
 * @returns {string} HTML string
 */
export function renderChecklistHtml(data) {
  if (!data) return '<p>Không có dữ liệu</p>';
  const { header, summary, sections } = data;

  const statusLabel = { pass: 'Đạt', fail: 'Không đạt', na: 'N/A' };
  const statusStyle = {
    pass: 'color:#15803d;background:#dcfce7;border:1px solid #bbf7d0',
    fail: 'color:#dc2626;background:#fef2f2;border:1px solid #fecaca',
    na:   'color:#64748b;background:#f1f5f9;border:1px solid #e2e8f0',
  };

  const sectionsHtml = (sections || []).map(sec => `
    <h2 style="font-size:14px;font-weight:700;margin:20px 0 8px;padding:7px 10px;
               background:#e2e8f0;border-radius:4px">${sec.code}. ${sec.title}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="width:50px;padding:6px 8px;border:1px solid #e2e8f0;text-align:left">STT</th>
          <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left">Tiêu chí</th>
          <th style="width:120px;padding:6px 8px;border:1px solid #e2e8f0;text-align:left">Yêu cầu</th>
          <th style="width:90px;padding:6px 8px;border:1px solid #e2e8f0;text-align:center">Kết quả</th>
          <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left">Nhận xét</th>
        </tr>
      </thead>
      <tbody>
        ${(sec.items || []).map(it => `
          <tr>
            <td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:700">${it.code}</td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0">${it.criterion}</td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0">${it.requirement}</td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center">
              <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-weight:600;font-size:11px;
                           ${statusStyle[it.status] || statusStyle.na}">
                ${statusLabel[it.status] || it.status}
              </span>
            </td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px;color:#475569">
              ${it.note || '—'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `).join('');

  const ri = header?.roster_info || {};
  const metaStr = [
    ri.team        && `Kíp: <strong>${ri.team}</strong>`,
    ri.shift_date  && `Ngày: <strong>${ri.shift_date}</strong>`,
    ri.shift_code  && `Ca: <strong>${ri.shift_code}</strong>`,
    ri.period      && `Chu kỳ: <strong>${ri.period}</strong>`,
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  const overallLabel = summary?.overall_status === 'pass' ? 'ĐẠT'
    : summary?.overall_status === 'fail' ? 'KHÔNG ĐẠT' : 'CẦN RÀ SOÁT';
  const overallColor = summary?.overall_status === 'pass' ? '#15803d'
    : summary?.overall_status === 'fail' ? '#dc2626' : '#d97706';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<title>Checklist QĐ 2288 Phụ lục I</title>
<style>
  body{font-family:'Times New Roman',serif;margin:24px;color:#1e293b}
  @media print{.no-print{display:none!important}body{margin:12px}}
</style>
</head>
<body>
  <div style="text-align:center;margin-bottom:24px">
    <h1 style="font-size:17px;font-weight:800;margin:0">CHECK LIST ĐÁNH GIÁ LỊCH TRỰC</h1>
    <div style="font-size:12px;color:#64748b;margin-top:4px">(Roster Assessment — ${header?.source || 'QĐ 2288/QĐ-QLB Phụ lục I'})</div>
    ${metaStr ? `<div style="font-size:13px;margin-top:10px">${metaStr}</div>` : ''}
  </div>

  <div style="display:flex;gap:20px;margin-bottom:20px;padding:12px 16px;
              background:#f8fafc;border-radius:6px;font-size:13px">
    <span><strong>${summary?.total_items || 0}</strong> tiêu chí</span>
    <span style="color:#15803d"><strong>${summary?.pass_count || 0}</strong> Đạt</span>
    <span style="color:#dc2626"><strong>${summary?.fail_count || 0}</strong> Không đạt</span>
    <span style="color:#64748b"><strong>${summary?.na_count || 0}</strong> N/A</span>
    <span style="margin-left:auto;font-weight:700;color:${overallColor}">KẾT QUẢ: ${overallLabel}</span>
  </div>

  ${sectionsHtml}

  <div style="margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;
              font-size:10px;color:#94a3b8">
    Sinh tự động ${new Date().toLocaleString('vi-VN')}.
    Căn cứ: ${header?.source || ''}. Hiệu lực từ ${header?.effective_from || ''}.
    Quyết định cuối thuộc kíp trưởng/cán bộ cơ sở (QĐ 2288 Điều 5.1).
  </div>

  <div class="no-print" style="margin-top:20px;text-align:right">
    <button onclick="window.print()"
            style="padding:10px 20px;background:#2563eb;color:#fff;
                   border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px">
      In / Xuất PDF
    </button>
  </div>
</body>
</html>`;
}
