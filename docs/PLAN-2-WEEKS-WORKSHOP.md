# Kế hoạch hai tuần hoàn thiện core GoTek Chatbot cho workshop

Ngày lập và cập nhật đa nền tảng: 30/09/2026. Snapshot đối chiếu: `d0c22f3`. Đội triển khai: 3 người, ký hiệu A, B, C cho đến khi gán tên. Mỗi người nhận UC trọn luồng, bao gồm dữ liệu, xử lý nghiệp vụ, giao diện, kiểm thử và bằng chứng nghiệm thu. Không chia người theo backend hoặc frontend.

Mục tiêu mở rộng: doanh nghiệp publish chính sách → khách hỏi qua Website hoặc Facebook Messenger → AI/Agent trả lời về đúng kênh → usage và audit ghi nhận đúng workspace. Instagram là loại kênh dự phòng thiết kế, chưa cam kết tích hợp trong đợt này. Đây là kế hoạch hoàn thiện các lát cắt đang có, không phải viết lại năm module từ đầu.

**Mốc 05/10 đang cần xác nhận là ngày workshop hay ngày bắt đầu.** Mốc hai tuần là D1–D10 cho triển khai và demo theo evidence; với phạm vi đa nền tảng, lịch đầy đủ đề xuất là D1–D13 gồm 3 ngày kiểm thử bổ sung. Không cam kết đủ 22 UC được nghiệm thu trong D10. Nếu bắt đầu 01/10 thì D10=14/10, D13=19/10; nếu bắt đầu 05/10 thì D10=16/10, D13=21/10/2026. Nếu workshop là 05/10, áp dụng mốc demo rút gọn tại phần 7; không coi còn đủ hai tuần trước workshop.

## 1. Nguồn và phạm vi đối chiếu

- Tài liệu nghiệp vụ: `/Users/loiphan/Downloads/NGHIEP-VU-5-MODULES.docx`, các mục 3–7 và 10. Tài liệu không đặt mã UC; mã UC-01–UC-18 dưới đây là phân rã đề xuất cho sprint này.
- Trạng thái và bàn giao: [PROJECT-STATUS](PROJECT-STATUS.md), [HANDOFF](HANDOFF.md), [KNOWN-ISSUES](KNOWN-ISSUES.md).
- Phạm vi H/E: [BACKLOG](../delivery/BACKLOG.csv), chỉ ánh xạ lát cắt core; hoàn thành một UC không đóng toàn bộ nhóm H.
- Đã đọc đường đi ứng dụng hiện hành, route API, các module core và các test liên quan. Chưa xác minh hành vi bằng browser hoặc provider thật trong lần lập kế hoạch này.
- Không sửa code sản phẩm, không thay đổi trạng thái nghiệm thu các module trong lần lập kế hoạch này.

## 2. Dự án hiện có gì và còn thiếu gì cho demo

| Phần nghiệp vụ | Bằng chứng trong code hiện tại | Khoảng trống cần xử lý |
|---|---|---|
| Đăng nhập và workspace | `App.tsx` gọi `/me`, logout và switch; `auth.service.ts` có signup/login; membership và RLS có code/test | Lấy baseline mới sau refactor; chạy login/switch/logout trên browser; kiểm lỗi origin/proxy/session |
| Inbox và widget | `modules/chat/inbox.ts`, `modules/widget/widget.ts`, `backend/public/sdk.js` có lưu message, takeover, trạng thái và receipt | Console mới khởi tạo conversation mẫu; gửi/takeover/resolve chủ yếu đổi React state. Widget demo phản hồi bằng timer; cần dùng SDK thật |
| Knowledge | `knowledge.routes.ts` có import/process/publish/rollback; lifecycle và retrieval có code/test | Console mới dùng tài liệu mẫu. Màn Knowledge cũ gọi API nhưng publish cố định `INTERNAL`; phải có thao tác publish `PUBLIC` rõ ràng cho visitor |
| Nhân viên và quyền | `member.routes.ts`, `member.service.ts`, membership tests; màn `MembersSettings.tsx` có API | Console mới tạo danh sách nhân viên mẫu; invite/đổi role/revoke chỉ cập nhật state và toast; phải nối lại luồng thật |
| AI | Có provider/model/grant, worker, retrieval, ownership fence và test transport giả | Cần một model thật được phép dùng, worker chạy, nguồn PUBLIC, bật AI rõ ràng và bằng chứng câu trả lời thật |
| Quota và usage | Có reservation/settlement, ledger; API `/usage`, `/usage/ai`; màn Usage cũ có API | `/app/usage` hiện ánh xạ sang Analytics có số cố định; cần số từ API và đối soát theo operation, không dùng KPI mẫu làm evidence |
| Audit và vận hành | Có audit API, durable jobs, restore drill và tests | Audit modal mới dùng dữ liệu mẫu; cần đọc event thật, xác minh unknown/recovery, chạy lại restore trên DB dùng một lần |

Các phát hiện cần đưa vào sprint:

1. `frontend/src/screens/console/ConsoleWorkspace.tsx` import `INITIAL_*` từ `mockData.ts`; các handler tài liệu, nhân viên và hội thoại cập nhật state cục bộ. Phải kiểm chứng lưu dữ liệu qua reload và đăng nhập lại, không nghiệm thu bằng toast.
2. `frontend/src/components/widget/CustomerWidgetView.tsx` tự sinh trả lời sau một giây. Buổi demo core phải dùng trang nhúng `backend/public/sdk.js` và visitor session thật.
3. `frontend/src/hooks/useRealtimeChat.ts` gọi `/api/inbox/conversations/:id/stream`, trong khi router hiện được mount thành `/api/conversations/:id/stream`. Đây là lệch contract nhìn thấy từ source, chưa phải kết quả tái hiện browser. Hook còn mô phỏng kết nối thành công với ID mẫu `conv-1`.
4. SSE hiện giữ workspace/conversation của kết nối, chưa thấy cơ chế tái kiểm quyền theo membership/session trong hub. Workspace stream phát snippet toàn workspace; cần kiểm Agent ngoài channel và phiên đã revoke. Nếu chưa đạt, giữ luồng polling API đã kiểm quyền và không phát stream vượt quyền; không cần SSE để đạt demo core.
5. Hub SSE nằm trong memory của process API; worker AI chạy process riêng. Không được giả định trả lời AI luôn đến browser qua stream; cần tải bù từ message API/sequence và chống trùng sau reconnect.
6. Màn Knowledge cũ publish `INTERNAL` cố định, không thể dùng nguyên trạng để chứng minh AI trả lời từ PUBLIC. Không đổi mọi tài liệu thành public; người có quyền phải chủ động chọn audience.
7. `/app/usage` đang trỏ vào dashboard mẫu. Quota lượt trả lời, token và chi phí là các đơn vị riêng; trường chi phí/usage ước tính phải có nhãn `estimated`, không gọi là hóa đơn provider.
8. Các tài liệu còn dẫn `src/server`, `src/web` và kết quả 27/09 trong khi code đã ở `backend/`, `frontend/` và có thay đổi 30/09. Cần evidence theo commit triển khai mới.

Kiểm tra thực hiện ngày lập kế hoạch: `npm run build:all` dừng vì thiếu `tsc`; `npm run test:frontend` dừng vì thiếu `tsx`. Đây là trở ngại dependency ở checkout hiện tại, chưa kết luận source build lỗi. Chưa chạy `npm run test:all`, DB integration, restore drill, browser E2E hoặc live provider. Không dùng 175/175 của 27/09 làm kết quả cho snapshot hiện hành.

## 3. Phạm vi hai tuần và phân công theo UC

**P0** là điều kiện để gọi demo core đạt. **P1** là phần hoàn thiện trong hai tuần, cắt trước nếu trễ. Ước lượng là ngày công tập trung của người phụ trách, đã gồm sửa nối UI/API và kiểm thử UC; không phải thời gian xây mới toàn module. Cần ước lượng lại cuối D1 sau khi môi trường chạy. Các quan hệ phụ thuộc là luồng dữ liệu; có thể phát triển trên fixture thật trong DB và contract đã thống nhất để không chờ nhau.

| UC | Actor và kết quả nghiệp vụ | Mức | Người | Ngày công | Phụ thuộc | Ánh xạ nguồn |
|---|---|---|---|---:|---|---|
| UC-01 | Owner/Agent đăng nhập, vào đúng workspace, chuyển workspace và logout | P0 | A | 1 | Môi trường | H01, H02; mục 2, 6 |
| UC-02 | Owner mời thành viên, thành viên nhận lời mời, đổi role đúng quyền | P1 | A | 1 | UC-01 | H16; mục 6 |
| UC-03 | Owner thu hồi quyền; Agent chỉ đọc channel được cấp; tenant khác bị chặn | P0 | A | 1.5 | UC-01; phối hợp UC-04/06 | H02, H16, H28; mục 6, 9 |
| UC-04 | Owner tạo channel website, gán Agent, lấy mã nhúng và cấu hình origin | P0 | B | 1.5 | UC-01 hoặc tài khoản fixture | H04, H05; mục 2, 4 |
| UC-05 | Visitor mở widget thật, gửi tin, tải lại/retry mà không nhân message | P0 | B | 1.5 | UC-04 | H04, H06, H07; mục 3, 4 |
| UC-06 | Agent đọc inbox, trả lời public và ghi note nội bộ | P0 | B | 1.5 | UC-05, UC-03 | H03; mục 4 |
| UC-07 | Agent takeover, chặn AI cũ, chủ động chuyển lại AI | P0 | B | 2 | UC-06; contract với UC-13 | H03, H08; mục 3.2, 4 |
| UC-08 | Agent resolve và reopen hội thoại; trạng thái lưu qua reload | P1 | A | 0.5 | UC-06 | H03; mục 4.1 |
| UC-09 | Owner tạo/sửa FAQ hoặc chính sách dạng draft và đọc lại | P0 | C | 1 | UC-01 hoặc fixture | H10; mục 5 |
| UC-10 | Owner process thành READY, publish PUBLIC có chủ ý, kiểm nguồn hiện hành | P0 | C | 1 | UC-09 | H10; mục 5.1 |
| UC-11 | Owner import một DOCX hoặc PDF văn bản, xem lỗi và rollback version | P1 | C | 1 | UC-09, UC-10 | H10, H12; mục 5.1–5.2 |
| UC-12 | Platform Admin cấu hình một provider/model, cấp grant cho workspace | P0 | C | 0.5 | Test credential hợp lệ | H08, H28; mục 7.1 |
| UC-13 | Visitor nhận câu trả lời AI thật từ knowledge PUBLIC và nguồn tương ứng | P0 | C | 2 | UC-05, UC-10, UC-12; guard quota hiện có | H08, H10; mục 3, 8 |
| UC-14 | Visitor hỏi ngoài nguồn hoặc provider lỗi; hệ thống phản hồi rõ/chuyển người an toàn | P0 | C | 1 | UC-13, UC-07 | H03, H08, H09; mục 3.2 |
| UC-15 | Hệ thống reserve/settle/release/unknown; chặn hết quota/grant và retry trùng | P0 | A | 1.5 | UC-12; AI contract hiện có | H23, H28, H32; mục 7 |
| UC-16 | Owner xem quota/usage thật và đối chiếu một câu trả lời với ledger | P0 | A | 1 | UC-15, UC-13 | H23; mục 7.2 |
| UC-17 | Owner xem audit publish/takeover/grant đúng phạm vi quyền | P0 | A | 1 | UC-03, UC-07, UC-10, UC-12 | H22, H28; mục 9 |
| UC-18 | Người vận hành khởi động lại worker và khôi phục dữ liệu demo có kiểm chứng | P0 | C | 0.5 | Fixture core và công cụ restore hiện có; kiểm lại toàn luồng D11–D13 | H32; mục 9, 10 |
| UC-19 | Owner quản lý loại kênh, cấu hình riêng và lọc inbox theo nền tảng | P0 đa nền tảng | B | 1 | UC-01 hoặc fixture; contract chốt đầu D1 | H04, H30, E10; bổ sung đa nền tảng |
| UC-20 | Owner kết nối, ngắt và kết nối lại Facebook Page | P0 đa nền tảng | A | 2 | UC-19; Meta app/Page test, quyền và callback hợp lệ | H21, H28, H30, E10; bổ sung đa nền tảng |
| UC-21 | Khách nhắn Messenger và Agent nhận đúng hội thoại trong inbox | P0 đa nền tảng | B | 2.5 | UC-19, UC-20; message/identity contract | H03, H13, H30, E10; bổ sung đa nền tảng |
| UC-22 | Agent hoặc AI trả lời về đúng Messenger và theo dõi kết quả gửi | P0 đa nền tảng | C | 2.5 | UC-20, UC-21; UC-07, UC-13, UC-15 phối hợp nghiệm thu | H03, H08, H23, H30, H32, E10; bổ sung đa nền tảng |

Tổng mới: **22 UC, 29 ngày công triển khai**, A = 9.5, B = 10, C = 9.5. UC-08 chuyển sang A để cân tải. Thêm 9 ngày công kiểm thử/tập demo: **38 ngày công, khoảng 13 ngày làm việc cho 3 người**, chưa tính chờ quyền bên ngoài. Hai tuần có 30 ngày công nên không còn 3 ngày dự phòng như bản website. D10 là mục tiêu hoàn thành triển khai; D11–D13 là mốc nghiệm thu đề xuất. Nếu phải cố định demo D10, chỉ chốt những UC có evidence; phần chưa đạt tiếp tục mở.

**Phạm vi demo tối thiểu:** hai workspace dữ liệu giả lập để kiểm cách ly; trên sân khấu dùng một workspace; ba vai trò Owner, Agent, Platform Admin; một website channel và một Facebook Page Messenger thử nghiệm; một provider/model chat; FAQ nhập tay; quota lượt AI và usage token. Semantic embedding không là điều kiện bắt buộc: lexical retrieval hiện có có thể đáp ứng bộ FAQ demo nếu kết quả đúng.

**Để sau workshop:** crawl web/JS/sitemap nâng cao, nhiều provider và fallback phức tạp, billing/thanh toán, CSAT/SLA dashboard, CRM pipeline, Lark, các mạng xã hội ngoài Facebook Messenger, mobile, Kubernetes/Terraform rollout, redesign UI và parity toàn bộ HiChat. Các mục vẫn nằm trong backlog, không bị xóa. Support grant không nằm trong kịch bản sân khấu; vẫn phải giữ ranh giới Platform Admin và tenant, kiểm quyền âm hiện có.

## 4. Điều kiện nghiệm thu từng UC

| UC | Tình huống thành công cần chứng minh | Tình huống lỗi hoặc quyền âm bắt buộc |
|---|---|---|
| UC-01 | Login, refresh, switch và logout từ browser; danh tính/role do API trả | Sai mật khẩu; workspace không thuộc membership; logout không tiếp tục đọc; xóa cache tenant cũ |
| UC-02 | Invitation lưu thật; thành viên test nhận lời mời và đăng nhập đúng role | Agent không mời/đổi role; lời mời hết hạn/revoke bị từ chối. Local token không được gọi là email đã gửi thật |
| UC-03 | Owner/Agent thấy đúng dữ liệu; revoke có hiệu lực với request tiếp theo | Tenant A không thấy inbox/knowledge/usage B; Agent ngoài channel không nhận snippet; stream cũ bị đóng hoặc kiểm lại quyền |
| UC-04 | Channel và assignment lưu DB; mã nhúng chạy trên origin đã cho phép | Origin sai/disabled channel bị chặn; widget không có provider secret |
| UC-05 | Visitor gửi, inbox nhận đúng conversation; reload còn tin; receipt theo contract | Gửi lại cùng clientId không tạo message/job mới; session hết hạn báo rõ; pre-chat bắt buộc được kiểm nếu bật |
| UC-06 | Public reply đến visitor; note chỉ nhân viên đọc; UI tải lại dữ liệu thật | Không lộ note ở widget hoặc stream; gửi thất bại không hiện sent; reconnect tải bù và không nhân đôi |
| UC-07 | Phân biệt `reply_owner` với `status`; takeover và resume dùng owner version | Hai Agent tranh nhận; AI đang chạy thì takeover; câu AI cũ không được append. Mặc định chờ người thì phải bật AI rõ ràng trước khi hỏi |
| UC-08 | Resolve rồi reopen thể hiện đúng DB và UI | Không tự đồng nhất resolved với AI_ACTIVE; hành vi khi visitor nhắn lại phải được chốt và kiểm riêng |
| UC-09 | Tạo, sửa, mở lại draft; phiên bản nội dung có thật | Agent không được sửa nếu role không cho phép; input lỗi trả thông báo; không đổi draft thành public ngầm |
| UC-10 | Draft → READY → PUBLIC; câu hỏi trả từ phiên bản đang publish | Draft/INTERNAL/tenant khác bị loại; publish stale revision trả conflict; sửa draft không thay bản đang phục vụ |
| UC-11 | Một file văn bản phù hợp giới hạn parser → draft → review → publish; rollback về bản hợp lệ | File hỏng/quá giới hạn báo lỗi; retry import không nhân dữ liệu. Không hứa OCR hoặc mọi PDF/DOCX |
| UC-12 | Probe model test; grant active/capability đúng; secret ở server | Sai capability, grant hết hạn/revoke hoặc provider disabled bị chặn; Platform Admin không tự đọc chat tenant |
| UC-13 | Câu hỏi chính sách nhận câu trả lời đúng từ provider thật; trace được nguồn/version | Private/draft không vào context; citation chỉ theo contract nguồn thực; không dùng reply timer hoặc local adapter làm bằng chứng live AI |
| UC-14 | Ngoài nguồn chuyển trạng thái phù hợp; Agent tiếp nhận được | Timeout/unknown không resend mù; không bịa trả lời có nguồn; thông báo lỗi không lộ credential |
| UC-15 | Quan sát reservation và settlement theo operation; release khi chắc chắn chưa dispatch | Hai request gần quota; retry cùng operation; grant hết hạn trước dispatch; unknown giữ trạng thái chờ reconcile, không tự release rồi gọi lại |
| UC-16 | `/usage` và `/usage/ai` phản ánh DB; đối soát trước/sau một lượt | Không cộng token với lượt AI; số estimated ghi rõ; user tenant khác không đọc được; không trình bày fixed KPI thành đo đạc thật |
| UC-17 | Audit có actor, workspace, hành động, thời điểm; publish/takeover/grant có evidence tương ứng | Platform audit xem ở đúng console; không ép mọi event vào workspace audit; nội dung log không chứa secret |
| UC-18 | Worker restart có kiểm soát; restore drill vào DB dùng một lần có báo cáo | Không replay external side effect sau restore; unknown cần reconcile; không dùng DB demo đang trình diễn làm đích test phá hủy |
| UC-19 | Website và Messenger có loại kênh/tên tài khoản rõ; inbox lọc theo kênh; dữ liệu website cũ giữ nguyên | Không đổi loại kênh đã có hội thoại; Agent chỉ thấy kênh được cấp; không ép Messenger có origin/public_key |
| UC-20 | Xác minh quyền tài khoản; lưu kết nối server-side; hiển thị trạng thái và audit connect/disconnect/reconnect | Sai tenant/Page hoặc callback state bị từ chối; token không ra UI/log; revoke/expiry chặn dispatch; reconnect không nhân kênh |
| UC-21 | Webhook hợp lệ được lưu bền vững rồi xử lý; ánh xạ Page và người gửi về đúng tenant/channel; inbox có nhãn Messenger | Sai chữ ký/Page không tạo dữ liệu; event lặp không nhân message/job; receipt/echo không thành câu hỏi mới; không gộp khách theo tên/email |
| UC-22 | Một outbound operation gửi đúng Page/người nhận; có provider message ID; public reply và AI qua cùng adapter; UI phân biệt accepted/delivered/failed/unknown | Note nội bộ không gửi ra ngoài; takeover chặn AI chưa dispatch; vượt policy/rate limit/credential lỗi có trạng thái; timeout sau dispatch không resend mù |

Mỗi UC chỉ đạt khi có: commit, môi trường, dữ liệu đầu vào, bước browser/API, kết quả DB hoặc receipt, test lỗi/quyền âm, ảnh hoặc video đúng state. Người khác kiểm lại trước khi chuyển từ Implemented sang Verified; người phụ trách workshop chấp nhận mới chuyển Accepted. Build/test xanh riêng lẻ không đóng UC.

Bộ dữ liệu đề xuất: cửa hàng A đổi hàng trong 7 ngày, cửa hàng B trong 30 ngày; 10 FAQ public, 2 draft, 2 internal chứa chuỗi đánh dấu dễ phát hiện rò rỉ. Bộ hỏi gồm 5 câu trong nguồn, 2 câu ngoài nguồn, 1 yêu cầu lấy tri thức nội bộ, 1 câu hỏi sau đổi version và 1 handoff. Đây là dữ liệu demo đề xuất, không phải chính sách khách hàng thật.

## 5. Lịch cập nhật đa nền tảng cho ba người

D1–D10 là mốc triển khai hai tuần; D11–D13 là thời gian nghiệm thu bổ sung. Mỗi người làm trọn UC.

| Ngày | Người A | Người B | Người C | Kết quả chung |
|---|---|---|---|---|
| D1 | UC-01; kiểm điều kiện tài khoản Meta | UC-19 loại kênh, inbox filter và contract | UC-09; chuẩn bị FAQ và điều kiện provider | Contract đa nền tảng và môi trường dùng được |
| D2 | UC-20 kết nối Page phần 1 | UC-04 channel website phần 1 | UC-10 process và PUBLIC | Kênh website và tri thức được nối dữ liệu thật |
| D3 | UC-20 reconnect/revoke phần 2 | Sáng UC-04; chiều UC-05 | Sáng UC-12; chiều UC-13 | Page test kết nối; probe model; webhook endpoint sẵn sàng |
| D4 | UC-03 tenant/channel/revoke | UC-05 retry và reload | UC-13 grounding và provider thật | Website ghi tin; AI theo nguồn trên fixture thật |
| D5 | Sáng UC-03; chiều UC-15 | UC-21 inbound Messenger phần 1 | Sáng UC-13; chiều UC-14 | Nhận tin Meta vào DB đúng scope; bắt đầu xử lý lỗi |
| D6 | UC-15 quota/concurrent/unknown | UC-21 inbound phần 2 | Sáng UC-14; chiều UC-11 | Webhook duplicate/echo và quota guard được kiểm |
| D7 | UC-16 usage thật | Sáng UC-21; chiều UC-06 | Sáng UC-11; chiều UC-18 | Inbox có nguồn kênh; đối soát usage; restore tối thiểu |
| D8 | UC-17 audit thật | UC-06 reply và note | UC-22 outbound Messenger phần 1 | Có đường gửi công khai; note không đi ra ngoài |
| D9 | UC-02 invite và role | UC-07 takeover phần 1 | UC-22 outbound phần 2 | Ghép Agent/AI với adapter, receipt và ownership |
| D10 | Sáng UC-08; chiều tích hợp | UC-07 takeover phần 2 | Sáng UC-22; chiều tích hợp | Mục tiêu triển khai 22 UC; chỉ demo phần đã có evidence |
| D11 | Kiểm chéo quyền và kết nối | Kiểm chéo knowledge và AI | Kiểm chéo inbox và quota | Regression serial và E2E hai tenant, hai loại kênh |
| D12 | Sửa lỗi quyền/ledger/audit | Sửa lỗi inbox/inbound | Sửa lỗi AI/outbound/recovery | Revoke, duplicate, unknown và race không còn blocker |
| D13 | Chốt evidence/handoff | Tập demo hai nguồn kênh | Kiểm provider/worker và dự phòng | Ba lượt E2E đạt; người phụ trách workshop nghiệm thu |

Nếu bắt đầu 01/10/2026: D10=14/10, D13=19/10. Nếu bắt đầu 05/10/2026: D10=16/10, D13=21/10. Không mặc định làm cuối tuần.

### Cách phối hợp để không giẫm file

- A giữ phần tích hợp `App.tsx`, `ConsoleWorkspace.tsx`, navigation và binding route dùng chung. B/C giao component và contract props/API; A ghép ở mốc cố định mỗi ngày. Phần này là điều phối chung, không chuyển A thành người chuyên frontend.
- A sở hữu UC danh tính/quyền/quota/usage/audit; B sở hữu UC channel/widget/inbox/handoff; C sở hữu UC knowledge/provider/AI/recovery. Khi cần sửa module của người khác, thống nhất một người ghi và bàn giao rõ.
- Chốt D1 các contract dùng chung: conversation ID thật, `status`, `reply_owner`, `owner_version`, message `visibility`, `clientId`, audience/version knowledge, quota meter và operation key. Giữ API hiện hữu nếu đáp ứng, tránh dựng API song song chỉ để khớp mock.
- B và C cùng kiểm takeover race; C triển khai ownership fence trong xử lý AI nếu có gap, B triển khai hành động tiếp quản và state trên inbox. UC-07 do B chịu trách nhiệm nghiệm thu tổng thể; UC-22 do C sở hữu outbound, A cấp kết nối qua UC-20. B sở hữu schema kênh UC-19 và inbound UC-21; cấp số migration tuần tự.
- A sở hữu quota policy/ledger theo UC-15; C dùng contract đang có cho UC-13 và báo receipt/operation key để A đối soát. Thử tích hợp sớm, không đợi UC quota hoàn tất mới cho AI chạy.
- Chỉ một người chạy DB test hoặc cấp số migration trên cluster chung tại một thời điểm. Giữ lịch kiểm thử và gộp thay đổi; không chạy ba bộ DB tests tranh fixture.
- Giữ UI hiện tại trong phạm vi có thể; thay mock bằng dữ liệu thật. UI mới cần screen contract và nguồn HiChat tương ứng hoặc ghi quyết định thiết kế GoTek tạm thời; không mở đợt redesign mới trước demo.

## 6. Các mốc và tiêu chí cắt phạm vi

| Mốc | Điều kiện qua | Nếu chưa đạt |
|---|---|---|
| D1 | Môi trường và contract đa nền tảng; kiểm Page/app/quyền | Xử lý điều kiện ngoài trước khi cam kết Meta live |
| D3 | Page kết nối; nguồn PUBLIC; provider probe | Meta live bị chặn nếu thiếu quyền/webhook; fixture không thay receipt |
| D7 | Inbound đúng tenant/kênh; không nhân message/job | Dừng mở rộng và sửa luồng nhận tin |
| D10 | Ghép outbound, AI/Agent, takeover và usage | Chỉ demo phần đã qua kiểm; chưa tuyên bố đủ core |
| D13 | Hai tenant × Website/Messenger; 3 lượt E2E; lỗi/quyền âm đạt | Giữ UC chưa đạt mở và bàn giao bước sửa |

Không cắt tenant isolation, bảo vệ note/knowledge, ownership fence, chống trùng hoặc unknown để chạy kịp. Import/rollback và invite UI có thể dời khỏi buổi demo sớm nhưng vẫn thuộc backlog core.

## 7. Phương án nếu workshop là ngày 05/10

Từ 30/09 đến 05/10 còn rất ít thời gian. Nếu không tính phần còn lại của 30/09 và không làm cuối tuần thì chỉ có **2 ngày làm việc chuẩn bị: 01–02/10, tương đương 6 ngày công cho 3 người**. Không thể cam kết toàn bộ 29 ngày công UC trước mốc này.

Mục tiêu rút gọn là một lát cắt có thể trình diễn; phạm vi đa nền tảng đầy đủ tiếp tục theo lịch cập nhật sau workshop. Ưu tiên tái dùng màn/API đã có, dữ liệu giả lập đã lưu thật trong DB, không phát triển onboarding hoặc dashboard mới.

| Người | 01/10 | 02/10 | Trách nhiệm trước giờ workshop |
|---|---|---|---|
| A | Môi trường + UC-01; hai workspace và các tài khoản/role fixture | Ghép route/màn thật; kiểm tenant/role; xem usage API nếu AI đã chạy | Kiểm login, quyền, dữ liệu và khởi động; loại KPI mẫu khỏi câu chuyện demo |
| B | UC-04/05 tối thiểu: channel đã cấu hình + trang widget thật | UC-06 + takeover tối thiểu UC-07: nhận và trả lời thật, note không lộ | Luồng visitor → inbox → Agent → visitor; polling được chấp nhận |
| C | UC-09/10 tối thiểu: FAQ nhập tay và PUBLIC; probe provider UC-12 | UC-13 tối thiểu: worker + một câu hỏi có nguồn; phối hợp kiểm AI cũ sau takeover | Trả lời thật theo nguồn và readiness provider/worker; ghi giới hạn live acceptance |

Đây là mục tiêu có rủi ro cao, không phải cam kết toàn bộ UC đạt trong hai ngày. Cuối 01/10 phải có môi trường và API thật; nếu còn vướng lớn thì chốt trình diễn luồng chat người thật làm đường chính. Cuối 02/10 đóng phạm vi và giữ bản chạy ổn định; không ngầm yêu cầu đội làm 03–04/10.

**Điều kiện để gọi phần AI là demo live:** có provider receipt thật, knowledge PUBLIC đúng workspace, không lộ nội dung nội bộ và takeover chặn câu trả lời cũ. Nếu chưa qua gate thì ghi rõ phần AI chưa đạt; chỉ trình diễn phần đã xác minh. Có thể dùng video một lượt chạy thật đã ghi trước làm dự phòng nếu đã có, không coi video hay mock là live acceptance.

Chưa đưa vào demo 05/10: invite email thật, import file, rollback qua UI, web crawl, support console đầy đủ, analytics dashboard, billing, triển khai production. Quota guard hiện có vẫn phải được giữ khi gọi AI; việc trình bày usage bằng API chỉ là giới hạn demo, chưa đóng UC-16 giao diện.

## 8. Kịch bản workshop đề xuất trong 10 đến 12 phút

1. **Phút 0–1:** Owner đăng nhập workspace cửa hàng A; giới thiệu dữ liệu và nhân viên riêng.
2. **Phút 1–3:** Mở chính sách đổi hàng 7 ngày; cho thấy draft/READY/PUBLIC và publish có chủ ý.
3. **Phút 3–5:** Trên một trang website riêng có SDK thật, visitor hỏi “Tôi có thể đổi hàng trong bao lâu?”. Nhận câu trả lời từ model được cấp và chỉ ra nguồn phù hợp contract.
4. **Phút 5–8:** Agent mở đúng conversation, takeover, ghi note nội bộ, trả lời public; màn visitor chỉ thấy câu trả lời public. Giải thích AI không gửi câu cũ sau takeover bằng evidence race đã kiểm trước.
5. **Phút 8–10:** Mở usage thật trước/sau lượt hỏi; phân biệt lượt AI, token và estimated cost. Mở audit publish/takeover ở workspace và grant ở console đúng quyền.
6. **Phút 10–12:** Cho thấy workspace B có chính sách khác hoặc tài khoản Agent bị giới hạn; tổng kết phạm vi đã chạy và backlog tiếp theo. Không trình bày fixed SLA/CSAT/accuracy như số đo sản phẩm.

Với bản rút gọn 05/10, dùng tài khoản/channel đã chuẩn bị và có thể bỏ trình bày bước cấu hình; chỉ trình diễn các bước đã qua gate. Luồng nghiệp vụ phải vẫn lưu dữ liệu thật.

## 9. Checklist chạy và bàn giao

Lệnh lấy baseline từ root sau khi đã chuẩn bị dependency và PostgreSQL local/test chuyên dụng:

```sh
npm run install:all
npm run db:setup
npm run build:all
npm run test:all
npm run dev
```

Chạy AI worker ở terminal riêng, chỉ môi trường local/test:

```sh
npm run worker:ai -- --all
```

Lệnh trên khám phá workspace theo logic worker hiện có; nếu chỉ cần một workspace thì dùng biến `GOTEK_WORKER_WORKSPACE` theo script. Không đồng thời đặt workspace này và `--all`. Khởi động web/API không tự chứng minh AI worker đang chạy. Với workshop, xác minh cả API, frontend, PostgreSQL, worker và provider probe.

Chạy `npm run db:restore-drill` riêng, theo hướng dẫn DB local và công cụ restore hiện hữu; lưu báo cáo môi trường cô lập. Không đưa seed chứa mật khẩu/token hoặc `.env`/`.local` vào evidence/commit. Không tự kết nối provider, gửi email ngoài hoặc triển khai production chỉ từ bản kế hoạch.

Tests cần ưu tiên theo UC, tất cả dưới `backend/tests/`: auth-signup-verify, h02-workspace-isolation, h16-membership-revoke, h05-assignment-capacity, widget-api-flow, widget-boundary, chat-store, inbox-resume-ai, knowledge-lifecycle, knowledge-retrieval, grounded-widget-flow, core-provider-handoff, ai-dispatch-fence, provider-grant-expiry, quota-pre-dispatch-matrix, quota, usage-ledger, jobs-recovery-null-lease và audit-log. Sau khi baseline hiện tại chạy, xác nhận danh sách và bổ sung case browser/SSE/route mismatch chưa được chứng minh.

Evidence đề xuất: `delivery/evidence/workshop-core/<ngày>/<UC>/`, gồm commit, command hoặc bước tái hiện, screenshot/video, API/DB result đã che dữ liệu nhạy cảm, pass/fail/not-run và giới hạn. Khi triển khai thực tế, cập nhật PROJECT-STATUS/HANDOFF theo kết quả mới và link evidence; không tự đánh dấu toàn bộ H đã hoàn thành.

Các thông tin còn cần chốt, không cản trở dùng bảng UC này để giao việc: ngày 05/10 là bắt đầu hay workshop; tên A/B/C và khả năng làm đủ ngày; test provider/model đã được phép dùng; máy hoặc môi trường demo; người chấp nhận kết quả. Không cần gửi secret trong chat.

## 10. Contract dữ liệu đa nền tảng đề xuất

Website + một Facebook Page Messenger, nội dung text, một model AI là phạm vi kết nối đề xuất cho đợt này. Instagram chỉ có giá trị nhận diện trong thiết kế; không hứa connector Instagram đã triển khai. Zalo, WhatsApp, Telegram và media nâng cao giữ backlog riêng.

Các bảng/trường là contract đề xuất, chưa phải schema đã triển khai. Ưu tiên dùng channel_id hiện có trên conversation; không tạo inbox riêng cho từng nền tảng và không nhân bản channel_type vào message nếu không cần snapshot.

Migration mới thêm loại kênh và backfill website cho dữ liệu cũ. Giữ origin/public_key và visitor token hoạt động trong giai đoạn chuyển; không sửa migration 007 đã triển khai. Không cho đổi loại kênh khi đã có lịch sử hội thoại.

Không gắn visitor token website cho khách Messenger. Dùng identity mapping từ kết nối đã xác minh; worker/webhook lấy workspace từ server mapping, tuyệt đối không tin workspace_id trong payload ngoài.

AI và Agent gửi qua một outbound adapter đã chọn bằng channel_type. Trước dispatch kiểm membership/connection/grant/quota, visibility public và owner_version. Sau dispatch theo dõi outcome riêng; không hứa thu hồi được tin đã tới provider khi Agent vừa takeover.

Webhook được xác minh chữ ký trên raw body trước khi tạo dữ liệu. ACK sau khi lưu sự kiện bền vững; xử lý nền chống trùng, out-of-order, echo và delivery event. Polling/API tải lại trạng thái là nguồn đối soát khi stream thiếu event.

Chi phí sinh câu AI và kết quả gửi Messenger là hai nghiệp vụ riêng. Gửi thất bại không tự hoàn chi phí model đã gọi; không sinh lại câu AI chỉ vì outbound timeout. Unknown giữ operation để đối soát, không gửi lại mù.

| Nhóm dữ liệu | Thuộc tính | Giá trị hoặc ý nghĩa | Ràng buộc |
|---|---|---|---|
| channels | channel_type | website / facebook_messenger / instagram | Loại sản phẩm/kênh cụ thể; instagram mới là dự phòng thiết kế. |
| channels | provider | gotek / meta | Nhà cung cấp; ràng buộc tổ hợp hợp lệ với channel_type. |
| channels | workspace_id, id, name, enabled | ID nội bộ và tên hiển thị | Tenant do membership hoặc kết nối đã xác minh quyết định. |
| channel_connections | external_account_id, external_app_id | Page/account và app ID | Một kết nối active có định tuyến duy nhất trong phạm vi app/provider/channel_type. |
| channel_connections | connection_status | pending / connected / disconnected / reauth_required / error | Hiển thị trạng thái đã kiểm từ server, không chỉ toggle UI. |
| channel_connections | credential_ref, expires_at, scopes | Secret reference và quyền | Credential server-side; expires_at có thể null; revoke phải có hiệu lực. |
| channel_connections | capabilities, last_verified_at | send_text, media, receipt... | Server quyết định chức năng khả dụng; không tin client bật capability. |
| website_channel_config | origin, public_key, widget settings | Cấu hình chỉ cho website | Không áp trường bắt buộc website lên Messenger. |
| channel_identities | channel_id, external_user_id, contact_id | PSID/người gửi theo tài khoản | Khóa theo tenant + connection/account + external user; không tự gộp qua kênh. |
| channel_events | event key, external_message_id, payload metadata | Dedupe và xử lý inbound | Khóa chống trùng theo connection + event kind + định danh ổn định của adapter. |
| outbound_operations | operation_id, owner_version, status, external_message_id | queued/dispatching/accepted/delivered/failed/unknown | Track gửi riêng với message và quota; delivery có thể không được provider hỗ trợ. |

## 11. Điều kiện kết nối và nghiệm thu Meta

A kiểm Meta app, Facebook Page thử nghiệm, quyền người quản trị/tester, token hợp lệ và khả năng subscribe webhook từ D1. Phạm vi app mode, quyền cần xin và App Review phải xác nhận theo tài khoản thực tế; không cam kết thời gian duyệt.

Webhook cần URL HTTPS mà Meta truy cập được và chứng chỉ hợp lệ. localhost đơn thuần không đủ nhận callback. Môi trường test công khai chỉ được cấu hình khi đã có quyền; bản kế hoạch không tự cấp quyền deploy hay gửi tin khách thật.

Theo tài liệu Messenger do Meta phát hành trên Postman, cần Page/app có pages_messaging và Page access token phù hợp. Kiểm cửa sổ gửi hiện hành trước mỗi dispatch; không hard-code một lời hứa rằng gửi được mọi lúc.

Nếu cuối D3 chưa có quyền/token/webhook hoạt động, UC-20–22 giữ Blocked đối với live acceptance. Vẫn làm contract và fixture nhưng không tuyên bố kết nối Meta thành công; demo website riêng và dời nghiệm thu Meta.

Inbox phải hiển thị badge Website/Messenger, tên website/Page, bộ lọc loại kênh và channel_id, trạng thái kết nối và trạng thái gửi thật. Chỉ Owner/Admin cấu hình kết nối; Agent thao tác trong channel đã được cấp. Thao tác disconnect/reconnect có audit và xác nhận rõ trên UI.

Demo đa nền tảng: nhận một tin từ Website và một tin từ Messenger vào cùng inbox, lọc đúng nguồn, trả lời đúng khách/Page, thử note nội bộ, AI và takeover; kiểm receipt và duplicate webhook. Thiếu quyền Meta ngày 05/10 thì ghi rõ chưa có demo Meta live.

Nguồn kỹ thuật đối chiếu ngày 30/09/2026; xác nhận API version/quyền thực tế trước triển khai:
- [Meta Messenger API](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api)
- [Meta Send API](https://www.postman.com/meta/messenger-platform-api/folder/7cc3gd2/send-api)
- [Meta sample webhook setup](https://github.com/fbsamples/messenger-platform-samples/blob/main/node/README.md)
