# HƯỚNG DẪN KIỂM THỬ THỰC TẾ CHI TIẾT: UC-05 VISITOR CHAT
**Phân hệ:** Khách truy cập mở Widget, Gửi tin nhắn Full-Duplex, Bền vững qua F5, Khóa chống gửi trùng & Bảo mật ranh giới  
**Người phụ trách:** Nguyễn Văn Nguyên  
**Mục tiêu:** Cung cấp hướng dẫn từng bước cụ thể (kèm câu lệnh cURL, SQL và thao tác UI) để bất kỳ ai cũng có thể tự mình tái hiện và nghiệm thu 100% các tiêu chí của UC-05.

---

## 🎯 DANH SÁCH CÁC KỊCH BẢN KIỂM THỬ CẦN THỰC HIỆN

```
+---------------------------------------------------------------------------------------------------+
| NHÓM 1: LUỒNG THÀNH CÔNG (HAPPY PATH)                                                             |
|   1. Mở Widget trên trang web thật (Shadow DOM, Lời chào mở đầu, Thương hiệu)                     |
|   2. Khách gửi tin nhắn qua WebSocket (Optimistic UI 0ms, ACK máy chủ < 5ms)                     |
|   3. Nhân viên trên Inbox nhận tin nhắn tức thì (< 50ms)                                          |
|   4. Nhân viên phản hồi -> Khách nhận tin -> SDK gửi biên nhận Receipt cập nhật DB               |
|   5. Tải lại trang (F5 Reload) -> Toàn bộ lịch sử giữ nguyên thứ tự sequence                     |
+---------------------------------------------------------------------------------------------------+
| NHÓM 2: TÌNH HUỐNG LỖI & QUYỀN ÂM (NEGATIVE & SECURITY TESTS)                                     |
|   6. Khóa chống gửi trùng (Idempotency): Gửi 20 lần cùng clientId -> DB chỉ lưu 1 bản ghi        |
|   7. Kiểm soát hết hạn phiên (Session Expiry): expires_at < now() -> Bị đóng socket 4001         |
|   8. Cưỡng chế Pre-chat: prechat.enabled = true -> Chặn gửi tin nếu thiếu thông tin              |
|   9. Chống DoS (WebSocket Rate Limit): Bắn > 5 tin/3s -> Bị chặn với mã RATE_LIMITED             |
|  10. Cách ly riêng tư: Nhân viên gửi Ghi chú nội bộ -> Visitor tuyệt đối 0% nhìn thấy            |
+---------------------------------------------------------------------------------------------------+
```

---

## 🚀 BƯỚC CHUẨN BỊ: KHỞI ĐỘNG HỆ THỐNG

1. **Khởi động Backend và Frontend:**
   ```bash
   npm run dev
   ```
   - Backend chạy tại: `http://127.0.0.1:4317`
   - Frontend chạy tại: `http://localhost:3001`

2. **Lấy Public Key của kênh Widget:**
   - Mở trình duyệt vào `http://localhost:3001/channels` (Đăng nhập tài khoản nhân viên).
   - Chọn tab **Kênh Website** -> Bấm vào kênh bất kỳ -> Chọn tab **Cài đặt & Mã nhúng**.
   - Sao chép mã `public_key` (hoặc `websiteToken`), ví dụ: `w_xCXoybgt61WkPrSFoPrMC8YG0XnILl-LZ06cjP-ns`.

---

## 📋 HƯỚNG DẪN CHI TIẾT TỪNG KỊCH BẢN KIỂM THỬ

### Kịch bản 1: Mở Widget Thật & Kiểm tra Giao diện Khách hàng
* **Thao tác:**
  1. Mở trình duyệt truy cập vào trang có nhúng widget (hoặc trang preview `http://localhost:3001/channels/preview/{channelId}`).
  2. Bấm vào nút tròn tròn launcher *"Trò chuyện"* ở góc phải dưới màn hình.
* **Tiêu chí Đạt:**
  - Khung chat mở lên mượt mà, viền bo tròn 20px chuẩn Shadow DOM.
  - Lời mở đầu (`greeting`) xuất hiện như bong bóng chat đầu tiên bên trái.
  - Thanh trạng thái phía trên hiển thị đèn xanh: `● Trợ lý AI đang hỗ trợ` hoặc `● Nhân viên đang hỗ trợ`.
  - Kiểm tra DevTools (`F12` -> Console/Elements): Không có bất kỳ lỗi JavaScript nào.

---

### Kịch bản 2: Khách Gửi Tin Nhắn qua WebSocket & Optimistic UI
* **Thao tác:**
  1. Mở DevTools (`F12`), chuyển sang tab **Network** -> chọn filter **WS**.
  2. Click vào kết nối `/ws?token=...&role=visitor`. Chọn tab **Messages**.
  3. Nhập tin nhắn *"Xin chào, tôi cần tư vấn báo giá dịch vụ"* và bấm phím `Enter`.
* **Tiêu chí Đạt:**
  - **Optimistic UI:** Tin nhắn xuất hiện ngay lập tức (0ms) trong khung chat với hiệu ứng mờ nhẹ.
  - **Frame Gửi:** Thấy frame gửi đi `{"type":"message:send","clientId":"...","body":"..."}`.
  - **ACK Server:** Trong vòng < 5ms, thấy server trả về frame `{"type":"message:ack","clientId":"..."}`.
  - Bong bóng tin nhắn gỡ bỏ hiệu ứng mờ, chuyển sang trạng thái đã gửi thành công.

---

### Kịch bản 3: Màn hình Inbox Nhân viên Nhận Tin Tức Thì
* **Thao tác:**
  1. Mở song song 2 cửa sổ trình duyệt:
     - Cửa sổ A: Trình duyệt khách hàng đang chat.
     - Cửa sổ B: Màn hình nhân viên tại `http://localhost:3001/inbox`.
  2. Tại Cửa sổ A, gửi tin nhắn: *"Nhân viên có ở đó không?"*.
* **Tiêu chí Đạt:**
  - Màn hình Inbox ở Cửa sổ B nhận được tin nhắn tức thì (< 50ms) mà không cần phải nhấn F5 hay tải lại trang.
  - Cuộc trò chuyện nhảy lên đầu danh sách hàng chờ kèm snippet tin nhắn mới nhất.

---

### Kịch bản 4: Biên Nhận Đã Nhận (Receipt Contract)
* **Thao tác:**
  1. Tại Cửa sổ B (Nhân viên), bấm nút *"Chuyển sang Nhân viên chat"* để nhận quyền (takeover).
  2. Nhập câu trả lời: *"Dạ em có ạ, em hỗ trợ anh ngay"* và gửi đi.
  3. Cửa sổ A (Khách hàng) nhận được tin nhắn qua WebSocket.
  4. Mở tab Network tại Cửa sổ A: Quan sát request `POST /widget-api/{key}/receipts`.
* **Đối soát Database (SQL):**
  ```sql
  SELECT id, body, author_type, visitor_received_at 
  FROM messages 
  WHERE body LIKE '%em hỗ trợ anh ngay%' 
  ORDER BY created_at DESC LIMIT 1;
  ```
* **Tiêu chí Đạt:**
  - Request `POST /receipts` được gom tự động trong 200ms với HTTP 200 OK.
  - Trong database, cột `visitor_received_at` có giá trị thời gian thực tế (`IS NOT NULL`).

---

### Kịch bản 5: Bền Vững Qua Tải Lại Trang (F5 Reload Durability)
* **Thao tác:**
  1. Tại Cửa sổ A (Khách hàng), nhấn phím `F5` hoặc nút Reload trình duyệt.
  2. Bấm mở lại khung chat widget.
* **Đối soát Database (SQL):**
  ```sql
  SELECT id, sequence, body, author_type, created_at 
  FROM messages 
  WHERE conversation_id = '{conversationId}' 
  ORDER BY sequence ASC;
  ```
* **Tiêu chí Đạt:**
  - Toàn bộ lịch sử trò chuyện vẫn hiển thị đầy đủ, không bị mất một tin nhắn nào.
  - Thứ tự thời gian và số thứ tự sequence sắp xếp tịnh tiến chính xác từ trên xuống dưới.

---

### Kịch bản 6: Khóa Chống Gửi Trùng (Idempotency Negative Test)
* **Thao tác qua cURL:** Bắn 2 request liên tiếp với cùng một `clientId`:
  ```bash
  curl -X POST "http://127.0.0.1:4317/widget-api/{key}/messages" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer {visitorToken}" \
    -H "Origin: http://localhost:3001" \
    -d '{"clientId":"11111111-2222-3333-4444-555555555555","body":"Tin nhắn thử nghiệm Idempotency"}'
  ```
* **Đối soát Database (SQL):**
  ```sql
  SELECT count(*) as total_records 
  FROM messages 
  WHERE client_id = '11111111-2222-3333-4444-555555555555';
  ```
* **Tiêu chí Đạt:**
  - Cả 2 request đều trả về HTTP 200 OK với cùng một `id` tin nhắn.
  - Truy vấn SQL cho kết quả: `total_records = 1` (Tuyệt đối không nhân đôi bản ghi).
  - Không sinh thêm bản ghi dư thừa nào trong bảng `jobs` (`kind = 'ai.reply'`).

---

### Kịch bản 7: Kiểm Soát Hết Hạn Phiên (Session Expiry Negative Test)
* **Thao tác:**
  1. Trong Database, cưỡng chế làm hết hạn phiên của khách:
     ```sql
     UPDATE visitors 
     SET expires_at = now() - interval '10 minutes' 
     WHERE id = '{visitorId}';
     ```
  2. Trên Widget, thử gửi một tin nhắn mới.
* **Tiêu chí Đạt:**
  - WebSocket lập tức bị server ngắt kết nối với mã đóng `4001` và reason `VISITOR_SESSION_EXPIRED`.
  - Widget tự động dọn dẹp token cũ trong `localStorage` và chuyển sang giao diện thông báo phiên kết thúc hoặc tạo phiên mới.

---

### Kịch bản 8: Cưỡng Chế Form Pre-chat Server-side
* **Thao tác:**
  1. Kích hoạt Pre-chat bắt buộc cho kênh:
     ```sql
     UPDATE channels 
     SET prechat = '{"enabled": true, "message": "Vui lòng nhập thông tin", "fields": [{"key": "fullName", "label": "Họ tên", "enabled": true, "required": true}]}' 
     WHERE public_key = '{key}';
     ```
  2. Dùng WebSocket hoặc cURL gửi tin nhắn mà không qua bước nộp profile:
     ```bash
     curl -X POST "http://127.0.0.1:4317/widget-api/{key}/messages" \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer {newTokenWithoutProfile}" \
       -H "Origin: http://localhost:3001" \
       -d '{"clientId":"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee","body":"Tôi muốn chat ngay không điền form"}'
     ```
* **Tiêu chí Đạt:**
  - Server từ chối xử lý, trả về mã lỗi HTTP 400 `{ "error": "PRECHAT_REQUIRED" }`.
  - Trên WebSocket: server gửi frame `{ "type": "error", "code": "PRECHAT_REQUIRED" }` và không lưu tin nhắn.

---

### Kịch bản 9: Chống Bão DoS (WebSocket Frame Rate Limiting)
* **Thao tác:** Dùng script bắn 8 frame `message:send` liên tục trong 1 giây qua kết nối WebSocket.
* **Tiêu chí Đạt:**
  - 5 frame đầu tiên được chấp nhận và phản hồi ACK.
  - Từ frame thứ 6 trở đi, server chặn lại, không mở transaction DB, trả về frame:
    ```json
    { "type": "error", "code": "RATE_LIMITED", "message": "Bạn đang gửi tin quá nhanh. Vui lòng thử lại sau vài giây." }
    ```
  - Connection pool của PostgreSQL an toàn 100%, không bị quá tải.

---

### Kịch bản 10: Bảo Mật Tuyệt Đối Ghi Chú Nội Bộ (Zero Leakage)
* **Thao tác:**
  1. Trên màn hình Console của Nhân viên (`http://localhost:3001/inbox`), chuyển sang tab **Ghi chú nội bộ** (tab có biểu tượng ổ khóa màu vàng).
  2. Nhập ghi chú: *"Khách này hỏi kỹ thuật, cần cẩn thận báo giá"* và nhấn gửi.
  3. Mở tab Network/WS ở màn hình khách hàng để soi gói tin.
* **Tiêu chí Đạt:**
  - Trên màn hình Widget của khách: Không hề hiển thị dòng ghi chú này.
  - Trong WebSocket stream của khách: **0 byte** dữ liệu chứa nội dung ghi chú bị lọt ra.

---

## 🤖 CHẠY KIỂM THỬ TỰ ĐỘNG BẰNG SCRIPT (AUTOMATED RUNNER)

Bạn có thể chạy toàn bộ kịch bản tích hợp tự động không cần thao tác tay bằng lệnh:

```bash
node backend/scripts/verify_websocket_option_a.cjs
```

* **Kết quả mong đợi:**
  ```text
  ⚡ Visitor WebSocket kết nối thành công (<100ms)
  ⚡ Staff WebSocket kết nối thành công (<100ms)
  🎯 [Visitor -> Staff] Thời gian phản hồi WebSocket ACK: ~1ms
  🎯 [Staff -> Visitor] Thời gian phản hồi WebSocket ACK: ~1ms
  ⚡ Typing Indicator truyền tức thì
  ✅ Tin nhắn của khách trong DB: TỒN TẠI (ID: ..., Seq: ...)
  ✅ Tin nhắn của nhân viên trong DB: TỒN TẠI (ID: ..., Seq: ...)
  🎉 THÀNH CÔNG 100%!
  ```
