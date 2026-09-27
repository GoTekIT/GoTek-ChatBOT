# HiChat — đặc tả quan sát widget website

Nguồn: UI trực tiếp sandbox account 214, inbox 269, ngày 24/09/2026. Không nhúng vào website thật, chưa kiểm tra tin gửi nhận. Các giá trị dưới đây là trạng thái sandbox, không khẳng định mặc định toàn sản phẩm.

## Cấu trúc
Route `/app/accounts/:account/settings/inboxes/:inbox`. Sáu mục: Cài đặt, Cộng tác viên, Giờ làm việc, Biểu mẫu trước khi trò chuyện, Trình tạo widget, Cấu hình. Trên viewport hẹp, mục hiện tại là nút mở menu các mục; không phải sáu tab nằm ngang.

## Cài đặt
- Ảnh JPG/PNG, tối đa 5MB, kích thước tối đa 600×600 theo hướng dẫn UI.
- Tên trang web, Domain trang web, Tiêu đề chào mừng, Dòng giới thiệu chào mừng, Màu tiện ích.
- Bật lời chào kênh (tắt): tự gửi lời chào khi hội thoại mới.
- Thời gian phản hồi: vài phút (đang chọn), vài giờ hoặc một ngày. Đây là nội dung hiển thị, chưa chứng minh là SLA tính toán.
- Hộp thu thập email bật; khảo sát CSAT tắt; cho nhắn sau giải quyết bật; tiếp tục qua email bật.
- Chọn Trung tâm trợ giúp.
- Bộ chọn tệp, emoji, khách kết thúc hội thoại: bật. Dùng tên/avatar inbox cho bot: tắt.
- Tên người gửi email: Thân thiện (tên agent + doanh nghiệp) hoặc Chuyên nghiệp (tên doanh nghiệp); liên kết cấu hình tên doanh nghiệp.
- Turn On Chatbot: tắt. Nút Cập nhật.
Không suy ra các công tắc đã chứng minh gửi email hoặc AI hoạt động.

## Giờ làm việc
Tiêu đề Thời gian làm việc; nút Cập nhật; công tắc Kích hoạt trạng thái khả dụng của doanh nghiệp cho hộp thư đến này. Trạng thái lưu trước khảo sát là tắt.
Bật thử trong form, chưa lưu, xuất hiện:
- Editor Thông báo không có sẵn cho khách truy cập.
- Bộ chọn múi giờ; giá trị nhìn thấy Pacific Time (US & Canada) (GMT-07:00).
- Lịch tuần: Sunday đến Saturday. Chủ nhật và thứ bảy không khả dụng. Thứ hai đến thứ sáu 09:00 AM–05:00 PM, hiển thị 8 giờ; mỗi ngày có checkbox khả dụng, checkbox Cả ngày, giờ bắt đầu/kết thúc.
Mô tả nói giờ khả dụng có thể hiện ngay khi mọi agent offline; ngoài giờ có thông báo và prechat. Chưa kiểm tra thời điểm qua ngày, DST, nhiều khoảng giờ/ngày hoặc lịch ngày lễ.
Đã trả công tắc về tắt, không bấm Cập nhật.

## Biểu mẫu trước chat
Tiêu đề Bật biểu mẫu trước khi trò chuyện, mô tả thu thông tin trước bắt đầu; select Có/Không và nút Cập nhật. Trạng thái lưu là Không.
Chọn Có thử, chưa lưu: editor Tin nhắn trước khi trò chuyện (nội dung nhìn thấy Share your queries or comments here.) và bảng có công tắc, Khoá, Kiểu, Bắt buộc, Nhãn, Cụm từ hiện nền trong ô.
| Khoá | Kiểu | Bắt buộc ban đầu | Nhãn | Placeholder |
|---|---|---|---|---|
| emailAddress | email | Có | Email Id | emailAddress |
| fullName | text | Không | Full name | fullName |
| phoneNumber | text | Không | Phone number | phoneNumber |
Cả ba công tắc trường đều tắt lúc mở form. Khi tắt, required/label/placeholder bị disabled. Đã bật email thử: ba control đó được phép chỉnh, email vẫn required. Không nhập dữ liệu cá nhân.
Đã trả email về tắt và prechat về Không; không bấm Cập nhật.

## Điểm cần xác minh khi khảo sát tiếp
- Save/reload cấu hình, preview và widget thật có phản ánh đúng không.
- Trường custom của Contact có xuất hiện trong prechat không khi có dữ liệu.
- Prechat bắt buộc và email collection trong hội thoại có giao nhau hay lặp lại không.
- Hành vi offline/ngoài giờ, quyền gửi sau resolved, CSAT, file/emoji, yêu cầu người thật.
- Cộng tác viên và auto assignment, builder responsive và code nhúng.
- Kiểm tra cùng viewport bằng ảnh đối chiếu trước nghiệm thu UI; các quan sát AX hiện tại chỉ chứng minh cấu trúc/control, chưa chứng minh pixel fidelity.

## Cộng tác viên và builder — quan sát bổ sung
Cộng tác viên: heading hiển thị “Nhà cung cấp”, mô tả thêm/xoá agent trong inbox; multi-select đang có Người thử nghiệm GoTek và nút Cập nhật. Phân công cuộc trò chuyện có công tắc “Bật tự động chuyển nhượng” đang bật; mô tả tự gán hội thoại mới cho agent đã thêm; trường số “Giới hạn tự động phân công tối đa” và nút Cập nhật. Chưa xác minh thuật toán chia tải, giá trị rỗng hoặc hành vi agent offline; không đổi danh sách/quyền.
Builder trên viewport hẹp có hai nút Cài đặt/Xem trước. Cài đặt có avatar, tên website, hai lời chào, thời gian trả lời (phút/giờ/ngày), màu; vị trí trái/phải (phải đang chọn), kiểu Chuẩn/Mở rộng (Chuẩn đang chọn), tiêu đề launcher “Trò chuyện với chúng tôi”, nút Cập nhật cài đặt widget.
Xem trước có radio Xem trước/Kịch bản, và Mặc định/Chat. Mặc định hiện hai lời chào sandbox, trạng thái trực tuyến, thời gian trả lời, nút bắt đầu hội thoại và thương hiệu HiCHAT. Chat có tên inbox, thời gian trả lời, hai tin mẫu “Xin chào”, ô chat-input, icon thao tác. Đây là preview với dữ liệu mẫu; không gõ hoặc gửi tin và không coi là widget runtime đã hoạt động. Không sửa/lưu cấu hình builder.

## Cấu hình nhúng và danh tính
Tab Cấu hình có Tập lệnh Messenger, hướng dẫn đặt trong body, nút Mở trong CodePen và Sao Chép. SDK tải bất đồng bộ từ host HiChat, gọi hichatSDK.run với websiteToken và baseUrl. Không chép token thực vào tài liệu.
Bên dưới có Xác thực danh tính người dùng, giá trị bí mật và nút sao chép; tùy chọn Bắt buộc Xác thực danh tính người dùng (checkbox Bật) đang tắt. Mô tả: bật sẽ từ chối yêu cầu không thể xác minh. Không sao chép/lưu khóa, không đổi công tắc. Chưa có bằng chứng thuật toán ký, payload, vòng đời khóa hoặc phản ứng widget khi chữ ký sai.
Đã bấm Mở trong CodePen một lần; inventory IAB vẫn chỉ có tab HiChat và UI không thay đổi. Chưa xác định do popup/trình duyệt hay tích hợp; không khẳng định CodePen hoặc widget hỏng. Chưa có runtime visitor nên gửi nhận website vẫn chưa được nghiệm thu.
