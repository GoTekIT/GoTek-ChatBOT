# UI và phối hợp nhánh — cập nhật theo yêu cầu người dùng 2026-09-25

- Bám bố cục, control và luồng UI nguồn đã quan sát. Không dùng hình vẽ vector/sơ đồ tự tạo để thay UI hoặc asset tham chiếu; không coi sơ đồ module là ảnh màn hình thật.
- Người dùng đã xác nhận: trong dự án này, gọi “hilab” nghĩa là hichat.asia. Dùng cùng nguồn HiChat hiện hành, không hỏi lại về cách gọi này.
- Chia nhiều nhánh khi có phần việc độc lập. Mỗi file chỉ có một nhánh được phép sửa tại một thời điểm. Khai báo file sở hữu trước khi giao việc; file route, dependency/lockfile, migration numbering và hồ sơ tổng hợp do nhánh chính điều phối.
- Nhánh chỉ đọc có thể khảo sát cùng lúc. Không giao lại việc vì timeout; kiểm tra handle đã kết thúc/mất và file bàn giao trước khi thay nhánh.
- Nhánh chính tích hợp, kiểm tra diff và chạy kiểm thử phù hợp sau các thay đổi. Báo rõ nhánh đang chạy, đã xong hoặc lỗi; không nói đang đa luồng khi chỉ còn một nhánh hoạt động.
- Không ghi Accepted chỉ vì build/test pass. Cần ảnh/UI cùng trạng thái, dữ liệu và điều kiện nghiệm thu thực.
