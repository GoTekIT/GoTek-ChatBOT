# KẾ HOẠCH HÀNH ĐỘNG CHI TIẾT 5 USE CASES — PHÂN HỆ 2 (INBOX CSKH & MESSENGER)
**Người phụ trách trọn gói (DB, Backend, Frontend UI, Realtime, Kiểm thử, Bàn giao):** Nguyễn Văn Nguyên  
**Dự án:** GoTek Chatbot System (Enterprise Multi-tenant Platform)  
**Tài liệu gốc tham chiếu:** `KE-HOACH-2-TUAN-CORE-GOTEK-WORKSHOP` (30/09/2026)  
**Lịch giao việc rút ngắn:** 01/10/2026 – 07/10/2026 (Nghiệm thu toàn hệ thống trước 10/10/2026)

---

## 1. TỔNG QUAN MA TRẬN 5 USE CASES VÀ DEADLINE

| Mã UC | Tên nghiệp vụ & Phạm vi | Độ ưu tiên | Công chuẩn | Lịch rút ngắn | Phụ thuộc | Tiêu chí đạt (Acceptance Gate) |
|---|---|:---:|:---:|:---:|---|---|
| **UC-19** | **Quản lý đa loại kênh & Lọc Inbox nền tảng** | **P0** | 1.0 ngày | **01/10/2026** | UC-01 (Auth) | • Kênh phân biệt rõ `website` (Widget) và `messenger` (Fanpage).<br>• Inbox có dropdown/tab lọc chuẩn xác theo kênh.<br>• Giữ nguyên vẹn 100% dữ liệu website cũ.<br>• Chặn đổi loại kênh khi đã phát sinh hội thoại. |
| **UC-05** | **Visitor gửi tin widget, lưu bền vững, chống trùng** | **P0** | 1.5 ngày | **02–03/10/2026** | UC-04 (Channel) | • Visitor chat từ Widget SDK thật, Inbox nhân viên nhận realtime.<br>• F5/Reload trang hiển thị nguyên vẹn lịch sử chat.<br>• Gửi lại cùng `clientId` không nhân đôi message/job AI.<br>• Session hết hạn báo lỗi rõ ràng; pre-chat bắt buộc phải pass. |
| **UC-21** | **Inbound Webhook Facebook Messenger vào Inbox** | **P0** | 2.5 ngày | **04–05/10/2026** | UC-19, UC-20 | • Webhook Meta bảo mật HMAC-SHA256, lưu bền vững (Durable Queue).<br>• Ánh xạ đúng Page ID & sender PSID về đúng tenant/channel.<br>• Inbox hiển thị nhãn **Messenger**, avatar, tên khách thật.<br>• Miễn nhiễm với Webhook replay, echo loops và delivery receipts. |
| **UC-06** | **Agent trả lời Public & Ghi chú nội bộ (Internal Note)** | **P0** | 1.5 ngày | **05–06/10/2026** | UC-05, UC-03 | • Public reply đẩy tức thì về Visitor (Widget / Messenger).<br>• Note nội bộ chỉ Staff trong workspace đọc được (Zero leak).<br>• Không bao giờ gửi note ra ngoài widget/stream/socket visitor.<br>• Gửi lỗi không hiện thành công; reconnect tự động tải bù (backfill). |
| **UC-07** | **Agent Takeover, Chặn AI cũ (Fencing), Chuyển lại AI** | **P0** | 2.0 ngày | **06–07/10/2026** | UC-06, UC-13 | • Phân biệt rạch ròi `reply_owner` và `status`.<br>• Agent tiếp quản hội thoại (Takeover) tăng `owner_version`.<br>• Chặn đứng câu AI cũ không cho chèn vào DB khi người đã nhận ca.<br>• 2 Agent tranh nhận xử lý xung đột 409 Conflict. Chuyển lại cho AI mượt mà. |

---

## 2. PHÂN RÃ CÔNG VIỆC CHI TIẾT TỪNG NGÀY & TỪNG KHÂU (BREAKDOWN WBS)

```
        01/10 (D1)           02-03/10 (D2-D3)        04-05/10 (D4-D5)        05-06/10 (D5-D6)        06-07/10 (D6-D7)
   +-------------------+  +--------------------+  +--------------------+  +--------------------+  +--------------------+
   |       UC-19       |  |       UC-05        |  |       UC-21        |  |       UC-06        |  |       UC-07        |
   | Multi-Channel &   |->| Visitor Chat SDK & |->| Inbound Messenger  |->| Agent Reply &      |->| Takeover & AI      |
   | Platform Filter   |  | Idempotency Engine |  | Webhook Pipeline   |  | Private Note Zero  |  | Ownership Fencing  |
   +-------------------+  +--------------------+  +--------------------+  +--------------------+  +--------------------+
```

---

### GIAI ĐOẠN 1: NGÀY 01/10/2026 — TRIỂN KHAI TRỌN GÓI UC-19
*(Xem chi tiết trong tệp riêng [UC_19_MULTI_CHANNEL.md](./UC_19_MULTI_CHANNEL.md))*

### GIAI ĐOẠN 2: NGÀY 02–03/10/2026 — TRIỂN KHAI TRỌN GÓI UC-05
*(Xem chi tiết trong tệp riêng [UC_05_VISITOR_CHAT.md](./UC_05_VISITOR_CHAT.md))*

### GIAI ĐOẠN 3: NGÀY 04–05/10/2026 — TRIỂN KHAI TRỌN GÓI UC-21
*(Xem chi tiết trong tệp riêng [UC_21_MESSENGER_WEBHOOK.md](./UC_21_MESSENGER_WEBHOOK.md))*

### GIAI ĐOẠN 4: NGÀY 05–06/10/2026 — TRIỂN KHAI TRỌN GÓI UC-06
*(Xem chi tiết trong tệp riêng [UC_06_AGENT_REPLY_NOTE.md](./UC_06_AGENT_REPLY_NOTE.md))*

### GIAI ĐOẠN 5: NGÀY 06–07/10/2026 — TRIỂN KHAI TRỌN GÓI UC-07
*(Xem chi tiết trong tệp riêng [UC_07_TAKEOVER_AND_RESUME_AI.md](./UC_07_TAKEOVER_AND_RESUME_AI.md))*
- [ ] Database: Quản lý `reply_owner` (`AI_ACTIVE`, `HANDOFF_PENDING`, `HUMAN_ACTIVE`), `owner_version`, `assigned_to`.
- [ ] Backend: API `/takeover` và `/resume-ai`. Cơ chế Fencing Token chặn đứng câu trả lời AI cũ khi Agent đã tiếp quản.
- [ ] Frontend: Nút bấm Takeover / Nhận hội thoại / Chuyển lại cho AI. Xử lý Toast cảnh báo 409 khi 2 Agent tranh nhận.

---

## 3. CHECKLIST SẴN SÀNG CHO ĐỢT NGHIỆM THU (09/10/2026)

- [ ] **Môi trường & Fixture**: Chạy script khôi phục database sạch, 2 workspace giả lập để kiểm tra cách ly dữ liệu.
- [ ] **Bằng chứng kiểm thử (Evidence Pack)**:
  - Video quay màn hình luồng chat 2 chiều giữa Widget và Agent Inbox (UC-05, UC-06).
  - Video quay màn hình luồng Webhook Messenger gửi tin vào Inbox (UC-21).
  - Video quay cảnh 2 Agent tranh nhận ticket và AI tự động bị chặn khi Agent nhảy vào tiếp quản (UC-07).
  - Báo cáo kết quả chạy kiểm thử tự động `npm run test:backend` đạt 100% pass rate.
