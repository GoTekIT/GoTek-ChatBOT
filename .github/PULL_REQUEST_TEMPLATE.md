## Phạm vi

- Mã UC/H/E hoặc issue:
- Owner và người tích hợp:
- Base commit (`git rev-parse origin/main`):
- Kết quả nghiệp vụ dự kiến:

## Kiểm tra thay đổi

- [ ] Đã xem `git diff --name-status origin/main...HEAD`; mọi file xoá/đổi tên đều có lý do.
- [ ] Đã đối chiếu file dùng chung với PR/nhánh đang mở của contributor khác.
- [ ] Migration chỉ thêm file mới; không sửa lịch sử đã áp dụng.
- [ ] Không commit `.env`, `.local`, token, dữ liệu khách hoặc output tạm.
- [ ] Đã cập nhật tài liệu trạng thái và handoff nếu hành vi hoặc điểm dừng thay đổi.

## Bằng chứng

- Build/typecheck:
- Test liên quan và DB fixture đã dùng:
- Luồng browser/API thủ công và kết quả:
- Phần chưa kiểm chứng, blocker hoặc quyết định cần owner:

## Review

- [ ] Có người khác kiểm tra file dùng chung, quyền tenant và mọi conflict đã giải quyết.
- [ ] CI trên commit cuối cùng đã PASS trước khi merge.
