# Quy trình push an toàn cho nhiều contributor

## Nguyên tắc bắt buộc

- Mỗi người làm trên một nhánh riêng, không commit trực tiếp vào `main`.
- Không dùng `git push --force`, `git reset --hard` trên nhánh dùng chung, hoặc xoá nhánh của người khác.
- Mỗi nhóm thay đổi tạo một Pull Request riêng. PR phải có CI xanh và reviewer khác người push cuối.
- Không dùng nút tự động cập nhật branch khi PR đang conflict nếu chưa kiểm tra danh sách file conflict.

## Trước khi bắt đầu

```bash
git fetch origin --prune
git switch <nhanh-cua-ban>
git status --short --branch
git log --oneline -1
```

Nếu nhánh có thay đổi chưa commit, lưu chúng bằng một commit rõ mục đích hoặc `git stash push -u` có tên. Không xoá thay đổi để làm nhánh sạch.

## Đồng bộ an toàn

```bash
git fetch origin
git diff --name-only HEAD...origin/main
git merge --no-commit --no-ff origin/main
```

Nếu có conflict, dừng merge và đọc từng vùng `<<<<<<<`/`=======`/`>>>>>>>`. Giữ cả hai phần khi chúng phục vụ hai chức năng khác nhau; chạy typecheck/test sau mỗi nhóm file. Nếu chưa đủ ngữ cảnh, huỷ merge bằng `git merge --abort`; thao tác này giữ nguyên commit trước merge.

## Push và Pull Request

```bash
git add <các-file-đã-review>
git commit -m "<mô tả thay đổi>"
git push origin HEAD:<nhánh-cua-ban>
```

Sau khi push, kiểm tra PR có đúng `headRefOid`, CI, review và trạng thái conflict. Chỉ merge khi CI xanh, conflict bằng 0 và đã có approval độc lập. Nếu `main` đổi tiếp, lặp lại quy trình đồng bộ; không viết đè lên nhánh của contributor khác.

## Khôi phục khi có sự cố

Trước thao tác hợp nhất, lưu commit hiện tại bằng `git rev-parse HEAD`. Nếu merge chưa commit gây rối, dùng `git merge --abort`. Nếu đã commit sai trên nhánh cá nhân, tạo nhánh backup từ commit đó và sửa bằng một commit mới; không force-push nhánh đang được người khác sử dụng.
