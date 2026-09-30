# Ngày 2 — Handoff từ widget: kế hoạch chi tiết cho Nguyên

**Dự án:** GoTek Chatbot  
**Ngày làm việc:** 2026-09-30  
**Owner:** Nguyên  
**Phạm vi workshop:** D-UC06 — Khách yêu cầu gặp nhân viên  
**Liên kết phạm vi:** QA-01, BUF-03; D-UC07 chỉ kiểm tra điểm nối Inbox, chưa triển khai toàn bộ takeover trong N2.

## 1. Kết luận ngắn gọn

Task tiếp theo là hoàn thiện luồng **visitor tự bấm “Yêu cầu gặp nhân viên” trên widget** và chứng minh request đó đi đúng vào conversation của Inbox.

Backend hiện đã có nền tảng:

- POST /widget-api/:key/handoff tồn tại trong backend/src/modules/widget/widget.ts.
- Backend đã phân biệt AI_ACTIVE, HANDOFF_PENDING và HUMAN_ACTIVE.
- Backend đã có owner-version fence, kiểm tra origin, visitor token, channel và trạng thái conversation.
- backend/tests/widget-api-flow.test.ts đã kiểm tra request lặp, wrong origin, không cho client tự truyền assignedTo, reopen trạng thái cũ và không tạo thêm AI job sau handoff.

Gap chặn demo hiện tại nằm ở lớp widget:

- backend/public/sdk.js chưa có control “Yêu cầu gặp nhân viên”.
- frontend/public/sdk.js là bản copy tương tự và cũng chưa có control/handler.
- SDK đã render text “Đang kết nối nhân viên”, nhưng không có thao tác làm phát sinh trạng thái đó.
- Vì vậy source có API nhưng visitor chưa thể hoàn thành D-UC06 bằng browser thật.

## 2. Mục tiêu cuối ngày

Khi mở widget bằng channel key và origin hợp lệ, visitor phải có thể:

1. Mở widget và nhìn thấy trạng thái hiện tại là “Trợ lý AI đang hỗ trợ” nếu conversation đang AI_ACTIVE.
2. Nhìn thấy nút rõ ràng, có thể focus bằng bàn phím: “Yêu cầu gặp nhân viên”.
3. Bấm nút một lần để gọi POST /handoff với body rỗng; không gửi assignedTo từ browser.
4. Nhìn thấy trạng thái “Đang kết nối nhân viên” khi backend trả HANDOFF_PENDING.
5. Không nhìn thấy “Nhân viên đang hỗ trợ” trước khi Agent thực hiện takeover trong Inbox.
6. Refresh hoặc reconnect mà không mất visitor token, profile/pre-chat, transcript hay trạng thái pending.
7. Nếu request lặp hoặc click lặp, kết quả vẫn idempotent: không tạo conversation mới, không tăng owner_version sai, không tạo AI job mới.
8. Nếu wrong origin hoặc token hết hạn, widget hiển thị lỗi an toàn và hướng dẫn reconnect; không báo thành công giả.
9. Agent có thể nhìn thấy đúng conversation pending trong Inbox để nối sang N3/N4.

## 3. Hiện trạng và phần phải bổ sung

| Khu vực | Đã có trong code | Cần làm trong N2 | Không được suy diễn |
|---|---|---|---|
| API | POST /:key/handoff trả replyOwner, ownerVersion | Giữ contract hiện tại, chỉ gọi từ SDK | Không tự thêm assignedTo hoặc workspace ID từ client |
| State | AI_ACTIVE, HANDOFF_PENDING, HUMAN_ACTIVE | Map đúng text và control theo từng state | assigned_to không đồng nghĩa Agent đã takeover |
| SDK UI | Status, reconnect, pre-chat, message polling | Thêm nút handoff, trạng thái loading/disabled, retry | Không hiển thị HUMAN_ACTIVE khi mới pending |
| Token/profile | localStorage resume token, session profile | Không xóa khi handoff thành công | Không ghi token/provider secret vào evidence |
| Backend tests | Có nhiều case /handoff | Bổ sung chỉ khi phát hiện gap trong expired-token/contract | Không thay test browser bằng API test |
| Inbox | Có list/polling và takeover | Chỉ xác nhận conversation xuất hiện đúng; takeover đầy đủ là N4 | Không trộn lịch sử/visitor identity của N5 vào N2 |
| Audit | Chưa có audit event riêng handoff_requested | Ghi decision NEEDS PO DECISION; chỉ code nếu được chốt | Không tự gọi là audit-complete |

## 4. Contract phải giữ nguyên

### 4.1 Request

SDK gọi endpoint tương ứng với channel key đã được cấu hình:

- Method: POST
- Path: /handoff
- Headers: Authorization: Bearer visitor-session-token, Content-Type: application/json
- Origin: browser origin hợp lệ do channel policy kiểm tra
- Body: {}
- Không gửi workspace ID, channel ID, assignedTo, provider key hoặc thông tin nội bộ.

### 4.2 Success response

Giữ response hiện tại:

    {
      "replyOwner": "HANDOFF_PENDING",
      "ownerVersion": 1
    }

Nếu conversation đã là HANDOFF_PENDING, request lặp phải trả cùng logical state mà không tạo side effect mới. Nếu đã là HUMAN_ACTIVE, SDK phải hiển thị nhân viên đang hỗ trợ theo state backend trả về.

### 4.3 State mapping trên visitor

| Backend state | Text trên widget | Nút handoff | Ý nghĩa |
|---|---|---|---|
| AI_ACTIVE | Trợ lý AI đang hỗ trợ | Hiển thị, enabled | Visitor có thể yêu cầu người |
| Request đang chạy | Đang kết nối nhân viên... | Disabled | Chưa được kết luận thành công cho tới khi response về |
| HANDOFF_PENDING | Đang kết nối nhân viên | Disabled hoặc đổi thành trạng thái đã yêu cầu | Đã xin người, chưa có takeover |
| HUMAN_ACTIVE | Nhân viên đang hỗ trợ | Disabled/ẩn theo quyết định UI | Agent đã takeover |
| Lỗi mạng/unknown outcome | Giữ state trước đó, hiển thị lỗi retry | Cho phép retry có kiểm soát | Không tự chuyển sang HUMAN_ACTIVE |

### 4.4 Các lỗi bắt buộc

- DOMAIN_DENIED: hiển thị website chưa được phép sử dụng channel; không retry mù liên tục.
- VISITOR_SESSION_EXPIRED: dùng flow reconnect hiện có; không xóa profile hợp lệ ngoài phạm vi session.
- 401: xác nhận visitor chưa có hoặc token không hợp lệ.
- 403: xác nhận origin/channel không hợp lệ; không lộ dữ liệu conversation.
- Timeout/network/unknown outcome: hiển thị “Không xác định được trạng thái, thử lại”; cho phép visitor bấm lại sau khi request cũ đã kết thúc. Không tạo request song song.

## 5. Kế hoạch thực thi theo thứ tự

### Bước 1 — Chốt baseline trước khi sửa

Ghi lại commit hiện tại và chạy lại:

- npm run test:backend -- --test-name-pattern=widget-api-flow
- npm run test:backend -- --test-name-pattern=widget-boundary
- npm run test:frontend
- npm run build:all

Nếu baseline fail, ghi defect trước; không trộn defect cũ với thay đổi N2.

### Bước 2 — Xác định SDK canonical

Hiện có hai file:

- backend/public/sdk.js: bản được backend phục vụ trực tiếp.
- frontend/public/sdk.js: bản copy dùng ở frontend/public.

Nếu chưa đủ thời gian tạo build pipeline, sửa bản backend trước rồi đồng bộ nguyên nội dung sang bản frontend. Sau đó kiểm tra hai file có cùng SHA-256. Không cho hai bản có khác hành vi.

### Bước 3 — Thêm control accessible vào widget

Trong template Shadow DOM:

- Thêm button riêng, có class/selector ổn định, ví dụ handoff.
- Label ban đầu là “Yêu cầu gặp nhân viên”.
- Đặt gần status.
- Button phải có type button, không được vô tình submit form gửi message.
- Có aria-describedby hoặc status live đủ rõ; khi loading phải có text/disabled state dễ nhận biết.
- Giữ focus ring hiện có và kiểm tra thao tác bàn phím.
- Không dùng text mơ hồ như “Hỗ trợ”.

### Bước 4 — Thêm state và handler handoff

Handler phải tuân thủ thứ tự:

1. Nếu chưa có token hoặc profile/pre-chat chưa hợp lệ: không gọi API.
2. Nếu đang có request handoff: return ngay, không phát sinh request thứ hai.
3. Nếu đã HANDOFF_PENDING hoặc HUMAN_ACTIVE, không gọi lại vô ích.
4. Đặt handoffBusy=true, disable button và cập nhật label/status tạm thời.
5. Gọi api('/handoff', 'POST', {}).
6. Khi thành công, dùng cùng logic setOwner(replyOwner, ownerVersion) đang dùng cho state/messages.
7. Không xóa token, localStorage, profile fields, cursor, transcript hoặc pending message.
8. Khi lỗi, hiển thị thông báo phù hợp, giữ khả năng retry có kiểm soát, rồi luôn reset handoffBusy trong finally.
9. Polling tiếp tục chạy; response click không phải bằng chứng Agent đã takeover.

### Bước 5 — Điều chỉnh UI theo state

Đảm bảo:

- connect() nhận AI_ACTIVE: nút hiện và có thể bấm.
- connect() nhận HANDOFF_PENDING: nút disabled/đã yêu cầu; status đúng pending.
- poll() nhận state mới: status và nút cập nhật theo setOwner.
- HUMAN_ACTIVE chỉ xuất hiện khi backend thật trả state đó sau takeover.
- Reconnect sau refresh không quay về AI chỉ vì UI khởi tạo mặc định.
- Nếu session trả trạng thái pending, không reset nút về label ban đầu.

### Bước 6 — Kiểm tra backend contract và boundary

Không sửa backend nếu contract hiện tại đã đáp ứng. Chỉ bổ sung test khi gap được chứng minh:

- Không auth → 401.
- Wrong origin → 403.
- Body có assignedTo → 400.
- Hai request đồng thời → cùng logical pending, một transition hợp lệ.
- Request lại trên HANDOFF_PENDING không tăng version sai.
- HUMAN_ACTIVE không bị visitor hạ ngược về pending.
- Resolved/snoozed theo contract hiện tại được kiểm tra và ghi expected result.
- Token hết hạn/visitor khác channel bị chặn.
- Handoff không enqueue thêm AI job.
- Cross-tenant/channel không đọc hoặc sửa được conversation khác.

### Bước 7 — Contract test cho SDK

Mục tiêu là bắt lỗi “API có nhưng UI không có action”.

Mở rộng backend/tests/sdk-contract.test.ts để kiểm tra:

- Có /handoff.
- Có label “Yêu cầu gặp nhân viên”.
- Có selector/handler handoff ổn định.
- Có text “Đang kết nối nhân viên” và “Nhân viên đang hỗ trợ”.
- Có logic disable khi request đang chạy hoặc state pending/human.
- Có xử lý lỗi/reconnect.
- Không có provider URL, API key hoặc secret trong SDK.
- backend/public/sdk.js và frontend/public/sdk.js đồng nhất.

Nếu có thể chạy SDK trong DOM harness, thêm assertion click liên tục chỉ tạo một request khi request trước chưa hoàn thành. Nếu harness chưa có, ghi đây là browser-only check, không gọi là unit pass.

### Bước 8 — Browser smoke và evidence thật

Dùng fixture local N1, origin hợp lệ và hai vai trò visitor/Agent. Không dùng Supabase shared để seed/reset.

Trình tự:

1. Reset fixture.
2. Seed fixture và mở website có widget.
3. Chụp trạng thái trước click: AI_ACTIVE, nút enabled.
4. Mở Network log đã redact token và chụp POST /handoff body {}.
5. Chụp response HANDOFF_PENDING và version.
6. Chụp widget sau click: Đang kết nối nhân viên, không có Nhân viên đang hỗ trợ.
7. Refresh/reconnect; chụp profile/pre-chat và transcript còn nguyên.
8. Click lặp; ghi request count và version.
9. Mở Inbox; xác nhận conversation ID đúng.
10. Chạy wrong-origin và expired-token; lưu screenshot/error transcript riêng.
11. Reset fixture và ghi cleanup count bằng 0.

Evidence phải có timestamp, commit/source version, test command và không chứa bearer token, password, provider secret hoặc full PII không cần thiết.

## 6. Ma trận test N2

| ID | Tình huống | Kỳ vọng | Bằng chứng |
|---|---|---|---|
| N2-01 | AI active, click một lần | HANDOFF_PENDING, version tăng đúng một lần | Screenshot + network + DB/API |
| N2-02 | Double click rất nhanh | Chỉ một request đang xử lý; không duplicate side effect | Network count + response |
| N2-03 | Click sau khi pending | Không tăng version sai; button vẫn disabled/đã yêu cầu | API + UI |
| N2-04 | Refresh khi pending | Token/profile/transcript còn; status vẫn pending | Before/after screenshot |
| N2-05 | Reconnect sau network error | Có retry có kiểm soát; không request song song | Network log |
| N2-06 | Wrong origin | 403, UI không báo thành công, không lộ dữ liệu | Redacted response |
| N2-07 | Expired token | Flow session-expired/reconnect đúng, không crash widget | Screenshot + console sạch |
| N2-08 | Already human active | Hiển thị nhân viên, không hạ state về pending | API + UI |
| N2-09 | Resolved/snoozed | Kết quả đúng contract hiện tại | API + DB state |
| N2-10 | Assigned agent nhưng chưa takeover | Vẫn pending, không hiển thị human active | Inbox + widget |
| N2-11 | Tenant/channel khác | Bị chặn, không đọc/sửa conversation ngoài scope | Boundary test |
| N2-12 | Internal note | Không xuất hiện trong visitor widget | Messages response + screenshot |
| N2-13 | AI job sau handoff | Không có job AI mới cho conversation pending | DB query/evidence |
| N2-14 | SDK copies | Hai bản có cùng hành vi và checksum | SHA-256 log |

## 7. Files dự kiến được phép thay đổi

Chỉ mở rộng tối thiểu:

- backend/public/sdk.js — SDK được backend phục vụ.
- frontend/public/sdk.js — bản đồng bộ dùng trong frontend.
- backend/tests/sdk-contract.test.ts — contract cho control/handler/state.
- backend/tests/widget-api-flow.test.ts hoặc boundary test — chỉ nếu phát hiện case còn thiếu.
- plan_nguyen/10day/evidence/N2-HANDOFF-TEST-RESULT-2026-09-30.md — log kết quả/evidence.
- plan_nguyen/10day/NGAY-2-TIEN-DO-2026-09-30.md — trạng thái cuối ngày.

Không mở rộng trong N2:

- Không làm visitor identity/history đầy đủ của D-UC08; đó là N5.
- Không làm toàn bộ takeover/public reply/receipt; đó là N4.
- Không sửa Knowledge, provider, quota hoặc production deployment.
- Không thêm CRM/ticket/automation.
- Không thêm audit event nếu chưa có product decision; chỉ ghi blocker.
- Không chạy migration/destructive command trên Supabase dùng chung.

## 8. Lệnh kiểm tra và tiêu chí pass

Các lệnh cần chạy:

- npm run test:backend -- --test-name-pattern=widget-api-flow
- npm run test:backend -- --test-name-pattern=widget-boundary
- npm run test:backend -- --test-name-pattern=sdk-contract
- npm run test:frontend
- npm run build:all
- npm run test:backend

Nếu script không hỗ trợ --test-name-pattern, chạy file/test command tương ứng và ghi lệnh thực tế vào evidence; không ghi PASS khi lệnh chưa chạy.

### Định nghĩa DONE nghiêm ngặt

N2 chỉ được đánh dấu DONE — LOCALLY VERIFIED khi:

- [ ] Visitor nhìn thấy nút Yêu cầu gặp nhân viên trên browser thật.
- [ ] Click nút tạo đúng POST /handoff body {} qua origin hợp lệ.
- [ ] UI chuyển sang Đang kết nối nhân viên khi backend trả pending.
- [ ] UI không hiển thị Nhân viên đang hỗ trợ trước takeover.
- [ ] Double click/retry/refresh/reconnect không tạo duplicate hoặc mất dữ liệu.
- [ ] Wrong origin và expired token có kết quả chặn đúng.
- [ ] Inbox nhìn thấy đúng conversation pending.
- [ ] Profile/pre-chat/transcript còn nguyên sau handoff.
- [ ] Không có AI job mới sau handoff.
- [ ] Hai SDK copy đồng nhất.
- [ ] SDK contract test, targeted backend tests, frontend tests và build pass.
- [ ] Có screenshot/video live và API transcript đã redact.
- [ ] Fixture reset xong, cleanup kiểm tra còn 0 dữ liệu fixture.

Nếu chỉ pass API/unit mà chưa có browser evidence, trạng thái phải là IMPLEMENTED — NEEDS BROWSER VERIFICATION, không phải DONE.

## 9. Đánh giá nghiêm ngặt trước khi làm

| Hạng mục | Điểm hiện tại | Điểm có thể đạt cuối N2 |
|---|---:|---:|
| Backend handoff contract | 8/10 | 8/10 |
| Widget action/UI | 2/10 | 8/10 |
| State correctness | 6/10 | 9/10 |
| Error/retry handling | 4/10 | 8/10 |
| Browser evidence | 0/10 | 8/10 nếu chạy live |
| Cross-tenant/privacy proof | 7/10 | 8/10 |
| Khả năng lặp lại bằng fixture | 8/10 | 9/10 |
| **D-UC06 tổng thể** | **5/10** | **8/10** |

Chưa chấm 9–10/10 trong N2 vì takeover, public reply, receipt, resolve/history và sign-off thuộc các ngày sau. Điểm 8/10 chỉ hợp lệ khi có browser evidence thật; không tính source code đơn thuần.

## 10. Rủi ro và cách xử lý

- Hai SDK lệch nhau: kiểm checksum sau mỗi sửa; nếu lệch thì chưa pass.
- UI báo human quá sớm: chỉ lấy replyOwner từ backend; không suy ra từ việc request /handoff đã gửi.
- Click nhiều lần: có lock trong lúc request; test network count và owner version.
- Unknown outcome: không retry vô hạn; cho visitor nút retry rõ ràng sau khi request cũ kết thúc.
- Token hết hạn: dùng flow reconnect hiện có, không giữ token hỏng trong localStorage.
- Inbox không thấy conversation: đánh dấu blocker cho N3, không thay bằng conversation seed khác.
- Audit event chưa chốt: ghi NEEDS PO DECISION, không tự tuyên bố compliance hoàn chỉnh.
- Browser evidence thiếu: trạng thái cuối ngày là NEEDS VERIFICATION dù toàn bộ test tự động pass.

## 11. Bàn giao cuối ngày

Cuối N2 phải cập nhật:

1. File tiến độ N2 với trạng thái từng mục.
2. Evidence N2 gồm test log, browser screenshot/video, redacted network transcript, checksum SDK và reset proof.
3. Defect register nếu có P0/P1/P2; mỗi defect có bước tái hiện, severity, owner và next action.
4. Handoff note cho N3: conversation fixture nào đang pending, Inbox có thấy chưa, audit decision còn mở không.

**Next gate:** sau khi N2 đạt, chuyển sang N3 — kiểm tra handoff permission, inbox visibility, assigned-to/reply-owner và cross-tenant boundary; không gọi takeover là hoàn thành chỉ vì visitor đã bấm handoff.
