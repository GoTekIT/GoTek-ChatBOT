# UC-21: KHÁCH NHẮN MESSENGER VÀ AGENT NHẬN ĐÚNG HỘI THOẠI TRONG INBOX
**Người phụ trách trọn gói:** Nguyễn Văn Nguyên  
**Mức ưu tiên:** P0 Đa nền tảng • **Công chuẩn:** 2.5 ngày  
**Lịch giao việc rút ngắn:** **04–05/10/2026** (Hoàn thành trước chiều 05/10)  
**Phụ thuộc:** UC-19 (Kênh đa nền tảng), UC-20 (Kết nối Facebook Page).

---

## PHẦN 1: MỤC TIÊU NGHIỆP VỤ & ĐIỀU KIỆN NGHIỆM THU (ACCEPTANCE CRITERIA)

### 1.1. Yêu cầu thành công cần chứng minh (Happy Path)
1. **Tiếp nhận Webhook bền vững (Durable Ingestion):** Nhận Webhook từ Facebook Meta gửi về, lưu bền vững vào bảng tạm (Inbound Event Outbox) trước khi xử lý, đảm bảo không bao giờ bị mất tin nhắn khi server bận.
2. **Ánh xạ Page & Danh tính chuẩn xác:**
   - Ánh xạ đúng Facebook Page ID về Workspace và Channel tương ứng.
   - Ánh xạ đúng PSID (Page-Scoped ID) của người gửi thành Visitor trong hệ thống.
3. **Hiển thị trực quan trên Inbox:** Hội thoại xuất hiện trên giao diện Inbox của Agent với nhãn nhận diện **Messenger (Facebook Blue #0084FF)**, hiển thị tên và avatar của khách hàng.
4. **Đồng bộ Realtime:** Agent đang mở màn hình Inbox nhìn thấy tin nhắn nhảy vào tức thì mà không cần nhấn F5.

### 1.2. Tình huống lỗi & Kiểm quyền âm bắt buộc (Negative & Security Tests)
1. **Xác thực chữ ký HMAC-SHA256:** Request không có chữ ký hoặc chữ ký không khớp với `FB_APP_SECRET` phải bị từ chối với HTTP 401 ngay lập tức. Tuyệt đối không lưu dữ liệu rác vào database.
2. **Page không đăng ký:** Nếu Page ID gửi về không thuộc bất kỳ kênh nào trong hệ thống, từ chối và ghi log cảnh báo, không sinh ra conversation mồ côi.
3. **Chống lặp Event (Idempotency chống Replay):** Meta thường gửi lại cùng một event `mid` nhiều lần khi mạng lag. Hệ thống phải đảm bảo không bao giờ sinh ra 2 tin nhắn hoặc 2 conversation trùng lặp.
4. **Bỏ qua Echo & Delivery/Read Receipt:**
   - Tin nhắn do chính Page gửi đi (`message.is_echo = true`) **tuyệt đối không** được biến thành tin nhắn mới từ khách.
   - Các event xác nhận đã đọc (`read`) hoặc đã nhận (`delivery`) phải được xử lý riêng, không tạo hội thoại mới.
5. **Không gộp khách hàng bừa bãi:** Tuyệt đối không tự ý gộp khách hàng Messenger với khách hàng Website chỉ vì trùng tên hiển thị ("Nguyễn Văn A") hoặc trùng địa chỉ email chưa được xác minh.

---

## PHẦN 2: KẾ HOẠCH TRIỂN KHAI CHI TIẾT TỪNG BƯỚC (WBS)

### Bước 1: Database Inbound Webhook Outbox (0.5 ngày)
- [ ] Tạo file migration `backend/db/migrations/060_facebook_webhook_pipeline.sql`:
  - Tạo bảng `inbound_webhook_events`:
    - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
    - `provider text NOT NULL DEFAULT 'facebook'`
    - `event_id text NOT NULL UNIQUE` (Lưu Meta `message.mid`)
    - `page_id text NOT NULL`
    - `sender_id text NOT NULL` (PSID)
    - `raw_payload jsonb NOT NULL`
    - `status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processed', 'failed', 'ignored'))`
    - `error_message text`
    - `created_at timestamptz NOT NULL DEFAULT now()`
    - `processed_at timestamptz`
  - Đánh index: `CREATE INDEX idx_inbound_events_status ON inbound_webhook_events(status, created_at);`.

### Bước 2: Webhook Controller & HMAC Verification (0.5 ngày)
- [ ] Viết `backend/src/modules/channels/messenger-webhook.controller.ts`:
  - **GET `/api/webhooks/facebook`**: Xác thực webhook với Meta (`hub.mode === 'subscribe'`, `hub.verify_token`).
  - **POST `/api/webhooks/facebook`**:
    - Đọc raw body và header `x-hub-signature-256`.
    - Dùng `crypto.timingSafeEqual` đối soát chữ ký HMAC-SHA256 với `FB_APP_SECRET`.
    - Phản hồi HTTP 200 OK ngay trong < 300ms.
    - Đẩy payload vào hàng đợi Inbound Processor.

### Bước 3: Inbound Message Processor Service (0.75 ngày)
- [ ] Viết `backend/src/modules/channels/messenger-inbound.service.ts`:
  - **Bộ lọc an toàn (Safe Filter):** Kiểm tra `if (msg.is_echo || event.delivery || event.read) return status='ignored';`.
  - **Xử lý nội dung không phải text:** Nếu khách gửi sticker, ảnh, âm thanh -> chuyển thành định dạng text mô tả (ví dụ: `[Hình ảnh]`, `[Sticker]`) để không vi phạm ràng buộc `length(body) BETWEEN 1 AND 10000`.
  - **Lookup Channel:** Tìm kênh theo `platform_account_id = pageId AND type = 'messenger' AND enabled = true`.
  - **Resolve Visitor:** Tìm theo `token_hash = 'fb_psid_' + channel.id + '_' + senderPsid`. Nếu chưa có thì tạo mới, lưu PSID vào trường profile.
  - **Tạo hoặc Mở lại Conversation:** Nếu hội thoại gần nhất đang mở -> dùng tiếp; nếu đã `resolved` -> tạo hội thoại mới với `reply_owner = 'HANDOFF_PENDING'`.
  - **Lưu tin nhắn:** Gọi `appendMessage` với `client_id = mid`.

### Bước 4: UI Inbox Messenger Branding & Evidence (0.75 ngày)
- [ ] Cập nhật `InboxView.tsx`:
  - Hiển thị huy hiệu Messenger màu xanh đặc trưng (`#0084FF`) kèm logo Facebook trên card hội thoại.
  - Thông tin khách hàng bên phải hiển thị: `Nguồn: Facebook Fanpage`, `Tên Page: [Tên Page]`, `PSID: [Mã PSID]`.
- [ ] Viết test `backend/tests/uc21-messenger-inbound.test.ts`:
  - Test 1: Bắn webhook chữ ký giả -> Nhận HTTP 401.
  - Test 2: Bắn webhook hợp lệ -> Bản ghi xuất hiện trong `inbound_webhook_events` và `messages`.
  - Test 3: Bắn webhook trùng `mid` 5 lần -> DB chỉ ghi nhận 1 tin nhắn duy nhất.
  - Test 4: Bắn webhook echo (`is_echo: true`) -> Trạng thái event là `ignored`, không tạo message mới.

---

## PHẦN 3: ĐÁNH GIÁ CHUYÊN SÂU DƯỚI GÓC NHÌN SENIOR PRO MAX & LEADER KHÓ TÍNH

### BẢNG CHẤM ĐIỂM TIÊU CHUẨN (THANG ĐIỂM 10)

| Tiêu chí kỹ thuật | Điểm | Đánh giá từ Tech Lead |
|---|:---:|---|
| **1. Tính bền vững & Chống mất tin (Durability)** | **8.5 / 10** | Thiết kế Inbound Outbox/Queue ghi lại raw payload trước khi phân tích xử lý là chuẩn mực bắt buộc của hệ thống cấp doanh nghiệp. |
| **2. Bảo mật & Chống tấn công Replay** | **8.0 / 10** | Dùng `crypto.timingSafeEqual` chống Timing Attack và unique `event_id` chống Replay Attack rất chặt chẽ. |
| **3. Khả năng Chịu tải & Timeout Resilience** | **6.5 / 10** | **Điểm yếu lớn:** Nếu không phản hồi 200 OK ngay trong vòng 3-5 giây, Meta sẽ coi là timeout và retry ồ ạt tạo ra bão Webhook làm nghẽn CPU. |
| **4. Phòng ngừa Vòng lặp Vô tận (Echo Loop)** | **7.0 / 10** | Bắt buộc phải kiểm tra cờ `is_echo`. Nếu bỏ sót, hệ thống sẽ tự trò chuyện với chính nó và đốt sạch token OpenAI/Claude! |
| **ĐIỂM TRUNG BÌNH UC-21** | **7.5 / 10** | **MỨC KHÁ TỐT — BẮT BUỘC ĐẢM BẢO RESPONSE HTTP 200 < 500MS VÀ LỌC ECHO.** |

---

### PHÂN TÍCH TỈ MỈ CÁC THIẾU SÓT & LỖ HỔNG CẦN KHẮC PHỤC NGAY

#### 1. Thảm họa "Vòng lặp Echo Vô tận" (Infinite Echo Loop) đốt sạch Quota AI
* **Vấn đề phát hiện:** Khi Agent hoặc Bot AI từ hệ thống GoTek trả lời một tin nhắn tới khách Facebook, Graph API gửi tin đi thành công. Ngay lập tức, Meta Webhook sẽ phát sự kiện `messages` quay trở lại chính endpoint của hệ thống, mang nội dung câu trả lời vừa gửi kèm cờ `is_echo: true`.
* **Hậu quả thực tế:** Nếu backend không lọc `is_echo: true`, hệ thống sẽ tưởng khách vừa gửi một tin nhắn mới -> Lại kích hoạt Bot AI trả lời -> Bot AI trả lời lại sinh ra echo -> **Vòng lặp vĩnh cửu đốt sạch hàng nghìn token AI trong vài phút và spam tin nhắn liên tục vào Messenger của khách!**
* **Giải pháp chuẩn Senior:**
  - Ngay dòng đầu tiên của hàm bóc tách tin nhắn, phải kiểm tra:
    ```typescript
    if (messagingEvent.message?.is_echo) {
      // Đánh dấu bỏ qua, tuyệt đối không trigger bot hay insert visitor message
      return; 
    }
    ```

#### 2. Nguy cơ "Bão Webhook" (Webhook Storm) khi máy chủ xử lý chậm
* **Vấn đề phát hiện:** Meta quy định: Nếu endpoint Webhook không trả về HTTP 200 trong khoảng 3–5 giây, Meta sẽ coi request đó thất bại và tự động gửi lại (retry) liên tục theo cấp số nhân. Nếu một request nặng mất 6 giây, Meta sẽ gửi thêm 5 request retry nữa, khiến database bị quá tải và sập toàn bộ hệ thống.
* **Giải pháp chuẩn Senior:**
  - Tách bạch 2 pha:
    - **Pha 1 (Ingestion):** Nhận request -> Check chữ ký HMAC -> Trả về `res.status(200).send('EVENT_RECEIVED')` ngay trong < 200ms.
    - **Pha 2 (Processing):** Chạy tác vụ xử lý bất đồng bộ (Background Worker hoặc `setImmediate`) để parse payload và ghi vào DB.

#### 3. Khách gửi Ảnh / Sticker khiến Database văng lỗi CHECK Constraint
* **Vấn đề phát hiện:** Bảng `messages` có ràng buộc: `CHECK(length(body) BETWEEN 1 AND 10000)`. Khi khách gửi một sticker hình con gấu hoặc gửi một ảnh chụp màn hình, Meta sẽ gửi payload chứa `attachments: [...]` và trường `text` sẽ bị `undefined` hoặc rỗng (`""`).
* **Hậu quả thực tế:** Câu lệnh insert vào `messages` với `body = ""` sẽ bị Postgres từ chối vì vi phạm `CHECK(length(body) >= 1)`, khiến webhook bị crash văng lỗi 500.
* **Giải pháp chuẩn Senior:**
  - Chuẩn hóa nội dung trước khi insert:
    ```typescript
    let bodyText = message.text?.trim() || '';
    if (!bodyText && message.attachments?.length) {
      const type = message.attachments[0].type || 'tệp đính kèm';
      bodyText = `[Đã gửi một ${type}]`;
    }
    if (!bodyText) bodyText = '[Tin nhắn không hỗ trợ]';
    ```

---

## PHẦN 4: MÃ NGUỒN MẪU HOÀN CHỈNH CHO UC-21

### 4.1. Webhook Controller với HMAC & Fast Response: `backend/src/modules/channels/messenger-webhook.controller.ts`
```typescript
import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { transaction } from '../../core/db';
import { processMessengerInbound } from './messenger-inbound.service';

const FB_APP_SECRET = process.env.FB_APP_SECRET || 'gotek_dev_meta_secret_key';
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'gotek_messenger_verify_token_2026';

export function verifyMetaWebhook(req: Request, res: Response) {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  return res.status(403).json({ error: 'VERIFICATION_FAILED' });
}

export async function handleMetaWebhook(req: Request, res: Response) {
  // 1. Kiểm tra chữ ký HMAC-SHA256
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) return res.status(401).json({ error: 'MISSING_SIGNATURE' });

  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  const expectedSig = 'sha256=' + crypto.createHmac('sha256', FB_APP_SECRET).update(rawBody).digest('hex');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return res.status(401).json({ error: 'INVALID_SIGNATURE' });
  }

  // 2. Trả 200 OK NGAY LẬP TỨC (<200ms) để chống Webhook Storm
  res.status(200).json({ status: 'EVENT_RECEIVED' });

  // 3. Xử lý dữ liệu ngầm bất đồng bộ
  const body = req.body;
  if (body.object !== 'page') return;

  for (const entry of body.entry || []) {
    const pageId = entry.id;
    for (const msgEvent of entry.messaging || []) {
      // 4. LỌC CỨNG ECHO VÀ RECEIPTS ĐỂ CHỐNG VÒNG LẶP VÔ TẬN
      if (msgEvent.message?.is_echo || msgEvent.delivery || msgEvent.read) {
        continue;
      }

      const mid = msgEvent.message?.mid;
      const senderPsid = msgEvent.sender?.id;
      if (!mid || !senderPsid) continue;

      let text = msgEvent.message?.text?.trim() || '';
      if (!text && msgEvent.message?.attachments?.length) {
        text = `[Đã gửi một ${msgEvent.message.attachments[0].type || 'tệp đính kèm'}]`;
      }
      if (!text) text = '[Tin nhắn không hỗ trợ]';

      void (async () => {
        try {
          await transaction(async (db) => {
            await processMessengerInbound(db, {
              mid,
              pageId,
              senderPsid,
              text,
              rawPayload: msgEvent,
            });
          });
        } catch (err) {
          console.error('[Messenger Webhook Pipeline Error]', err);
        }
      })();
    }
  }
}
```
