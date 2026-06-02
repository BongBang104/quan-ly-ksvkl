import React from 'react';

const KSS_LEVELS = [
  { value: 1, label: 'Cực kỳ tỉnh táo',                             short: 'Sẵn sàng',         color: '#16a34a' },
  { value: 2, label: 'Rất tỉnh táo',                                short: 'Sẵn sàng',         color: '#16a34a' },
  { value: 3, label: 'Tỉnh táo',                                    short: 'Sẵn sàng',         color: '#22c55e' },
  { value: 4, label: 'Khá tỉnh táo',                                short: 'Sẵn sàng',         color: '#84cc16' },
  { value: 5, label: 'Không tỉnh táo cũng không buồn ngủ',          short: 'Chú ý',            color: '#facc15' },
  { value: 6, label: 'Có một số dấu hiệu buồn ngủ',                 short: 'Thận trọng',       color: '#f97316' },
  { value: 7, label: 'Buồn ngủ, nhưng có thể giữ tỉnh táo',        short: 'Rủi ro tăng',      color: '#ef4444' },
  { value: 8, label: 'Rất buồn ngủ, rất cố gắng để giữ tỉnh',      short: 'Rủi ro cao',       color: '#dc2626' },
  { value: 9, label: 'Cực kỳ buồn ngủ, gần như không thể tỉnh',    short: 'Không đủ ĐK',      color: '#991b1b' },
];

/**
 * KssScale — thang đo buồn ngủ Karolinska (KSS).
 * Props: value (int 1-9 | null), onChange (fn), readOnly (bool)
 */
export default function KssScale({ value, onChange, readOnly = false }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
        Thang đo buồn ngủ Karolinska (KSS) — QĐ 2288 Phụ lục II
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {KSS_LEVELS.map(lvl => {
          const selected = value === lvl.value;
          return (
            <label key={lvl.value} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 12px',
              border: `1px solid ${selected ? lvl.color : '#e2e8f0'}`,
              borderRadius: 8,
              backgroundColor: selected ? `${lvl.color}18` : '#fff',
              cursor: readOnly ? 'default' : 'pointer',
            }}>
              <input type="radio" name="kss" value={lvl.value}
                     checked={selected}
                     onChange={() => !readOnly && onChange?.(lvl.value)}
                     disabled={readOnly}
                     style={{ accentColor: lvl.color }} />
              <span style={{ fontFamily: 'Courier New', fontSize: 18, fontWeight: 800,
                             color: lvl.color, width: 24 }}>{lvl.value}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{lvl.label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: lvl.color,
                             padding: '2px 8px', backgroundColor: `${lvl.color}15`, borderRadius: 4 }}>
                {lvl.short}
              </span>
            </label>
          );
        })}
      </div>
      {value >= 7 && (
        <div style={{ marginTop: 12, padding: 12, backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
          Điểm KSS từ 7 trở lên cho thấy mệt mỏi đáng kể. Báo ngay Kíp trưởng/Quản lý ca
          theo QĐ 2289 Chương VI mục III bước 2.
        </div>
      )}
    </div>
  );
}
