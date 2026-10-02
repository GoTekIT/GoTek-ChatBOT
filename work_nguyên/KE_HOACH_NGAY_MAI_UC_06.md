# KẾ HOẠCH HÀNH ĐỘNG NGÀY MAI: HOÀN THÀNH DỨT ĐIỂM UC-06
**Use Case:** UC-06 — Agent Đọc Inbox, Trả Lời Public Và Ghi Note Nội Bộ  
**Người phụ trách:** Nguyễn Văn Nguyên  
**Mục tiêu ngày mai:** Đưa tiến độ UC-06 từ **68%** lên **100% (Đạt mọi chuẩn kiểm thử và sẵn sàng nghiệm thu)**  
**Nhánh Git:** `nguyen` • **Nguyên tắc an toàn:** Không chỉnh sửa ngoài phạm vi Inbox/Chat, không gây conflict với team khác.

---

## 1. TỔNG QUAN HIỆN TRẠNG & PHẦN CẦN LÀM NGÀY MAI

```
[██████████████░░░░░░] 68% Hiện tại (Backend + Realtime Hub + Composer cơ bản)
                      ⬇️ KẾ HOẠCH NGÀY MAI
[████████████████████] 100% Hoàn tất (UI Internal Note + Test Suite + Hồ sơ Nghiệm thu)
```

### ✅ Những gì ĐÃ CÓ trong codebase (68%):
1. **Database Schema:** Cột `visibility` (`public`, `internal`), `author_type`, `actor_id` đã có sẵn trong bảng `messages`.
2. **Server Zero-Leakage Filter:** [`backend/src/modules/chat/realtime.ts:L249-L252`](file:///d:/gotek/ai_automation_team_new/backend/src/modules/chat/realtime.ts#L249-L252) đã có logic chặn tin `visibility === 'internal'` tới Visitor.
3. **Widget API Isolation:** [`backend/src/modules/widget/widget.ts:L114`](file:///d:/gotek/ai_automation_team_new/backend/src/modules/widget/widget.ts#L114) đã cưỡng chế `WHERE visibility = 'public'`.
4. **Composer Dual-Mode Toggle:** [`frontend/src/components/inbox/InboxView.tsx`](file:///d:/gotek/ai_automation_team_new/frontend/src/components/inbox/InboxView.tsx) đã có nút gạt giữa "Trả lời khách" và "Ghi chú nội bộ".

### ❌ 32% CÒN THIẾU CẦN GIẢI QUYẾT TRỌNG TÂM NGÀY MAI:
1. **Lỗi hiển thị UI nghiêm trọng:** Khi tin nhắn có `senderType === 'internal_note'`, `InboxView.tsx` chưa có khối render riêng mà đang rơi vào nhánh của Customer (hiển thị thành tin nhắn của khách hàng!). Cần tạo Bento Card màu vàng hổ phách `#FEFCE8` có badge `[ 🔒 Ghi chú nội bộ ]`.
2. **Cảnh báo Facebook Messenger 24h Window:** Thiếu banner cảnh báo khi nhắn tin cho khách qua Messenger quá 24h.
3. **Thiếu Bộ test tự động Zero-Leakage:** Cần viết `backend/tests/uc06-agent-reply-note.test.ts` để kiểm toán rò rỉ dữ liệu mức WebSocket và REST.
4. **Hồ sơ nghiệm thu & Hướng dẫn test:** Cần tạo `work_nguyên/nghiem_thu/NGHIEM_THU_UC_06.md` và `work_nguyên/tests/HUONG_DAN_TEST_UC_06.md`.

---

## 2. TIMELINE CÔNG VIỆC CHI TIẾT THEO TỪNG GIỜ

### 🌅 CA SÁNG (08h00 – 12h00): HOÀN THIỆN GIAO DIỆN & CLIENT RESILIENCE

| Thời gian | Hạng mục công việc | File tác động | Tiêu chí đạt (Acceptance Criteria) |
|---|---|---|---|
| **08h00 – 09h30** | **Render Thẻ Ghi Chú Nội Bộ (Internal Note Bubble)**<br>- Thêm block xử lý `msg.senderType === 'internal_note'`.<br>- Bento card nền vàng `#FEFCE8`, viền `#F59E0B`, icon khóa `lock`.<br>- Badge rõ ràng: `[ 🔒 GHI CHÚ NỘI BỘ - CHỈ NHÂN VIÊN XEM ĐƯỢC ]`.<br>- Tên nhân viên tạo note + chức vụ/role. | [`frontend/src/components/inbox/InboxView.tsx`](file:///d:/gotek/ai_automation_team_new/frontend/src/components/inbox/InboxView.tsx) | - Note không còn bị nhầm sang avatar khách hàng.<br>- Phân biệt thị giác 100% với tin nhắn thường. |
| **09h30 – 10h30** | **Cảnh Báo Cửa Sổ 24H Meta Messenger**<br>- Kiểm tra nếu `activeConv.channel === 'messenger'`.<br>- Nếu `Date.now() - lastCustomerMsgTime > 24h`: Hiển thị banner vàng cảnh báo.<br>- Hướng dẫn nhân viên đính kèm Tag tin nhắn hợp lệ. | [`frontend/src/components/inbox/InboxView.tsx`](file:///d:/gotek/ai_automation_team_new/frontend/src/components/inbox/InboxView.tsx) | - Nhân viên biết rõ tại sao tin Facebook có thể bị từ chối nếu quá 24h. |
| **10h30 – 11h30** | **Tối ưu Trạng Thái Gửi Tin (Optimistic UI & Error Retry)**<br>- Khi gửi: Hiển thị trạng thái đang gửi (`pending`).<br>- Nếu WebSocket mất mạng hoặc API lỗi: Giữ nguyên văn bản trong composer, đổi màu đỏ và hiện nút `Thử lại (Retry)`. | [`frontend/src/components/inbox/InboxView.tsx`](file:///d:/gotek/ai_automation_team_new/frontend/src/components/inbox/InboxView.tsx) | - Không bao giờ mất nội dung tin nhắn của nhân viên khi mạng chập chờn. |
| **11h30 – 12h00** | **Build & Typecheck Frontend**<br>- Chạy lệnh kiểm tra TypeScript và build SPA. | Terminal | `npm run build:frontend` trả về exit code 0, 0 warning/lỗi syntax. |

---

### 🌇 CA CHIỀU (13h30 – 17h30): VIẾT TEST AUTOMATION & BÀN GIAO HỒ SƠ

| Thời gian | Hạng mục công việc | File tác động | Tiêu chí đạt (Acceptance Criteria) |
|---|---|---|---|
| **13h30 – 15h00** | **Viết Bộ Test Tự Động UC-06 (Zero-Leakage Suite)**<br>- Tạo file `backend/tests/uc06-agent-reply-note.test.ts`.<br>- **Test 1:** Agent gửi Internal Note qua WebSocket -> Khẳng định kết nối Visitor nhận 0 byte dữ liệu.<br>- **Test 2:** Visitor gọi API `GET /widget-api/:key/messages` -> Khẳng định không có bất kỳ tin `visibility = 'internal'` nào.<br>- **Test 3:** Agent gửi Public Reply -> Khẳng định Visitor nhận được tức thì qua cả WS và REST.<br>- **Test 4:** Kiểm tra quyền Tenant -> Nhân viên workspace khác không thể đọc hoặc gửi tin. | `backend/tests/uc06-agent-reply-note.test.ts` | Chạy lệnh:<br>`npx tsx --test backend/tests/uc06-agent-reply-note.test.ts`<br>Đạt 100% PASS (4/4 tests). |
| **15h00 – 16h00** | **Chạy Toàn Bộ Quality Gates Toàn Dự Án**<br>- Typecheck Backend + Frontend.<br>- Chạy bộ test liên quan đến Chat & Inbox. | Terminal | - `npm run build:all` PASS.<br>- Không làm gãy bất kỳ test cũ nào của hệ thống. |
| **16h00 – 17h00** | **Soạn Thảo Hồ Sơ Nghiệm Thu & Sổ Tay Kiểm Thử**<br>- Tạo `NGHIEM_THU_UC_06.md` theo format chuẩn Senior Leader.<br>- Tạo `HUONG_DAN_TEST_UC_06.md` với các câu lệnh cURL, SQL query và script test mẫu. | [`work_nguyên/nghiem_thu/NGHIEM_THU_UC_06.md`](file:///d:/gotek/ai_automation_team_new/work_nguy%C3%AAn/nghiem_thu/NGHIEM_THU_UC_06.md)<br>[`work_nguyên/tests/HUONG_DAN_TEST_UC_06.md`](file:///d:/gotek/ai_automation_team_new/work_nguy%C3%AAn/tests/HUONG_DAN_TEST_UC_06.md) | Đầy đủ dữ liệu, bảng đối soát, câu lệnh SQL kiểm tra trực tiếp trên cả 2 Database (Supabase Test & Local Real). |
| **17h00 – 17h30** | **Tổng Kết & Đồng Bộ Git**<br>- Cập nhật index các file `README.md`.<br>- Rà soát `git status` đảm bảo không có file lạ / rò rỉ credential. | Các file README trong `work_nguyên/` | Clean Git working directory trên branch `nguyen`. |

---

## 3. CHECKLIST KIỂM SOÁT TIÊU CHUẨN KỸ THUẬT (DOD — DEFINITION OF DONE)

- [ ] **Bảo mật tuyệt đối (Zero-Leakage):** Không một byte ghi chú nội bộ nào lọt ra client của khách hàng dưới mọi hình thức (DOM, Network Tab, WebSocket Frame, API Response).
- [ ] **Hiển thị trực quan (Visual Separation):** Tin nhắn công khai (xanh dương `#1664ff`), Tin nhắn nội bộ (vàng hổ phách `#FEFCE8` + border `#F59E0B`).
- [ ] **Bảo toàn dữ liệu (Durability):** F5 tải lại trang hiển thị đầy đủ cả tin nhắn và ghi chú nội bộ theo đúng sequence.
- [ ] **Cô lập an toàn nhóm (No Team Conflict):**
  - Không sửa file trong `backend/src/modules/auth/`
  - Không sửa file trong `backend/src/modules/ai/`
  - Không sửa file trong `backend/src/modules/knowledge/`
  - Mọi thay đổi tập trung vào `frontend/src/components/inbox/` và `backend/tests/`.

---

## 4. LỆNH THỰC THI NHANH CHO NGÀY MAI

```bash
# 1. Kiểm tra build Frontend khi code UI
npm run build:frontend

# 2. Chạy test suite UC-06 tự động
npx tsx --test backend/tests/uc06-agent-reply-note.test.ts

# 3. Kiểm tra build toàn diện (Backend + Frontend)
npm run build:all

# 4. Kiểm tra trạng thái Git sạch sẽ
git status
```
