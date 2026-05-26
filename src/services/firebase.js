// Firebase đã được loại bỏ. Hệ thống chuyển sang NestJS + PostgreSQL.
// Xem src/services/ApiService.js để biết lớp API mới.
export const requestFirebaseToken = () => Promise.resolve(null);
export const listenForForegroundMessages = () => {};
export const db = null;
