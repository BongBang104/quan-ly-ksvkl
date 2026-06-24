# DEPLOY_AUDIT_v3 — Đánh giá commit `6f474de`

> **Tính năng mới:** PWA (Add to Home Screen) + Web Push Notifications
> **Kết luận nhanh:** 7/7 bug cũ đã fix. Tính năng push hoạt động tốt về kiến trúc
> nhưng có 3 bug mới cần xử lý trước khi dùng thật.

---

## ✅ Tất cả bug cũ đã được fix (7/7)

| # | Nội dung | Trạng thái |
|---|---|---|
| R-01 | `reset-superadmin.ts` — hỗ trợ `DATABASE_URL` | ✅ |
| R-02 | `deploy.sh` — kiểm tra `dist/` trước compose up | ✅ |
| R-03 | `tasks.controller.ts` — `RolesGuard` cho `PUT`, `DELETE` | ✅ |
| R-04 | `requests.controller.ts` — `RolesGuard` cho `PUT`, `PUT :id` | ✅ |
| R-05 | `employees.service.ts` — xoá `password` trong `upsertOne(isNew=false)` | ✅ |
| R-06 | `audit.cron.ts` — tạo file + đăng ký vào `AuditModule` | ✅ |
| R-07 | `App.jsx` — `AccountManagerScreen` dùng `{...p}` | ✅ |

---

## Bug mới trong tính năng PWA Push (3 bug)

### N-01 🔴 — `PushController` dùng `req.user.sub` nhưng `JwtStrategy` trả về `req.user.id`

**File:** `backend/src/push/push.controller.ts` dòng 21

```typescript
// JwtStrategy.validate() trả về:
return { id: payload.sub, role: payload.role, name: payload.name };
//        ^^^ field tên là 'id', không phải 'sub'

// Nhưng PushController đọc:
await this.push.subscribe(req.user.sub, body);
//                                 ^^^ undefined → userId lưu vào DB là undefined
```

**Hậu quả:** Mọi subscription được lưu với `userId = undefined` →
`sendToUsers(['emp-123', ...])` query `WHERE userId IN (...)` không tìm thấy gì →
**push notification đến đúng người không bao giờ hoạt động**.
Chỉ `sendToAll()` mới gửi được (vì không lọc theo userId).

**Fix:**

```typescript
// push.controller.ts dòng 21:
await this.push.subscribe(req.user.id, body);   // đổi .sub → .id
```

---

### N-02 🔴 — Icon PNG thiếu — notification và PWA install bị vỡ giao diện

**Thư mục:** `public/icons/`

```
Hiện có:    icon.svg
Thiếu:      icon-192.png   ← manifest.json, sw.js, apple-touch-icon dùng
            icon-512.png   ← manifest.json dùng
            badge-72.png   ← sw.js notification badge dùng
```

**Hậu quả:**
- Notification hiển thị không có icon → trông không chuyên nghiệp
- `apple-touch-icon` trỏ đến file không tồn tại → iOS Home Screen hiển thị icon trắng
- Chrome PWA install prompt kiểm tra icon PNG — nếu thiếu có thể bỏ qua prompt

**Fix — tạo PNG từ SVG có sẵn:**

```bash
# Cài sharp-cli hoặc dùng ImageMagick/Inkscape
# Cách 1 — Node.js (sharp):
cd public/icons
npx sharp-cli -i icon.svg -o icon-192.png resize 192
npx sharp-cli -i icon.svg -o icon-512.png resize 512
npx sharp-cli -i icon.svg -o badge-72.png resize 72

# Cách 2 — Inkscape:
inkscape icon.svg --export-png=icon-192.png --export-width=192
inkscape icon.svg --export-png=icon-512.png --export-width=512
inkscape icon.svg --export-png=badge-72.png --export-width=72
```

Hoặc dùng tool online (squoosh.app, cloudconvert.com) convert `icon.svg` → 3 file PNG,
đặt vào `public/icons/`.

---

### N-03 🟡 — `VAPID_EMAIL` default `mailto:admin@atcpro.local` không hợp lệ cho production

**File:** `backend/src/push/push.service.ts` dòng 23

```typescript
const email = this.config.get<string>('VAPID_EMAIL', 'mailto:admin@atcpro.local');
```

VAPID spec yêu cầu email phải là địa chỉ thật để browser vendor (Google, Mozilla) liên lạc
nếu có vấn đề. Domain `atcpro.local` không tồn tại → một số push service có thể từ chối.

**Fix — cập nhật `backend/.env.example`:**

```env
# Đổi thành email thật — browser vendor dùng để liên lạc nếu cần
VAPID_EMAIL=mailto:admin@yourdomain.com
```

---

## Điểm tốt của tính năng mới

✅ `urlBase64ToUint8Array()` — convert VAPID key đúng chuẩn Web Push spec

✅ `Promise.allSettled()` trong `_dispatch()` — 1 subscription lỗi không block các sub còn lại

✅ Auto-cleanup subscription 410/404 — khi browser xoá subscription cũ, backend tự dọn

✅ `onModuleInit()` degrade gracefully — không có VAPID keys thì push tắt, server vẫn chạy bình thường

✅ `tag: 'atc-pro'` trong notification — gộp thông báo, tránh spam nhiều notification chồng nhau

✅ `migration.sql` đã có bảng `push_subscriptions` với index trên `userId`

✅ `deploy.sh` kiểm tra `dist/` trước khi compose up

---

## Checklist để tính năng push hoạt động hoàn toàn

```
Bắt buộc:
[ ] N-01 — push.controller.ts: req.user.sub → req.user.id          (~1 phút)
[ ] N-02 — Tạo 3 file PNG: icon-192.png, icon-512.png, badge-72.png (~10 phút)

Nên làm:
[ ] N-03 — .env.example: VAPID_EMAIL đổi thành email thật

Sau khi deploy:
[ ] Sinh VAPID keys: cd backend && npx web-push generate-vapid-keys
[ ] Điền VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL vào .env
[ ] Chạy: ./deploy.sh
[ ] Mở app trên Chrome Android → "Add to Home Screen"
[ ] Kiểm tra: tạo task mới → nhân viên nhận push notification
```

---

## Trạng thái tổng thể

```
Infrastructure deploy:   ✅ Sẵn sàng
Migration schema:        ✅ Đầy đủ (14 bảng)
Bảo mật auth:            ✅ Đã fix hết
Real-time WebSocket:     ✅ Đã fix payload.sub
PWA manifest:            ✅ Đúng chuẩn
Push notification logic: ✅ Kiến trúc tốt
Push userId bug:         🔴 N-01 — fix 1 dòng
PNG icons:               🔴 N-02 — cần tạo file
VAPID email:             🟡 N-03 — cập nhật .env.example
```
