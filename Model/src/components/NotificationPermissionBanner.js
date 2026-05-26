// src/components/NotificationPermissionBanner.js
import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../context/AppContext';
// Import hàm cấp token mà chúng ta vừa viết ở FirebaseService
import { requestFirebaseToken } from '../services/FirebaseService';

// Giả lập style CSS-in-JS (chuẩn React)
const styles = {
  overlay: {
    position: 'fixed', bottom: '20px', right: '20px', left: '20px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
    padding: '20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderLeft: '5px solid #2563eb', // Điểm nhấn màu xanh ATC
    zIndex: 9999,
    fontFamily: '"Times New Roman", Times, serif', // Tuân thủ chuẩn font
    flexWrap: 'wrap', gap: '15px'
  },
  iconAndText: {
    display: 'flex', alignItems: 'center', gap: '15px', flex: 1, minWidth: '280px'
  },
  iconBox: {
    backgroundColor: '#eff6ff', padding: '12px', borderRadius: '50%', color: '#2563eb'
  },
  title: {
    margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#1e293b'
  },
  description: {
    margin: '5px 0 0 0', fontSize: '15px', color: '#475569', lineHeight: '1.5'
  },
  btnGroup: {
    display: 'flex', gap: '10px'
  },
  btnAllow: {
    backgroundColor: '#2563eb', color: '#ffffff', border: 'none',
    padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '15px', fontWeight: 'bold', fontFamily: '"Times New Roman", Times, serif'
  },
  btnAllowLoading: { // Thêm style khi đang xoay loading
    backgroundColor: '#94a3b8', color: '#ffffff', border: 'none',
    padding: '10px 20px', borderRadius: '8px', cursor: 'not-allowed',
    fontSize: '15px', fontWeight: 'bold', fontFamily: '"Times New Roman", Times, serif'
  },
  btnDeny: {
    backgroundColor: '#f1f5f9', color: '#64748b', border: 'none',
    padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '15px', fontWeight: 'bold', fontFamily: '"Times New Roman", Times, serif'
  }
};

export default function NotificationPermissionBanner() {
  const { currentUser } = useContext(AppContext); // Lấy thông tin user đang đăng nhập
  const [permissionState, setPermissionState] = useState('default');
  const [showBanner, setShowBanner] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Trạng thái đang lấy Token

  useEffect(() => {
    // Kểm tra xem trình duyệt có hỗ trợ Notification API không
    if (!('Notification' in window)) {
      console.log('Trình duyệt này không hỗ trợ thông báo trên Web.');
      return;
    }
    // Lấy trạng thái hiện tại
    setPermissionState(Notification.permission);
    // Nếu chưa từng hỏi (default) và có user đăng nhập thì mới hiện Banner
    if (Notification.permission === 'default' && currentUser) {
      setShowBanner(true);
    }
  }, [currentUser]);

  const handleRequestPermission = async () => {
    if (!currentUser) return;

    try {
      setIsProcessing(true); // Hiển thị trạng thái đang xử lý
      
      // Bước 1: Xin quyền từ trình duyệt OS
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      
      if (permission === 'granted') {
        // Bước 2: Gọi Firebase Service để lấy Token và lưu vào Database
        console.log('Bắt đầu lấy Token FCM cho user:', currentUser.id);
        const token = await requestFirebaseToken(currentUser.id);
        
        if (token) {
           console.log('Thành công! Device Token đã được lưu.');
           // Cập nhật giao diện: Tắt banner
           setShowBanner(false);
           alert('Đăng ký thành công! Bạn sẽ nhận được thông báo lịch trực ngay cả khi khóa máy.');
        } else {
           alert('Cấp quyền thành công nhưng lấy Token thất bại. Vui lòng thử lại sau.');
           setIsProcessing(false);
        }
      } else {
        alert('Bạn đã từ chối nhận thông báo. Bạn có thể bật lại trong cài đặt của trình duyệt.');
        setShowBanner(false);
      }
    } catch (error) {
      console.error('Lỗi quy trình xin quyền thông báo:', error);
      alert('Có lỗi xảy ra trong quá trình thiết lập thông báo.');
      setIsProcessing(false);
    }
  };

  // Nếu không cho phép hiện banner, render rỗng
  if (!showBanner) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.iconAndText}>
        <div style={styles.iconBox}>
          <span style={{ fontSize: '24px' }}>🔔</span>
        </div>
        <div>
          <h3 style={styles.title}>Bật thông báo Lịch trực (ATC Push)</h3>
          <p style={styles.description}>
            Hệ thống cần quyền gửi thông báo để đảm bảo bạn nhận được thông tin thay đổi ca trực, nhiệm vụ mới ngay cả khi bạn đang khóa máy.
          </p>
        </div>
      </div>
      <div style={styles.btnGroup}>
        <button 
           style={styles.btnDeny} 
           onClick={() => setShowBanner(false)}
           disabled={isProcessing}
        >
           Lúc khác
        </button>
        <button 
           style={isProcessing ? styles.btnAllowLoading : styles.btnAllow} 
           onClick={handleRequestPermission}
           disabled={isProcessing}
        >
           {isProcessing ? 'Đang xử lý...' : 'Cho phép ngay'}
        </button>
      </div>
    </div>
  );
}