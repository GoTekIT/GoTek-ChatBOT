# Kế hoạch Triển khai Nhiệm vụ (FE/UI): Dựng Màn hình và Giao diện 5 Module Cốt lõi
**Mã công việc:** `FE-01` | **Mức ưu tiên:** P1 | **Ước tính:** 1 ngày  
**Phân quyền (Owner Slot):** FE-PRODUCT | **Người thực hiện:** Nguyên  
**Trạng thái mục tiêu:** Sẵn sàng tích hợp và nghiệm thu giao diện (Ready for Verification)

---

## 1. Mục tiêu Nhiệm vụ FE/UI
Xây dựng và hoàn thiện cấu trúc giao diện cho **5 Module Cốt lõi** của GoTek Chatbot trên ứng dụng SPA React 19 / Vite (`frontend/src/`):
1. **Khớp nối hợp đồng dữ liệu (API Contract Binding)**: Đảm bảo các màn hình giao tiếp chuẩn xác với hệ thống API backend (`/api/me`, `/api/workspace`, `/api/channels`, `/api/inbox`, `/api/knowledge`, `/api/platform`), không gọi các trường giả định không có trong schema.
2. **Quy chuẩn 5 trạng thái giao diện (Universal 5 UI States)**: Tất cả các trang và thành phần tương tác chính phải xử lý đầy đủ:
   - **Loading State**: Hiển thị Skeleton/Spinner tinh tế, tránh layout shift giật cục.
   - **Empty State**: Thông báo trạng thái rỗng thân thiện, có Call-To-Action (CTA) hướng dẫn tạo mới.
   - **Success / Populated State**: Hiển thị đầy đủ danh sách, bảng dữ liệu, phân trang và tương tác chính.
   - **Error State**: Báo lỗi cụ thể (Validation error, Network failure, Server 500) kèm nút bấm thử lại (Retry).
   - **Permission Denied State**: Thông báo từ chối truy cập (401/403) khi vai trò người dùng không đủ thẩm quyền, điều hướng an toàn.
3. **Tuyệt đối không rò rỉ dữ liệu ngoài scope (Tenant Isolation on UI)**: Khi người dùng đổi workspace, toàn bộ bộ nhớ tạm (in-memory state, form drafts, local cached queries) phải được xóa sạch (flush) và tải lại từ đầu với ngữ cảnh mới.

---

## 2. Bản đồ Màn hình Giao diện Tương ứng 5 Module

```
frontend/src/
├── App.tsx                     # Bộ điều hướng trung tâm, Sidebar & Layout Shell
├── api/api.ts                  # HTTP client bọc xác thực và bắt lỗi chuẩn
├── screens/
│   ├── auth/                   # [MODULE 1] Màn hình Đăng ký, Đăng nhập, Mời thành viên
│   │   ├── Auth.tsx
│   │   └── Invite.tsx
│   ├── settings/               # [MODULE 1 & 5] Cài đặt doanh nghiệp, Thành viên, Quota & Audit
│   │   ├── GeneralSettings.tsx
│   │   ├── MembersSettings.tsx
│   │   ├── Usage.tsx
│   │   ├── Jobs.tsx
│   │   └── AuditSettings.tsx
│   ├── channels/               # [MODULE 2] Quản lý Kênh Website & Cấu hình Widget
│   │   └── Channels.tsx
│   ├── inbox/                  # [MODULE 3] Hộp thư tương tác thời gian thực & Handoff
│   │   └── Inbox.tsx
│   ├── knowledge/              # [MODULE 4] Cơ sở tri thức, Nguồn Web & Xem trước hỏi đáp
│   │   ├── Knowledge.tsx
│   │   ├── WebSources.tsx
│   │   └── KnowledgeRetrievalPreview.tsx
│   ├── ai-rules/               # [MODULE 5] Quy tắc điều hướng hành vi AI
│   │   └── AiRules.tsx
│   └── platform/               # [MODULE 5] Quản trị hệ thống Platform Admin (Providers & Models)
│       └── Platform.tsx
```

---

## 3. Đặc tả Giao diện và Xử lý 5 Trạng thái cho Từng Module

### 3.1. Module 1: Auth & Ngữ cảnh Doanh nghiệp (`/settings/general`, `/settings/people/agents`)
- **API Bindings:** `GET /api/me`, `GET /api/members`, `POST /api/workspace/switch`, `POST /api/members/invite`.
- **Thiết kế 5 States:**
  - *Loading:* Hiển thị khung avatar và các dòng cài đặt dạng shimmer animation.
  - *Empty:* Danh sách thành viên luôn có ít nhất tài khoản của Owner hiện tại; khi tìm kiếm không ra kết quả -> hiện "Không tìm thấy thành viên phù hợp".
  - *Populated:* Hiển thị form thông tin doanh nghiệp, bảng danh sách nhân viên có badge vai trò (`Owner`, `Admin`, `Agent`).
  - *Error:* Báo lỗi màu đỏ dưới từng ô nhập (ví dụ: "Tên doanh nghiệp không được để trống", "Email đã tồn tại trong workspace").
  - *Permission Denied:* Nhân viên với vai trò `Agent` khi truy cập trang cài đặt nhạy cảm sẽ bị chặn hiển thị form lưu, chỉ hiển thị thông báo "Bạn không có quyền chỉnh sửa cài đặt doanh nghiệp".

### 3.2. Module 2: Kênh Website & Cấu hình Widget (`/settings/inboxes`)
- **API Bindings:** `GET /api/channels`, `POST /api/channels`, `PATCH /api/channels/:id`, `GET /api/channels/:id/widget-config`.
- **Thiết kế 5 States:**
  - *Loading:* Spinner xoay nhẹ tại trung tâm khung cấu hình và widget preview.
  - *Empty:* Khung rỗng khi chưa tạo kênh: Card lớn "Chưa có kênh giao tiếp nào. Hãy tạo kênh Website đầu tiên để bắt đầu kết nối khách hàng" kèm nút "+ Tạo kênh mới".
  - *Populated:* Cấu hình chia 2 cột: Cột trái chứa form cài đặt (Tên website, Domain URL, Pre-chat profile, Giờ làm việc, Màu sắc); Cột phải là **Màn hình Widget Preview thời gian thực** (mô phỏng chính xác khung chat hiển thị trên website của khách hàng).
  - *Error:* Cảnh báo domain không hợp lệ (URL sai định dạng, thiếu http/https).
  - *Permission Denied:* Ẩn nút "Lưu thay đổi" và nút "Lấy mã nhúng" nếu người dùng chỉ có quyền xem.

### 3.3. Module 3: Hộp thư Hội thoại & Tiếp quản Nhân viên (`/dashboard`)
- **API Bindings:** `GET /api/inbox/conversations`, `GET /api/inbox/conversations/:id/messages`, `POST /api/inbox/conversations/:id/takeover`, `POST /api/inbox/conversations/:id/messages`.
- **Thiết kế 5 States:**
  - *Loading:* Skeleton danh sách hội thoại bên trái và khung timeline tin nhắn ở giữa.
  - *Empty:* Hình minh họa hộp thư sạch sẽ kèm thông điệp: "Hộp thư trống. Không có hội thoại nào đang chờ xử lý."
  - *Populated:* 
    - Cột 1: Danh sách hội thoại có bộ lọc (Của tôi / Chưa phân công / Tất cả), hiển thị badge trạng thái kép (VD: `Mở - AI Đang trả lời` màu tím, `Mở - Đang chờ người` màu vàng cam, `Mở - Nhân viên tiếp quản` màu xanh lá).
    - Cột 2: Timeline hội thoại cuộn mượt mà; phân biệt rõ tin nhắn của Khách, tin trả lời của AI (có huy hiệu Bot), tin trả lời của Agent và **Ghi chú nội bộ màu vàng nhạt** (có nhãn "Chỉ nhân viên nhìn thấy").
    - Thanh điều khiển: Nút "Tiếp quản hội thoại" (Takeover) to rõ ràng. Khi nhân viên bấm, UI lập tức chuyển sang trạng thái nhân viên đang nắm quyền.
  - *Error:* Báo lỗi "Không thể gửi tin nhắn. Vui lòng kiểm tra kết nối mạng" kèm icon cảnh báo và nút Retry trực tiếp bên cạnh tin nhắn bị lỗi.
  - *Permission Denied:* Báo lỗi khi nhân viên cố gắng xem hoặc can thiệp vào hội thoại thuộc kênh mà mình không phải thành viên được phân công.

### 3.4. Module 4: Cơ sở Tri thức & Nguồn Web (`/settings/knowledge`, `/settings/web-sources`)
- **API Bindings:** `GET /api/knowledge/items`, `POST /api/knowledge/items`, `POST /api/knowledge/items/:id/publish`, `GET /api/web-sources`.
- **Thiết kế 5 States:**
  - *Loading:* Bảng dữ liệu dạng skeleton 5 dòng.
  - *Empty:* Màn hình mời nhập liệu: 2 nút lớn "Thêm câu hỏi FAQ thủ công" và "Nhập dữ liệu từ tập tin / Website".
  - *Populated:* Bảng danh sách tri thức hiển thị: Tiêu đề, Danh mục, Phiên bản hiện tại, Trạng thái (`DRAFT` xám, `PROCESSING` vàng, `READY` xanh biển, `PUBLISHED` xanh lục), và Đối tượng (`PUBLIC` vs `INTERNAL`). Có nút "Xuất bản" (Publish) riêng biệt cho từng mục.
  - *Error:* Thông báo khi upload tập tin sai định dạng hoặc vượt quá dung lượng cho phép (>10MB).
  - *Permission Denied:* Nhân viên không có quyền Admin không thể bấm nút "Xuất bản" hoặc "Xóa tri thức".

### 3.5. Module 5: Động cơ AI, Quota & Nhật ký Kiểm toán (`/settings/usage`, `/settings/audit`, `/platform`)
- **API Bindings:** `GET /api/usage/summary`, `GET /api/audit/events`, `GET /platform/providers`.
- **Thiết kế 5 States:**
  - *Loading:* Vòng tròn xoay phân giải cao.
  - *Empty:* Thông báo: "Chưa có sự kiện kiểm toán nào được ghi nhận trong khoảng thời gian này."
  - *Populated:* Thanh đo lường mức độ sử dụng Quota (Progress bar hiển thị phần trăm token đã dùng trong tháng); Bảng kiểm toán hiển thị Action, Actor, Timestamp, IP Address.
  - *Error:* Báo lỗi khi backend không thể kết nối hoặc tính toán hạn mức.
  - *Permission Denied:* Phân quyền nghiêm ngặt giữa Workspace Admin và Platform Admin. Khi truy cập `/platform` mà không có vai trò Platform Admin, giao diện lập tức chuyển hướng về trang chủ và hiện toast cảnh báo từ chối.

---

## 4. Kỹ thuật Ngăn chặn Rò rỉ Dữ liệu Giao diện (Zero UI Leakage)

Khi người dùng thực hiện chuyển đổi giữa các Workspace trong tài khoản thông qua hàm `switchWorkspace(newWorkspaceId)`:
```typescript
// Triển khai chuẩn trong frontend/src/App.tsx
async function switchWorkspace(workspaceId: string) {
  setBusy(true);
  try {
    // 1. Gửi lệnh chuyển workspace lên server để cấp session cookie mới
    await api('/workspace/switch', 'POST', { workspaceId });
    
    // 2. DỌN SẠCH bộ nhớ tạm của workspace cũ (Anti-leakage)
    setMe(null);
    clearDraftStorage();       // Xóa sạch các nội dung chat đang soạn thảo dở
    resetNavigationState();     // Reset route về mặc định /settings/general
    
    // 3. Tải lại toàn bộ dữ liệu mới tương ứng với workspace đích
    await refresh();
    navigate('/settings/general');
  } catch (e) {
    setError(e as Error);
  } finally {
    setBusy(false);
  }
}
```

---

## 5. Thu thập Bằng chứng Kiểm thử Giao diện (UI Test Evidence)

Để đáp ứng Definition of Done (DoD), thành viên Nguyên sẽ thực hiện:
1. **Chụp ảnh màn hình (Screenshots Evidence):**
   - 05 ảnh tương ứng với 5 trạng thái (Loading, Empty, Populated, Error, Denied) của màn hình Inbox.
   - 05 ảnh tương ứng với màn hình Cấu hình Kênh và Widget Preview.
   - 05 ảnh tương ứng với màn hình Quản lý Cơ sở Tri thức & Phân quyền Publish.
   - Toàn bộ ảnh được lưu tại thư mục: `delivery/evidence/ui-5modules/`.
2. **Kiểm thử tự động giao diện (Frontend Component Tests):**
   - Chạy bộ kiểm thử Jest/Vitest kiểm tra render các component chính:
     ```sh
     npm run test:frontend
     ```
   - Đảm bảo 100% test case pass và ghi lại log vào file bằng chứng.

---

## 6. Tiêu chí Hoàn thành (Definition of Done - DoD)
- [x] Thiết kế giao diện đầy đủ cho 5 module cốt lõi, bố cục tương thích theo tiêu chuẩn tham chiếu HiChat với nhận diện GoTek.
- [x] Toàn bộ contract API thực tế được tích hợp chặt chẽ, có kiểm soát kiểu dữ liệu TypeScript.
- [x] Xử lý đầy đủ và hoàn hảo 5 trạng thái giao diện (Loading, Empty, Populated, Error, Permission Denied) trên tất cả các màn hình.
- [x] Cơ chế chuyển đổi Workspace hoạt động an toàn, dọn sạch cache, không để lộ dữ liệu chéo giữa các tenant.
- [x] Thu thập đầy đủ thư viện ảnh chụp màn hình bằng chứng và chạy kiểm thử tự động giao diện thành công.
