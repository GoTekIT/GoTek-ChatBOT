# Quy trình cộng tác và bảo vệ mã nguồn

Áp dụng cho mọi thay đổi gửi vào `main`. Source of truth là repository này và commit Git đã được đẩy lên remote. Tài liệu WBS, bản demo và checkout cũ là nguồn tham khảo; chỉ đưa nội dung vào repository qua commit và pull request có người kiểm tra.

## Một người một nhánh và một checkout riêng

- Mỗi task có mã UC/H/E, người phụ trách và danh sách file dự kiến. Nếu hai task cùng sửa một file, thống nhất người tích hợp trước khi coding.
- Mỗi người dùng clone hoặc Git worktree riêng. Không cùng sửa một thư mục làm việc hoặc cùng push lên một nhánh của người khác.
- Tạo nhánh từ `origin/main` mới nhất, ví dụ `feature/UC-014-widget-session` hoặc `codex/collaboration-safety`. Không code trực tiếp trên `main`.
- Trước khi cập nhật, chạy `git status --short`. Commit phần việc đang dở trên nhánh của mình; không bỏ file chưa được Git theo dõi. Không đưa `.env`, `.local`, token, dữ liệu khách hoặc backup vào commit.

```sh
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/UC-xxx-short-name
```

## Đồng bộ khi người khác vừa cập nhật

1. Trên nhánh cá nhân, commit công việc đang dở, rồi chạy `git fetch origin`.
2. Chạy `git merge origin/main`. Nếu Git báo conflict, mở từng file và đối chiếu cả hai thay đổi với yêu cầu nghiệp vụ. Không chọn hàng loạt `ours` hoặc `theirs`.
3. Kiểm tra `git diff --check`, `git diff --name-status origin/main...HEAD` và các file bị xoá/đổi tên. Chạy build, test liên quan và luồng thủ công cần thiết trên DB test riêng.
4. Push nhánh của mình, mở PR vào `main`. Nếu `main` đổi tiếp trước lúc merge, đồng bộ và kiểm tra lại. Người không tạo thay đổi phải review các file dùng chung, migration, auth/tenant, widget và CI.

Không dùng `git reset --hard`, `git clean -fd`, `git push --force`, hoặc xoá nhánh có việc chưa hợp nhất để “sửa nhanh” xung đột. Khi cần bỏ một thay đổi đã merge, tạo PR dùng `git revert` để giữ lịch sử.

## Điều kiện merge

- PR nêu mã task, base commit, file thay đổi, file xoá/đổi tên, cách kiểm tra và phần chưa nghiệm thu. Với thay đổi DB, chỉ thêm migration mới; không sửa migration đã áp dụng.
- CI phải chạy cài đặt sạch từ lockfile, typecheck/build và test. Test PostgreSQL chạy trên DB fixture riêng, theo thứ tự, không dùng DB của người khác.
- Ít nhất một người khác review; xử lý xong các comment. Reviewer kiểm `Files changed`, đặc biệt các file xoá, rename và code tự động merge không báo conflict.
- Chỉ người được giao tích hợp mới merge PR sau khi nhánh cập nhật theo `main`; không push trực tiếp lên `main`.

## Khôi phục khi thấy file mất

Dừng đồng bộ và tìm commit trước, không ghi đè tiếp. `git log --all -- path/to/file` tìm lịch sử của file; `git show <commit>:path/to/file` đọc bản cũ. Với thay đổi local chưa commit, dùng `git reflog` hoặc editor local history nếu có. File chưa từng commit có thể không khôi phục được bằng Git. Khôi phục vào một nhánh/PR riêng, có review và test.

Quy tắc trên giảm nguy cơ mất code đã commit. Nó không thay thế kiểm tra logic: Git có thể tự merge các dòng khác nhau trong cùng file dù hai thay đổi xung đột về nghiệp vụ.
