# Tiến độ Ngày 1 — Nguyên

**Ngày:** 29/09/2026  
**Dự án:** GoTek Chatbot  
**Nguồn kế hoạch:** `gotek-chatbot-task-list.xlsx` → sheet `Task chi tiết`  
**Phạm vi hôm nay:** `DT-009`, `DT-012`, `DT-015`, `DT-016`, `DT-018`

## Kết luận nhanh

N1 baseline đã hoàn thành trên PostgreSQL disposable local: fixture A/B seed/reset được, full backend 170/170 pass, frontend 5/5 pass, build pass và runtime health/database read-only pass. DT-012 vẫn cần quyết định PO/Tech Lead; browser evidence chưa được coi là hoàn tất chỉ từ API test.

## Việc đã làm

1. Đọc trạng thái dự án và handoff hiện tại; xác nhận MVP vẫn `IN PROGRESS`, chưa được coi là production-ready.
2. Đối chiếu 5 task chi tiết Ngày 1 với source hiện tại:
   - Auth/signup/verify/login/logout có route và màn hình frontend.
   - Workspace create/switch có backend/frontend liên quan.
   - Code/test có tenant scope, membership và fixture dùng cho integration test.
   - Provider/quota/retention vẫn còn quyết định hoặc acceptance gate chưa chốt.
3. Kiểm tra cấu hình database mà không ghi hoặc hiển thị secret:
   - `backend/.env` có `DATABASE_URL` trỏ tới PostgreSQL của Supabase.
   - Runtime dùng thư viện `pg` kết nối trực tiếp, không dùng Supabase SDK.
   - Supabase Session Pooler hiện kết nối được; một số backend test vẫn hardcode local PostgreSQL socket `55432`.
4. Chạy kiểm tra build/frontend:
   - `npm run build:all` — **PASS**; backend typecheck pass, frontend Vite build pass, 1928 modules transformed.
   - `npm run test:frontend` — **PASS 5/5** sau khi chạy ngoài sandbox do Node/esbuild bị `spawn EPERM` trong sandbox.
5. Chạy backend integration suite:
   - Lần chạy local disposable cuối: `npm run test:backend` — **PASS 170/170**.
   - Các lỗi 500 ban đầu được truy nguyên và sửa: GET `/api/me` gọi `res.json()` khi `res=null`; test harness Unix socket/Windows CLI portability.
6. Khắc phục bằng Supabase Session Pooler:
   - Đã kiểm tra Pooler `aws-0-ap-southeast-2.pooler.supabase.com:5432` và truy vấn `SELECT 1` thành công.
   - Đã cập nhật `backend/.env` local sang Session Pooler và restart backend.
   - Backend đang lắng nghe cổng `4317`; `/api/health` trả `200`, app query `SELECT 1` trả `APP_DB_RESULT=1`.
   - Không chạy toàn bộ backend integration suite trên Supabase dùng chung để tránh test ghi dữ liệu ngoài môi trường test.
7. Thực thi N1 bằng code/config:
   - Tạo `backend/scripts/workshop-fixture.ts` với hai mode `--seed` và `--reset`.
   - Thêm `npm run fixture:seed` và `npm run fixture:reset` ở root/backend.
   - Safety guard bắt buộc `GOTEK_FIXTURE_DATABASE_URL`, `GOTEK_FIXTURE_DB_KIND=disposable-test-only` và từ chối Supabase shared/pooler.
   - Seed đã chạy Workspace A/B, role, channel/origin, visitor, conversation states, public/internal messages và manifest không secret.
   - Reset đã xóa đúng UUID trong manifest theo thứ tự FK; kiểm tra còn 0 workspace/channel fixture.
8. Chạy targeted tests không ghi database:
   - `inbox-resume-ai`, `business-hours`, `widget-embed`, `sdk-contract`, `provider-receipt-contract` — **PASS 9/9**.
   - Safety guard với Supabase pooler giả lập — **PASS**, script từ chối đúng với `REFUSED`.
9. Bật Docker local và chạy `postgres:16-alpine` + `redis:7-alpine`; cả hai service healthy.
10. Sửa test harness để dùng TCP `127.0.0.1:55432` trên Windows thay vì Unix socket `/tmp`.
11. Sửa lỗi thật GET `/api/me` truyền `res=null` nhưng controller gọi `res.json()`, làm auth/workspace tests trả 500.
12. Seed fixture A/B thành công, chạy targeted integration 9/9, full backend 170/170, sau đó reset fixture; kiểm tra còn `workspaces=0`, `channels=0`.
13. Sửa path evidence restore và shutdown assertion của CLI worker cho Windows; full suite sau sửa đạt 170/170.

## Trạng thái từng task

| Task | Nội dung | Trạng thái hôm nay | Ghi chú |
|---|---|---|---|
| DT-009 | Tạo fixture hai workspace dùng chung cho test | `DONE — LOCAL VERIFIED` | Fixture A/B seed/reset thành công; manifest đã redact, reset kiểm tra còn 0 workspace/channel fixture. |
| DT-012 | Chốt provider, quota và retention decisions | `BLOCKED — DECISION NEEDED` | Provider live receipt/credential và H32 retention owner/policy chưa được chốt. Không tự quyết định thay PO/Tech Lead. |
| DT-015 | Signup, verify, login và logout | `VERIFIED — LOCAL API` | Auth/verification integration nằm trong full backend 170/170; browser acceptance vẫn cần chạy riêng. |
| DT-016 | Tạo và chuyển workspace — BE/API | `VERIFIED — LOCAL API` | H02 workspace isolation và cross-tenant switch pass trong full backend suite. |
| DT-018 | Tạo và chuyển workspace — QA/Evidence | `DONE — LOCAL EVIDENCE` | Happy path, permission, membership revoke và cross-tenant cases đều pass local; browser screenshot chưa có. |

## Những gì chưa làm

- Chưa tạo hoặc thay đổi migration/database schema.
- Chưa chạy browser flow signup → workspace → inbox.
- Chưa có screenshot/network evidence cho task Ngày 1.
- Chưa chốt provider, quota, retention policy hoặc owner.

## Blocker cần xử lý trước khi tiếp tục

1. Thu browser evidence cho DT-015/DT-016/DT-018 nếu workshop yêu cầu nghiệm thu UI.
2. Chốt provider, quota và retention với PO/Tech Lead cho DT-012.
3. Không dùng Supabase shared để chạy fixture/reset; local disposable đã được xác minh.

## Lệnh đã chạy

```powershell
npm run build:all
npm run test:frontend
npm run test:backend
npm run fixture:seed
npm run fixture:reset
```

## Trạng thái cuối ngày

**Ngày 1: `DONE — N1 BASELINE LOCALLY VERIFIED`**  
Fixture, contract/matrix, database migration, seed/reset, full backend suite, frontend suite và build đã pass. Chỉ DT-012 và browser/PO acceptance còn mở; không gắn các phần đó thành DONE giả.
