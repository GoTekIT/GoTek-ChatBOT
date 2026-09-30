# Tài Liệu Kỹ Thuật & Vận Hành Backend (GoTek Chatbot Engine)

Thư mục này chứa tài liệu đặc tả kiến trúc, luồng quy trình nghiệp vụ (workflow), danh mục tài khoản đăng nhập và hướng dẫn vận hành cho Backend API Engine.

## Các tài liệu chính:

- 📖 **[WORKFLOW_AND_ACCOUNTS.md](./WORKFLOW_AND_ACCOUNTS.md):** Hướng dẫn chi tiết toàn bộ quy trình hệ thống (Xác thực, Hộp thư CSKH, Staff Handoff, Knowledge Base Ingestion, Platform Admin), danh sách tài khoản mẫu (Seed Accounts) và bảng phân quyền.
- 🚀 **Khởi tạo dữ liệu mẫu (Seed Data):**
  ```bash
  npm run db:seed
  ```
- 🔑 **Tài khoản đăng nhập nhanh:**
  - `admin@gotek.vn` / `Admin@12345678` (Platform Super Admin & Owner)
  - `alex.rivera@gotek.vn` / `Admin@12345678` (Workspace Admin Lead)
  - `nam.do@gotek.vn` / `Admin@12345678` (Support Agent)
  - `sarah.jenkins@gotek.vn` / `Admin@12345678` (Support Agent)
