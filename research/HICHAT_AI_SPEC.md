# HiChat — đặc tả AI từ sandbox

Ngày quan sát 24/09/2026, account214. Không nhập key, không kiểm tra provider hoặc bật chatbot.

## Tổng quan
Chế độ hiện tại Dùng API key của tôi; có lựa chọn khóa do HiCHAT quản lý. Model hiện GPT-4o Mini. Danh sách UI có GPT-5/Mini/Nano, GPT-4.1/Mini/Nano, GPT-4o/Mini, O4 Mini, O3/Mini; đây là danh mục hiển thị, không chứng minh provider nào hoạt động. Có nút Kiểm tra kết nối/Lưu. Bộ đếm 0/2000.
Bot version hiển thị 2.0; tên AI Bot; doanh nghiệp sandbox; ngôn ngữ tự động/Anh/Việt. Debounce 5 giây, delay text 1 giây, media 5 giây, temperature 0,6. Chế độ tư vấn sản phẩm/hỗ trợ khách hàng tắt; xưng mình/hô bạn. Fallback editor và Lưu thay đổi.

## Quy tắc
Điều hướng nằm trong Cài đặt AI. Trang gồm hướng dẫn, Thêm quy tắc, tải XLSX, nhập XLSX/CSV, tìm kiếm, empty state. Form có Tiêu đề bắt buộc với counter /150 và Nội dung bắt buộc /2000; Huỷ/Tạo, Tạo disabled khi trống.
Đã tạo mẫu “Quy tắc khảo sát sandbox”, nội dung “Đây là môi trường dữ liệu giả lập phục vụ khảo sát GoTek. Không mô tả thông tin thử nghiệm là thông tin khách hàng thật.”. UI báo tạo thành công; card hiện tên, Đang hoạt động, thời gian cập nhật, checkbox và các nút icon chưa xác định chức năng. Không suy ra tác dụng model từ trạng thái active.
Còn cần reload/readback nội dung, edit/deactivate và thử AI thực tế; chưa kiểm tra lỗi vượt giới hạn hoặc quota 2 quy tắc của gói.

## Còn thiếu
Biểu mẫu FAQ/kho thông tin/mẫu hội thoại/ảnh/web-source/data fields; thử lưu và đối soát retrieval; import/export nội dung mẫu; phạm vi nguồn, trạng thái xử lý và hành vi lỗi. Không thay bằng sơ đồ RAG đề xuất rồi coi là HiChat đã xác minh.


## Bổ sung form ngày 24/09/2026
Đã đọc form FAQ: câu kích hoạt100, nhiều bước với editor và tối đa5ảnh/bước, tổng câu trả lời2000, danh mục và active. Kho thông tin: tiêu đề100/nội dung2000, danh mục/active. Mẫu câu: tiêu đề150/nội dung2000. Thư mục ảnh: tên/mô tả bắt buộc/danh mục; hướng dẫn10ảnh gần nhất/thư mục trong prompt. Websource: tên/URL/URL-Sitemap-RSS, crawl20trang/depth2/delay0. Collection field: tên trường/tên hiển thị bắt buộc,mô tả,required tắt,enabled bật; mô tả ghi sang Contact attributes. Tất cả mới mở và Hủy, chưa lưu/chạy retrieval/upload/crawl/sync. Chi tiết truy vết ở H10–H12 bản bàn giao2.0.
