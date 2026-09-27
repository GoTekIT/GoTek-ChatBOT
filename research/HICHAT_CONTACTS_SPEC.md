# HiChat — CRM liên hệ

Nguồn: quan sát UI trực tiếp ngày 24/09/2026, sandbox account 214. Đã tạo duy nhất một liên hệ mẫu không có email/số điện thoại. Không gửi outbound, gộp hoặc xoá liên hệ.

## Danh sách
Route `/app/accounts/:account/contacts`. Sidebar Tất cả liên lạc và từng kênh. Header Liên hệ, nút Gửi tin nhắn, tìm kiếm và filter. Khi trống có các hồ sơ minh họa phía sau lời nhắc Không tìm thấy liên hệ nào trong tài khoản này; không coi là khách thật.
Sau khi tạo một liên hệ, danh sách hiển thị Khách hàng, Kênh chat, Đơn hàng, Nhãn, Hành động. Liên hệ mẫu có kênh —, đơn hàng Chưa có đơn hàng, nút Gửi tin nhắn. Không suy ra module Orders đã hoạt động vì bản thân trang Orders báo Sắp ra mắt.

## Tạo liên hệ — đã thực hiện
Nút Thêm liên hệ mở modal, tiêu đề thực tế “Chỉnh sửa thông tin liên hệ” dù là tạo mới. Trường tên, họ, email, quốc gia số điện thoại (cờ Việt Nam), điện thoại, thành phố, quốc gia, tiểu sử, công ty; Huỷ/Lưu liên hệ.
Dữ liệu mẫu: tên Sandbox, họ GoTek Research, tiểu sử “Liên hệ giả lập để khảo sát giao diện, không phải khách hàng thật.”, công ty GoTek Sandbox Research. Email/số điện thoại để trống. Lưu thành công; danh sách và hồ sơ hiển thị Sandbox GoTek Research, route `/contacts/308953`.
Bằng chứng này xác nhận tạo contact không bắt buộc email hoặc số điện thoại trong lần thử. Không chứng minh mọi validation, dedup hoặc consent rule.

## Hồ sơ
Header Liên hệ, Thẻ, Gửi tin nhắn. Tên đầy đủ, thời điểm tạo/hoạt động, form sửa có tên/email/điện thoại/thành phố/quốc gia và LinkedIn/Facebook/Instagram/Twitter/Github, nút Xoá liên hệ/Cập nhật liên hệ.
Ô tên AX hiển thị Sandbox GoTek trong khi heading đủ Sandbox GoTek Research; chưa xác minh cách UI tách first/last name. Không sửa lại để tránh kết luận dựa trên suy đoán.
Các mục Thuộc tính/Ghi chú/Gộp. Thuộc tính trống có hướng dẫn tạo trong settings. Ghi chú có editor, bộ đếm 0/200, empty state, Lưu ghi chú disabled khi trống; chưa lưu ghi chú.

## Gộp — chỉ đọc
Mô tả kết hợp hai hồ sơ cùng thuộc tính và hội thoại. Khi xung đột dữ liệu, thông tin liên hệ chính ưu tiên. Form yêu cầu tìm Liên hệ chính, đánh dấu Sẽ được giữ lại; liên hệ đang xem nằm ở phần Sẽ bị gộp/Sẽ bị xoá. Có Huỷ/Gộp liên hệ. Không thực hiện vì có tác động xoá và chưa cần thiết cho khảo sát cấu trúc.

## Bắt đầu hội thoại — không có kênh khả dụng
Từ hồ sơ mẫu bấm Gửi tin nhắn mở composer tới Sandbox GoTek Research nhưng hiển thị “Không có hộp thư nào để bắt đầu cuộc trò chuyện với liên hệ này.” Có Huỷ và Gửi. Đã Huỷ, không gửi.
Điều này cho thấy tạo contact thủ công không tự gắn inbox Website trong lần thử, dù account đã có inbox269. Chưa thể dùng contact này để chứng minh UI hội thoại có dữ liệu. Bước tiếp theo cần một phiên visitor qua widget thật hoặc kênh sandbox tương thích; không tự gán email/điện thoại người thật.

## Nghiệm thu GoTek cần theo dõi
Danh sách/empty state, tạo không email/sđt, trường tên và lưu/reload, filter/kênh, nhãn, thuộc tính theo type, ghi chú, hợp nhất dữ liệu/quyền, chọn kênh tạo hội thoại và trạng thái không có kênh. Mọi CRM pipeline hoặc scoring chưa thấy trong HiChat phải được đánh dấu tính năng riêng theo tài liệu GoTek, không tự thay giao diện contacts HiChat.
