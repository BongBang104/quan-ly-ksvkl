// public/firebase-messaging-sw.js

// 1. Nhập thư viện lõi của Firebase dành riêng cho Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 2. Cấu hình Firebase (Lấy từ thông tin cài đặt của Đài - Hệ thống ATC)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // (Bạn sẽ thay bằng Key thật của dự án)
  authDomain: "atc-rostering-system.firebaseapp.com",
  projectId: "atc-rostering-system",
  storageBucket: "atc-rostering-system.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Khởi tạo Firebase trong môi trường chạy ngầm
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 3. Lắng nghe tin nhắn khi Web đang bị tắt hoặc khóa màn hình
messaging.onBackgroundMessage((payload) => {
  console.log('Nhận được thông báo chạy ngầm từ Firebase:', payload);

  const notificationTitle = payload.notification.title || 'ATC PRO: Thông báo mới';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png', // Icon đài không lưu hiện trên thanh thông báo
    badge: '/badge.png', // Icon nhỏ màu trắng đen (dành cho Android)
    vibrate: [200, 100, 200, 100, 200, 100, 200], // Rung cảnh báo
    data: payload.data // Dữ liệu đính kèm (Ví dụ: ID ca trực để bấm vào mở đúng màn hình)
  };

  // Ra lệnh cho trình duyệt bắn Notification ra ngoài màn hình OS
  return self.registration.showNotification(notificationTitle, notificationOptions);
});