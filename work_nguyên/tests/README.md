# SỔ TAY HƯỚNG DẪN KIỂM THỬ (TEST GUIDE HUB)
**Dự án:** GoTek Chatbot Platform • **Nhánh:** `nguyen`  
**Thư mục:** `work_nguyên/tests/`  
**Người phụ trách:** Nguyễn Văn Nguyên  
**Mục đích:** Hướng dẫn chi tiết từng bước cho Tester, Developer hoặc Tech Lead thực hiện kiểm thử thực tế (Manual & Automated Tests) cho từng Use Case trước khi đóng nghiệm thu.

---

## 🧭 CẤU TRÚC TÀI LIỆU HƯỚNG DẪN TEST

| Mã Phân Hệ | Tên Use Case | File Hướng Dẫn Chi Tiết | Trọng Tâm Kiểm Thử |
|:---:|---|---|---|
| **UC-05** | **Visitor Live Chat & Widget Realtime** | [`HUONG_DAN_TEST_UC_05.md`](file:///d:/gotek/ai_automation_team_new/work_nguy%C3%AAn/tests/HUONG_DAN_TEST_UC_05.md) | WebSocket 2 chiều, F5 Reload, Idempotency, Pre-chat, Rate limit, Receipt contract. |
| **UC-06** | **Agent Reply & Internal Note** | *Đang cập nhật* | Trả lời công khai, Ghi chú nội bộ, Zero-leakage tới khách. |
| **UC-07** | **Takeover & Resume AI** | *Đang cập nhật* | Chuyển quyền giữa AI và nhân viên, cập nhật owner version. |
| **UC-19** | **Multi-Channel Hub** | *Đang cập nhật* | Tạo kênh, phân quyền Agent, cài đặt widget nhúng web. |
| **UC-21** | **Messenger Webhook** | *Đang cập nhật* | Nhận Webhook Meta, chữ ký HMAC, gửi Graph API, lọc Echo. |

---

## ⚙️ HƯỚNG DẪN THIẾT LẬP MÔI TRƯỜNG TRƯỚC KHI TEST

### 1. Phân biệt 2 Cơ sở Dữ liệu
* **Môi trường Database Test (Đang dùng hiện tại):**
  - URL trong `backend/.env`: `postgresql://postgres.aujxcnrlwvipexrlycng:Matkhau2k3vn.@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`
  - Đặt tại Supabase Sydney. Lưu ý thời gian phản hồi DB từ 1.5s – 2.5s do khoảng cách địa lý.
* **Môi trường Database Thật (Tích hợp nội bộ):**
  - URL: `postgresql://gotek_app:2170ba6f5fd360ce55d2328268c9bdbba855e25be51835853ffa257ba1da7f97@127.0.0.1:55432/gotek_chatbot`
  - Khởi động qua Docker: `npm run db:setup` hoặc `docker compose up -d postgres`.
  - Phản hồi siêu tốc nội bộ < 1ms.

### 2. Các Lệnh Khởi Chạy Dịch Vụ
```bash
# Cài đặt toàn bộ thư viện
npm run install:all

# Khởi chạy đồng thời cả Backend (port 4317) và Frontend (port 3001)
npm run dev

# Hoặc khởi chạy riêng lẻ:
npm run dev:backend   # API & WebSocket server trên http://127.0.0.1:4317
npm run dev:frontend  # Vite SPA trên http://localhost:3001
```

---

## 🔍 CÔNG CỤ HỖ TRỢ KIỂM THỬ KHUYÊN DÙNG
1. **Trình duyệt (Google Chrome / Edge):**
   - Phím `F12` -> Tab **Network** -> Filter **WS** (kiểm tra các frame WebSocket: `message:send`, `message:ack`, `message:new`, `typing`).
   - Tab **Application** -> **Local Storage** (kiểm tra khóa `gotek.visitor.*` lưu trữ token).
2. **Postman / cURL / REST Client:** Kiểm thử các API `/widget-api/:key/*`.
3. **DBeaver / pgAdmin / psql:** Truy vấn trực tiếp vào database để xác thực dữ liệu được lưu thật, không dùng mock data.
