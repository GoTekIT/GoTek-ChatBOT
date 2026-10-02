# QUY TẮC PHÂN NHÁNH GIT VÀ QUY TRÌNH PULL REQUEST (PR)

> **Phạm vi áp dụng:** Bắt buộc cho toàn bộ Agent khi phát triển tính năng, sửa lỗi (bugfix) hoặc tối ưu mã nguồn trong repository `GoTek-ChatBOT`.

---

## 1. NGUYÊN TẮC PHÂN NHÁNH (BRANCHING STRATEGY)
1. **Gốc nhánh luôn là `main` mới nhất:**
   - Trước khi bắt đầu bất kỳ chức năng nào: luôn fetch và pull code mới nhất từ `origin/main`.
   - Tạo nhánh mới từ `main` theo quy ước đặt tên:
     + Tính năng: `feature/<ma-chuc-nang>-<ten-ngan-gon>` (ví dụ: `feature/uc11-uc12-document-import-platform-grant`, `feature/uc13-real-ai-answer`)
     + Sửa lỗi: `fix/<ten-loi>` (ví dụ: `fix/db-macos-socket-fallback`)
     + Tài liệu / Chore: `docs/<ten-tai-lieu>` hoặc `chore/<noi-dung>`

2. **Một nhánh tương ứng một chức năng / Use Case:**
   - Không commit trộn lẫn nhiều chức năng không liên quan vào cùng một nhánh nếu chưa có sự đồng ý của User.
   - Nhánh phải độc lập, tự chứa đầy đủ mã nguồn và bài kiểm thử cho chức năng đó.

---

## 2. QUY TRÌNH KHI HOÀN THÀNH CODE (COMPLETION WORKFLOW)
Mỗi khi code và kiểm thử xong chức năng mới, Agent bắt buộc thực hiện các bước sau:
1. **Kiểm tra chất lượng (Quality Gate):**
   - Chạy `npm run build:all` (đảm bảo TypeScript và Vite build xanh 100%).
   - Chạy test suites tương ứng (`npm run test:frontend`, test backend tương ứng).
2. **Commit rõ ràng (Conventional Commits):**
   - Sử dụng định dạng: `feat(...)`, `fix(...)`, `test(...)`, `refactor(...)`.
3. **Push nhánh lên remote (`origin`):**
   - Chạy: `git push -u origin <ten-nhanh-tinh-nang>`.
4. **Cung cấp đường link tạo PR cho User:**
   - Cung cấp đường dẫn trực tiếp trên GitHub: `https://github.com/GoTekIT/GoTek-ChatBOT/pull/new/<ten-nhanh-tinh-nang>`.
   - Tóm tắt các thay đổi chính và kết quả kiểm thử để User chỉ cần nhấn nút Review và Merge PR.
