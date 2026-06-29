import Icon from '../components/Icon.jsx';
import React, { useState } from 'react';
import api, { setAuthToken } from '../services/ApiService';
import { validatePassword } from '../utils/passwordValidator';

/* ─── Floating shape component ─────────────────────────────── */
function Shape({ style, className }) {
  return <div className={className} style={{ position: 'absolute', borderRadius: '50%', pointerEvents: 'none', ...style }} />;
}

/* ─── Input field ───────────────────────────────────────────── */
function Field({ label, icon, type = 'text', placeholder, value, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={S.label}>{label}</label>
      <div style={{
        ...S.inputWrap,
        ...(focused ? S.inputWrapFocused : {}),
      }}>
        <div style={S.inputIcon}>
          <Icon name={icon} size={16} color={focused ? '#3b82f6' : '#94a3b8'} />
        </div>
        <input
          type={type}
          style={S.input}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────── */
export default function LoginScreen({ onLogin }) {
  const [step, setStep] = useState('LOGIN');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingUser, setPendingUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const err = (msg) => setErrorMsg(msg);

  const handleLogin = async () => {
    setErrorMsg('');
    if (!userId.trim() || !password.trim()) {
      err('Vui lòng nhập Tài khoản và Mật khẩu.'); return;
    }
    setIsLoading(true);
    try {
      const { data } = await api.post('/api/auth/login', {
        id: userId.trim().toLowerCase(),
        password,
      });
      setAuthToken(data.token);
      if (data.user.isFirstLogin) {
        setPendingUser(data.user);
        setStep('FORCE_CHANGE');
      } else {
        onLogin(data.user);
      }
    } catch (e) {
      const status = e.response?.status;
      if (status === 403) err('Tài khoản chưa được phê duyệt. Vui lòng liên hệ quản trị cấp cao.');
      else if (status === 401) err('Tài khoản hoặc Mật khẩu không chính xác.');
      else err('Không thể kết nối máy chủ. Vui lòng kiểm tra cấu hình API URL trong Cài đặt.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSetup = async () => {
    setErrorMsg('');
    const { valid, message } = validatePassword(newPassword);
    if (!valid) { err(message); return; }
    if (newPassword !== confirmPassword) { err('Xác nhận mật khẩu không khớp.'); return; }
    setIsLoading(true);
    try {
      await api.patch(`/api/employees/${pendingUser.id}/password`, { newPassword });
      onLogin({ ...pendingUser, isFirstLogin: false });
    } catch (e) {
      err('Không thể lưu mật khẩu mới. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  /* ── FORCE CHANGE PASSWORD ── */
  if (step === 'FORCE_CHANGE') {
    return (
      <div style={S.page} className="login-gradient-bg">
        <Shapes />
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={S.lockIconWrap}>
              <Icon name="shield" size={24} color="#fff" />
            </div>
            <h2 style={S.cardTitle}>Thiết Lập Bảo Mật</h2>
            <p style={S.cardDesc}>
              Chào mừng <strong style={{ color: '#1d4ed8' }}>{pendingUser?.name}</strong>.
              Đây là lần đầu đăng nhập — vui lòng tạo mật khẩu mới để bảo vệ tài khoản.
            </p>
          </div>

          <Field label="MẬT KHẨU MỚI *" icon="lock" type="password" placeholder="≥8 ký tự, có CHỮ HOA, thường và số" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <Field label="XÁC NHẬN MẬT KHẨU *" icon="check-circle" type="password" placeholder="Nhập lại mật khẩu" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          {errorMsg && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', marginBottom: 12 }}>{errorMsg}</div>}

          <button type="button" style={S.submitBtn} onClick={handleSaveSetup} disabled={isLoading}>
            {isLoading
              ? <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : <>
                  <span style={S.submitBtnText}>Cập Nhật & Truy Cập</span>
                  <Icon name="arrow-right" size={16} color="#fff" />
                </>
            }
          </button>
        </div>
      </div>
    );
  }

  /* ── LOGIN ── */
  return (
    <div style={S.page} className="login-gradient-bg">
      <Shapes />

      <div style={S.card}>
        {/* Logo */}
        <div style={S.logoArea}>
          <div style={S.logoRing}>
            <div style={S.logoInner}>
              <Icon name="radio" size={28} color="#fff" />
            </div>
          </div>
          <h1 style={S.appName}>ATC SHIFT PRO</h1>
          <p style={S.appDesc}>Hệ Thống Quản Lý KSVKL Nội Bộ</p>
        </div>

        {/* Divider */}
        <div style={S.divider} />

        {/* Form */}
        <Field label="TÀI KHOẢN ĐĂNG NHẬP" icon="user" placeholder="VD: tctsdn.nguyenvana" value={userId} onChange={e => setUserId(e.target.value)} />
        <Field label="MẬT KHẨU" icon="lock" type="password" placeholder="Nhập mật khẩu..." value={password} onChange={e => setPassword(e.target.value)} />
        {errorMsg && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', marginBottom: 12 }}>{errorMsg}</div>}

        <button
          type="button"
          style={S.submitBtn}
          onClick={handleLogin}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        >
          <span style={S.submitBtnText}>ĐĂNG NHẬP VÀO HỆ THỐNG</span>
          <Icon name="arrow-right" size={16} color="#fff" />
        </button>

        <p style={S.helpText}>
          Quên mật khẩu? Vui lòng liên hệ Quản trị viên Trung tâm để được cấp lại.
        </p>
      </div>

      {/* Footer */}
      <div style={S.footer}>
        <span style={S.footerText}>© 2025 ATC PRO — Confidential Internal System</span>
      </div>
    </div>
  );
}

/* ── Animated floating shapes ────────────────────────────────── */
function Shapes() {
  return (
    <>
      <Shape className="shape-float-1" style={{
        width: 340, height: 340, top: '-80px', left: '-80px',
        background: 'radial-gradient(circle, rgba(37,99,235,.18) 0%, transparent 70%)',
      }} />
      <Shape className="shape-float-2" style={{
        width: 280, height: 280, bottom: '60px', right: '-60px',
        background: 'radial-gradient(circle, rgba(99,102,241,.15) 0%, transparent 70%)',
      }} />
      <Shape className="shape-float-3" style={{
        width: 180, height: 180, top: '40%', left: '12%',
        background: 'radial-gradient(circle, rgba(20,184,166,.1) 0%, transparent 70%)',
      }} />
      {/* Grid dots overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />
    </>
  );
}

/* ─── Styles ────────────────────────────────────────────────── */
const S = {
  page: {
    minHeight: '100vh', width: '100%',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '24px 16px',
    position: 'relative', overflow: 'hidden',
  },

  card: {
    width: '100%', maxWidth: 440,
    background: '#fff',
    borderRadius: 20,
    padding: '36px 36px 28px',
    boxShadow: '0 32px 64px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.06)',
    position: 'relative', zIndex: 10,
    animation: 'fadeInUp .4s cubic-bezier(.4,0,.2,1) both',
  },

  cardHeader: { marginBottom: 24, textAlign: 'center' },
  lockIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 16px',
    boxShadow: '0 8px 20px rgba(37,99,235,.4)',
  },
  cardTitle: {
    margin: '0 0 10px', fontSize: 22, fontWeight: 700,
    color: '#0f172a',
  },
  cardDesc: {
    margin: 0, fontSize: 13.5, color: '#64748b', lineHeight: 1.6,
  },

  logoArea: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    marginBottom: 28,
  },
  logoRing: {
    width: 70, height: 70, borderRadius: 22,
    background: 'linear-gradient(135deg, #1e40af, #2563eb, #3b82f6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
    boxShadow: '0 12px 32px rgba(37,99,235,.45), 0 0 0 8px rgba(37,99,235,.08)',
  },
  logoInner: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  appName: {
    margin: '0 0 6px', fontSize: 26, fontWeight: 800,
    color: '#0f172a', letterSpacing: '0.04em',
  },
  appDesc: {
    margin: 0, fontSize: 13, color: '#64748b',
    letterSpacing: '0.01em',
  },

  divider: {
    height: 1, background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)',
    margin: '0 0 26px', border: 'none', borderWidth: 0,
  },

  label: {
    display: 'block',
    fontSize: 11, fontWeight: 700, color: '#475569',
    letterSpacing: '0.08em', marginBottom: 7,
  },
  inputWrap: {
    display: 'flex', flexDirection: 'row', alignItems: 'center',
    background: '#f8fafc',
    border: '1.5px solid #e2e8f0',
    borderRadius: 10, overflow: 'hidden',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
  },
  inputWrapFocused: {
    borderColor: '#3b82f6',
    boxShadow: '0 0 0 3px rgba(59,130,246,.15)',
    background: '#fff',
  },
  inputIcon: {
    width: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  input: {
    flex: 1, fontSize: 14, color: '#0f172a',
    padding: '11px 14px 11px 0',
    border: 'none', background: 'transparent', outline: 'none',
  },

  submitBtn: {
    width: '100%',
    display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    border: 'none', borderRadius: 10, cursor: 'pointer',
    padding: '13px 24px',
    marginTop: 8,
    boxShadow: '0 4px 14px rgba(37,99,235,.4), 0 1px 3px rgba(37,99,235,.3)',
    transition: 'all 150ms ease',
  },
  submitBtnText: {
    fontSize: 13.5, fontWeight: 700, color: '#fff', letterSpacing: '0.04em',
  },

  helpText: {
    margin: '20px 0 0', fontSize: 12, color: '#94a3b8',
    textAlign: 'center', lineHeight: 1.6,
    fontStyle: 'italic',
  },

  footer: {
    marginTop: 28, position: 'relative', zIndex: 10,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 11, color: 'rgba(255,255,255,.25)', letterSpacing: '0.04em',
  },
};
