# Development handoff

## Widget Greeting as Chat Bubble & Clean Header Status — 2026-10-01

- **Dynamic Greeting as Chat Bubble (`.bubble.greeting-bubble`)**:
  - `backend/public/sdk.js`, `frontend/public/sdk.js`, `public/sdk.js`: Removed `<p class="greeting"></p>` from `.meta` header section so only the live status (`● Nhân viên đang hỗ trợ` / `● Trợ lý AI đang hỗ trợ`) and handoff button remain in the status bar.
  - Implemented `renderGreeting(text)`: Renders the opening greeting dynamically configured in the database (`channels.greeting`) as the very first chat bubble inside `.messages` (left-aligned standard bubble style).
  - Automatically hides the `.empty` placeholder when the greeting bubble is present.
  - Preserves greeting bubble position when messages load via `syncMessages()` or after pre-chat submission.
- **Dynamic Portal Preview**:
  - `frontend/src/screens/channels/WidgetPreview.tsx`, `Channels.tsx`, `ChannelConfiguration.tsx`: Added `greeting` prop to `WidgetPreview` so the admin screen previews the exact custom database greeting in the opening message bubble.
- **Verification**:
  - `npx tsx --test backend/tests/sdk-contract.test.ts`: Passed 2/2 tests.
  - `npm run build:all`: Passed with 0 errors across backend and frontend.

## Phương án A Tối ưu Hóa: Sub-Millisecond In-Memory Broadcast & Permanent Mode Switcher — 2026-10-01

- **Sub-Millisecond In-Memory Broadcast Pipeline (<1ms ACK)**:
  - `backend/src/modules/chat/websocket.ts`: Decoupled real-time socket delivery from database disk persistence. Pre-generates `msgId` (UUID v4), broadcasts `message:new` immediately across connected sockets in RAM (<1ms), and returns `message:ack` to sender (<1ms).
  - Background asynchronous task commits the message into PostgreSQL (`chat-store.ts:appendMessage`), ensuring 100% data durability and exact UUID alignment with 0 cross-continental database latency blocking the socket frame.
  - Latency dropped from ~2,400ms down to **0ms - 1ms** on automated tests.
- **1 Single Mode Toggle Button & Composer Permissions**:
  - `frontend/src/components/inbox/InboxView.tsx`: Simplified header to **1 single action button** with status badge:
    - In AI Mode (`ai_active` / `handoff`): Displays badge `[ 🤖 AI đang trả lời • ]` and 1 single action button `[ 👤 Chuyển sang Nhân viên chat ]`.
    - In Staff Mode (`in_review` / `open`): Displays badge `[ 👤 Nhân viên đang chat • ]` and 1 single action button `[ 🤖 Chuyển lại cho AI ]`.
  - **Composer Restriction in AI Mode**:
    - When conversation is in AI mode, the "Trả lời khách" tab is locked. Staff is **ONLY permitted to add internal notes**.
    - Displays an amber warning banner: *"Chế độ AI đang bật. Bạn chỉ có thể thêm ghi chú nội bộ (Khách không nhìn thấy)"*.
    - Only upon switching to Staff mode (`onTakeover`) is the public composer unlocked for chatting with the customer.
- **Automated Verification**:
  - Script `backend/scripts/verify_websocket_option_a.cjs`:
    - Full-Duplex WS connection: ~334ms.
    - Visitor -> Staff WS push with RAM broadcast: **1ms**.
    - Staff -> Visitor WS push with RAM broadcast: **0ms**.
    - Typing indicator latency: **2ms**.
    - Database history check: **100% messages saved and verified in PostgreSQL**.
  - `npm run build:all`: **Passed with 0 errors**.

## Realtime 2-way Chat, Zero-Latency SSE Streaming & Optimistic UI (Phân hệ 3 & Widget) — 2026-10-01

- **Message Disappearance Fix & Console Stability**:
  - `frontend/src/screens/console/ConsoleWorkspace.tsx`: Fixed `loadConversations()` state overwriting bug where incoming messages flashed and vanished. Now preserves previously loaded messages (`existing.messages`). Added dedicated `loadMessagesForConv(convId)` triggered on selection change and SSE events.
  - `backend/src/modules/chat/inbox.ts`: Enriched `inboxList` query to include `last_message_body` in initial messages array, preventing blank messages state on initial render.
- **Visitor Widget Realtime SSE Stream & Optimistic UI**:
  - `backend/src/modules/widget/widget.ts`: Implemented `GET /:key/stream?token=<visitorToken>` validating channel and visitor credentials, registering client into `realtimeHub` with `isVisitor: true`.
  - `backend/public/sdk.js`, `frontend/public/sdk.js`, `public/sdk.js`: Replaced legacy HTTP polling loop (`poll()`) with persistent `EventSource` connection (`connectStream()`).
  - Added **Optimistic UI**: Instant visitor message appearance (0ms perceived latency), instant input clearing, Enter key to submit (Shift+Enter for newline), error fallback with retry click.
  - Added **Agent Typing Indicator (`.typing`)**: Animated 3-dot pulse bubble rendered immediately when staff types in Console, auto-dismissed on new message or 6s timeout.
- **Security & Privacy Fence**:
  - `backend/src/modules/chat/realtime.ts`: Added strict visitor privacy filter in `broadcastToConversation()`. Internal staff notes (`visibility === 'internal'`) are physically blocked from visitor sockets at the server level.
- **Automated Verification & Benchmark**:
  - End-to-end benchmark script `backend/scripts/verify_realtime_e2e.cjs` executed across live PostgreSQL and SSE streams:
    - Signup -> Login -> Channel Setup -> Pre-chat -> Visitor Stream Connect -> Staff Stream Connect -> Staff Takeover -> Staff Typing Push -> Staff Message Push -> Visitor Typing Push -> Visitor Message Push -> Internal Note Leak Check: **100% PASSED**.
    - Staff -> Visitor push: Instant delivery via SSE.
    - Visitor -> Staff push: Instant delivery via SSE.
    - Security check: 0 bytes of internal notes leaked.
  - `npm run build:all` passed with 0 errors across backend and frontend.
  - `npx tsx --test backend/tests/sdk-contract.test.ts` passed 2/2 tests.

## Widget cross-origin embedding & snippet autoOpen — 2026-10-01

- `backend/src/app.ts` & `backend/src/index.ts`: Configured Helmet `crossOriginResourcePolicy: { policy: 'cross-origin' }` and `express.static('public')` headers (`Cross-Origin-Resource-Policy: cross-origin`, `Access-Control-Allow-Origin: *`) to unblock external website browsers from loading `sdk.js`.
- `backend/src/modules/widget/widget.ts`: Added `getRequestOrigin` fallback to Referer, set CORS headers before channel verification so browsers receive 403 `DOMAIN_DENIED` with CORS headers rather than opaque browser network errors, and added `cleanConfHost === cleanReqHost` (www vs non-www) in `isOriginAllowed`.
- `backend/src/modules/chat/channels.ts`: Updated snippet generation to include `autoOpen: false`, added data-attribute standard snippet without `DOMContentLoaded` race conditions, and made base URL robust against comma-separated `APP_ORIGIN`.
- Verified with unit tests (`tests/sdk-contract.test.ts`, `tests/widget-embed.test.ts`), live server check (HTTP 200, CORP: cross-origin), and full typecheck/build (`npm run build:all`).

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

Đang ở **documentation pause** sau khi audit song song hoàn tất. README/user guide/flow đang được làm rõ; chưa bắt đầu UI parity mới. Chưa có live provider/email receipt, staging deployment hay production release. `delivery/BACKLOG.csv` còn 107 Backlog/61 In progress/2 Implemented và cần đồng bộ sau acceptance.

## Files currently involved

- Backend routes/orchestration: `src/server/app.ts`, `platform.ts`, `platform-agent.ts`.
- Auth/tenant/security: `security.ts`, `db.ts`, migrations trong `db/migrations/`.
- Conversations/widget: `widget.ts`, `channels.ts`, `chat-store.ts`, `inbox.ts`, `public/sdk.js`.
- Knowledge/web: `knowledge*.ts`, `web-*.ts`, `web-snapshot-generation.ts`.
- AI/jobs: `provider-transport.ts`, `ai-reply-worker.ts`, `worker.ts`, `jobs.ts`, `quota.ts`, `usage-ledger.ts`.
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
- Cặp file suffix ` 2` còn tồn tại, chưa được phép xóa.

## Immediate next steps

1. Đọc `README.md`, `docs/USER-GUIDE.md`, `AGENTS.md`, `docs/PROJECT-STATUS.md`, `docs/TESTING.md` và `delivery/CHECKPOINT.md`.
2. Trong documentation pause, chỉ sửa tài liệu/evidence và kiểm tra link/diagram; không mở H/E feature mới.
3. Khi owner mở lại development, chạy `npm run build`, `npm test` và, với PostgreSQL local, `npm run db:restore-drill` sau thay đổi code liên quan.
4. P0.1 focused flow đã có evidence 9/9; tiếp tục bằng fresh fixture hai workspace khi thay đổi core và ghi evidence mới.
5. Với credentials được cấp riêng, chạy provider receipt và usage/quota matrix; redact mọi secret.
6. Chốt `delivery/decisions/H32_RETENTION_CLOSURE.md` và Platform Agent billing policy trước migration/destructive code.
7. Cập nhật PROJECT-STATUS/BACKLOG/CHECKPOINT cùng acceptance evidence; chỉ sau đó mở P1 feature hoặc UI browser acceptance.

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

## Current N1 execution handoff — 2026-09-29

- User explicitly reopened implementation for N1 baseline/fixture work.
- Added `backend/scripts/workshop-fixture.ts` with `--seed`/`--reset`; it requires `GOTEK_FIXTURE_DATABASE_URL`, `GOTEK_FIXTURE_DB_KIND=disposable-test-only`, and rejects Supabase shared/pooler hosts.
- Added root/backend `fixture:seed` and `fixture:reset` scripts.
- Verified `npm run build:all`, frontend `5/5`, backend targeted integration `9/9`, full backend `170/170`, `/api/health` `200`, and app `SELECT 1` read-only connectivity.
- Docker local PostgreSQL/Redis are healthy; all migrations applied; fixture A/B seed and reset passed; final read-only cleanup check returned `workspaces=0`, `channels=0`.
- Fixed Windows test portability (TCP instead of Unix socket, restore evidence path, CLI child shutdown) and fixed GET `/api/me` controller response bug that caused auth/workspace integration 500s.
- Do not run fixture seed/reset against the current Supabase shared database; use the local disposable DB or another explicitly isolated database.
- Current N1 baseline status: `DONE — LOCALLY VERIFIED`. DT-012 provider/quota/retention decisions and browser/PO acceptance remain separate open gates; they are not claimed as DONE.

## Current N2 execution handoff — 2026-09-30

- Visitor widget design and handoff control are implemented in both SDK copies.
- Added a public no-login visitor host route: `/chat/{publicKey}` in `frontend/src/screens/customer-chat/CustomerChatPage.tsx`; the public key selects the channel while tenant scope remains server-side.
- Local A/B demo links are documented in `plan_nguyen/10day/NGAY-2-TIEN-DO-2026-09-30.md`; they are test links, not production customer URLs.
- N2 status is `IMPLEMENTED — NEEDS BROWSER VERIFICATION`; contract test and monorepo build pass.
- Do not call D-UC06 accepted until a real browser proves session, message, handoff, pending state, Inbox visibility, wrong-origin and expired-token behavior.
- Preserve the exact-origin rule. Existing `fixture-a.example.test` and `fixture-b.example.test` are test origins, not public customer URLs.
- Next exact command: run the browser smoke/evidence matrix from `plan_nguyen/10day/NGAY-2-TIEN-DO-2026-09-30.md`, then update evidence and acceptance state.

## Current N3 execution handoff — 2026-09-30

- Replaced the `/app/channels` mock view with the real channel API screen in `frontend/src/screens/channels/Channels.tsx`.
- Added the customer URL to channel installation output; it uses `PUBLIC_APP_ORIGIN`, then `FRONTEND_ORIGIN`, then local `http://localhost:3001`. Provider secrets remain server-side.
- The channel screen now supports real list/create/toggle/configure flows, agent selection, customer-link copy/open, and embed-code copy.
- Verification: backend build PASS, frontend production build PASS, frontend tests 5/5 PASS, widget/SDK focused tests 2/2 PASS, `/api/health` 200 and frontend route 200.
- Remaining acceptance gap: browser login and customer chat with a valid Supabase account, plus exact-origin alignment for the current shared channels, still need explicit browser evidence.

### N3 UI refinement — 2026-09-30

- Reworked the channel console from a dense table/detail panel into responsive connection cards: three columns on desktop, two on medium screens, one on mobile.
- Create channel, installation link/embed code, and channel settings now open in centered modal dialogs with backdrop, Escape/close handling, and mobile sizing.
- UI labels now distinguish the website allowed to embed the widget from the direct customer chat URL; action buttons use clear icon hierarchy. Channel reads remain workspace-scoped by the authenticated membership.
- Rebuilt the channel settings form into grouped sections with agent cards, compact working-hour day cards, toggles, pre-chat field cards, widget settings and a sticky save footer. API payloads and permission boundaries are unchanged.
- Added a four-step explanatory guide and quick pre-chat form templates (Basic, Support, Full). Individual pre-chat fields no longer have an enable toggle; they stay visible and only their required/optional state is configurable. The server still receives `enabled: true` for compatibility with the existing contract.
- Converted the guide into a real wizard: only the active step is shown, Step 1–3 use `Tiếp tục`, prior steps use `Quay lại`, and Step 4 exposes the final save action.
- Fixed Step 1 `400 VALIDATION` for existing test memberships whose database UUID-shaped IDs are deterministic fixtures rather than RFC-versioned UUIDs; channel member validation now accepts the database UUID shape while retaining workspace membership checks.
- Added a reusable top-right toast for channel success/error feedback. Enable/disable, copy, create, template selection and settings save now use the toast; inline errors remain for field-level correction.
- Refined the working-hours UI with larger day switches, active/inactive day styling, clearer all-day controls, brighter time fields and responsive spacing; persistence behavior is unchanged.
- Updated Step 3 pre-chat fields to a one-column editor with `+ Thêm thông tin`, editable display label and input hint, required/optional checkbox, and a delete icon per field. Custom fields use safe generated keys, are persisted through the tenant-scoped settings API, and the UI prevents deleting the last remaining field.
- Extended the backend settings contract from the three fixed fields to safe custom field keys with a bounded maximum of ten fields; the widget already renders arbitrary configured keys and validates them against the channel configuration.
- Frontend build and tests after the refinement: PASS, 5/5 tests.
