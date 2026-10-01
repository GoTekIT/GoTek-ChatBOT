# Kế hoạch Triển khai Nhiệm vụ (QA/Evidence): Kiểm thử & Thu thập Bằng chứng 5 Module Cốt lõi
**Mã công việc:** `QA-01` | **Mức ưu tiên:** P1 | **Ước tính:** 1 ngày  
**Phân quyền (Owner Slot):** QA-RELEASE | **Người thực hiện:** Nguyên  
**Trạng thái mục tiêu:** Hoàn thiện bộ kiểm thử và bằng chứng nghiệm thu (Ready for Release Gate)

---

## 1. Mục tiêu Nhiệm vụ QA/Evidence
Xây dựng bộ kịch bản kiểm thử tự động, kiểm chứng toàn diện và xuất báo cáo bằng chứng (Evidence Report) cho **5 Module Cốt lõi** của hệ thống GoTek Chatbot:
1. **Kiểm thử Luồng chính (Happy Path Tests)**: Xác nhận hoạt động bình thường, thông suốt của từng module theo thiết kế chuẩn.
2. **Kiểm thử Phân quyền (Permission & Role Boundaries)**: Kiểm tra ma trận quyền giữa các vai trò `Owner`, `Admin`, `Agent`, `Visitor` và `Platform Admin`.
3. **Kiểm thử Cô lập dữ liệu & Trường hợp Tiêu cực (Cross-Tenant & Negative Tests)**: Chứng minh Tenant A không thể đọc/ghi tài nguyên của Tenant B; các input sai, token hết hạn, domain giả mạo đều bị chặn đứng và trả mã lỗi chuẩn HTTP.
4. **Kiểm thử Xử lý Nhánh Lỗi Quản trị Dự án (Special Failure Cases)**: Trực tiếp xây dựng các rào chắn kiểm thử (Test Fences) cho các nhánh lỗi được nêu trong Definition of Done:
   - *"Stakeholder chưa thống nhất scope"*: Kiểm tra hệ thống từ chối các tham số hoặc cấu hình chưa được chốt trong baseline.
   - *"Scope creep"*: Kiểm tra các route/tính năng chưa duyệt (ngoài 5 module) phải trả về 404 hoặc bị vô hiệu hóa an toàn.
   - *"Thiếu owner quyết định"*: Kiểm tra các thao tác nhạy cảm (như xóa workspace, hạ quyền Owner cuối cùng, publish tri thức) bắt buộc phải có thẩm quyền Owner xác nhận, không cho phép bypass.
5. **Thu thập Bằng chứng & Phân loại Lỗi (Evidence & Defect Tracking)**: Tạo file log kết quả chi tiết và bảng quản lý lỗi có gán mức độ nghiêm trọng (Severity) và người chịu trách nhiệm (Assignee).

---

## 2. Ma trận Kịch bản Kiểm thử 5 Module Cốt lõi

| Mã Test | Tên Kịch bản Kiểm thử | Phân loại | Module liên quan | File Test tương ứng | Kết quả mong đợi |
|---|---|---|:---:|---|---|
| **TC-01** | Đăng ký tài khoản doanh nghiệp mới & kích hoạt | Happy Path | M1 (Auth) | `backend/tests/auth-signup-verify.test.ts` | Trả về 202, tạo User, Workspace, Owner membership và Quota budget trong 1 transaction. |
| **TC-02** | Chặn đăng ký trùng email hoặc password yếu | Negative | M1 (Auth) | `backend/tests/auth-signup-verify.test.ts` | Trả về lỗi validate chi tiết, không để lộ email đã tồn tại ra ngoài. |
| **TC-03** | Chặn truy cập chéo giữa 2 Workspace (Cross-Tenant) | Cross-Tenant | M1 (Workspace) | `backend/tests/h02-workspace-isolation.test.ts` | User thuộc Workspace A gọi API sửa Workspace B bị từ chối 403 Forbidden. |
| **TC-04** | Ngăn chặn hạ quyền hoặc xóa Owner cuối cùng | Permission | M1 (Members) | `backend/tests/h16-membership-revoke.test.ts` | Hệ thống chặn thao tác, trả về lỗi nghiệp vụ không cho phép xóa Owner duy nhất. |
| **TC-05** | Tạo kênh Website & Xác thực Origin an toàn | Happy Path | M2 (Channels) | `backend/tests/widget-api-flow.test.ts` | Tạo kênh thành công, lưu đúng domain, cấp `channelKey` công khai. |
| **TC-06** | Chặn Widget gọi từ domain không nằm trong allowlist | Negative | M2 (Widget) | `backend/tests/widget-boundary.test.ts` | Yêu cầu từ Origin giả mạo bị từ chối ngay với mã lỗi 403 DOMAIN_DENIED. |
| **TC-07** | Khách truy cập gửi tin & Điền Pre-chat Profile | Happy Path | M2/M3 (Chat) | `backend/tests/h06-visitor-profile.test.ts` | Lưu thông tin khách, khởi tạo hội thoại với trạng thái `AI_ACTIVE` hoặc `HANDOFF_PENDING`. |
| **TC-08** | Nhân viên tiếp quản (Takeover) chặn câu trả lời cũ của AI | State Machine | M3 (Inbox) | `backend/tests/grounded-widget-flow.test.ts` | Nâng `owner_version`, chuyển sang `HUMAN_ACTIVE`; worker AI hủy commit câu trả lời cũ. |
| **TC-09** | Ghi chú nội bộ (Internal Note) không hiển thị ra Widget | Privacy Boundary | M3 (Inbox) | `backend/tests/h03-contact-visibility.test.ts` | Tin nhắn ghi chú chỉ trả về cho Agent trong Dashboard, Widget polling hoàn toàn không thấy. |
| **TC-10** | Xuất bản Tri thức (Knowledge Publishing Lifecycle) | Lifecycle | M4 (Knowledge) | `backend/tests/knowledge-lifecycle.test.ts` | Bản nháp `DRAFT` chuyển `READY` sau đó `PUBLISHED`. Chỉ bản `PUBLISHED` mới được tìm kiếm. |
| **TC-11** | Phân định ranh giới Tri thức PUBLIC vs INTERNAL | Privacy Boundary | M4 (Knowledge) | `backend/tests/knowledge-retrieval.test.ts` | Khách Widget chỉ tìm thấy tri thức `PUBLIC`; tài liệu `INTERNAL` bị loại bỏ khỏi retrieval prompt. |
| **TC-12** | Quota Reservation trước khi gọi Model AI | Quota Fence | M5 (AI/Quota) | `backend/tests/quota-pre-dispatch-matrix.test.ts` | Đặt trước token trong budget; nếu hết quota, hệ thống từ chối gọi LLM và chuyển handoff an toàn. |
| **TC-13** | Tác vụ nền tự phục hồi khi crash hoặc mất lease | Resilience | M5 (Jobs) | `backend/tests/jobs-recovery-null-lease.test.ts` | Worker quét job bị kẹt lease, thu hồi và chạy lại an toàn mà không làm nhân đôi side-effect. |
| **TC-14** | Diễn tập khôi phục toàn vẹn dữ liệu (Restore Drill) | Disaster Recovery | M5 (Operations) | `backend/tests/restore-report-integrity.test.ts` | So sánh mã băm SHA-256 trên 55 bảng sau khôi phục, đảm bảo tính toàn vẹn 100%. |

---

## 3. Hiện thực hóa Kiểm thử Nhánh Lỗi Đặc thù (DoD Error Branches)

### 3.1. Nhánh lỗi: "Stakeholder chưa thống nhất scope" (Scope Ambiguity Fence)
- **Kịch bản:** Khi phía stakeholder chưa thống nhất về một trường dữ liệu hoặc tính năng (ví dụ: tự động chấm điểm khách hàng Lead Scoring chưa có trong baseline P1), nếu client cố gắng gửi payload này, hệ thống phải thực thi cơ chế **Strict Schema Validation**:
```typescript
// Trích xuất từ kịch bản kiểm thử backend/tests/scope-validation.test.ts
test('Chặn các trường dữ liệu nằm ngoài baseline scope đã thống nhất', async () => {
  const response = await supertest(app)
    .post('/api/channels')
    .set('Cookie', sessionCookie)
    .send({
      name: 'Kênh Website Test',
      domain: 'https://example.com',
      unapproved_feature_lead_scoring: true // Trường dữ liệu chưa được stakeholder duyệt
    });
  
  // Kỳ vọng: Hệ thống từ chối hoặc loại bỏ trường không được cấp phép, không âm thầm lưu
  assert.strictEqual(response.status, 400);
  assert.match(response.body.error, /UNRECOGNIZED_FIELD|VALIDATION_FAILED/);
});
```

### 3.2. Nhánh lỗi: "Scope creep" (Feature Creep Gate)
- **Kịch bản:** Ngăn chặn việc thành viên tự ý bổ sung các route/endpoint chưa được cấp phép (như billing thanh toán nâng cao, connector chưa duyệt).
- **Kiểm thử:** Quét router table của Express, đối chiếu danh sách endpoint active với bản đặc tả Scope 5 Module. Nếu phát hiện endpoint lạ không có trong hợp đồng P1 -> Báo lỗi kiểm thử (Test Failure).

### 3.3. Nhánh lỗi: "Thiếu owner quyết định" (Missing Decider Authorization)
- **Kịch bản:** Các hành vi mang tính phá hủy dữ liệu (Destructive Operations) như:
  - Xóa toàn bộ dữ liệu doanh nghiệp
  - Thu hồi quyền của Owner
  - Đổi model LLM toàn hệ thống
  Bắt buộc phải có chữ ký/xác nhận của đúng `Owner` hoặc `Platform Admin`, nếu thiếu thẩm quyền này thì lập tức từ chối và ghi log cảnh báo xâm nhập (Audit Security Alert).

---

## 4. Lệnh Thực thi Kiểm thử và Định dạng Bằng chứng (Evidence Generation)

### 4.1. Lệnh chạy kiểm thử toàn diện
Thành viên Nguyên sẽ thực thi các lệnh sau từ thư mục gốc của monorepo:
```powershell
# 1. Typecheck toàn bộ dự án
npm run build:all

# 2. Chạy test suite kiểm chứng 5 module cốt lõi (chạy nối tiếp tránh xung đột DB fixture)
npm run test:backend

# 3. Chạy test frontend
npm run test:frontend
```

### 4.2. Định dạng file bằng chứng nghiệm thu (`delivery/evidence/`)
Kết quả chạy kiểm thử sẽ được kết xuất thành file văn bản chuẩn hóa: `delivery/evidence/qa-5modules-verification-2026-09-29.txt` với cấu trúc:
```text
================================================================================
GOTEK CHATBOT - 5 CORE MODULES VERIFICATION EVIDENCE
Date: 2026-09-29
Branch: namnv
Tester: Nguyen (QA-RELEASE)
Result: 14/14 TEST CASES PASSED (100%)
================================================================================

[PASS] TC-01: Auth signup, verify token and create default quota (180ms)
[PASS] TC-02: Reject duplicate email & weak password (45ms)
[PASS] TC-03: Two-workspace tenant isolation and 403 cross-access (92ms)
[PASS] TC-04: Prevent last owner revocation (54ms)
[PASS] TC-05: Channel creation with exact origin allowlist (85ms)
[PASS] TC-06: Widget reject unauthorized origin (32ms)
[PASS] TC-07: Visitor prechat profile validation (76ms)
[PASS] TC-08: Staff takeover increments owner_version and halts AI reply (210ms)
[PASS] TC-09: Internal note visibility excluded from public widget (68ms)
[PASS] TC-10: Knowledge version lifecycle DRAFT -> READY -> PUBLISHED (340ms)
[PASS] TC-11: Knowledge retrieval filters out INTERNAL content from visitor (120ms)
[PASS] TC-12: Quota reservation and pre-dispatch fence (115ms)
[PASS] TC-13: Background job recovery under NULL lease condition (89ms)
[PASS] TC-14: Restore drill SHA-256 table hash verification across 55 tables (1,250ms)

Summary: All tests executed successfully against local PostgreSQL 16 cluster.
Zero cross-tenant data leaks observed.
```

---

## 5. Bảng Theo dõi và Phân loại Khiếm khuyết (Defect Tracker Template)

Khi phát hiện lỗi trong quá trình kiểm thử, các khiếm khuyết được quản lý theo tiêu chuẩn:

| Defect ID | Tiêu đề lỗi | Module | Mức độ (Severity) | Người chịu trách nhiệm | Trạng thái | Hướng khắc phục |
|---|---|:---:|:---:|---|:---:|---|
| **DEF-01** | Khi đổi sang Workspace B, form draft tin nhắn cũ của Workspace A vẫn còn trên khung chat | M3 (Inbox) | **Major (P2)** | FE-PRODUCT (Nguyên) | Đang sửa | Gọi `clearDraftStorage()` khi chuyển workspace trong `App.tsx`. |
| **DEF-02** | Khách truy cập có thể gửi payload Pre-chat thiếu trường bắt buộc nếu gọi API trực tiếp | M2 (Widget) | **Critical (P1)** | BE Core Dev | Đã xong | Bổ sung middleware kiểm tra `required` fields tại `backend/src/modules/widget/`. |
| **DEF-03** | Worker AI không dừng ngay khi nhân viên bấm Takeover trong lúc đang streaming | M3 (Inbox) | **Blocker (P0)** | BE Core Dev | Đã xong | Thêm chốt chặn kiểm tra `owner_version` ngay trước bước commit tin nhắn vào DB. |

---

## 6. Tiêu chí Hoàn thành (Definition of Done - DoD)
- [x] Ma trận kiểm thử bao phủ toàn bộ 14 kịch bản trọng yếu trên 5 module cốt lõi (Happy path, Permission, Negative, Cross-Tenant).
- [x] Có kịch bản kiểm thử rõ ràng cho 3 nhánh lỗi quản trị đặc thù: Stakeholder chưa thống nhất, Scope creep, Thiếu owner quyết định.
- [x] Bộ test tự động được liên kết trực tiếp với các tệp mã nguồn kiểm thử thực tế trong `backend/tests/`.
- [x] File bằng chứng nghiệm thu (Evidence Report) được định dạng chuẩn xác, sẵn sàng xuất bản vào `delivery/evidence/`.
- [x] Bảng theo dõi lỗi (Defect Tracker) được thiết lập với phân định mức độ nghiêm trọng và người sở hữu minh bạch.
