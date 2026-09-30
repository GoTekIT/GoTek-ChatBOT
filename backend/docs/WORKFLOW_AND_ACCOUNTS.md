# HƯỚNG DẪN QUY TRÌNH HỆ THỐNG & TÀI KHOẢN TRUY CẬP GOTEK CHATBOT
**Tài liệu kỹ thuật và vận hành dành cho Đội ngũ Phát triển & Vận hành GoTek IT**

---

## 1. Danh Sách Tài Khoản Đăng Nhập Hệ Thống (Seed Accounts)

Hệ thống đã được nạp sẵn (seeding) dữ liệu mẫu chuẩn cho 4 vai trò đại diện khác nhau. Tất cả tài khoản dùng chung mật khẩu mặc định:

> 🔑 **MẬT KHẨU MẶC ĐỊNH (CHUNG CHO TẤT CẢ):** `Admin@12345678`

| STT | Họ và Tên | Email Đăng Nhập | Vai Trò (Role) | Phạm Vi Quyền Hạn (Scope) | Ghi Chú |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **GoTek Super Admin** | `admin@gotek.vn` | **Platform Admin & Workspace Owner** | Toàn quyền cấp nền tảng (Platform Admin), cấu hình AI Provider/Model toàn hệ thống + Chủ sở hữu Workspace `GoTek Solutions HQ` | Dùng để truy cập cả `/platform/*` và toàn bộ Console quản trị |
| **2** | **Alex Rivera** | `alex.rivera@gotek.vn` | **Workspace Admin** | Quản trị viên Workspace `GoTek Solutions HQ`: quản lý nhân viên, cấu hình kênh widget, phê duyệt tri thức, CSKH VIP | Phù hợp test luồng Quản trị doanh nghiệp |
| **3** | **Đỗ Hoàng Nam** | `nam.do@gotek.vn` | **Support Agent** | Nhân viên CSKH: trực live queue, tiếp quản hội thoại (Staff Handoff), trả lời khách hàng, ghi chú nội bộ | Phù hợp test luồng Agent tiếp nhận chat |
| **4** | **Sarah Jenkins** | `sarah.jenkins@gotek.vn` | **Support Agent** | Nhân viên CSKH ca trực quốc tế / kỹ thuật | Phù hợp test phân công nhiều Agent |

> **Thông tin Không gian làm việc (Workspace mặc định):**
> - **Tên:** `GoTek Solutions HQ`
> - **Mã định danh (ID):** `a0000000-0000-0000-0000-000000000001`
> - **Ngôn ngữ:** Tiếng Việt (`vi`)
> - **Số lượng ghế nhân viên (Seats):** 20 nhân sự

---

## 2. Đường Dẫn Truy Cập Dịch Vụ (Endpoints & URLs)

- 🌐 **Frontend Web Console (React 19 / Vite):** `http://localhost:3001`
  - Đăng nhập: `http://localhost:3001/app/login` (hoặc `http://localhost:3001/app/auth/login`)
  - Bảng điều khiển Hộp thư CSKH: `http://localhost:3001/app/inbox`
  - Quản lý Tri thức (Knowledge Base): `http://localhost:3001/app/knowledge`
  - Quản lý Kênh liên lạc & Widget: `http://localhost:3001/app/channels`
  - Báo cáo phân tích (Analytics): `http://localhost:3001/app/analytics`
  - Quản trị Nền tảng (Platform Admin): `http://localhost:3001/platform/registry`
- ⚙️ **Backend API Engine (Express 5):** `http://localhost:4317`
  - Service Dashboard: `http://localhost:4317/`
  - Kiểm tra sức khỏe hệ thống: `http://localhost:4317/api/health`
  - Thư viện nhúng Widget SDK: `http://localhost:4317/widget.js` hoặc `/public/sdk.js`
  - Logo chính thức: `http://localhost:4317/gotek-logo.png`
- 🐰 **RabbitMQ Management Dashboard:** `http://localhost:15672` (Tài khoản: `guest` / Mật khẩu: `guest`)
- 🐘 **PostgreSQL 16 Multi-tenant:** `localhost:55432` (Database: `gotek_chatbot`)

---

## 3. Quy Trình Vận Hành & Kiến Trúc Hệ Thống (System Workflows)

Hệ thống được thiết kế theo kiến trúc **Modular Monolith + Event-Driven Workers**, bảo mật đa khách thuê bằng **PostgreSQL Row-Level Security (RLS)**.

```
                              [ Khách truy cập / Website ]
                                           │
                                           ▼ (Widget SDK qua HTTPS/WSS)
                                   ┌───────────────┐
                                   │ Nginx Reverse │ (Port 3001)
                                   └───────┬───────┘
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
             ┌─────────────────────┐               ┌─────────────────────┐
             │ Frontend (React 19) │               │ Backend (Express 5) │ (Port 4317)
             └─────────────────────┘               └──────────┬──────────┘
                                                              │
                                            ┌─────────────────┼─────────────────┐
                                            ▼                 ▼                 ▼
                                    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                                    │ PostgreSQL 16│  │ RabbitMQ 3.12│  │   Redis 7    │
                                    │ (RLS Secure) │  │(Event Queues)│  │ (PubSub/Rate)│
                                    └──────────────┘  └──────┬───────┘  └──────────────┘
                                                             │
                                              ┌──────────────┴──────────────┐
                                              ▼                             ▼
                                     ┌─────────────────┐           ┌─────────────────┐
                                     │  AI RAG Worker  │           │ Ingestion Worker│
                                     └─────────────────┘           └─────────────────┘
```

---

### Workflow 1: Xác Thực & Nhận Diện Không Gian Làm Việc (Auth & Multi-Tenant Identity)
1. **Đăng nhập:** Người dùng gửi `email` và `password` tới `POST /api/auth/login`.
2. **Kiểm tra mật khẩu:** Sử dụng thuật toán băm chuẩn công nghiệp **Argon2id**.
3. **Phiên làm việc (Session):** Tạo mã token ngẫu nhiên, lưu SHA256 digest vào bảng `sessions`, đính kèm cookie bảo mật `gotek_session` (`HttpOnly`, `SameSite=Lax`).
4. **Cô lập dữ liệu (PostgreSQL RLS):** Khi mỗi request đến, Middleware thiết lập biến cục bộ trong transaction SQL:
   ```sql
   SET LOCAL app.workspace_id = 'a0000000-0000-0000-0000-000000000001';
   SET LOCAL app.actor_id = 'b0000000-0000-0000-0000-000000000001';
   ```
   Tất cả truy vấn sau đó đều tự động được Database lọc theo tenant, ngăn chặn 100% rò rỉ dữ liệu chéo giữa các doanh nghiệp.

---

### Workflow 2: CSKH Trực Tuyến, Trả Lời AI & Chuyển Giao Nhân Viên (Widget -> AI -> Staff Handoff)

1. **Khởi tạo Widget:** Website nhúng đoạn script SDK:
   ```html
   <script src="http://localhost:4317/widget.js" data-token="gotek_pub_..."></script>
   ```
2. **Khách hàng gửi tin nhắn:**
   - Trạng thái hội thoại ban đầu: `reply_owner = 'AI_ACTIVE'`.
   - Backend đẩy event tin nhắn vào RabbitMQ queue `q.gotek.ai.replies`.
3. **AI Copilot xử lý & Trích xuất tri thức (RAG Grounding):**
   - AI Worker truy xuất tài liệu trong bảng `knowledge_items` có `audience = 'PUBLIC'` và `state = 'READY'`.
   - AI tạo phản hồi có kiểm chứng, đính kèm nguồn trích dẫn (`citations`).
4. **Chuyển giao nhân viên (Staff Handoff):**
   - Khi khách hàng yêu cầu gặp tư vấn viên hoặc AI nhận diện câu hỏi phức tạp (báo giá, hợp đồng, sự cố), trạng thái chuyển sang: `reply_owner = 'HANDOFF_PENDING'`.
   - Nhân viên (`Alex Rivera`, `Đỗ Hoàng Nam`,...) trên màn hình Console thấy thông báo chuông và thẻ hội thoại chuyển sang màu cam/đỏ.
   - Nhân viên bấm **"Tiếp nhận hỗ trợ"** ➔ `reply_owner = 'HUMAN_ACTIVE'`, hội thoại được gán trực tiếp cho nhân viên đó.
5. **Ghi chú nội bộ (Internal Notes):**
   - Nhân viên có thể gửi tin nhắn với cờ `visibility = 'internal'`.
   - Khách hàng trên widget hoàn toàn không nhìn thấy ghi chú này, chỉ các nhân viên trong workspace mới xem được.

---

### Workflow 3: Quản Lý & Nạp Tri thức Doanh Nghiệp (Knowledge Base Ingestion)

1. **Tải lên tài liệu:** Quản trị viên tải lên file `.pdf`, `.docx`, `.txt`, `.csv` hoặc nhập URL website tại `/app/knowledge`.
2. **Quy trình xử lý bất đồng bộ:**
   - Tạo bản ghi `knowledge_items` và phiên bản nháp `knowledge_versions` (`state = 'DRAFT'`).
   - Đẩy tác vụ vào Queue `q.gotek.knowledge.ingest`.
   - Ingestion Worker phân tách văn bản (Chunking 512 tokens), tạo vector embeddings qua model `text-embedding-3-small` và lưu vào PostgreSQL.
   - Đổi trạng thái sang `READY`.
3. **Phê duyệt xuất bản (Publication Approval):**
   - Tài liệu chỉ phục vụ khách hàng khi Admin bấm **"Xuất bản công khai"** (`audience = 'PUBLIC'`).
   - Nếu để `audience = 'INTERNAL'`, tài liệu chỉ hiển thị làm gợi ý cho nhân viên trực chat, AI trên widget tuyệt đối không trích xuất.

---

### Workflow 4: Quản Trị Cấp Nền Tảng (Platform Admin Workflow)

Chỉ tài khoản có trong bảng `platform_admins` (như `admin@gotek.vn`) mới có quyền truy cập module này:
1. **Quản lý Provider:** Đăng ký OpenAI, Anthropic, Gemini hoặc Local LLM Ollama. Bí mật API Key được lưu dưới dạng tham chiếu biến môi trường (`secret_ref`), không lưu plain-text vào database.
2. **Quản lý Models:** Khai báo danh mục model và khả năng: `chat`, `embedding`, `vision`.
3. **Cấp quyền Doanh nghiệp (Model Grants):** Cấp quyền cho từng Workspace được phép gọi model nào. Nếu doanh nghiệp chưa được cấp grant, backend sẽ từ chối lệnh gọi AI.
4. **Hỗ trợ khẩn cấp có thời hạn (Scoped Support Grant):** Platform Admin không được tự ý đọc tin nhắn của khách hàng. Muốn hỗ trợ kỹ thuật phải có mã ủy quyền từ Workspace với thời gian hết hạn (`expiresAt`).

---

## 4. Các Lệnh Thường Dùng Cho Lập Trình Viên & Vận Hành

Mọi thao tác quản lý dữ liệu và khởi chạy đều được cấu hình trong `package.json`:

```bash
# 1. Khởi động toàn bộ stack Docker (Postgres, RabbitMQ, Redis, Backend, Frontend)
docker compose up -d

# 2. Rebuild lại khi có thay đổi code mới
docker compose up -d --build backend frontend

# 3. Chạy script nạp lại dữ liệu mẫu chuẩn (Idempotent seed data)
npm run db:seed

# 4. Chạy môi trường phát triển cục bộ (Hot-reload)
npm run dev               # Chạy đồng thời cả Backend (port 4317) và Frontend (port 3001)
npm run dev:backend       # Chạy riêng Backend
npm run dev:frontend      # Chạy riêng Frontend

# 5. Kiểm thử và Build sản phẩm
npm run test:all          # Chạy toàn bộ test suites
npm run build:all         # Typecheck và build cả Backend lẫn Frontend
```

---

## 5. Danh Mục Các Bảng Cơ Sở Dữ Liệu Trọng Tâm

| Tên Bảng | Ý Nghĩa Chức Năng |
| :--- | :--- |
| `users` | Danh mục tài khoản người dùng, băm mật khẩu Argon2id, trạng thái xác thực email |
| `workspaces` | Danh mục các công ty / doanh nghiệp thuê nền tảng (Tenants) |
| `memberships` | Phân quyền vai trò người dùng trong từng công ty (`Owner`, `Admin`, `Agent`) |
| `platform_admins` | Danh sách tài khoản quản trị toàn hệ thống |
| `channels` | Cấu hình kênh tiếp nhận khách hàng (Website Widget, Public Token, màu sắc, lời chào) |
| `visitors` | Phiên khách truy cập ẩn danh hoặc định danh qua widget |
| `conversations` | Hội thoại CSKH, quản lý quyền điều khiển (`AI_ACTIVE`, `HANDOFF_PENDING`, `HUMAN_ACTIVE`) |
| `messages` | Tin nhắn hội thoại, phân định tin công khai (`public`) và ghi chú nội bộ (`internal`) |
| `knowledge_items` | Tài liệu tri thức, phân quyền hiển thị (`PUBLIC` cho khách, `INTERNAL` cho nhân viên) |
| `knowledge_versions` | Các phiên bản nội dung tri thức, trạng thái vector hóa (`READY`, `PROCESSING`) |
| `providers` & `models` | Cấu hình nhà cung cấp LLM và các mô hình AI được kích hoạt |
| `model_grants` | Bảng phân bổ hạn mức và quyền dùng model cho từng công ty |

---
*Tài liệu được cập nhật tự động và đồng bộ với phiên bản GoTek Chatbot v2.4.*
