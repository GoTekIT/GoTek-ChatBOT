# Kế hoạch chi tiết N1 — Baseline, contract, fixture và permission matrix

**Dự án:** GoTek Chatbot  
**Người phụ trách:** Nguyên  
**Ngày:** 29/09/2026  
**Phạm vi:** N1 workshop 2 tuần; liên kết DT-009, DT-012, DT-015, DT-016, DT-018 trong sheet Task chi tiết.  
**Hạng mục:** chuẩn bị nền cho D-UC06, D-UC07, D-UC08, QA-01, BUF-03.

## 1. Mục tiêu cuối ngày

N1 phải trả lời được bằng evidence, không theo cảm giác:

1. Conversation đang ở AI_ACTIVE, HANDOFF_PENDING hay HUMAN_ACTIVE.
2. Actor nào được đọc, takeover, gửi public reply, internal note, resolve và reopen.
3. Widget nào thuộc workspace nào, origin nào hợp lệ, visitor token nào hợp lệ.
4. Hai tenant chạy chung code path có đọc chéo dữ liệu hay không.
5. Có thể tạo lại fixture demo sạch và reset an toàn hay không.
6. Requirement nào đã có code/test, requirement nào chỉ có source, requirement nào còn thiếu.
7. Việc nào chuyển sang N2–N6 và điều kiện nào mới được gọi là DONE.

N1 không đóng bằng một screenshot, một HTTP 200 hoặc việc source đã tồn tại. N1 cần contract, fixture, permission matrix và evidence có thể chạy lại.

## 2. Đối chiếu code hiện tại

### 2.1. Đã có

| Khu vực | Bằng chứng | Đánh giá |
|---|---|---|
| Tenant/origin widget | backend/src/modules/widget/widget.ts kiểm public key, Origin, channel/workspace enabled và gọi scope() | Có nền tảng; cần test A/B và origin sai |
| Visitor session | POST /widget-api/:key/session, token visitor tách public key, lookup theo token hash + channel | Có; cần evidence resume/expired |
| Visitor message | POST /widget-api/:key/messages, pre-chat, clientId, enqueue AI theo owner | Có; cần idempotency/retry/state evidence |
| Visitor handoff | POST /widget-api/:key/handoff, body rỗng, không cho visitor chọn agent, đổi AI → pending | Backend có; browser control còn thiếu |
| Takeover | inboxTakeover() và takeover() dùng owner_version | Có fence; cần hai actor thật |
| Public reply | appendMessage() yêu cầu HUMAN_ACTIVE và đúng assigned_to | Đúng nguyên tắc; thiếu visitor receipt |
| Internal note | Schema giới hạn internal cho agent; widget chỉ query public | Có boundary; phải chạy negative case |
| Status | Inbox service/UI có open/resolved/snoozed | Có; history/identity UI chưa đủ |
| Receipt | Widget có /receipts, DB có visitor_received_at | Có cơ chế; chưa có browser proof |
| RLS/schema | 001_identity.sql, 007_channels.sql, 008_chat.sql có scope, FK, unique | Có nền tảng; chưa phải production acceptance |
| Test | widget-api-flow.test.ts, widget-boundary.test.ts, sdk-contract.test.ts | Có targeted tests; chưa phải browser E2E |

### 2.2. Có code nhưng chưa nghiệm thu

- SDK hiển thị HANDOFF_PENDING nhưng chưa có control “Yêu cầu gặp nhân viên” và handler gọi /handoff. Đây là việc N2; N1 chỉ khóa contract.
- API handoff có thể đổi state nhưng chưa có bằng chứng widget → Inbox trên cùng conversation.
- owner_version chặn stale AI trong code/test; chưa có browser/worker evidence đúng phiên demo.
- Inbox có public/internal/status nhưng list chủ yếu hiện channel và một phần ID; chưa đủ visitor identity cho D-UC08.
- Permission access() có kiểm workspace/channel membership; chưa chạy matrix Owner/Admin/Agent, agent ngoài channel, tenant B.
- Test tạo UUID rồi cleanup từng test; chưa có workshop seed/reset/manifest.
- Supabase Pooler đã kết nối được bằng SELECT 1, nhưng đó là database dùng chung; không chạy reset hoặc full integration suite phá dữ liệu trên đó.

### 2.3. Gap phải ghi backlog

1. Đồng bộ behavior giữa backend/public/sdk.js và frontend/public/sdk.js sau N2.
2. Quyết định có audit conversation.handoff_requested; public handoff hiện chưa ghi audit riêng.
3. Tách rõ assigned_to và reply_owner: auto-assign không đồng nghĩa takeover.
4. Có database disposable/fixture riêng; không dùng Supabase shared làm test DB.
5. Mở rộng SDK contract test để bắt buộc handoff control, repeat click và wrong-origin behavior.
6. Chốt search/history: hiện inboxList() tìm chủ yếu theo channel và giới hạn 100.

## 3. Contract phải chốt trong N1

### 3.1. Widget/visitor

| API | Kết quả đúng | Negative bắt buộc |
|---|---|---|
| GET /widget-api/:key/config | Config công khai, không lộ workspace ID/secret | key/origin sai, channel/workspace disabled |
| POST /widget-api/:key/session | Tạo/resume visitor, trả token/conversation/profile/state | thiếu pre-chat, field lạ, email sai, token hết hạn |
| POST /widget-api/:key/messages | Một message; retry cùng clientId không duplicate; chỉ enqueue AI khi AI_ACTIVE | token/origin sai, body rỗng, payload duplicate khác |
| POST /widget-api/:key/handoff | AI_ACTIVE → HANDOFF_PENDING, version tăng; lặp lại idempotent | chưa auth, origin sai, body có assignedTo |
| GET /state, GET /messages | Đúng conversation, đúng sequence, chỉ public | token channel khác, không trả internal |
| POST /receipts | Chỉ mark public messages của visitor conversation | ID tenant khác, internal ID, ID conversation khác |

### 3.2. Inbox/agent

| Hành động | Điều kiện | Kết quả |
|---|---|---|
| List/open | Membership active và có channel access | Chỉ thấy đúng tenant/channel |
| Takeover | Version hiện tại khớp, actor có quyền | Một winner, HUMAN_ACTIVE, version tăng, audit |
| Public reply | HUMAN_ACTIVE và actor đúng assigned_to | Visitor nhận được; stale actor bị chặn |
| Internal note | Actor hợp lệ | Inbox thấy; widget tuyệt đối không thấy |
| Resolve/snooze/reopen | Actor có quyền | Status + audit đúng; reload không mất |
| Resume AI | Chỉ action rõ ràng của actor | Không tự resume; stale version trả 409 |

### 3.3. Invariant bắt buộc

- AI_ACTIVE: AI chỉ reply nếu owner version còn đúng.
- HANDOFF_PENDING: visitor đã xin người; không được giả là agent đã takeover.
- HUMAN_ACTIVE: chỉ agent được assign/takeover gửi public reply.
- assigned_to là người được phân công; reply_owner là quyền reply hiện tại.
- Đổi ownership phải tăng owner_version; worker/actor dùng version cũ bị chặn.
- visibility=internal không bao giờ đi qua widget API.
- Cùng clientId + conversation chỉ tạo một message; payload khác trả conflict.
- Handoff lặp lại không tự đổi agent, không tự resume AI.

## 4. Fixture N1

### 4.1. Quy tắc an toàn

1. Chỉ dùng database test/disposable; không seed/reset Supabase shared.
2. Không ghi password, visitor token, session token hay provider secret vào manifest.
3. Tạo UUID mới hoặc namespace riêng, không dùng ID production/HiChat.
4. Reset theo UUID trong manifest và thứ tự FK; không dùng TRUNCATE hoặc DELETE rộng.
5. Script fail fast nếu thiếu GOTEK_TEST_DATABASE_URL hoặc DB không phải test/disposable.
6. Evidence chỉ giữ ID rút gọn, role, origin, state và kết quả; phải redact token.

### 4.2. Dữ liệu tối thiểu

**Workspace A:** owner, admin, agent thuộc channel A, agent không thuộc channel A, channel origin https://fixture-a.example.test, visitor và conversation ở AI_ACTIVE/HANDOFF_PENDING/HUMAN_ACTIVE/resolved/snoozed.

**Workspace B:** owner, agent thuộc channel B, channel origin https://fixture-b.example.test, visitor/conversation tương tự nhưng ID khác.

**Messages:** visitor question, AI public answer, handoff request, agent public reply, agent internal note, duplicate clientId, stale owner version.

Manifest không secret: runId, databaseKind=disposable-test-only, workspace A/B IDs, roles, channel IDs, origins, conversationIdsByState, schemaVersion, createdAt, evidencePaths.

Reset: đọc manifest → xác minh disposable DB → kiểm UUID thuộc workspace của run → xóa bảng phụ thuộc theo FK → query count theo workspace → chỉ kết thúc khi count về 0. Nếu không xác định được target thì dừng.

## 5. Ma trận kiểm thử phải chuẩn bị

### Happy path

- A01: origin đúng mở widget.
- A02: tạo session và profile.
- A03: visitor gửi question.
- A04: agent đúng channel đọc conversation.
- A05: handoff AI → pending.
- A06: agent takeover pending → human.
- A07: public reply xuất hiện ở visitor.
- A08: internal note chỉ xuất hiện Inbox.
- A09: resolve → reopen và reload đúng.

### Origin/session/tenant

- B01: channel A gọi bằng origin B → 403 DOMAIN_DENIED.
- B02: thiếu Origin → từ chối.
- B03: token visitor A gọi channel B → từ chối, không trả message.
- B04/B05: actor workspace A/B đọc conversation tenant còn lại → từ chối.
- B06/B07: workspace/channel disabled → config/session/message bị chặn.

### Role/channel

- C01 Owner/Admin đúng workspace được đọc.
- C02 Agent thuộc channel được takeover.
- C03 Agent ngoài channel không đọc/takeover/gửi.
- C04 Public reply trước takeover → TAKEOVER_REQUIRED.
- C05 Membership bị revoke → request mới bị từ chối.
- C06 Chốt rõ policy internal note trước takeover.

### Ownership/idempotency

- D01 hai agent takeover cùng version: một winner, còn lại 409 STALE_REPLY_OWNER.
- D02 AI worker version cũ không append.
- D03 actor không assigned không public reply.
- D04 hai handoff đồng thời không tạo sai transition.
- D05 cùng clientId cùng payload không duplicate.
- D06 cùng clientId khác body → 409 IDEMPOTENCY_CONFLICT.
- D07 mất mạng sau submit: pending/retry không tạo side effect kép.

### Status/history/privacy

- E01 resolve có status/audit.
- E02 handoff từ resolved mở lại theo rule nhưng không tự thành HUMAN_ACTIVE.
- E03 reload Inbox giữ sequence và internal note.
- E04 reload widget giữ token/history/state.
- E05 public reply có visitor receipt.
- E06 internal note không có visitor receipt.
- E07 history nhận diện được visitor/conversation, không chỉ tên channel.

## 6. Lịch làm việc trong ngày

### 08:30–10:30 — Baseline và state contract

- Đọc AGENTS, project status, handoff và delivery rule.
- Kiểm branch/working tree; không reset hoặc ghi đè thay đổi cũ.
- Vẽ sequence visitor → message → AI/pending → handoff → takeover → reply → receipt → resolve.
- Ghi actor, workspace, channel, origin, visibility và owner_version ở từng bước.

### 10:30–12:00 — Source/test audit

- Đối chiếu widget route, inbox service, chat store, route registration, migrations và test.
- Đánh dấu từng yêu cầu Implemented, Needs Verification, Missing, Blocked.
- Ghi riêng việc sẽ làm N2; không lẫn sửa SDK vào N1.

### 13:00–14:30 — Fixture/reset design

- Chọn database disposable.
- Thiết kế seed A/B, role, channel, origin, visitor, conversation states.
- Thiết kế manifest và reset theo UUID.
- Chuẩn bị public/internal/stale-version data.

### 14:30–15:30 — Matrix và triage

- Điền expected result cho nhóm A–E.
- P0: tenant/private leak, sai ownership, secret, duplicate side effect.
- P1: visitor không nhận reply, handoff không vào Inbox, status/history sai.
- P2: text/layout/empty state không chặn luồng.
- Gán owner/deadline cho blocker.

### 15:30–17:30 — Verification và bàn giao

- Chạy npm run build:all.
- Chạy npm run test:frontend.
- Backend targeted tests chỉ trên DB cô lập; nếu chưa có thì ghi blocker.
- Lưu contract, matrix, manifest schema, schema check, command log, defect register.
- Cập nhật NGAY-1-TIEN-DO-2026-09-29.md và docs/HANDOFF.md nếu có trạng thái mới.
- Chốt N2: control “Yêu cầu gặp nhân viên”, handler /handoff, pending state và browser proof.

## 7. Evidence phải bàn giao

| Artifact | Nội dung |
|---|---|
| n1-conversation-contract.md | state, API, actor, permission, error, idempotency, receipt |
| n1-permission-matrix.md | A/B tenant, role, channel/origin và expected result |
| n1-fixture-manifest.schema.json | schema manifest, không secret |
| n1-fixture-reset-checklist.md | điều kiện DB disposable và thứ tự reset |
| n1-schema-check.txt | bảng, constraint, RLS, timestamp, DB kind đã redact |
| n1-build.txt | command, build identifier, kết quả |
| n1-targeted-tests.txt | test, environment, pass/fail, limitation |
| n1-defects.md | mã, severity, repro, owner, next action |

Không commit password, raw connection string, visitor/session token, provider key hoặc dữ liệu khách thật.

## 8. Definition of Done

- [ ] Đã đối chiếu code/route/test hiện tại.
- [ ] Có contract D-UC06–08, QA-01, BUF-03.
- [ ] Có invariant cho AI_ACTIVE/HANDOFF_PENDING/HUMAN_ACTIVE.
- [ ] Có permission matrix hai workspace, origin sai, token sai, role sai, agent ngoài channel.
- [ ] Có fixture A/B và reset an toàn.
- [ ] Có build/frontend result; backend environment được ghi chính xác.
- [ ] Có evidence đã redact và defect register.
- [ ] Có handoff note cho N2.
- [ ] Không đánh dấu D-UC06 hoàn thành khi SDK chưa có control.

Nếu thiếu database test cô lập, trạng thái đúng là DONE BUT NEEDS VERIFICATION hoặc IN PROGRESS, không phải DONE.

## 9. Đánh giá theo góc nhìn senior lead

| Tiêu chí | Điểm | Nhận xét |
|---|---:|---|
| Backend handoff/ownership | 7/10 | Có route, state và version fence; thiếu live/browser evidence |
| Widget readiness | 3/10 | SDK chưa có control yêu cầu người |
| Inbox/reply | 6/10 | Có takeover/public/internal/status; thiếu receipt/identity proof |
| Tenant/permission | 6/10 | Có scope/RLS/access; chưa chạy matrix A/B |
| Reproducible fixture | 2/10 | Chưa có workshop seed/reset chuẩn |
| QA/evidence | 3/10 | Có targeted tests, chưa có browser acceptance/3 lần rerun |
| **Sẵn sàng bắt đầu browser demo** | **4,5/10** | Chưa được tuyên bố đạt |

Code nền không yếu nhất ở state transition; điểm yếu là chưa tái lập được demo và chưa chứng minh end-to-end. Nếu sửa UI trước fixture, team có thể demo một lần nhưng không biết có đúng tenant, actor, version và dữ liệu hay không. Vì vậy N1 ưu tiên evidence/permission boundary; N2 mới sửa nút handoff.

## 10. Quyết định cần team chốt

1. Database disposable nào dùng cho integration/browser demo?
2. Handoff có audit conversation.handoff_requested hay chỉ audit takeover?
3. Agent có được ghi internal note trước takeover không?
4. Handoff từ resolved/snoozed có mở lại conversation theo rule hiện tại không?
5. D-UC08 có bắt buộc tìm theo visitor profile trước N5 không?
6. Ai cung cấp provider/model live; nếu chưa có phải ghi AI receipt là UNKNOWN / NEEDS VERIFICATION.

**Kết luận:** N1 khóa contract, fixture, permission matrix và evidence workflow; không sửa SDK trong N1. N2 bắt đầu bằng control “Yêu cầu gặp nhân viên”, handler /handoff, pending state và browser proof.
