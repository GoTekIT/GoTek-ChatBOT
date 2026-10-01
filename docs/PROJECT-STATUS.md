# Current snapshot

## Remediation resumed — 2026-09-30

User authorized implementation after WBS reconciliation: SSE channel/session authorization, reset credential exposure, logout failure handling, and active Inbox/Knowledge API integration. Working branch: `codex/chatbot-delivery`. Implementation and verification IN PROGRESS; no acceptance claim. First local patch adds per-delivery SSE authorization, removes reset/OTP credential responses and preserves logout failure state. Focused SSE test 1/1 and frontend tests 8/8 pass; DB-backed SSE/reset/RBAC and archive checks now pass. Active Inbox and Knowledge handlers are connected to APIs; browser persistence/error/role acceptance and remaining placeholder controls are still open. Google configuration now fails closed; live Google remains unverified. See HANDOFF active remediation checkpoint. Main contributor changes are retained by merging origin/main. Historical snapshots below retain their original evidence limits.

## Git collaboration gate — 2026-09-30

Trên nhánh `codex/collaboration-safety-20260930`, root lockfile được đồng bộ với monorepo và `install:all` dùng cài đặt sạch `npm ci` ở root/backend/frontend. Có hướng dẫn cộng tác trong `CONTRIBUTING.md` và mẫu PR trong `.github/`. PR #3 đã PASS CI `test-and-build` (gồm backend DB tests) và đang chờ reviewer khác. GitHub ruleset `main` (ID 24158816) yêu cầu PR, review và CI cập nhật; ruleset nhánh làm việc (ID 24238565) chặn xóa/force push. Đây là cải thiện quy trình; **không thay đổi trạng thái nghiệm thu H01–H32/E01–E12**. Kiểm tra local: `npm run install:all` PASS, `npm run build:all` PASS, frontend tests 7/7 PASS. Không dùng DB chung của contributor để chạy backend suite local.


**2026-09-30 correction — H01/H22 Google login:** confirmed the active frontend
container served a stale bundle that logged into sample admin Alex Rivera directly.
Local backend/frontend containers were rebuilt with the mock path removed and
the configured Google Client ID supplied to the frontend build. Runtime asset and
negative API checks passed; frontend tests 5/5 passed. Google account selection and
successful login remain **NEEDS VERIFICATION**; no full backend regression was run
for this correction. See [runtime evidence](../delivery/evidence/google-login-runtime-2026-09-30.md).

Ngày audit: 2026-09-28. Branch: `namnv`. Trạng thái: **Monorepo Refactoring Completed (Backend + Frontend + Infra + GitOps + Mobile)**. Kiến trúc đã được chuẩn hóa theo format dự án tham khảo `wdp`. Checkpoint tài liệu + hardening đã được push; dùng `git log -1` để lấy commit snapshot hiện hành. Trạng thái: **MVP — In Progress**.


Source, migration và test là bằng chứng triển khai; `delivery/BACKLOG.csv` là phạm vi chi tiết; tài liệu này tổng hợp trạng thái. Không có bằng chứng hoàn tất toàn bộ backend hay HiChat parity. `delivery/CHECKPOINT.md` giữ lịch sử; entry mới hơn thay thế nhận định cũ khi có bằng chứng sửa lỗi.

## Quy ước 5 trạng thái

- **DONE:** slice cụ thể đã implement và có kiểm tra phù hợp; không đồng nghĩa cả nhóm được nghiệm thu.
- **DONE BUT NEEDS VERIFICATION:** code có nhưng thiếu kiểm chứng đầy đủ.
- **IN PROGRESS:** nhóm chỉ có một phần luồng hoặc còn acceptance gate.
- **TODO:** requirement đã ghi, chưa có triển khai đủ để nhận diện luồng đó.
- **FUTURE / OPTIONAL:** cải tiến chưa cam kết; không dùng nhãn này để bỏ phạm vi H01–H32/E01–E12.

## Completed — các slice giới hạn

Bằng chứng regression mới nhất: fresh post-parallel-hardening run 175/175 PASS tại `delivery/evidence/core-after-parallel-hardening-2026-09-27.txt`. Fresh P0.1 core acceptance: `delivery/evidence/p0-core-acceptance-2026-09-27.txt`, 9/9 focused integration tests PASS. Kết quả này vẫn không thay thế browser/live-provider acceptance.

| Slice | Files chính | Trạng thái | Evidence và giới hạn |
|---|---|---|---|
| Reset token single-use/expiry và revoke session | `src/server/app.ts`, `src/server/security.ts` | DONE | Checkpoint H01 + regression; external email chưa chứng minh |
| Tenant isolation và membership revoke | `src/server/db.ts`, `src/server/security.ts`, `src/server/app.ts` | DONE | H02/H16 HTTP/PG tests; không thay thế browser acceptance |
| Widget token/origin và capacity/takeover | `src/server/widget.ts`, `src/server/chat-store.ts` | DONE | H04 boundary 1/1, H05 1/1 và regression |
| Visitor profile validation | `src/server/widget.ts` | DONE | H06 targeted 1/1 và regression |
| Audit keyset list/export | `src/server/audit-log.ts`, `src/server/audit-export.ts`, `src/server/app.ts` | DONE | `delivery/evidence/h22-audit-export-http.txt`; JSON envelope chứa NDJSON, không raw download |
| Restore disposable DB + integrity/quarantine | `scripts/restore-drill.ts` | DONE | `delivery/evidence/restore-after-parallel-hardening-2026-09-27.txt`: fresh PASS, 55 tables; không phải production RPO/RTO |
| Provider error contract và expired grant fence | `src/server/provider-transport.ts`, `src/server/worker.ts` | DONE BUT NEEDS VERIFICATION | Injected transport/error tests; expired grant now blocks before transport (`tests/provider-grant-expiry.test.ts`). Không live provider |
| Jobs recovery với lease thiếu | `src/server/jobs.ts`, `tests/jobs-recovery-null-lease.test.ts` | DONE BUT NEEDS VERIFICATION | NULL-lease local row recovery 1/1; tenant fence và external unknown vẫn pass. Chưa phải production worker acceptance |
| Knowledge/widget boundary audit | `src/server/knowledge-retrieval.ts`, `src/server/widget.ts` | DONE BUT NEEDS VERIFICATION | Focused boundary 8/8; không phát hiện leak cụ thể trong scope. Không chứng minh HiChat/private backend parity |
| Platform Agent actor/idempotency/recovery audit | `src/server/platform-agent.ts`, platform routes | DONE BUT NEEDS VERIFICATION | Focused 9/9; usage/quota ownership của platform turn còn UNKNOWN |
| Expired session purge primitive | `src/server/session-maintenance.ts` | DONE | H23 checkpoint/tests; lịch chạy production chưa chốt |
| Environment/configuration handoff | `.env.example`, `docs/ENVIRONMENT.md`, `docs/DEVELOPMENT.md` | DONE | Inventory đối chiếu source; không chứa secret; production/staging topology vẫn UNKNOWN |
| Environment/database Word handoff | `docs/GoTek_Chatbot_Environment_Database_Handoff.docx` | DONE | 16-page rendered guide; accessibility audit high/medium/low = 0; private local `.env` remains ignored/outside the artifact and no provider secret is included |

## In Progress

### Nền tảng AI, model registry và trả lời từ tri thức workspace

**Status:** IN PROGRESS  
**Goal:** Platform Admin cấp model cho doanh nghiệp; khách nhận câu trả lời dựa trên tri thức được phép của doanh nghiệp.  
**Implemented:** registry/grants, grant expiry, provider transports, platform agent, lexical/semantic retrieval, chunk/embedding worker, AI reply worker, token metering và quota ledger.  
**Not implemented:** chưa có bằng chứng nghiệm thu live tất cả provider/model, tính đúng đủ của bộ dữ liệu doanh nghiệp thực, staging vận hành. Không suy ra `claude_code` là chạy CLI Claude Code: adapter hiện gọi Anthropic Messages API.  
**Relevant files:** `src/server/platform.ts`, `platform-agent.ts`, `provider-transport.ts`, `knowledge-retrieval.ts`, `knowledge-embedding-worker.ts`, `ai-reply-worker.ts`, `quota.ts`, `usage-ledger.ts`.  
**Current behavior:** grant/capability và trạng thái workspace/provider/model chặn routing; workers kiểm tra quyền và xử lý lỗi/unknown.  
**Known issue:** provider receipts thực tế UNKNOWN / NEEDS VERIFICATION; giá/chất lượng/chi phí thực chưa được chứng minh bằng transport giả. P0.1 local fixture pass không đóng gate live.
**Next exact step:** với credential test hợp lệ, chạy acceptance live bằng một model được cấp trên hai workspace fixture, kiểm chứng publish/retrieve/reply/citation và usage; nếu chưa có credential, tiếp tục hardening bằng injected transport.
**Definition of done:** negative tenant/privacy cases pass, provider receipt và usage đối chiếu được, browser flow và lỗi được nghiệm thu.

**Documentation pause:** feature implementation is paused after the parallel audit; only README/flow/evidence synchronization should proceed until `docs/HANDOFF.md` reopens a next slice.

### Nguồn web, knowledge import và publish

**Status:** IN PROGRESS  
**Goal:** dữ liệu doanh nghiệp được nhập, xem trước, publish và chỉ phiên bản hợp lệ được dùng trả lời.  
**Implemented:** extract/import, categories, lifecycle, web fetch/parser/security/sitemap/schedule, snapshot generation nhiều phần, retire phần cũ.  
**Not implemented:** nghiệm thu nguồn thực rộng, JS-rendered crawler/browser parity, toàn bộ H10–H12.  
**Relevant files:** `src/server/knowledge-imports.ts`, `knowledge-lifecycle.ts`, `web-source-*.ts`, `web-refresh-worker.ts`, `web-snapshot-generation.ts`, `web-generations.ts`.  
**Current behavior:** snapshot được chuyển thành draft generation; publish/retire có scope và idempotency.  
**Known issue:** không được coi static HTTP crawler là crawler trình duyệt.  
**Next exact step:** đối chiếu H11 acceptance với static/sitemap fixtures và một nguồn được phép; ghi phần JS-rendered cần quyết định trước khi thêm runtime.  
**Definition of done:** source → snapshot → draft → publish → retrieval và rollback/retire được chứng minh trên dữ liệu thật phù hợp.

### Inbox, widget, contact và membership

**Status:** IN PROGRESS  
**Goal:** widget từng doanh nghiệp, phân công người/AI và CRM cùng scope.  
**Implemented:** channels, chat store, inbox, contacts, business-hours, visitor forms, membership checks, capacity/takeover tests.  
**Not implemented:** toàn bộ cấu hình builder, UX/bàn phím/mobile và các trường hợp nghiệm thu H03–H07/H13/H16.  
**Relevant files:** `src/server/widget.ts`, `channels.ts`, `chat-store.ts`, `contacts.ts`, `business-hours.ts`, `src/web/`, `public/sdk.js`.  
**Current behavior:** backend có luồng thật và tests; user đã báo lỗi kết nối signup trong lịch sử.  
**Known issue:** lỗi signup trên browser ở thời điểm hiện tại UNKNOWN / NEEDS VERIFICATION, không tự coi đã tái hiện hoặc sửa.  
**Next exact step:** fresh local signup/login → tạo channel → nhúng widget → gửi tin → takeover với hai role; giữ UI hiện có trong đợt handoff.  
**Definition of done:** acceptance theo nhóm và browser evidence, không chỉ test API.

### Vận hành và privacy

**Status:** IN PROGRESS  
**Goal:** recover an toàn, audit và kiểm soát vòng đời dữ liệu.  
**Implemented:** durable jobs, retry/dead-letter/unknown, audit list/export, restore quarantine và hash.  
**Not implemented:** retention/delete/closure policy, production RPO/RTO, external artifact restore.  
**Relevant files:** `src/server/jobs.ts`, `worker.ts`, `audit-export.ts`, `scripts/restore-drill.ts`, `delivery/decisions/H32_RETENTION_CLOSURE.md`.  
**Current behavior:** không resend mù sau external dispatch không rõ kết quả; restore drill dùng DB dùng một lần.  
**Known issue:** policy hủy dữ liệu chưa có chủ sở hữu phê duyệt.  
**Next exact step:** chốt 5 nhóm quyết định trong H32_RETENTION_CLOSURE trước khi viết purge/closure.  
**Definition of done:** policy phê duyệt, dry-run/negative/restore acceptance và release owner sign-off.

## Toàn bộ nhóm yêu cầu

Đây là trạng thái nhóm, không phải tỷ lệ hoàn thành. CSV có 170 dòng: 61 `In progress`, 107 `Backlog`, 2 `Implemented`. Hai dòng Implemented cũng không chứng minh nghiệm thu toàn nhóm. Một số evidence mới nằm ở CHECKPOINT mà CSV chưa cập nhật chi tiết; không chuyển Backlog thành DONE chỉ từ tên module.

| Nhóm | Phạm vi | Trạng thái handoff | ID trong backlog |
|---|---|---|---|
| H01 | Đăng ký đăng nhập và khôi phục | IN PROGRESS | H01.01, H01.02, H01.03, H01.04 |
| H02 | Workspace và ngữ cảnh doanh nghiệp | IN PROGRESS | H02.01, H02.02, H02.03, H02.04 |
| H03 | Inbox hội thoại và chuyển người | IN PROGRESS | H03.01, H03.02, H03.03, H03.04, H03.05 |
| H04 | Tạo kênh website và nhúng SDK | IN PROGRESS | H04.01, H04.02, H04.03, H04.04, H04.05 |
| H05 | Cộng tác viên và tự phân công | IN PROGRESS | H05.01, H05.02, H05.03, H05.04, H05.05 |
| H06 | Giờ làm việc và biểu mẫu trước chat | IN PROGRESS | H06.01, H06.02, H06.03, H06.04, H06.05 |
| H07 | Widget builder preview và danh tính | IN PROGRESS | H07.01, H07.02, H07.03, H07.04, H07.05 |
| H08 | Provider model và hành vi AI | IN PROGRESS | H08.01, H08.02, H08.03, H08.04, H08.05 |
| H09 | Quy tắc AI và nhập xuất | IN PROGRESS | H09.01, H09.02, H09.03, H09.04, H09.05 |
| H10 | FAQ kho thông tin mẫu câu và ảnh | IN PROGRESS | H10.01, H10.02, H10.03, H10.04, H10.05 |
| H11 | Nguồn web và crawler | IN PROGRESS | H11.01, H11.02, H11.03, H11.04, H11.05 |
| H12 | Thu thập dữ liệu và đồng bộ | IN PROGRESS | H12.01, H12.02, H12.03, H12.04, H12.05 |
| H13 | CRM liên hệ và hồ sơ khách | IN PROGRESS | H13.01, H13.02, H13.03, H13.04, H13.05 |
| H14 | Catalog và đơn hàng | TODO | H14.01, H14.02, H14.03, H14.04, H14.05 |
| H15 | Help Center và nội dung công khai | TODO | H15.01, H15.02, H15.03, H15.04, H15.05 |
| H16 | Thành viên nhóm và vai trò | IN PROGRESS | H16.01, H16.02, H16.03, H16.04, H16.05 |
| H17 | Nhãn và thuộc tính tùy chỉnh | TODO | H17.01, H17.02, H17.03, H17.04, H17.05 |
| H18 | Tự động hóa hội thoại | TODO | H18.01, H18.02, H18.03, H18.04, H18.05 |
| H19 | Macro nhiều hành động | TODO | H19.01, H19.02, H19.03, H19.04, H19.05 |
| H20 | Thư mẫu phản hồi | TODO | H20.01, H20.02, H20.03, H20.04, H20.05 |
| H21 | Tích hợp và webhook | TODO | H21.01, H21.02, H21.03, H21.04, H21.05 |
| H22 | Audit và bảo mật SSO | IN PROGRESS | H22.01, H22.02, H22.03, H22.04, H22.05 |
| H23 | Gói quota billing và nâng cấp | IN PROGRESS | H23.01, H23.02, H23.03, H23.04, H23.05 |
| H24 | Báo cáo tổng quan hội thoại CSAT SLA | TODO | H24.01, H24.02, H24.03, H24.04, H24.05 |
| H25 | Báo cáo dữ liệu kênh agent nhãn nhóm | TODO | H25.01, H25.02, H25.03, H25.04, H25.05 |
| H26 | Tóm tắt AI và báo cáo định kỳ | TODO | H26.01, H26.02, H26.03, H26.04, H26.05 |
| H27 | Responsive bàn phím và khả năng tiếp cận | TODO | H27.01, H27.02, H27.03, H27.04, H27.05 |
| H28 | Platform Admin và cấp quyền AI | IN PROGRESS | H28.01, H28.02, H28.03, H28.04, H28.05 |
| H29 | Ticket SLA và escalation | TODO | H29.01, H29.02, H29.03, H29.04, H29.05 |
| H30 | Đa kênh và nhận diện khách | TODO | H30.01, H30.02, H30.03, H30.04, H30.05 |
| H31 | Lark Wiki và quyền tri thức kinh doanh | TODO | H31.01, H31.02, H31.03, H31.04, H31.05 |
| H32 | Vận hành privacy và khôi phục | IN PROGRESS | H32.01, H32.02, H32.03, H32.04, H32.05 |
| E01 | Dẫn nguồn chủ động | IN PROGRESS | E01 |
| E02 | CRM lead và cơ hội bán hàng | TODO | E02 |
| E03 | Phân tích AI ngay trong hội thoại | TODO | E03 |
| E04 | Lark Wiki và trợ lý nội bộ | TODO | E04 |
| E05 | Vai trò kinh doanh và dashboard quản lý | TODO | E05 |
| E06 | Onboarding dữ liệu ba nhóm | IN PROGRESS | E06 |
| E07 | Ticket và SLA nâng cao | TODO | E07 |
| E08 | Catalog đơn hàng và connector giao dịch | TODO | E08 |
| E09 | Thuê bao thương mại và hóa đơn | TODO | E09 |
| E10 | Đa kênh và hệ sinh thái tích hợp | TODO | E10 |
| E11 | Cá nhân hóa phong cách theo sale | TODO | E11 |
| E12 | Mở rộng vận hành sau pilot | TODO | E12 |

## Todo, priority và dependency

Xem [TODO](TODO.md). Core acceptance và fresh setup là ưu tiên trước feature/UI mới. H14–H15/H17–H21/H24–H27/H29–H31 và E mở rộng còn backlog; không có cơ sở gọi backend hoàn thành.

## Blocked

- Live AI/email/integration acceptance: cần account/credential môi trường test và quyền sử dụng; không ghi secret vào repo.
- H32.05: cần policy owner quyết định trước destructive implementation.
- Staging/production: môi trường và release approval chưa xác nhận.

## Technical debt

`app.ts` và `platform.ts` tập trung nhiều routes/logic; chưa refactor trong handoff. Không có lint script. Test tổng phải chạy serial theo package script, dùng PostgreSQL local. Chưa có coverage phần trăm được chứng minh. Platform Agent hiện chưa ghi `usage_operations`/`ai_usage_ledger`; cần product decision trước migration. Metadata trạng thái delivery cần tiếp tục đồng bộ với evidence, tránh đếm test thành tỷ lệ product.

## Unknowns

HiChat internal architecture, production hosting, provider live receipts, toàn bộ browser parity, production SLA/RPO/RTO và full conversation tool history: **UNKNOWN / NEEDS VERIFICATION**. Không đủ bằng chứng gán platform nào đã production-ready.

### 2026-10-01 browser remediation update

Local DOCX upload → DRAFT → READY → INTERNAL publication → reload verified. Added direct internal publication action on READY documents; no public transition required. Inbox internal-note persistence and visitor exclusion verified. Build all and frontend 9/9 pass. PR #4 remains draft; public lifecycle and negative-role/failure browser gates remain pending. No production acceptance implied.

Composer remediation: separated unsent text per conversation and public/internal mode, resets across user/workspace; keyboard conversation selection added. Browser proved two-conversation separation and retained draft on TAKEOVER_REQUIRED rejection. No across-reload persistence claim yet.

Local browser acceptance: Agent denied direct Knowledge URL; disposable fixture restored. Real API outage shows connection error; restart restores unsent draft without page reload. CDP offline was ineffective on localhost and excluded from evidence. Across-reload pending identity remains outstanding.

Reload follow-up: session-scoped composer drafts restore after reload with user/workspace and public/internal separation (browser verified). Retry clientId persists before sending and is reused until confirmed; local API double-send readback gives exactly one message. Frontend 11/11 and build pass. CI for these new changes still pending push. Residual fake controls and final acceptance audit remain.

Final review fixes: authenticated logout failure now visibly rendered (browser verified on API outage); conversation SSE closes when its access is revoked (DB policy + hub tests pass). Unimplemented AI rephrase/attachments/tags/reactions disabled explicitly, remain backlog. Build and 11 frontend tests pass; exact-head CI still required.

## H30.01 Meta SaaS — started 2026-10-01

Explicit user authorization starts Facebook/Instagram connector plan. Initial security primitives only; OAuth/webhooks/storage/Inbox/outbox/UI and live Meta verification remain IN PROGRESS. Scope/checkpoint: META-SAAS-IMPLEMENTATION.md. No Meta App or staging domain yet; guided developer registration awaiting user action.

Meta OAuth attempts schema/helpers added (migration058, not applied yet). Pending DB-backed expiry/replay/session/RLS tests and route integration. Full connector still IN PROGRESS.

Meta checkpoint 2026-10-01: foundation tests 3/3 passed on isolated PostgreSQL; migration 058 applied there. Backend typecheck passed. OAuth routes, connections, inbound/outbound and live Meta acceptance remain IN PROGRESS, not delivered.
OAuth configuration helper: 2/2 unit tests and backend typecheck passed; live provider setup and route wiring remain pending.
Meta HTTP boundary added: configuration/transport tests 5/5 passed, backend typecheck passed. Provider token exchange and all end-to-end acceptance remain pending.
Meta connection schema/helper and query-log redaction added. Two targeted tests passed on isolated DB; typecheck passed. No Connect callback or messaging transport exposed yet. Local disconnect is not provider-side revocation.
Meta list/local-disconnect HTTP endpoints mounted and verified for Owner/Agent/session/CSRF behavior with isolated database. Connect/enrollment and messaging remain incomplete.
Facebook Page discovery helper added with safe UI projection and bounded pagination; 2/2 fixture tests and typecheck passed. Provider-approved live connection is not verified.
Facebook code-exchange/permission-validation adapter implemented with fixture tests (asset + OAuth 4/4 passed). Not connected to callback; live version compatibility still NEEDS VERIFICATION.
Facebook Connect/callback/Page-list endpoints implemented with encrypted short-lived enrollment; pending HTTP callback acceptance and Page activation. Whole Meta integration remains IN PROGRESS.
Facebook callback HTTP/DB suite passed with mocked provider, including session revocation during exchange. Backend typecheck passed. No live Meta verification yet.
Facebook Page selection persists pending encrypted connection and consumes enrollment; HTTP test/typecheck passed. Channel transport now separates website from social channels. Subscription activation, webhook and outbound remain pending.
Facebook signed webhook ingress and durable tenant receipts implemented; targeted HTTP/database fixture suite and typecheck passed. Inbox normalization/subscription/outbound are still pending; no live Meta acceptance.
Facebook text normalization and explicit per-tenant batch worker added. Fixture HTTP/DB flow reaches existing Inbox APIs and deduplicates repeated message IDs; typecheck passed. No live Meta or production worker acceptance; outbound/attachments/Instagram still pending.
Facebook subscription activation endpoint added with provider confirmation and generation/identity recheck; mocked HTTP flow/typecheck passed. Public social replies/AI resume fail explicitly until real outbound path exists; notes remain usable. Live Meta acceptance pending.
Internal Facebook text send adapter added; not enabled in Inbox pending durable outbox and dispatch checks. Unknown outcomes are not retried automatically.
Meta durable outbound schema/enqueue added and tested for ownership/window/idempotency. Not enabled in Inbox; dispatch worker and delivery state integration still pending.
Outbound claim and bounded worker added with generation/ownership/window fences; fixture tests and typecheck passed. Worker is not scheduled and real provider dispatch remains unverified.
Inbox message API now exposes durable Meta delivery status/provider receipt fields; this does not prove delivery/read and UI still needs explicit state handling.

CI follow-up: run 36816158888 failed one legacy AI-resume unit fixture (194/195 passed): missing channel transport in mocked SQL result. Updated fixture to website and added Facebook/Instagram/missing-channel rejection cases with zero writes/audits. Production gate remains fail-closed. Targeted test and backend typecheck PASS; full CI rerun pending push. Meta integration remains IN PROGRESS.

Meta outbound follow-up: worker validates provider config/encryption key before claiming work, avoiding a stranded dispatching row on missing config. Isolated PostgreSQL callback/outbox test PASS including accepted receipt API readback, unknown outcome readback, repeated completion rejection and no automatic resend; backend typecheck PASS. Provider calls remain mocked. Next: integrate guarded human send and honest UI delivery states, Instagram flow, reconciliation and live acceptance.

Meta human Inbox integration: Facebook public replies now enqueue through the existing authenticated message endpoint (ownership, connection and 24h window checks); Instagram/unknown transports and social AI resume remain blocked. Internal notes keep their existing path. Inbox maps Facebook/Instagram source and renders queued/dispatching/accepted/unknown/cancelled text; accepted is explicitly not customer delivery/read. Build all PASS, frontend 12/12 PASS, isolated PostgreSQL callback/outbox HTTP fixture PASS. Browser/live-provider verification still pending; worker remains explicit per-tenant, not scheduled. New remote feature/knowledge-management uses migration prefix 058 as well: coordinate migration numbering/history at merge, do not rewrite deployed history. No merge of contributor branches performed.

Meta retry/dispatch review: an authorized original sender can recover an existing enqueue result after ownership changes; this performs no new send and still checks channel access and payload/actor identity. New enqueues continue to require active connection and current ownership. Isolated DB fixture PASS for revoked membership, changed connection generation and changed ownership cancelling queued work, plus idempotent replay after ownership change. Backend typecheck PASS. No live provider receipt. Migration note clarification: setup-db tracks full filenames, so duplicate numeric prefix 058 does not itself overwrite/skip either migration; dependency/order still needs joint merge review.

Instagram transport checkpoint: separate Instagram Login text-send adapter uses graph.instagram.com, bearer account token and matching recipient/message receipt validation. Conservative unknown outcome, no automatic retries. Facebook + Instagram adapter fixtures 6/6 PASS; backend typecheck PASS. Instagram OAuth/account connection, webhook normalization, outbox integration and live acceptance remain incomplete; adapter is not exposed through Inbox yet. CI runs for 62310df, 000162c and 0ab254e confirmed success.

Instagram OAuth adapter: official Business Login documentation read in authenticated browser (page updated 2026-03-13). Implemented multipart code exchange, strict single data-entry/user ID/required scopes validation and server-only long-lived token upgrade with expiry validation. Three fixture tests and backend typecheck PASS. Not yet wired to callback/persistence; no live token exchange. Next: account identity lookup and tenant/session-bound connection persistence, then Instagram webhook/outbox.

Instagram identity checkpoint: server-side /me discovery requests only user_id,username and projects a single professional account. Uses professional user_id (webhook entry.id), not app-scoped OAuth identity as channel asset. Rejects ambiguous/malformed responses. Account/OAuth fixtures 5/5 and backend typecheck PASS. Next: session-revalidated callback and encrypted pending connection, activation/webhook/outbox. Live Meta remains unverified.
