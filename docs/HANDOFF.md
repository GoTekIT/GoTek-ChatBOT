## Active remediation checkpoint — 2026-09-30

User authorized fixes following the real WBS reconciliation. Branch `codex/chatbot-delivery`; origin/main `bd0f608` merged without dropping contributor changes (merge `15c7a19`). No push/PR yet. Scope remains SSE authorization/revocation, reset/logout, active Inbox/Knowledge API integration, Google verification and progress evidence.

Implemented locally, not accepted:
- SSE subscriptions require an authorization callback. Each event re-reads identity and checks conversation/channel scope under transaction locks. Workspace events without conversation scope are dropped; conversation subscriptions do not receive unrelated workspace events. Authorization failure closes the stream; heartbeat also rechecks identity. Per-client authorization queues are bounded.
- Reset response no longer exposes token in development; OTP no longer exposes devOtp and uses crypto.randomInt. Frontend debug OTP display removed.
- Logout preserves local identity and surfaces failure when server request fails; clears local session only after successful response.

Evidence so far: `npm run build:all` PASS; frontend tests 8/8 PASS, including offline logout; focused `backend/tests/realtime-authorization.test.ts` 1/1 PASS with injected authorization (not DB proof). Reset integration test now asserts no token/OTP in response but has NOT been run yet. No full backend DB suite or browser acceptance yet.

Next steps (required): validate actual DB-backed SSE policy with Agent channel negatives, membership/session expiry/revoke and workspace switch; inspect event transaction/commit ordering and worker processes. Provision a dedicated isolated test DB before backend tests (tests still hardcode port 55432 in places; do not use contributor DB). Integrate existing ConsoleWorkspace Inbox/Knowledge handlers with actual API, preserve UI and role gates; verify persistence and failure states in browser. Inspect Google audience configuration/test correct endpoint; do not claim live OAuth without receipt. Update environment docs carried by delivery branch: they contain pre-monorepo paths and stale claim of no env loader (current db.ts auto-loads env). Reconcile status notes, build/test, fetch remote again, commit and push only this branch then open/attach a new PR. Never force-push or merge main automatically.

Source files: backend realtime hub, inbox routes, realtime-authorization service, auth controller/service, auth-reset/realtime tests; frontend auth service/Auth screen/logout test. Original workbook unchanged. Full objective IN PROGRESS.

# Development handoff

## Collaboration safety checkpoint — 2026-09-30

Goal: cho nhiều contributor cập nhật cùng lúc mà không ghi đè công việc đã commit. Chỉ làm trên clone riêng tại `Downloads/Gotek_AI_chatbot/GoTek-ChatBOT`, nhánh `codex/collaboration-safety-20260930` từ `main` `4c57bca66aa80035b240cd4ac33af7e8da0088a3`; checkout cũ `Documents/ChatGPT/GoTek ChatBOT - CTO` không bị thay đổi hoặc push.

Completed locally: đồng bộ root `package-lock.json`, chuyển `install:all` sang ba bước `npm ci`, thêm `CONTRIBUTING.md` và PR template, nối README. `npm run install:all`, `npm run build:all`, `npm run test:frontend` (7/7) và `git diff --check` PASS. PR #3 đã chạy `test-and-build` PASS, gồm backend DB tests trên PostgreSQL CI riêng. Không chạy backend DB suite trên DB local dùng chung; không sửa nghiệp vụ hoặc nâng trạng thái H/E.

GitHub protection đã áp dụng: `main` ruleset 24158816 yêu cầu PR, 1 review độc lập, resolve thread, dismiss review cũ sau commit mới, last pusher không tự duyệt, CI `test-and-build` PASS và nhánh cập nhật theo `main`; chặn xóa/force push. Ruleset 24238565 chặn xóa/force push trên các nhánh làm việc. Không có bypass actor. PR #3 còn chờ review; chưa merge. Bản vá thử nghiệm backend env isolation được lưu ngoài repo tại `Downloads/Gotek_AI_chatbot/backend-env-isolation-wip-2026-09-30.patch` và chưa push vì `origin/nguyen` đang thay đổi cùng `backend/src/core/db.ts`/`backend/scripts/setup-db.ts`.

Outstanding branches cần giữ: `origin/nguyen` (`802b435`, code channel/widget và plan) chưa vào `main`; merge thử báo conflict `frontend/src/App.tsx` và `frontend/src/screens/console/ConsoleWorkspace.tsx`. `origin/codex/chatbot-delivery` (`aefffad`, bốn commit tài liệu) chưa vào `main`; merge thử báo conflict `docs/00-START-HERE.md` và `docs/PROJECT-STATUS.md`. Không cherry-pick/merge mù; owner từng nhánh phải review chỗ tự merge và conflict.

Next exact step: chờ reviewer độc lập duyệt PR #3, cập nhật nhánh nếu `main` tiến lên và chỉ merge khi check vẫn PASS. Khi có tên nhánh mới của KagamiToka, fetch và so sánh file trước khi nhận backend core slice không trùng file đang làm; dùng DB test riêng cho nghiệm thu.


## Latest correction — Google login runtime (2026-09-30)

User-reported Google login into the sample admin was traced to the actual Nginx
bundle at localhost:3001, which still called `loginWithGoogle` with Alex Rivera's
email. Rebuilt/recreated local backend/frontend containers and connected the
frontend Docker build to the public Client ID (`VITE_GOOGLE_CLIENT_ID`, falling
back to `GOOGLE_CLIENT_ID`). Vite local configuration preserves frontend/.env
and supports the root Client ID. Popup creation no longer awaits logout first.

Verified served bundle changed from `index-Wox_u0g8.js` to `index-DR5RoQoN.js`,
contains real Google popup code/configured Client ID, and contains no mock login
email. Old mock payload and empty payload both return 401 with no session cookie.
Docker builds passed; frontend tests 5/5 passed. Real Google login, full DB regression
and `/api/me` account comparison remain **NEEDS VERIFICATION**. Source fixes/builds
alone did not update the previously running container.

Evidence, limitations and next exact check:
[Google runtime correction](../delivery/evidence/google-login-runtime-2026-09-30.md).
Preserve existing unfinished changes. Do not close H01/H22 based on these checks.

## Current state

Dự án đã được refactor toàn diện sang kiến trúc Monorepo chuẩn mực theo format tham khảo của dự án `wdp` (Branch: `namnv`):
- `backend/`: Dịch vụ API độc lập (Node.js/Express, TypeScript strict, Clean Architecture với layers `controllers/`, `services/`, `repositories/`, `dtos/`, `routes/`, `middlewares/`), quản lý migrations `backend/db/migrations/`, SDK widget `backend/public/sdk.js`, workers/scripts `backend/scripts/`, và unit/integration tests `backend/tests/`.
- `frontend/`: Ứng dụng web React 19 + Vite độc lập (`frontend/src/` chia `features/`, `components/`, `hooks/`), proxy dev API sang backend port 4317, tests `frontend/tests/`.
- Root Workspace Orchestration: `package.json` quản lý `dev`, `dev:backend`, `dev:frontend`, `build:all`, `test:all`, `install:all`, `prod:up`, `prod:down`. Kèm `docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.ci.yml`, `deploy_all.sh`, `infra/`, `gitops/`, `mobile/`, `.github/workflows/ci.yml`.
Validation: `npm run build:all` PASS 100%, `npm run test:frontend` 5/5 PASS, Backend typecheck `tsc --noEmit` PASS 100%.

## Last thing being worked on

Lột xác toàn diện giao diện người dùng (UI/UX Redesign) và hoàn thiện cơ chế Hot Reload (HMR):
- **Đồng bộ Group Routes:** Chuẩn hóa toàn bộ nhóm route xác thực về `/app/auth/*` (`/app/auth/login`, `/app/auth/signup`, `/app/auth/reset`, `/app/auth/verify`), tự động điều hướng alias cũ `/app/login` sang `/app/auth/login`.
- **Băng chuyền Trượt Ngang Đăng nhập <-> Đăng ký (Continuous Carousel Slide):**
  - Đưa cả 2 form Đăng nhập và Đăng ký vào một băng chuyền ngang liên tục (Continuous Horizontal Slide Track rộng 200%), trượt mượt mà bằng lò xo vật lý Framer Motion (`stiffness: 300, damping: 32`).
  - Thiết kế Form Đăng ký theo Grid 2 cột nhỏ gọn, đưa chiều cao 2 pane bằng nhau, **loại bỏ 100% hiện tượng giật nhảy chiều cao khi đổi tab**.
  - Sliding pill của tab điều hướng chuyển động đồng bộ tức thì.
- **Bento Glass Card trung tâm & Tương tác 2D/3D xung quanh:**
  - Thu gọn màn hình đăng nhập về 1 Bento Glass Card tinh xảo nằm chính giữa trang (`max-width: 480px`, kính mờ Glassmorphism, vòng hào quang ambient glow).
  - Không gian tương tác 2D & 3D: Nền Three.js WebGL Starfield toàn cảnh phản hồi theo chuột, kết hợp 4 Floating Badges công nghệ lơ lửng xung quanh box (PostgreSQL RLS, Realtime pgvector, RAG Grounding, Staff Handoff) với hiệu ứng thị sai Parallax theo góc nhìn chuột.
- **Hiệu ứng Thu hẹp / Mở rộng Sidebar mượt mà (Animated Spring Sidebar):** Hợp nhất 2 trạng thái thành một cấu trúc `motion.aside` duy nhất với hiệu ứng lò xo vật lý (`stiffness: 340, damping: 32`), co dãn mượt mà giữa 64px (Rail mode) và 256px (Expanded mode), các nhãn chữ và submenu fade-in/out tự nhiên, mũi tên chevron xoay 180 độ.
- **Tối ưu Sidebar chuẩn Lark Suite / Linear:** Icon không viền phẳng, hover xám khói `#ebedf0`, active indicator pill màu xanh `#1664ff`, palette `#f8f9fa` chuyên nghiệp.
- **Kiểm thử & Nginx Production:** Build `tsc --noEmit && vite build` PASS 100%, bundle mới nhất (`index-D2ow5nYo.css`, `index-C4u9R7jK.js`) đã nạp vào container Nginx trên cổng 3001.







Các slice H05/H06 và hardening H01/H02/H16/H23/H28/H32, provider error contract, expired-grant fence, audit export, restore integrity/quarantine, NULL-lease recovery và ba audit boundary song song (jobs, knowledge/widget, Platform Agent). Validation sau hợp nhất: `npm run build` PASS, `npm test` **175/175 PASS**, P0.1 focused acceptance 9/9 PASS và restore drill PASS trên 55 bảng; xem `docs/TESTING.md` và `delivery/evidence/`.

## Exact point where work stopped

Đang ở **documentation pause** sau khi audit song song hoàn tất. README/user guide/flow, hướng dẫn `.env`/provider secret và Word handoff `.env`/PostgreSQL đã được làm rõ. Một `.env` local mode `0600` đã được tạo từ `.local/runtime.json`; file bị ignore và không được commit. PostgreSQL local đã được khởi động và xác minh qua `DATABASE_URL`: database `gotek_chatbot`, app role `gotek_app`, PostgreSQL 16.15, 57 migrations và 55 public tables; `gotek_app` không có `BYPASSRLS`. Server local cũng đã trả `GET /api/health` HTTP 200. Chưa bắt đầu UI parity mới. Chưa có live provider/email receipt, staging deployment hay production release. `delivery/BACKLOG.csv` còn 107 Backlog/61 In progress/2 Implemented và cần đồng bộ sau acceptance.

## Files currently involved

- Backend routes/orchestration: `src/server/app.ts`, `platform.ts`, `platform-agent.ts`.
- Auth/tenant/security: `security.ts`, `db.ts`, migrations trong `db/migrations/`.
- Conversations/widget: `widget.ts`, `channels.ts`, `chat-store.ts`, `inbox.ts`, `public/sdk.js`.
- Knowledge/web: `knowledge*.ts`, `web-*.ts`, `web-snapshot-generation.ts`.
- AI/jobs: `provider-transport.ts`, `ai-reply-worker.ts`, `worker.ts`, `jobs.ts`, `quota.ts`, `usage-ledger.ts`.
- Environment/handoff: `.env.example`, `docs/ENVIRONMENT.md`, `docs/DEVELOPMENT.md`, `AGENTS.md`.
- Word environment/database handoff: `docs/GoTek_Chatbot_Environment_Database_Handoff.docx`.
- Verification: `tests/*.test.ts`, `delivery/evidence/`, `delivery/CHECKPOINT.md`.

## What already works (evidence-limited)

- TypeScript/build gate và serial test suite từng pass; xem `docs/TESTING.md`.
- Tenant/membership checks, widget boundary, assignment capacity, visitor profile, audit list/export, provider stable errors và restore drill có targeted evidence.
- Restore drill kiểm tra 55 tables, SHA-256 canonical row hashes, RLS/policy metadata, quarantine và disposable DB cleanup.

## What currently does not work or is unverified

- Không thể tuyên bố full H01–H32/E01–E12 accepted.
- Provider live calls, external email, browser parity, JS crawler, staging/production chưa verify.
- Platform Agent actor/session/idempotency/recovery có local evidence; billable token/quota ownership chưa chốt và chưa có usage ledger rows cho route này.
- Retention/delete/tenant closure chưa có policy.
- Signup browser error “Không thể kết nối” từ conversation chưa được tái hiện trong snapshot.
- Full `npm test` chưa được gọi là pass trong lượt xác minh `.env` này: run serial bị dừng sau một số suite vì fixture cleanup trên database tích lũy chậm; xem evidence mới và không thay thế evidence regression 175/175 của ngày 2026-09-27.
- Cặp file suffix ` 2` còn tồn tại, chưa được phép xóa.

## Immediate next steps

1. Đọc `README.md`, `docs/USER-GUIDE.md`, `docs/ENVIRONMENT.md`, `AGENTS.md`, `docs/PROJECT-STATUS.md`, `docs/TESTING.md` và `delivery/CHECKPOINT.md`.
2. Mở `docs/GoTek_Chatbot_Environment_Database_Handoff.docx` để đối chiếu vị trí `.env`, fallback `.local/runtime.json`, PostgreSQL roles/RLS, migration và backup/restore.
3. Trong documentation pause, chỉ sửa tài liệu/evidence và kiểm tra link/diagram; không mở H/E feature mới.
4. Khi owner mở lại development, chạy `npm run build`, `npm test` và, với PostgreSQL local, `npm run db:restore-drill` sau thay đổi code liên quan.
5. P0.1 focused flow đã có evidence 9/9; tiếp tục bằng fresh fixture hai workspace khi thay đổi core và ghi evidence mới.
6. Với credentials được cấp riêng, chạy provider receipt và usage/quota matrix; redact mọi secret.
7. Chốt `delivery/decisions/H32_RETENTION_CLOSURE.md` và Platform Agent billing policy trước migration/destructive code.
8. Cập nhật PROJECT-STATUS/BACKLOG/CHECKPOINT cùng acceptance evidence; chỉ sau đó mở P1 feature hoặc UI browser acceptance.

## Do not break

- Không bỏ tenant predicates, provider grant/capability/expiry, public knowledge boundary hoặc no-resend unknown semantics.
- Không commit `.env`, key, cookie, token, backup/runtime files trong `.local/`.
- Không refactor lớn/xóa duplicate trước khi owner xác nhận.
- Không gọi HiChat parity hoặc production-ready nếu chỉ có research/test giả.

## Assumptions

Local PostgreSQL configuration và credentials chỉ là môi trường dev; không suy ra production topology. `claude_code` adapter hiện là provider transport tương thích Anthropic trong source; cần product decision nếu muốn chạy CLI riêng.

## Open questions

Provider accounts nào được dùng cho staging? Email delivery nào? H32 retention/delete policy và owner? Browser acceptance reference/screenshots nào đủ cho HiChat parity? Hosting/CI/CD/staging domain nào? Tất cả là UNKNOWN / NEEDS VERIFICATION.

## Recommended next task

Sau khi documentation pause được gỡ bằng một checkpoint mới: hoàn thiện P0.1 full acceptance matrix beyond the focused 9/9 local slice, rồi chạy P0.2 live provider receipt nếu owner cung cấp credential test. Không làm thêm UI cho tới khi core path và failure states được nghiệm thu.

### Remediation follow-up — isolated DB verified

Created dedicated PostgreSQL cluster at ignored `.local/remediation-db/data`, socket `.local/remediation-db/socket`, port 55439. Setup completed 58 migration files (including the existing duplicate 048 prefixes); private runtime `.local/remediation-db/runtime/runtime.json`. Do not print credentials or use default/shared DB.

Executed successfully (3/3 test cases, serial):
```
PGHOST="$PWD/.local/remediation-db/socket" PGPORT=55439 DB_RUNTIME_FILE="$PWD/.local/remediation-db/runtime/runtime.json" backend/node_modules/.bin/tsx --test --test-concurrency=1 backend/tests/realtime-policy-db.test.ts backend/tests/auth-reset.test.ts backend/tests/authorization.test.ts
```
DB policy test proves Agent allowed/denied channels, Admin→Agent live role change, channel unassignment, workspace switch, expired session, disabled membership and deleted session with no unauthorized delivery. Existing RBAC suite covers platform/tenant separation and last Owner. Reset HTTP integration confirms no token/devOtp in response, single-use/expiry and old-session revocation. This is policy+HTTP proof, not live SSE/browser acceptance.

Added typed frontend InboxService API adapter, message pagination/mapping. Not yet connected to ConsoleWorkspace. Fixed useRealtimeChat URL to actual `/api/conversations/:id/stream` and removed simulated connected state for invalid demo IDs. Next: wire container state and async callbacks (retain text/idempotency ID on failures), avoid mutating conversation props inside SSE callbacks, then knowledge import/publish APIs. Review pre-commit realtime broadcasts before accepting rollback behavior. Google configuration still pending. No push yet.

Inbox integration advance: ConsoleWorkspace now calls useInboxData/InboxService for list/history, send, takeover (owner version) and resolve. Pending send IDs survive retry within mounted workspace; failed sends keep composer text; success follows API response. Workspace/permission transitions clear data; polling and SSE refresh server state. InboxView empty/error states prevent rendering undefined conversations. SSE callbacks no longer mutate props; callback refs prevent reconnect loops; typing uses the authenticated API wrapper. Build passed before the latest empty/error and callback-ref edits; rerun build/tests and browser acceptance next. Knowledge remains mock and must be completed; no acceptance claim.

### Knowledge and transaction follow-up — 2026-09-30

Implemented KnowledgeService/useKnowledgeData: load actual tenant items with cursor pagination; multipart PDF/DOCX import with stable request ID; process draft; publish public/internal; archive. Import remains DRAFT until explicit lifecycle actions. ConsoleWorkspace no longer imports mock documents. Removed fake import timer, vector reindex timer and fabricated counters/pagination/embedding receipt text. Added version-fenced, idempotent archive endpoint with role/tenant checks, audit and history retention (active=false).

New tests: knowledge-archive HTTP/DB 1/1 PASS (foreign 404, Agent 403, revision409, request replay, history preserved). Google configuration test 1/1 PASS: missing client ID fails closed before network; wrong audience/profile subject rejected. Live Google login still not verified. Build all PASS after current changes.

Added afterCommit transaction callbacks; inbox/widget broadcasts now enqueue until database commit, discarded on rollback. Dedicated commit/rollback regression plus policy and archive tests run serially with same isolated DB configuration above; see ignored `.local/remediation-db/focused-latest.log` for actual results.

Remaining required before PR: browser persistence/error/role acceptance; API tests for full Knowledge import→process→publish→archive flow; remove/implement residual fake Knowledge Review/Revise/Re-crawl controls and Inbox AI/tag/reaction claims (do not silently call them real); ensure real-file formats and UI labels agree (currently PDF/DOCX ≤2MB). Review frontend async stale-response races and retry IDs across reload; full backend regression requires isolating hardcoded test admin connections, never shared DB. Update pre-monorepo ENVIRONMENT guidance. Re-fetch remote, inspect overlaps, commit only clone changes and open new PR from codex/chatbot-delivery. No push yet; scope not complete.

### Browser knowledge persistence — 2026-10-01

Added KnowledgeEditor detail/edit using existing revision-fenced draft API. Review/Revise now open actual server content; new draft mapping no longer treats an older public version as the current draft. Frontend tests 9/9 PASS including published-old/draft-new mapping. Build all PASS before final mapping adjustment; rerun final build before commit. Re-crawl control explicitly disabled pending proper web-source screen integration, no fake success.

Isolated preview running via exec session 59395 at http://127.0.0.1:4329, ignored `.local/remediation-preview.ts` serves createApp + built SPA without notification worker. DB same isolated port55439, restarted only after pg_ctl reported stopped. Browser tab1 (iab) is marked handoff. Disposable fixture email remediation-browser-20261001@example.test; credentials only in test setup, no real user credentials used.

Browser verified: manual login, Knowledge loads server fixture, Retry processes DRAFT→READY, Review opens persisted content, edit title/body and save creates draft, reload shows `Knowledge saved through browser` and updated bytes. Evidence screenshot outside repo: `/Users/ngxuanphu/Downloads/Gotek_AI_chatbot/knowledge-browser-persist-20261001.png`. Mouse click tool appeared ineffective on this IAB session; keyboard Enter triggered forms/buttons correctly. Do not conclude mouse UX accepted; recheck independently. Browser source bundle index-DkEeYABf.js predates the final mapping fix, so complete fresh build/reload is required before acceptance.

Next: finish active Inbox browser success/error/reload; PDF/DOCX real upload and publish audience browser; negative role refresh; full isolated regression; environment doc corrections; safe remote sync and new PR. Goal remains IN PROGRESS, no push yet.

### Review checkpoint — 2026-10-01

Fresh fetch: main still bd0f608; nguyen advanced to b27b540. Its unmerged work overlaps core/db.ts, widget.ts, auth-reset tests and ConsoleWorkspace.tsx among other files. Preserve both branches and review those overlaps during eventual merge; no source from old Documents checkout included. Added per-request sequence guards to prevent stale concurrent refresh responses replacing newer Inbox/Knowledge state. ENVIRONMENT now has authoritative monorepo correction above historical content.

Fresh build PASS (bundle index-D1olrJjG.js). Focused test run from root hit fixture path ENOENT for tests/fixtures/enterprise-faq.docx; rerun from backend cwd using exact same isolated DB. Log `.local/remediation-db/regression-selected-backend-cwd.log`. This is a runner cwd correction, not ignored test failure.

Preparing draft PR only. Remaining gates: final browser Inbox send/reload/error/role, actual PDF/DOCX upload and public/internal lifecycle, full backend CI and review of concurrent nguyen changes. No production deploy or merge authorized by this checkpoint. Goal remains active.

### CI and Inbox browser receipt — 2026-10-01

PR #4 draft created from codex/chatbot-delivery at 1fb2a30. First CI run36753523210: 175/176 backend pass; sole failure inbox-resume-ai fake DB called service without transaction, rejected by new afterCommit contract. Test now mocks pool connection and exercises transaction wrapper, preserving ownership/version assertions. Focused test and backend typecheck PASS; CI rerun required after push.

Inbox browser verified on isolated preview: real visitor message loaded; takeover switched to human; staff reply sent through composer; reload preserved reply in main transcript. Visitor API readback confirms exactly one `Staff browser reply persisted`. Screenshot outside repo `/Users/ngxuanphu/Downloads/Gotek_AI_chatbot/inbox-browser-persist-20261001.png`. This is real local receipt/persistence, not customer delivery or production proof. Next browser checks: note privacy, upload/publish, negative role and error handling; CI must finish green before readiness.

### Verified continuation — 2026-10-01

CI run 36754158834 at commit 4ae3950 passed test-and-build (2m25s), verified through gh pr checks 4. PR #4 remains draft pending remaining browser gates. Prior pending-CI entries above are superseded.

Browser local Inbox internal-note acceptance: saved INTERNAL_BROWSER_NOTE_ONLY via actual internal-note composer, reloaded page, confirmed staff transcript retained note and private label. Independent visitor /messages readback excludes that note and contains exactly one earlier public reply. Screenshot outside Git: /Users/ngxuanphu/Downloads/Gotek_AI_chatbot/inbox-note-private-20261001.png. Preview still healthy on port4329. Original tab expired; replacement IAB tab2 marked handoff. No customer or production messaging.

Next required: actual file upload/publish browser flow, negative-role and failure handling acceptance, then reconcile remaining UI placeholders and readiness. No production/whole-product completion claim.

### DOCX browser lifecycle — 2026-10-01

Uploaded backend/tests/fixtures/enterprise-faq.docx through the real file chooser; imported row appeared DRAFT, explicit process changed it to READY. Found missing direct internal publication action: added Publish Internal beside Publish Public for READY so private documents never need public publication first. Verified direct INTERNAL publication and reload persistence in browser. Renamed misleading Re-index All Vectors button to Xử lý các bản nháp to match its operation. Screenshot outside Git: /Users/ngxuanphu/Downloads/Gotek_AI_chatbot/knowledge-internal-upload-20261001.png.

Build all PASS and frontend 9/9 PASS. Remaining gates: public publication, negative role and failure UI checks, residual placeholder review. Existing CI pass applies to 4ae3950; this change needs its own CI run. Goal remains active.

### Public lifecycle and composer isolation — 2026-10-01

Browser verified edited fixture DRAFT→READY→PUBLIC and reload persisted Published Public. Screenshot outside Git: /Users/ngxuanphu/Downloads/Gotek_AI_chatbot/knowledge-public-20261001.png.

Found composer shared one draft between conversations and public/internal modes. Changed drafts to per-conversation/per-visibility state; async success updates its captured draft only. Keyed InboxView by user/workspace to prevent cross-scope carryover. Build all PASS. Browser confirmed PRIVATE_UNSENT_DRAFT stays absent from public composer and is retained when returning to internal mode. It was not submitted. Screenshot /Users/ngxuanphu/Downloads/Gotek_AI_chatbot/inbox-draft-isolation-20261001.png. Changes currently local, require next focused multi-conversation/failure acceptance and commit. CI run36755264862 last observed pending, do not infer result. Negative role UI and residual placeholders remain outstanding.

### Multi-conversation and rejected-send acceptance — 2026-10-01

Created second disposable visitor conversation. Added keyboard semantics to conversation rows (Enter/Space, accessible name and selected state). Browser confirmed internal draft from first conversation is empty in second conversation and restored on return. Attempted public send before takeover: backend TAKEOVER_REQUIRED shown, draft preserved, no success state. Screenshot outside Git: /Users/ngxuanphu/Downloads/Gotek_AI_chatbot/inbox-send-rejected-20261001.png. Added Vietnamese messages for TAKEOVER_REQUIRED and STALE_REPLY_OWNER. Build all passed before those message-only edits; frontend tests rerun below. Latest CI run36755264862 verified still executing Backend Typecheck & Tests; never restarted. Next: negative-role UI, network failure/reload pending-send identity, residual misleading controls and final scope audit.

### Role denial and actual network recovery — 2026-10-01

Disposable browser fixture membership temporarily changed Owner→Agent in isolated port55439 DB. Direct /app/knowledge navigation showed permission-denied alert, no knowledge table, management navigation removed. Restored fixture Owner afterward (one row). Screenshot /Users/ngxuanphu/Downloads/Gotek_AI_chatbot/agent-knowledge-denied-20261001.png.

CDP offline emulation did NOT block localhost; its test message actually persisted. Do not count that attempt as offline proof. Cleared emulation. Instead stopped only our preview process using its live exec handle; main displayed real connection error. Restarted exact isolated preview, filled RECOVERABLE_UNSENT_DRAFT, stopped preview again, observed connection error, restarted: automatic poll restored view with draft unchanged. No draft send occurred. Evidence /Users/ngxuanphu/Downloads/Gotek_AI_chatbot/inbox-api-unavailable-20261001.png and inbox-draft-recovered-20261001.png. Current preview exec session87908, IAB tab2 handoff, same port4329, no notification worker.

Remaining: reload-safe pending-send identity and residual misleading controls; finalize evidence scope and CI. Current browser proof covers transient API outage without page reload, not ambiguous accepted-send retry after reload. PR remains draft.

### Reload-safe reply identity — 2026-10-01

Added replyRetryStore backed by sessionStorage, scoped by user/workspace/conversation/visibility/body. Persist clientId before send; retry after reload reuses it, acknowledgement removes only matching identity, logout removes retry records. Storage failures block sending with explicit message. useInboxData now uses this store instead of a mounted-only Map. Tests cover simulated reload, lost acknowledgement, scope/visibility separation, stale acknowledgement and quota failure: frontend 11/11 PASS; build all PASS. Independent real local API test repeated identical internal message/clientId twice and read back exactly one message. Original CI run36756065228 at ad7caf9 now SUCCESS.

This provides retry identity after reload if the same body is resubmitted; unsent composer text itself remains in memory and does not yet restore after full reload. Pending requirement: wire draft restoration or expose pending retry UI, then final audit. Changes local pending commit, no completion claim.

Composer reload follow-through: InboxView now restores validated sessionStorage drafts per user/workspace/conversation/visibility and persists changes; logout clears composer and retry stores. Browser fresh build verified RELOAD_PRIVATE_DRAFT survives full reload, remains absent in public composer, appears only after choosing internal mode. Screenshot /Users/ngxuanphu/Downloads/Gotek_AI_chatbot/inbox-reload-private-draft-20261001.png. Build all PASS. This supersedes the missing-composer-restoration note immediately above. Session storage is tab-local, not a cross-device draft service.

### Final review corrections — 2026-10-01

Disabled unimplemented Inbox AI rephrase, attachments, CRM tag mutations and reactions with unavailable labels/titles. Removed fake AI rewrite/timer and success claims. These auxiliary features remain NOT IMPLEMENTED, not counted complete. Latest nguyen update b27b540→26e8517 changes three SDK copies only; earlier broader overlaps remain for independent review.

Found logout error was stored but not rendered while authenticated: added dismissible Notice in console shell. Browser actual preview outage then Logout showed explicit connection error and retained authenticated shell; screenshot /Users/ngxuanphu/Downloads/Gotek_AI_chatbot/logout-failure-visible-20261001.png. Restored preview, now exec session36516.

Conversation-specific SSE now closes on lost conversation access (policy throws; hub closes) rather than merely suppressing events. Workspace stream still skips individual inaccessible conversations. Regression DB test added, 2/2 SSE suites PASS; build all PASS; frontend 11/11 PASS. Changes require new CI run. Remaining external acceptance: live Google OAuth/email/provider receipts; no credential, deployment or full WBS acceptance claim. Next: push corrections, verify exact-head CI, consolidate PR evidence and scope audit.

## H30 Meta SaaS implementation started — 2026-10-01

User authorized implement/commit/PR on codex/chatbot-delivery, preserving contributor work. See META-SAAS-IMPLEMENTATION.md for full scope. Added independent modules/meta/security.ts (raw-byte webhook HMAC, AES-GCM token envelope with tenant/asset AAD) and meta-security tests; no endpoint/DB/transport wired yet. User has no Meta App or HTTPS staging and authorized guided browser setup. Meta registration is currently waiting for user acceptance of Platform Terms/Developer Policies and identity/contact verification; no app created or permissions approved. Continue schema/RLS and OAuth lifecycle independently. Keep goal active; do not call utility tests connector acceptance.

Meta OAuth foundation continuation: added ordered migration058 for tenant-RLS OAuth attempts and oauth-state.ts helpers. State stored as hash, expires in10min, binds user/session/workspace/provider; atomic consume and channels.manage check. Not yet applied to any DB or wired to callback; DB concurrency/RLS test required next. Current uncommitted files remain independent Meta module + tests + migration + docs; do not claim Connect works. Developer registration still awaits user acceptance; do not click terms automatically.

### Meta foundation verification — 2026-10-01
- Applied migration 058 only on the isolated remediation cluster (port 55439).
- Passed 3/3 Meta tests: exact webhook signature, authenticated token encryption, tenant/session/provider-bound single-use OAuth state including concurrent consumption and expiry. Backend typecheck passed.
- Setup must run from `backend/`: the legacy root `db/migrations` otherwise takes precedence. Use explicit isolated DB_RUNTIME_FILE and normalized socket path; no shared database was used for this verification.
- Meta creation UI now has Messenger and Instagram use cases selected; app creation and provider approval remain incomplete.
- Next: configuration and OAuth routes with current identity/permission checks, then asset credentials, webhook receipts, inbox normalization and outbound transport. Helpers are not wired into live routes; no claim of live messaging acceptance.

### OAuth configuration checkpoint
- Added server-only provider configuration/authorization URL builder and two passing tests; backend typecheck passed.
- Fixed provider origins, explicit graph version, HTTPS callback validation, separate Facebook business config and Instagram messaging scopes. No app secrets returned in authorization URLs.
- Files: backend/src/modules/meta/config.ts and backend/tests/meta-config.test.ts. Routes/callback token exchange are still pending; do not expose Connect until callback persistence is complete.

### Provider HTTP boundary checkpoint
- Added `backend/src/modules/meta/http.ts`: fixed HTTPS provider host allowlist, redirects rejected, 10-second abort deadline, 1 MiB streamed response limit, object-only JSON, sanitized stable errors, no automatic retries.
- Configuration + HTTP suites: 5/5 passed; backend typecheck passed. Tests cover forbidden endpoints, malformed/oversized responses, provider errors without secret disclosure, timeout and single-attempt behavior.
- Official Meta business-login/manual-flow pages returned HTTP 429 during verification; token exchange contract has NOT been accepted or wired based on memory. Continue with official source/dashboard verification and callback implementation.
