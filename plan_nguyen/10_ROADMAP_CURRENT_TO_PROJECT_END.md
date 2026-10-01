# Roadmap công việc của Nguyên — từ trạng thái hiện tại đến cuối dự án

**Dự án:** GoTek Chatbot  
**Người phụ trách:** Nguyên  
**Phạm vi trong bảng Lark:** UI, tích hợp browser và demo  
**Trạng thái tài liệu:** IN PROGRESS — kế hoạch thực thi, chưa phải bằng chứng nghiệm thu  
**Nguồn phân công:** bảng `gotek-chatbot-task-list`, sheet `Phân công` và `Demo 2 tuần`  
**Design reference:** [11_FIGMA_DESIGN_BASELINE.md](11_FIGMA_DESIGN_BASELINE.md)  
**Ngày lập:** 2026-09-29

## 1. Kết luận phân công

Lark phân công Nguyên phụ trách nhóm UI/browser/demo trong 10 ngày. Các task của Nguyên là:

| Ngày | Task | User story / requirement trong Lark | Phạm vi code và evidence chính |
|---|---|---|---|
| D1 | G01 | US-01/32, H27 | Baseline UI, route map, 5 UI states |
| D2 | G02 | US-04/05/34, H01/H02 | Login, session, workspace switch |
| D3 | G03 | US-09/10/11, H10 | Knowledge UI, lifecycle, retrieval |
| D4 | G04 | US-14/15/16, H04/H07 | Channel wizard, widget config, SDK/browser |
| D5 | G05 | US-17/20, H03 | Inbox, takeover, public reply, internal note |
| D6 | G06 | US-19/24/31, H03/H08/H23 | AI state, quota, jobs và lỗi vận hành trên UI |
| D7 | G07 | US-32/33/34, H01/H03/H08 | Core flow tích hợp xuyên module |
| D8 | G08 | US-35/34, H27 | Responsive, keyboard, accessibility |
| D9 | G09 | US-35 | Browser acceptance và session/origin checks |
| D10 | G10 | US-32/38 | Demo, rehearsal, evidence và handoff |

Các sheet hiện còn ghi `bản nháp` hoặc `cần rà soát`. Vì vậy mọi task chỉ được chuyển sang `DONE` khi có code, test, browser evidence và owner sign-off.

## 2. Baseline repo trước khi code

Source hiện tại phải được đọc theo cấu trúc thật:

- Backend: `backend/src/`, `backend/db/migrations/`, `backend/scripts/`, `backend/tests/`.
- Frontend: `frontend/src/`, `frontend/tests/`.
- Evidence và backlog: `delivery/`.
- Handoff/status: `docs/PROJECT-STATUS.md`, `docs/HANDOFF.md`.

Một số tài liệu cũ vẫn tham chiếu `src/server` và `src/web`; đây là đường dẫn lịch sử, không phải đường dẫn source hiện tại. Không đổi hoặc xóa các file duplicate/mirror trong khi chưa có quyết định source of truth.

Repo đang ở **documentation pause**. Trước khi owner mở lại development, Nguyên chỉ làm audit tài liệu, route map, test plan và evidence plan; không tự mở H/E feature mới.

## 3. Lộ trình D1–D10

### D1 — G01: Baseline UI và phạm vi

**Files:** `frontend/src/App.tsx`, `frontend/src/api/api.ts`, `frontend/src/components/common/`, `frontend/src/styles/`, các screen trong `frontend/src/screens/`.

**Việc làm:**

1. Lập bảng route → screen → API → role.
2. Kiểm tra Loading, Empty, Populated, Error, Permission Denied.
3. Ghi lại màn hình đang nối API thật và màn hình chỉ là skeleton.
4. Chốt viewport evidence: desktop 1440/1280, tablet 768, mobile 390/360.

**Kết quả:** `delivery/evidence/nguyen-d1-ui-baseline-*` và route/state inventory.

### D2 — G02: Login và workspace

**Files:** `frontend/src/screens/auth/Auth.tsx`, `frontend/src/App.tsx`, `frontend/src/hooks/usePath.ts`, `frontend/src/api/api.ts`, `frontend/src/screens/settings/GeneralSettings.tsx`.

**Acceptance:** login/logout/reset; session hết hạn; role menu; workspace switch; remount dữ liệu theo workspace; không hiển thị draft/cache workspace cũ.

**Không làm:** thay đổi password/session contract hoặc thêm OAuth khi chưa có decision.

### D3 — G03: Knowledge UI

**Files:** `frontend/src/screens/knowledge/Knowledge.tsx`, `KnowledgeRetrievalPreview.tsx`, `Lifecycle.tsx`, `WebSources.tsx`; backend contract đối chiếu với `backend/src/modules/knowledge/` và `web-sources/`.

**Acceptance:** draft không tự publish; `READY` và `PUBLISHED` hiển thị riêng; `PUBLIC` không lẫn `INTERNAL`; lỗi import/fetch có trạng thái rõ; retrieval preview không vượt tenant.

### D4 — G04: Channel và Widget

**Files:** `frontend/src/screens/channels/Channels.tsx`, `ChannelConfiguration.tsx`, `WidgetPreview.tsx`; `backend/src/modules/chat/channels.ts`, `backend/src/modules/widget/widget.ts`, `backend/public/sdk.js`.

**Acceptance:** tạo channel; cấu hình origin; agent assignment; business hours; pre-chat; widget preview; installation snippet; origin sai bị chặn; provider secret không xuất hiện trong browser.

### D5 — G05: Inbox và staff handoff

**Files:** `frontend/src/screens/inbox/Inbox.tsx`, `inbox-drafts.ts`, `backend/src/modules/chat/inbox.ts`, `chat-store.ts`.

**Acceptance:** filter conversation; hiển thị riêng `status` và `reply_owner`; takeover dùng owner version; internal note không ra visitor; retry không nhân đôi message; draft được giữ khi lỗi gửi.

### D6 — G06: AI, quota và job state trên UI

**Files:** `frontend/src/screens/settings/Usage.tsx`, `Jobs.tsx`, `Inbox.tsx`; backend contract đối chiếu với `backend/src/modules/ai/` và `jobs/`.

**Acceptance:** hiển thị reserved/confirmed/unknown quota; job `queued/running/retry/succeeded/unknown/dead`; provider error không bị trình bày thành thành công; trạng thái unknown yêu cầu đối soát.

### D7 — G07: Core flow integration

**Flow:**

```text
Login → Workspace → Channel → Widget visitor → Message
→ AI hoặc Handoff → Staff takeover → Public reply
→ Usage/Quota → Audit
```

**Acceptance:** chạy trên hai workspace độc lập; không lẫn conversation, knowledge, draft, menu hoặc audit context; takeover trong lúc AI xử lý không commit câu trả lời cũ.

### D8 — G08: Responsive và accessibility

**Files:** `frontend/src/styles/style.css`, `tokens.css`, `components/common/`, các screen đã được ưu tiên.

**Acceptance:** keyboard navigation; focus modal; label đọc được; error gắn đúng field; mobile keyboard không che CTA; không dùng màu là tín hiệu duy nhất; layout không vỡ ở 360px.

### D9 — G09: Browser acceptance

**Phạm vi:** browser flow thật với local fixture, không suy ra production parity.

**Kịch bản:** signup/login; switch workspace; tạo channel; mở widget đúng origin; reload visitor session; domain sai; gửi message; handoff; takeover; reply; internal note; quota/job/audit readback.

**Evidence:** screenshot/video/log có timestamp, workspace, role, URL và kết quả; redact token/cookie/secret.

### D10 — G10: Demo và handoff

**Kết quả cần bàn giao:**

- Demo script theo đúng thứ tự core flow.
- Evidence index trong `delivery/evidence/`.
- Defect list có severity, owner, reproduction và trạng thái.
- Cập nhật `docs/PROJECT-STATUS.md`, `docs/HANDOFF.md`, `delivery/BACKLOG.csv`.
- Các mục chưa có live/browser/provider evidence ghi `UNKNOWN / NEEDS VERIFICATION`.

## 4. Lộ trình sau D10 đến cuối dự án

### Phase A — P0.1 Core acceptance

**Mục tiêu:** đóng acceptance cho luồng core trên hai workspace trước khi mở feature mới.

- Fresh signup/login và workspace fixture.
- Channel/origin/widget visitor.
- Knowledge publish/retrieve boundary.
- AI handoff/takeover/late result fence.
- Quota reservation/settlement/unknown.
- Audit và restore evidence.

**Owner của Nguyên:** browser flow, UI state, screenshot/video, cross-tenant readback và defect reproduction. Backend contract do owner module xác nhận.

### Phase B — P0.2 Live provider và vận hành

Chỉ bắt đầu khi có credential test hợp lệ và owner phê duyệt:

- Provider receipt thật.
- Token usage và quota đối soát.
- Timeout/network failure/unknown outcome.
- External email receipt.
- Staging smoke test.

Nguyên không lưu credential vào repo và không tự gọi production/provider thật nếu chưa được cấp quyền.

### Phase C — Hoàn thiện nhóm H01–H13, H16, H22–H23, H28, H32

Nguyên tập trung acceptance UI/browser cho các nhóm đã có backend slice:

- H01/H02: auth và workspace.
- H03–H07: inbox, channel, widget, pre-chat, assignment.
- H08–H12: AI, rules, knowledge, web source.
- H13/H16: contacts, members, roles.
- H22/H23/H28/H32: audit, quota, platform, jobs, restore/privacy.

Không chuyển trạng thái nhóm sang `DONE` chỉ vì một test hoặc một screen pass.

### Phase D — Backlog H14–H32 còn thiếu

Các nhóm H14, H15, H17–H21, H24–H27, H29–H31 hiện là backlog hoặc TODO. Thứ tự đề xuất:

1. Chốt requirement và acceptance evidence.
2. Backend contract và tenant/security boundary.
3. UI state và role matrix.
4. Browser acceptance.
5. Evidence và sign-off.

Nguyên chỉ nhận phần UI/browser/demo sau khi backend owner cung cấp contract ổn định.

### Phase E — E01–E12 sau core

Các extension E01–E12 chỉ mở sau khi core flow, privacy, quota, restore và provider gate đạt yêu cầu. Mỗi extension cần có:

- owner và decision log;
- API/data contract;
- permission matrix;
- negative/cross-tenant cases;
- UI evidence;
- rollback hoặc disable behavior.

Không triển khai Lark Wiki, CRM lead, billing, omnichannel hoặc connector giao dịch chỉ dựa trên tên epic.

### Phase F — Release và project close

Điều kiện kết thúc dự án:

- Build/typecheck/test được chạy lại từ commit bàn giao.
- Browser acceptance có evidence cho flow được cam kết.
- Provider/email/staging receipt được phân loại rõ.
- H32 retention/delete/closure có policy owner.
- Restore drill và RPO/RTO được owner xác nhận.
- Backlog, PROJECT-STATUS, HANDOFF và CHANGELOG đồng bộ.
- Không còn secret, cookie, token, `.env` hoặc runtime artifact trong commit.
- Production deployment chỉ thực hiện khi có authorization riêng.

## 5. Lệnh kiểm tra của Nguyên

Chạy từ root repo, theo thứ tự và ghi kết quả vào evidence:

```powershell
npm run build:all
npm run test:frontend
npm run test:backend
npm run db:restore-drill
```

`test:backend` yêu cầu PostgreSQL local và chạy serial. Nếu không chạy được, phải ghi rõ lý do và không đánh dấu acceptance.

## 6. Definition of Done cho từng task

- Có file/source cụ thể đã thay đổi hoặc được xác nhận không cần thay đổi.
- Có API/role/tenant contract được đối chiếu.
- Có happy path và negative path.
- Có browser screenshot hoặc video khi task thuộc UI/browser.
- Có test hoặc lý do rõ ràng vì sao chưa thể test.
- Không làm lộ internal note, private knowledge, provider secret hoặc tenant khác.
- Có trạng thái `DONE`, `DONE BUT NEEDS VERIFICATION`, `IN PROGRESS`, `TODO` hoặc `UNKNOWN` đúng bằng chứng.
- Cập nhật handoff khi dừng giữa chừng.

## 7. Rủi ro và quyết định đang chờ

- Documentation pause chưa được owner gỡ.
- Provider live receipt và email delivery: `UNKNOWN / NEEDS VERIFICATION`.
- Browser parity với HiChat: `UNKNOWN / NEEDS VERIFICATION`.
- H32 retention/delete/closure chưa có policy owner.
- Platform Agent billing/quota ownership chưa chốt.
- Source-of-truth cho migration/script/SDK mirror cần được xác nhận.

Không giải quyết các điểm trên bằng cách tự suy diễn hoặc mở rộng scope.
