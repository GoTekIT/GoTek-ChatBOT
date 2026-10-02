# BÁO CÁO ĐÁNH GIÁ THỰC TẾ DƯỚI GÓC NHÌN SENIOR PRO MAX & TECH LEAD KHÓ TÍNH
**Đối tượng đánh giá:** Toàn bộ thiết kế, mã nguồn và kế hoạch triển khai 4 Use Cases (UC-19, UC-05, UC-21, UC-06)  
**Tác giả đánh giá:** Tech Lead / Principal Systems Architect  
**Thang điểm:** 10 điểm cho từng tiêu chí đánh giá năng lực Production-Ready  
**Kết luận tổng quan:** **6.7 / 10** — Đạt yêu cầu Demo/Prototype nhanh, **CHƯA ĐỦ ĐIỀU KIỆN ĐƯA VÀO PRODUCTION DO CÒN 6 KẼ HỞ NGHIÊM TRỌNG**.

---

## 1. BẢNG ĐIỂM ĐÁNH GIÁ TOÀN DIỆN (SCORECARD)

| Hạng mục đánh giá | Điểm số | Trạng thái | Đánh giá tóm tắt từ Tech Lead |
|---|:---:|:---:|---|
| **1. Kiến trúc Clean Architecture & Phân lớp** | **7.5 / 10** | Khá | Tách biệt DTO và Route tốt. Tuy nhiên Controller còn ôm đồm nghiệp vụ database (Business logic rò rỉ vào Controller và WebSocket handler). |
| **2. Concurrency, Race Condition & Idempotency** | **7.0 / 10** | Khá | Có Unique constraint chống trùng. Nhưng chưa xử lý Race condition tăng `sequence` và retry cùng `clientId` có nguy cơ trả lỗi 500 thay vì 200 OK. |
| **3. Bảo mật, RLS & Cách ly Multi-tenant** | **6.5 / 10** | Trung bình | Có RLS ở Postgres. **Điểm trừ nặng:** WebSocket broadcast tin nhắn nội bộ (Internal Note) vào room chung, dựa vào Frontend để giấu là sai lầm bảo mật chết người! |
| **4. Chịu tải, Realtime & Webhook Pipeline** | **6.0 / 10** | Dưới chuẩn | Chưa có Message Queue/Outbox đệm khi Meta gửi bão Webhook. Xử lý webhook đồng bộ dễ bị Meta coi là timeout (>5s) dẫn đến retry storm làm sập server. |
| **5. Trải nghiệm Vận hành UI/UX & Resiliency** | **7.0 / 10** | Khá | Shimmer loading mượt, UI sạch sẽ. Thiếu cơ chế Draft phục hồi khi gập máy tính và chưa cảnh báo trực quan vi phạm Chính sách 24h của Meta. |
| **6. Khả năng Kiểm thử & Nghiệm thu (QA Gate)** | **6.0 / 10** | Cảnh báo | Mới chỉ test luồng thành công (Happy Path). Thiếu toàn bộ Negative Test: giả mạo chữ ký Meta, mất mạng giữa chừng, tấn công replay, đụng độ sequence. |
| **TỔNG ĐIỂM TRUNG BÌNH** | **6.7 / 10** | **CẦN SỬA LỖI TRƯỚC DEMO** | **Cần xử lý dứt điểm 6 điểm nghẽn bên dưới để đạt chuẩn 9.5/10 trước 09/10/2026.** |

---

## 2. CHỈ TRÍCH TỈ MỈ 6 LỖ HỔNG & THIẾU SÓT "CHẾT NGƯỜI" (CRITICAL AUDIT FINDINGS)

### LỖ HỔNG 1: "Optimistic WebSocket Broadcast" tạo ra Phantom Messages (Tin nhắn ma)
* **Vị trí phát hiện:** `backend/src/modules/chat/websocket.ts` dòng 94–120.
* **Thực trạng code:** Server phát ngay sự kiện `realtimeHub.broadcastToConversation(convId, 'message:new', immediateMessage)` trước khi câu lệnh `appendMessage(db, ...)` hoàn tất ghi vào đĩa cứng.
* **Hậu quả khi chạy thực tế:**
  - Nếu kết nối database bị giật (Database pool timeout) hoặc transaction gặp lỗi rollback: Người gửi và người nhận trên màn hình **đều thấy tin nhắn đã gửi đi** (ảo ảnh latency < 2ms).
  - Nhưng khi F5 tải lại trang: **Tin nhắn biến mất hoàn toàn** vì DB chưa từng lưu!
  - Khách hàng nghĩ nhân viên đã nhận được hỗ trợ, nhân viên tưởng đã trả lời xong -> Gây khiếu nại nghiêm trọng.
* **Yêu cầu khắc phục chuẩn Senior:**
  - Client chỉ hiển thị Optimistic ở phía Local UI với trạng thái `pending`.
  - Server **chỉ được phép broadcast** sự kiện `message:new` ra ngoài sau khi Database Transaction đã `COMMIT` thành công 100%.

---

### LỖ HỔNG 2: Rò rỉ Dữ liệu Private Note qua WebSocket Stream (Nghiêm trọng về Security)
* **Vị trí phát hiện:** `backend/src/modules/chat/inbox.ts` và `websocket.ts`.
* **Thực trạng code:** Khi Agent gửi một ghi chú nội bộ (`visibility: 'internal'`), hàm `broadcastToConversation(convId, ...)` đẩy sự kiện tới toàn bộ subscriber của `convId`. Trong khi đó, Visitor trên Widget cũng đang subscribe vào chính `convId` này! SDK ở frontend chỉ dùng lệnh `if (msg.visibility !== 'internal')` để ẩn đi.
* **Hậu quả khi chạy thực tế:**
  - Bất kỳ một người dùng nào có chút kiến thức kỹ thuật chỉ cần: F12 -> Mở tab **Network** -> Chọn filter **WS** (WebSocket) -> Xem tab **Messages**.
  - Họ sẽ đọc được toàn bộ các đoạn chat riêng tư của nhân viên: *"Khách này mặc cả quá, đừng giảm giá"*, *"Khách này có dấu hiệu lừa đảo"*, v.v.
  - **Đây là lỗi bảo mật rò rỉ dữ liệu mức độ P0 (Critical Vulnerability)!**
* **Yêu cầu khắc phục chuẩn Senior:**
  - Tách bạch tuyệt đối Room: Visitor chỉ được join vào `room:visitor:${convId}` (chỉ nhận tin public).
  - Nhân viên join vào `room:staff:${workspaceId}`.
  - Khi tin nhắn có `visibility === 'internal'`, server **cấm tuyệt đối** không được đẩy vào bất kỳ kênh socket nào mà Visitor đang kết nối!

---

### LỖ HỔNG 3: Bão Webhook (Webhook Storm) & Vòng lặp Echo Vô tận (Infinite Echo Loop)
* **Vị trí phát hiện:** Xử lý Webhook Facebook Messenger (UC-21).
* **Thực trạng code:** Xử lý webhook trực tiếp đồng bộ trong request HTTP POST từ Meta.
* **Hậu quả khi chạy thực tế:**
  - Meta có timeout cực gắt (thường từ 3–5 giây). Nếu lúc đó database đang bận hoặc mạng trễ, endpoint trả lời sau 5 giây -> Meta coi là thất bại và tự động retry liên tục (Webhook Storm), làm sập server.
  - **Vấn đề Echo:** Khi Agent từ GoTek Inbox trả lời tin nhắn tới khách Facebook qua Graph API -> Meta sẽ tự động bắn ngược lại 1 Webhook event chứa chính tin nhắn đó với cờ `is_echo: true`. Nếu code không bóc tách và lọc bỏ `is_echo`, hệ thống sẽ coi đó là một tin nhắn mới từ khách hàng -> lại kích hoạt AI trả lời -> AI trả lời lại sinh ra echo -> **Vòng lặp vô tận đốt sạch hạn ngạch Token OpenAI/Claude và gây spam khách hàng!**
* **Yêu cầu khắc phục chuẩn Senior:**
  - Áp dụng triệt để **Inbound Webhook Outbox Pattern**: Nhận webhook -> Validate HMAC -> Ghi raw payload vào bảng tạm -> Trả 200 OK ngay trong vòng 200ms -> Background Worker mới bốc tách xử lý.
  - Lọc cứng: `if (entry.messaging[0].message?.is_echo) return;`.

---

### LỖ HỔNG 4: Race Condition khi gán `next_sequence` trong bảng `conversations`
* **Vị trí phát hiện:** Bảng `conversations` và logic `appendMessage`.
* **Thực trạng code:** Trường `next_sequence` được đọc ra rồi cộng 1 để gán cho tin nhắn mới, với ràng buộc `UNIQUE(workspace_id, conversation_id, sequence)`.
* **Hậu quả khi chạy thực tế:**
  - Khi 2 sự kiện xảy ra đồng thời (ví dụ: Visitor vừa gửi tin thì Agent cũng bấm gửi, hoặc AI vừa emit stream): Cả 2 transaction cùng đọc được `next_sequence = 5`. Cả 2 cùng cố insert `sequence = 5`.
  - Một transaction sẽ bị văng lỗi Postgres `23505 (unique_violation)` và trả về HTTP 500 lỗi hệ thống!
* **Yêu cầu khắc phục chuẩn Senior:**
  - Phải có khóa bi quan: `SELECT next_sequence FROM conversations WHERE id = $1 FOR UPDATE`.
  - Hoặc dùng cú pháp nguyên tử: `UPDATE conversations SET next_sequence = next_sequence + 1 WHERE id = $1 RETURNING next_sequence - 1`.

---

### LỖ HỔNG 5: Vi phạm Chính sách Cửa sổ Tin nhắn 24h của Meta (24-Hour Messaging Window)
* **Vị trí phát hiện:** Nghiệp vụ Agent trả lời tin nhắn Messenger (UC-06 + UC-21).
* **Thực trạng code:** Chưa có kiểm tra thời gian giữa lần tương tác cuối của khách và thời điểm Agent nhắn tin.
* **Hậu quả khi chạy thực tế:**
  - Theo chính sách của Meta, Doanh nghiệp chỉ được phép nhắn tin lại cho khách hàng trong vòng **24 giờ** kể từ tin nhắn cuối cùng của khách.
  - Nếu sau 24h, Agent cố tình gửi tin public thông thường, Meta Graph API sẽ trả về lỗi `(#10) This message is outside the allowed window`.
  - Nếu không có UI cảnh báo, Agent cứ bấm gửi và thấy báo lỗi mà không hiểu lý do vì sao, dẫn đến bế tắc vận hành.
* **Yêu cầu khắc phục chuẩn Senior:**
  - Ở màn hình Inbox, nếu hội thoại đến từ kênh Messenger và `now() - last_visitor_message > 24 hours`:
    - Hiển thị banner cảnh báo: *"Đã quá 24h kể từ tương tác cuối của khách. Tin nhắn có thể bị Meta từ chối nếu không dùng Message Tag."*
    - Cung cấp tùy chọn Message Tag (ví dụ: `POST_PURCHASE_UPDATE`, `CONFIRMED_EVENT_UPDATE`, `ACCOUNT_UPDATE`).

---

### LỖ HỔNG 6: Tải bù lịch sử (Backfill) dễ bị mất tin nhắn nếu dùng Cursor sai
* **Vị trí phát hiện:** `GET /api/inbox/conversations/:id/messages?after={cursor}`.
* **Thực trạng code:** Sử dụng `sequence > cursor` với `LIMIT 100`.
* **Hậu quả khi chạy thực tế:**
  - Khi Agent bị mất mạng 1 tiếng, khách hàng nhắn liên tục 150 tin nhắn.
  - Khi kết nối lại, API chỉ trả về 100 tin đầu tiên (`LIMIT 100`). Nếu Frontend chỉ cập nhật `lastSequence` theo tin thứ 100 mà không kiểm tra còn tin tiếp theo hay không (`has_more`), thì 50 tin nhắn mới nhất sẽ **bị bỏ rơi vĩnh viễn** cho đến khi Agent nhấn F5 tải lại toàn bộ trang.
* **Yêu cầu khắc phục chuẩn Senior:**
  - Endpoint backfill phải trả về cấu trúc phân trang chuẩn: `{ items: Message[], hasMore: boolean, nextCursor: number }`.
  - Client tự động fetch vòng lặp (while `hasMore`) cho đến khi đồng bộ hoàn toàn với dữ liệu thực tế trên máy chủ.

---

## 3. LỘ TRÌNH NÂNG CẤP ĐẠT ĐIỂM 9.5+/10 TRƯỚC NGÀY 09/10/2026

1. **Ngày 01–02/10:** Hoàn thiện dứt điểm UC-19 và vá ngay lỗ hổng **Zero-Leakage cho Private Note** trong `realtime.ts`. Đảm bảo không 1 byte dữ liệu nội bộ nào lọt ra socket của visitor.
2. **Ngày 03/10:** Chuẩn hóa logic **Idempotency** của `appendMessage`: Khi trùng `client_id`, truy vấn bản ghi cũ trả về 200 OK thay vì để Postgres văng lỗi 500.
3. **Ngày 04–05/10:** Triển khai **Inbound Webhook Outbox** cho Facebook Messenger. Thêm unit test kiểm tra lọc bỏ `is_echo` và kiểm tra chữ ký HMAC `timingSafeEqual`.
4. **Ngày 06–07/10:** Nâng cấp **Thanh soạn thảo Inbox (DualModeComposer)** với đầy đủ trạng thái Pending, Error retry, và cảnh báo vi phạm cửa sổ 24h của Meta.
5. **Ngày 08–09/10:** Chạy kiểm thử chéo (Cross-Testing) và giả lập tải:
   - Dùng script bắn 100 tin nhắn đồng thời vào 1 hội thoại.
   - Kiểm tra toàn vẹn `sequence`, không đụng độ, không mất mát tin nhắn.
   - Xuất trọn bộ **Evidence Pack (Ảnh chụp màn hình, Video quay luồng thật, Test run report 100% pass)** để nghiệm thu với Leader.
