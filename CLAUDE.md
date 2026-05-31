# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Quy ước riêng cho dự án quan-ly-ksvkl

### Tech stack đã chốt

- Backend: NestJS + TypeORM + PostgreSQL (KHÔNG dùng Prisma).
- Analytics: Python FastAPI, CHỈ ĐỌC DB.
- Frontend: React + Vite.

### Quy ước database

- Tên cột trong DB: `camelCase` có dấu nháy kép (TypeORM convention),
  ví dụ `"controllerId"`, `"isNight"`.
- Schema do `backend/migration.sql` quản lý. `synchronize` PHẢI là `false`.
- Analytics đọc các bảng do TypeORM tạo — KHÔNG được ghi.

### Quy ước mật khẩu & bảo mật

- TUYỆT ĐỐI không bao giờ commit mật khẩu plain-text, kể cả seed/migration.
- Mọi mật khẩu lưu trong DB phải là bcrypt hash (`$2...`).
- JWT_SECRET phải ≥ 32 ký tự; CORS không bao giờ dùng `*`.
- Endpoint thao tác dữ liệu nhạy cảm (tạo/sửa/xóa nhân sự, publish lịch)
  phải có cả `JwtAuthGuard` và `RolesGuard`.

### Mô hình vị trí (KSVKL)

- 4 vị trí điều hành: APP, CTL, TWR, GCU.
- CTL = vùng trời dưới FL245 (trên FL245 do ACC HCM/HN, ngoài phạm vi).
- Năng định: "full" hoặc danh sách vị trí riêng lẻ.
- Một ca trực có thể chứa NHIỀU phiên vị trí (luân phiên).
- Phiên liền kề cùng vị trí (không giải lao) được gộp khi tính ngồi vị trí.

### Ngưỡng quy định

- Mọi ngưỡng (giờ nghỉ, recency, ...) đọc từ cấu hình, KHÔNG hard-code.
- Ngưỡng phải đối chiếu với quy định VATM/CAAV và ICAO hiện hành.
- Đây là hệ thống an toàn hàng không — luôn coi công cụ là HỖ TRỢ,
  không thay thế quy trình phê duyệt chính thức.

### Khi sửa code

- Ưu tiên bảo mật trước, mọi thay đổi.
- Đọc `FIX_PLAN.md` để biết kế hoạch khắc phục đang ở đâu.
- Sau khi xong một mục, ghi vào `CHANGELOG_FIX.md`.
