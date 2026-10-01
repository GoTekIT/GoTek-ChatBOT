# Figma design baseline — GoTek Chatbot

**Nguồn thiết kế:** [GoTek Figma file](https://www.figma.com/design/qss4Z6OD3pG5YXPOS5cKVO/Untitled?node-id=0-1)  
**Người sử dụng baseline:** Nguyên — UI, browser integration và demo  
**Ngày đọc thiết kế:** 2026-09-29  
**Trạng thái:** DESIGN REFERENCE — chưa phải acceptance evidence

## 1. Phạm vi đã quan sát

File hiện có một page `Page 1` với các frame/layer chính:

- `Customer chat widget`: trang sản phẩm e-commerce có widget hỗ trợ khách hàng.
- `Chat window`: panel chat nổi, kích thước thiết kế quan sát được là `404 x 666`.
- `Inbox dashboard`: màn hình xử lý hội thoại nội bộ, frame `1440 x 960`.
- `Knowledge Base dashboard`: quản lý tài liệu, trạng thái publish/draft/internal và import data.
- `Team dashboard`: Staff & Roles, modal mời thành viên và phân quyền.
- `AI Usage dashboard`: AI Quota & Usage, quota cards, biểu đồ token và usage log.

Tên frame/layer trong Figma là reference trực tiếp khi đối chiếu UI. Nếu source hiện tại dùng tên route hoặc screen khác, cần map trong evidence thay vì đổi tên tùy tiện.

## 2. Ngôn ngữ giao diện cần giữ

### Bố cục quản trị

- Sidebar trái nền navy đậm, logo GoTek AI, navigation theo nhóm Inbox, Knowledge Base, Team, AI Usage, Settings.
- Top bar có workspace selector, notification, user avatar/name và action chính ở phía phải.
- Main content nền sáng, nhiều khoảng trắng, card trắng có border nhẹ và bo góc.
- Tiêu đề màn hình lớn, kèm mô tả ngắn giải thích mục đích màn hình.
- Action chính dùng nút xanh dương; action phụ là nút trắng/border hoặc text action.

### Mẫu component lặp lại

- Summary cards ở đầu màn hình để hiển thị tổng số, tỷ lệ hoặc trạng thái.
- Search/filter bar trước bảng dữ liệu.
- Table/list có trạng thái bằng badge màu và action ở cuối dòng.
- Drawer bên phải cho import data hoặc context phụ.
- Modal trung tâm cho thao tác có xác nhận hoặc form nhiều bước.
- Toast/inline alert cho warning, error và trạng thái xử lý.
- Chat message phân biệt rõ visitor, AI và staff; public reply tách với internal note.

### Màu và trạng thái

- Navy: navigation/sidebar và header của chat widget.
- Blue: primary action, selected navigation, customer/visitor message và progress.
- Green: success, completed, published/active và staff reply.
- Yellow/amber: warning, pending, draft hoặc cần chú ý.
- Red: error, failed, delete hoặc nguồn dữ liệu lỗi.
- Gray: secondary text, divider, disabled và metadata.

Các màu trên là phân loại theo quan sát trực quan. Hex value, typography token, shadow, border và spacing chính xác phải được lấy bằng Figma Inspect/Dev Mode trước khi chốt implementation; không tự suy diễn thành token production.

## 3. Chi tiết từng màn hình

### Customer chat widget

- Bối cảnh là trang sản phẩm `Rowan Lounge Chair`, hình sản phẩm lớn bên trái và thông tin sản phẩm bên phải.
- Widget hỗ trợ nằm ở cạnh phải, không che toàn bộ nội dung sản phẩm.
- Header widget có icon thương hiệu, tên `North & Pine Support`, trạng thái online và nút đóng/more.
- Tin nhắn visitor dùng bubble xanh; AI dùng bubble sáng có nhãn `GoTek AI` và citation card dẫn về tài liệu.
- Staff reply dùng bubble xanh nhạt/xanh lá và hiển thị trạng thái staff đã tham gia.
- Composer ở đáy có attachment, placeholder và nút gửi màu xanh.
- Cần giữ khả năng đọc nội dung nền phía sau, không để panel chat phá vỡ hierarchy của trang sản phẩm.

### Inbox dashboard

- Bố cục ba vùng: danh sách conversation bên trái, thread ở giữa, customer/context panel bên phải.
- Header thread có trạng thái conversation và action `Assign`/`Takeover`.
- Thread thể hiện rõ timeline, người gửi, timestamp, AI citation, staff reply và internal note.
- Composer có tab `Public Reply` và `Internal Note`; đây là ranh giới security/visibility cần test riêng.
- Context panel hiển thị thông tin contact, conversation details và giá trị liên quan.

### Knowledge Base dashboard

- Header `Knowledge Base` và action `Import Data`.
- Summary cards cho tổng tài liệu, published publicly, internal only và cần attention.
- Bảng có title, source type, status/lifecycle, last updated và row actions.
- Import drawer hỗ trợ drop file/browser, URL và visibility; có warning/validation ngay trong drawer.
- Trạng thái nhìn thấy trong mẫu: `Published Public`, `Internal`, `Ready`, `Draft`, cùng trạng thái lỗi/cần xử lý.

### Team dashboard

- Header `Staff & Roles`, summary về tổng thành viên/role/guest hoặc trạng thái.
- Bảng thành viên có name, email, status, role và actions.
- Modal `Invite a team member` gồm email, role selection và hai action `Cancel`/`Send invite`.
- Role options quan sát được gồm `Workspace Owner`, `Workspace Admin`, `Agent`; role copy cần map với permission contract backend.
- Không được dùng mock role label để suy ra quyền thật nếu chưa đối chiếu backend authorization.

### AI Usage dashboard

- Header `AI Quota & Usage`, date-range selector và `Export`.
- Summary cards phân tách total quota, soft/hard usage, revenue hoặc reserved quota.
- Biểu đồ cột hiển thị token usage theo khoảng thời gian.
- Usage log có model name, provider, job, job status, token used và time.
- Màu trạng thái job: completed xanh, processing xanh dương, warning/error theo rule vận hành.
- Các số liệu trong Figma chỉ là design fixture; không được dùng làm production truth.

## 4. Mapping với source hiện tại

| Figma reference | Source hiện tại cần đối chiếu | Acceptance chính |
|---|---|---|
| Customer chat widget / Chat window | `frontend/src/screens/channels/`, `frontend/src/screens/inbox/`, `backend/src/modules/widget/` | Widget public, session/origin, public content và citation |
| Inbox dashboard | `frontend/src/screens/inbox/`, `backend/src/modules/chat/` | Assign/takeover, public reply, internal note, polling/error state |
| Knowledge Base | `frontend/src/screens/knowledge/`, `backend/src/modules/knowledge/` | Import, lifecycle, visibility, retrieval preview |
| Team dashboard | `frontend/src/screens/settings/Members.tsx`, auth/member/workspace routes | Tenant fence, role separation, invite/member state |
| AI Usage dashboard | `frontend/src/screens/settings/Usage.tsx`, `frontend/src/modules/ai/` | Quota, usage ledger, job state và unknown outcome |

Nếu file source thực tế khác tên, ưu tiên source map trong repo và cập nhật mapping này; không tạo thêm route chỉ để khớp tên frame.

## 5. Quy tắc triển khai UI cho Nguyên

1. Chốt layout desktop theo frame `1440` trước, sau đó kiểm tra responsive.
2. Giữ sidebar/header/content hierarchy và trạng thái selected như thiết kế.
3. Dùng dữ liệu thật từ API contract; fixture chỉ dùng cho visual test/evidence.
4. Mọi trạng thái phải có loading, empty, error, permission denied và success khi phù hợp.
5. Public reply và internal note phải nhìn khác nhau và không được rò rỉ sang visitor.
6. Role trong Team dashboard phải tuân theo permission backend, không chỉ theo label Figma.
7. Chat widget phải kiểm tra origin/session, mobile width, keyboard focus và z-index trên trang host.
8. Không đánh dấu `DONE` chỉ vì giao diện giống ảnh; cần browser evidence và đối chiếu acceptance.

## 6. Evidence cần bổ sung trước sign-off

- Screenshot/browser recording cho mỗi màn hình ở desktop và ít nhất một kích thước responsive.
- Inbox: public reply, internal note, takeover và tenant/workspace switch.
- Knowledge: import/validation, draft → publish, internal/public visibility và retrieval preview.
- Team: invite với các role, permission denied và member status.
- AI Usage: quota warning, usage log, processing/failed job và empty state.
- Widget: embed trên trang host, origin/session, chat open/close, citation và staff handoff.

## 7. Chưa được kết luận từ Figma

- Exact color hex, font family/weight, spacing token, shadow và breakpoint: `NEEDS VERIFICATION`.
- Figma prototype interaction và route transition: `NEEDS VERIFICATION`.
- Các con số, tên workspace, tên khách hàng, provider/model trong frame: design fixture, không phải production contract.
- HiChat parity: chưa được xác nhận chỉ bằng file Figma; cần evidence theo từng flow.
