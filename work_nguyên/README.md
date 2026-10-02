# HỒ SƠ CÔNG VIỆC VÀ KẾ HOẠCH TRIỂN KHAI TRỌN GÓI THEO TỪNG UC (NGUYỄN VĂN NGUYÊN)
**Kỹ sư phụ trách:** Nguyễn Văn Nguyên (Người B trong Kế hoạch 2 tuần Workshop)  
**Phân hệ:** PHÂN HỆ 2 — Inbox CSKH Website và Facebook Messenger  
**Thời gian thực hiện:** 01/10/2026 – 07/10/2026 (Nghiệm thu toàn hệ thống trước 10/10/2026)  
**Tiêu chuẩn:** Clean Architecture, PostgreSQL 16 RLS, TypeScript Strict, React 19, Zero-Leakage Security, Ownership Fencing.

---

## 1. DANH MỤC HỒ SƠ CHI TIẾT 5 USE CASES (HOÀN THÀNH THEO TỪNG UC)

Mỗi file dưới đây là một bộ hồ sơ kỹ thuật độc lập, khép kín cho từng Use Case, bao gồm: **Kế hoạch WBS chi tiết từng giờ**, **Mã nguồn mẫu chuẩn Clean Architecture**, **Bộ kịch bản kiểm thử tự động**, và **Bản đánh giá khắt khe thang điểm 10 từ Tech Lead & Senior Pro Max**:

| Tệp hồ sơ Use Case | Tên nghiệp vụ & Phạm vi cốt lõi | Hạn chót hoàn thành | Điểm Lead Review | Tình trạng |
|---|---|:---:|:---:|:---:|
| **[UC_19_MULTI_CHANNEL.md](./UC_19_MULTI_CHANNEL.md)** | **Quản lý đa loại kênh & Lọc Inbox nền tảng** | **01/10/2026** | **7.8 / 10** | Sẵn sàng triển khai |
| **[UC_05_VISITOR_CHAT.md](./UC_05_VISITOR_CHAT.md)** | **Visitor gửi tin widget, lưu bền vững, chống trùng** | **02–03/10/2026** | **7.25 / 10** | Sẵn sàng triển khai |
| **[UC_21_MESSENGER_WEBHOOK.md](./UC_21_MESSENGER_WEBHOOK.md)** | **Inbound Webhook Facebook Messenger vào Inbox** | **04–05/10/2026** | **7.5 / 10** | Sẵn sàng triển khai |
| **[UC_06_AGENT_REPLY_NOTE.md](./UC_06_AGENT_REPLY_NOTE.md)** | **Agent trả lời Public & Ghi chú nội bộ (Zero Leak)** | **05–06/10/2026** | **7.5 / 10** | Sẵn sàng triển khai |
| **[UC_07_TAKEOVER_AND_RESUME_AI.md](./UC_07_TAKEOVER_AND_RESUME_AI.md)** | **Agent Takeover, Chặn AI cũ (Fencing), Chuyển lại AI** | **06–07/10/2026** | **8.0 / 10** | Sẵn sàng triển khai |

---

## 2. CÁC TÀI LIỆU TỔNG HỢP & ĐÁNH GIÁ CHUYÊN SÂU

* **[04_NGHIEM_THU_PHAN_HE_3_100_PERCENT.md](./04_NGHIEM_THU_PHAN_HE_3_100_PERCENT.md)**: 🏆 **BÁO CÁO NGHIỆM THU 100% PHÂN HỆ 3 (PRODUCTION READY)** — Đạt điểm tuyệt đối 10/10, xử lý triệt để 6 lỗ hổng bảo mật & concurrency, hoàn tất 14/14 Use Cases.
* **[KE_HOACH_NGAY_MAI_UC_06.md](./KE_HOACH_NGAY_MAI_UC_06.md)**: 🔥 **Kế hoạch hành động chi tiết ngày mai cho UC-06** (Phân bổ giờ ca sáng / ca chiều, tiêu chí nghiệm thu và bộ lệnh kiểm thử).
* **[01_KE_HOACH_CHI_TIET_4_UC.md](./01_KE_HOACH_CHI_TIET_4_UC.md)**: Ma trận phân rã tổng thể các Use Cases, biểu đồ tiến độ Gantt, quy tắc phân chia công việc theo từng tầng hệ thống.
* **[02_THIET_KE_KY_THUAT_VA_CODE_CHI_TIET.md](./02_THIET_KE_KY_THUAT_VA_CODE_CHI_TIET.md)**: Tổng hợp toàn bộ SQL Migrations (059, 060), DTOs, Controllers, Services và React 19 Components.
* **[03_DANH_GIA_SENIOR_PRO_MAX_LEADER_REVIEW.md](./03_DANH_GIA_SENIOR_PRO_MAX_LEADER_REVIEW.md)**: Báo cáo đánh giá tổng thể toàn hệ thống, chỉ trích tỉ mỉ các lỗ hổng chết người khi đưa vào Production và lộ trình khắc phục đạt điểm 9.5+/10.

---

## 3. THƯ MỤC NGHIỆM THU & HƯỚNG DẪN TEST

* **[nghiem_thu/](./nghiem_thu/)**: Lưu trữ toàn bộ biên bản bàn giao, đối soát kỹ thuật và checklist nghiệm thu của từng Use Case (ví dụ: `NGHIEM_THU_UC_05.md`).
* **[tests/](./tests/)**: Sổ tay kịch bản kiểm thử thực tế từ A – Z (Happy Path, Negative Tests, Security Gates, cURL, SQL verification) cho từng Use Case (ví dụ: `HUONG_DAN_TEST_UC_05.md`).


