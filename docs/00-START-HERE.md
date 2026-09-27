# Start here

GoTek Chatbot giúp doanh nghiệp tiếp nhận chat từ widget, dùng tri thức đã duyệt để AI trả lời và chuyển cho nhân viên khi cần. Người dùng gồm khách truy cập, nhân viên, Workspace Admin/Owner và Platform Admin.

Use case chính: doanh nghiệp tạo workspace → chuẩn bị dữ liệu → xuất bản tri thức → cài widget → khách hỏi → AI có kiểm soát quyền/quota trả lời hoặc handoff nhân viên. Xem [USER-GUIDE](USER-GUIDE.md) để thao tác từng vai trò và [SYSTEM-FLOW](SYSTEM-FLOW.md) để phân biệt phần code hiện có với nghiệm thu thực tế.

React/Vite và Express chạy chung server local; PostgreSQL lưu dữ liệu tenant, session, version và durable jobs. Các worker chạy riêng. Backend là ưu tiên hiện hành; UI chưa được xác nhận đầy đủ theo HiChat.

Repo đang **MVP In Progress** và hiện ở **documentation pause** sau parallel backend audit. Các lát cắt core có kiểm thử, nhưng không thể coi mọi module hoàn thành. Danh sách DONE, DONE BUT NEEDS VERIFICATION, IN PROGRESS, TODO và FUTURE / OPTIONAL ở [PROJECT-STATUS](PROJECT-STATUS.md). Công việc còn lại gồm xác minh API model thật, browser flow, quyết định retention và các yêu cầu backlog chưa triển khai. Chưa mở feature mới cho tới khi HANDOFF/CHECKPOINT ghi rõ.

## First 30 minutes

- [ ] Đọc [README](../README.md), [PROJECT-STATUS](PROJECT-STATUS.md) và [HANDOFF](HANDOFF.md).
- [ ] Đọc [USER-GUIDE](USER-GUIDE.md) để hiểu thao tác theo vai trò và các màn hình hiện có.
- [ ] Đọc [ARCHITECTURE](ARCHITECTURE.md), xác định tenant/permission boundary.
- [ ] Cài Node/npm và PostgreSQL 16 theo [DEVELOPMENT](DEVELOPMENT.md).
- [ ] Chạy `npm ci`; khởi động cluster local riêng cổng 55432.
- [ ] Chạy `npm run db:setup`; giữ `.local/runtime.json` riêng tư.
- [ ] Chạy `npm run dev`; mở http://127.0.0.1:4317.
- [ ] Chạy `npm test` và `npm run build`; không dùng DB có dữ liệu thật.
- [ ] Đối chiếu task IN PROGRESS với file, test và bước tiếp theo trong HANDOFF.

Không cần tài khoản provider để xem UI/auth local; gọi AI thật cần cấu hình registry, quyền model và secret trên server. Không có default production admin credential trong repo. Bắt đầu sửa từ task cụ thể ở HANDOFF, không xây lại kiến trúc từ bản đề xuất cũ.
