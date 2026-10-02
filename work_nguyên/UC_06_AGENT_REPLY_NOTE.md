# UC-06: AGENT ĐỌC INBOX, TRẢ LỜI PUBLIC VÀ GHI NOTE NỘI BỘ
**Người phụ trách trọn gói:** Nguyễn Văn Nguyên  
**Mức ưu tiên:** P0 Core Inbox • **Công chuẩn:** 1.5 ngày  
**Lịch giao việc rút ngắn:** **05–06/10/2026** (Hoàn thành trước chiều 06/10)  
**Phụ thuộc:** UC-05 (Visitor Chat), UC-03 (Tenant/Channel Access Control).

---

## PHẦN 1: MỤC TIÊU NGHIỆP VỤ & ĐIỀU KIỆN NGHIỆM THU (ACCEPTANCE CRITERIA)

### 1.1. Yêu cầu thành công cần chứng minh (Happy Path)
1. **Trả lời công khai (Public Reply):** Nhân viên nhập câu trả lời, khách hàng (qua Widget hoặc Messenger) nhận được tin nhắn tức thì.
2. **Ghi chú nội bộ (Private / Internal Note):** Nhân viên có thể ghi chú riêng tư (ví dụ: trao đổi giá trị đơn hàng, lưu ý về khách) mà chỉ các nhân viên khác trong cùng workspace đọc được.
3. **UI tải lại dữ liệu thật:** Khi F5 hoặc mở lại hội thoại, các tin nhắn công khai và tin nhắn nội bộ hiển thị đầy đủ, phân biệt rõ màu sắc và vai trò.

### 1.2. Tình huống lỗi & Kiểm quyền âm bắt buộc (Negative & Security Tests)
1. **Bảo mật tuyệt đối Zero-Leakage:**
   - **Tuyệt đối không** để lộ nội dung Private Note ở Widget của khách hàng hoặc trên luồng phát Realtime (WebSocket / SSE stream).
   - Truy vấn API của Widget (`/widget-api/...`) phải luôn cưỡng chế điều kiện `AND visibility = 'public'`.
2. **Xử lý thất bại trung thực (Error Transparency):** Khi gửi tin nhắn thất bại (do mất mạng, token hết hạn, vi phạm chính sách Meta), giao diện **tuyệt đối không được** báo "Đã gửi (Sent)" hay giấu nhẹm lỗi. Phải giữ nguyên nội dung trong ô nhập kèm nút "Thử lại (Retry)".
3. **Đồng bộ tải bù khi Reconnect (Backfill without Duplicates):** Khi Agent bị mất mạng rồi kết nối lại, hệ thống tự động tải bù các tin nhắn bị thiếu mà **không làm nhân đôi** các tin nhắn đã có trên màn hình.

---

## PHẦN 2: KẾ HOẠCH TRIỂN KHAI CHI TIẾT TỪNG BƯỚC (WBS)

### Bước 1: Bảo mật mức Database & Query Isolation (0.25 ngày)
- [ ] Rà soát ràng buộc bảng `messages`:
  - Đảm bảo có ràng buộc: `CHECK(visibility<>'internal' OR author_type='agent')`.
- [ ] Kiểm toán toàn bộ câu truy vấn dành cho Widget API:
  - Hàm `widgetMessages` trong `backend/src/modules/widget/widget.ts` bắt buộc phải có mệnh đề:
    `WHERE conversation_id = $1 AND visibility = 'public'`.

### Bước 2: Tái cấu trúc Realtime Hub thành Zero-Leakage (0.5 ngày)
- [ ] Cập nhật `backend/src/modules/chat/realtime.ts` & `websocket.ts`:
  - **Phân tách Room rõ rệt:**
    - Visitor chỉ được join vào room: `room:conversation:${convId}:public`.
    - Nhân viên join vào room: `room:workspace:${workspaceId}:staff`.
  - Khi Agent gửi tin nhắn `visibility === 'internal'`:
    - CHỈ phát sự kiện tới `room:workspace:${workspaceId}:staff`.
    - **CHẶN ĐỨNG 100% không phát bất kỳ byte dữ liệu nào tới các kết nối của Visitor!**

### Bước 3: Nâng cấp Thanh soạn thảo Dual-Mode & Optimistic UI (0.5 ngày)
- [ ] Cập nhật `frontend/src/components/inbox/InboxView.tsx`:
  - Bổ sung thanh chuyển đổi 2 chế độ:
    - **Chế độ Trả lời công khai (Public Reply):** Nền trắng, viền xanh, icon Quả địa cầu 🌐.
    - **Chế độ Ghi chú nội bộ (Private Note):** Nền vàng nhạt `#FEFCE8`, viền vàng hổ phách `#F59E0B`, icon Ổ khóa 🔒, chữ cảnh báo "Chỉ nhân viên trong workspace đọc được".
  - **Trạng thái gửi tin nhắn:**
    - Bấm gửi -> Thêm tin nhắn tạm vào danh sách với trạng thái `pending` (icon xoay tròn).
    - Thành công -> Cập nhật trạng thái `sent`.
    - Thất bại -> Giữ nguyên nội dung, chuyển sang màu đỏ kèm nút `Thử lại (Retry)`.
- [ ] Bổ sung cơ chế **Tải bù lịch sử (Backfill)**:
  - Khi sự kiện `window.addEventListener('online')` kích hoạt, gọi API `/api/inbox/conversations/:id/messages?after=${lastSequence}` để nạp các tin mới sinh ra trong thời gian rớt mạng.

### Bước 4: Kiểm thử tự động & Bàn giao Evidence (0.25 ngày)
- [ ] Viết test `backend/tests/uc06-private-note-leak.test.ts`:
  - Test 1: Mở socket giả lập của Visitor và socket của Agent. Agent gửi tin `visibility = 'internal'`. Khẳng định: Socket của Visitor không nhận được bất kỳ frame nào!
  - Test 2: Gọi API `/widget-api/:token/messages` -> Khẳng định không có tin nhắn nào có `visibility = 'internal'` xuất hiện trong mảng trả về.
  - Test 3: Test Reconnect với 10 tin nhắn mới -> Khẳng định tin nhắn được ghép mượt mà, không bị nhân đôi ID.
- [ ] Chụp ảnh evidence: Màn hình Agent thấy Note vàng; Màn hình Visitor hoàn toàn không thấy Note.

---

## PHẦN 3: ĐÁNH GIÁ CHUYÊN SÂU DƯỚI GÓC NHÌN SENIOR PRO MAX & LEADER KHÓ TÍNH

### BẢNG CHẤM ĐIỂM TIÊU CHUẨN (THANG ĐIỂM 10)

| Tiêu chí kỹ thuật | Điểm | Đánh giá từ Tech Lead |
|---|:---:|---|
| **1. Bảo mật Zero-Leakage** | **8.5 / 10** | Tách biệt hoàn toàn room ở mức Socket Server là giải pháp triệt để, không còn rủi ro khách hàng mở DevTools WS để xem trộm ghi chú nội bộ. |
| **2. Độ tin cậy truyền tin (Message Delivery)** | **7.5 / 10** | Trạng thái Pending/Error và nút Retry giúp nhân viên nắm rõ tình trạng tin nhắn, không bị ảo tưởng là đã gửi thành công khi mất mạng. |
| **3. Xử lý Đa nền tảng (Messenger 24h Window)** | **6.5 / 10** | **Điểm trừ:** Chưa xử lý cảnh báo Cửa sổ 24 giờ của Facebook. Nếu khách nhắn từ hôm qua, hôm nay Agent vào trả lời sẽ bị Facebook từ chối ngầm. |
| **4. Đồng bộ dữ liệu khi Reconnect (Backfill)** | **7.5 / 10** | Sử dụng cursor sequence và Set Map dedup ở Frontend hoạt động ổn định. Cần bổ sung cờ `hasMore` nếu số lượng tin nhắn bù vượt quá limit 100. |
| **ĐIỂM TRUNG BÌNH UC-06** | **7.5 / 10** | **MỨC KHÁ TỐT — BẮT BUỘC BỔ SUNG CẢNH BÁO CỬA SỔ 24H CHO KÊNH MESSENGER.** |

---

### PHÂN TÍCH TỈ MỈ CÁC THIẾU SÓT & LỖ HỔNG CẦN KHẮC PHỤC NGAY

#### 1. Lỗ hổng Chết người: Lọc Note ở Client-side thay vì Server-side
* **Vấn đề phát hiện:** Trước khi sửa đổi, hàm `broadcastToConversation(convId, 'message:new', msg)` gửi toàn bộ tin nhắn nội bộ tới tất cả ai đang mở conversation đó. Phía SDK chỉ dùng `if (msg.visibility !== 'internal')` để không vẽ lên DOM.
* **Hậu quả thực tế:** Đây là "Security through Obscurity" (Bảo mật bằng cách che giấu giả tạo). Bất kỳ ai mở `Inspect Element -> Network -> WS` đều thấy nguyên văn JSON của các tin nhắn nhạy cảm. Đây là lỗi bảo mật nghiêm trọng không thể nghiệm thu.
* **Giải pháp chuẩn Senior:**
  - Cắt đứt luồng phát ngay tại Server: `if (msg.visibility === 'internal')` thì **chỉ duyệt qua danh sách kết nối của Staff** có quyền truy cập workspace đó.

#### 2. Vi phạm Chính sách Cửa sổ Tin nhắn 24 Giờ của Meta
* **Vấn đề phát hiện:** Facebook quy định rất nghiêm ngặt: Doanh nghiệp chỉ được nhắn tin cho khách trong vòng **24 giờ** kể từ tin nhắn cuối cùng của khách. Sau 24h, Graph API sẽ từ chối gửi tin nhắn thường (`(#10) This message is outside the allowed window`).
* **Hậu quả thực tế:** Agent soạn tin nhắn rất dài trả lời khách, bấm Gửi, hệ thống báo lỗi không gửi được mà Agent không hiểu lý do tại sao, gây ức chế và đình trệ vận hành.
* **Giải pháp chuẩn Senior:**
  - Trên màn hình Inbox, nếu là hội thoại Messenger và `Date.now() - lastCustomerMessageTime > 24 * 60 * 60 * 1000`:
    - Hiển thị banner màu vàng cảnh báo: *"Đã quá 24h kể từ tin nhắn cuối của khách. Bắt buộc phải gắn Message Tag hợp lệ để gửi tin."*
    - Bổ sung dropdown chọn Message Tag: `POST_PURCHASE_UPDATE` (Cập nhật sau mua hàng), `CONFIRMED_EVENT_UPDATE` (Cập nhật sự kiện), `ACCOUNT_UPDATE` (Cập nhật tài khoản).

---

## PHẦN 4: MÃ NGUỒN MẪU HOÀN CHỈNH CHO UC-06

### 4.1. Server Realtime Hub Zero-Leakage: `backend/src/modules/chat/realtime.ts`
```typescript
import { WebSocket } from 'ws';

export interface ClientConn {
  ws: WebSocket;
  workspaceId: string;
  userId?: string;
  isVisitor: boolean;
  activeConversationId?: string;
}

class ZeroLeakageRealtimeHub {
  private connections: Set<ClientConn> = new Set();

  public register(conn: ClientConn) {
    this.connections.add(conn);
    conn.ws.on('close', () => this.connections.delete(conn));
  }

  /**
   * Phát tin nhắn trong phòng hội thoại
   * BẢO MẬT ZERO-LEAKAGE: Chặn đứng tin nhắn internal không cho Visitor nhận
   */
  public broadcastMessage(conversationId: string, workspaceId: string, message: any) {
    const isInternal = message.visibility === 'internal';
    const payload = JSON.stringify({ type: 'message:new', data: message });

    for (const client of this.connections) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;

      // 1. Nếu là tin nội bộ: CHỈ GỬI CHO NHÂN VIÊN TRONG WORKSPACE
      if (isInternal) {
        if (!client.isVisitor && client.workspaceId === workspaceId && client.activeConversationId === conversationId) {
          client.ws.send(payload);
        }
        continue;
      }

      // 2. Nếu là tin công khai: Gửi cho cả Visitor và Nhân viên trong phòng
      if (client.activeConversationId === conversationId) {
        client.ws.send(payload);
      }
    }
  }
}

export const realtimeHub = new ZeroLeakageRealtimeHub();
```
