# PLAN_FIX_BUILD_BUG_2026_06_22 — Sửa lỗi build + dọn Z2 docs

> **Mục tiêu:** sau audit commit `c222d5e`, phát hiện 2 việc cần dọn:
> 1. **Bug build CRITICAL** — `RosterGrid.js:166` JSX malformed → frontend không build production được.
> 2. **Cleanup Z2** — `&lt;REDACTED&gt;` vẫn xuất hiện 9 lần trong 2 file docs MD.
>
> Tổng thời gian: ~15 phút.
> Cách dùng: trong Claude VSCode đọc file này, làm tuần tự 2 mục, ghi DONE vào CHANGELOG.

---

## Nguyên tắc

1. **CHỈ sửa đúng dòng được spec.** KHÔNG refactor RosterGrid.js ngoài line 166.
2. Sau mỗi mục → chạy Xác minh **thật** → ghi `[DONE]` vào `CHANGELOG_FIX_BUILD_BUG.md`.

---

# Mục 1 — Sửa bug JSX trong RosterGrid.js

## Bối cảnh

File `src/components/RosterGrid.js` có cấu trúc:

```jsx
// Line 68:
<div role="button" tabIndex={0} ...>
    <div style={styles.tagContainer}>     // Line 95
        {allItems.map((item, gi) => { ... })}
    </div>                                  // Line 165 — đóng tagContainer
</button>                                   // Line 166 ← SAI: phải là </div>
);
```

Element root là `<div role="button">` (Line 68) — nhưng closing là `</button>` (Line 166). esbuild strict mode (production build) reject. Vite dev mode chấp nhận → bug tồn tại từ initial commit mà chưa ai phát hiện.

## Fix

**File:** `src/components/RosterGrid.js`

Mở file. Đi tới dòng 166. Tìm chính xác:
```jsx
            </div>
        </button>
    );
```

Thay bằng:
```jsx
            </div>
        </div>
    );
```

(Chỉ đổi `</button>` thành `</div>` ở line 166. Giữ nguyên line 165 `</div>` và line 167 `);`.)

## Xác minh

1. `sed -n '163,168p' src/components/RosterGrid.js` — phải thấy 2 dòng `</div>` liền nhau ở dòng 165 và 166.

2. **Build test:**
   ```bash
   npm run build
   ```
   Phải thấy: `✓ built in Xs` (KHÔNG có error). Có thể có warning chunk size (1.4MB) — đây là vấn đề M4 đã biết, không phải lỗi.

3. **Smoke test UI:** chạy `npm run dev`, mở SchedulerScreen, kéo thả KSVKL — phải hoạt động như trước (vì semantically `<div role="button">` cũng tương đương button).

4. Ghi vào CHANGELOG:
   ```
   [DONE] Mục 1 — Sửa JSX RosterGrid.js line 166 — <ngày>
   - Đổi </button> thành </div> để khớp với root <div role="button">
   - npm run build pass sau 6 sprint đầu tiên
   ```

## Câu hỏi mở

- Bug này tồn tại từ initial commit `8f2b0cd`. Tại sao chưa phát hiện? Trong dev workflow nên thêm `npm run build` vào pre-commit hook hoặc CI để tránh tái diễn. **Đây là gợi ý** — không bắt buộc trong sprint này.

---

# Mục 2 — Dọn Z2: xóa `&lt;REDACTED&gt;` khỏi docs MD

## Bối cảnh

Sau commit `cfc6c80` đã chạy `git filter-repo` xóa text này khỏi code. Tuy nhiên 2 file docs sau đó vẫn còn:

```bash
$ git log --all -p -S "&lt;REDACTED&gt;" --name-only --oneline | tail -10
c222d5e feat: hoàn thành PLAN_FIX_2026_06_11
CHANGELOG_FIX_2026_06_11.md
PLAN_FIX_2026_06_11.md
```

Đây là **tham chiếu lịch sử** (mô tả vấn đề đã fix), không phải hardcoded credential. Tuy nhiên:
- Repo public → GitHub secret scanning có thể flag.
- Các tool tự động (GitGuardian, TruffleHog) cũng có thể alert.
- Người mới đọc docs dễ hiểu nhầm "password này còn dùng".

## Fix

### Mục 2.1 — Replace text trong 2 file MD

**File:** `CHANGELOG_FIX_2026_06_11.md`

Mở file. Tìm tất cả `&lt;REDACTED&gt;` (text literal, không có dấu cách). Replace bằng `<REDACTED>`.

Quick command (chạy tại thư mục gốc repo):
```bash
sed -i 's/&lt;REDACTED&gt;/<REDACTED>/g' CHANGELOG_FIX_2026_06_11.md
```

**File:** `PLAN_FIX_2026_06_11.md`

Tương tự:
```bash
sed -i 's/&lt;REDACTED&gt;/<REDACTED>/g' PLAN_FIX_2026_06_11.md
```

### Mục 2.2 — Verify text đã sạch

```bash
grep -r "&lt;REDACTED&gt;" . --include="*.md" --include="*.ts" --include="*.js" --include="*.jsx" --include="*.py" 2>&1
```

Phải trả về **rỗng** (chỉ có thể còn trong `node_modules` hoặc `.git/objects` — không xét).

### Mục 2.3 — Quyết định force-push git history (TÙY CHỌN)

**Phương án A (an toàn nhất):** chạy filter-repo lần nữa để xóa khỏi history:

```bash
# Backup trước
cp -r . /tmp/qlksvkl-backup-$(date +%Y%m%d)

# Thêm replacement vào filter-repo
echo '&lt;REDACTED&gt;==><REDACTED>' > /tmp/replace.txt
git filter-repo --replace-text /tmp/replace.txt --force

# Re-add remote (filter-repo xóa remote)
git remote add origin https://github.com/BongBang104/quan-ly-ksvkl.git

# Force push
git push origin --force --all
git push origin --force --tags
```

**Cảnh báo:** sau force-push, mọi máy có clone repo phải chạy:
```bash
git fetch --all
git reset --hard origin/main
```

**Phương án B (đơn giản hơn):** chỉ commit fix bình thường, không force-push. Password cũ vẫn còn trong git history của các commit cũ — nhưng password đã không còn hợp lệ (Z1 đã dùng random) → risk thấp.

Mặc định: **Phương án B** cho sprint này (vì nhanh, không gây gián đoạn). Nếu sau này GitHub secret scanning báo alert, làm Phương án A.

## Xác minh

1. `grep -r "&lt;REDACTED&gt;" . --exclude-dir=node_modules --exclude-dir=.git` → rỗng.

2. Commit + push:
   ```bash
   git add CHANGELOG_FIX_2026_06_11.md PLAN_FIX_2026_06_11.md
   git commit -m "docs(Z2): redact &lt;REDACTED&gt; khỏi docs MD"
   git push
   ```

3. Ghi vào CHANGELOG:
   ```
   [DONE] Mục 2 — Cleanup &lt;REDACTED&gt; trong docs MD — <ngày>
   - Replace bằng <REDACTED> trong CHANGELOG_FIX_2026_06_11.md, PLAN_FIX_2026_06_11.md
   - Git history giữ nguyên (Phương án B) — password cũ đã không còn hợp lệ
   ```

---

# Smoke test cuối

Sau khi xong cả 2 mục:

```bash
# Build pass
npm run build && echo "✓ Frontend build clean"

# Backend build pass
cd backend && npx nest build && echo "✓ Backend build clean" && cd ..

# Analytics tests pass
cd analytics && pytest tests/ -q && cd ..

# Code sạch
grep -r "&lt;REDACTED&gt;" . --exclude-dir=node_modules --exclude-dir=.git && echo "✗ STILL HAS TEXT" || echo "✓ Clean"

# JSX RosterGrid đúng
sed -n '163,167p' src/components/RosterGrid.js
# Phải thấy: 2 dòng </div> liền nhau
```

Tất cả phải PASS → sẵn sàng setup staging.

---

# Sau khi xong

Khi 2 mục này pass:
1. Push commits lên repo.
2. Ping audit lần 4 (mình rà soát confirm build pass).
3. Tiếp tục `seed_staging.sql` mình đã viết riêng — chạy nó để có data thử trong DB staging.
4. Bắt đầu Phần A của `PLAN_STAGING_TEST.md`.

**KHÔNG cần làm gì khác trong sprint này.** Chỉ 2 việc trên.
