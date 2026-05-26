// src/services/FirebaseService.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getFirestore, doc, setDoc, arrayUnion } from "firebase/firestore";

// 1. Cấu hình Firebase của Đài (Thay thế bằng thông tin thực tế của dự án ở phần Settings)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "atc-rostering-system.firebaseapp.com",
    projectId: "atc-rostering-system",
    storageBucket: "atc-rostering-system.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Khởi tạo Firebase App & Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

let messaging;

// Chỉ khởi tạo Messaging nếu đang chạy trên môi trường Trình duyệt (Window) hỗ trợ
if (typeof window !== 'undefined' && 'Notification' in window) {
    // Tránh lỗi khi chạy trên các trình duyệt cũ không hỗ trợ
    try {
        messaging = getMessaging(app);
    } catch (error) {
        console.warn("Trình duyệt không hỗ trợ Firebase Messaging", error);
    }
}

/**
 * Hàm xin quyền và lấy Token thiết bị, sau đó lưu vào Firestore
 * @param {string} userId - Mã ID của người dùng đang đăng nhập
 */
export const requestFirebaseToken = async (userId) => {
    if (!messaging) {
        console.warn("Hệ thống thông báo không khả dụng trên trình duyệt này.");
        return null;
    }

    try {
        // Xin Firebase cấp Token định danh thiết bị (Cần VAPID Key lấy từ Firebase Console - Tab Cloud Messaging)
        const currentToken = await getToken(messaging, { 
            vapidKey: 'YOUR_PUBLIC_VAPID_KEY_HERE' // THAY KEY PUBLIC CỦA BẠN VÀO ĐÂY
        });

        if (currentToken) {
            console.log('Đã lấy được Token thiết bị:', currentToken);
            
            // 2. LƯU VÀO FIRESTORE ĐỂ HỆ THỐNG BIẾT ĐƯỜNG GỬI PUSH NOTIFICATION
            // Dùng arrayUnion để thêm token mới mà không xóa token cũ (Nếu user dùng nhiều thiết bị)
            const userRef = doc(db, 'users', userId);
            await setDoc(userRef, {
                fcmTokens: arrayUnion(currentToken) 
            }, { merge: true });

            return currentToken;
        } else {
            console.log('Không lấy được token. Người dùng có thể chưa cấp quyền.');
            return null;
        }
    } catch (err) {
        console.error('Lỗi khi lấy token thông báo:', err);
        return null;
    }
};

/**
 * Hàm lắng nghe thông báo khi màn hình Web ĐANG MỞ (Foreground)
 * (Khi web đang mở, Service Worker không bắn ra ngoài màn hình OS, nên ta phải tự bắt và hiện Toast UI)
 */
export const listenForForegroundMessages = (onMessageReceived) => {
    if (!messaging) return;
    
    onMessage(messaging, (payload) => {
        console.log("Nhận được tin nhắn khi đang mở Web:", payload);
        // Gọi hàm Callback để hiển thị lên màn hình React (VD: Floating Toast)
        if (onMessageReceived) {
            onMessageReceived(payload);
        }
    });
};