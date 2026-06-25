import React from 'react';
import Icon from './Icon.jsx';

const SEV_STYLE = {
  CRITICAL:       { bg: '#fef2f2', border: '#fecaca', dot: '#dc2626', text: '#dc2626' },
  WARNING:        { bg: '#fffbeb', border: '#fde68a', dot: '#d97706', text: '#d97706' },
  INFO:           { bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6', text: '#3b82f6' },
  Nghiêm_trọng:  { bg: '#fef2f2', border: '#fecaca', dot: '#dc2626', text: '#dc2626' },
  Cảnh_báo:      { bg: '#fffbeb', border: '#fde68a', dot: '#d97706', text: '#d97706' },
  Lưu_ý:         { bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6', text: '#3b82f6' },
};
const SEV_LABEL = {
  CRITICAL: 'Nghiêm trọng', WARNING: 'Cảnh báo', INFO: 'Lưu ý',
};

function ViolationRow({ v }) {
  const key = v.severity?.replace(/\s/g, '_');
  const s = SEV_STYLE[v.severity] || SEV_STYLE[key] || SEV_STYLE.INFO;
  const label = SEV_LABEL[v.severity] || v.severity;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '100px 1fr',
      gap: 12,
      padding: '10px 14px',
      borderBottom: '1px solid #f1f5f9',
      borderLeft: `4px solid ${s.dot}`,
      alignItems: 'start',
    }}>
      <div style={{ paddingTop: 2 }}>
        <span style={{
          display: 'inline-block',
          fontSize: 10, fontWeight: 700,
          padding: '4px 8px', borderRadius: 5,
          backgroundColor: s.bg, color: s.text,
          border: `1px solid ${s.border}`,
          whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: '#1e293b',
          marginBottom: 3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {v.controller_name || v.controller_id}
        </div>
        <div style={{
          fontSize: 12, color: '#475569',
          lineHeight: 1.55,
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}>
          {v.message}
        </div>
        {v.legal_basis && (
          <span style={{
            display: 'inline-block',
            marginTop: 6,
            fontSize: 10, fontWeight: 600,
            color: '#64748b',
            backgroundColor: '#f1f5f9',
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid #e2e8f0',
          }}>
            {v.legal_basis}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ReviewResultPanel({ result, style }) {
  if (!result) return null;
  const { can_publish, violations = [], unknown_abbreviations = [] } = result;
  const critical = violations.filter(v => v.severity === 'CRITICAL' || v.severity === 'Nghiêm trọng');
  const warnings = violations.filter(v => v.severity === 'WARNING'  || v.severity === 'Cảnh báo');
  const infos    = violations.filter(v => v.severity === 'INFO'     || v.severity === 'Lưu ý');

  return (
    <div style={{
      border: `1px solid ${can_publish ? '#bbf7d0' : '#fecaca'}`,
      borderRadius: 10,
      overflow: 'hidden',
      marginTop: 12,
      backgroundColor: '#fff',
      ...style,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: can_publish ? '#dcfce7' : '#fee2e2',
        flexWrap: 'wrap',
      }}>
        <Icon name={can_publish ? 'check-circle' : 'alert-circle'} size={18}
              color={can_publish ? '#16a34a' : '#dc2626'} />
        <span style={{ fontSize: 14, fontWeight: 700, color: can_publish ? '#15803d' : '#dc2626', flex: 1 }}>
          {can_publish
            ? `Có thể phát hành — ${violations.length} lưu ý`
            : `Không thể phát hành — ${critical.length} vi phạm nghiêm trọng`}
        </span>
        <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0 }}>
          Quyết định cuối thuộc kíp trưởng (QĐ 2288 Điều 5.1)
        </span>
      </div>

      {/* Tóm tắt số lượng */}
      {violations.length > 0 && (
        <div style={{
          display: 'flex', gap: 12, padding: '10px 16px',
          borderBottom: '1px solid #f1f5f9',
          backgroundColor: '#f8fafc',
          flexWrap: 'wrap',
        }}>
          {critical.length > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', padding: '3px 10px', borderRadius: 99, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              🔴 {critical.length} nghiêm trọng
            </span>
          )}
          {warnings.length > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706', padding: '3px 10px', borderRadius: 99, backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
              🟡 {warnings.length} cảnh báo
            </span>
          )}
          {infos.length > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', padding: '3px 10px', borderRadius: 99, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
              🔵 {infos.length} lưu ý
            </span>
          )}
        </div>
      )}

      {/* Unknown abbreviations */}
      {unknown_abbreviations.length > 0 && (
        <div style={{ padding: '10px 16px', backgroundColor: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: 12, color: '#92400e' }}>
          <strong>Ký hiệu chưa nhận ra</strong> (OJTI/nhân sự ngoài kíp):&nbsp;
          {unknown_abbreviations.map((ab, i) => (
            <span key={i} style={{
              display: 'inline-block', margin: '2px 3px', padding: '1px 8px',
              backgroundColor: '#fef3c7', border: '1px solid #fde68a',
              borderRadius: 4, fontFamily: 'Courier New', fontWeight: 700,
            }}>
              {ab}
            </span>
          ))}
        </div>
      )}

      {/* Danh sách vi phạm */}
      {violations.length === 0 ? (
        <div style={{ padding: '20px 16px', fontSize: 13, color: '#15803d', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="check-circle" size={16} color="#16a34a" />
          Không phát hiện vi phạm quy định trong bảng phân vị trí này.
        </div>
      ) : (
        <div>
          {critical.length > 0 && (
            <div>
              <div style={{ padding: '6px 16px', backgroundColor: '#fef2f2', fontSize: 11, fontWeight: 700, color: '#dc2626', letterSpacing: 0.5, borderBottom: '1px solid #fecaca' }}>
                VI PHẠM NGHIÊM TRỌNG ({critical.length})
              </div>
              {critical.map((v, i) => <ViolationRow key={`c${i}`} v={v} />)}
            </div>
          )}
          {warnings.length > 0 && (
            <div>
              <div style={{ padding: '6px 16px', backgroundColor: '#fffbeb', fontSize: 11, fontWeight: 700, color: '#d97706', letterSpacing: 0.5, borderBottom: '1px solid #fde68a', borderTop: critical.length > 0 ? '1px solid #e2e8f0' : 'none' }}>
                CẢNH BÁO ({warnings.length})
              </div>
              {warnings.map((v, i) => <ViolationRow key={`w${i}`} v={v} />)}
            </div>
          )}
          {infos.length > 0 && (
            <div>
              <div style={{ padding: '6px 16px', backgroundColor: '#eff6ff', fontSize: 11, fontWeight: 700, color: '#2563eb', letterSpacing: 0.5, borderBottom: '1px solid #bfdbfe', borderTop: (critical.length + warnings.length) > 0 ? '1px solid #e2e8f0' : 'none' }}>
                LƯU Ý ({infos.length})
              </div>
              {infos.map((v, i) => <ViolationRow key={`i${i}`} v={v} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
