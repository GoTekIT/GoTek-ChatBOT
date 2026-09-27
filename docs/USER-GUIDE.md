# GoTek Chatbot — hướng dẫn sử dụng local/test

Tài liệu này mô tả cách dùng các luồng hiện có trong checkout `codex/chatbot-delivery`. Đây là hướng dẫn vận hành local/test dựa trên route, component và API đang có; nó không phải bằng chứng rằng toàn bộ browser flow, HiChat parity, provider thật hoặc production đã được nghiệm thu.

## 1. Bắt đầu local

1. Cài Node/npm và PostgreSQL 16-compatible CLI.
2. Tạo cluster riêng ở socket `/tmp`, port `55432` nếu máy chưa có cluster dev.
3. Chạy `npm ci`, `npm run db:setup`, rồi `npm run dev`.
4. Mở `http://127.0.0.1:4317`. Header `Local/test` cho biết đây là môi trường local.
5. Chạy `npm run build` và `npm test` trước khi đánh giá một thay đổi. Test phải chạy serial vì dùng chung PostgreSQL fixture.

Chi tiết biến môi trường, lỗi khởi động và restore drill nằm ở [DEVELOPMENT](DEVELOPMENT.md). Backend không tự đọc `.env`; `.local/runtime.json` là runtime config riêng tư và không được commit.

## 2. Vai trò và màn hình

| Vai trò | Màn hình chính | Có thể làm gì trong source hiện tại |
|---|---|---|
| Visitor | Widget `public/sdk.js` | Tạo/resume phiên theo channel, gửi tin, đọc public message và receipt |
| Agent | `/dashboard` | Đọc inbox được cấp, takeover, gửi public reply hoặc internal note |
| Workspace Owner/Admin | `/settings/*` | Quản lý doanh nghiệp, nhân sự, channel, knowledge, data collection, web source, AI rules, jobs, usage và audit |
| Platform Admin | `/platform/providers` | Quản lý provider/model/grant và dùng Platform AI Agent; đây là miền quyền tách khỏi workspace |
| Support operator | `/settings/support` hoặc API support | Chỉ đọc metadata workspace trong support grant có scope, lý do và expiry; không mặc định đọc chat |

Navigation hiển thị theo membership hiện tại. Backend vẫn kiểm tra quyền ở mỗi request; ẩn link trên UI không phải authorization.

## 3. Luồng Workspace Owner/Admin

### 3.1 Đăng ký, xác thực và đăng nhập

1. Mở `/app/auth/signup`, nhập thông tin doanh nghiệp, email và mật khẩu.
2. Server tạo user, workspace, Owner membership, quota mặc định và single-use verification challenge.
3. Local/test dùng bản ghi `local_delivery`; SMTP/email receipt chưa có.
4. Mở `/app/auth/verify` với challenge hợp lệ, sau đó đăng nhập ở `/app/login`.
5. Session là cookie HttpOnly. `GET /api/me` trả workspace hiện tại và danh sách workspace mà user có membership.
6. Chuyển workspace bằng selector trong shell; server kiểm tra membership, không tin workspace ID do client tự đưa.

Nếu browser hiện “Không thể kết nối”, kiểm tra theo thứ tự: process `npm run dev`, `GET /api/health`, PostgreSQL/`DATABASE_URL`, rồi request trong DevTools. Thông báo này không tự chứng minh lỗi nằm ở UI.

### 3.2 Tạo channel và lấy mã nhúng

1. Vào **Cài đặt → Hộp thư** (`/settings/inboxes`).
2. Tạo website channel với tên và exact origin, ví dụ `http://127.0.0.1:4317` trong fixture local.
3. Sau khi channel hoạt động, chọn **Mã nhúng**. API trả SDK snippet, origin đã đăng ký và public key opaque.
4. Chỉ nhúng trên exact origin đã đăng ký. Public key nhận diện channel, không phải provider key.
5. Chọn **Cấu hình** để cập nhật assignment, giờ làm việc, pre-chat, tiêu đề/vị trí/chế độ widget. UI phải đọc lại response sau khi lưu.

### 3.3 Chuẩn bị tri thức

1. Vào **Cài đặt → Kho thông tin** (`/settings/knowledge`).
2. Tạo draft thủ công hoặc import dữ liệu được hỗ trợ (text/JSON/CSV/PDF/DOCX theo giới hạn parser).
3. Kiểm tra nội dung và audience. `INTERNAL` không được đi vào visitor context.
4. Process draft thành version `READY`; sau đó dùng thao tác publish có expected version để công khai rõ ràng.
5. Dùng **Kiểm tra truy xuất** để xem các bản `READY` đã publish đúng audience. Kết quả là kiểm tra backend retrieval, không phải đảm bảo model sẽ luôn trả lời đúng.
6. Khi cần embedding, chạy batch worker với version/model UUID tương thích; embedding lỗi hoặc sai hash bị loại khỏi context.

### 3.4 Cấu hình AI rules và nguồn web

- **Quy tắc AI** (`/settings/ai-rules`): chỉ Owner/Admin; cập nhật có version/expected version và audit.
- **Nguồn web** (`/settings/web-sources`): tạo URL/SITEMAP/RSS theo policy; refresh tạo durable job, fetch static bounded source, tạo snapshot/generation draft, rồi review và publish/rollback.
- Browser JavaScript crawler, live site acceptance và mọi nguồn bên ngoài chưa được tuyên bố hoàn tất.

## 4. Luồng Visitor → AI → Agent

1. Widget gọi config bằng public key và exact `Origin`.
2. Widget tạo/resume visitor session; server tạo visitor/conversation và bearer token theo channel.
3. Pre-chat bắt buộc phải hoàn tất trước khi gửi nếu channel cấu hình trường required.
4. Tin nhắn gửi `{clientId, body}`. Client ID lặp lại cùng payload là replay; khác payload là conflict, không tạo side effect thứ hai.
5. Nếu conversation đang `AI_ACTIVE`, server enqueue `ai.reply`; nếu không, tin chờ human handoff theo trạng thái hiện tại.
6. Worker claim lease, kiểm tra workspace active, owner version, public published knowledge, rule snapshot, model/grant/expiry và quota.
7. Provider chỉ nhận grounded context qua server-side secret. Provider lỗi được chuẩn hóa thành stable redacted error.
8. Trước khi commit, worker kiểm tra lại lease/owner/version/source/grant. Nếu Agent takeover hoặc publication đổi, câu trả lời cũ không được append.
9. Agent takeover ở `/dashboard` dùng owner version; reply public và internal note có visibility khác nhau.
10. Visitor chỉ đọc public message theo sequence và gửi receipt cho message được hiển thị.

Các trạng thái cần giữ nguyên khi debug: `AI_ACTIVE`, `HANDOFF_PENDING`, `queued`, `running`, `retry`, `dead`, `unknown`. `unknown` nghĩa là kết quả external không chắc chắn và không được resend mù.

## 5. Platform Admin và các model

1. Đăng nhập bằng tài khoản có platform role; vào `/platform/providers`.
2. Thêm provider bằng adapter `openai`, `chatgpt`, `anthropic`, `gemini`, `claude_code`, `custom_llm` hoặc `local`.
3. Trường secret chỉ là **tên biến môi trường** trên server. Không dán API key vào form, database seed, widget hoặc commit.
4. Tạo model và capabilities (`chat`, `embedding`, `vision`), bật provider/model sau khi đã có secret hợp lệ nếu adapter cần.
5. Cấp hoặc thu hồi grant cho workspace/model/capability. Grant expiry được kiểm tra trước provider I/O.
6. Dùng **AI Agent Platform** trong cùng màn hình để tạo session actor-scoped, gửi yêu cầu phân tích context được phép và xem lịch sử session.

`claude_code` hiện là adapter Anthropic Messages trong source; chưa có bằng chứng CLI Claude Code được spawn. Platform Agent đã có test actor/session/idempotency/recovery, nhưng policy billable token/quota của các turn platform vẫn `UNKNOWN / NEEDS VERIFICATION`.

## 6. Jobs, usage, audit và support

- **Tác vụ nền** (`/settings/jobs`): xem trạng thái durable jobs; worker AI/web/embedding chạy process riêng.
- **Mức sử dụng** (`/settings/usage`): xem quota/usage theo workspace; reservation và settlement là các trạng thái khác nhau.
- **Nhật ký hoạt động** (`/settings/audit`): Owner/Admin xem bounded keyset list/export; audit record không được sửa/xóa tùy tiện.
- **Quyền hỗ trợ** (`/settings/support`): workspace cấp grant có lý do, scope và expiry; support viewer chỉ thấy metadata được phép.
- **Restore drill**: `npm run db:restore-drill` tạo database tạm, kiểm tra hash/RLS/policy/quarantine rồi xóa database tạm. Đây không phải production backup runbook.

## 7. Hướng dẫn đọc hình ảnh và evidence

Các ảnh trong README và `research/ui-evidence/` là reference/UI observation hoặc trạng thái local được ghi lại. Hãy đọc caption và evidence boundary trước khi kết luận. Ảnh không chứng minh private backend HiChat, live provider receipt hay pixel parity.

- [AI data collection](../research/ui-evidence/ai-data-collection.png) — surface thu thập dữ liệu tham chiếu.
- [AI rules](../research/ui-evidence/h09-rules-1440-live.png) và [rule create](../research/ui-evidence/h09-rule-create-live-2026-09-25.png) — bố cục/quy trình rule tham chiếu.
- [Knowledge](../research/ui-evidence/h10-knowledge-1440-live.png) — bố cục kho tri thức tham chiếu.
- [Web source list](../research/ui-evidence/h11-list-live.png) và [web source create](../research/ui-evidence/h11-create-live.png) — trạng thái nguồn web tham chiếu.
- [Inbox empty](../research/ui-evidence/inbox-empty.png) — trạng thái rỗng tham chiếu.
- [GoTek logo](../public/gotek-logo.png) và [brand palette](../delivery/GoTek_Chatbot_Skill_Dev_Kit/gotek-chatbot-delivery/assets/brand-palette.png) — nhận diện GoTek.

## 8. Checklist nghiệm thu local

### Core backend

- [ ] Signup/verify/login tạo đúng tenant và membership.
- [ ] Hai workspace không đọc được dữ liệu của nhau.
- [ ] Knowledge draft → process → publish `PUBLIC` → retrieval có citation.
- [ ] Widget exact-origin/session/pre-chat/message/receipt chạy với public visibility.
- [ ] AI worker kiểm tra grant/expiry/quota/owner trước và sau provider call.
- [ ] Takeover ngăn stale AI reply.
- [ ] Provider timeout/malformed/unknown không lộ secret và không resend mù.
- [ ] Jobs lease/retry/dead/unknown và NULL-lease recovery pass.
- [ ] Audit export, restore drill và quarantine pass.

### Evidence còn thiếu

- [ ] Live provider receipt với credential test được cấp riêng.
- [ ] Browser screenshots/network trace cho signup → widget → inbox → takeover.
- [ ] Platform Agent token/cost/quota ownership decision.
- [ ] H32.05 retention, legal hold, deletion và closure decision.
- [ ] Staging deployment, rollback, RPO/RTO và release approval.

Khi một ô chưa có evidence, giữ nhóm ở `IN PROGRESS` hoặc `DONE BUT NEEDS VERIFICATION`; không đổi thành `DONE` chỉ vì UI hiển thị được.
