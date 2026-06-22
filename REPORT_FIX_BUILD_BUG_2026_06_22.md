# REPORT — PLAN_FIX_BUILD_BUG_2026_06_22

**Ngày thực hiện:** 2026-06-22
**Commit trước:** `c222d5e` (feat: hoàn thành PLAN_FIX_2026_06_11)

---

## Mục 1 — Sửa bug JSX RosterGrid.js line 166

**Vấn đề:** `src/components/RosterGrid.js` có root element là `<div role="button">` (line 68)
nhưng closing tag là `</button>` (line 166). esbuild strict mode reject trong production build.
Vite dev mode bỏ qua → bug âm thầm tồn tại từ initial commit.

**Fix:** Đổi `</button>` → `</div>` tại line 166.

**Xác minh:**
```
✓ npm run build → vite v5.4.21, ✓ built in 4.72s (không có error)
  Warning chunk size 1,423 kB — known issue M4, không phải lỗi build
✓ sed -n '163,168p' src/components/RosterGrid.js → 2 dòng </div> liền nhau
```

**[DONE] Mục 1 — 2026-06-22**
- Đổi `</button>` → `</div>` để khớp root `<div role="button">`
- `npm run build` pass lần đầu tiên sau 6 sprint

---

## Mục 2 — Cleanup Z2: redact `<REDACTED>` khỏi docs MD

**Vấn đề:** Sau Z2 (filter-repo), 3 file docs MD vẫn còn tham chiếu lịch sử đến password cũ.
Git history commit `c222d5e` có text này → GitHub secret scanning có thể flag.

**Files đã xử lý:**

| File | Số lần thay | Trạng thái |
|------|------------|------------|
| `CHANGELOG_FIX_2026_06_11.md` | 3 | `<REDACTED>` |
| `PLAN_FIX_2026_06_11.md` | 5 | `<REDACTED>` |
| `PLAN_FIX_BUILD_BUG_2026_06_22.md` | 12 | `<REDACTED>` |

**Phương án áp dụng:** B (commit bình thường, không force-push lần nữa) —
password đã không còn hợp lệ (Z1), risk thấp, không gây gián đoạn collaborator.

**Xác minh:**
```
✓ grep Tctsdn@123 **/*.{md,ts,js,jsx,py,sql} → No files found (sạch)
```

**[DONE] Mục 2 — 2026-06-22**

---

## Staging prep — seed_staging.sql

File `seed_staging.sql` đã được di chuyển vào thư mục `staging/`:
```
staging/seed_staging.sql  (27 tài khoản + 2 tháng lịch + 3 fatigue + 2 exchange)
```

Hướng dẫn sử dụng: xem `STAGING_SETUP.md`.

---

## Kết quả smoke test

| Check | Kết quả |
|-------|---------|
| `npm run build` | ✓ PASS (4.72s) |
| `grep Tctsdn@123` toàn repo | ✓ 0 matches |
| `RosterGrid.js` line 166 | ✓ `</div>` đúng |
| `staging/seed_staging.sql` | ✓ có mặt |

---

## Bước tiếp theo

Theo `STAGING_SETUP.md`:
1. Khởi động staging stack: `docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build`
2. Chạy migration: `backend/migration.sql`
3. Chạy seed: `staging/seed_staging.sql`
4. Test theo `PLAN_STAGING_TEST.md` Phần A → B

**Frontend production build đã sẵn sàng.** Staging có thể setup ngay.
