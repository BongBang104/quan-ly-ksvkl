import React from 'react';
import Icon from './Icon.jsx';

const SEV_STYLE = {
  CRITICAL:    { bg: '#fef2f2', border: '#fecaca', dot: '#dc2626', text: '#dc2626' },
  WARNING:     { bg: '#fffbeb', border: '#fde68a', dot: '#d97706', text: '#d97706' },
  INFO:        { bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6', text: '#3b82f6' },
  Nghiêm_trọng: { bg: '#fef2f2', border: '#fecaca', dot: '#dc2626', text: '#dc2626' },
  Cảnh_báo:   { bg: '#fffbeb', border: '#fde68a', dot: '#d97706', text: '#d97706' },
  Lưu_ý:      { bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6', text: '#3b82f6' },
};
const SEV_LABEL = {
  CRITICAL: 'Nghiêm trọng', WARNING: 'Cảnh báo', INFO: 'Lưu ý',
};

function ViolationRow({ v }) {
  const key = v.severity?.replace(/\s/g, '_');
  const s = SEV_STYLE[v.severity] || SEV_STYLE[key] || SEV_STYLE.INFO;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '10px 14px', borderBottom: '1px solid #f1f5f9',
      borderLeft: `4px solid ${s.dot}`,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, flexShrink: 0,
        marginTop: 2,
        backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}`,
      }}>
        {SEV_LABEL[v.severity] || v.severity}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>
          {v.controller_name || v.controller_id}
        </div>
        <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45 }}>{v.message}</div>
        {v.legal_basis && (
          <span style={{
            display: 'inline-block', marginTop: 5,
            fontSize: 10, fontWeight: 600, color: '#64748b',
            backgroundColor: '#f1f5f9', padding: '1px 7px',
            borderRadius: 3, border: '1px solid #e2e8f0',
          }}>
            {v.legal_basis}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * ReviewResultPanel — hiển thị kết quả rà soát từ analytics.
 * Props: result (DraftReviewResult từ /review-roster-draft)
 */
export default function ReviewResultPanel({ result, style }) {
  if (!result) return null;
  const { can_publish, violations = [], unknown_abbreviations = [] } = result;
  const critical = violations.filter(v => v.severity === 'CRITICAL' || v.severity === 'Nghiêm trọng');
  const warnings = violations.filter(v => v.severity === 'WARNING'  || v.severity === 'Cảnh báo');

  return (
    <div style={{
      border: `1px solid ${can_publish ? '#bbf7d0' : '#fecaca'}`,
      borderRadius: 8, overflow: 'hidden', marginTop: 12,
      backgroundColor: can_publish ? '#f0fdf4' : '#fef2f2',
      ...style,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderBottom: '1px solid #e2e8f0',
        backgroundColor: can_publish ? '#dcfce7' : '#fee2e2',
      }}>
        <Icon name={can_publish ? 'check-circle' : 'alert-circle'} size={16}
              color={can_publish ? '#16a34a' : '#dc2626'} />
        <span style={{ fontSize: 13, fontWeight: 700,
                       color: can_publish ? '#15803d' : '#dc2626' }}>
          {can_publish
            ? `Có thể phát hành — ${violations.length} vi phạm nhỏ`
            : `Không thể phát hành — ${critical.length} vi phạm nghiêm trọng`}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>
          Công cụ hỗ trợ — quyết định cuối thuộc kíp trưởng (QĐ 2288 Điều 5.1)
        </span>
      </div>

      {/* Unknown abbreviations warning */}
      {unknown_abbreviations.length > 0 && (
        <div style={{
          padding: '8px 14px', backgroundColor: '#fffbeb',
          borderBottom: '1px solid #fde68a', fontSize: 12, color: '#92400e',
        }}>
          Ký hiệu chưa nhận ra (có thể là OJTI/nhân sự hỗ trợ ngoài kíp):&nbsp;
          <strong>{unknown_abbreviations.join(', ')}</strong>
        </div>
      )}

      {/* Violations */}
      {violations.length === 0 ? (
        <div style={{ padding: '12px 14px', fontSize: 12, color: '#15803d' }}>
          Không phát hiện vi phạm quy định trong bảng phân vị trí này.
        </div>
      ) : (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {critical.map((v, i) => <ViolationRow key={`c${i}`} v={v} />)}
          {warnings.map((v, i) => <ViolationRow key={`w${i}`} v={v} />)}
        </div>
      )}
    </div>
  );
}
