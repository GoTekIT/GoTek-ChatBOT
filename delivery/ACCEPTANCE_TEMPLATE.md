# Phiếu nghiệm thu hạng mục

- Mã Hxx.yy / Fxx / Exx và phase:
- Phiên bản đặc tả, decision ID, phạm vi được giao:
- Owner dev / QA / PO:
- Commit, môi trường, thời điểm, fixture (không credential):
- Trạng thái: Implemented / Verified / Accepted / Blocked:

| Yêu cầu ID | Kỳ vọng | Thao tác và fixture | Kết quả thực tế | Pass/Fail/Not run | Evidence |
| --- | --- | --- | --- | --- | --- |

## UI và dữ liệu
Route, role, viewport/theme; ảnh HiChat nguồn + ảnh GoTek đúng state; loading/empty/error/disabled/focus/long text. Ghi khác biệt có chủ ý theo brand/decision. Schema/API/event và quyền đọc/ghi tương ứng.

## Luồng quan trọng
Thành công end-to-end; validation/lỗi phụ thuộc; thiếu quyền và tenant khác; retry/concurrency nếu có side effect; lưu reload hoặc receipt đầu nhận. Khi không áp dụng, nêu lý do theo hạng mục, không thêm test vô nghĩa.

## Kết luận
Đã đạt: ...
Chưa đạt/chưa chạy: ...
Gap P/decision còn mở, ảnh hưởng và bước tiếp theo: ...
Người chấp nhận phạm vi, ngày và bằng chứng xác nhận: ...
Không điền Accepted thay người dùng khi chưa có xác nhận thực.
