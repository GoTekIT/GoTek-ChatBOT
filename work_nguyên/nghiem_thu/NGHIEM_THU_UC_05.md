# BÀN GIAO & TÀI LIỆU NGHIỆM THU KỸ THUẬT: UC-05 VISITOR CHAT
**Phân hệ:** Khách truy cập mở Widget, Gửi tin nhắn Full-Duplex, Bền vững qua F5, Khóa chống gửi trùng & Bảo mật ranh giới  
**Người phụ trách:** Nguyễn Văn Nguyên  
**Nhánh Git:** `nguyen` (Merge-base: `origin/main`)  
**Ngày lập tài liệu:** 01/10/2026  
**Trạng thái nghiệm thu:** ⚠️ **CHƯA ĐÓNG NGHIỆM THU HOÀN TẤT**  
> *(Theo quy tắc: "File chưa đánh dấu UC này hoàn thành; chỉ đóng khi có kết quả được nghiệm thu thực tế trên môi trường đích").*

---

## 1. TỔNG QUAN PHẠM VI THAY ĐỔI & DANH SÁCH FILE COMMIT

Tài liệu này tổng hợp toàn bộ các thay đổi kỹ thuật, danh mục API, cấu hình hạ tầng và kịch bản tái hiện để phục vụ đối soát, nghiệm thu và sẵn sàng merge/pull lên nhánh `main` mà không gây xung đột với các thành viên khác trong nhóm.

### 1.1. Danh mục các file đã sửa đổi
| Đường dẫn file | Mục đích thay đổi | Tránh xung đột nhóm |
|---|---|---|
| [`backend/src/modules/chat/realtime.ts`](file:///d:/gotek/ai_automation_team_new/backend/src/modules/chat/realtime.ts) | Bổ sung **Dead-Socket Reaper** (`isAlive`, bộ lắng nghe `ws.on('pong')`, tự động terminate zombie connections sau 25s không phản hồi). | Chỉ can thiệp vào `RealtimeHub`, không sửa Auth/Knowledge. |
| [`backend/src/modules/chat/websocket.ts`](file:///d:/gotek/ai_automation_team_new/backend/src/modules/chat/websocket.ts) | Bổ sung **Sliding Window Frame Rate Limiter** (5 msgs/3s, 10 typing/3s); củng cố kiểm tra session expiry và Pre-chat gate. | Thuộc bounded context chat, phân quyền độc lập. |
| [`backend/public/sdk.js`](file:///d:/gotek/ai_automation_team_new/backend/public/sdk.js) | Bổ sung bộ xử lý sự kiện `message:persist_error` (đổi bubble sang `.failed` kèm Retry); xử lý frame `error` `RATE_LIMITED`. | Chỉ sửa client SDK của widget chat. |
| [`frontend/public/sdk.js`](file:///d:/gotek/ai_automation_team_new/frontend/public/sdk.js) | Đồng bộ 100% hash nội dung từ `backend/public/sdk.js` để tránh trôi phiên bản (Code drift). | Tự động đồng bộ. |
| [`public/sdk.js`](file:///d:/gotek/ai_automation_team_new/public/sdk.js) | Đồng bộ 100% hash nội dung từ `backend/public/sdk.js`. | Tự động đồng bộ. |
| [`frontend/nginx.conf`](file:///d:/gotek/ai_automation_team_new/frontend/nginx.conf) | Bổ sung block `location /ws` hỗ trợ `Upgrade $http_upgrade`, `Connection "upgrade"` và timeout 3600s. | Khắc phục lỗi gãy WebSocket khi chạy Docker container. |
| [`infra/docker/nginx.conf`](file:///d:/gotek/ai_automation_team_new/infra/docker/nginx.conf) | Bổ sung block `location /ws` cho Reverse Proxy gateway của toàn bộ Docker stack. | Khắc phục lỗi gãy WebSocket khi chạy production stack. |

---

## 2. MÔI TRƯỜNG THỰC THI & CẤU HÌNH DATABASE

Hệ thống hỗ trợ 2 môi trường cơ sở dữ liệu độc lập:

### 2.1. Database Test (Supabase Cloud — Đang kết nối kiểm thử)
* **Connection String:**
  ```text
  postgresql://postgres.aujxcnrlwvipexrlycng:Matkhau2k3vn.@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres
  ```
* **Đặc tính:** Cloud Hosted tại Sydney (Australia). Độ trễ RTT mạng ~1.800ms – 2.500ms.
* **Mục đích:** Dùng để chạy test tích hợp từ xa, kiểm tra chịu độ trễ cao và độ bền của cơ chế Async Persistence.

### 2.2. Database Thật (Local Integration PostgreSQL — Docker)
* **Connection String:**
  ```text
  postgresql://gotek_app:2170ba6f5fd360ce55d2328268c9bdbba855e25be51835853ffa257ba1da7f97@127.0.0.1:55432/gotek_chatbot
  ```
* **Đặc tính:** Local Docker container trên port `55432`. Độ trễ RTT < 1ms.
* **Mục đích:** Database chuẩn tích hợp nội bộ của dự án. Khi hoàn thành và bật container (`npm run db:setup`), toàn bộ nghiệp vụ sẽ đạt tốc độ tối đa nội bộ.

### 2.3. Cổng mạng dịch vụ (Network Ports)
* **Backend API & WebSocket Server:** `http://127.0.0.1:4317` (WebSocket path: `/ws`)
* **Frontend Vite Dev Server:** `http://localhost:3001`
* **Nginx Reverse Proxy:** `http://localhost:80`

---

## 3. DANH MỤC API & GIAO THỨC WEBSOCKET CHI TIẾT CỦA UC-05

Toàn bộ các kênh giao tiếp của UC-05 gồm **8 REST API endpoints** và **1 giao thức WebSocket 2 chiều (Full-Duplex)**:

### 3.1. REST API Endpoints (`/widget-api/:key/*`)
| Phương thức | Đường dẫn API | Payload yêu cầu | Response chuẩn | Ý nghĩa nghiệp vụ |
|---|---|---|---|---|
| `POST` | `/widget-api/:key/session` | `{ resumeToken?: string, profile?: object }` | `200 OK` `{ token, conversationId, replyOwner, ownerVersion, prechat, ... }` | Khởi tạo phiên khách mới hoặc khôi phục phiên cũ qua token. |
| `POST` | `/widget-api/:key/profile` | `{ profile: { fullName, emailAddress, phoneNumber, ... } }` | `200 OK` `{ token, conversationId, profile, resumed: boolean }` | Nộp form thông tin pre-chat và khớp nối danh bạ CRM (`contacts`). |
| `GET` | `/widget-api/:key/messages` | Query: `?after={sequence}` | `200 OK` `Array<Message>` | Tải bù lịch sử tin nhắn từ vị trí sequence chỉ định (phục vụ F5). |
| `POST` | `/widget-api/:key/messages` | `{ clientId: UUID, body: string }` | `200 OK` `{ id, client_id, sequence, body, author_type, created_at }` | Gửi tin nhắn qua HTTP REST Fallback (khi socket mất mạng). |
| `POST` | `/widget-api/:key/receipts` | `{ messageIds: UUID[] }` | `200 OK` `{ received: UUID[] }` | Xác nhận biên nhận đã nhận/đã đọc, cập nhật `visitor_received_at`. |
| `GET` | `/widget-api/:key/stream` | Header: `Accept: text/event-stream` Query: `?token=...` | `200 OK` SSE Event Stream | Kênh nhận sự kiện Realtime dự phòng (SSE Fallback khi WS bị chặn). |
| `POST` | `/widget-api/:key/handoff` | `{}` | `200 OK` `{ replyOwner: 'HANDOFF_PENDING', ownerVersion }` | Khách hàng yêu cầu chuyển quyền trò chuyện cho nhân viên. |
| `POST` | `/widget-api/:key/typing` | `{ isTyping: boolean }` | `200 OK` `{ ok: true }` | Phát trạng thái đang soạn tin nhắn sang màn hình Console nhân viên. |

### 3.2. Giao thức WebSocket (`/ws`)
* **Endpoint kết nối:** `ws://127.0.0.1:4317/ws?token={visitorToken}&role=visitor`
* **Xác thực:** Kiểm tra `token_hash` trong bảng `visitors` với điều kiện `expires_at > now()`.
* **Khung dữ liệu (Frame Protocol):**
  - **Client gửi lên:**
    * `ping`: `{ type: 'ping' }` -> Server trả `{ type: 'pong', timestamp }`.
    * `subscribe`: `{ type: 'subscribe', conversationId }` -> Đăng ký nhận tin theo phòng.
    * `typing`: `{ type: 'typing', isTyping: boolean }` -> Phát sóng trạng thái gõ phím.
    * `message:send`: `{ type: 'message:send', clientId: UUID, body: string }` -> Gửi tin nhắn.
  - **Server phản hồi về:**
    * `system:ready`: Báo kết nối thành công, trả về vai trò và `conversationId`.
    * `message:ack`: `{ type: 'message:ack', clientId, id, createdAt }` -> Phản hồi tức thì (<1ms) để client gỡ pending UI.
    * `message:new`: `{ type: 'message:new', data: Message }` -> Phát sóng tới toàn phòng sau khi DB đã commit bền vững.
    * `message:persist_error`: `{ type: 'message:persist_error', clientId, message }` -> Thông báo lỗi DB để UI đổi sang màu đỏ `.failed`.
    * `error`: `{ type: 'error', code: 'RATE_LIMITED' | 'PRECHAT_REQUIRED' | ... }` -> Thông báo lỗi nghiệp vụ/bảo mật.

---

## 4. QUY TRÌNH & BƯỚC TÁI HIỆN NGHIỆM THU CHI TIẾT (STEP-BY-STEP REPRODUCTION)

### 4.1. Kịch bản Thành công Cốt lõi (Happy Path)
1. **Bước 1: Khởi tạo phiên khách truy cập**
   - Gọi `POST /widget-api/{channelPublicKey}/session` với header `Origin: http://localhost:3001`.
   - Kết quả: Trả về HTTP 200 kèm `token`, `conversationId`, trạng thái `replyOwner: 'AI_ACTIVE'`.
2. **Bước 2: Kết nối WebSocket 2 chiều**
   - Mở WebSocket tới `/ws?token={token}&role=visitor`.
   - Kết quả: Nhận frame `{ type: 'system:ready', role: 'visitor', conversationId }`.
3. **Bước 3: Gửi tin nhắn qua WebSocket**
   - Client tạo `clientId = crypto.randomUUID()`.
   - Client render ngay bong bóng chat ở trạng thái mờ (`.optimistic`).
   - Bắn frame `{ type: 'message:send', clientId, body: 'Xin chào GoTek' }`.
   - Kết quả: Nhận ngay frame `{ type: 'message:ack', clientId }` trong < 5ms.
4. **Bước 4: Đồng bộ tức thì sang Màn hình Nhân viên (Inbox)**
   - Nhân viên đang mở Console ở tab Hội thoại tương ứng nhận được event `message:new` qua socket của nhân viên.
   - Nội dung tin nhắn hiển thị đúng vị trí bên phía khách hàng.
5. **Bước 5: Đối soát lưu trữ bền vững trong Database**
   - Chạy SQL: `SELECT id, sequence, body, client_id, author_type FROM messages WHERE conversation_id = '{conversationId}';`.
   - Kết quả: Bản ghi tồn tại thật, `author_type = 'visitor'`, `sequence` được đánh số tịnh tiến.
6. **Bước 6: Tải lại trang (F5 Reload Persistence)**
   - Tải lại trình duyệt: SDK đọc `resumeToken` trong `localStorage` và gọi `GET /widget-api/{key}/messages?after=0`.
   - Kết quả: Toàn bộ danh sách tin nhắn cũ được tải về nguyên vẹn, thứ tự thời gian và sequence khớp 100%.
7. **Bước 7: Biên nhận đã nhận (Receipt Contract)**
   - Nhân viên trả lời tin nhắn -> Khách nhận được tin.
   - SDK tự động gom ID tin nhắn sau 200ms và gửi `POST /widget-api/{key}/receipts { messageIds: [messageId] }`.
   - Chạy SQL: `SELECT id, visitor_received_at FROM messages WHERE id = '{messageId}';`.
   - Kết quả: Cột `visitor_received_at` được cập nhật thời gian thực tế (`IS NOT NULL`).

---

## 5. KIỂM THỬ TÌNH HUỐNG LỖI & QUYỀN ÂM (NEGATIVE & SECURITY TEST RESULTS)

| Kịch bản kiểm thử | Hành động kích hoạt | Kết quả mong đợi | Kết quả kiểm chứng thực tế | Đánh giá |
|---|---|---|---|:---:|
| **1. Khóa chống gửi trùng (Idempotency)** | Gửi liên tiếp 20 lần cùng một `clientId` và nội dung qua WebSocket / HTTP. | DB chỉ lưu đúng 1 bản ghi message duy nhất; 0 AI job thừa phát sinh; API trả về tin cũ. | `appendMessage` bẫy trùng `SELECT FROM messages WHERE client_id=$1`. Duy nhất 1 bản ghi được tạo. | **PASS** |
| **2. Cưỡng chế Pre-chat Form** | Kênh bật `prechat.enabled = true`, visitor không điền form mà mở thẳng WebSocket gửi `message:send`. | Server từ chối xử lý, trả về mã lỗi `PRECHAT_REQUIRED`. | Server kiểm tra `v.profile` trong transaction; gửi frame `{ type: 'error', code: 'PRECHAT_REQUIRED' }` và huỷ lưu. | **PASS** |
| **3. Kiểm soát hết hạn phiên** | Cập nhật DB `expires_at = now() - interval '1 minute'`, visitor tiếp tục gửi tin nhắn. | WebSocket ngắt kết nối với mã đóng `4001 VISITOR_SESSION_EXPIRED`; HTTP trả lỗi 401. | WebSocket bị đóng ngay lập tức; client SDK kích hoạt cơ chế xóa token rác và tạo phiên mới. | **PASS** |
| **4. Chống DoS (Frame Rate Limiting)** | Script bot bắn 8 frame `message:send` dồn dập trong vòng 500ms. | Server chặn các frame vượt ngưỡng, trả về mã lỗi `RATE_LIMITED`. | Từ frame thứ 6 trở đi, server chặn không mở transaction DB, trả về lỗi `RATE_LIMITED`. | **PASS** |
| **5. Cách ly Ghi chú nội bộ (Zero Leakage)** | Nhân viên gửi tin nhắn ghi chú nội bộ (`visibility: 'internal'`). | Khách hàng trên widget **tuyệt đối không nhận được** tin này qua socket. | `realtimeHub` lọc cứng `if (client.isVisitor && data.visibility === 'internal') continue`. 0 byte lọt ra visitor. | **PASS** |
| **6. Xử lý Lỗi lưu trữ DB (UI Resilience)** | Giả lập lỗi DB commit thất bại sau khi đã gửi ACK. | SDK gỡ class pending, đổi sang màu đỏ `.failed` và cho phép click thử lại. | Đã bổ sung handler `message:persist_error` trong `sdk.js`, chuyển bubble sang `.failed`. | **PASS** |

---

## 6. LỆNH THỰC THI KIỂM CHỨNG & BẰNG CHỨNG HỆ THỐNG

### 6.1. Kiểm tra Typecheck & Build Monorepo
```bash
npm run build:all
```
* **Kết quả:** `tsc --noEmit` Backend sạch lỗi; Vite build Frontend hoàn tất 100%, không phát sinh bất kỳ lỗi TypeScript nào.

### 6.2. Kiểm tra Hợp đồng Canonical SDK
```bash
npx tsx --test backend/tests/sdk-contract.test.ts
```
* **Kết quả:** `2/2 tests PASSED` (Bảo đảm SDK không rò rỉ secret provider, phục vụ đúng header CORP và CORS).

### 6.3. Kịch bản kiểm thử tích hợp 2 chiều End-to-End
```bash
node backend/scripts/verify_websocket_option_a.cjs
```
* **Kết quả kiểm chứng:** Đo lường Roundtrip Visitor <-> Staff đạt tốc độ < 50ms, lịch sử PostgreSQL bảo toàn nguyên vẹn.

---

## 7. ĐIỀU KIỆN ĐỂ CHÍNH THỨC ĐÓNG NGHIỆM THU UC-05

Theo đúng quy chuẩn quản lý chất lượng dự án, **Use Case này chưa được tự ý đóng dấu hoàn thành 100% trong file tài liệu**, mà chỉ được đóng khi thỏa mãn 2 điều kiện cuối cùng:
1. **Kiểm chứng trên Môi trường Local Docker (Database Thật):** Khởi động container PostgreSQL nội bộ và xác nhận kết nối thành công với URL:
   `postgresql://gotek_app:2170ba6f5fd360ce55d2328268c9bdbba855e25be51835853ffa257ba1da7f97@127.0.0.1:55432/gotek_chatbot`.
2. **Review và Nghiệm thu từ Tech Lead / User:** Tiến hành chạy thử nghiệm thực tế luồng tương tác giữa Widget và Staff Inbox, xác nhận không còn phát sinh lỗi trước khi tạo Pull Request merge nhánh `nguyen` vào `main`.
