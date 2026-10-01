# Lịch trình Thực thi Chi tiết & Bảng Kiểm tra Nghiệm thu (DoD Checklist)
**Dự án:** GoTek Chatbot — Monorepo Architecture (`backend/` + `frontend/`)  
**Thành viên:** Nguyên | **Vai trò kiêm nhiệm:** QA-RELEASE & FE-PRODUCT  
**Tổng thời gian dự kiến:** 03 ngày làm việc (Mỗi cụm nhiệm vụ 1 ngày)

---

## 1. Lộ trình Triển khai Chi tiết theo Từng Ngày (Daily Schedule)

```mermaid
gantt
  title Lộ trình Triển khai Nhiệm vụ của Nguyên (QA-RELEASE & FE-PRODUCT)
  dateFormat  YYYY-MM-DD
  section Ngày 1: Product Goal & 5 Module
    PO/Plan: Chốt Goal & Scope 5 Module       :done,    d1_plan, 2026-09-29, 1d
    FE/UI: Dựng Màn hình & Contract 5 Module   :active,  d1_fe,   2026-09-29, 1d
    QA/Evidence: Test Suite & Bằng chứng 5 Module :active, d1_qa, 2026-09-29, 1d

  section Ngày 2: Acceptance Matrix Core Flow
    PO/Plan: Lập Acceptance Matrix Core Flow   :         d2_plan, 2026-09-30, 1d
    FE/UI: Dựng tương tác Core Flow trên UI     :         d2_fe,   2026-09-30, 1d
    QA/Evidence: Test tự động & Bằng chứng E2E  :         d2_qa,   2026-09-30, 1d

  section Ngày 3: Shared Fixture 2 Workspace
    PO/Plan: Thiết kế Fixture 2 Workspace       :         d3_plan, 2026-10-01, 1d
    FE/UI: Workspace Switcher & Anti-leak UI    :         d3_fe,   2026-10-01, 1d
    QA/Evidence: Script Seed & Cross-Tenant Test:         d3_qa,   2026-10-01, 1d
```

---

### NGÀY 1: Chốt Product Goal và Scope 5 Module (Ưu tiên: P1)
- **Mục tiêu trong ngày:** Thống nhất baseline mục tiêu sản phẩm, dựng khung giao diện 5 module và chạy kiểm thử ranh giới scope.
- **Kế hoạch hành động từng buổi:**
  - **Sáng (08:30 - 12:00):**
    - Hoàn tất tài liệu [01_PO_PLAN_GOAL_AND_5_MODULES.md](file:///d:/gotek/ai_automation/plan_nguyen/01_PO_PLAN_GOAL_AND_5_MODULES.md), định nghĩa rõ ràng In-scope và Out-of-scope cho 5 module.
    - Họp ngắn với PO và Tech Lead để review và thống nhất Decision Log (D001–D005).
  - **Chiều (13:30 - 17:00):**
    - Triển khai màn hình giao diện theo [02_FE_UI_GOAL_AND_5_MODULES.md](file:///d:/gotek/ai_automation/plan_nguyen/02_FE_UI_GOAL_AND_5_MODULES.md): kiểm tra liên kết API `/api/me`, `/api/workspace`, xử lý 5 states (Loading, Empty, Populated, Error, Denied).
    - Chạy bộ kiểm thử tự động giao diện: `npm run test:frontend`.
  - **Tối / Cuối ngày (17:00 - 18:00):**
    - Thực thi test suite [03_QA_EVIDENCE_GOAL_AND_5_MODULES.md](file:///d:/gotek/ai_automation/plan_nguyen/03_QA_EVIDENCE_GOAL_AND_5_MODULES.md), kiểm tra Happy Path, Negative và các nhánh lỗi đặc thù (Stakeholder chưa thống nhất, Scope creep, Thiếu owner).
    - Kết xuất file bằng chứng `delivery/evidence/qa-5modules-verification-2026-09-29.txt`.

---

### NGÀY 2: Lập Acceptance Matrix cho Core Flow (Ưu tiên: P1)
- **Mục tiêu trong ngày:** Thiết lập ma trận nghiệm thu luồng cốt lõi kết nối 5 module, kiểm chứng tương tác thời gian thực trên UI và giải quyết 3 rủi ro DoD.
- **Kế hoạch hành động từng buổi:**
  - **Sáng (08:30 - 12:00):**
    - Hoàn tất bảng ma trận nghiệm thu [04_PO_PLAN_ACCEPTANCE_MATRIX.md](file:///d:/gotek/ai_automation/plan_nguyen/04_PO_PLAN_ACCEPTANCE_MATRIX.md) bao quát các tiêu chí Positive/Negative trên 2 workspace.
    - Xác định chi tiết từng assertion cho luồng: Widget -> AI Chat -> Handoff -> Staff Takeover -> Reply -> Quota/Audit.
  - **Chiều (13:30 - 17:00):**
    - Hiện thực hóa UI tương tác theo [05_FE_UI_ACCEPTANCE_MATRIX.md](file:///d:/gotek/ai_automation/plan_nguyen/05_FE_UI_ACCEPTANCE_MATRIX.md): tối ưu hóa hiển thị trục trạng thái kép (`status` vs `reply_owner`), nút Takeover mượt mà, phân biệt rõ tin nhắn công khai và ghi chú nội bộ.
    - Quay video màn hình demo Core Flow lưu tại `delivery/evidence/videos/core-flow-demo.mp4`.
  - **Tối / Cuối ngày (17:00 - 18:00):**
    - Chạy kịch bản kiểm thử tự động [06_QA_EVIDENCE_ACCEPTANCE_MATRIX.md](file:///d:/gotek/ai_automation/plan_nguyen/06_QA_EVIDENCE_ACCEPTANCE_MATRIX.md), kiểm tra dứt điểm 3 nhánh lỗi: Acceptance mơ hồ, Thiếu fixture, Test không reproducible.
    - Xuất file bằng chứng nghiệm thu `delivery/evidence/p0-core-flow-acceptance-2026-09-29.txt`.

---

### NGÀY 3: Tạo Fixture Hai Workspace Dùng Chung Cho Test (Ưu tiên: P1)
- **Mục tiêu trong ngày:** Tạo bộ dữ liệu mẫu hai workspace bất biến (idempotent), kiểm chứng khả năng chuyển đổi an toàn trên UI và chứng minh toán học Tenant A không đọc được Tenant B.
- **Kế hoạch hành động từng buổi:**
  - **Sáng (08:30 - 12:00):**
    - Hoàn thành đặc tả [07_PO_PLAN_TWO_WORKSPACE_FIXTURES.md](file:///d:/gotek/ai_automation/plan_nguyen/07_PO_PLAN_TWO_WORKSPACE_FIXTURES.md), cố định các UUID chuẩn cho `Workspace_Alpha` và `Workspace_Beta`.
    - Viết script nạp dữ liệu tự động `backend/scripts/setup-two-workspaces-fixture.ts`.
  - **Chiều (13:30 - 17:00):**
    - Tích hợp Workspace Switcher trên thanh Sidebar theo [08_FE_UI_TWO_WORKSPACE_FIXTURES.md](file:///d:/gotek/ai_automation/plan_nguyen/08_FE_UI_TWO_WORKSPACE_FIXTURES.md): thực hiện cơ chế dọn sạch RAM (Cache Flush) khi đổi workspace, chụp ảnh đối chiếu dữ liệu giữa 2 tenant.
  - **Tối / Cuối ngày (17:00 - 18:00):**
    - Thực thi bộ kiểm thử cô lập dữ liệu [09_QA_EVIDENCE_TWO_WORKSPACE_FIXTURES.md](file:///d:/gotek/ai_automation/plan_nguyen/09_QA_EVIDENCE_TWO_WORKSPACE_FIXTURES.md): chạy vòng lặp 10 lần liên tiếp (Reproducibility 10x test) đạt tỷ lệ 100% Pass.
    - Kết xuất file bằng chứng `delivery/evidence/two-workspaces-isolation-evidence-2026-09-29.txt`.
    - Tổng hợp hồ sơ bàn giao toàn bộ 9 nhiệm vụ cho PO và Tech Lead ký duyệt.

---

## 2. Bảng Đối soát Tiêu chí Hoàn thành (Definition of Done Checklist)

Dưới đây là danh mục kiểm tra bắt buộc trước khi chuyển trạng thái các task sang **DONE**:

| STT | Mã Nhiệm vụ | Hạng mục kiểm tra Definition of Done (DoD) | Trạng thái đạt được | Tài liệu minh chứng |
|:---:|:---:|---|:---:|---|
| 01 | **PLAN-01** | Goal/Scope được định nghĩa rõ ràng; mỗi module có owner và decision log; không có scope creep. | **SẴN SÀNG** | [01_PO_PLAN_GOAL_AND_5_MODULES.md](file:///d:/gotek/ai_automation/plan_nguyen/01_PO_PLAN_GOAL_AND_5_MODULES.md) |
| 02 | **FE-01** | UI chạy được với API/stub; đủ 5 states (Loading/Empty/Populated/Error/Denied); không lộ dữ liệu ngoài scope; có ảnh chụp màn hình. | **SẴN SÀNG** | [02_FE_UI_GOAL_AND_5_MODULES.md](file:///d:/gotek/ai_automation/plan_nguyen/02_FE_UI_GOAL_AND_5_MODULES.md) |
| 03 | **QA-01** | Test pass cho luồng chính + nhánh lỗi "stakeholder chưa thống nhất", "scope creep", "thiếu owner"; evidence được đính kèm; defect có severity/owner. | **SẴN SÀNG** | [03_QA_EVIDENCE_GOAL_AND_5_MODULES.md](file:///d:/gotek/ai_automation/plan_nguyen/03_QA_EVIDENCE_GOAL_AND_5_MODULES.md) |
| 04 | **PLAN-02** | Hai workspace và 5 module có đầy đủ positive/negative cases; có owner QA; có decision log; dependency đã bàn giao. | **SẴN SÀNG** | [04_PO_PLAN_ACCEPTANCE_MATRIX.md](file:///d:/gotek/ai_automation/plan_nguyen/04_PO_PLAN_ACCEPTANCE_MATRIX.md) |
| 05 | **FE-02** | UI chạy được với API/stub; đủ state và khớp Ma trận nghiệm thu; có video demo và screenshot evidence. | **SẴN SÀNG** | [05_FE_UI_ACCEPTANCE_MATRIX.md](file:///d:/gotek/ai_automation/plan_nguyen/05_FE_UI_ACCEPTANCE_MATRIX.md) |
| 06 | **QA-02** | Test pass luồng chính + xử lý triệt để nhánh lỗi "Acceptance mơ hồ", "Thiếu fixture", "Test không reproducible"; evidence được đính kèm; defect có severity/owner. | **SẴN SÀNG** | [06_QA_EVIDENCE_ACCEPTANCE_MATRIX.md](file:///d:/gotek/ai_automation/plan_nguyen/06_QA_EVIDENCE_ACCEPTANCE_MATRIX.md) |
| 07 | **PLAN-03** | Thiết kế fixture có thể chạy lại nhiều lần (idempotent); chứng minh A không đọc được B; có decision log và dependency bàn giao. | **SẴN SÀNG** | [07_PO_PLAN_TWO_WORKSPACE_FIXTURES.md](file:///d:/gotek/ai_automation/plan_nguyen/07_PO_PLAN_TWO_WORKSPACE_FIXTURES.md) |
| 08 | **FE-03** | UI chuyển đổi workspace mượt mà; flush cache sạch sẽ; chứng minh A không hiển thị dữ liệu của B trên giao diện; có screenshot/video. | **SẴN SÀNG** | [08_FE_UI_TWO_WORKSPACE_FIXTURES.md](file:///d:/gotek/ai_automation/plan_nguyen/08_FE_UI_TWO_WORKSPACE_FIXTURES.md) |
| 09 | **QA-03** | Script fixture tự động; test suite chạy lặp lại 10 lần đều pass 100%; chứng minh tuyệt đối Tenant A không đọc được Tenant B; có evidence log. | **SẴN SÀNG** | [09_QA_EVIDENCE_TWO_WORKSPACE_FIXTURES.md](file:///d:/gotek/ai_automation/plan_nguyen/09_QA_EVIDENCE_TWO_WORKSPACE_FIXTURES.md) |

---

## 3. Quy trình Trình ký và Nghiệm thu Chính thức (Sign-off Workflow)

```text
[Thành viên Nguyên] 
  └── Thực hiện xong các nhiệm vụ theo Kế hoạch & Chạy kiểm thử thành công
        └── Tạo thư mục bằng chứng tại `delivery/evidence/`
              └── Trình nộp hồ sơ nghiệm thu
                    ├── [PO (Product Owner)] duyệt Goal, Scope và Ma trận Nghiệm thu
                    └── [Tech Lead] duyệt Kiến trúc, Cô lập Tenant, RLS và Code Quality
                          └── Chuyển trạng thái 9 Task từ "Backlog" -> "Accepted / Done"
```
