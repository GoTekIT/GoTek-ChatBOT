# Kế hoạch 10 ngày của Nguyên — theo `Task chi tiết`

**Dự án:** GoTek Chatbot  
**Thời gian lập kế hoạch:** 2026-09-29  
**Nguồn duy nhất dùng để lập kế hoạch:** `gotek-chatbot-task-list.xlsx` → sheet `Task chi tiết`  
**Phạm vi:** 72 task chi tiết của Nguyên, từ `DT-009` đến `DT-120`

**Tiến độ thực tế ngày 29/09/2026:** xem [NGAY-1-TIEN-DO-2026-09-29.md](NGAY-1-TIEN-DO-2026-09-29.md). Không đánh dấu task hoàn thành chỉ từ việc source đã tồn tại; các task cần database/browser evidence vẫn là `IN PROGRESS` hoặc `BLOCKED / NEEDS VERIFICATION`.

**Audit workshop 2 tuần theo file demo:** xem [DEMO-WORKSHOP-AUDIT-NGUYEN.md](DEMO-WORKSHOP-AUDIT-NGUYEN.md) để biết phạm vi D-UC06–D-UC08, QA-01, BUF-03, điểm đánh giá và kế hoạch N1–N10.

## Lưu ý về capacity

Sheet `Task chi tiết` có 72 task, tổng estimate **110 ngày công**:

- QA/Evidence: 38 task.
- FE/UI: 16 task.
- BE/API: 10 task.
- PO/Plan: 8 task.

Vì 10 ngày không đủ để hoàn thành 110 ngày công một cách tuần tự, lịch dưới đây là **lịch ưu tiên và bàn giao theo dependency**, không phải cam kết rằng một người có thể hoàn thành toàn bộ estimate trong 10 ngày. Muốn đóng hết 72 task trong 10 ngày cần giảm scope, chia người hoặc được PO/Tech Lead điều chỉnh estimate.

Không dùng các sheet `Task`, `Phân công` hoặc `Demo 2 tuần` để thay đổi danh sách bên dưới. Không chuyển task sang Done chỉ vì đã có source code; phải có đúng loại evidence trong Definition of Done.

## Trạng thái code trước khi bắt đầu

- `npm run build:all`: PASS.
- `npm run test:frontend`: 5/5 PASS.
- `npm run test:backend`: chưa xác nhận do thiếu PostgreSQL/runtime config, hiện gặp `ENOTFOUND`.
- Không sửa lại backend đã có nếu chưa xác định gap; ưu tiên nối UI, chạy acceptance và ghi evidence.

## Lịch 10 ngày

### Ngày 1 — Foundation: fixture, policy, auth và workspace

**Task:** `DT-009`, `DT-012`, `DT-015`, `DT-016`, `DT-018`  
**Estimate trong sheet:** 8 ngày công  
**Priority:** P0/P1

- `DT-009` — QA/Evidence: Tạo fixture hai workspace dùng chung cho test.
- `DT-012` — QA/Evidence: Chốt provider, quota và retention decisions.
- `DT-015` — QA/Evidence: Signup, verify, login và logout.
- `DT-016` — BE/API: Tạo và chuyển workspace.
- `DT-018` — QA/Evidence: Tạo và chuyển workspace.

**Kết quả cần bàn giao:**

- Fixture Workspace A/B có thể seed lại.
- Decision log cho provider, quota, retention.
- Evidence auth và workspace switch: happy path, permission, cross-tenant, reset lỗi.
- Các blocker credential/policy có owner và deadline.

### Ngày 2 — Membership, RLS và channel/origin

**Task:** `DT-019`, `DT-021`, `DT-022`, `DT-024`, `DT-026`, `DT-027`  
**Estimate trong sheet:** 10 ngày công  
**Priority:** P0

- `DT-019` — BE/API: Mời và revoke member.
- `DT-021` — QA/Evidence: Mời và revoke member.
- `DT-022` — BE/API: Enforce tenant scope và RLS.
- `DT-024` — QA/Evidence: Enforce tenant scope và RLS.
- `DT-026` — FE/UI: Tạo channel và exact origin.
- `DT-027` — QA/Evidence: Tạo channel và exact origin.

**Kết quả cần bàn giao:**

- UI channel bind đúng API.
- Origin hợp lệ được lưu; origin sai bị chặn.
- Thành viên bị revoke mất quyền ngay.
- Workspace A không đọc hoặc sửa được dữ liệu Workspace B.
- Có screenshot/network log và test result.

### Ngày 3 — Knowledge draft và import

**Task:** `DT-029`, `DT-030`, `DT-031`, `DT-032`, `DT-033`  
**Estimate trong sheet:** 8 ngày công  
**Priority:** P1

- `DT-029` — FE/UI: Tạo knowledge draft.
- `DT-030` — QA/Evidence: Tạo knowledge draft.
- `DT-031` — BE/API: Import file và xử lý parse error.
- `DT-032` — FE/UI: Import file và xử lý parse error.
- `DT-033` — QA/Evidence: Import file và xử lý parse error.

**Kết quả cần bàn giao:**

- Tạo/sửa draft trên UI.
- File hợp lệ tạo draft; file lỗi tạo parse error có thể đọc được.
- Không publish dữ liệu parse lỗi.
- Có checksum/idempotency và negative test.

### Ngày 4 — Lifecycle và public retrieval

**Task:** `DT-035`, `DT-036`, `DT-037`, `DT-038`, `DT-039`  
**Estimate trong sheet:** 10 ngày công  
**Priority:** P1

- `DT-035` — FE/UI: Process, review, publish và rollback knowledge.
- `DT-036` — QA/Evidence: Process, review, publish và rollback knowledge.
- `DT-037` — BE/API: Retrieve public knowledge đúng workspace.
- `DT-038` — FE/UI: Retrieve public knowledge đúng workspace.
- `DT-039` — QA/Evidence: Retrieve public knowledge đúng workspace.

**Kết quả cần bàn giao:**

- Draft → READY → publish dùng đúng version.
- Rollback hoặc gap rollback được ghi rõ nếu contract chưa có.
- Chỉ knowledge public/published được trả cho visitor.
- Internal/private/cross-tenant source bị loại.
- Citation có source/version để đối chiếu.

### Ngày 5 — Web snapshot, widget session và message boundary

**Task:** `DT-040`, `DT-041`, `DT-042`, `DT-044`, `DT-045`, `DT-046`, `DT-048`, `DT-049`, `DT-051`  
**Estimate trong sheet:** 12 ngày công  
**Priority:** P0/P1

- `DT-040` — BE/API: Tạo snapshot web và review generation.
- `DT-041` — FE/UI: Tạo snapshot web và review generation.
- `DT-042` — QA/Evidence: Tạo snapshot web và review generation.
- `DT-044` — FE/UI: Mở widget đúng channel/origin.
- `DT-045` — QA/Evidence: Mở widget đúng channel/origin.
- `DT-046` — BE/API: Pre-chat fields và validation.
- `DT-048` — QA/Evidence: Pre-chat fields và validation.
- `DT-049` — BE/API: Message idempotency và conflict handling.
- `DT-051` — QA/Evidence: Message idempotency và conflict handling.

**Kết quả cần bàn giao:**

- Web snapshot không tự động vượt qua bước review/publish.
- Widget mở đúng origin và channel.
- Pre-chat required/optional validation đúng.
- Retry cùng client ID không nhân đôi message.
- Token/provider secret không xuất hiện trong browser evidence.

### Ngày 6 — Inbox, assignment, takeover và reply

**Task:** `DT-054`, `DT-055`, `DT-057`, `DT-058`, `DT-059`, `DT-060`, `DT-062`, `DT-063`  
**Estimate trong sheet:** 8 ngày công  
**Priority:** P0

- `DT-054` — QA/Evidence: Inbox theo assignment/quyền.
- `DT-055` — BE/API: Assignment theo capacity/trạng thái.
- `DT-057` — QA/Evidence: Assignment theo capacity/trạng thái.
- `DT-058` — BE/API: Agent takeover và owner version fence.
- `DT-059` — FE/UI: Agent takeover và owner version fence.
- `DT-060` — QA/Evidence: Agent takeover và owner version fence.
- `DT-062` — FE/UI: Public reply và internal note.
- `DT-063` — QA/Evidence: Public reply và internal note.

**Kết quả cần bàn giao:**

- Inbox chỉ hiển thị conversation đúng assignment/scope.
- Capacity và concurrent takeover có một winner.
- Takeover tăng owner version.
- Public reply đến visitor; internal note không đến visitor.
- Stale AI reply không được append.

### Ngày 7 — AI job, grounding, provider và citation

**Task:** `DT-066`, `DT-069`, `DT-072`, `DT-075`, `DT-078`, `DT-081`  
**Estimate trong sheet:** 8 ngày công  
**Priority:** P0

- `DT-066` — QA/Evidence: Enqueue AI job đủ điều kiện.
- `DT-069` — QA/Evidence: Grounded AI reply từ public knowledge.
- `DT-072` — QA/Evidence: Provider transport server-side.
- `DT-075` — QA/Evidence: Citation và response metadata.
- `DT-078` — QA/Evidence: Chặn stale AI response sau takeover.
- `DT-081` — QA/Evidence: Retry, dead, unknown và lease recovery.

**Kết quả cần bàn giao:**

- AI chỉ chạy khi có model/grant/source hợp lệ.
- Prompt có context public đúng tenant.
- Provider failure không lộ secret/endpoint.
- Citation đúng source/version.
- Unknown outcome không retry mù.

### Ngày 8 — Registry, grant, quota và usage

**Task:** `DT-084`, `DT-087`, `DT-090`, `DT-093`, `DT-095`, `DT-096`  
**Estimate trong sheet:** 7 ngày công  
**Priority:** P0

- `DT-084` — QA/Evidence: Provider/model registry và capability.
- `DT-087` — QA/Evidence: Grant model, expiry và revoke.
- `DT-090` — QA/Evidence: Reserve quota trước provider dispatch.
- `DT-093` — QA/Evidence: Settle/release usage theo outcome.
- `DT-095` — FE/UI: Usage report theo workspace/model/job.
- `DT-096` — QA/Evidence: Usage report theo workspace/model/job.

**Kết quả cần bàn giao:**

- Model/capability disabled hoặc expired bị chặn trước provider I/O.
- Quota reservation, confirmed, unknown đối soát được.
- Usage UI hiển thị đúng scope workspace.
- Quota denial không tạo provider side effect.

### Ngày 9 — Browser flow và trạng thái UI

**Task:** `DT-097`, `DT-098`, `DT-099`, `DT-100`, `DT-102`, `DT-103`, `DT-105`  
**Estimate trong sheet:** 12 ngày công  
**Priority:** P0

- `DT-097` — PO/Plan: Browser flow signup đến inbox.
- `DT-098` — FE/UI: Browser flow signup đến inbox.
- `DT-099` — QA/Evidence: Browser flow signup đến inbox.
- `DT-100` — PO/Plan: Browser flow AI reply và takeover.
- `DT-102` — QA/Evidence: Browser flow AI reply và takeover.
- `DT-103` — PO/Plan: Loading, empty, error và permission states.
- `DT-105` — QA/Evidence: Loading, empty, error và permission states.

**Kết quả cần bàn giao:**

- Browser flow chạy được từ login đến inbox.
- Browser flow AI reply/takeover có transcript evidence.
- Có positive, permission, cross-tenant và network failure cases.
- UI có loading/empty/error/permission state tương ứng backend.

### Ngày 10 — Regression, restore, audit, release và monitoring

**Task:** `DT-106`, `DT-107`, `DT-108`, `DT-109`, `DT-110`, `DT-111`, `DT-112`, `DT-113`, `DT-114`, `DT-115`, `DT-116`, `DT-117`, `DT-118`, `DT-119`, `DT-120`  
**Estimate trong sheet:** 27 ngày công  
**Priority:** P0

- `DT-106` — PO/Plan: Full regression core flow.
- `DT-107` — FE/UI: Full regression core flow.
- `DT-108` — QA/Evidence: Full regression core flow.
- `DT-109` — PO/Plan: Restore drill và quarantine.
- `DT-110` — FE/UI: Restore drill và quarantine.
- `DT-111` — QA/Evidence: Restore drill và quarantine.
- `DT-112` — PO/Plan: Audit/export theo quyền.
- `DT-113` — FE/UI: Audit/export theo quyền.
- `DT-114` — QA/Evidence: Audit/export theo quyền.
- `DT-115` — PO/Plan: Staging, rollback và release checklist.
- `DT-116` — FE/UI: Staging, rollback và release checklist.
- `DT-117` — QA/Evidence: Staging, rollback và release checklist.
- `DT-118` — PO/Plan: Monitoring job/provider/quota lỗi.
- `DT-119` — FE/UI: Monitoring job/provider/quota lỗi.
- `DT-120` — QA/Evidence: Monitoring job/provider/quota lỗi.

**Kết quả cần bàn giao:**

- Full regression report và danh sách defect.
- Restore/quarantine evidence.
- Audit/export permission evidence.
- Release checklist có owner/sign-off.
- Monitoring/runbook tối thiểu hoặc ghi rõ chưa có môi trường staging.

## Definition of Done theo loại task

### BE/API

- API/service/worker nối đúng contract.
- Tenant scope, permission, idempotency và audit được kiểm tra.
- Có unit/integration test.
- Có error contract và evidence side effect.

### FE/UI

- UI nối API thật hoặc stub được ghi rõ.
- Có loading, empty, success, error và permission state.
- Không lộ dữ liệu tenant khác, internal note hoặc provider secret.
- Có screenshot/video/browser evidence phù hợp.

### QA/Evidence

- Có happy path.
- Có permission và cross-tenant negative case.
- Có input/error/retry/unknown case.
- Test reproducible, có severity/owner cho defect.
- Evidence ghi ngày, build/commit, role, workspace và kết quả.

### PO/Plan

- Có scope, owner, dependency và decision log.
- Acceptance được PO/Tech Lead review.
- Không biến một test pass thành tuyên bố production-ready.

## Lệnh kiểm tra cuối mỗi ngày

```powershell
npm run build:all
npm run test:frontend
npm run test:backend
npm run db:restore-drill
```

`test:backend` và `db:restore-drill` yêu cầu PostgreSQL local. Nếu chưa có runtime, ghi `BLOCKED / NEEDS VERIFICATION`, không tự đánh dấu task hoàn thành.
