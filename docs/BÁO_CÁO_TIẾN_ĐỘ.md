# BÁO CÁO TIẾN ĐỘ DỰ ÁN GOTek Chatbot

- **Ngày lập báo cáo:** 29/09/2026
- **Nguồn đối chiếu:** Google Sheets `gotek-chatbot-task-list.xlsm` (các sheet Phân công, UC chi tiết, Task, Task chi tiết, Lịch 2 tuần, Hợp đồng liên module, README, Demo 2 tuần), mã nguồn checkout hiện tại, `docs/PROJECT-STATUS.md`, `docs/HANDOFF.md`, `docs/TESTING.md`, `delivery/BACKLOG.csv` và `delivery/evidence/`.
- **Trạng thái tổng:** **MVP — IN PROGRESS; đang ở documentation pause.** Chưa có cơ sở tuyên bố hoàn thành toàn bộ H01–H32/E01–E12, HiChat parity, staging hoặc production.

## 1. Kết luận điều hành

Dự án đã có nền tảng backend đáng kể và nhiều lát cắt đã được kiểm thử local bằng PostgreSQL thật. Các bằng chứng gần nhất ghi nhận build/typecheck PASS, regression serial **175/175**, P0.1 core focused **9/9**, restore drill **55 bảng PASS**, jobs recovery **1/1**, knowledge/widget boundary **8/8**, Platform Agent audit **9/9**. Đây là bằng chứng cho các lát cắt triển khai, không phải nghiệm thu sản phẩm hoàn chỉnh.

Workbook được cung cấp mô tả một workshop/demo 10 ngày, không phải nhật ký thực thi. Phân công là 3 người, mỗi người 54 giờ kế hoạch + 6 giờ dự phòng (60 giờ), 10 task/người, độ khó cao. Sheet `Demo 2 tuần` có 30 task N01–N10, L01–L10, G01–G10; **tất cả đang `Planned`**, chưa có ngày lịch thực tế, receipt hoặc evidence cập nhật trong bảng. Vì vậy tiến độ workshop hiện được xem là **kế hoạch chưa bắt đầu/ chưa cập nhật trạng thái**, không cộng vào phần trăm hoàn thành.

## 2. Tiến độ có bằng chứng trong repository

### Đã triển khai và có xác minh local

- Monorepo đã được tổ chức thành `backend/`, `frontend/`, `infra/`, `gitops/`, `mobile/` và script điều phối root.
- Backend Express/TypeScript strict, PostgreSQL 16 qua `pg`, SQL migrations, Argon2/cookie session, worker/job model và RLS/tenant scoping đã có.
- Auth: signup/verify/reset token single-use/expiry, session revoke và membership boundary.
- Workspace/tenant: membership-derived tenant, cross-tenant denial và các kiểm tra RLS/permission.
- Channel/widget: origin/token validation, visitor session, idempotent message, capacity/takeover ownership fence và visitor profile validation.
- Inbox/chat/contact: các lát cắt conversation, assignment, public reply/internal note, business hours và contact visibility.
- Knowledge: import/extract, draft/version lifecycle, processing/chunking, publish `PUBLIC`, lexical/semantic retrieval, citations và web-source/parser/sitemap/schedule slices.
- AI/platform: provider/model registry, capability grants, expiry fence, provider error normalization, AI worker, grounding, token metering, quota reservation/settlement và Platform Agent actor/session/idempotency/recovery.
- Jobs/operations: durable jobs, lease fencing, retry/dead-letter/unknown outcome, NULL-lease recovery, audit pagination/export và restore quarantine/hash drill.
- Frontend có các màn auth, workspace/settings, knowledge/web sources, rules, channels/widget, inbox, contacts, platform, usage/jobs/support/audit; tuy nhiên chưa có browser acceptance đầy đủ cho các module.

### Bằng chứng validation gần nhất

| Kiểm tra | Kết quả | Giới hạn |
|---|---:|---|
| TypeScript + Vite build | PASS | Không chứng minh production readiness |
| Backend serial regression | 175/175 PASS | Không thay thế browser/live provider |
| P0.1 core focused | 9/9 PASS | Provider là injected/local fixture |
| Jobs NULL-lease recovery | 1/1 PASS | Chưa phải crash/restart production |
| Knowledge/widget boundary | 8/8 PASS | Không chứng minh HiChat private backend |
| Platform Agent audit | 9/9 PASS | Billing/quota ownership còn UNKNOWN |
| Restore drill | PASS, 55 tables | Chưa chứng minh RPO/RTO production/object storage |
| Lint/coverage | Chưa có | Không có lint script hoặc coverage report chuẩn |

Evidence chi tiết: `delivery/evidence/build-after-parallel-hardening-2026-09-27.txt`, `core-after-parallel-hardening-2026-09-27.txt`, `p0-core-acceptance-2026-09-27.txt`, `p0-jobs-recovery-2026-09-27.txt`, `p0-knowledge-widget-2026-09-27.txt`, `p0-platform-agent-2026-09-27.txt` và `restore-after-parallel-hardening-2026-09-27.txt`.

## 3. Trạng thái theo phạm vi H/E

Đây là trạng thái nhóm, không phải phần trăm hoàn thành:

- **IN PROGRESS:** H01–H13, H16, H22–H23, H28, H32; E01, E06.
- **TODO:** H14–H15, H17–H21, H24–H27, H29–H31; E02–E05, E07–E12.
- **DONE:** chỉ các slice cụ thể có evidence trong `PROJECT-STATUS`, không có epic H/E nào được nghiệm thu toàn bộ.
- Backlog hiện có **170 dòng: 107 Backlog, 61 In progress, 2 Implemented**. Các con số này không được dùng làm tỷ lệ product completion.

## 4. So khớp workbook workshop với trạng thái thực tế

### Phân công và capacity

- Nam: Auth, AI, provider, quota; 10 task; 54h + 6h dự phòng; rủi ro chính là provider live chưa verify.
- Lợi: Knowledge, widget, inbox, dữ liệu; 10 task; 54h + 6h; rủi ro privacy và trạng thái chat.
- Nguyên: UI, browser integration, demo; 10 task; 54h + 6h; QA kỹ thuật chia cho Nam/Lợi.
- Capacity giả định: 10 ngày × 6 giờ/ngày = 60 giờ/người; lịch thực tế **chưa chốt**.

### Lịch workbook dự kiến

- D1: môi trường, quyền demo, fixture, contract và UI baseline.
- D2–D5: login/channel, import/publish/retrieval, widget/message, AI/provider, usage/quota và inbox/takeover.
- D6–D7: kiểm thử âm, reset/restore, E2E năm module và đối soát AI.
- D8: gate E2E/browser, AI/quota/privacy.
- D9: dự phòng sửa blocker.
- D10: freeze và diễn tập.

Các task N/L/G đều đang `Planned`; dependency, receipt, screenshot/video và pass/fail chưa được ghi trong workbook. Đây là **kế hoạch dự kiến**, không phải bằng chứng đã hoàn thành.

## 5. Khoảng trống và blocker hiện tại

1. **Provider/email live:** cần credential/account test được cấp; chưa có receipt thật, usage đối chiếu hoặc email delivery proof.
2. **Platform Agent billing/quota:** chưa chốt turn platform tính vào workspace quota hay platform budget; route chưa ghi `usage_operations`/`ai_usage_ledger` cho policy này.
3. **H32.05 retention/closure:** retention, legal hold, delete scope, closure, object/vector handling và RPO/RTO chưa có owner sign-off; không được tự viết destructive purge.
4. **Browser acceptance:** chưa chạy đầy đủ signup/login → workspace → knowledge → widget → inbox → takeover → usage trên browser; lỗi signup lịch sử vẫn `UNKNOWN / NEEDS VERIFICATION`.
5. **Web crawler:** static HTTP/parser/sitemap có evidence; JS-rendered crawler và provider breadth chưa chứng minh.
6. **HiChat parity:** research screenshots/spec là nguồn tham chiếu UX, không chứng minh implementation hoặc private API của HiChat.
7. **Staging/production:** hosting, CI/CD, domain, release approval và production SLA chưa được xác nhận.
8. **Working tree:** checkout hiện có thay đổi chưa commit (`backend/package.json`, `frontend/src/screens/auth/Auth.tsx`, `frontend/src/screens/auth/auth.css`, `package.json`) và file mới dưới `backend/docs/`, `backend/scripts/seed-data.ts`; cần owner review trước khi coi snapshot là sạch.

## 6. Dự kiến tiến độ và điều kiện hoàn thành

### P0 — bắt buộc trước demo/release

1. Chốt documentation checkpoint và mở lại development có chủ đích.
2. Chạy fresh P0.1 trên hai workspace/fixture và ghi evidence browser/API/DB.
3. Với credential hợp lệ, chạy P0.2 provider receipt, timeout/network/malformed, quota, revoke và redaction.
4. Chốt ADR H32.05 retention/closure và P0.4 Platform Agent billing/quota.
5. Đồng bộ `BACKLOG.csv`, `PROJECT-STATUS.md`, `HANDOFF.md` theo evidence; không đổi `Planned` thành `Done` chỉ vì code tồn tại.

### P1 — hoàn thiện MVP core

- Browser acceptance H01–H06 và widget/inbox/takeover.
- H07–H13 builder, rules, knowledge/web import, contacts trên fixture có provenance.
- H16 membership/role UI; H22 audit/security; H23 quota; H28 platform grants.
- H32 jobs/restore/privacy theo policy được duyệt.

### Sau MVP

H14–H15, H17–H21, H24–H27, H29–H31 và E02–E12 vẫn là backlog mở rộng. Chỉ mở rộng sau khi core browser/live-provider gates đạt.

### Dự kiến theo workbook 10 ngày

Nếu owner chốt ngày bắt đầu, credential và scope demo ở D1, có thể dùng lịch D1–D10 trong sheet `Lịch 2 tuần` làm kế hoạch thực thi: D1 baseline, D2–D5 tích hợp, D6–D7 âm/E2E, D8 gate, D9 sửa blocker, D10 freeze/diễn tập. **Không cam kết hoàn thành** trước khi kiểm gap D1; workbook ghi rõ cơ sở ước tính là tái dùng code và cần xác nhận năng lực.

## 7. Tiêu chí báo cáo lần sau

Mỗi task N/L/G chỉ chuyển khỏi `Planned` khi có: owner, commit/build, command hoặc browser steps, kết quả pass/fail/not-run, evidence path, blocker và trạng thái `Implemented`/`Verified`/`Accepted` tách biệt. Evidence phải redacted, không chứa secret/customer data. Cần ghi rõ live receipt, browser screenshot/video và decision owner khi đó là điều kiện acceptance.

## 8. Tài liệu liên quan

- [PROJECT-STATUS](PROJECT-STATUS.md)
- [HANDOFF](HANDOFF.md)
- [TESTING](TESTING.md)
- [KNOWN-ISSUES](KNOWN-ISSUES.md)
- [TODO](TODO.md)
- [BACKLOG](../delivery/BACKLOG.csv)
- [CHECKPOINT](../delivery/CHECKPOINT.md)

> **Lưu ý trạng thái:** Báo cáo này là snapshot ngày 29/09/2026. Những phần `UNKNOWN / NEEDS VERIFICATION`, `Planned`, `IN PROGRESS` và `TODO` phải được giữ nguyên ý nghĩa cho đến khi có evidence và owner sign-off tương ứng.
