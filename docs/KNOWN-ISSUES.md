# Known issues and risks

## KI-001 — Full product acceptance chưa đạt
- **Severity:** High
- **Description:** test regression chứng minh code slices, không chứng minh toàn bộ 32 H và 12 E.
- **Evidence:** `delivery/BACKLOG.csv` còn 107 Backlog, 61 In progress, 2 Implemented.
- **Suggested fix:** thực hiện acceptance theo `docs/TODO.md`, cập nhật checkpoint/backlog.
- **Status:** Open

## KI-002 — Live provider/email chưa verify
- **Severity:** High
- **Description:** transport tests dùng fake/injected fetch; không có provider receipt thật hoặc external email proof.
- **Root cause:** chưa có credentials/account môi trường test trong checkout.
- **Workaround:** deterministic fake tests; không đưa secret vào repo.
- **Status:** Blocked / UNKNOWN / NEEDS VERIFICATION

## KI-003 — H32.05 thiếu policy xóa/lưu giữ
- **Severity:** High
- **Description:** retention duration, legal hold, delete scope, closure và RPO/RTO chưa được phê duyệt.
- **Relevant files:** `delivery/decisions/H32_RETENTION_CLOSURE.md`.
- **Workaround:** chỉ dùng audit export và disposable restore; không implement purge suy đoán.
- **Status:** Decision required

## KI-004 — HiChat parity chưa thể khẳng định
- **Severity:** Medium
- **Description:** `research/` chứa khảo sát/spec, không phải source hay receipt của HiChat nội bộ.
- **Suggested fix:** PO duyệt acceptance screenshots/flows từ reference và ghi evidence riêng.
- **Status:** Open

## KI-005 — Browser signup/widget acceptance chưa đủ
- **Severity:** High
- **Description:** backend HTTP/PG tests có; browser flow, email, refresh/switch và exact error UX chưa được nghiệm thu trong snapshot này.
- **Status:** Open; lỗi “Không thể kết nối” trong conversation là UNKNOWN / NEEDS VERIFICATION.

## KI-006 — Crawler coverage giới hạn
- **Severity:** Medium
- **Description:** static HTTP/sitemap/parser slices có test; JS-rendering và provider/source breadth chưa chứng minh.
- **Status:** In progress

## KI-007 — No lint/typecheck scripts
- **Severity:** Low
- **Description:** package có `build` (chạy `tsc --noEmit` + Vite) nhưng không có script `lint` hoặc `typecheck` độc lập.
- **Workaround:** dùng `npm run build`; ghi rõ gate trong TESTING.
- **Status:** Open

## KI-008 — Duplicate suffixed files
- **Severity:** Low
- **Description:** `src/web/env.d.ts` và `src/web/env.d 2.ts`, `src/web/inbox-drafts.ts` và `src/web/inbox-drafts 2.ts`, `tests/inbox-drafts.test.ts` và `tests/inbox-drafts.test 2.ts` là cặp giống nhau. Import hiện tại trỏ file không suffixed; không tự xóa file vì có thể là WIP.
- **Suggested fix:** xác nhận owner rồi dọn duplicate ở một commit riêng.
- **Status:** Open

## KI-009 — Production deployment chưa finalized
- **Severity:** High
- **Description:** chưa có bằng chứng hosting/CI/CD/staging acceptance trong checkout.
- **Status:** Open
