# Báo cáo nền tảng GoTek ChatBOT trước triển khai

Ngày khảo sát 24 09 2026

## 1 Kết luận và phạm vi đề nghị

GoTek nên xây dựng lõi SaaS nhiều workspace ngay từ đầu, với ba bề mặt sử dụng: quản trị nền tảng, dashboard vận hành của workspace và widget dành cho khách truy cập website. Bám sát HiChat về danh mục chức năng, bố cục, điều hướng, thứ tự thao tác và trạng thái UI/UX. Core là đợt triển khai đầu trong phạm vi tương đương HiChat, không phải một sản phẩm rút gọn thay thế. Backend được triển khai riêng, giữ các ràng buộc dữ liệu và quyền trong hai tài liệu GoTek. Core hoàn chỉnh phải chứng minh được một vòng vận hành thật: tạo workspace → nạp và duyệt tri thức → nhúng widget → khách hỏi → AI trả lời có căn cứ → nhân viên tiếp nhận → lưu lead → báo cáo đối soát được.

Ưu tiên hiện tại là hoàn thành báo cáo để chủ sản phẩm duyệt trước khi viết code. Những câu giao việc, deadline và kết luận kiểm thử trong hai file nguồn được xem là nội dung cần phân tích, không tự động trở thành lệnh triển khai hoặc bằng chứng hiện trạng của workspace này.

### Quyết định kiến trúc nên chốt

- Multi-tenant từ phiên bản đầu: mỗi workspace là một ranh giới dữ liệu độc lập; một người có thể có vai trò khác nhau tại các workspace.
- Platform Admin quản lý doanh nghiệp sử dụng SaaS, provider/model, quota và vận hành. Workspace Admin quản lý khách hàng, hội thoại và cấu hình của doanh nghiệp mình. Hai loại CRM phục vụ hai đối tượng khác nhau.
- Đưa inbox cơ bản, CRM lead tối thiểu, handover theo hội thoại và nút yêu cầu người thật vào core. Không đợi CRM nâng cao mới làm quy trình vận hành đầu cuối.
- Kho tri thức dùng cho widget chỉ chứa nội dung đã duyệt cho khách ngoài. Kho nội bộ và ACL phòng ban là phần mở rộng riêng, nhưng schema phải chuẩn bị audience và quyền từ đầu.
- Dùng kiến trúc ứng dụng chia module trong một hệ thống thống nhất, kèm worker xử lý nền. Chưa cần chia nhỏ thành nhiều microservice.

### Phạm vi giao diện đầu tiên

| Bề mặt | Nội dung cần có trong core | Người dùng |
|---|---|---|
| Platform Console | Workspace, trạng thái dịch vụ, model, quota, usage, lỗi, audit | Platform Admin |
| Workspace Dashboard | Inbox, khách hàng và lead, tri thức, bot, widget, thành viên, báo cáo | Workspace Admin; Agent theo quyền |
| Website Widget | Chat, nguồn tham khảo, trạng thái gửi, yêu cầu người thật, lưu phiên | Khách truy cập |

Báo cáo dự án cung cấp cho biết đã có 92 bài kiểm thử local đạt. Đây là kết quả được tài liệu ghi nhận, chưa được chạy lại trong khảo sát này. Thư mục làm việc hiện tại chưa có source sản phẩm để kết luận nên sửa, tái sử dụng hay thay thế toàn bộ. Trước triển khai cần nhận đúng repository và đánh giá các module còn dùng được; tránh viết lại phần đã đạt chỉ vì giao diện cần thay đổi.

Nguồn: [D1] Product Brief mục 3–5, 10, 12; [D2] Báo cáo dự án mục 2, 4, 7. Các đề nghị kiến trúc trong mục này là khuyến nghị cho GoTek.

---PAGE---
## 2 Đối chiếu hai tài liệu GoTek

Product Brief diễn giải mục tiêu kinh doanh và thứ tự tính năng. Báo cáo dự án tập trung vào kiến trúc, trạng thái kiểm thử và điều kiện phát hành. Hai tài liệu bổ sung cho nhau, nhưng có một số điểm cần thống nhất trước khi chuyển thành backlog.

| Vấn đề | Nhận định từ tài liệu | Đề nghị áp dụng |
|---|---|---|
| Nhiều khách hàng | D1 để ngỏ làm multi-tenant sớm hay muộn; D2 đã coi tenant là nền tảng | Chốt multi-tenant ngay, kể cả pilot nội bộ |
| CRM và dashboard | D1 đặt CRM nâng cao ở giai đoạn 2; yêu cầu hiện tại cần dashboard core | Làm contact, lead, người phụ trách, trạng thái và lịch sử trước; AI scoring/phễu nâng cao sau |
| Chuyển người thật | D1 ưu tiên sale dừng AI; khách xin người thật ở giai đoạn 2 | Làm cả hai đường trong core để không kẹt khách khi bot thiếu căn cứ |
| Tri thức nội bộ | D1 muốn Lark Wiki và ACL phòng ban | Chuẩn bị audience; chưa trộn tài liệu nội bộ vào bot public |
| Dữ liệu khách hàng | D1 tách khỏi tri thức; D2 mô tả consent, retention, audit | Tách kho nghiệp vụ khỏi kho retrieval; không mặc định dùng lịch sử chat để huấn luyện |
| Hiện trạng | D2 ghi local tests và nhiều hạng mục chưa đạt | Dùng làm danh sách cần xác minh, không công bố production-ready |
| Deadline | D1 nêu demo đầu tháng 10 2026 | Chỉ phù hợp demo phạm vi hẹp nếu đủ nguồn lực; không đồng nghĩa nền tảng thương mại hoàn chỉnh |

### Hai nhận định cạnh tranh cần sửa

Glean hiện mô tả nguồn trích dẫn có thể mở bản gốc trong ứng dụng nguồn và chịu quyền truy cập của người dùng. Do đó, nhận định “Glean chưa hỗ trợ mở nguồn gốc” trong D1 không còn là cơ sở đủ chắc. UX hỏi khách có muốn xem tài liệu vẫn có thể hữu ích, nhưng cần thử nghiệm tỷ lệ sử dụng, không gọi là độc quyền thị trường. [X1]

Intercom mô tả Fin dừng khi escalation và có thao tác takeover trong các luồng được tài liệu hóa. Chưa thể suy ra mọi kênh đều có nút pause/resume đúng như GoTek muốn, nhưng cũng không thể nói đối thủ chỉ dừng AI toàn kênh. Giá trị GoTek nên tập trung vào thao tác rõ ràng, không trả lời chồng, tiếng Việt tốt và dữ liệu doanh nghiệp có kiểm soát. [X2][X3]

### Điểm cần làm rõ trong D2

“Metadata-first” áp dụng cho nhật ký vận hành và quyền xem của Platform Admin. Inbox vẫn cần lưu nội dung hội thoại theo chính sách workspace để nhân viên tiếp nhận được bối cảnh. Nếu hiểu thành không lưu nội dung ở bất kỳ đâu thì inbox, lịch sử và handover sẽ không hoạt động đúng.

Yêu cầu “không consent thì không handoff” nên tách theo mục đích xử lý: giải thích việc chuyển cuộc chat hiện tại cho đội hỗ trợ; chỉ yêu cầu thông tin liên hệ và đồng ý phù hợp khi cần liên lạc lại. Không biến ô đồng ý nhận marketing thành điều kiện bắt buộc để gặp nhân viên.

---PAGE---
## 3 HiChat từ đăng ký đến workspace

### Đăng ký và xác thực

Đã quan sát trực tiếp form tại /app/auth/signup: tên đầy đủ, tên công ty, email công việc, số điện thoại bắt buộc, mã giới thiệu tùy chọn và mật khẩu. Form nói tạo tài khoản đồng nghĩa đồng ý điều khoản và chính sách riêng tư. Tài liệu hướng dẫn mô tả tạo account, gửi lại email xác thực và mở liên kết xác nhận trong email. [H1]

Phiên Chrome sẵn có truy cập được dashboard của một account nhưng vẫn hiển thị cảnh báo chưa xác thực email. Điều này chỉ chứng minh quyền truy cập của phiên quan sát; chưa chứng minh tài khoản chưa xác thực được dùng mọi tính năng.

Đã chuẩn bị form dữ liệu mẫu GoTek Sandbox Research ở phiên riêng. Người dùng nhận tự hoàn tất mật khẩu, điều khoản và email xác thực. Sau khi người dùng tự điền email, số điện thoại và mật khẩu rồi yêu cầu submit, tài khoản đã tạo thành công. HiChat tự tạo account 214 tên GoTek Sandbox Research và chuyển thẳng vào inbox trống. Chưa có bước wizard tạo workspace riêng. Banner xác thực email vẫn hiện; đăng ký thành công không đồng nghĩa email đã xác thực.

### Đăng nhập và khôi phục

Form /app/login có email, password, hiện/ẩn mật khẩu, ghi nhớ đăng nhập, liên kết quên mật khẩu và đăng ký doanh nghiệp. Trang khôi phục yêu cầu email để gửi hướng dẫn. Đã xem form và tài liệu; chưa gửi yêu cầu khôi phục và chưa kiểm thử thông báo sai mật khẩu, token hết hạn hay khóa tài khoản. [H2]

### Account và workspace

UI dùng đường dẫn /app/accounts/{id}; trang Doanh nghiệp có tên tài khoản, ngôn ngữ và Account SID để tích hợp. Trong báo cáo này “workspace” là khái niệm GoTek tương ứng phạm vi doanh nghiệp/account đã quan sát, không khẳng định HiChat có cùng mô hình dữ liệu bên trong. Chưa xác minh luồng một người tạo workspace thứ hai hoặc chuyển giữa nhiều workspace. [H3]

### Luồng GoTek phải bám sát

Đăng ký doanh nghiệp → tự tạo account theo tên công ty → mở inbox trống với cảnh báo xác thực email → Kênh mới → chọn Website → nhập cấu hình → chọn nhân viên → hoàn tất và lấy snippet. Không chèn wizard onboarding mới thay thế luồng đã quan sát.

Đã thực hiện trên sandbox: tạo GoTek Website Sandbox với domain mẫu https://example.com, chọn Người thử nghiệm GoTek làm nhân viên. HiChat tạo inbox 269 và hiển thị “Hộp thư đến của bạn đã sẵn sàng!”, mã SDK nhúng cùng liên kết Nhiều tuỳ chọn hơn và Đưa cho tôi. Đây là bằng chứng tạo kênh và cấu hình, chưa là bằng chứng website bên ngoài nhận/gửi tin thành công.

Các trường hợp email trùng, token hết hạn, khôi phục mật khẩu và nhiều workspace cần khảo sát bổ sung trước đặc tả chi tiết. Không tự xây bộ chọn workspace hoặc thứ tự onboarding khác rồi gọi là giống HiChat. Những hành vi chưa xác minh phải có trạng thái riêng trong ma trận đối chiếu.

---PAGE---
## 4 HiChat vận hành bot và widget

### Tạo kênh website

Wizard thực tế có bốn bước: chọn kênh, tạo hộp thư đến, thêm người dùng và hoàn tất. Form Website có tên, domain, màu widget, tiêu đề chào mừng, bật lời chào và dòng giới thiệu. Tài liệu mô tả chọn nhân viên và lấy JavaScript snippet để nhúng website. Đã hoàn tất wizard trên workspace sandbox mới, tới thông báo sẵn sàng và mã nhúng. Không sửa account sẵn có. [H4]

Kênh website hiện có có sáu mục: Cài đặt, Cộng tác viên, Giờ làm việc, Biểu mẫu trước khi trò chuyện, Trình tạo widget, Cấu hình. Builder cho chọn vị trí trái/phải, kiểu bong bóng, câu chào, màu và preview. Cài đặt còn có thu email, CSAT, file, emoji, tiếp tục hội thoại và công tắc chatbot. Việc có công tắc không phải bằng chứng AI đã phản hồi thành công.

### Bot và tri thức

| Nhóm | Bằng chứng HiChat | Ý nghĩa với GoTek |
|---|---|---|
| Tổng quan AI | Chế độ key do HiChat quản lý hoặc key riêng; chọn model, kiểm tra kết nối | Tách quyền platform cấp model và workspace chọn model |
| Hành vi | Tên bot, ngôn ngữ, thời gian chờ gom tin, độ trễ gửi, xưng hô, fallback | Giữ cấu hình dễ hiểu; thông số kỹ thuật đặt ở phần nâng cao |
| Quy tắc | Danh sách, tạo mới, import/export XLSX/CSV | Quy tắc kinh doanh có version, không được ghi đè policy bảo mật |
| Kiến thức | Kịch bản phản hồi, kho thông tin, mẫu hội thoại, thư viện ảnh | Phân biệt FAQ, sự kiện thực tế và ví dụ phong cách |
| Nguồn web | UI có URL, Sitemap, RSS; tài liệu hướng dẫn URL và site tĩnh | Core crawler có scope, trạng thái job, giới hạn và publish |
| Thu dữ liệu | Trường tùy chỉnh, bắt buộc, dừng khi đủ, nhãn, Sheets/Lark Bitable | Core lưu lead nội bộ trước; connector đồng bộ là module riêng |

Tài liệu kho thông tin nêu giới hạn 2.000 ký tự/mục, trạng thái hoạt động và phân loại; import qua XLSX/CSV. Tài liệu crawl có số trang, độ sâu, độ trễ, trạng thái tiến hành và yêu cầu reload khi nguồn đổi. Không nên sao chép giới hạn 2.000 ký tự thành giới hạn file GoTek. [H5][H6][H7]

Trang marketing nhắc PDF/DOCX/TXT, nhưng các màn và hướng dẫn vừa khảo sát chưa chứng minh pipeline upload các định dạng này hoạt động đầu cuối. GoTek cần đặc tả và kiểm thử riêng, thay vì suy ra từ một câu giới thiệu. Tương tự, danh sách kênh trên marketing rộng hơn các lựa chọn đang hiện trong wizard account khảo sát.

Tóm tắt hội thoại được tài liệu mô tả có bật/tắt và prompt riêng; vị trí trong UI hiện tại chưa được xác nhận đầy đủ. Đây là ví dụ cần ghi rõ khác biệt giữa tài liệu và phiên bản giao diện. [H8]

---PAGE---
## 5 HiChat inbox CRM và yêu cầu bám sát

### Inbox và vận hành

Inbox quan sát có Của tôi, Chưa được phân công, Tất cả; trạng thái Mở, tìm kiếm, bộ lọc và điều hướng theo kênh/nhãn. Tài liệu mô tả gán agent, team, label và priority cho từng hoặc nhiều cuộc hội thoại. Account khảo sát chưa có hội thoại thật để xác minh composer, receipt, takeover hoặc dữ liệu cập nhật realtime. [H9]

Quản lý nhân sự có các tab Nhân viên, Nhóm và Phân quyền. Form vai trò tùy chỉnh có quyền quản lý tất cả hội thoại; hội thoại chưa gán và được gán; hội thoại tham gia; liên hệ; báo cáo; cơ sở tri thức. Đây là quyền thao tác ứng dụng, không chứng minh ACL truy xuất từng tài liệu cho AI.

### CRM và báo cáo

Danh bạ có tìm kiếm, lọc, phân theo kênh và thêm liên hệ. Tài liệu có chỉnh sửa, gắn tag, gửi tin và hợp nhất liên hệ. Trang trống dùng hình danh sách mẫu làm nền; không nên đọc các dòng đó như dữ liệu khách hàng thật. [H10]

Menu báo cáo hiện có tổng quan, dữ liệu thu thập, kênh, hội thoại, CSAT, nhân viên, nhãn, nhóm, SLA, tóm tắt và báo cáo định kỳ. Đã xem báo cáo tổng quan ở trạng thái chưa có dữ liệu. Chưa xác minh công thức, quyền export hoặc độ trễ của số liệu.

Automation trong tài liệu gồm sự kiện, điều kiện, toán tử và hành động. Macro là chuỗi hành động do nhân viên kích hoạt, có thứ tự và phạm vi riêng/chung. Khi GoTek bổ sung cần lưu kết quả từng hành động, chống lặp và xử lý thất bại giữa chừng. [H11]

### Yêu cầu đối chiếu giao diện

Giữ cấu trúc HiChat: rail biểu tượng ở mép trái trên desktop, sidebar theo nhóm chức năng, tên account ở đầu sidebar; nội dung trắng trên nền sáng, màu tím cho mục chọn, form cài đặt chia nhóm và widget có preview cạnh bên. Ở viewport hẹp đã thấy thanh chức năng chuyển xuống đáy, sidebar thu gọn và wizard chỉ hiện bước hiện hành. Phải lấy các trạng thái này làm tham chiếu thay vì tự đặt một kiểu mobile khác.

Danh mục chính giữ Báo cáo, Cuộc hội thoại, Đơn hàng, Liên hệ, Trung tâm trợ giúp và Cài đặt. Cài đặt giữ các nhóm đã quan sát và cấu trúc tab bên trong. Không chuyển AI, Tri thức hay Widget thành menu cấp cao khác chỉ vì thuận tiện triển khai.

Các lỗi nhãn dịch, thông báo không rõ hoặc hành vi chưa chạy được được ghi riêng để xin quyết định, không tự thay bố cục. Nhận diện tên/logo của sản phẩm GoTek được thay theo dự án; những thay đổi khác ngoài tham chiếu phải được duyệt rõ.

Không có quyền Platform Admin của HiChat trong phiên khảo sát. Thiết kế quản trị nền tảng GoTek ở các mục sau là đề xuất dựa trên D2 và yêu cầu người dùng, không phải bản sao màn quản trị hệ thống HiChat đã xác minh.

---PAGE---
## 6 Đặc tả UI UX GoTek để duyệt

### Khung giao diện

Desktop đề nghị: rail 56–64 px; sidebar 208–240 px; danh sách hội thoại 300–360 px; vùng chat co giãn; hồ sơ khách 280–320 px có thể đóng. Đây là kích thước thiết kế khởi điểm, không phải số đo pixel chính xác của HiChat. Ở màn hình hẹp, đóng sidebar phụ và hồ sơ trước, giữ vùng chat đủ rộng.

Bám nền sáng, panel trắng bo góc và màu nhấn tím đã quan sát; không tự chuyển sang hệ màu hoặc design system khác. Bố cục ưu tiên thông tin vận hành; không đưa hiệu ứng trang marketing vào dashboard. Nhận diện và tài sản đồ họa dùng của GoTek, còn mẫu thao tác học từ HiChat.

### Danh sách màn hình

| Mã | Màn hình | Bố cục và hành động chính |
|---|---|---|
| A01 | Đăng ký và đăng nhập | Form gọn, nhãn rõ, lỗi tại trường, xác thực email và khôi phục |
| W01 | Workspace và onboarding | Tạo account từ form đăng ký, vào inbox; không thêm checklist thay luồng gốc |
| W02 | Tổng quan | Hội thoại mới, chờ người, lead mới, nguồn lỗi; bấm số để xem danh sách |
| W03 | Inbox | Bộ lọc; danh sách; chat; hồ sơ khách; nút tiếp nhận/trả AI luôn nhìn thấy |
| W04 | CRM | Danh sách contact/lead, trạng thái, người phụ trách, vùng/ngành, lịch sử |
| W05 | Tri thức | Nguồn, trạng thái xử lý, bản publish, lần cập nhật, lỗi và thử truy xuất |
| W06 | Bot | Tổng quan, quy tắc, nguồn gắn bot, thử bot, phiên bản đã publish |
| W07 | Website Widget | Form bên trái, preview phải; domain, nhận diện, consent, snippet, kiểm tra cài đặt |
| W08 | Thành viên và quyền | Danh sách, lời mời, vai trò, nhóm; cảnh báo khi thu hồi quyền |
| W09 | Usage và báo cáo | Lọc ngày/bot; định nghĩa chỉ số; quota và chi phí có trạng thái |
| P01 | Quản trị nền tảng | Doanh nghiệp/workspace, gói/quota, provider/model, job, lỗi, audit |

### Chi tiết inbox

Header hiển thị khách, kênh, trạng thái, người phụ trách và chủ thể trả lời hiện tại. Composer phân biệt “Trả lời khách” với “Ghi chú nội bộ” bằng nhãn và kiểu nền. Panel phải chứa thông tin đã xác nhận, lead stage, tag, consent và tóm tắt AI có nhãn “Gợi ý”. Không tự đổi lead thành thành công chỉ vì AI dự đoán.

“Tiếp nhận” đổi quyền trả lời ở backend, rồi mới xác nhận trên UI. “Trả lại AI” cần hiển thị rõ hậu quả; không tự bật lại khi nhân viên chỉ đổi người phụ trách. Tin lỗi có retry; tin chưa xác định kết quả ghi trạng thái chờ đối soát.

### Widget và trạng thái bắt buộc

Widget có launcher, câu chào, nhận diện AI, quick question, chat, nguồn, yêu cầu người thật và thông báo ngoài giờ. Nguồn mở bằng thao tác bấm của khách; không tự bật popup. Phải thiết kế đủ loading, rỗng, offline, timeout, hết quota, nguồn chưa sẵn sàng, file không hợp lệ và phiên hết hạn. Hỗ trợ bàn phím, focus quay về launcher, độ tương phản và safe area mobile.

---PAGE---
## 7 Phân kỳ toàn bộ phạm vi và ma trận quyền

Core v1 làm trước vòng website và AI. Các module còn lại vẫn thuộc mục tiêu bám sát HiChat; bảng phân kỳ không cho phép loại bỏ tính năng. Chưa có implementation sản phẩm trong thư mục này.

| Module | Phải có trước pilot core | Để sau core |
|---|---|---|
| Identity và workspace | Xác thực, session, membership, lời mời, chuyển workspace, audit | SSO doanh nghiệp nâng cao |
| Bot và AI | Bot version, policy, model được cấp, fallback, kill switch | Routing tối ưu nhiều provider tự động |
| Tri thức | FAQ, nội dung nhập, file PDF/DOCX/TXT, URL tĩnh, job, duyệt/publish, rollback | OCR phức tạp, crawl JS, đồng bộ Lark ACL |
| Inbox | Nhận/gửi, unread, assignment, ghi chú, takeover, resume, đóng/mở lại | Automation builder, macro phức tạp |
| CRM tối thiểu | Contact, lead, người phụ trách, stage, tag, vùng/ngành, lịch sử | Deal/revenue forecasting, AI scoring sâu |
| Widget | Domain, cấu hình, snippet, session, retry, sources, xin người thật | Đồng bộ đa thiết bị và nhiều kênh |
| Quản trị | Workspace lifecycle, model grant, quota, usage, job, lỗi | Billing tự phục vụ, reseller/agency |
| Vận hành | Backup/restore, quan sát lỗi, retention, export/delete theo quyền | Help Center đầy đủ, campaign outbound |

### Quyền được đề nghị

| Thao tác | Platform Admin | Workspace Admin | Agent |
|---|---|---|---|
| Quản lý workspace/gói/model | Toàn nền tảng theo nhiệm vụ | Xem/chọn trong phạm vi được cấp | Không |
| Xem nội dung hội thoại | Không mặc định; hỗ trợ có grant | Trong workspace | Được gán/tham gia; hàng chờ theo policy |
| Gửi tin và takeover | Chỉ khi có quyền hỗ trợ vận hành rõ | Trong workspace | Hội thoại được cấp |
| Quản lý nguồn và publish | Không mặc định xem nội dung | Có | Không mặc định |
| Xem/chỉnh lead | CRM doanh nghiệp mua SaaS riêng | CRM khách của workspace | Lead được phân công |
| Thành viên và quyền | Quản lý operator; hỗ trợ giới hạn | Thành viên workspace | Không |
| Secret provider | Tham chiếu secret, thay/thu hồi có audit | Không xem key platform | Không |
| Báo cáo | Metadata vận hành toàn nền tảng | Số liệu workspace | Số liệu cá nhân/phạm vi được cấp |

Owner là quyền quản trị workspace kèm chuyển sở hữu và các hành động vòng đời đặc biệt. Giai đoạn đầu có thể dùng Owner/Admin/Agent; mở rộng Manager, Analyst, Editor và Billing sau bằng permission độc lập. Sale chính thức, thử việc và thực tập cùng vai trò Agent theo D1; không tạo cấp quyền vì tình trạng hợp đồng lao động.

Widget public không có quyền đọc database trực tiếp. ACL thao tác dashboard và ACL nội dung AI là hai lớp khác nhau. Người được quản lý nguồn chưa chắc được đưa mọi nguồn lên bot công khai; publish phải xác nhận audience.

---PAGE---
## 8 Kiến trúc lõi và dữ liệu

### Cấu trúc hệ thống đề nghị

Dashboard và widget gọi API backend. Backend xử lý identity, quyền, workspace, conversation, CRM, cấu hình và usage. Bộ điều phối AI dùng retrieval và model gateway; worker xử lý ingest, crawl, thông báo và tổng hợp. Database quan hệ giữ dữ liệu nghiệp vụ; object storage giữ file; chỉ mục vector giữ đoạn tri thức; queue giữ công việc nền. Realtime chỉ truyền sự kiện đã được kiểm quyền.

Có thể lựa chọn TypeScript cho frontend/backend, PostgreSQL và chỉ mục vector tương thích, object storage S3-compatible cùng queue. Đây là phương án khởi điểm để giảm số công nghệ; chỉ chốt framework/version sau khi xem repository hiện hữu, năng lực đội và hạ tầng. Không suy đoán stack nội bộ của HiChat từ giao diện.

### Các thực thể cốt lõi

| Nhóm | Thực thể chính | Ràng buộc quan trọng |
|---|---|---|
| Tài khoản | User, Workspace, Membership, Invite, Role | Membership theo workspace; Owner cuối cùng được bảo vệ |
| Bot và kênh | Bot, BotVersion, Channel, WidgetConfig, Domain | Public bot ID không phải credential bí mật |
| Tri thức | Source, DocumentVersion, Chunk, IngestionJob, BotSource | Source/version/audience/workspace luôn đi cùng retrieval |
| Hội thoại | VisitorSession, Conversation, Message, Assignment, Note | Message có client ID, thứ tự và loại công khai/nội bộ |
| CRM | Contact, VerifiedIdentity, Lead, LeadStage, Consent | Không gộp khách chỉ vì trùng tên hoặc IP |
| AI | Provider, Model, ModelGrant, Policy, AIRun | Key ở secret store; lưu model và phiên bản policy |
| Vận hành | UsageLedger, AuditEvent, Outbox, SupportGrant | Audit có actor; grant có scope và thời hạn |

Workspace ID lấy từ session/membership đã xác thực, không tin một trường client gửi lên. Mọi truy vấn, cache, file path, vector search, job và subscription realtime đều kiểm phạm vi. Thêm khóa ngoại ghép hoặc ràng buộc tương đương để không gắn contact workspace A vào conversation workspace B. Database isolation là lớp phòng vệ bổ sung, không thay thế kiểm quyền ở ứng dụng.

### Tin nhắn và tác vụ nền

Mỗi lần gửi có idempotency key; server xác nhận lưu tin một lần rồi mới phát sự kiện. Client reconnect dùng cursor để lấy phần bỏ lỡ, không dựa hoàn toàn vào WebSocket. Retry hữu hạn, tăng khoảng chờ và có dead-letter để xử lý job lỗi. Event và thao tác ghi cần outbox hoặc cơ chế tương đương tránh database ghi thành công nhưng thông báo bị mất.

Usage phải phân biệt estimate, confirmed và unknown. Nếu provider timeout sau khi nhận request, không coi là chắc chắn chưa tốn phí. Hạn mức đồng thời phải được giữ chỗ/đối soát để hai request không cùng vượt quota. Báo cáo tính từ event/ledger có định nghĩa, không đếm trực tiếp các ô đang hiển thị trên UI.

Các nhóm API cần đặc tả trước coding: auth; workspaces/members; bots/versions; knowledge/jobs/publish; conversations/messages/assignment/takeover; contacts/leads; widget bootstrap/session; reports/usage; platform providers/grants/audit.

---PAGE---
## 9 AI tri thức và chuyển giao người thật

### Pipeline tri thức

Nguồn đi qua DRAFT → QUEUED → PROCESSING → READY → PUBLISHED. FAILED là lỗi xử lý; ARCHIVED là ngừng sử dụng. Bản đang phục vụ vẫn tồn tại khi bản mới lỗi. Publish đổi con trỏ phiên bản nguyên tử, ghi audit và vô hiệu cache liên quan; rollback chọn lại bản tốt đã biết.

Parser kiểm loại file, kích thước, nội dung rỗng và file chứa mã nguy hiểm. Crawler giới hạn host, số trang, độ sâu, thời gian và dung lượng; chặn mạng riêng, loopback, metadata endpoint, redirect nguy hiểm và DNS rebinding. URL trả nội dung cần JavaScript phải báo chưa hỗ trợ ở core, không ghi thành công với tài liệu trắng.

Tài liệu và trang web là dữ liệu không đáng tin để ra lệnh. Chỉ dẫn trong tài liệu không được thay policy, tiết lộ secret, mở quyền hoặc kích hoạt công cụ ghi dữ liệu. Mẫu hội thoại chỉ định phong cách; không trở thành nguồn giá và chính sách nếu chưa được duyệt thành tri thức.

### Một lượt trả lời

Xác định workspace/bot/session → kiểm quota và chủ thể trả lời → truy xuất chỉ nguồn đã publish đúng audience → chọn bằng chứng → gọi model với policy → kiểm nguồn/citation và nội dung trả về → kiểm lại quyền trả lời → lưu và gửi. Khi thiếu căn cứ, nói rõ giới hạn và cho chọn gặp nhân viên; không bịa giá, tồn kho, cam kết giao hàng.

Mỗi citation gắn source ID và version. Widget chỉ nhận nguồn public hoặc đường dẫn đã được cấp quyền. Khách chọn “Xem nguồn” để mở tài liệu; không trả signed URL nội bộ cho khách ẩn danh. Khi thu hồi nguồn, lượt truy xuất mới và cache phải ngừng dùng nguồn đó.

### Quyền trả lời theo hội thoại

| Trạng thái | AI có được tự gửi không | Chuyển trạng thái |
|---|---|---|
| AI_ACTIVE | Có, nếu đủ policy và căn cứ | Khách xin người/agent tiếp nhận → HANDOFF_PENDING hoặc HUMAN_ACTIVE |
| HANDOFF_PENDING | Không tự tư vấn tiếp; chỉ thông báo hệ thống đã định nghĩa | Agent nhận → HUMAN_ACTIVE; ngoài giờ → chờ hoặc ticket |
| HUMAN_ACTIVE | Không | Agent chủ động trả AI → AI_ACTIVE; xử lý xong → RESOLVED |
| RESOLVED | Không tự bật lại chỉ vì có tin mới | Reopen theo policy; giữ owner rõ ràng |

Cần version hoặc fencing token cho quyền trả lời. Takeover tăng version và hủy lượt AI đang chạy nếu có thể; ngay trước gửi phải kiểm tra lại version. Nếu output AI đã sinh nhưng nhân viên vừa nhận, output cũ không được gửi. Hai agent cùng nhận phải có một kết quả thắng rõ ràng. Không giữ transaction database mở trong suốt thời gian gọi model.

Khi khách cần hỗ trợ, tạo handoff và lưu bối cảnh hiện có. Nếu không ai trực, thông báo thời gian dự kiến và tùy chọn để lại liên hệ theo chính sách. Ticket lỗi hoặc notification lỗi phải hiển thị riêng; không báo “nhân viên đã nhận” khi hệ thống mới đưa yêu cầu vào hàng chờ.

---PAGE---
## 10 Widget CRM và vận hành an toàn

### Widget nhúng website

Snippet chỉ chứa định danh công khai và URL tải widget. Có thể dùng iframe cách ly CSS và giao tiếp postMessage kiểm origin; chỉ cấp session ngắn hạn qua backend. Origin allowlist giảm nhúng sai domain nhưng không phải chứng thực người dùng và không ngăn được mọi client giả header; vẫn cần rate limit, giới hạn session và chống abuse.

Widget phải giữ phiên đúng website/bot, xử lý browser chặn storage, reload, mất mạng và gửi lại. Không đặt API key model, quyền admin hay nội dung tri thức toàn bộ trong bundle. File đính kèm nếu bật phải kiểm MIME thực, dung lượng, mã độc và quyền tải; có thể hoãn attachment public cho pilot đầu nếu chưa đủ kiểm soát.

### CRM tối thiểu hoạt động thế nào

Khách ẩn danh tạo visitor session. Khi cung cấp thông tin và mục đích phù hợp, hệ thống tạo hoặc liên kết contact; xác minh identity trước khi tự hợp nhất. Lead có nguồn website/bot/conversation, nhu cầu, stage, vùng/ngành, owner, lần cập nhật, việc tiếp theo và lý do mất cơ hội. Tên trường hiển thị có thể đổi theo workspace, nhưng trường hệ thống giữ nghĩa nhất quán.

Pipeline đề nghị: Mới → Đang tư vấn → Đủ điều kiện → Thành công hoặc Không phù hợp/Mất. “Thành công” do nhân viên hoặc connector nguồn xác nhận; đơn mô phỏng không được ghi doanh thu thật. AI có thể đề xuất stage và tóm tắt, kèm căn cứ và nút xác nhận.

### Định nghĩa báo cáo

| Chỉ số | Định nghĩa đề nghị |
|---|---|
| Hội thoại mới | Conversation tạo trong khoảng ngày theo múi giờ workspace |
| Chờ nhân viên | Handoff chưa được tiếp nhận tại thời điểm đo |
| Thời gian phản hồi đầu của người | Từ yêu cầu chuyển người đến tin công khai đầu tiên của agent; quy tắc giờ làm việc riêng |
| Lead mới | Lead được tạo hợp lệ; không đếm lại khi retry/sync |
| Tỷ lệ chuyển đổi | Lead thành công chia cohort lead đủ điều kiện được định nghĩa; không trộn tháng |
| Chi phí AI | Ledger confirmed, hiển thị estimate/unknown riêng; không coi là hóa đơn provider |

### Quyền riêng tư và vận hành

Platform chỉ xem metadata mặc định. Khi hỗ trợ cần đọc nội dung, dùng SupportGrant giới hạn workspace, phạm vi, thời hạn và lý do; ghi access log. Lịch sử hội thoại phục vụ vận hành có retention riêng; bản ghi debug prompt/completion không tự bật và không chứa raw key.

Chuẩn bị retention, export/delete, vùng lưu, DPA/provider và nội dung thông báo AI trước pilot. Các diễn giải pháp lý trong D1 cần rà lại theo toàn văn và hướng dẫn hiện hành; nguồn nhà nước xác nhận có hai luật được dẫn, nhưng báo cáo này không kết luận toàn bộ nghĩa vụ của từng mô hình triển khai. [L1][L2]

Backup phải gồm database, uploads, schema, config và tham chiếu secret; diễn tập restore ở môi trường cô lập, tắt gửi webhook/email khi phục hồi. Có kill switch theo bot/workspace/provider và hướng rollback cấu hình, nguồn và release.

---PAGE---
## 11 Kế hoạch triển khai và nghiệm thu

### Thứ tự triển khai sau khi duyệt báo cáo

| Đợt | Kết quả giao | Điều kiện chuyển tiếp |
|---|---|---|
| 0 | Audit repo hiện hữu, phạm vi, wireframe, model dữ liệu, hợp đồng API | Biết phần tái sử dụng và phần thay; chốt acceptance |
| 1 | Auth, workspace, quyền, shell hai console, audit | Test chéo tenant và vòng đời membership đạt |
| 2 | Conversation, widget, agent inbox và handover | Khách/agent nhận đúng tin; retry và tranh chấp không tạo trùng |
| 3 | Ingestion, publish, retrieval, provider thật, citation | File → worker → publish → widget chạy trên môi trường triển khai |
| 4 | CRM tối thiểu, báo cáo, quota, monitoring | Lead và chỉ số truy ngược được về event |
| 5 | Browser/device UAT, bảo mật, restore, pilot | Chủ sản phẩm ký Go hoặc No Go trên bằng chứng |

Ước lượng lập kế hoạch ban đầu: 8–12 tuần với khoảng 3 kỹ sư, QA tham gia thường xuyên và thiết kế/sản phẩm bán thời gian; đã gồm thời gian ổn định và pilot nhỏ, chưa gồm đa kênh đầy đủ, thanh toán hay Lark ACL. Đây là giả định để phân bổ nguồn lực, không phải cam kết deadline. Audit repo có thể làm thay đổi đáng kể ước lượng. Demo đầu tháng 10 nên giới hạn một workspace, một bot, một website và bộ dữ liệu mẫu đã duyệt.

### Các kịch bản nghiệm thu bắt buộc

| Mã | Tình huống | Kết quả phải quan sát được |
|---|---|---|
| T01 | Đăng ký, xác thực, hết hạn token, login/logout | Trạng thái rõ; session cũ bị thu hồi theo policy |
| T02 | Đổi ID sang workspace khác ở API, file, vector, realtime | Không có dữ liệu chéo quyền; có log phù hợp |
| T03 | Nạp file lỗi và publish bản mới | Bản tốt vẫn phục vụ; draft không ra widget |
| T04 | Hỏi có/không có đáp án và prompt injection | Có nguồn hợp lệ hoặc fallback; không lộ nội dung cấm |
| T05 | Takeover đúng lúc AI đang sinh câu trả lời | AI không gửi sau takeover; chỉ một chủ thể gửi |
| T06 | Hai agent nhận, reconnect, gửi lại cùng client ID | Một assignment hợp lệ; tin không nhân đôi |
| T07 | Ghi chú nội bộ, link nguồn private, session khách khác | Widget không xem được |
| T08 | Hết quota, timeout provider, key bị thu hồi | Lỗi thân thiện; usage unknown được giữ để đối soát |
| T09 | Thu lead, từ chối marketing, đổi owner, lọc báo cáo | Consent tách mục đích; lead đúng phạm vi và không đếm trùng |
| T10 | Nhúng trên site thật và mobile/bàn phím | Không che CTA chính; focus, retry và lịch sử dùng được |
| T11 | Restore database/file/index | Số lượng và ACL đúng; không gửi lại side effect cũ |
| T12 | Support grant hết hạn và bot kill switch | Quyền bị thu hồi, AI ngừng đúng phạm vi |

Mục tiêu đo thử đề nghị: 100 câu hỏi có nhãn, trong đó có câu không có đáp án và tấn công; ít nhất 90% câu thuộc phạm vi có câu trả lời đúng căn cứ, 100% case cách ly dữ liệu không rò rỉ, không trả lời chồng trong toàn bộ test tranh chấp. Chốt thêm tải đồng thời, p95 thời gian phản hồi, chi phí tối đa, RPO/RTO và thời gian trực trước pilot. Đây là ngưỡng đề xuất cần duyệt và đo, không phải kết quả đã đạt.

---PAGE---
## 12 Quyết định cần duyệt và hồ sơ nguồn

### Gói quyết định trước khi viết code

Đề nghị duyệt core website gồm multi-tenant từ đầu, hai console theo quyền, inbox/CRM tối thiểu, kho tri thức có publish, AI có nguồn, handover hai chiều và widget. Các module HiChat ngoài core được triển khai tiếp theo ma trận đối chiếu đầy đủ. Phần riêng trong hai file GoTek được bổ sung sau nền HiChat, không thay đổi nền UI/UX đã yêu cầu.

Chủ sản phẩm cần chốt: repository dùng làm nền; một website và ngành pilot; provider và ngân sách; vùng xử lý và retention; người duyệt tri thức; người trực handoff; mức độ ưu tiên bám bố cục HiChat so với nhận diện GoTek. Đội kỹ thuật cần giao wireframe và acceptance theo màn trước khi bắt đầu xây. Không dùng việc duyệt báo cáo này làm bằng chứng sản phẩm đã nghiệm thu.

### Nguồn nội bộ

[D1] GoTek - Product Brief Saas “AI Sales Chatbot + Dashboard” (2).docx, bản mở rộng ngày 24 09 2026. Đã đọc toàn bộ nội dung và bảng.

[D2] GoTek ChatBOT - Bao Cáo & Mô Tả Dự Án (1).docx. Đã đọc toàn bộ; các số kiểm thử và trạng thái implementation là thông tin nguồn cung cấp.

### Tài liệu HiChat đã đọc

[H1] Đăng ký: https://hichat.asia/docs/1-cai-dat-tai-khoan%2F11-dang-ky

[H2] Đăng nhập: https://hichat.asia/docs/1-cai-dat-tai-khoan%2F12-dang-nhap

[H3] Cài đặt doanh nghiệp: https://hichat.asia/docs/1-cai-dat-tai-khoan%2F14-cai-dat-tai-khoan-doanh-nghiep

[H4] Tạo kênh website: https://hichat.asia/docs/2-kt-noi-kenh%2F24-website%2Fwebsite-tao-kenh-chat

[H5] Khởi tạo chatbot: https://hichat.asia/docs/khoi-tao-chatbot

[H6] Kho thông tin: https://hichat.asia/docs/32-them-du-lieu-huan-luyen%2Fdata-items

[H7] Nguồn web: https://hichat.asia/docs/32-them-du-lieu-huan-luyen%2Fweb-source

[H8] Tóm tắt: https://hichat.asia/docs/34tom-tat-cuoc-hoi-thoai

[H9] Quản lý hội thoại và bài gán agent/team/label: https://hichat.asia/docs/4-quan-ly-cuoc-hoi-thoai

[H10] Quản lý liên hệ: https://hichat.asia/docs/5-quan-ly-lien-lac

[H11] Automation và Macros: https://hichat.asia/docs/6-tinh-nang-nang-cao%2F64-automation-va-macros

[H12] Thu thập dữ liệu: https://hichat.asia/docs/33-data-collection%2Fthu-thap-du-lieu

### Nguồn kiểm chứng bên ngoài

[X1] Glean Citations: https://docs.glean.com/user-guide/assistant/glean-chat/glean-chat-citations/glean-citations

[X2] Intercom Deploy Fin over chat: https://www.intercom.com/help/en/articles/8286630-deploy-fin-ai-agent-over-chat

[X3] Intercom Human in the loop approvals: https://www.intercom.com/help/en/articles/14468561-human-in-the-loop-approvals-for-fin-procedures

[L1] Chính phủ về Luật Trí tuệ nhân tạo: https://xaydungchinhsach.chinhphu.vn/nhung-noi-dung-dang-chu-y-cua-luat-tri-tue-nhan-tao-119260212091614393.htm

[L2] Công báo Luật Bảo vệ dữ liệu cá nhân: https://congbao.chinhphu.vn/tai-ve-van-ban-so-91-2025-qh15-45578-57730?format=pdf

Khảo sát trực tiếp gồm form đăng ký/đăng nhập/khôi phục, dashboard, settings doanh nghiệp, AI, nhân sự/quyền, kênh website và builder, contacts, reports. Đã tạo tài khoản, account 214 và kênh website 269 đến snippet; email chưa xác thực. Chưa gửi tin thử qua website nhúng, chưa chạy provider hoặc kết nối kênh xã hội thật, chưa xem Platform Admin HiChat. Các giới hạn này phải được giữ khi chuyển báo cáo thành đặc tả triển khai.


## 13. Bảng đối chiếu phạm vi HiChat để triển khai

Bảng này là danh mục kiểm soát phạm vi, không phải tuyên bố đã kiểm thử toàn bộ HiChat. Giữ luồng, bố cục, vị trí menu, tab và trạng thái đã quan sát. Các phần chưa xác minh phải tiếp tục khảo sát trước khi chốt đặc tả chi tiết, không tự thiết kế khác rồi gọi là giống HiChat. Platform Admin là phần GoTek yêu cầu từ tài liệu D2; chưa có bằng chứng giao diện quản trị nội bộ của HiChat.

Ngày 24 09 2026. Mục tiêu: bám chức năng, vị trí, luồng và trạng thái UI UX. Không đổi cấu trúc để dễ triển khai. O = trực tiếp quan sát; T = đã thực hiện; D = tài liệu; P = cần khảo sát sâu. Tất cả vẫn thuộc scope; Core chỉ là thứ tự triển khai.

| Nhóm | Phạm vi đã biết | Bằng chứng | Việc tiếp theo |
|---|---|---|---|
| Đăng ký | Tên, công ty, email, điện thoại, referral, password; tự tạo account, vào inbox | T account 214 | Xác thực email, lỗi trùng/token |
| Login/reset | Email/password, remember, reset email | O/D | Login lại do người dùng nhập credential |
| Workspace | Account name, language, SID | O/T | Nhiều account/chuyển account chưa chứng minh |
| Inbox | Mine/unassigned/all, open, search, filters, channel, labels | O/D | Hội thoại có dữ liệu, composer, takeover, receipt |
| Website | Wizard 4 bước, name/domain/color/greeting, agents, snippet | T inbox 269 | Nhúng và tin gửi nhận thật |
| Cài đặt website | Settings, collaborators, hours, prechat, builder, config | O | Đọc hết form mở rộng và preview |
| Hours | Enable business availability; mặc định tắt ở sandbox | O | Form sau bật thử chưa lưu |
| Prechat | Mặc định Không, lựa chọn Có | O | Trường sau bật thử chưa lưu |
| AI overview | Managed key/BYOK, model, test, quota, hành vi/fallback | O/D | Provider thật chưa chạy |
| AI rules | Create, list, import/export | O/D | Form validation và save mẫu |
| AI knowledge | FAQ, kho thông tin, hội thoại mẫu, ảnh | O/D | Tạo dữ liệu mẫu và thử retrieval |
| Web source | URL/Sitemap/RSS, crawl states | O/D | Chạy nguồn mẫu, đối soát kết quả |
| Data collection | Field types/required, stop bot, label, Sheets/Lark | O/D | Save mẫu, đồng bộ chưa thử |
| Contacts | Search/filter, create, edit/tag/merge/send | O/D | Form và identity, không gửi outbound |
| Orders | Trang và nút Đơn hàng mới đều báo Sắp ra mắt | O/T | Không coi là nghiệp vụ đơn hàng đã chạy |
| Help Center | Empty state có dữ liệu minh họa; Create Portal mở form Name/Slug, URL /hc/ | O | Chưa tạo portal hoặc publish bài |
| People | Agents, teams, custom roles | O | Quyền bản ghi bằng nhiều tài khoản |
| Labels/attributes | Có menu | O/P | Form chi tiết |
| Automation/macros | Event/condition/action; ordered macro | O/D | Form thật và dry-run |
| Canned replies | List/create | O/D | Form chi tiết |
| Integrations | Có menu | O/P | Danh mục và cấu hình từng connector |
| Audit/security | Có menu | O/P | Xem khả dụng theo plan, không đổi bảo mật |
| Billing/usage/upgrade | Có menu | O/P | Read-only gói và meter, không mua |
| Reports | Overview/data/inbox/conversation/CSAT/agent/label/team/SLA/summary/scheduled | O | Mở từng màn, định nghĩa/form, chưa có data |
| Mobile | Bottom navigation, collapsed sidebar, current wizard step, dropdown settings tabs | O | Chi tiết chat và keyboard |
| Platform Admin | Không có quyền HiChat platform | P | Thiết kế từ D2, ghi rõ không phải UI HiChat đã xác minh |

## Kết quả đã ghi nhận
Account 214 GoTek Sandbox Research; inbox 269 GoTek Website Sandbox, domain mẫu example.com; chính user sandbox là agent. Wizard hoàn tất hiển thị mã JS SDK và nút Nhiều tuỳ chọn hơn/Đưa cho tôi. Đã readback đúng tên, domain và lời chào trong settings. Email chưa xác thực; chatbot đang tắt. Không lưu credential, cookie, token phiên hoặc key provider.

## Nguyên tắc nghiệm thu fidelity
Mỗi module cần route tương ứng, screenshot cùng viewport, nhãn/thứ tự/tab/form/modal, trạng thái empty/loading/error/success, hành vi save/reload và permissions. Menu tồn tại không chứng minh chức năng hoàn tất. Từng dòng chỉ đạt khi có bằng chứng tương ứng, không dùng test backend thay bằng chứng UI.
