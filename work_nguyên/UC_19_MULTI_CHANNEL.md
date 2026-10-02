# UC-19: QUẢN LÝ ĐA LOẠI KÊNH & LỌC INBOX THEO NỀN TẢNG
**Người phụ trách trọn gói:** Nguyễn Văn Nguyên  
**Mức ưu tiên:** P0 Đa nền tảng • **Công chuẩn:** 1.0 ngày  
**Lịch giao việc rút ngắn:** **01/10/2026** (Hoàn thành trong ngày)  
**Phụ thuộc:** UC-01 (Xác thực / Identity) hoặc Fixture môi trường.

---

## PHẦN 1: MỤC TIÊU NGHIỆP VỤ & ĐIỀU KIỆN NGHIỆM THU (ACCEPTANCE CRITERIA)

### 1.1. Yêu cầu thành công cần chứng minh (Happy Path)
1. **Phân loại kênh rõ ràng:** Hệ thống phân biệt rõ ràng giữa kênh Website (`website` - Chat Widget) và kênh Facebook Messenger (`messenger` - Facebook Fanpage).
2. **Bộ lọc nền tảng trên Inbox:** Nhân viên có thể lọc hội thoại theo nền tảng: **Tất cả kênh**, **Website Widget**, **Facebook Messenger**.
3. **Bảo toàn dữ liệu cũ:** 100% dữ liệu hội thoại và kênh Website cũ trước đây phải giữ nguyên vẹn, không bị lỗi hiển thị hay mất liên kết.
4. **Cấu hình đặc thù từng nền tảng:**
   - Kênh Website: Yêu cầu `origin` (tên miền được phép nhúng), `public_key` để nhúng widget script.
   - Kênh Messenger: Bắt buộc có `platform_account_id` (Facebook Page ID), KHÔNG ép buộc phải có `origin` hay `public_key`.

### 1.2. Tình huống lỗi & Kiểm quyền âm bắt buộc (Negative & Security Tests)
1. **Tính bất biến của loại kênh (Type Immutability):** Tuyệt đối KHÔNG cho phép chuyển đổi loại kênh (từ `website` sang `messenger` hoặc ngược lại) một khi kênh đó đã phát sinh bất kỳ hội thoại (`conversations`) nào.
2. **Cô lập quyền Agent (Channel Access Control):** Agent chỉ được xem và lọc các kênh mà mình được gán quyền (`channel_members`), trừ Owner/Admin.
3. **Phòng chống Tenant Collision:** Không cho phép cùng 1 Facebook Page ID được gán vào 2 workspace khác nhau gây tranh chấp webhook.

---

## PHẦN 2: KẾ HOẠCH TRIỂN KHAI CHI TIẾT TỪNG BƯỚC (WBS)

### Bước 1: Database Schema & Migration (0.25 ngày)
- [ ] Tạo file migration `backend/db/migrations/059_multichannel_type.sql`:
  - Thêm cột `type text NOT NULL DEFAULT 'website' CHECK(type IN ('website', 'messenger', 'email', 'slack'))`.
  - Thêm cột `platform_account_id text` (lưu Page ID Facebook).
  - Thêm cột `platform_config jsonb NOT NULL DEFAULT '{}'::jsonb`.
  - Chuyển `origin` và `public_key` thành nullable: `ALTER TABLE channels ALTER COLUMN origin DROP NOT NULL;`.
  - Viết PostgreSQL Trigger `trg_protect_channel_type`: Bắn exception `CANNOT_CHANGE_CHANNEL_TYPE` nếu sửa `type` khi đã có dữ liệu trong `conversations`.
  - Tạo Index tìm kiếm: `CREATE INDEX idx_channels_platform_page ON channels(platform_account_id, type) WHERE type = 'messenger' AND enabled = true;`.

### Bước 2: Backend API & Validation (0.25 ngày)
- [ ] Cập nhật `backend/src/modules/chat/channels.ts`:
  - Mở rộng Zod Schema cho tạo/sửa kênh:
    ```typescript
    const ChannelSchema = z.object({
      name: z.string().min(1).max(100),
      type: z.enum(['website', 'messenger']).default('website'),
      origin: z.string().url().optional(),
      platform_account_id: z.string().optional(),
      greeting: z.string().default('Xin chào! Chúng tôi có thể giúp gì cho bạn?'),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#0057E1'),
    }).refine((data) => {
      if (data.type === 'website' && !data.origin) return false;
      if (data.type === 'messenger' && !data.platform_account_id) return false;
      return true;
    }, { message: 'Website requires valid origin; Messenger requires platform_account_id' });
    ```
- [ ] Cập nhật `backend/src/modules/chat/inbox.ts`:
  - Bổ sung query param `platform?: 'all' | 'website' | 'messenger'` vào hàm `inboxList`.
  - Bổ sung điều kiện SQL: `AND ($4 = 'all' OR h.type = $4)`.

### Bước 3: Frontend UI Console (0.25 ngày)
- [ ] Cập nhật màn hình quản lý kênh `ChannelsView.tsx`:
  - Bổ sung icon nhận diện (Website Globe vs Messenger Blue Badge).
  - Form tạo kênh cho phép chọn radio button giữa Website và Facebook Page.
  - Khóa (disabled) trường Loại kênh khi ở chế độ chỉnh sửa kênh đã có hội thoại.
- [ ] Cập nhật màn hình `InboxView.tsx`:
  - Thêm Dropdown bộ lọc nền tảng trên thanh công cụ: `[ Tất cả kênh | 🌐 Website Widget | 💬 Messenger ]`.
  - Hiển thị badge icon nền tảng trực quan ngay trên từng thẻ hội thoại ở danh sách bên trái.

### Bước 4: Kiểm thử tự động & Bàn giao Evidence (0.25 ngày)
- [ ] Viết test `backend/tests/uc19-multichannel.test.ts`:
  - Test 1: Tạo kênh Messenger không cần origin -> Pass.
  - Test 2: Đổi type kênh đã có conversation -> Bị DB Trigger chặn (Pass).
  - Test 3: Lọc inbox theo `platform=messenger` chỉ ra đúng hội thoại của Messenger (Pass).
- [ ] Chụp ảnh evidence: Màn hình Channels có cả 2 loại kênh; Màn hình Inbox lọc tách biệt 2 nguồn.

---

## PHẦN 3: ĐÁNH GIÁ CHUYÊN SÂU DƯỚI GÓC NHÌN SENIOR PRO MAX & LEADER KHÓ TÍNH

### BẢNG CHẤM ĐIỂM TIÊU CHUẨN (THANG ĐIỂM 10)

| Tiêu chí kỹ thuật | Điểm | Đánh giá từ Tech Lead |
|---|:---:|---|
| **1. Tính toàn vẹn dữ liệu (Data Integrity)** | **8.5 / 10** | Dùng Database Trigger ở mức Postgres để bảo vệ tính bất biến của `type` là quyết định thiết kế rất xuất sắc, tránh được race condition bỏ qua validation ở tầng ứng dụng. |
| **2. Kiến trúc & Mở rộng (Scalability)** | **8.0 / 10** | Dùng ENUM/Check constraint `('website', 'messenger', 'email', 'slack')` giúp mở rộng dễ dàng sang Zalo, Telegram, Email trong tương lai mà không phải đập đi xây lại. |
| **3. An toàn Multi-tenant & Bảo mật** | **7.0 / 10** | Đang có lỗ hổng Tenant Collision: Chưa có ràng buộc ngăn chặn 2 workspace khác nhau cùng cấu hình trùng một Facebook Page ID. |
| **4. Trải nghiệm người dùng (UX Polish)** | **7.5 / 10** | Bộ lọc nền tảng dễ dùng. Tuy nhiên cần hiển thị rõ lý do tại sao trường Loại kênh bị disable khi nhân viên bấm sửa kênh. |
| **ĐIỂM TRUNG BÌNH UC-19** | **7.8 / 10** | **MỨC KHÁ TỐT — CẦN SỬA LỖI TENANT COLLISION TRƯỚC KHI MERGE.** |

---

### PHÂN TÍCH TỈ MỈ CÁC THIẾU SÓT & LỖ HỔNG CẦN KHẮC PHỤC NGAY

#### 1. Lỗ hổng Tranh chấp Page ID giữa các Tenant (Tenant Collision)
* **Vấn đề phát hiện:** Nếu Workspace A kết nối Fanpage ID `1029384756`, sau đó Workspace B cũng nhập vào Page ID `1029384756`. Khi Meta gửi Webhook về với `page_id = 1029384756`, câu lệnh SQL `SELECT ... WHERE platform_account_id = $1` sẽ trả về 2 kết quả! Dữ liệu tin nhắn của khách sẽ bị ghi nhầm vào Workspace của người khác hoặc phát sinh lỗi nghiêm trọng.
* **Giải pháp chuẩn Senior:**
  - Thêm ràng buộc Unique toàn cục: `CREATE UNIQUE INDEX idx_unique_messenger_page ON channels(platform_account_id) WHERE type = 'messenger' AND enabled = true;`.
  - Nếu Page đã được kết nối ở một Workspace khác, hệ thống phải trả lỗi rõ: `PAGE_ALREADY_CONNECTED_TO_ANOTHER_WORKSPACE`.

#### 2. Lỗi Crash UI Widget khi render kênh không có `public_key`
* **Vấn đề phát hiện:** Trước đây mọi kênh đều có `public_key`. Với kênh Messenger, `public_key` là `null`. Nếu màn hình frontend hoặc API trả về `null` mà một component nào đó gọi `channel.public_key.slice(0, 8)`, giao diện sẽ văng màn hình trắng (White Screen of Death).
* **Giải pháp chuẩn Senior:**
  - Sử dụng Optional Chaining an toàn: `channel.public_key?.slice(...) ?? 'N/A'`.
  - Trên màn hình Chi tiết Kênh: Ẩn hoàn toàn tab "Mã nhúng Script" đối với kênh Messenger, chỉ hiện tab "Cấu hình Webhook & Token".

---

## PHẦN 4: MÃ NGUỒN MẪU HOÀN CHỈNH CHO UC-19

### 4.1. File Migration: `backend/db/migrations/059_multichannel_type.sql`
```sql
-- Migration 059: Hỗ trợ đa loại kênh và chặn đổi type khi đã có hội thoại
ALTER TABLE channels 
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'website' 
    CHECK(type IN ('website', 'messenger', 'email', 'slack')),
  ADD COLUMN IF NOT EXISTS platform_account_id text,
  ADD COLUMN IF NOT EXISTS platform_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Cho phép origin và public_key nullable
ALTER TABLE channels ALTER COLUMN origin DROP NOT NULL;
ALTER TABLE channels ALTER COLUMN public_key DROP NOT NULL;

-- Unique chống tranh chấp Page ID giữa các workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_messenger_page 
  ON channels(platform_account_id) 
  WHERE type = 'messenger' AND enabled = true;

-- Trigger kiểm soát tính bất biến
CREATE OR REPLACE FUNCTION check_channel_type_immutable() 
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.type IS DISTINCT FROM NEW.type THEN
    IF EXISTS (SELECT 1 FROM conversations WHERE channel_id = OLD.id LIMIT 1) THEN
      RAISE EXCEPTION 'CANNOT_CHANGE_CHANNEL_TYPE: Channel already has active conversations'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_channel_type ON channels;
CREATE TRIGGER trg_protect_channel_type
  BEFORE UPDATE OF type ON channels
  FOR EACH ROW
  EXECUTE FUNCTION check_channel_type_immutable();
```
