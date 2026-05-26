import Icon from './Icon.jsx';
import React from 'react';



export default function EmployeeProfile({ employee, onBack, onEdit }) {
  if (!employee) return null;

  // Hàm kiểm tra tình trạng hạn
  const getExpiryStatus = (dateStr) => {
    if (!dateStr) return { text: 'Chưa cập nhật', color: '#94a3b8', bg: '#f1f5f9', icon: 'help-circle' };
    const d = new Date(dateStr);
    const diff = d - new Date();
    const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { text: `Đã hết hạn (${dateStr})`, color: '#dc2626', bg: '#fef2f2', icon: 'x-circle' };
    if (daysLeft <= 30) return { text: `Sắp hết hạn (${dateStr})`, color: '#d97706', bg: '#fffbeb', icon: 'alert-triangle' };
    return { text: `An toàn (${dateStr})`, color: '#16a34a', bg: '#f0fdf4', icon: 'check-circle' };
  };

  const engStatus = getExpiryStatus(employee.englishExp);
  const healthStatus = getExpiryStatus(employee.healthExp);

  return (
    <div style={styles.container}>
      {/* THANH ĐIỀU HƯỚNG */}
      <div style={styles.navBar}>
        <button type="button" style={styles.navBtn} onClick={onBack}>
          <Icon name="arrow-left" size={20} color="#1e293b" />
          <span style={styles.navText}>Quay lại</span>
        </button>
        <button type="button" style={styles.editBtn} onClick={() => onEdit(employee)}>
          <Icon name="edit-2" size={16} color="#fff" />
          <span style={styles.editBtnText}>Chỉnh sửa</span>
        </button>
      </div>

      <div style={styles.scrollArea}>
        {/* KHỐI HEADER (COVER & AVATAR) */}
        <div style={styles.profileHeader}>
          <div style={styles.coverPhoto}></div>
          <div style={styles.avatarContainer}>
            <div style={{...styles.avatar, ...(employee.isChief && styles.avatarChief)}}>
              <span style={{...styles.avatarText, ...(employee.isChief && {color: '#854d0e'})}}>{employee.id}</span>
            </div>
          </div>

          <div style={styles.nameSection}>
            <span style={styles.empName}>{employee.name}</span>
            <span style={styles.empRole}>{employee.position} • {employee.team}</span>

            <div style={styles.badgeRow}>
              <div style={styles.badge}><span style={styles.badgeText}>{employee.qualification}</span></div>
              {employee.isChief && <div style={{...styles.badge, ...styles.badgeChief}}><Icon name="star" size={12} color="#854d0e"/><span style={styles.badgeTextChief}> Kíp trưởng</span></div>}
              {employee.isVip && <div style={{...styles.badge, ...styles.badgeVip}}><span style={styles.badgeTextVip}>Chuyên cơ</span></div>}
            </div>
          </div>
        </div>

        {/* KHỐI THÔNG TIN LIÊN HỆ */}
        <div style={styles.infoCard}>
          <span style={styles.cardTitle}>Thông tin Cá nhân</span>
          <div style={styles.infoRow}>
            <div style={styles.iconBox}><Icon name="phone" size={16} color="#64748b" /></div>
            <div>
              <span style={styles.infoLabel}>Số điện thoại</span>
              <span style={styles.infoValue}>{employee.phone || 'Chưa cập nhật'}</span>
            </div>
          </div>
          <div style={styles.divider} />
          <div style={styles.infoRow}>
            <div style={styles.iconBox}><Icon name="calendar" size={16} color="#64748b" /></div>
            <div>
              <span style={styles.infoLabel}>Ngày sinh</span>
              <span style={styles.infoValue}>{employee.dob || 'Chưa cập nhật'}</span>
            </div>
          </div>
        </div>

        {/* KHỐI CHUYÊN MÔN & GIẤY PHÉP */}
        <div style={styles.infoCard}>
          <span style={styles.cardTitle}>Chứng chỉ & Giấy phép</span>

          <div style={styles.infoRow}>
            <div style={styles.iconBox}><Icon name="award" size={16} color="#64748b" /></div>
            <div>
              <span style={styles.infoLabel}>Số giấy phép KSVKL</span>
              <span style={styles.infoValueBold}>{employee.licenseNo || 'Chưa cập nhật'}</span>
            </div>
          </div>
          <div style={styles.divider} />

          <div style={styles.infoRow}>
            <div style={styles.iconBox}><Icon name="globe" size={16} color="#64748b" /></div>
            <div style={styles.flex1}>
              <span style={styles.infoLabel}>Tiếng Anh Hàng không</span>
              <div style={{...styles.statusBadge, backgroundColor: engStatus.bg}}>
                <Icon name={engStatus.icon} size={14} color={engStatus.color} />
                <span style={{...styles.statusText, color: engStatus.color}}>{engStatus.text}</span>
              </div>
            </div>
          </div>
          <div style={styles.divider} />

          <div style={styles.infoRow}>
            <div style={styles.iconBox}><Icon name="heart" size={16} color="#64748b" /></div>
            <div style={styles.flex1}>
              <span style={styles.infoLabel}>Khám Sức khỏe</span>
              <div style={{...styles.statusBadge, backgroundColor: healthStatus.bg}}>
                <Icon name={healthStatus.icon} size={14} color={healthStatus.color} />
                <span style={{...styles.statusText, color: healthStatus.color}}>{healthStatus.text}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{height: 40}}/>
      </div>
    </div>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0', zIndex: 10 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navText: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563eb', paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12, borderRadius: 8 },
  editBtnText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold', color: '#fff' },

  scrollArea: { flex: 1 },

  profileHeader: { backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0', marginBottom: 16, paddingBottom: 20 },
  coverPhoto: { height: 100, backgroundColor: '#1e293b' },
  avatarContainer: { alignItems: 'center', marginTop: -40 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#fff', boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  avatarChief: { backgroundColor: '#fef08a' },
  avatarText: { fontFamily: 'Times New Roman', fontSize: 24, fontWeight: 'bold', color: '#3730a3' },
  nameSection: { alignItems: 'center', marginTop: 12 },
  empName: { fontFamily: 'Times New Roman', fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  empRole: { fontFamily: 'Times New Roman', fontSize: 14, color: '#64748b', marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  badge: { backgroundColor: '#f1f5f9', paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10, borderRadius: 12 },
  badgeText: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#475569' },
  badgeChief: { backgroundColor: '#fef9c3', flexDirection: 'row', alignItems: 'center' },
  badgeTextChief: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#854d0e' },
  badgeVip: { backgroundColor: '#f3e8ff' },
  badgeTextVip: { fontFamily: 'Times New Roman', fontSize: 12, fontWeight: 'bold', color: '#6b21a8' },

  infoCard: { backgroundColor: '#fff', marginLeft: 16, marginRight: 16, marginBottom: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', boxShadow: "0 4px 6px rgba(0,0,0,0.08)"},
  cardTitle: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginBottom: 16, borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  flex1: { flex: 1 },
  infoLabel: { fontFamily: 'Times New Roman', fontSize: 12, color: '#64748b', marginBottom: 2 },
  infoValue: { fontFamily: 'Times New Roman', fontSize: 15, color: '#1e293b', fontWeight: '500' },
  infoValueBold: { fontFamily: 'Times New Roman', fontSize: 15, color: '#1e293b', fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginTop: 12, marginBottom: 12, marginLeft: 48 },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10, borderRadius: 8, marginTop: 4, alignSelf: 'flex-start' },
  statusText: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: 'bold' }
};
