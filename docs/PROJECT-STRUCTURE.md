# CẨM NANG CẤU TRÚC DỰ ÁN & HƯỚNG DẪN CODE (PROJECT STRUCTURE & VIBE CODING GUIDE)

> **Dành cho:** Tất cả lập trình viên (Developers), AI Pair Programmers và Tech Leads tham gia phát triển, review mã nguồn hoặc "vibe code" trong hệ thống **GoTek Chatbot**.

---

## 1. TỔNG QUAN KIẾN TRÚC MONOREPO

Dự án được tổ chức theo mô hình **Monorepo đa tầng (Modular Monolith)** với sự phân định ranh giới rành mạch giữa Backend API, Frontend Web, Hạ tầng Triển khai (Infra), Kubernetes (GitOps) và Khung Mobile trong tương lai:

```text
d:\GoTek-ChatBOT/
├── .agents/            # Quy tắc kiến trúc SOLID, Clean Architecture & AI Skills
├── .claude/            # Cấu hình dự án cho Claude
├── .github/            # GitHub Actions CI/CD workflows
├── .vscode/            # Cấu hình workspace & debug VS Code
├── backend/            # 🚀 Dịch vụ Backend API Express + PostgreSQL RLS + Workers
├── frontend/           # 🎨 Ứng dụng Frontend React 19 + Vite SPA
├── docs/               # 📚 Toàn bộ tài liệu kỹ thuật, system design, handoff
├── gitops/             # ☸️ Kubernetes manifests (Deployment, Services)
├── infra/              # 🏗️ Cấu hình hạ tầng (Nginx reverse proxy, Terraform AWS)
├── mobile/             # 📱 Khung ứng dụng di động cho Agent & Admin
├── scripts/            # ⚡ Shell scripts điều phối (dev.sh, build.sh, deploy-prod.sh)
├── .dockerignore       # Danh sách loại trừ khi build Docker
├── .gitignore          # Danh sách loại trừ khi commit Git
├── deploy_all.sh       # Script triển khai toàn bộ container lên server
├── docker-compose.yml  # Docker Compose môi trường Local Dev
├── docker-compose.prod.yml # Docker Compose môi trường VPS / Production
├── docker-compose.ci.yml   # Docker Compose môi trường CI
├── package.json        # Workspace orchestration scripts
└── README.md           # Hướng dẫn tổng quan & khởi động dự án
```

---

## 2. CHI TIẾT THƯ MỤC BACKEND (`backend/`)

Thư mục `backend/` chứa toàn bộ logic máy chủ, cơ sở dữ liệu và các background workers.

```text
backend/
├── db/
│   └── migrations/     # Các file SQL migration được đánh số thứ tự tăng dần (001_..., 056_...)
├── public/             # File tĩnh phục vụ trực tiếp: sdk.js (Widget SDK), gotek-logo.png
├── scripts/            # Script quản trị DB & tác vụ nền: setup-db.ts, restore-drill.ts, ai-worker.ts
├── tests/              # 90+ file kiểm thử tự động (Unit & Integration tests)
├── Dockerfile          # Dockerfile multi-stage đóng gói backend
├── package.json        # Dependencies độc lập của backend (Express, pg, argon2, zod, multer...)
├── tsconfig.json       # Cấu hình TypeScript Node.js với Path Aliases
└── src/
    ├── app.ts          # Composition Root: Khởi tạo Express pipeline, middleware, routes
    ├── index.ts        # Entrypoint chạy API server trên cổng PORT (mặc định 4317)
    ├── core/           # 🛡️ Nhân lõi hệ thống:
    │   ├── db.ts                   # Quản lý connection pool PostgreSQL, Transaction & RLS Scope
    │   ├── security.ts             # Mã hóa mật khẩu Argon2, kiểm tra quyền, mã lỗi bảo mật HttpError
    │   ├── onboarding.ts           # Khởi tạo dữ liệu mẫu cho workspace mới
    │   └── session-maintenance.ts  # Tác vụ dọn dẹp các session đăng nhập hết hạn
    ├── modules/        # 📦 Bounded Contexts (Logic nghiệp vụ theo từng miền):
    │   ├── ai/             # Sinh câu trả lời AI, active citations, quota ledger, token metering, prompt
    │   ├── knowledge/      # Quản lý tài liệu tri thức, phân mục, lưu chunk vector, embedding worker
    │   ├── web-sources/    # Quản lý nguồn website, crawler, bộ phân tích HTML, snapshot generations
    │   ├── chat/           # Kênh kết nối (Channels), lưu trữ hội thoại, hộp thư CSKH, danh bạ CRM
    │   ├── widget/         # Script nhúng widget SDK (sdk.js) và các API công khai cho widget
    │   ├── rules/          # Quy tắc xử lý câu hỏi tự động, chuyển giao vai trò, xuất nhập CSV
    │   ├── jobs/           # Hàng đợi tác vụ bền vững (Durable Job Queue), cơ chế lease fencing
    │   ├── extractors/     # Trích xuất văn bản từ tài liệu PDF, DOCX, TXT
    │   ├── audit/          # Ghi log kiểm toán (audit trail) và xuất dữ liệu NDJSON an toàn
    │   ├── support/        # Cấp quyền truy cập hỗ trợ kỹ thuật viên tạm thời có hạn dùng
    │   └── platform/       # Quản trị viên hệ thống (Platform Admin), cấp model AI cho doanh nghiệp
    ├── controllers/    # Tiếp nhận HTTP Request, gọi DTO validate, gọi Service và trả Response
    ├── services/       # 100% Business Logic nghiệp vụ thuần túy, không dính `req`/`res`
    ├── repositories/   # Tầng truy xuất dữ liệu (Data Access), thực thi SQL có tham số và RLS
    ├── dtos/           # Khai báo schema Zod và TypeScript types cho request body / query
    ├── routes/         # Định tuyến URL endpoint gắn với các controller và middleware
    └── middlewares/    # Bộ lọc bảo mật: xác thực danh tính, bảo vệ API, rate limit, bắt lỗi 404 & 500
```

### Path Aliases trong Backend:
- `@core/*` ➔ `src/core/*`
- `@modules/*` ➔ `src/modules/*`
- `@controllers/*` ➔ `src/controllers/*`
- `@services/*` ➔ `src/services/*`
- `@repositories/*` ➔ `src/repositories/*`
- `@dtos/*` ➔ `src/dtos/*`
- `@routes/*` ➔ `src/routes/*`
- `@middlewares/*` ➔ `src/middlewares/*`

---

## 3. CHI TIẾT THƯ MỤC FRONTEND (`frontend/`)

Thư mục `frontend/` chứa giao diện người dùng đơn trang (SPA) viết bằng React 19 và Vite 6.

```text
frontend/
├── public/             # Static assets công khai (favicon, gotek-logo.png)
├── tests/              # Frontend unit tests (inbox drafts, rules CSV parsing)
├── index.html          # File HTML gốc (Single Page Application)
├── vite.config.ts      # Cấu hình Vite dev server (port 3001) & reverse proxy sang backend port 4317
├── Dockerfile          # Dockerfile Nginx production đóng gói frontend
├── package.json        # Dependencies React 19, Lucide icons, Vite
├── tsconfig.json       # Cấu hình TypeScript React Vite với Path Aliases
└── src/
    ├── main.tsx        # Điểm bắt đầu React DOM, bọc ErrorBoundary
    ├── App.tsx         # Điều phối router theo đường dẫn URL, menu thanh bên và header
    ├── env.d.ts        # Định nghĩa kiểu môi trường Vite
    ├── api/            # 🌐 Tầng giao tiếp mạng:
    │   └── api.ts      # Fetch wrapper tự động đính kèm cookie, header bảo mật và chuẩn hóa lỗi
    ├── components/     # 🧩 Các UI components dùng chung:
    │   └── common/     # Button, Field, Link, Notice (thông báo lỗi/thành công), ErrorBoundary
    ├── hooks/          # 🪝 Custom React hooks:
    │   └── usePath.ts  # Hook lắng nghe và điều hướng URL không cần reload trang
    ├── styles/         # 🎨 CSS & Design Tokens:
    │   ├── tokens.css  # Biến màu sắc, khoảng cách, font chữ chuẩn
    │   └── style.css   # Bố cục lưới, layout thanh bên, bảng biểu, hộp thoại
    └── screens/        # 🖥️ Toàn bộ màn hình giao diện phân theo vai trò người dùng:
        ├── auth/       # Màn hình Khách: Đăng nhập, Đăng ký, Quên mật khẩu, Lời mời (Auth, Invite)
        ├── inbox/      # Màn hình Nhân viên: Hộp thư hội thoại trực tiếp, ghi chú nội bộ, nháp tin nhắn
        ├── channels/   # Màn hình Kênh chat: Danh sách website, cấu hình chào hỏi, xem trước widget
        ├── knowledge/  # Màn hình Tri thức: Kho thông tin, trích xuất tài liệu, crawler nguồn web, vòng đời
        ├── ai-rules/   # Màn hình Bot AI: Bảng quy tắc xử lý câu hỏi, chuyển giao vai trò, xuất nhập CSV
        ├── settings/   # Màn hình Cài đặt: Doanh nghiệp, nhân sự, audit log, biểu mẫu thu thập, hỗ trợ, quota
        └── platform/   # Màn hình Platform Admin: Quản trị nền tảng, cấp model AI, cấu hình provider
```

### Path Aliases trong Frontend:
- `@/*` ➔ `src/*`
- `@api` ➔ `src/api/api`
- `@components/*` ➔ `src/components/*`
- `@screens/*` ➔ `src/screens/*`

---

## 4. HƯỚNG DẪN THỰC CHIẾN (VIBE CODING GUIDE)

### Tình huống 1: Bạn muốn thêm một MÀN HÌNH GIAO DIỆN MỚI ở Frontend
1. Xác định màn hình đó thuộc vai trò người dùng nào:
   - Nếu là tính năng CSKH ➔ Tạo file trong `frontend/src/screens/inbox/`.
   - Nếu là cài đặt doanh nghiệp ➔ Tạo file trong `frontend/src/screens/settings/`.
   - Nếu là tri thức / AI ➔ Tạo file trong `frontend/src/screens/knowledge/` hoặc `ai-rules/`.
2. Viết Component React:
   - Sử dụng `@api` để gọi API: `const data = await api('/endpoint', 'GET');`.
   - Sử dụng các UI component chung từ `@components/common/Field`, `Notice`, `Link`.
   - Sử dụng biến CSS token từ `var(--color-primary)`, `var(--color-text-muted)`.
3. Khai báo route trong `frontend/src/App.tsx`:
   - Import screen vào `App.tsx` bằng alias: `import { MyNewScreen } from './screens/...';`.
   - Thêm đường dẫn vào hàm `routeTitle(path)` và khối render điều kiện `{path === '/my-path' && <MyNewScreen />}`.

---

### Tình huống 2: Bạn muốn thêm một TÍNH NĂNG / API ENDPOINT MỚI ở Backend
Tuân thủ nghiêm ngặt **Clean Architecture Flow**:

1. **Tạo DTO Validation (`backend/src/dtos/`):**
   - Viết Zod schema: `export const CreateItemSchema = z.object({ name: z.string().min(1) }).strict();`.
2. **Tạo Repository Layer (`backend/src/repositories/`):**
   - Viết hàm SQL có tham số: `await db.query('INSERT INTO items (workspace_id, name) VALUES ($1, $2)', [workspaceId, name]);`.
3. **Tạo Service Layer (`backend/src/services/`):**
   - Thực thi logic nghiệp vụ, kiểm tra quota, kiểm tra quyền hạn.
4. **Tạo Controller Layer (`backend/src/controllers/`):**
   - Bóc tách request body, parse qua DTO Zod, gọi Service và trả JSON envelope chuẩn `{ success: true, data }`.
5. **Gắn Route vào (`backend/src/routes/`):**
   - Đăng ký URL và HTTP Method: `router.post('/items', myController);`.
   - Route tự động được nạp trong `backend/src/app.ts`.

---

## 5. CÁC LỆNH ĐIỀU PHỐI (COMMAND CHEATSHEET)

| Thao tác | Lệnh thực thi từ thư mục gốc | Ghi chú |
|---|---|---|
| **Cài đặt toàn bộ thư viện** | `npm run install:all` | Cài đồng thời root, backend và frontend |
| **Chạy song song Dev** | `npm run dev` | Backend chạy port `4317`, Frontend chạy port `3001` |
| **Chỉ chạy Backend Dev** | `npm run dev:backend` | API server độc lập |
| **Chỉ chạy Frontend Dev** | `npm run dev:frontend` | Vite server độc lập có proxy tự động |
| **Kiểm tra kiểu & Build toàn bộ** | `npm run build:all` | Typecheck backend & build frontend bundle |
| **Chạy toàn bộ Tests** | `npm run test:all` | Chạy cả tests backend và frontend |
| **Chạy kiểm thử Frontend** | `npm run test:frontend` | Chạy bộ test client (drafts, CSV parser) |
| **Chạy kiểm thử Backend** | `npm run test:backend` | Chạy bộ test máy chủ |
| **Cài đặt Database & Migration** | `npm run db:setup` | Áp dụng toàn bộ migration vào PostgreSQL |
| **Chạy diễn tập khôi phục DB** | `npm run db:restore-drill` | Kiểm tra tính toàn vẹn 55 bảng và hash SHA-256 |
| **Bật Docker Compose Production** | `npm run prod:up` | Triển khai Postgres, Redis, Backend, Frontend |
| **Tắt Docker Compose Production** | `npm run prod:down` | Dừng các container sản xuất |

---

## 6. NGUYÊN TẮC BẤT BIẾN KHI VIẾT VÀ REVIEW CODE

1. 🔒 **Không bao giờ tin tưởng Client ID:** `workspace_id` luôn được phân giải từ phiên đăng nhập máy chủ (`Identity`) hoặc Token widget hợp lệ, không lấy từ tham số `req.body.workspace_id`.
2. 🛡️ **Bảo mật cơ sở dữ liệu Multi-Tenant:** Mọi truy vấn đọc/ghi nghiệp vụ đều phải nằm trong Transaction kích hoạt Row-Level Security (`SET LOCAL app.workspace_id = ...`).
3. 🤐 **Tuyệt mật API Secrets:** Khóa API của OpenAI, Claude, Gemini... chỉ tồn tại trên biến môi trường Backend, tuyệt đối không gửi về phía trình duyệt hay widget SDK.
4. 🧹 **Không tạo file trơ trọi:** Mọi file mới bắt buộc phải nằm đúng thư mục chức năng đã quy định. Thư mục `backend/src` và `frontend/src` phải luôn giữ trạng thái sạch sẽ, chỉ chứa các thư mục con và file entrypoint (`App.tsx`, `main.tsx`, `app.ts`, `index.ts`).
5. ✅ **Checklist trước khi Commit:**
   - Chạy `npm run build:all` ➔ Phải **PASS 100%** không có lỗi TypeScript.
   - Chạy `npm run test:frontend` ➔ Phải **PASS 100%**.
