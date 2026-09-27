---
name: gotek-chatbot-delivery
description: Plan, implement, or review GoTek Chatbot modules against the HiChat-based handoff, with GoTek branding, traceable requirements, UI evidence and module acceptance gates. Use for GoTek Chatbot delivery, not unrelated chatbot products.
---

# GoTek Chatbot delivery

## Phạm vi và nguồn
Dùng cho lập backlog, triển khai hoặc nghiệm thu GoTek Chatbot. Chọn chế độ theo yêu cầu hiện tại; gọi skill không tự cho phép triển khai code hay phát hành. Khi tiếp tục, đọc checkpoint và trạng thái repo trước. Yêu cầu gần nhất của người dùng ưu tiên hơn tài liệu tham khảo.

Bản nền là handoff v2.0 ngày 24/09/2026, không phải xác nhận mọi tính năng HiChat đã kiểm thử. Đọc [kế hoạch](references/NEXT_STEPS.md) trước; chỉ đọc các H/E/F liên quan trong [đặc tả](references/HANDOFF.md). Snapshot này có thể cũ: nếu repo có reports/GOTEK_CHATBOT_DEV_HANDOFF.md mới hơn hoặc quyết định mới, đối chiếu thay đổi và cập nhật nguồn có chủ đích, không âm thầm áp dụng bản cũ.

## Cách thực hiện một hạng mục
1. Chọn mã H, các chức năng con Hxx.yy, phạm vi core/sau core và phase trong kế hoạch. Quan hệ “liên quan” trong handoff không phải toàn bộ điều kiện phải xây trước; dùng thứ tự phase để tránh vòng phụ thuộc.
2. Đọc bằng chứng O (quan sát), T (thao tác có kết quả), D (yêu cầu tài liệu), P (chưa xác minh). Với P liên quan hành vi đang làm, khảo sát nếu có quyền; nếu chưa làm được, ghi gap và đề xuất có nhãn. Có thể tiếp tục phần độc lập, không tuyên bố tương đương HiChat cho phần chưa chứng minh.
3. Trước UI: lập screen contract gồm route, role, viewport/theme, screenshot nguồn, control/field/validation/state và liên kết dữ liệu. Giữ bố cục, menu, thứ tự thao tác theo HiChat; thay nhận diện GoTek. Không tự thêm hero, card KPI, wizard hay biểu đồ. Sơ đồ không thay screenshot; hai ảnh mẫu không đủ cho toàn bộ màn. Platform Admin GoTek là yêu cầu riêng, không giả là giao diện HiChat đã thấy.
4. Trước backend: chốt hợp đồng API/schema/event/quyền/lỗi/idempotency cho chức năng được giao. Stack trong handoff là đề xuất; kiểm repo thực trước khi chọn. Không suy luận API nội bộ HiChat từ UI.
5. Triển khai lát cắt có UI + API + dữ liệu + quyền + trạng thái lỗi trong phạm vi được giao; không đóng hạng mục bằng mock hoặc click toast. Gắn mã Hxx.yy vào PR và bằng chứng kiểm thử.
6. Nghiệm thu theo phiếu H và mẫu [bằng chứng](references/ACCEPTANCE_TEMPLATE.md): chứng minh luồng thành công, lỗi thiết yếu, quyền âm, UI cùng trạng thái và kết quả lưu/gửi thực. Build/test xanh không thay receipt, browser E2E hay production acceptance. Mục còn P phải có gap hoặc quyết định xử lý rõ trước khi đóng parity.
7. Cập nhật backlog/checkpoint: đã làm, evidence path, commit/env, phần chưa đạt và bước tiếp theo. Không đánh dấu Done nếu thiếu bằng chứng bắt buộc. Báo riêng Implemented, Verified, Accepted.

## Ràng buộc lõi
- Backend suy ra tenant từ session/membership; kiểm quyền ở DB, storage, cache, job và realtime. Không tin workspace_id do client tự gửi.
- Hai console: Platform Admin quản lý tenant/provider/quota; Workspace Admin quản lý workspace. Platform Admin không mặc định đọc chat; support grant có scope/lý do/hết hạn/audit.
- Widget không có provider secret; không gửi note nội bộ hoặc tri thức private cho visitor. Core cần tri thức có quyền và version publish.
- Reply ownership phải ngăn câu AI cũ gửi sau takeover; retry/reconnect không nhân đôi side effect. Gửi chưa có receipt phải phản ánh chưa xác định, không coi thành công.
- Core gồm auth/workspace, widget/inbox/handoff, AI/tri thức, contact/collection tối thiểu, quota, audit và backup/restore. E01–E12 làm sau core theo kế hoạch; không cắt bỏ H vì chưa ở core.
- Dùng logo/palette trong assets và quy định phần16. Màu lấy từ SVG khác token UI đề xuất; không trình bày token đề xuất là brandbook đã duyệt. Không tự đổi dark/light theme hoặc breakpoint thiếu bằng chứng.
- Không dùng account214/inbox269/contact308953 hay token HiChat làm dữ liệu cố định trong GoTek. Không ghi credential vào hồ sơ.

## Giao việc
Dùng các prompt ở cuối kế hoạch; nêu rõ mã, phase, repo và chế độ khảo sát/code/review. Với yêu cầu chỉ lập kế hoạch, xuất backlog và quyết định cần chốt, không sửa code sản phẩm. Không tự gửi lời mời, kết nối provider, mua gói, gửi tin hay deploy chỉ vì handoff có nhắc đến.
