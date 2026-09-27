# Kế hoạch triển khai GoTek Chatbot theo hạng mục

Baseline: handoff v2.0, 24/09/2026. Đây là kế hoạch đề xuất để team triển khai sau khi người dùng yêu cầu bắt đầu code; hiện tại chỉ tạo skill và hồ sơ giao việc. Không phải cam kết lịch hay tính năng HiChat chưa quan sát.

## Bắt đầu từ đâu
1. PO/BA mở phần14–17 của handoff, xác nhận phạm vi core, gán người chịu trách nhiệm và lập decision log cho gap P.
2. UX thu màn hình đúng route/role/state cho H01–H04 trước; lập contract từng màn và đối chiếu token GoTek. Không lấy 2 screenshot mẫu làm đủ toàn bộ UI.
3. Tech Lead xác nhận repo, stack, môi trường test, schema tenancy và API contract; snapshot test thực của repo, không dùng số test từ tài liệu gốc như kết quả hiện tại.
4. QA dựng fixture 2 tenant × ít nhất 2 role, visitor, cuộc hội thoại và nguồn public/private. Chỉ dùng dữ liệu giả lập; chuẩn bị evidence theo mẫu.
5. Sau khi được yêu cầu triển khai, làm P1 → P2 → P3 → P4; tiếp tục P5/P6 theo phụ thuộc. Chốt core không đồng nghĩa hoàn thiện mọi H.

## Trạng thái và điều kiện chuyển
Backlog → Spec ready → In progress → Implemented → Verified → Accepted. Blocked phải có lý do/người xử lý; không dùng Blocked để bỏ mã khỏi phạm vi.
- Spec ready: source/gap, quyền, field/state, API/data, acceptance được ghi đủ cho lát cắt.
- Implemented: có commit và migration; chưa chứng minh chạy đúng.
- Verified: QA có bằng chứng môi trường cụ thể; không chỉ unit test.
- Accepted: PO/Tech Lead chấp nhận đúng phạm vi, có sai khác UI được giải thích và không còn gap chặn. Production acceptance là bước riêng.
Mỗi PR ghi Hxx.yy/Fxx/Exx, scope, cách kiểm và evidence. Owner bên dưới là vai trò đề xuất; team phải gán tên, không hiểu là đã có người nhận.

## Thứ tự triển khai

### P0 — Khóa phạm vi và bổ sung bằng chứng

- Phạm vi: H01, H02, H03, H04, H05, H06, H07, H08, H09, H10, H11, H12, H13, H14, H15, H16, H17, H18, H19, H20, H21, H22, H23, H24, H25, H26, H27, H28, H29, H30, H31, H32.
- Chủ trì: PO + BA + UX + Tech Lead.
- Việc làm: Đối chiếu 158 chức năng con; lập gap theo O/T/D/P, screen contract cho luồng sẽ làm, chọn repo/stack và decision log.
- Điều kiện chuyển: Có baseline có version, bản đồ nguồn, backlog và tiêu chí đóng cho mỗi mã; chưa bắt đầu code theo yêu cầu hiện hành.

### P1 — Nền tảng quyền và vận hành tối thiểu

- Phạm vi: H01, H02, H16, H22, H23, H28, H32.
- Chủ trì: Backend + DevOps + QA.
- Việc làm: Auth/session, tenant/membership, console nền tảng, secret registry, quota ledger, audit, migration và backup cơ bản.
- Điều kiện chuyển: Hai tenant/hai role không đọc chéo qua API/storage/realtime; login/logout/reset được thử; restore môi trường cô lập đạt.

### P2 — Chat website và người thật

- Phạm vi: H03, H04, H05, H06, H07, H13, H17, H27.
- Chủ trì: Frontend + Backend + QA.
- Việc làm: SDK/widget, inbox, contact, assignment, giờ làm/prechat, metadata và accessibility của luồng core.
- Điều kiện chuyển: Visitor gửi → inbox nhận → agent trả lời → visitor nhận; reload/reconnect/retry; không lộ note; UI đúng state nguồn.

### P3 — AI và tri thức có kiểm soát

- Phạm vi: H08, H09, H10, H11, H12, H31.
- Chủ trì: AI/Backend + Frontend + QA.
- Việc làm: Provider thực, publish/index, FAQ/web source, quyền tri thức, collection nội bộ. H31 chỉ ranh giới public/private trong core; Lark sync sau core.
- Điều kiện chuyển: Câu trả lời có nguồn đúng quyền/version; tenant khác không truy xuất; thiếu nguồn biết từ chối; takeover chặn output AI cũ; đối soát usage.

### P4 — Nghiệm thu vòng core

- Phạm vi: H24, H25, H27, H28, H32.
- Chủ trì: QA + Tech Lead + PO + Ops.
- Việc làm: Metric tối thiểu có event, báo cáo đối soát, UI regression, tải/latency có mục tiêu được chốt, restore và incident drill.
- Điều kiện chuyển: Chạy core E2E trên môi trường gần production; kiểm quota, retry, quyền âm, backup/restore; PO ký phạm vi core, ghi rõ phần chưa đạt.

### P5 — Hoàn thiện parity vận hành workspace

- Phạm vi: H15, H18, H19, H20, H21, H22, H23, H24, H25, H26, H27.
- Chủ trì: Frontend + Backend + QA.
- Việc làm: Help Center, automation, macro, canned responses, báo cáo/lịch đầy đủ, audit/SSO và UI còn lại theo bằng chứng. Connector và thu phí thương mại theo E09/E10.
- Điều kiện chuyển: Mỗi H có bằng chứng UI, API, quyền và side effect thực. Không đóng SSO/lịch gửi bằng form; cần phiên đăng nhập/receipt thật.

### P6 — Mở rộng GoTek và parity theo kênh

- Phạm vi: H14, H29, H30, H31.
- Chủ trì: PO + nhóm tích hợp + QA.
- Việc làm: Triển khai E01–E12 sau khi phụ thuộc core đạt; ticket/catalog/đa kênh/Lark và các chức năng kinh doanh.
- Điều kiện chuyển: Nghiệm thu từng E; adapter có inbound/outbound/revoke/rate-limit/receipt; dữ liệu CRM và quyền được tái sử dụng, không tạo hệ thống rời.

## Phiếu công việc cho đủ 32 nhóm
Mỗi phiếu phải tách thành ticket Hxx.yy để theo dõi. Danh sách “liên quan” là liên kết dữ liệu/nghiệp vụ, không phải DAG build. Một H có thể xuất hiện nhiều phase: nghiệm thu rõ phần core và phần hoàn thiện; không đóng toàn bộ H sau lát cắt đầu tiên.

### H01 — Đăng ký đăng nhập và khôi phục

Phase: P1. Vai trò sử dụng: Khách đăng ký; thành viên workspace.

Nguồn khảo sát: T: đã tạo sandbox; P: xác thực email, đăng nhập lại, reset và lỗi.

Đường vào tham chiếu: `/app/auth/signup ; /app/login`.

Các ticket phải triển khai/đối chiếu:
- **H01.01** — Đăng ký: tên đầy đủ, tên doanh nghiệp, email, số điện thoại, mật khẩu; giữ thứ tự theo form nguồn. Không đưa wizard tri thức vào giữa luồng đăng ký.
- **H01.02** — Xác thực: tài khoản hiện có banner chưa xác thực và Gửi lại email xác thực. Chưa thử link hết hạn, link đã dùng hoặc resend cooldown.
- **H01.03** — Đăng nhập: email/mật khẩu và liên kết khôi phục phải có đặc tả riêng. Không suy ra remembered session là đăng nhập lại đã đạt.
- **H01.04** — Thiết kế GoTek: báo lỗi theo trường, chống submit trùng, không lộ email có tồn tại; redirect đúng workspace sau xác thực. Các tình huống này cần PO chốt sau khảo sát.

Luồng chính: Mở đăng ký → Điền thông tin → Tạo tài khoản → Vào workspace.

Dữ liệu/hợp đồng phải chốt: User; session; verification challenge; membership. Không lưu mật khẩu hoặc token vào tài liệu.

Liên quan: H02 H22 H23.

Nghiệm thu bắt buộc: Tạo mới → xác thực → logout → login; sai mật khẩu; link hết hạn; cùng email; refresh; truy cập khi chưa có membership. Cần screenshot từng trạng thái trước khi chốt parity.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H02 — Workspace và ngữ cảnh doanh nghiệp

Phase: P1. Vai trò sử dụng: Owner và thành viên.

Nguồn khảo sát: O/T: account214 và menu workspace; P: tạo/chuyển workspace thứ hai.

Đường vào tham chiếu: `/settings/general`.

Các ticket phải triển khai/đối chiếu:
- **H02.01** — Ghi rõ account/workspace đang hoạt động ở sidebar; account214 chỉ là ID khảo sát, không hard-code.
- **H02.02** — Cài đặt doanh nghiệp: đối chiếu tên, ngôn ngữ và thiết lập được nguồn hiển thị; giữ form trong Cài đặt, không tự chuyển thành màn landing.
- **H02.03** — Khi chuyển workspace, tải lại membership và dữ liệu có scope; xóa cache UI của workspace trước. Đây là yêu cầu GoTek.
- **H02.04** — Mời thành viên, giới hạn người dùng và quyền cấu hình nối H16/H23; không coi dropdown chọn account là kiểm thử tenant isolation.

Luồng chính: Đăng nhập → Chọn workspace → Đọc cấu hình → Vào đúng dữ liệu.

Dữ liệu/hợp đồng phải chốt: Workspace → memberships → inboxes/bot; workspace_id do server xác định.

Liên quan: H01 H16 H22 H28.

Nghiệm thu bắt buộc: Hai workspace và hai tài khoản: URL sửa account ID không trả dữ liệu; quay lại không thấy cache chéo; thành viên bị thu hồi không tiếp tục thao tác.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H03 — Inbox hội thoại và chuyển người

Phase: P2. Vai trò sử dụng: Agent; Workspace Admin.

Nguồn khảo sát: O: danh sách trống và bộ lọc; P: hội thoại có dữ liệu và takeover thực.

Đường vào tham chiếu: `/dashboard ; /inbox/:inbox`.

Các ticket phải triển khai/đối chiếu:
- **H03.01** — Danh sách: tìm kiếm; trạng thái Mở; Của tôi, Chưa được phân công, Tất cả; sidebar kênh và nhãn. Screenshot inbox-empty là mốc hình học hiện có.
- **H03.02** — Mở hội thoại: cần thu ảnh đầy đủ composer, timeline, thông tin khách, assignment và menu hành động. Không dựng chi tiết panel chưa quan sát thành HiChat đã xác minh.
- **H03.03** — GoTek core: agent nhận quyền trả lời; khách yêu cầu người thật; trạng thái AI_ACTIVE → HANDOFF_PENDING → HUMAN_ACTIVE; tiếp tục AI phải có hành động rõ.
- **H03.04** — Tin nhắn gửi phải có pending/sent/failed và retry; ghi chú nội bộ không ra widget; draft không mất khi đổi hội thoại. Cần đo receipt phía khách.
- **H03.05** — Resolve/reopen/snooze, phân công và đổi ưu tiên nối automation/macro; tất cả thay đổi phải cập nhật realtime và audit.

Luồng chính: Chọn hộp thư → Chọn hội thoại → AI hoặc agent xử lý → Giải quyết và báo cáo.

Dữ liệu/hợp đồng phải chốt: Conversation; message; assignment; reply-owner version; read cursor; delivery receipt.

Liên quan: H04 H08 H13 H16 H18 H19 H24 H29.

Nghiệm thu bắt buộc: AI đang tạo câu trả lời thì agent takeover: câu AI cũ không được gửi. Hai agent tranh nhận; mất mạng/retry không nhân đôi; giải quyết rồi khách nhắn lại theo cấu hình.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H04 — Tạo kênh website và nhúng SDK

Phase: P2. Vai trò sử dụng: Workspace Admin; người quản trị website.

Nguồn khảo sát: T: inbox269 tạo xong; P: widget visitor gửi nhận thật.

Đường vào tham chiếu: `/settings/inboxes/new`.

Các ticket phải triển khai/đối chiếu:
- **H04.01** — Wizard chọn loại kênh Website; nhập tên website/domain và thông tin hiển thị theo form nguồn.
- **H04.02** — Bước agent chọn thành viên; hoàn tất kênh và chuyển cài đặt hoặc mã nhúng. Inbox269 là sandbox đã tạo, không dùng làm ID GoTek.
- **H04.03** — Mã nguồn quan sát: SDK tải bất đồng bộ, hichatSDK.run có websiteToken/baseUrl. GoTek cung cấp SDK riêng; không chép token HiChat vào mã sản phẩm.
- **H04.04** — Đặt script trong body của website test; kiểm tra khởi tạo một lần, nhiều lần nhúng và domain sai. Nút CodePen đã thử nhưng chưa tạo được phiên visitor kiểm chứng.
- **H04.05** — Không yêu cầu người dùng nhập provider key trong widget; bot token công khai không thay thế kiểm tra domain, tenant và danh tính.

Luồng chính: Chọn Website → Nhập thông tin → Chọn agent → Lấy mã nhúng.

Dữ liệu/hợp đồng phải chốt: Inbox website; public bot key; domain policy; installation version; visitor session.

Liên quan: H02 H05 H06 H07 H03.

Nghiệm thu bắt buộc: Website test mở launcher, gửi tin, inbox nhận, agent trả lời, khách nhận; reload giữ session đúng; domain khác bị từ chối; không có secret trong bundle.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H05 — Cộng tác viên và tự phân công

Phase: P2. Vai trò sử dụng: Workspace Admin.

Nguồn khảo sát: O: form và công tắc; P: lưu và thuật toán phân công.

Đường vào tham chiếu: `/settings/inboxes/:inbox`.

Các ticket phải triển khai/đối chiếu:
- **H05.01** — Sáu mục cấu hình inbox giữ thứ tự nguồn: Cài đặt, Cộng tác viên, Giờ làm việc, Biểu mẫu trước khi trò chuyện, Trình tạo widget, Cấu hình.
- **H05.02** — Multi-select agent hiện người thử nghiệm; nhãn heading nguồn dịch là Nhà cung cấp. GoTek cần nhãn tiếng Việt thống nhất được duyệt, không sao chép lỗi dịch máy.
- **H05.03** — Bật tự động chuyển nhượng đang bật; có Giới hạn tự động phân công tối đa và Cập nhật. Chưa biết rỗng có nghĩa vô hạn hay giá trị mặc định.
- **H05.04** — Quy tắc phân phối, online/offline, công suất và agent bị gỡ phải được kiểm chứng; không tự ghi round-robin là hành vi HiChat.
- **H05.05** — Lưu agent và cấu hình auto assignment là hai thao tác cần audit riêng; không để user thiếu quyền thay đổi bằng request trực tiếp.

Luồng chính: Mở Cộng tác viên → Chọn agent → Đặt auto assignment → Cập nhật.

Dữ liệu/hợp đồng phải chốt: Inbox membership; availability; assignment policy; concurrency capacity.

Liên quan: H03 H16 H06 H22.

Nghiệm thu bắt buộc: Hai agent, ngưỡng đầy, offline và không có agent: xác minh phân phối và hàng chờ; agent bị gỡ không đọc hội thoại mới.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H06 — Giờ làm việc và biểu mẫu trước chat

Phase: P2. Vai trò sử dụng: Workspace Admin; visitor.

Nguồn khảo sát: O: bật thử form rồi hoàn nguyên, chưa lưu.

Đường vào tham chiếu: `/settings/inboxes/:inbox`.

Các ticket phải triển khai/đối chiếu:
- **H06.01** — Giờ làm việc: công tắc khả dụng; thông báo ngoài giờ; timezone; Chủ nhật–Thứ bảy, khả dụng/cả ngày/giờ bắt đầu-kết thúc. Giá trị sandbox Pacific GMT-07 và 09–17 không phải mặc định GoTek.
- **H06.02** — Prechat: Có/Không; editor lời nhắn; các hàng emailAddress, fullName, phoneNumber; bật, kiểu, bắt buộc, nhãn và placeholder.
- **H06.03** — Khi trường tắt, required/label/placeholder disabled. Email đã thử bật thì required còn chọn; chưa kiểm tra validate email phía khách.
- **H06.04** — Email collection trong hội thoại và prechat phải tránh hỏi lặp; không đồng nhất thông tin bắt buộc với đồng ý marketing.
- **H06.05** — Trạng thái ngoài giờ, agent offline, qua nửa đêm và timezone thay đổi nối H05/H24; chưa biết hỗ trợ ngày lễ hoặc nhiều khoảng trong ngày.

Luồng chính: Mở cấu hình → Đặt lịch và prechat → Cập nhật → Khách vào đúng trạng thái.

Dữ liệu/hợp đồng phải chốt: Business hours; timezone; prechat schema; visitor submission; consent purpose.

Liên quan: H04 H05 H07 H12 H13 H24.

Nghiệm thu bắt buộc: Trước/sau giờ, cuối tuần, DST nếu có; required thiếu/sai; phone optional; form lưu rồi reload; khách mobile mở bàn phím không che nút gửi.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H07 — Widget builder preview và danh tính

Phase: P2. Vai trò sử dụng: Workspace Admin; visitor.

Nguồn khảo sát: O: sáu mục, preview và HMAC; P: widget thật và chữ ký.

Đường vào tham chiếu: `/settings/inboxes/:inbox`.

Các ticket phải triển khai/đối chiếu:
- **H07.01** — Cài đặt: ảnh JPG/PNG ≤5MB và ≤600×600; tên/domain, tiêu đề và mô tả chào, màu, thời gian trả lời vài phút/giờ/ngày.
- **H07.02** — Toggles: lời chào, email, CSAT, nhắn sau resolved, tiếp tục qua email, file, emoji, khách kết thúc, tên/avatar inbox cho bot; chọn Help Center; tên gửi email.
- **H07.03** — Builder: vị trí trái/phải; kiểu Chuẩn/Mở rộng; tiêu đề launcher. Viewport hẹp có Cài đặt/Xem trước; preview Mặc định/Chat và Kịch bản.
- **H07.04** — Preview có tin mẫu, không chứng minh AI hoặc gửi nhận thật. Màu Gotek thay accent/brand; không thay vị trí launcher hay thêm hero trang trí.
- **H07.05** — Cấu hình có Messenger script, Copy, CodePen; xác thực danh tính với secret và công tắc bắt buộc. Không đưa secret vào ảnh hoặc tài liệu; thuật toán ký cần spec chính thức.

Luồng chính: Cài đặt hiển thị → Xem trước → Nhúng website → Xác minh visitor.

Dữ liệu/hợp đồng phải chốt: WidgetConfig; public SDK config; server-side identity signature; visitor identity.

Liên quan: H04 H06 H03 H15 H22 H27.

Nghiệm thu bắt buộc: So preview với widget cùng config; required signature thiếu/sai/hết hạn; đổi người dùng không nối lịch sử sai; attachment lỗi; emoji; CSAT; resolved và reopen.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H08 — Provider model và hành vi AI

Phase: P3. Vai trò sử dụng: Workspace Admin chọn model; Platform Admin cấp model.

Nguồn khảo sát: O: cấu hình; P: kết nối provider và sinh trả lời.

Đường vào tham chiếu: `/settings/ai-settings → Tổng quan`.

Các ticket phải triển khai/đối chiếu:
- **H08.01** — Chế độ key HiChat quản lý hoặc API key riêng; model dropdown và Kiểm tra kết nối/Lưu. Danh sách model quan sát không chứng minh model khả dụng.
- **H08.02** — Tên bot, doanh nghiệp, ngôn ngữ tự động/Anh/Việt; debounce 5s, delay text1s/media5s và temperature0.6 là trạng thái sandbox.
- **H08.03** — Chế độ tư vấn sản phẩm, hỗ trợ khách hàng; xưng/hô; editor fallback. Không bật provider trong khảo sát.
- **H08.04** — GoTek: provider registry và capability server-side; chỉ model được grant; timeout/fallback/quota/kill switch có kết quả phân biệt.
- **H08.05** — Không coi nút Lưu là publish tri thức. Quy tắc, nguồn, tool và quyền H09–H12 được kiểm tra trước mỗi lượt trả lời.

Luồng chính: Chọn chế độ → Chọn model → Cấu hình hành vi → Kiểm tra và lưu.

Dữ liệu/hợp đồng phải chốt: Model grant; provider secret reference; routing; generation policy; request usage.

Liên quan: H09 H10 H11 H12 H23 H28 H32.

Nghiệm thu bắt buộc: Provider lỗi/timeout/hết quota; model không đủ capability; fallback đúng; usage chỉ tính theo receipt; retry không gửi đáp án hai lần.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H09 — Quy tắc AI và nhập xuất

Phase: P3. Vai trò sử dụng: Workspace Admin.

Nguồn khảo sát: T: một rule được tạo; O: còn hiển thị trong lần mở lại; P: ảnh hưởng runtime, edit và import.

Đường vào tham chiếu: `/settings/ai-settings → Quy tắc AI`.

Các ticket phải triển khai/đối chiếu:
- **H09.01** — Danh sách: tìm kiếm, checkbox chọn, Thêm quy tắc, Tải xuống XLSX, Tải lên XLSX/CSV; card có trạng thái và cập nhật.
- **H09.02** — Form tiêu đề bắt buộc tối đa150, nội dung bắt buộc tối đa2000; Tạo disabled khi trống. Rule sandbox đã tạo, không phải tri thức khách.
- **H09.03** — Import theo mẫu xuất; cần đặc tả header, encoding, dòng lỗi, trùng và quota. Chưa đo thực tế nên không tự chọn chính sách ghi đè.
- **H09.04** — Chính sách GoTek: rule không được vượt tenant, quyền nguồn, bảo mật hoặc cho phép tự xác nhận giao dịch; version và audit khi sửa.
- **H09.05** — Trạng thái active chỉ là cấu hình được bật, chưa chứng minh mọi phản hồi đều tuân thủ. QA cần thử rule mâu thuẫn, bị tắt và prompt injection.

Luồng chính: Mở danh sách → Thêm quy tắc → Nhập tiêu đề nội dung → Tạo và đọc lại.

Dữ liệu/hợp đồng phải chốt: AI rule; active flag; version; import batch/errors; evaluation case.

Liên quan: H08 H10 H23 H22.

Nghiệm thu bắt buộc: Tạo/lưu/reload; 150/151 và 2000/2001; import một dòng lỗi; quota2 của sandbox; tắt rule không còn tác dụng khi chạy AI.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H10 — FAQ kho thông tin mẫu câu và ảnh

Phase: P3. Vai trò sử dụng: Workspace Admin; editor theo quyền GoTek.

Nguồn khảo sát: O: bốn danh sách và form mới đã đọc; P: lưu/import/retrieval/ảnh runtime.

Đường vào tham chiếu: `/settings/ai-settings → Kiến thức cho AI`.

Các ticket phải triển khai/đối chiếu:
- **H10.01** — FAQ/Kịch bản phản hồi: câu hỏi kích hoạt bắt buộc100 ký tự; Thêm bước → editor mỗi bước; tối đa5 ảnh/bước chọn từ thư viện; tổng câu trả lời2000; danh mục; active bật; Hủy/Tạo.
- **H10.02** — Kho thông tin: Thông tin cho AI bắt buộc100; editor nội dung bắt buộc2000; danh mục tùy chọn, thêm danh mục; active bật. Lọc danh mục/trạng thái/nguồn thủ công/mới-cũ.
- **H10.03** — Mẫu hội thoại: UI gọi Mẫu câu AI; tiêu đề150, nội dung2000 bắt buộc; Hủy/Tạo. Danh sách tìm kiếm, mới/cũ và nhập xuất XLSX/CSV.
- **H10.04** — Ảnh: Thêm thư mục → tên và mô tả bắt buộc, danh mục, Hủy/Lưu. Hướng dẫn nêu thư mục/ảnh active, title/description/tags, ẩn/hiện, copy URL, image_item_id; tối đa10 ảnh gần nhất/thư mục trong prompt. Chưa thử upload.
- **H10.05** — FAQ và kho thông tin có filter/search/import/export; giới hạn này chỉ áp dụng form tương ứng. Pipeline DRAFT/job/publish/version theo D2 phải được tích hợp rõ, không tự gắn nhãn là UI HiChat.

Luồng chính: Chọn loại kiến thức → Nhập nội dung → Bật và lưu → Kiểm chứng câu trả lời.

Dữ liệu/hợp đồng phải chốt: FAQ + ordered steps + image references; business item; sample; image folder/item; version/publication.

Liên quan: H08 H09 H11 H23 H31 H32.

Nghiệm thu bắt buộc: Chỉ nguồn active/publish đúng quyền xuất hiện; thu hồi ảnh không trả URL cũ; FAQ nhiều bước đúng thứ tự; lỗi import không ghi dở; vượt từng giới hạn báo đúng trường.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H11 — Nguồn web và crawler

Phase: P3. Vai trò sử dụng: Workspace Admin; editor.

Nguồn khảo sát: O: danh sách và form; P: crawl, lịch refresh, lỗi.

Đường vào tham chiếu: `/settings/ai-settings → Nguồn dữ liệu cho AI`.

Các ticket phải triển khai/đối chiếu:
- **H11.01** — Nguồn web: tìm kiếm; trạng thái Hoạt động/Tạm dừng/Lỗi; loại URL/Sitemap/RSS; empty state và Thêm nguồn web.
- **H11.02** — Form: Tên nguồn*, URL*, Loại nội dung*; số trang tối đa20, độ sâu2, độ trễ0 giây đang hiển thị; Hủy/Tạo disabled khi trống.
- **H11.03** — Chưa thử Sitemap/RSS validation hoặc job. Không suy ra URL chỉ cho domain chính, cron, format parser hay lịch auto-refresh.
- **H11.04** — D2 yêu cầu giới hạn bytes/time/host, chặn SSRF/loopback/private IP/metadata/DNS rebinding; kiểm tra mọi redirect chứ không chỉ URL đầu.
- **H11.05** — Nguồn thay đổi → version mới → index thử → publish/rollback; lỗi crawl không xóa bản đang phục vụ. Trạng thái này là backend GoTek đề xuất theo D2.

Luồng chính: Thêm nguồn web → Nhập URL và loại → Đặt giới hạn crawl → Tạo và theo dõi job.

Dữ liệu/hợp đồng phải chốt: WebSource; crawl job; fetched page; content version; index revision; publish pointer.

Liên quan: H10 H08 H23 H31 H32.

Nghiệm thu bắt buộc: URL hợp lệ, 404, JS, redirect, sitemap lớn, RSS thay đổi, nguồn cấm; lỗi giữ bản cũ; timeout và retry hữu hạn; draft không được trả lời.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H12 — Thu thập dữ liệu và đồng bộ

Phase: P3. Vai trò sử dụng: Workspace Admin; visitor.

Nguồn khảo sát: O: cấu hình và form trường; P: extraction/sync/auto stop.

Đường vào tham chiếu: `/settings/ai-settings → Thu thập dữ liệu`.

Các ticket phải triển khai/đối chiếu:
- **H12.01** — Bật thu thập dữ liệu; tự tắt chatbot khi đủ Chỉ trường bắt buộc/Toàn bộ trường. Hai nút disabled khi công tắc liên quan tắt.
- **H12.02** — Thêm nhãn khi hoàn tất: công tắc, tên data_collected, màu; cho lowercase/số/gạch ngang/gạch dưới; nhãn tự tạo nếu chưa có theo mô tả UI.
- **H12.03** — Thêm trường: Tên trường*, Tên hiển thị*, mô tả; Trường bắt buộc mặc định tắt; Bật thu thập mặc định bật; Tạo disabled khi trống.
- **H12.04** — Hướng dẫn ghi giá trị vào thuộc tính tùy chỉnh Contact và đồng bộ đích. Đích Tắt/Google Sheets/Lark Bitable và Lưu đích đồng bộ; chưa chọn kết nối.
- **H12.05** — Cần phân biệt chưa có/đang thu/đã đủ; sửa giá trị, consent và kiểu dữ liệu liên hệ; bot dừng vì đủ dữ liệu không tự đồng nghĩa handoff thành công.

Luồng chính: Định nghĩa trường → Thu thập từ chat → Lưu Contact → Đủ dữ liệu thì xử lý.

Dữ liệu/hợp đồng phải chốt: Collection field; extraction candidate; validated contact attribute; completion event; sync outbox.

Liên quan: H03 H13 H17 H21 H25 H26.

Nghiệm thu bắt buộc: Khách từ chối, sửa thông tin, đủ required nhưng thiếu optional; không tắt sớm; trùng event không ghi hai dòng; sync lỗi có retry/receipt; không yêu cầu marketing consent để hỗ trợ.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H13 — CRM liên hệ và hồ sơ khách

Phase: P2. Vai trò sử dụng: Agent theo scope; Workspace Admin.

Nguồn khảo sát: T: tạo contact không email/phone; O: hồ sơ/gộp; P: ghi chú/gộp/outbound.

Đường vào tham chiếu: `/contacts ; /contacts/:id`.

Các ticket phải triển khai/đối chiếu:
- **H13.01** — Danh sách có Khách hàng, Kênh chat, Đơn hàng, Nhãn, Hành động; tìm kiếm/filter và theo kênh; empty state không phải dữ liệu thật.
- **H13.02** — Thêm liên hệ: tên/họ/email/phone/quốc gia/thành phố/tiểu sử/công ty. Lần thử không email và phone vẫn lưu thành công; tiêu đề form ghi Chỉnh sửa thông tin liên hệ.
- **H13.03** — Hồ sơ: thông tin xã hội, Thuộc tính/Ghi chú/Gộp; ghi chú200 ký tự, nút lưu disabled khi trống. Không suy ra note contact là note nội bộ hội thoại.
- **H13.04** — Gộp: liên hệ chính giữ lại và ưu tiên trường xung đột, liên hệ phụ bị gộp/xóa theo UI. Chưa thực hiện; cần preview và phục hồi GoTek theo D2.
- **H13.05** — Gửi tin nhắn với contact thủ công báo Không có hộp thư nào để bắt đầu...; Website inbox không tự gắn contact. CRM lead pipeline/scoring sau core ở E02/E03.

Luồng chính: Tìm liên hệ → Mở hoặc tạo → Cập nhật ngữ cảnh → Mở hội thoại phù hợp.

Dữ liệu/hợp đồng phải chốt: Contact; identities; attributes; note; merge audit; conversation links; consent.

Liên quan: H03 H12 H17 H14 H31.

Nghiệm thu bắt buộc: Tên đầy đủ lưu đúng; không tự gộp trùng tên; permission note; không có kênh; gộp preview; xóa/export có audit; không lộ khách ngoài nhóm.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H14 — Catalog và đơn hàng

Phase: P6. Vai trò sử dụng: Agent; người quản lý catalog; visitor.

Nguồn khảo sát: O: HiChat Sắp ra mắt; D: D2 F09; P: toàn bộ giao dịch.

Đường vào tham chiếu: `/orders`.

Các ticket phải triển khai/đối chiếu:
- **H14.01** — Không dựng checkout hoạt động rồi gọi là bản sao HiChat: hiện chỉ có menu Orders và Sắp ra mắt. UI thực thi là thiết kế GoTek cần duyệt.
- **H14.02** — D2: giá, tồn kho, trạng thái và timestamp nguồn; catalog sản phẩm hoặc danh mục dịch vụ theo workspace.
- **H14.03** — Đơn test không trừ hàng thật; thao tác ghi cần khách xác nhận và idempotency; timeout có UNKNOWN chờ reconciliation.
- **H14.04** — Contact có cột đơn hàng nhưng chưa chứng minh order flow. Nối contact/conversation/order theo ID đúng tenant.
- **H14.05** — Thanh toán, shipping và doanh thu chỉ được ghi thành công sau receipt hệ thống nguồn; triển khai sau core theo E08.

Luồng chính: Xem catalog → Xác nhận nhu cầu → Tạo đơn có kiểm soát → Đối soát nguồn.

Dữ liệu/hợp đồng phải chốt: CatalogItem; inventory snapshot; order intent; transaction; provider receipt.

Liên quan: H13 H21 H23 H28 H32.

Nghiệm thu bắt buộc: Giá stale, hết hàng, timeout, duplicate, rollback; order mock tách ledger thật; không AI tự tuyên bố đã thanh toán.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H15 — Help Center và nội dung công khai

Phase: P5. Vai trò sử dụng: Editor; Workspace Admin; visitor.

Nguồn khảo sát: O: form portal Name/Slug; P: biên tập, publish và tìm kiếm.

Đường vào tham chiếu: `/portals/portal_articles_index`.

Các ticket phải triển khai/đối chiếu:
- **H15.01** — Menu Help Center có sẵn; form Name/Slug mới quan sát. Không tự chốt toàn bộ editor hoặc taxonomy của HiChat.
- **H15.02** — D2 yêu cầu article/category/locale/audience, nháp/xuất bản/thu hồi và search; quyền editor khác quyền publish nếu được PO phê duyệt.
- **H15.03** — Inbox có chọn Trung tâm trợ giúp; bài public hiển thị đúng portal/locale. Bài nội bộ không xuất ra widget public.
- **H15.04** — Thu hồi phải xóa khỏi search và cache, không chỉ ẩn hàng trong admin; URL cũ tuân theo policy truy cập.
- **H15.05** — Import web không tự động xuất bản Help Center; cần ranh giới giữa nguồn AI và nội dung công khai.

Luồng chính: Tạo portal → Soạn nội dung → Publish đúng audience → Widget mở bài.

Dữ liệu/hợp đồng phải chốt: Portal; category; article; locale; audience; version; search index.

Liên quan: H07 H10 H11 H16 H31.

Nghiệm thu bắt buộc: Draft bị chặn ở URL public; publish/withdraw; search theo locale; xóa index; truy cập chéo workspace; bài không có kết quả.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H16 — Thành viên nhóm và vai trò

Phase: P1. Vai trò sử dụng: Workspace Admin.

Nguồn khảo sát: O: agents/teams/custom roles; P: mời nhận và quyền đa tài khoản.

Đường vào tham chiếu: `/settings/people/agents`.

Các ticket phải triển khai/đối chiếu:
- **H16.01** — Giữ cấu trúc Quản lý nhân sự và phân biệt agent/team/custom role; không dùng chức danh kinh doanh làm system role mặc định.
- **H16.02** — GoTek mapping: Owner/Admin quản lý workspace; Agent xử lý scope được gán; Editor/Analyst/Billing chỉ khi permission set được chốt.
- **H16.03** — Sale chính thức/thử việc/thực tập cùng vai trò theo D1. Manager thấy nhóm, Leader thấy tổng hợp; Leader không phải Platform Admin.
- **H16.04** — Membership account không đồng nghĩa tham gia tất cả inbox; agent assignment H05 và nhóm H03 cần kiểm soát server.
- **H16.05** — Mời hết hạn, email đã tồn tại, thu hồi, rời workspace và hạ quyền là P; không gửi lời mời người thật trong khảo sát.

Luồng chính: Mời thành viên → Gán vai trò → Gán nhóm và inbox → Kiểm tra quyền.

Dữ liệu/hợp đồng phải chốt: Membership; team; role; permission set; invitation; inbox membership.

Liên quan: H01 H02 H03 H05 H22 H23 H31.

Nghiệm thu bắt buộc: Mỗi endpoint thử allow/deny với ít nhất hai role; thu hồi có hiệu lực session/realtime; agent không sửa billing/provider; không vượt số seat.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H17 — Nhãn và thuộc tính tùy chỉnh

Phase: P2. Vai trò sử dụng: Workspace Admin; agent sử dụng.

Nguồn khảo sát: O: form và types; P: lưu, list options, regex.

Đường vào tham chiếu: `/settings/labels/list ; /settings/custom-attributes/list`.

Các ticket phải triển khai/đối chiếu:
- **H17.01** — Nhãn: tên bắt buộc, mô tả, màu, Hiển thị nhãn trên sidebar bật; Hủy/Tạo, tên trống bị disabled.
- **H17.02** — Thuộc tính: Cuộc hội thoại/Liên lạc; Áp dụng cho Conversation/Contact, tên hiển thị, khóa, mô tả*, kiểu và bật regex.
- **H17.03** — Kiểu Text, Number, Link, Date, List, Checkbox; cần khảo sát từng form phụ và giá trị rỗng, format ngày, số thập phân.
- **H17.04** — Collection H12 ghi Contact attribute; automation H18 có thể thêm/xóa nhãn; reports H25 lọc theo nhãn.
- **H17.05** — Đổi khóa/type có dữ liệu phải có migration hoặc chặn rõ; không silently drop. Đây là yêu cầu GoTek cần thiết kế.

Luồng chính: Tạo định nghĩa → Chọn kiểu dữ liệu → Gắn vào hồ sơ → Lọc và báo cáo.

Dữ liệu/hợp đồng phải chốt: Label; entity-label link; attribute definition; typed value; validation rule.

Liên quan: H12 H13 H18 H19 H25.

Nghiệm thu bắt buộc: Trùng khóa, unicode, regex lỗi/tốn thời gian, xóa label đang dùng; filter cập nhật; permissions; migration type giữ dữ liệu đúng.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H18 — Tự động hóa hội thoại

Phase: P5. Vai trò sử dụng: Workspace Admin.

Nguồn khảo sát: O: builder; P: lưu và chạy.

Đường vào tham chiếu: `/settings/automation/list`.

Các ticket phải triển khai/đối chiếu:
- **H18.01** — Form Tên luật, Mô tả, Sự kiện, Điều kiện, Hành động; thêm/xóa hàng; hàng thứ hai VÀ/HOẶC.
- **H18.02** — Trigger: hội thoại tạo/cập nhật/mở và tin nhắn tạo; condition có trạng thái/ngôn ngữ/email/quốc gia/phone/referrer/inbox/priority. Operator phụ thuộc kiểu; precedence AND/OR chưa chứng minh.
- **H18.03** — Actions: agent/team, thêm/xóa nhãn, email nhóm/transcript, tắt/hoãn/resolve, webhook, attachment/message, priority và Add SLA.
- **H18.04** — D2: version/dry run/action ledger; giới hạn vòng lặp, event idempotency, lỗi giữa chừng không tự lặp lại hành động đã thành công.
- **H18.05** — Mỗi action nhận scope từ workspace; không cho rule gọi endpoint/đính kèm ngoài quyền hoặc gửi note nội bộ ra khách.

Luồng chính: Chọn trigger → Đặt điều kiện → Xếp hành động → Chạy và xem kết quả.

Dữ liệu/hợp đồng phải chốt: AutomationRule; condition tree; action list; event; execution ledger.

Liên quan: H03 H16 H17 H21 H29 H32.

Nghiệm thu bắt buộc: AND/OR truth table, trigger lặp, action2 lỗi sau action1, replay, quyền webhook, chống loop rule A↔B; có trạng thái partial failure.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H19 — Macro nhiều hành động

Phase: P5. Vai trò sử dụng: Agent tạo riêng; Admin chia sẻ theo quyền.

Nguồn khảo sát: O: builder/thứ tự/công khai; P: lưu và thực thi.

Đường vào tham chiếu: `/settings/macros ; /settings/macros/new`.

Các ticket phải triển khai/đối chiếu:
- **H19.01** — Canvas Bắt đầu → action → Thêm hành động mới → Kết thúc; kéo tay cầm sắp thứ tự theo hướng dẫn nguồn.
- **H19.02** — Actions: team/agent, nhãn, gỡ nhóm, email transcript, tắt/hoãn/resolve, file/message, note riêng, priority.
- **H19.03** — Tên Macro; Công khai/Riêng tư; Lưu macro. Công khai là trong account, không phải Internet.
- **H19.04** — Phân biệt macro do agent gọi với automation theo event; cả hai có action audit nhưng không chia sẻ quyền vượt role.
- **H19.05** — Xác minh note và reply khác nhau; partial failure cần báo action nào xong/lỗi, retry không gửi trùng.

Luồng chính: Tạo macro → Xếp hành động → Chọn phạm vi → Chạy trên hội thoại.

Dữ liệu/hợp đồng phải chốt: Macro; owner; visibility; ordered actions; execution result.

Liên quan: H03 H16 H17 H18 H20 H22.

Nghiệm thu bắt buộc: Hai agent kiểm visibility; kéo thứ tự; quyền gọi; action không còn hợp lệ; gửi file lỗi; replay không gửi đôi; note chỉ nội bộ.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H20 — Thư mẫu phản hồi

Phase: P5. Vai trò sử dụng: Agent theo quyền; Admin quản lý.

Nguồn khảo sát: O: form và giới hạn file; P: upload và composer.

Đường vào tham chiếu: `/settings/canned-response/list`.

Các ticket phải triển khai/đối chiếu:
- **H20.01** — Modal Mã rút gọn, Tin nhắn editor, tệp đính kèm, Hủy/Lưu; danh sách và tìm kiếm cần đối chiếu khi có dữ liệu.
- **H20.02** — Hướng dẫn UI tối đa5 tệp, 40MB/tệp; ảnh/video/audio/PDF/DOC/DOCX. Không áp giới hạn này cho nguồn tri thức.
- **H20.03** — Composer dùng /mã để chèn thư; việc chọn mẫu không được tự gửi trước khi agent xác nhận theo UX cần kiểm chứng.
- **H20.04** — Tệp quét MIME/kích thước; URL tải có quyền và thời hạn; mẫu bị sửa/xóa khi agent đang soạn xử lý rõ.
- **H20.05** — Mẫu câu AI H10 là dữ liệu cho bot, không phải canned reply cho agent. Hai module không gộp.

Luồng chính: Soạn thư mẫu → Đặt mã ngắn → Gõ dấu / trong chat → Chọn rồi gửi.

Dữ liệu/hợp đồng phải chốt: CannedResponse; short code; rich content; attachment references.

Liên quan: H03 H19 H16 H32.

Nghiệm thu bắt buộc: Mã trùng, 6file, 40MB+, MIME sai, thiếu quyền, template bị xóa; nội dung XSS; chèn đúng và gửi được phía visitor.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H21 — Tích hợp và webhook

Phase: P5. Vai trò sử dụng: Workspace Admin; quản trị tích hợp.

Nguồn khảo sát: O: 11 card và 10 event; P: kết nối/delivery.

Đường vào tham chiếu: `/settings/integrations`.

Các ticket phải triển khai/đối chiếu:
- **H21.01** — Card: Webhooks, Ứng dụng bảng điều khiển, Linear, Dialogflow, Google Translate, Dyte, Lark, Google Sheets, Kim Kiều Flower, CDP, KiotViet. Không loại bỏ card mà chưa ghi quyết định sản phẩm.
- **H21.02** — Webhook form: tên tùy chọn, URL, checkbox event, Hủy/Tạo disabled khi trống.
- **H21.03** — Event conversation_created/status_changed/updated; message_created/updated; webwidget_triggered; contact_created/updated; data_collected/data_collection_completed.
- **H21.04** — D2: secret vault, scope, signature contract, retry hữu hạn, outbox/dead letter/replay và delivery log; các chi tiết này chưa xác minh là cơ chế HiChat.
- **H21.05** — Connector ngành cần mapping dữ liệu và API thật riêng. Ứng dụng bảng điều khiển cần sandbox nội dung nhúng và quyền; không mặc định chung contract với webhook.

Luồng chính: Chọn connector → Cấu hình đúng quyền → Phát event → Theo dõi receipt.

Dữ liệu/hợp đồng phải chốt: IntegrationConfig; secret reference; event envelope; delivery attempt; external ID map.

Liên quan: H12 H14 H18 H26 H30 H31 H32.

Nghiệm thu bắt buộc: Timeout, HTTP429/500, webhook trùng/out-of-order, quyền thu hồi, chữ ký sai, endpoint private; không leak secret; receipt cho từng connector.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H22 — Audit và bảo mật SSO

Phase: P1, P5. Vai trò sử dụng: Workspace Admin; auditor theo quyền.

Nguồn khảo sát: O: event mời admin; SSO lỗi tải; P: cấu hình hoạt động.

Đường vào tham chiếu: `/settings/audit-logs/list ; /settings/security`.

Các ticket phải triển khai/đối chiếu:
- **H22.01** — Audit có actor, vai trò, thời gian/IP trong event mời; không đưa IP thật vào tài liệu. Một event không chứng minh bao phủ tất cả thao tác.
- **H22.02** — SSO mô tả Google Workspace/Microsoft/Okta và công tắc; đã thấy Không tải được cài đặt. Vui lòng thử lại. Không coi lỗi này là yêu cầu tái tạo.
- **H22.03** — GoTek: log actor/action/target/change/time/request/reason, có retention và quyền export; không lưu secret hoặc toàn nội dung chat mặc định.
- **H22.04** — Bật SSO cần test fallback admin và tránh lockout; role mapping và revoke phải đúng workspace. Chi tiết form chờ xác minh.
- **H22.05** — Đăng nhập/SSO, hỗ trợ platform và content audit là quyền riêng; không dùng một toggle chung.

Luồng chính: Mở audit hoặc SSO → Lọc sự kiện → Xem thay đổi → Đối soát quyền.

Dữ liệu/hợp đồng phải chốt: AuditEvent; auth policy; identity provider config; support grant.

Liên quan: H01 H16 H28 H32.

Nghiệm thu bắt buộc: Login và cấu hình bị từ chối có log; redaction; role revoked; SSO error/retry; tài khoản admin khôi phục; log không sửa trái phép.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H23 — Gói quota billing và nâng cấp

Phase: P1, P5. Vai trò sử dụng: Owner; billing role; Platform Admin quản lý catalog gói.

Nguồn khảo sát: O: billing/usage; P: upgrade/payment và meter thực.

Đường vào tham chiếu: `/settings/billing ; /settings/usage ; /settings/upgrade`.

Các ticket phải triển khai/đối chiếu:
- **H23.01** — Sandbox: Starter/Hoạt động/Miễn phí/Trọn đời/1 giấy phép; Usage người1/2, inbox1/2, AI0/2000, kho0/16. Không coi đây là giá GoTek.
- **H23.02** — Hạn mức theo từng loại: 2user,2inbox,2000AI hệ thống/tháng,2500API riêng,FAQ5,training5,ảnh2,web1,field3,rule2,sample3.
- **H23.03** — Nút cổng thanh toán/xem giới hạn/hỗ trợ; nâng cấp chưa thực hiện. Chênh 1 giấy phép và limit2 chưa giải thích.
- **H23.04** — D1 đề nghị tier hội thoại/tháng; phải tách conversation, AI response, seat, inbox, storage và token. Không cộng meter khác đơn vị.
- **H23.05** — D2: entitlement chỉ cấp sau event xác nhận, webhook chống trùng; cancel/refund/grace/downgrade lưu policy. Sau core ở E09, nhưng quota guard phải có trong core.

Luồng chính: Xem gói → Xem hạn mức → Chọn nâng cấp → Đối soát entitlement.

Dữ liệu/hợp đồng phải chốt: Plan; subscription; entitlement; usage ledger; invoice event; billing receipt.

Liên quan: H08 H10 H16 H28 H32.

Nghiệm thu bắt buộc: Vượt ngưỡng; reset chu kỳ/timezone; concurrent request gần ngưỡng; payment callback trùng; downgrade không mất dữ liệu; UNKNOWN không coi thất bại để thu tiền lại.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H24 — Báo cáo tổng quan hội thoại CSAT SLA

Phase: P4, P5. Vai trò sử dụng: Admin; analyst theo scope.

Nguồn khảo sát: O: filter/chỉ số/empty; P: công thức và export.

Đường vào tham chiếu: `/reports/overview ; /reports/conversation ; /reports/csat ; /reports/sla`.

Các ticket phải triển khai/đối chiếu:
- **H24.01** — Overview: open/unassigned/pending, trạng thái agent, heatmap giờ0–24, khối team/inbox/label và agent; không tự thay bằng dashboard doanh thu.
- **H24.02** — Conversation: khoảng7ngày/30ngày/3tháng/6tháng/nămngoái/custom,24x7; conversations,incoming/outgoing,first reply,resolution,resolved count,pending time.
- **H24.03** — CSAT: agent/team/inbox, bộ chọn chưa rõ nhãn, date/export; total responses/satisfaction/response rate; empty phân trang1/0.
- **H24.04** — SLA: Hit Rate/Misses/Conversations; filter SLA Policy,inbox,agent,team,label; list conversation/policy/agent. Sandbox0conversation nhưng Hit Rate100%.
- **H24.05** — Metric dictionary GoTek phải định nghĩa numerator/denominator, timezone, bot/agent, reopened, business hours, empty; chưa có dữ liệu thì không tự khẳng định bằng công thức tên gọi.

Luồng chính: Chọn loại báo cáo → Đặt thời gian lọc → Đọc chỉ số → Đối soát hội thoại.

Dữ liệu/hợp đồng phải chốt: Conversation events; message timings; CSAT response; SLA policy evaluation; report snapshot.

Liên quan: H03 H05 H06 H16 H17 H29 H32.

Nghiệm thu bắt buộc: Dataset nhỏ có đáp án tính tay; 0 mẫu, ngoài giờ, reopen, missing agent, bot reply; export bằng UI; quyền analyst; drilldown tái tính đúng.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H25 — Báo cáo dữ liệu kênh agent nhãn nhóm

Phase: P4, P5. Vai trò sử dụng: Admin; analyst.

Nguồn khảo sát: O: đủ các màn/bộ lọc; P: dữ liệu thực và export.

Đường vào tham chiếu: `/reports/data-collection ; /reports/inboxes ; /reports/agent ; /reports/label ; /reports/teams`.

Các ticket phải triển khai/đối chiếu:
- **H25.01** — Data collection: XLSX,date,trường,tìm kiếm,status tất cả/đã hoàn tất/đang/chưa thu; sort completion/update/name tăng/giảm.
- **H25.02** — Thẻ tổng khách/đủ/đang/chưa có; tiến độ tuần, theo trường, chi tiết khách. Cảnh báo chưa bật collection/không có trường không phải lỗi xử lý.
- **H25.03** — Inbox/agent: chọn đối tượng,date,24x7,export và metrics hội thoại. Nhãn/team có title Tổng quan, bộ chọn,7ngày,24x7,Tải báo cáo.
- **H25.04** — Dropdown giờ ở nhãn có Giờ làm việc/24x7; nhóm hiện List is empty. Chưa thấy biểu đồ sau khi chọn nhóm hoặc nhãn có dữ liệu.
- **H25.05** — Export là dữ liệu cá nhân, phải cùng scope filter/permission; giá trị bảng và file phải đối soát, không lộ khách tenant khác.

Luồng chính: Chọn đối tượng → Lọc dữ liệu → Xem tổng và chi tiết → Xuất để đối soát.

Dữ liệu/hợp đồng phải chốt: Collection progress; dimension keys; report filters; export job; scoped result.

Liên quan: H12 H13 H16 H17 H24.

Nghiệm thu bắt buộc: Required vs all, thay schema field, khách sửa dữ liệu; label bị gỡ; agent rời nhóm; range/timezone; XLSX tiếng Việt, công thức CSV injection.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H26 — Tóm tắt AI và báo cáo định kỳ

Phase: P5. Vai trò sử dụng: Admin; manager theo quyền.

Nguồn khảo sát: O: form bao gồm Lark; P: AI run/schedule delivery.

Đường vào tham chiếu: `/reports/bulk-summary ; /reports/scheduled`.

Các ticket phải triển khai/đối chiếu:
- **H26.01** — Bulk: inbox,status open/pending/resolved/all,7ngày/30/custom,số dòng10/20/50/100; Tạo tóm tắt/Tạo lại tất cả; chưa chạy AI.
- **H26.02** — Scheduled: tên,active,open-or-pending/only-open/all,timezone,inbox nguồn trống=tất cả; một hoặc thêm lịch.
- **H26.03** — Đích Chatwoot: inbox nhận→contact nhận; đích Lark: kết nối→nhóm. Trường sau disabled khi chưa chọn trường trước.
- **H26.04** — Khoảng Trong ngày/tuần/tháng/năm,Giờ18/Phút0 đang hiển thị; chọn tuần không xuất hiện thứ trong lần thử. Cần chốt ranh giới kỳ và tần suất.
- **H26.05** — Lịch tổng hợp khách chờ trả lời theo mô tả nguồn; không tự dùng để broadcast marketing. Scheduler phải dedup theo report/window/destination và có receipt.

Luồng chính: Chọn bộ lọc → Tạo tóm tắt hoặc lịch → Chọn nơi nhận → Theo dõi kết quả.

Dữ liệu/hợp đồng phải chốt: Summary batch; scoped conversations; report schedule/timezone; run window; delivery receipt.

Liên quan: H03 H08 H21 H24 H25 H31.

Nghiệm thu bắt buộc: Không data, AI lỗi/hết quota, nhiều lịch trùng, timezone/DST; người nhận mất quyền; retry không gửi đôi; không gửi chat nội bộ vào nhóm ngoài scope.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H27 — Responsive bàn phím và khả năng tiếp cận

Phase: P2, P4, P5. Vai trò sử dụng: Mọi vai trò.

Nguồn khảo sát: O: cấu hình inbox hẹp đổi menu; P: matrix viewport và keyboard đầy đủ.

Đường vào tham chiếu: `Tất cả dashboard và widget`.

Các ticket phải triển khai/đối chiếu:
- **H27.01** — Desktop giữ rail/module sidebar/content theo ảnh nguồn. Hẹp: menu tab chuyển dropdown đã quan sát ở widget settings; breakpoint cụ thể chưa đo.
- **H27.02** — Inbox mobile cần list→conversation→contact có đường quay lại và giữ draft; đây là yêu cầu chất lượng GoTek chờ đối chiếu HiChat mobile.
- **H27.03** — Modal: focus vào form, trap focus, Escape/Hủy không lưu, trở về trigger; validation đặt ngay trường và đọc được bằng screen reader.
- **H27.04** — Widget: safe area, bàn phím ảo, upload progress, reconnect và launcher không che CTA website; không dùng màu làm dấu hiệu duy nhất.
- **H27.05** — Khóa baseline theo viewport/state/theme/font. Không cho AI tự thêm layout SaaS marketing, bento card hoặc animation chưa có trong nguồn.

Luồng chính: Mở đúng viewport → Đi qua bằng phím → Thực hiện tác vụ → Đối chiếu trạng thái.

Dữ liệu/hợp đồng phải chốt: Viewport/state reference; focus order; accessible name; UI token; visual regression fixture.

Liên quan: H01 H03 H07 H10 H13 H24.

Nghiệm thu bắt buộc: Desktop1280/1440,tablet768,mobile390/360 là viewport test đề xuất; capture nguồn tương ứng trước chốt. Tab/ShiftTab/Enter/Escape,200% zoom, lỗi form và đọc nhãn.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H28 — Platform Admin và cấp quyền AI

Phase: P1, P4. Vai trò sử dụng: Platform Admin; support grant có thời hạn.

Nguồn khảo sát: D: D2; P: thiết kế và runtime GoTek.

Đường vào tham chiếu: `Không có màn HiChat nội bộ được truy cập`.

Các ticket phải triển khai/đối chiếu:
- **H28.01** — Tách console platform với workspace; không giả định HiChat có bố cục Platform Admin giống dashboard khách.
- **H28.02** — Registry provider/model/capability; secret reference; grant tenant/bot; routing/fallback; quota và kill switch có reason/audit.
- **H28.03** — Support chỉ metadata mặc định; truy cập nội dung cần grant đúng scope, lý do, thời hạn và log; hết hạn mất quyền.
- **H28.04** — Tenant lifecycle, plan và health job/queue nối H23/H32; emergency disable không xóa dữ liệu.
- **H28.05** — UI dùng component Gotek từ shell đã đối chiếu, nhưng navigation platform là thiết kế riêng có nhãn đề xuất, PO duyệt trước code.

Luồng chính: Đăng nhập platform → Quản lý provider tenant → Cấp policy và quota → Theo dõi vận hành.

Dữ liệu/hợp đồng phải chốt: Provider; model; capability; tenant grant; policy version; support access; incident.

Liên quan: H02 H08 H22 H23 H32.

Nghiệm thu bắt buộc: Grant sai capability bị chặn; key không xuất browser; support expiry; disable provider có fallback; cross-tenant; restore không tự mở grant cũ.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H29 — Ticket SLA và escalation

Phase: P6. Vai trò sử dụng: Agent; manager; visitor xem trạng thái được phép.

Nguồn khảo sát: D: yêu cầu nguồn; P: UI/runtime.

Đường vào tham chiếu: `Theo D2 F07; chưa có route HiChat đã xác minh`.

Các ticket phải triển khai/đối chiếu:
- **H29.01** — Ticket liên kết conversation/contact,không tự tạo trùng khi retry; assignee,status,priority,SLA,attachment và note.
- **H29.02** — Chuyển từ chat sang ticket giữ bối cảnh và quyền; khách chỉ thấy nội dung public, note nội bộ luôn tách.
- **H29.03** — SLA theo policy đã chốt: giờ kinh doanh,timezones,pause/escalation; báo cáo H24 cần dùng cùng event và definition.
- **H29.04** — Resolve/reopen và escalation có thông báo đúng đối tượng; không đồng nhất đóng hội thoại với hoàn tất ticket.
- **H29.05** — Core phải có handoff ổn định; ticket nâng cao sau core E07. Không lùi reply ownership/consent theo mục đích sang giai đoạn sau.

Luồng chính: Handoff cần theo dõi → Tạo ticket → Nhận và xử lý → Resolve hoặc reopen.

Dữ liệu/hợp đồng phải chốt: Ticket; conversation link; status history; SLA clock; escalation job; public/private note.

Liên quan: H03 H06 H13 H16 H21 H24.

Nghiệm thu bắt buộc: Retry không nhân ticket; reopen khởi động đồng hồ theo policy; quá hạn và ngày nghỉ; note không lộ; assignee rời nhóm; khách xem đúng ticket.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H30 — Đa kênh và nhận diện khách

Phase: P6. Vai trò sử dụng: Workspace Admin; agent.

Nguồn khảo sát: O/D: danh mục kênh; P: provider connect và receipt.

Đường vào tham chiếu: `Kênh chat → chọn loại kênh`.

Các ticket phải triển khai/đối chiếu:
- **H30.01** — Facebook/Zalo/Telegram là phạm vi cần xem contract riêng; không đồng nhất webhook hay widget với omnichannel đã hoàn chỉnh.
- **H30.02** — Mỗi kênh cần loại tài khoản hỗ trợ, callback/subscription, token expiry/revoke,định dạng message/media và hạn chế thời gian trả lời.
- **H30.03** — Identity theo channel+external_id+workspace; không gộp người chỉ vì trùng tên,avatar,phone chưa xác minh.
- **H30.04** — Composer chỉ bật capability kênh cho phép; rate limit/permission denied/unsend hay delivery status phải hiển thị rõ.
- **H30.05** — Sau core triển khai từng kênh E10; migration conversation và timeline không làm lộ note/nguồn nội bộ.

Luồng chính: Chọn kênh → Cấp kết nối → Map identity → Nhận và trả lời.

Dữ liệu/hợp đồng phải chốt: Channel account; capability; external identity map; event/message mapping; receipt.

Liên quan: H03 H04 H13 H16 H21 H23.

Nghiệm thu bắt buộc: Webhook duplicate/out-of-order, hết token, quá cửa sổ, media không hỗ trợ, revoke; E2E inbound/outbound riêng mỗi kênh, không chỉ card Cấu hình.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H31 — Lark Wiki và quyền tri thức kinh doanh

Phase: P3, P6. Vai trò sử dụng: Sale; manager; leader; knowledge owner.

Nguồn khảo sát: D: hai lớp quyền; P: ACL nguồn và sync.

Đường vào tham chiếu: `GoTek mở rộng D1 mục3–6; không phải HiChat đã chứng minh`.

Các ticket phải triển khai/đối chiếu:
- **H31.01** — Quyền ứng dụng quyết định ai xem/chat/phân bổ; quyền RAG quyết định nguồn trả lời. Phải kiểm cả hai, không dùng role UI để thay ACL nguồn.
- **H31.02** — Lark Wiki cần audit quyền hiện có; metadata filter,permission sync hoặc check realtime là ba lựa chọn chưa chốt; revoke phải tác động cache và index.
- **H31.03** — Dữ liệu tri thức tách khách hàng/hội thoại; lương,hợp đồng,tài chính nội bộ loại khỏi nguồn AI theo D1.
- **H31.04** — Sale cùng quyền dù chính thức/thử việc/thực tập; manager scope nhóm; leader tổng hợp và policy,không default chat thường nhật.
- **H31.05** — Sau core E04/E05 triển khai Lark/internal assistant; nguồn public website vẫn cách ly ngay trong core. Nội bộ không buộc tạo CRM lead.

Luồng chính: Đồng bộ nguồn ACL → Xác thực người hỏi → Lọc retrieval → Trả lời đúng quyền.

Dữ liệu/hợp đồng phải chốt: Source ACL; subject/group map; document audience; permission version; business role scope.

Liên quan: H10 H11 H13 H16 H21 H28 H32.

Nghiệm thu bắt buộc: Người khác phòng không thấy snippet/citation; revoke có hiệu lực trong thời gian chốt; link gốc kiểm quyền; tenant khác cùng email không được truy cập.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

### H32 — Vận hành privacy và khôi phục

Phase: P1, P4. Vai trò sử dụng: Ops; Platform Admin; auditor.

Nguồn khảo sát: D: yêu cầu; P: production/restore thực.

Đường vào tham chiếu: `Theo D2 F17 F18; GoTek console vận hành`.

Các ticket phải triển khai/đối chiếu:
- **H32.01** — Log metadata request/model/provider/time/usage/cost/error; nội dung chỉ bật Content Audit có policy/retention/role; redaction secret.
- **H32.02** — Worker bounded: claim/retry/backoff/stale recovery/dead letter; idempotency cho mọi side effect và trạng thái UNKNOWN khi chưa có receipt.
- **H32.03** — Backup database/object/schema/config/secret reference; môi trường restore cô lập,cấm gửi email/webhook và giao dịch cũ.
- **H32.04** — Đối soát số lượng,file,ACL,index; RPO/RTO cần chủ hệ thống chốt và diễn tập,không coi Git checkpoint là backup dữ liệu.
- **H32.05** — Incident/rollback/kill switch, retention/export/delete và tenant closure; bản phát hành cần owner ký evidence. Core không được hoãn tenant isolation,bảo mật,backup tối thiểu.

Luồng chính: Quan sát runtime → Xử lý sự cố → Backup và restore → Đối soát trước mở traffic.

Dữ liệu/hợp đồng phải chốt: Request/usage/audit ledger; job; outbox; backup manifest; restore report; incident.

Liên quan: H08 H11 H21 H22 H23 H28.

Nghiệm thu bắt buộc: Restore sang môi trường mới; kiểm ACL/file/index; không replay side effect; quota reconciliation; lỗi provider; retention purge đúng scope; drill incident và rollback.

Bằng chứng giao lại: commit/env, screen contract, ảnh nguồn và ảnh GoTek cùng state, kiểm quyền, kết quả API/dữ liệu/receipt liên quan, gap còn lại. Dùng mẫu nghiệm thu; không đánh dấu toàn bộ phiếu đạt khi mới xong một ticket.

## E01–E12 sau core
Đọc phần15 handoff cho nguồn và tiêu chí từng E. Thứ tự dưới đây là phụ thuộc đề xuất, không phải lịch cố định.

| Mã | Hạng mục | Phụ thuộc trước khi làm |
| --- | --- | --- |
| E01 | Dẫn nguồn chủ động | H08/H10/H11, quyền H31 và core citation đạt |
| E02 | CRM lead/cơ hội | H13/H16/H17/H25; PO chốt stage và conversion |
| E03 | Phân tích AI trong hội thoại | H03/H08/H13/H25; có dữ liệu kiểm và policy |
| E04 | Lark Wiki/trợ lý nội bộ | H10/H11/H21/H31; kiểm ACL và revoke nguồn |
| E05 | Manager/leader theo nghiệp vụ | H16/H28/H31; chốt quyền nghiệp vụ không đồng nhất Platform Admin |
| E06 | Onboarding 3 nhóm dữ liệu | H10/H11/H12; schema/audience/publish có sẵn |
| E07 | Ticket/SLA nâng cao | H03/H24/H29; owner, consent và clock definition |
| E08 | Catalog/giao dịch | H13/H14/H21; nguồn tồn/giá và idempotency |
| E09 | Thu phí SaaS | H23/H28; usage ledger, entitlement và provider receipt |
| E10 | Đa kênh/tích hợp | H21/H30; quyền ứng dụng và capability từng kênh |
| E11 | Phong cách theo sale | H08/H09/H16/H31; precedence và ownership |
| E12 | Mở rộng vận hành | H22/H28/H32; baseline core restore/monitoring đã đạt |

## Mẫu giao cho AI/dev

**Lập đặc tả:** “Dùng $gotek-chatbot-delivery, đọc baseline hiện hành, hoàn thiện Spec ready cho H04.01–H04.05. Chỉ khảo sát và lập contract, chưa code. Ghi rõ P và bằng chứng thiếu.”

**Triển khai khi đã được giao code:** “Dùng $gotek-chatbot-delivery, triển khai H04 trong repo [đường dẫn] theo phase P2 và các quyết định đã chốt. Đọc repo trước, nối UI/API/data thật, kiểm tenant/domain/retry và visitor → inbox → agent → visitor. Trả commit, evidence và gap; không tự deploy.”

**Review:** “Dùng $gotek-chatbot-delivery để review H03 của commit [sha] trên [môi trường]. Đối chiếu từng H03.yy, chạy takeover race và reconnect, so UI cùng state. Ghi pass/fail/not-run và điều kiện còn thiếu; không sửa sản phẩm nếu chỉ được giao review.”

## Khi gặp điểm chưa khảo sát
Không chờ toàn bộ HiChat được khảo sát mới tiến hành phần độc lập. Ghi gap có mã, ảnh/trường/behavior thiếu, hạng mục bị ảnh hưởng, cách xác minh và người xử lý. Nếu dùng thiết kế GoTek tạm thời, gắn decision ID, không gọi đó là HiChat đã xác minh; parity vẫn mở cho đến khi được kiểm hoặc người có trách nhiệm chấp nhận sai khác.
