# UC-07: AGENT TAKEOVER, CHẶN AI CŨ (OWNERSHIP FENCING), CHỦ ĐỘNG CHUYỂN LẠI AI
**Người phụ trách trọn gói:** Nguyễn Văn Nguyên (Người B)  
**Mức ưu tiên:** P0 Core Chat Handoff • **Công chuẩn:** 2.0 ngày  
**Lịch thực hiện theo kế hoạch gốc:** D9–D10 (Kế hoạch rút ngắn: **06–07/10/2026**)  
**Phụ thuộc:** UC-06 (Agent Reply & Note), phối hợp hợp đồng với UC-13 (AI Generation).  
**Ánh xạ tài liệu gốc:** `PLAN-2-WEEKS-WORKSHOP` (H03, H08; mục 3.2, 4).

---

## PHẦN 1: MỤC TIÊU NGHIỆP VỤ & ĐIỀU KIỆN NGHIỆM THU (ACCEPTANCE CRITERIA)

### 1.1. Yêu cầu thành công cần chứng minh (Happy Path)
1. **Phân biệt rạch ròi giữa `status` và `reply_owner`:**
   - `status`: Vòng đời xử lý của ticket (`open`, `resolved`, `snoozed`).
   - `reply_owner`: Quyền điều khiển phát ngôn (`AI_ACTIVE`, `HANDOFF_PENDING`, `HUMAN_ACTIVE`).
2. **Nhân viên tiếp quản hội thoại (Agent Takeover):**
   - Khi Agent bấm "Tiếp quản (Takeover)" hoặc Agent chủ động gửi tin nhắn công khai:
     - `reply_owner` chuyển sang `HUMAN_ACTIVE`.
     - `assigned_to` gán cho `userId` của Agent thực hiện.
     - `owner_version` tăng lên 1 đơn vị (`owner_version = owner_version + 1`).
   - Phát sự kiện Realtime `conversation:takeover` tức thì tới Widget khách hàng và toàn bộ Staff Console.
3. **Chủ động chuyển giao lại cho AI (Resume AI):**
   - Agent có thể bấm nút "Chuyển giao lại cho AI Copilot":
     - `reply_owner` chuyển thành `AI_ACTIVE`.
     - `owner_version` tăng lên 1 đơn vị.
     - Bot AI sẵn sàng tự động trả lời các câu hỏi tiếp theo của khách.

### 1.2. Tình huống lỗi & Kiểm quyền âm bắt buộc (Negative & Concurrency Fencing)
1. **Chặn đứng câu trả lời AI cũ (Ownership Fencing):**
   - Nếu AI đang trong quá trình tạo câu trả lời (Prompting / LLM Streaming) mà Agent bấm Takeover:
   - Khi luồng AI sinh xong, hệ thống **tuyệt đối không được phép append câu trả lời của AI vào bảng messages**!
   - Transaction lưu tin nhắn của AI bắt buộc phải kiểm tra hàng rào `owner_version`. Nếu version đã bị thay đổi -> Hủy bỏ ngay lập tức (Drop generation).
2. **Xử lý xung đột hai Agent cùng tiếp quản (Takeover Race Condition):**
   - Agent A và Agent B cùng mở một hội thoại và bấm "Tiếp quản" trong cùng một giây:
   - Agent nào đến trước thành công (HTTP 200).
   - Agent đến sau nhận HTTP 409 Conflict với thông báo rõ ràng: *"Hội thoại này vừa được tiếp quản bởi [Tên Agent A]"*.
3. **Mặc định chờ người thì không tự ý bật AI:**
   - Khi hội thoại đang ở trạng thái `HANDOFF_PENDING` (chờ người tiếp nhận), hệ thống không được tự động cho AI trả lời ngầm, trừ khi có thao tác Resume AI rõ ràng.

---

## PHẦN 2: KẾ HOẠCH TRIỂN KHAI CHI TIẾT TỪNG BƯỚC (WBS)

### Bước 1: Database Ownership Fencing & Versioning (0.5 ngày)
- [ ] Rà soát cấu trúc bảng `conversations`:
  - `reply_owner text NOT NULL DEFAULT 'HANDOFF_PENDING' CHECK(reply_owner IN ('AI_ACTIVE','HANDOFF_PENDING','HUMAN_ACTIVE'))`
  - `owner_version integer NOT NULL DEFAULT 1`
  - `assigned_to uuid REFERENCES memberships(workspace_id, user_id)`
- [ ] Viết hàm Takeover có khóa lạc quan (Optimistic Concurrency Control) trong `backend/src/modules/chat/chat-store.ts`:
  ```sql
  UPDATE conversations 
  SET reply_owner = 'HUMAN_ACTIVE', 
      assigned_to = $userId, 
      owner_version = owner_version + 1,
      updated_at = now()
  WHERE id = $convId 
    AND workspace_id = $workspaceId 
    AND owner_version = $expectedVersion
  RETURNING *;
  ```
  Nếu không có dòng nào được update -> Bắn lỗi `409 CONFLICT: STALE_OWNER_VERSION`.

### Bước 2: Backend API & Ownership Fencing với AI Worker (0.5 ngày)
- [ ] Endpoint `POST /api/inbox/conversations/:id/takeover`:
  - Nhận payload `{ version?: number }`.
  - Thực hiện đổi chủ sở hữu, ghi nhật ký `audit(db, workspaceId, userId, 'conversation.takeover', id)`.
  - Phát socket `conversation:takeover` tới phòng hội thoại.
- [ ] Endpoint `POST /api/inbox/conversations/:id/resume-ai`:
  - Đổi `reply_owner = 'AI_ACTIVE'`, tăng `owner_version + 1`.
  - Phát socket `conversation:ai_resumed`.
- [ ] Xây dựng Hàng rào Ownership Fencing cho AI Dispatcher:
  - Khi AI chuẩn bị lưu tin nhắn vào DB, kiểm tra điều kiện cứng:
    ```sql
    SELECT id FROM conversations 
    WHERE id = $convId 
      AND owner_version = $dispatchVersion 
      AND reply_owner = 'AI_ACTIVE' FOR UPDATE;
    ```
  - Nếu `reply_owner !== 'AI_ACTIVE'` hoặc `owner_version !== dispatchVersion` -> Hủy bỏ câu trả lời, ghi log `AI_DISPATCH_ABORTED_DUE_TO_TAKEOVER`.

### Bước 3: Frontend Inbox UI & State Transition (0.5 ngày)
- [ ] Nâng cấp thanh công cụ điều khiển trên màn hình `InboxView.tsx`:
  - **Trạng thái đang do AI phụ trách (`AI_ACTIVE`):**
    - Hiển thị badge: `🤖 AI Copilot đang trực`.
    - Nút bấm nổi bật: **[ ✋ Tiếp quản cuộc gọi / Takeover ]** (Nút màu xanh dương).
  - **Trạng thái chờ người tiếp nhận (`HANDOFF_PENDING`):**
    - Hiển thị badge màu cam cảnh báo: `⚠️ Chờ nhân viên tiếp nhận`.
    - Nút bấm: **[ 📥 Nhận hội thoại này ]**.
  - **Trạng thái nhân viên đang phụ trách (`HUMAN_ACTIVE`):**
    - Hiển thị avatar & tên nhân viên đang phụ trách: `👤 [Tên bạn] đang trả lời`.
    - Nút bấm: **[ 🤖 Chuyển lại cho AI Copilot ]** (Nút viền xám icon Robot).
- [ ] Tự động Takeover khi Agent gửi tin công khai:
  - Nếu Agent soạn tin nhắn Public và bấm Gửi trong khi `reply_owner !== 'HUMAN_ACTIVE'`, hệ thống tự động gọi Takeover trước khi gửi tin để không cần bắt Agent phải bấm 2 lần.

### Bước 4: Kiểm thử tự động & Bàn giao Evidence (0.5 ngày)
- [ ] Viết test `backend/tests/uc07-takeover-fencing.test.ts`:
  - Test 1 (Concurrency Race): Giả lập 2 Agent cùng gọi Takeover với cùng 1 version -> Đúng 1 Agent thành công 200, Agent kia nhận 409 Conflict.
  - Test 2 (Ownership Fencing): Giả lập AI đang generation (mất 2s), Agent Takeover ở giây thứ 1 -> Câu trả lời của AI bị hủy bỏ, DB không bị chèn câu trả lời AI cũ.
  - Test 3 (Resume AI): Chuyển lại cho AI -> Gửi câu hỏi mới -> AI trả lời bình thường.
- [ ] Quay video màn hình: 2 cửa sổ Agent thử tranh nhận ticket; 1 cửa sổ Visitor xem AI tự tắt khi Agent xuất hiện.

---

## PHẦN 3: ĐÁNH GIÁ CHUYÊN SÂU DƯỚI GÓC NHÌN SENIOR PRO MAX & LEADER KHÓ TÍNH

### BẢNG CHẤM ĐIỂM TIÊU CHUẨN (THANG ĐIỂM 10)

| Tiêu chí kỹ thuật | Điểm | Đánh giá từ Tech Lead |
|---|:---:|---|
| **1. Tính toàn vẹn Trạng thái (State Machine)** | **8.5 / 10** | Phân tách rạch ròi `status` và `reply_owner` là quyết định kiến trúc cực kỳ chuẩn mực, tránh lỗi logic "Đóng ticket là tự bật lại AI". |
| **2. Concurrency & Hàng rào Fencing** | **8.0 / 10** | Mô hình `owner_version` kết hợp Optimistic Locking chặn đứng 100% tình trạng câu AI cũ ghi đè sau khi nhân viên đã tiếp quản. |
| **3. Trải nghiệm Vận hành Nhân viên (UX)** | **8.0 / 10** | Tính năng tự động Takeover khi Agent gửi tin nhắn public giúp tối ưu thao tác, Agent không phải click thủ công nhiều lần. |
| **4. Realtime Synchronization** | **7.5 / 10** | Cập nhật tức thì giữa các Agent. Cần lưu ý trường hợp Agent mất mạng làm lệch cache `owner_version` ở trình duyệt. |
| **ĐIỂM TRUNG BÌNH UC-07** | **8.0 / 10** | **MỨC XUẤT SẮC — HOÀN THIỆN ĐẦY ĐỦ CẢ LUỒNG HANDOFF VÀ FENCING.** |

---

### PHÂN TÍCH TỈ MỈ CÁC THIẾU SÓT & LỖ HỔNG CẦN KHẮC PHỤC NGAY

#### 1. Lỗ hổng Race Condition: AI Streaming đè lên câu trả lời của Agent
* **Vấn đề phát hiện:** Visitor hỏi một câu hỏi phức tạp. AI bắt đầu gọi LLM (mất 3–5 giây để sinh câu trả lời). Trong lúc đó, Agent đọc thấy câu hỏi nhạy cảm nên bấm **"Tiếp quản"** và gõ ngay câu trả lời: *"Dạ em chào anh, trường hợp này để em hỗ trợ trực tiếp ạ"*. Đúng lúc này, tiến trình LLM hoàn tất và tự động ghi câu trả lời của AI vào bảng `messages`!
* **Hậu quả thực tế:** Trên màn hình của khách hàng xuất hiện cùng lúc cả câu trả lời của người và câu trả lời của AI, nội dung có thể mâu thuẫn nhau làm mất uy tín doanh nghiệp.
* **Giải pháp chuẩn Senior (Fencing Token Pattern):**
  - Mọi câu lệnh `INSERT INTO messages` của AI phải đi kèm mệnh đề kiểm tra:
    ```sql
    INSERT INTO messages (...)
    SELECT ..., $aiBody, ...
    FROM conversations
    WHERE id = $convId 
      AND reply_owner = 'AI_ACTIVE' 
      AND owner_version = $aiJobVersion;
    ```
  - Nếu Agent đã takeover, `reply_owner` đã thành `HUMAN_ACTIVE` và `owner_version` đã tăng -> Câu lệnh `INSERT` trả về `0 rows affected`. Luồng AI bị triệt tiêu hoàn toàn!

#### 2. Xung đột hai Agent cùng tranh nhận hội thoại (Stale Version Conflict)
* **Vấn đề phát hiện:** Khi một khách hàng VIP gửi tin, có 3 Agent cùng trực ca nhìn thấy. Cả 3 người cùng click nút "Nhận hội thoại". Nếu không có kiểm tra version, người cuối cùng click sẽ đè lên người đầu tiên (Lost Update).
* **Giải pháp chuẩn Senior:**
  - Client gửi kèm `version` hiện tại đang hiển thị: `POST /takeover { version: 2 }`.
  - Server dùng Optimistic Concurrency Control: `WHERE id = $id AND owner_version = $version`.
  - Người click thứ 2 và 3 sẽ nhận HTTP 409 Conflict. Frontend hiển thị thông báo nhẹ (Toast notification): *"Bạn chậm một bước rồi! Hội thoại này vừa được tiếp quản bởi [Tên đồng nghiệp]"* và tự động vô hiệu hóa nút gửi tin.

---

## PHẦN 4: MÃ NGUỒN MẪU HOÀN CHỈNH CHO UC-07

### 4.1. Hàm Takeover & Fencing: `backend/src/modules/chat/chat-store.ts`
```typescript
import { PoolClient } from 'pg';
import { HttpError } from '../../core/security';

export async function takeover(
  db: PoolClient,
  workspaceId: string,
  conversationId: string,
  userId: string,
  expectedVersion: number
) {
  // Thực hiện đổi chủ sở hữu với khóa lạc quan owner_version
  const result = await db.query(
    `UPDATE conversations 
     SET reply_owner = 'HUMAN_ACTIVE',
         assigned_to = $1,
         owner_version = owner_version + 1,
         updated_at = now()
     WHERE id = $2 
       AND workspace_id = $3 
       AND owner_version = $4
     RETURNING id, reply_owner, owner_version, assigned_to`,
    [userId, conversationId, workspaceId, expectedVersion]
  );

  // Nếu không có dòng nào được cập nhật, tức là đã có người khác tiếp quản trước
  if (result.rowCount === 0) {
    const current = (await db.query(
      'SELECT reply_owner, owner_version, assigned_to FROM conversations WHERE id = $1 AND workspace_id = $2',
      [conversationId, workspaceId]
    )).rows[0];

    throw new HttpError(409, 'TAKEOVER_CONFLICT', {
      currentOwner: current?.assigned_to,
      currentVersion: current?.owner_version,
      replyOwner: current?.reply_owner,
    });
  }

  return result.rows[0];
}

export async function resumeAi(
  db: PoolClient,
  workspaceId: string,
  conversationId: string,
  expectedVersion: number
) {
  const result = await db.query(
    `UPDATE conversations 
     SET reply_owner = 'AI_ACTIVE',
         owner_version = owner_version + 1,
         updated_at = now()
     WHERE id = $1 
       AND workspace_id = $2 
       AND owner_version = $3
     RETURNING id, reply_owner, owner_version`,
    [conversationId, workspaceId, expectedVersion]
  );

  if (result.rowCount === 0) {
    throw new HttpError(409, 'RESUME_AI_CONFLICT');
  }

  return result.rows[0];
}
```
