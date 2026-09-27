# HiChat — phụ lục khảo sát cài đặt

Ngày khảo sát: 24/09/2026. Nguồn: UI trực tiếp account sandbox 214. Chỉ đọc biểu mẫu, không tạo webhook, automation, macro hoặc thay bảo mật. Không coi nút hoặc menu hiện diện là bằng chứng xử lý backend thành công.

## Tích hợp
Route: `/app/accounts/:account/settings/integrations`.
Danh sách card có nút Cấu hình: Webhooks; Ứng dụng bảng điều khiển; Linear; Dialogflow; Google Translate; Dyte; Lark; Google Sheets; Kim Kiều Flower; CDP; KiotViet. Các connector chưa được kết nối hoặc thử gửi dữ liệu. Connector theo ngành như Kim Kiều Flower cần xác minh phạm vi sản phẩm trước khi quyết định dữ liệu GoTek tương ứng; không dùng nhãn đó làm bằng chứng tích hợp chung.

Webhook: trang giải thích, empty state, nút Thêm mới webhook mở modal. Trường Tên (tuỳ chọn), Webhook URL, checkbox sự kiện, Huỷ/Tạo webhook. Nút tạo bị vô hiệu khi form trống.
Sự kiện nhìn thấy: conversation_created, conversation_status_changed, conversation_updated, message_created, message_updated, webwidget_triggered, contact_created, contact_updated, data_collected, data_collection_completed.
Chưa xác minh chữ ký, retry, delivery logs, timeout, thứ tự hoặc payload. Khi GoTek triển khai phải có hợp đồng delivery rõ ràng; đó là thiết kế backend GoTek, không phải thông số HiChat đã được công bố.

## Automation
Route: `/settings/automation/list`. Empty state Không tìm thấy luật tự động hoá; nút Tạo mới mở modal.
Trường: Tên luật, Mô tả, Sự kiện, Điều kiện, Hành động. Có thêm/xoá hàng điều kiện và hành động.
Sự kiện: Cuộc hội thoại được tạo; Cuộc hội thoại được cập nhật; Tin nhắn được tạo; Cuộc hội thoại được mở.
Điều kiện mặc định Trạng thái; các lựa chọn: Ngôn ngữ trình duyệt, Tiêu đề email, Tên quốc gia, Số điện thoại, Liên kết giới thiệu, Email, Hộp thư, Ngôn ngữ cuộc hội thoại, Mức độ ưu tiên. Với Trạng thái, operator Bằng/Không bằng và bộ chọn giá trị. Hàng thứ hai có VÀ/HOẶC. Chưa xác minh precedence giữa nhiều phép nối.
Hành động: Phân công nhân viên, Phân công nhóm, Thêm nhãn, Xoá nhãn, Gửi email đến nhóm, Gửi bản ghi email, Tắt cuộc hội thoại, Hoãn cuộc hội thoại, Đánh dấu đã giải quyết, Gửi sự kiện webhook, Gửi tệp đính kèm, Gửi tin nhắn, Thay đổi mức ưu tiên, Add SLA.
Chưa lưu hoặc kích hoạt quy tắc. Chưa chứng minh chống vòng lặp, thứ tự thực thi hoặc điều kiện theo sự kiện khác.

## Macros
Route `/settings/macros`, tạo tại `/settings/macros/new`.
Bố cục quy trình Bắt đầu → các khối hành động → Thêm hành động mới → Kết thúc. Sau đó Tên Macro, Hiển thị Macro Công khai/Riêng tư, nút Lưu macro. Hướng dẫn UI nói kéo tay cầm để sắp thứ tự; macro chạy theo thứ tự đó.
Hành động: Phân công nhóm/nhân viên; thêm/xoá nhãn; xoá nhóm đã phân công; gửi bản ghi email; tắt/hoãn/giải quyết hội thoại; gửi tệp/tin nhắn; ghi chú riêng tư; đổi ưu tiên.
Công khai nghĩa là mọi agent trong account, không phải công khai trên Internet. Riêng tư chỉ người tạo. Chưa lưu/chạy macro thật.

## Nhãn và thuộc tính
Nhãn `/settings/labels/list`: empty state, Tạo mới → modal có Tên nhãn bắt buộc, Mô tả, Màu sắc, Hiển thị nhãn trên sidebar (mặc định bật), Huỷ/Tạo. Nút Tạo bị vô hiệu khi tên trống.
Thuộc tính `/settings/custom-attributes/list`: tab Cuộc hội thoại/Liên lạc. Modal Áp dụng cho Conversation/Contact, Tên hiển thị, Khoá, Mô tả*, Kiểu, Bật kiểm tra regex, Huỷ/Tạo. Kiểu: Text, Number, Link, Date, List, Checkbox. Chưa thử cấu hình riêng cho List hoặc regex, chưa lưu.

## Thư mẫu phản hồi
Route `/settings/canned-response/list`. Hướng dẫn dùng dấu / rồi mã ngắn trong composer. Modal: Mã rút gọn, Tin nhắn (editor), Tệp đính kèm kéo thả/chọn tệp, Huỷ/Lưu. UI ghi tối đa 5 tệp, 40MB mỗi tệp, ảnh/video/âm thanh/PDF/DOC/DOCX. Đây là giới hạn hiển thị cho thư mẫu, không suy rộng sang upload tri thức hoặc widget. Chưa upload hoặc gửi tệp.

## Audit và Bảo mật
Audit `/settings/audit-logs/list` có bản ghi hệ thống mời người thử nghiệm vào account với vai trò administrator, thời gian và IP; phân trang 1/1. Không chép IP vào đặc tả. Chưa có bằng chứng những sự kiện khác đều được audit.
Bảo mật `/settings/security`: tiêu đề đăng nhập một lần SSO, mô tả Google Workspace/Microsoft/Okta, công tắc tắt; xuất hiện thông báo “Không tải được cài đặt. Vui lòng thử lại.” Không bật công tắc. Chỉ xác minh giao diện và lỗi, không xác minh cấu hình SSO hoạt động.

## Billing và Usage
Billing `/settings/billing`: Starter, Hoạt động, Miễn phí, Trọn đời, 1 giấy phép, kỳ tiếp theo/chấm dứt trial Chưa có; nút cổng thanh toán, xem giới hạn, trò chuyện hỗ trợ. Không mở cổng thanh toán hoặc thực hiện giao dịch.
Usage `/settings/usage`: thẻ Người dùng 1/2, Inbox 1/2, Phản hồi AI 0/2.000, Kho tri thức & lưu trữ 0/16. Bảng giới hạn: 2 người dùng, 2 kênh, 2.000 phản hồi hệ thống/tháng, 2.500 API riêng/tháng, FAQ 5, dữ liệu training 5, ảnh 2, nguồn web 1, trường thu thập 3, quy tắc AI 2, mẫu câu 3.
Đây là số hiển thị của sandbox ở thời điểm khảo sát, không phải bảng giá hoặc hạn mức áp dụng cho mọi khách hàng. Billing hiển thị 1 giấy phép còn Usage ngưỡng 2; chưa có đủ bằng chứng giải thích quan hệ này. Cần làm rõ khái niệm giấy phép đã sử dụng/được mua/được phép trước đặc tả dữ liệu.

## Các kiểm thử còn thiếu trước nghiệm thu tương đương
- Lưu/reload/sửa/vô hiệu/xoá có thể khôi phục theo từng module và quyền từng vai trò.
- Automation với hội thoại thử nghiệm; xác minh AND/OR, vòng lặp và side effect.
- Macro công khai/riêng tư và thứ tự hành động trên hội thoại thực.
- Webhook endpoint thử nghiệm có kiểm soát, delivery/retry; không gửi dữ liệu thật đến endpoint không được duyệt.
- Quota sát ngưỡng/vượt ngưỡng và thống nhất meter với hóa đơn.
- Không xem việc sao chép lỗi tải SSO hoặc chuỗi dịch còn thiếu là yêu cầu kỹ thuật của GoTek; giữ cấu trúc UI, ghi lỗi riêng để chủ sản phẩm quyết định.
