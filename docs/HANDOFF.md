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
