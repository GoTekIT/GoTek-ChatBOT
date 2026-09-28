# QUY TẮC PHÁT TRIỂN PHẦN MỀM: CHUẨN SOLID VÀ CẤU TRÚC KIẾN TRÚC GOTEK CHATBOT (MONOREPO)

> **Phạm vi áp dụng:** Bắt buộc cho toàn bộ Agent và lập trình viên khi đọc, sửa đổi, tái cấu trúc hoặc tạo mới mã nguồn trong repository `GoTek-ChatBOT`.  
> **Nguyên tắc nền tảng:** SOLID Principles, Clean Architecture, Strict Multi-Tenancy (PostgreSQL RLS), Zero-Trust Client Context, Idempotency & Resilient AI Dispatch.

---

## 1. QUY TẮC ÁP DỤNG NGUYÊN LÝ SOLID

Mọi module mã nguồn trong dự án bắt buộc phải tuân thủ nghiêm ngặt 5 nguyên tắc SOLID:

### 1.1. Single Responsibility Principle (SRP - Đơn trách nhiệm)
* **Tuyệt đối không tạo "God File" hoặc "God Function":**
  - Không viết dồn logic định tuyến (Routing), kiểm tra dữ liệu (Validation), nghiệp vụ (Business Service), và truy vấn cơ sở dữ liệu (Database Query) vào cùng một tệp.
  - Mỗi tệp tin (File) chỉ đảm nhận **một trách nhiệm duy nhất**:
    + `*.routes.ts`: Chỉ khai báo endpoint, HTTP method và gắn middleware.
    + `*.controller.ts`: Chỉ bóc tách HTTP request, gọi DTO parser (Zod), chuyển việc cho Service, và format HTTP response.
    + `*.service.ts`: Chứa 100% logic nghiệp vụ. Không truy cập trực tiếp `req`, `res`.
    + `*.repository.ts`: Chứa 100% câu truy vấn SQL (`pg.query`).
* **Kích thước tệp tin tối đa:** Một tệp tin nghiệp vụ không nên vượt quá **300 dòng code**. Nếu vượt quá, bắt buộc phải phân tách thành các sub-module chuyên biệt.

### 1.2. Open/Closed Principle (OCP - Mở để mở rộng, đóng để sửa đổi)
* **Sử dụng Provider Registry & Strategy Pattern:**
  - Khi thêm nhà cung cấp AI mới (OpenAI, Anthropic, Gemini, DeepSeek, Local), không được sửa đổi logic cốt lõi của worker (`modules/ai/ai-reply-worker.ts`).
  - Phải tạo một adapter mới kế thừa interface `IProviderTransport` và đăng ký vào Provider Factory.
* **Document Extraction Pipeline:**
  - Bổ sung định dạng tài liệu mới (như Excel, HTML, Markdown) bằng cách tạo adapter thực thi interface `IDocumentExtractor`.

### 1.3. Liskov Substitution Principle (LSP - Thay thế Liskov)
* Các triển khai cụ thể của một Interface phải có thể hoán đổi cho nhau mà không làm phá vỡ logic chương trình.
* Ví dụ: Bất kỳ `IProviderTransport` nào khi thực thi `generateChatCompletion()` đều phải trả về định dạng chuẩn hóa `ProviderChatResponse` (gồm `text`, `promptTokens`, `completionTokens`, `stopReason`), không được throw các ngoại lệ không kiểm soát ngoài `ProviderTransportError`.

### 1.4. Interface Segregation Principle (ISP - Phân tách Interface)
* Không thiết kế interface chung ôm đồm quá nhiều hàm không liên quan.
* Chia nhỏ interface theo mục đích sử dụng (Role-based interfaces):
  - Tách riêng `IChatVisitorReader` (chỉ đọc tin nhắn công khai) khỏi `IChatStaffManager` (có quyền đọc/ghi ghi chú nội bộ và takeover).
  - Tách riêng `IQuotaReader` khỏi `IQuotaSettlementManager`.

### 1.5. Dependency Inversion Principle (DIP - Đảo ngược phụ thuộc)
* Các tầng cao (Application/Service) phụ thuộc vào **Interface (Abstractions)**, tuyệt đối không phụ thuộc trực tiếp vào triển khai cụ thể (Concretions) của tầng Infrastructure.
* Khởi tạo đối tượng qua Dependency Injection hoặc Factory Pattern. Các Service nhận Repository và Adapter thông qua constructor parameters.

---

## 2. QUY CHUẨN CẤU TRÚC THƯ MỤC DỰ ÁN (MONOREPO ARCHITECTURE)

Dự án được cấu trúc theo mô hình **Monorepo đa tầng (Modular Monolith)** đồng nhất với dự án tham khảo doanh nghiệp:

```text
d:\GoTek-ChatBOT/
├── .agents/                    # Quy tắc kiến trúc SOLID, Clean Architecture & AI Skills
├── .claude/                    # Cấu hình dự án cho Claude
├── .github/workflows/          # CI/CD Pipeline GitHub Actions
├── .vscode/                    # Workspace settings & debug launch configurations
│
├── backend/                    # 🚀 Dịch vụ Backend API Độc Lập (Node.js Express + TS Strict)
│   ├── src/
│   │   ├── core/               # Nhân lõi: db.ts (RLS pool), security.ts, onboarding.ts, session-maintenance.ts
│   │   ├── modules/            # Bounded Contexts & Domain Logic:
│   │   │   ├── ai/             # AI reply worker, prompt generation, citations, quota, token metering
│   │   │   ├── knowledge/      # Quản lý tài liệu, categories, chunk store, embedding worker, retrieval
│   │   │   ├── web-sources/    # Web crawler, fetchers, parsers, snapshot generation, schedule
│   │   │   ├── chat/           # Channels, chat store, inbox, contacts CRM, business hours, data collection
│   │   │   ├── widget/         # Widget SDK embed (sdk.js) & widget public API
│   │   │   ├── rules/          # Quy tắc xử lý câu hỏi & chuyển giao vai trò
│   │   │   ├── jobs/           # Durable job queue, worker lifecycle, lease fencing
│   │   │   ├── extractors/     # PDF, DOCX, TXT content parsers
│   │   │   ├── audit/          # Keyset audit logging & NDJSON export
│   │   │   ├── support/        # Cấp quyền hỗ trợ kỹ thuật viên tạm thời
│   │   │   └── platform/       # Quản trị viên hệ thống (Platform Admin)
│   │   ├── controllers/        # Tiếp nhận HTTP request & format response
│   │   ├── services/           # 100% Business Logic nghiệp vụ
│   │   ├── repositories/       # Truy vấn dữ liệu thuần với Parameterized SQL & RLS
│   │   ├── dtos/               # Data Transfer Objects & Schema validation (Zod)
│   │   ├── routes/             # Định tuyến API phân theo domain
│   │   ├── middlewares/        # Bảo mật, phân quyền, rate limit, centralized error handling
│   │   ├── app.ts              # Composition Root Express pipeline
│   │   └── index.ts            # Entrypoint API server
│   ├── db/migrations/          # SQL migrations có đánh số thứ tự
│   ├── public/                 # Static assets (sdk.js, logo)
│   ├── scripts/                # Database migrations & worker scripts
│   ├── tests/                  # Backend unit & integration test suites
│   ├── Dockerfile              # Dockerfile Node.js Alpine
│   └── package.json            # Dependencies backend riêng biệt
│
├── frontend/                   # 🎨 Ứng dụng Web Client (React 19 + Vite + TypeScript)
│   ├── src/
│   │   ├── api/                # API client & fetch wrappers (api.ts)
│   │   ├── components/common/  # Reusable pure UI controls (Button, Field, Link, Notice, ErrorBoundary)
│   │   ├── hooks/              # Custom hooks (usePath.ts, ...)
│   │   ├── screens/            # Màn hình giao diện phân theo vai trò người dùng:
│   │   │   ├── auth/           # Khách/User: Đăng nhập, đăng ký, quên mk, invite
│   │   │   ├── inbox/          # Agent: Live chat, takeover, conversation detail, drafts
│   │   │   ├── channels/       # Kênh website, widget builder, xem trước widget
│   │   │   ├── knowledge/      # Kho thông tin, xem trước trích xuất, nguồn web, vòng đời
│   │   │   ├── ai-rules/       # Quy tắc phản hồi AI, chuyển giao, xuất nhập CSV
│   │   │   ├── settings/       # Cài đặt doanh nghiệp, thành viên, audit, support, usage, jobs
│   │   │   └── platform/       # Quản trị viên nền tảng: Cấp model AI, cấu hình provider
│   │   ├── styles/             # Design tokens & CSS hệ thống (tokens.css, style.css)
│   │   ├── App.tsx             # Điều hướng router & bố cục chung
│   │   ├── main.tsx            # Entrypoint ReactDOM
│   │   └── env.d.ts            # Vite client type definitions
│   ├── public/                 # Static assets (favicon, logos)
│   ├── tests/                  # Frontend unit tests
│   ├── Dockerfile              # Dockerfile Nginx production
│   └── package.json            # Dependencies frontend riêng biệt
│
├── docs/                       # Tài liệu kỹ thuật, system design, flow, handoff
├── gitops/base/                # Kubernetes Deployment manifests (Backend, Frontend)
├── infra/                      # Cấu hình hạ tầng: Nginx reverse proxy, Terraform scripts
├── mobile/                     # Khung ứng dụng di động cho tương lai
├── scripts/                    # Shell scripts điều phối (dev.sh, build.sh, deploy-prod.sh)
├── docker-compose.yml          # Local fullstack development stack
├── docker-compose.prod.yml     # Production VPS deployment stack
├── docker-compose.ci.yml       # CI automated test stack
├── deploy_all.sh               # One-click deployment script
├── package.json                # Root orchestration package
└── README.md                   # Tổng quan dự án & hướng dẫn khởi chạy
```

---

## 3. QUY TẮC CƠ SỞ DỮ LIỆU & BẢO MẬT MULTI-TENANT

1. **Bắt buộc Row-Level Security (RLS) cho bảng nghiệp vụ:**
   - Mọi bảng thuộc sở hữu của doanh nghiệp bắt buộc có `workspace_id UUID NOT NULL REFERENCES workspaces(id)`.
   - Bắt buộc kích hoạt: `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY; ALTER TABLE <table> FORCE ROW LEVEL SECURITY;`.
   - Chính sách RLS phải đối soát với biến phiên cục bộ:
     `workspace_id = current_setting('app.workspace_id', true)::uuid`.
2. **Khóa ngoại tổng hợp (Composite Foreign Keys):**
   - Khi bảng B là con của bảng A trong cùng workspace, khóa ngoại bắt buộc phải là cặp:
     `FOREIGN KEY (workspace_id, a_id) REFERENCES table_a(workspace_id, id) ON DELETE CASCADE`.
   - Cấm dùng khóa ngoại đơn lẻ `a_id` vì có thể tạo kẽ hở trỏ nhầm dữ liệu giữa hai workspace khác nhau.
3. **Quy chuẩn Transaction & Thiết lập phạm vi Tenant:**
   - Trong code backend, mọi truy vấn nghiệp vụ phải chạy trong transaction có gọi `SET LOCAL app.workspace_id = $1`.
   - Không được tin tưởng `workspace_id` do client gửi lên; phải suy ra từ Session đăng nhập hoặc Widget Channel Key đã được xác thực.
4. **Parameterized SQL 100%:**
   - Tuyệt đối cấm ghép chuỗi SQL (`query = "SELECT * FROM ... " + id`).
   - Mọi tham số bắt buộc dùng placeholder `$1, $2, $3...` của PostgreSQL.
5. **Đồng bộ Migration:**
   - Mỗi file migration mới phải có tiền tố số thứ tự duy nhất tăng dần (ví dụ `057_add_pgvector_extension.sql`).
   - Tuyệt đối không đặt trùng số thứ tự với migration cũ.
   - Không được sửa nội dung các file migration đã commit vào nhánh chính.

---

## 4. QUY TRÌNH XỬ LÝ CRUD CHUẨN CHO BACKEND

Mọi API xử lý CRUD bắt buộc tuân theo luồng tuần tự qua các tầng kiến trúc:

```
HTTP Request ──► [Routes] ──► [Middlewares: Auth, Security, RateLimit]
                                     │
                                     ▼
                            [Controllers: DTO Zod Validate]
                                     │
                                     ▼
                            [Services: Business Rules & Quota]
                                     │
                                     ▼
                            [Repositories: Parameterized SQL & RLS Scope]
                                     │
                                     ▼
                                [Database PG]
```

1. **Bước 1 - Header & Security Filter:**
   - Header `X-Gotek-Request: 1` cho các thao tác ghi dữ liệu (`POST`, `PUT`, `PATCH`, `DELETE`).
   - Rate limit theo IP hoặc workspace.
2. **Bước 2 - Session & Membership Verification:**
   - Xác thực session cookie `gotek_session`, kiểm tra hash SHA-256.
   - Xác định `workspace_id` và vai trò của user (`Owner`, `Admin`, `Agent`).
3. **Bước 3 - Bắt đầu Transaction & Thiết lập RLS:**
   - Chạy hàm `transaction(pool, async (db) => { ... })` và `await scope(db, workspaceId);`.
4. **Bước 4 - DTO Validation (Zod):**
   - Dùng schema Zod `.strict()` trong controller để chặn các trường độc hại.
   - Nếu validation fail, ném ngay `HttpError(400, 'VALIDATION_FAILED', fieldErrors)`.
5. **Bước 5 - Business Logic (Service Layer):**
   - Kiểm tra quota, giới hạn ghế (`SEAT_LIMIT`), chủ sở hữu cuối (`LAST_OWNER`).
6. **Bước 6 - Thao tác Dữ liệu (Repository Layer):**
   - Thực thi SQL có tham số an toàn.
7. **Bước 7 - Async Jobs & Audit Trail:**
   - Ghi vào bảng `jobs` (Durable Queue) nếu cần chạy ngầm (AI dispatch, embedding).
   - Ghi nhật ký vào `audit_events`.
8. **Bước 8 - Chuẩn hóa Response Envelope:**
   - Thành công: `{ "success": true, "data": <result> }`.
   - Thất bại: `{ "success": false, "error": { "code": "STRING_ERROR_CODE", "message": "...", "details": ... } }`.

---

## 5. QUY TẮC PHÁT TRIỂN GIAO DIỆN (FRONTEND SCREEN RULES)

1. **Tổ chức theo vai trò người dùng (`screens/`):**
   - Không đặt file component ngổn ngang ở thư mục gốc `frontend/src/`.
   - Gom file màn hình vào thư mục tương ứng trong `screens/` (`auth/`, `inbox/`, `channels/`, `knowledge/`, `ai-rules/`, `settings/`, `platform/`).
2. **Sử dụng Path Aliases:**
   - Bắt buộc dùng aliases: `@/*`, `@api`, `@components/*`, `@screens/*`.
   - Không viết đường dẫn tương đối phức tạp như `../../../../api`.
3. **Phân tách Presentational vs Container:**
   - Các component tái sử dụng (`components/common/*`) là Pure Component: nhận props, phát sinh callback, không gọi fetch trực tiếp.
   - Các màn hình `screens/*` quản lý state, gọi `api(...)`, hiển thị loading/error.
4. **Design Tokens & Styling:**
   - Bắt buộc dùng CSS tokens (`var(--color-primary)`, `var(--color-bg)`).
   - Không hardcode màu hex tùy tiện trong inline style.
5. **Xử lý Trạng thái & Trải nghiệm Người dùng:**
   - Xử lý đủ 4 trạng thái: `Idle` -> `Loading` (Skeleton/Spinner) -> `Success` (Data View) -> `Error` (Alert / Retry Button).
   - Bọc các thành phần bằng `ErrorBoundary`.

---

## 6. NHỮNG ĐIỀU TUYỆT ĐỐI CẤM (STRICT ANTI-PATTERNS)

❌ **CẤM** bypass RLS hoặc cấp quyền `BYPASSRLS` cho runtime user `gotek_app`.  
❌ **CẤM** đưa API Key / Secret của Provider vào mã nguồn client hoặc widget SDK.  
❌ **CẤM** cộng chuỗi SQL thô (Raw String Concatenation) dưới mọi hình thức.  
❌ **CẤM** retry mù quáng (blind retry) khi gọi dịch vụ AI bên ngoài gặp timeout / network error (bắt buộc gắn cờ `UNKNOWN`).  
❌ **CẤM** trả tin nhắn nháp (draft) hoặc tri thức nội bộ (`INTERNAL`) cho khách truy cập website qua widget.  
❌ **CẤM** nhét toàn bộ logic nghiệp vụ vào tệp controller hoặc route handler.  
❌ **CẤM** tạo file lung tung ở root của `frontend/src` hoặc `backend/src`.
