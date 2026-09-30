# Tiến độ Ngày 2 — Visitor chat widget

**Ngày:** 30/09/2026  
**Phạm vi:** N2 / D-UC06 — khách yêu cầu gặp nhân viên  
**Trạng thái:** IMPLEMENTED — NEEDS BROWSER VERIFICATION

## Đã làm

- Thiết kế lại visitor widget trong `backend/public/sdk.js` theo GoTek palette: header, launcher, status, message bubbles, pre-chat, composer, error/reconnect và mobile layout.
- Thêm trang visitor public không login tại `frontend/src/screens/customer-chat/CustomerChatPage.tsx`, route `/chat/{publicKey}`; public key phân biệt channel/doanh nghiệp A/B.
- Trang public tự tải SDK, tự mở khung chat và không gọi flow `/api/me`.
- Thêm nút `Yêu cầu gặp nhân viên` cho trạng thái `AI_ACTIVE`.
- Gọi `POST /widget-api/:key/handoff` với body rỗng; khóa double-click và giữ trạng thái `HANDOFF_PENDING`/`HUMAN_ACTIVE` theo backend.
- Giữ visitor token, profile, transcript và cursor khi reconnect; không đưa provider secret vào SDK.
- Đồng bộ `frontend/public/sdk.js` với bản backend; SHA-256 hai file giống nhau.
- Mở rộng SDK contract test để kiểm tra `/handoff`, label và state text.

## Kiểm tra đã chạy

- `npx tsx --test tests/sdk-contract.test.ts` — **1/1 PASS**.
- `npm run build:all` — **PASS**; backend typecheck và frontend Vite build.
- `npm run test:frontend` — **5/5 PASS**.
- Public pages `/chat/{publicKey}` của A/B trả **200**; widget config/session với `Origin: http://localhost:3001` tạo được cho cả hai channel.
- Browser tab local đã được mở tại `http://localhost:3001` để chuẩn bị kiểm tra UI.

## Chưa được tuyên bố hoàn tất

- Chưa có browser evidence visitor thật từ session → message → handoff → Inbox.
- Chưa kiểm tra screenshot/network transcript đã redact, wrong origin, expired token và double-click trên browser.
- Chưa chứng minh Agent takeover, public reply receipt và internal note boundary trong cùng một vòng browser.
- Hai origin fixture `fixture-a.example.test` và `fixture-b.example.test` chưa có website DNS/TLS thật; cần API Origin đúng hoặc channel local origin cho browser smoke.
- Local fixture A/B hiện dùng chung origin `http://localhost:3001` để demo direct-link; public key vẫn là boundary chọn channel. Khi reset/seed lại, truyền `GOTEK_FIXTURE_ORIGIN=http://localhost:3001`.

## Bước tiếp theo chính xác

1. Mở channel test có origin local hoặc website fixture được phép.
2. Chụp trạng thái `AI_ACTIVE` và nút handoff.
3. Gửi message, bấm handoff, kiểm tra `HANDOFF_PENDING` và request count.
4. Đăng nhập Agent A/B để kiểm tra đúng conversation và tenant boundary.
5. Ghi evidence N2, chạy targeted widget tests và cập nhật trạng thái chỉ khi browser gate đạt.

## Link local hiện tại

- Workspace A: `http://localhost:3001/chat/DbObkx_mDoNlgQ3k-amdccN7zBC9Gm6ftkcf1zoaRgU`
- Workspace B: `http://localhost:3001/chat/D_UhYj_fMSVRh9aVkbGwEk2ltdMMWJyPtVS_kpcF0bs`

Các link này là link visitor public local, không yêu cầu đăng nhập. Conversation mới trong schema hiện mặc định `HANDOFF_PENDING`; không suy ra AI live hoặc Agent takeover chỉ từ việc trang mở được.
