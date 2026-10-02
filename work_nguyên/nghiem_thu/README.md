# THƯ MỤC NGHIỆM THU CÁC USE CASES (NGHIEM_THU)
**Dự án:** GoTek Chatbot Platform • **Nhánh Git:** `nguyen`  
**Người phụ trách:** Nguyễn Văn Nguyên  
**Mục đích:** Lưu trữ toàn bộ biên bản bàn giao, tài liệu kỹ thuật, kịch bản tái hiện và bằng chứng kiểm thử (Evidence) cho từng Use Case trước khi tạo Pull Request merge vào `main`.

---

## 📌 QUY TẮC NGHIỆM THU (ACCEPTANCE RULES)
1. **Không tự ý đánh dấu hoàn thành:** Mọi file biên bản Use Case phải giữ cờ `⚠️ CHƯA ĐÓNG NGHIỆM THU HOÀN TẤT` cho đến khi có kết quả đối soát thực tế và phê duyệt từ Tech Lead / User.
2. **Dữ liệu lưu thật:** Mọi thử nghiệm phải xác thực ghi nhận thực tế trong Database (PostgreSQL), bảo đảm bền vững qua Reload (F5).
3. **Phân định rõ 2 môi trường DB:**
   - **Database Test:** Supabase Cloud Australia (`aws-0-ap-southeast-2.pooler.supabase.com:5432`)
   - **Database Thật:** Local Docker PostgreSQL (`127.0.0.1:55432/gotek_chatbot`)
4. **Không gây xung đột nhóm:** Phân tách ranh giới module sạch sẽ, không sửa các file ngoài phạm vi phân hệ được giao (Auth, Knowledge, AI Core).

---

## 📋 DANH MỤC CÁC USE CASE & BIÊN BẢN NGHIỆM THU

| Mã UC | Tên Phân Hệ & Nghiệp Vụ | File Tài Liệu Nghiệm Thu | Tiến Độ Hiện Tại | Trạng Thái Phê Duyệt |
|:---:|---|---|:---:|:---:|
| **UC-05** | **Visitor Chat Widget, Realtime Full-Duplex & Durability** | [`NGHIEM_THU_UC_05.md`](file:///d:/gotek/ai_automation_team_new/work_nguy%C3%AAn/nghiem_thu/NGHIEM_THU_UC_05.md) | **100% Core Logic & Nginx** | ⚠️ Đang chờ nghiệm thu trên DB thật |
| **UC-06** | **Agent Phản Hồi & Thêm Ghi Chú Nội Bộ (Internal Notes)** | *Chờ khởi tạo* | 0% | ⏳ Đang triển khai |
| **UC-07** | **Takeover (Nhân viên tiếp quản) & Chuyển giao lại cho AI** | *Chờ khởi tạo* | 0% | ⏳ Đang triển khai |
| **UC-19** | **Multi-Channel: Kênh Website, Facebook Messenger & Zalo** | *Chờ khởi tạo* | 0% | ⏳ Đang triển khai |
| **UC-21** | **Messenger Webhook: Nhận tin, Trả lời qua Graph API & Echo Filter** | *Chờ khởi tạo* | 0% | ⏳ Đang triển khai |

---

## 🛠️ LỆNH KIỂM CHỨNG CHUẨN TRƯỚC KHI BÀN GIAO
```bash
# 1. Typecheck toàn bộ Backend và Frontend
npm run build:all

# 2. Kiểm tra SDK contract không rò rỉ secret
npx tsx --test backend/tests/sdk-contract.test.ts

# 3. Chạy kịch bản tích hợp WebSocket 2 chiều
node backend/scripts/verify_websocket_option_a.cjs
```
