# Current monorepo environment correction — 2026-10-01

This section supersedes the historical guide below where they conflict. Read current source before starting a server/worker.

- Backend code is under `backend/src`, migrations under `backend/db/migrations`; frontend under `frontend/src`.
- `backend/src/core/db.ts` auto-loads `.env` or `../.env` with `process.loadEnvFile` when supported. Never print or commit those files.
- Explicit `DB_RUNTIME_FILE` takes precedence, then `DATABASE_URL`, then `.local/runtime.json` (root/backend relative), then `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD` defaults. Prefer a dedicated runtime file for tests; never let test processes silently use a shared database.
- `backend/src/index.ts` reads PORT/HOST (defaults 4317/127.0.0.1); SERVE_BUILD serves the built frontend. It also starts a notification worker. Do not run provider/email workers without reviewing environment and recipients.
- `npm run build:all`, `npm run test:frontend`, `npm run test:backend` are root commands. Backend tests include legacy hardcoded admin port55432; setting PGPORT alone does not isolate every test. The focused remediation tests honor PGHOST/PGPORT; full suite requires a verified isolated environment.
- Reset/OTP responses never include reset credentials, including development. Local delivery spool is test infrastructure, not email receipt. GOOGLE_CLIENT_ID is required for Google login; missing configuration fails closed.
- This change does not approve production, provider usage or customer messaging. Runtime feature readiness is separate from deployment approval.

---

## Historical pre-monorepo guide (paths and loader claims below are superseded)

# Environment and configuration

Tài liệu này là hướng dẫn cấu hình cho developer tiếp nhận GoTek Chatbot. Nó mô tả cách source hiện tại đọc biến môi trường, cách chạy local/test và cách cấp secret cho provider AI. Đây là cấu hình đã kiểm tra từ `src/server`, `scripts` và `package.json`, không phải cấu hình production đã được phê duyệt.

## Quy tắc quan trọng

- [`.env.example`](../.env.example) là template an toàn để bàn giao. Không commit `.env`, `.local/runtime.json`, API key, cookie, JWT, mật khẩu DB hoặc private key.
- Backend **không có dotenv loader**. Việc copy `.env.example` thành `.env` không tự làm biến xuất hiện trong process. Phải export biến trong shell trước khi chạy server hoặc worker.
- Nếu `DATABASE_URL` không có giá trị, app đọc credential local từ `.local/runtime.json`. File này được `npm run db:setup` tạo với mode riêng tư `0600` và đã nằm trong `.gitignore`.
- Mỗi process đọc environment khi khởi động. Sau khi đổi biến, dừng và khởi động lại server/worker tương ứng.
- `NODE_ENV=production` hiện bị từ chối ở server và các worker. Chưa có quy trình production trong repository.
- Provider registry lưu **tên** biến trong `providers.secret_ref`, không lưu secret. Tên biến và giá trị thật chỉ được tồn tại ở server-side environment.
- `PORT`, `HOST`, `CORS_ORIGIN` và các biến pool PostgreSQL không được source hiện tại đọc; server local bind cố định `127.0.0.1:4317`. Không tự thêm biến mới rồi coi là đã được hỗ trợ.

## Cấu hình chạy qua source

```mermaid
flowchart LR
  T[.env.example] --> C[Copy to local .env]
  C --> E[Export variables in shell]
  R[.local/runtime.json] --> F[Database fallback]
  E --> P[Express and workers]
  F --> P
  S[providers.secret_ref] --> K[Server provider secret]
  K --> P
```

Luồng thực tế là:

1. `src/server/db.ts` dùng `DATABASE_URL` khi biến có giá trị; nếu không, nó đọc `.local/runtime.json`.
2. `src/server/index.ts` chạy Express + Vite middleware khi `SERVE_BUILD` khác `true`; với `SERVE_BUILD=true`, nó phục vụ `dist` sau khi build.
3. `src/server/app.ts` dùng `APP_ORIGIN`, `COOKIE_SECURE` và `GOTEK_DEFAULT_AI_RESPONSE_QUOTA`.
4. `src/server/channels.ts` dùng `APP_ORIGIN` để tạo snippet widget.
5. Các worker đọc `GOTEK_WORKER_WORKSPACE`, `GOTEK_KNOWLEDGE_VERSION`, `GOTEK_EMBEDDING_MODEL` và `GOTEK_EMBEDDING_BATCH_SIZE` từ process riêng.
6. `src/server/worker.ts`, `src/server/platform.ts` và `src/server/knowledge-embedding-worker.ts` tra `process.env[secret_ref]` ngay trước provider call. Secret không đi trong job payload hay widget response.

## Bộ biến được source hiện tại sử dụng

| Biến | Kiểu/giá trị | Bắt buộc | Mặc định hoặc hiệu lực | Được đọc ở | Ghi chú bàn giao |
|---|---|---:|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Không nếu dùng DB local | Không set hoặc rỗng → `.local/runtime.json` | `src/server/db.ts` | Không export chuỗi rỗng với ý nghĩa là DB khác; dùng URL đầy đủ khi muốn override. `db:setup` vẫn dùng bootstrap local riêng. |
| `NODE_ENV` | chuỗi | Không | Giá trị local khuyến nghị `development` | server và workers | `production` cố ý dừng với `Production is not approved`; không dùng biến này để tuyên bố production-ready. |
| `SERVE_BUILD` | chuỗi `true`/khác | Không | Khác `true` → Vite middleware | `src/server/index.ts` | Đặt `true` chỉ sau `npm run build` để preview build local/test. |
| `APP_ORIGIN` | URL origin | Không | `http://127.0.0.1:4317` | `app.ts`, `channels.ts` | Dùng đúng origin trình duyệt mở, gồm scheme + host + port. API so sánh Origin cho request ghi; `localhost` và `127.0.0.1` không tự coi là một. |
| `COOKIE_SECURE` | chuỗi `true`/khác | Không | khác `true` → cookie không có `Secure` | `src/server/app.ts` | Local HTTP để `false`; chỉ đặt `true` khi môi trường thực sự dùng HTTPS. |
| `GOTEK_DEFAULT_AI_RESPONSE_QUOTA` | số nguyên không âm | Không | `1000` | `src/server/app.ts` | Chỉ làm quota mặc định lúc signup workspace mới; không sửa budget hiện hữu. Giá trị sai làm signup lỗi server. |
| `GOTEK_WORKER_WORKSPACE` | UUID workspace | Theo worker | Không có default | `scripts/ai-worker.ts`, `scripts/embed-knowledge.ts`, `scripts/web-refresh-worker.ts` | Bắt buộc cho chế độ một workspace. AI worker có `--all` để scheduler tin cậy tự tìm tenant; không dùng `--all` cùng biến này. |
| `GOTEK_KNOWLEDGE_VERSION` | UUID knowledge version | Embedding worker | Không có default | `scripts/embed-knowledge.ts` | Phải là version thuộc workspace được chọn và còn hợp lệ. |
| `GOTEK_EMBEDDING_MODEL` | UUID model registry | Embedding worker | Không có default | `scripts/embed-knowledge.ts` | Model phải được Platform Admin cấp capability `embedding` và provider/model đang active. |
| `GOTEK_EMBEDDING_BATCH_SIZE` | số nguyên `1..100` | Không | `20` | `scripts/embed-knowledge.ts` | Giới hạn số chunk mỗi batch; không phải giới hạn token provider. |
| `GOTEK_PROMPT_MICROS_PER_1K` | số nguyên không âm | Không | `0` | `src/server/ai-reply-worker.ts` | Rate nội bộ dạng micro-unit cho 1.000 prompt tokens. `0` là default local, không phải giá vendor hay thông báo billing. |
| `GOTEK_COMPLETION_MICROS_PER_1K` | số nguyên không âm | Không | `0` | `src/server/ai-reply-worker.ts` | Rate nội bộ dạng micro-unit cho 1.000 completion tokens; dùng cùng quy tắc với prompt rate. |

`GOTEK_PROMPT_MICROS_PER_1K` và `GOTEK_COMPLETION_MICROS_PER_1K` được parse bằng `BigInt`. Chỉ dùng chữ số không âm, không dùng dấu phẩy, dấu chấm hoặc đơn vị tiền tệ. Token usage provider không có sẽ được ước lượng theo text; điều đó không phải receipt thanh toán thật.

### Biến chỉ dùng trong test

`tests/grounded-widget-flow.test.ts` tạm đặt `GOTEK_GROUNDED_TEST_KEY` làm secret giả cho provider fixture rồi dọn lại sau test. Đây không phải biến runtime, không đưa vào `.env.example`, không dùng API key thật và không dùng để đánh giá live-provider acceptance.

## Provider AI và secret reference

Provider được tạo bởi Platform Admin qua registry. Request ghi vào registry chứa `secretRef` (regex tên biến viết hoa), ví dụ `GOTEK_OPENAI_API_KEY`; database chỉ giữ chuỗi tên này. Khi bật provider hoặc chạy test/worker, server kiểm tra `process.env[secret_ref]`.

Các adapter hiện có trong source:

| Adapter | Secret/reference | Endpoint behavior | Trạng thái cần hiểu |
|---|---|---|---|
| `openai` / `chatgpt` | Tùy `secret_ref` | OpenAI-compatible `/v1/chat/completions` nếu không đặt `baseUrl` | Có transport và test injected; API receipt thật là `UNKNOWN / NEEDS VERIFICATION`. |
| `gemini` | Tùy `secret_ref` | Google Generative Language `generateContent` nếu không đặt `baseUrl` | Có transport; cần credential/model thật để nghiệm thu. |
| `anthropic` | Tùy `secret_ref` | Anthropic Messages API nếu không đặt `baseUrl` | Có transport; cần credential/model thật để nghiệm thu. |
| `claude_code` | Tùy `secret_ref` | Hiện dùng cùng giao thức Anthropic Messages API | Không được hiểu là source đã chạy Claude Code CLI; đây là quyết định/giới hạn hiện tại. |
| `custom_llm` | Tùy `secret_ref` | Bắt buộc `baseUrl` HTTPS hợp lệ | SSRF/HTTPS policy vẫn áp dụng; contract của server riêng cần test riêng. |
| `local` | Không dereference secret ở transport | Không có inference engine | Dùng để biểu diễn chưa cấu hình, không tạo ra câu trả lời AI. API tạo provider vẫn yêu cầu `secretRef` có format hợp lệ; đó chỉ là contract tên, không phải key thật. |

Ví dụ tên biến provider (chỉ là placeholder, không phải tên bắt buộc):

```sh
export GOTEK_OPENAI_API_KEY='replace-locally'
export GOTEK_GEMINI_API_KEY='replace-locally'
export GOTEK_ANTHROPIC_API_KEY='replace-locally'
export GOTEK_CUSTOM_LLM_API_KEY='replace-locally'
```

Chỉ export biến đúng với `secret_ref` đã lưu trong provider. Không đưa key vào `POST /api/platform/providers`, UI, widget, job payload, log, audit export hoặc Git. Không dùng giá trị ví dụ trên để gọi provider.

## Cách tạo profile local an toàn

### Profile PostgreSQL local mặc định

Profile này không cần `DATABASE_URL`; app dùng runtime file do setup script tạo.

```sh
cp .env.example .env
set -a
source .env
set +a

# Nếu chưa có cluster riêng:
mkdir -p .local
initdb -D .local/postgres -U gotek_migrator --auth-local=trust --auth-host=scram-sha-256
pg_ctl -D .local/postgres -l .local/postgres.log -o "-p 55432 -k /tmp -h 127.0.0.1" start

npm ci
npm run db:setup
npm run dev
```

Không chạy `initdb` lần nữa trên cluster đã có dữ liệu. `npm run db:setup` tạo role/app database và ghi `.local/runtime.json`; không commit file này. Nếu cluster đã tồn tại, dùng `pg_ctl ... status` trước khi start.

### Profile dùng một PostgreSQL URL có sẵn

Chỉ dùng khi team đã cấp một DB local/test phù hợp và đã kiểm tra tenant/test isolation. Không ghi URL thật vào tài liệu hoặc commit.

```sh
export DATABASE_URL='postgresql://user:password@host:5432/gotek_chatbot'
export APP_ORIGIN='http://127.0.0.1:4317'
export COOKIE_SECURE='false'
npm run dev
```

Trong profile này, `DATABASE_URL` được app dùng thay runtime file. Script `npm run db:setup` hiện bootstrap theo cấu hình cluster local trong source, nên quy trình migration cho DB khác là **UNKNOWN / NEEDS VERIFICATION**; không tự suy ra đây là deployment path.

### Preview frontend build

```sh
npm run build
SERVE_BUILD=true npm run dev
```

Server vẫn bind `127.0.0.1:4317`. `SERVE_BUILD=true` chỉ đổi cách phục vụ frontend; nó không bật production mode và không tạo deployment.

## Chạy worker với đúng environment

Worker là process riêng. Nếu mở terminal mới, phải export lại các biến và provider secret cần thiết trong terminal đó.

### AI reply worker cho một workspace

```sh
set -a; source .env; set +a
export GOTEK_WORKER_WORKSPACE='00000000-0000-4000-8000-000000000000'
npm run worker:ai -- --once
```

Thay UUID bằng workspace local/test thật. Bỏ `--once` để chạy vòng lặp. Worker kiểm tra workspace, grant, publication, quota, ownership fence và provider secret trước khi ghi reply.

### AI worker discovery mode

```sh
set -a; source .env; set +a
unset GOTEK_WORKER_WORKSPACE
npm run worker:ai -- --all --once
```

`--all` chỉ dành scheduler/operator tin cậy; không truyền đồng thời `GOTEK_WORKER_WORKSPACE`. Đây không phải đường gọi từ widget.

### Embedding worker

```sh
set -a; source .env; set +a
GOTEK_WORKER_WORKSPACE='00000000-0000-4000-8000-000000000000' \
GOTEK_KNOWLEDGE_VERSION='00000000-0000-4000-8000-000000000001' \
GOTEK_EMBEDDING_MODEL='00000000-0000-4000-8000-000000000002' \
npm run worker:embedding
```

Embedding chỉ chạy khi version/model thuộc tenant, nguồn còn current, capability `embedding` được grant và secret tương ứng có trong process. `GOTEK_EMBEDDING_BATCH_SIZE` có thể đặt trước lệnh để đổi batch.

### Web refresh worker

```sh
set -a; source .env; set +a
GOTEK_WORKER_WORKSPACE='00000000-0000-4000-8000-000000000000' \
npm run worker:web -- --once
```

Worker web chỉ dùng nguồn đã được phép và policy SSRF/redirect/size. Đây là static fetch/sitemap worker, không phải browser JavaScript crawler.

## Quy trình cấu hình provider để test local

1. Đăng nhập Platform Admin; tạo provider với `adapter`, `secretRef` và `baseUrl` (chỉ cần `baseUrl` cho custom endpoint hoặc khi muốn override endpoint mặc định).
2. Export secret có **tên chính xác** bằng `secretRef` trong shell đang chạy server/worker. Không restart server thì process cũ không nhận biến mới.
3. Tạo model có capability `chat` hoặc `embedding`; bật provider/model sau khi secret có mặt.
4. Grant model cho đúng workspace và capability; grant hết hạn hoặc workspace/provider/model bị disable sẽ chặn worker.
5. Gọi connectivity test từ Platform Admin và ghi kết quả receipt vào evidence. `local` trả `not_configured`; injected transport test không chứng minh vendor receipt.
6. Chạy widget flow với knowledge version đã `PUBLIC` nếu kiểm chứng grounded answer. Không coi một chuỗi text trả về là bằng chứng citation/quality hoàn chỉnh.

## Lỗi thường gặp

| Triệu chứng/mã | Nguyên nhân có thể | Cách kiểm tra an toàn |
|---|---|---|
| `ENOENT .local/runtime.json` | Chưa chạy setup DB và không có `DATABASE_URL` | Khởi động cluster riêng rồi `npm run db:setup`; không tạo file runtime bằng tay với credential đoán. |
| `ECONNREFUSED` trên `55432` | PostgreSQL local chưa chạy hoặc dùng sai cluster | `pg_ctl -D .local/postgres status`; kiểm tra log, không xóa cluster để thử lại. |
| `CSRF_REJECTED` hoặc signup hiển thị “Không thể kết nối” | Origin không khớp `APP_ORIGIN`, thiếu `X-Gotek-Request: 1`, server/DB không chạy | Mở `/api/health`, kiểm tra origin trình duyệt và process log; thông báo UI không tự xác định root cause. |
| `PROVIDER_SECRET_MISSING` | `secret_ref` không trùng tên env, hoặc shell chạy worker chưa export secret | Đọc tên reference qua registry có quyền; kiểm tra chỉ `printenv VAR >/dev/null`, không in giá trị. |
| `PROVIDER_NOT_CONFIGURED` | Adapter `local` hoặc provider chưa có inference engine | Dùng provider adapter đã được cấp secret/model; không coi local adapter là mock receipt. |
| `PROVIDER_ENDPOINT_REQUIRED` | `custom_llm` thiếu `baseUrl` | Tạo lại/điều chỉnh provider bằng HTTPS endpoint hợp lệ và được phép. |
| `INVALID_WORKER_CONFIGURATION` | Thiếu/sai UUID hoặc batch ngoài `1..100` | Kiểm tra biến theo bảng trên; không lấy ID từ tenant khác. |
| `WORKSPACE_AND_ALL_ARE_MUTUALLY_EXCLUSIVE` | AI worker nhận cả `--all` và `GOTEK_WORKER_WORKSPACE` | Chọn một chế độ, rồi khởi động lại process. |
| `PRODUCTION_NOT_APPROVED` | Đang đặt `NODE_ENV=production` | Trở về local/test; staging/production cần quyết định và release gate riêng. |

## Checklist bàn giao cho team dev

- [ ] Clone repo và đọc [00-START-HERE](00-START-HERE.md), [DEVELOPMENT](DEVELOPMENT.md), [PROJECT-STATUS](PROJECT-STATUS.md) và [HANDOFF](HANDOFF.md).
- [ ] Copy `.env.example` thành `.env` local; xác nhận `.env` và `.local/` vẫn bị ignore.
- [ ] Chọn một cách cấp DB: runtime file local hoặc `DATABASE_URL` test; không trộn credential không rõ nguồn.
- [ ] Chạy `npm run db:setup`, `npm run build` và `npm test` theo tài liệu testing.
- [ ] Nếu kiểm provider, ghi lại adapter/model/grant và evidence; không ghi API key.
- [ ] Mỗi worker được chạy với tenant UUID được cấp quyền và một process environment riêng.
- [ ] Redact secret khỏi terminal capture, issue, screenshot, evidence và commit.
- [ ] Cập nhật `docs/PROJECT-STATUS.md`, `docs/HANDOFF.md` và `delivery/CHECKPOINT.md` nếu thay đổi config hoặc evidence.

## Những điều chưa được chốt

- Tên provider account, secret manager, staging DB, TLS/domain, CI/CD và production hosting: **UNKNOWN / NEEDS VERIFICATION**.
- Cách migration ngoài cluster local của `scripts/setup-db.ts`: **UNKNOWN / NEEDS VERIFICATION**.
- Vendor pricing, token receipt, retention và billing policy: không được suy ra từ các biến `*_MICROS_PER_1K`.
- `claude_code` có chạy CLI riêng hay không: hiện source chỉ có Anthropic-compatible transport; cần quyết định riêng nếu product yêu cầu CLI.
