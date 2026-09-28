# QUY TẮC PHÁT TRIỂN PHẦN MỀM: CHUẨN SOLID VÀ CẤU TRÚC KIẾN TRÚC GOTEK CHATBOT

> **Phạm vi áp dụng:** Bắt buộc cho toàn bộ Agent và lập trình viên khi đọc, sửa đổi, tái cấu trúc hoặc tạo mới mã nguồn trong repository `GoTek-ChatBOT`.  
> **Nguyên tắc nền tảng:** SOLID Principles, Clean Architecture, Strict Multi-Tenancy (PostgreSQL RLS), Zero-Trust Client Context, Idempotency & Resilient AI Dispatch.

---

## 1. QUY TẮC ÁP DỤNG NGUYÊN LÝ SOLID

Mọi module mã nguồn trong dự án bắt buộc phải tuân thủ nghiêm ngặt 5 nguyên tắc SOLID:

### 1.1. Single Responsibility Principle (SRP - Đơn trách nhiệm)
* **Tuyệt đối không tạo "God File" hoặc "God Function":**
  - Không viết dồn logic định tuyến (Routing), kiểm tra dữ liệu (Validation), nghiệp vụ (Business Service), và truy vấn cơ sở dữ liệu (Database Query) vào cùng một tệp như `app.ts` trước đây.
  - Mỗi tệp tin (File) chỉ đảm nhận **một trách nhiệm duy nhất**:
    + `*.routes.ts`: Chỉ khai báo endpoint, HTTP method và gắn middleware.
    + `*.controller.ts`: Chỉ bóc tách HTTP request, gọi DTO parser (Zod), chuyển việc cho Service, và format HTTP response.
    + `*.service.ts`: Chứa 100% logic nghiệp vụ. Không truy cập trực tiếp `req`, `res`.
    + `*.repo.ts` (Repository/DAL): Chứa 100% câu truy vấn SQL (`pg.query`).
* **Kích thước tệp tin tối đa:** Một tệp tin nghiệp vụ không nên vượt quá **300 dòng code**. Nếu vượt quá, bắt buộc phải phân tách thành các sub-module chuyên biệt.

### 1.2. Open/Closed Principle (OCP - Mở để mở rộng, đóng để sửa đổi)
* **Sử dụng Provider Registry & Strategy Pattern:**
  - Khi thêm nhà cung cấp AI mới (OpenAI, Anthropic, Gemini, DeepSeek, Local), không được sửa đổi logic cốt lõi của worker (`ai-reply-worker.ts`).
  - Phải tạo một class/adapter mới kế thừa interface `IProviderTransport` và đăng ký vào Provider Factory.
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

## 2. QUY CHUẨN CẤU TRÚC THƯ MỤC DỰ ÁN (PROJECT STRUCTURE STANDARDS)

Toàn bộ mã nguồn mới phải được tổ chức theo cấu trúc module hóa phân tầng sau:

```
src/
├── server/
│   ├── routes/              # Express Router definitions
│   │   ├── auth.routes.ts
│   │   ├── workspace.routes.ts
│   │   ├── member.routes.ts
│   │   ├── channel.routes.ts
│   │   ├── knowledge.routes.ts
│   │   ├── widget.routes.ts
│   │   ├── platform.routes.ts
│   │   └── audit.routes.ts
│   ├── controllers/         # HTTP request/response handlers
│   │   ├── auth.controller.ts
│   │   ├── workspace.controller.ts
│   │   └── ...
│   ├── services/            # Pure Business Logic
│   │   ├── auth.service.ts
│   │   ├── quota.service.ts
│   │   ├── knowledge.service.ts
│   │   └── ...
│   ├── repositories/        # Database Access Layer (Raw Parameterized SQL)
│   │   ├── user.repo.ts
│   │   ├── workspace.repo.ts
│   │   ├── chat.repo.ts
│   │   └── ...
│   ├── domain/              # Domain models, interfaces, errors
│   │   ├── interfaces/      # Contract interfaces (Ports)
│   │   └── errors/          # Custom Domain Errors
│   ├── dtos/                # Zod schemas & Request/Response Types
│   ├── middlewares/         # Security, Auth, Tenant RLS, Rate-limit
│   ├── providers/           # AI Provider Adapters (OpenAI, Anthropic, Gemini)
│   ├── workers/             # Background Worker Runtimes
│   └── app.ts               # Clean composition root (Chỉ kết nối routes & middlewares)
│
├── web/                     # Frontend React 19
│   ├── assets/              # Icons, SVG, Logos
│   ├── styles/              # Design tokens (tokens.css, variables.css)
│   ├── components/          # Reusable Presentational Components (Dumb)
│   │   ├── ui/              # Button, Input, Modal, Table, Badge, Spinner
│   │   └── layout/          # Sidebar, Navbar, SplitPane
│   ├── features/            # Feature-based Smart Modules
│   │   ├── auth/            # Components, Hooks, API calls for Auth
│   │   ├── inbox/           # ChatWindow, ChatList, MessageView
│   │   ├── knowledge/       # FileUpload, ChunkList, VersionTable
│   │   └── channels/        # WidgetConfig, OriginWhitelist
│   ├── hooks/               # Custom React Hooks
│   ├── services/            # API Client (HTTP Fetch wrapper with CSRF)
│   └── types/               # Frontend TypeScript interfaces
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

## 4. QUY TRÌNH XỬ LÝ CRUD & MÃ LỖI (CRUD & ERROR HANDLING FLOW)

Mọi API xử lý CRUD bắt buộc tuân theo luồng tuần tự:

1. **Bước 1 - Header & Origin Check:**
   - Yêu cầu header `X-Gotek-Request: 1` cho các request sửa đổi (`POST`, `PUT`, `PATCH`, `DELETE`).
   - Kiểm tra `Origin` hợp lệ.
2. **Bước 2 - Session & Membership Verification:**
   - Lấy cookie `gotek_session`, kiểm tra hash SHA-256 trong DB.
   - Xác định `workspace_id` và vai trò của user (`Owner`, `Admin`, `Agent`).
3. **Bước 3 - Bắt đầu Transaction & Thiết lập RLS:**
   - Thực thi `SET LOCAL app.workspace_id = <current_workspace_id>`.
4. **Bước 4 - DTO Validation (Zod):**
   - Dùng schema Zod `.strict()` để chặn các trường dư thừa độc hại.
   - Nếu validation fail, ném ngay `HttpError(400, 'VALIDATION_FAILED', fieldErrors)`.
5. **Bước 5 - Business Logic (Service Layer):**
   - Kiểm tra logic nghiệp vụ: Quota còn không? Đạt giới hạn ghế (`SEAT_LIMIT`) chưa? Có phải Owner cuối cùng (`LAST_OWNER`) không?
6. **Bước 6 - Thao tác Dữ liệu (Repository Layer):**
   - Thực thi SQL có tham số an toàn.
7. **Bước 7 - Async Jobs & Audit Trail:**
   - Nếu có tác vụ ngầm (sinh embedding, gửi tin AI), ghi vào bảng `jobs` (Durable Queue).
   - Ghi log vào `audit_events` cho các thay đổi cấu hình hoặc phân quyền.
8. **Bước 8 - Chuẩn hóa Response Envelope:**
   - Thành công: `{ "success": true, "data": <result> }`.
   - Thất bại: `{ "success": false, "error": { "code": "STRING_ERROR_CODE", "message": "...", "details": ... } }`.

---

## 5. QUY TẮC PHÁT TRIỂN GIAO DIỆN (UI COMPONENT RULES)

1. **Phân tách Smart vs Dumb Components:**
   - Các component hiển thị (`components/ui/*`) phải là **Pure Component**: Chỉ nhận dữ liệu qua `props`, phát sinh sự kiện qua callback (`onClick`, `onChange`), không tự ý gọi `fetch()` hay API client.
   - Các Container (`features/*`) đóng vai trò quản lý state, điều phối custom hook và xử lý API.
2. **Design Tokens & Styling:**
   - Không hardcode mã màu hex (`#ffffff`, `#10b981`) trực tiếp trong component.
   - Bắt buộc dùng biến CSS tokens (`var(--color-primary-500)`, `var(--radius-md)`).
   - Tối ưu hóa trải nghiệm mượt mà, micro-animations tinh tế, không làm giao diện thô sơ, thiếu sức sống.
3. **Quản lý Trạng thái & Lỗi:**
   - Mọi trang tải dữ liệu bất đồng bộ bắt buộc xử lý đủ 4 trạng thái:
     `Idle` -> `Loading` (Skeleton/Spinner) -> `Success` (Data View) -> `Error` (Alert / Retry Button).
   - Bao bọc các khối giao diện quan trọng bằng `ErrorBoundary`.

---

## 6. NHỮNG ĐIỀU TUYỆT ĐỐI CẤM (STRICT ANTI-PATTERNS)

❌ **CẤM** bypass RLS hoặc cấp quyền `BYPASSRLS` cho runtime user `gotek_app`.  
❌ **CẤM** đưa API Key / Secret của Provider vào mã nguồn client hoặc widget SDK.  
❌ **CẤM** cộng chuỗi SQL thô (Raw String Concatenation) dưới mọi hình thức.  
❌ **CẤM** retry mù quáng (blind retry) khi gọi dịch vụ AI bên ngoài gặp timeout / network error (bắt buộc gắn cờ `UNKNOWN`).  
❌ **CẤM** trả tin nhắn nháp (draft) hoặc tri thức nội bộ (`INTERNAL`) cho khách truy cập website qua widget.  
❌ **CẤM** nhét toàn bộ logic nghiệp vụ vào tệp controller hoặc route handler.
