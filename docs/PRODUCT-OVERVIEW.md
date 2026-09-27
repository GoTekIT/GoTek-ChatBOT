# Product overview

## Problem

GoTek Chatbot là nền tảng SaaS để mỗi workspace đại diện cho một doanh nghiệp, tiếp nhận hội thoại từ widget và hỗ trợ nhân viên/AI trả lời dựa trên dữ liệu đã được doanh nghiệp cấp phép. Mục tiêu là gom inbox, tri thức, model AI, phân quyền và bằng chứng vận hành vào một hệ thống có scope theo tenant.

## Target users

- Doanh nghiệp sở hữu một workspace và dữ liệu/tri thức riêng.
- Nhân viên xử lý hội thoại và quản trị channel, contact, AI rule.
- Platform Admin cấp provider/model/grant cho workspace.
- Khách truy cập widget công khai.

## Core value proposition

Mỗi doanh nghiệp kiểm soát tri thức được publish, model được cấp, người được xem dữ liệu và token widget riêng. Câu trả lời phải có context phù hợp workspace; provider secret không đi ra widget.

## Main use cases

1. Đăng ký, xác thực, đăng nhập, reset và quản lý membership.
2. Tạo channel/widget có token, origin và giới hạn truy cập.
3. Khách gửi tin; agent nhận, phân công, takeover hoặc trả lời AI.
4. Upload/import FAQ, tài liệu, dữ liệu web; chunk, embed, retrieve, publish/rollback.
5. Platform Admin đăng ký provider/model; workspace dùng grant capability có quota/metering.
6. Audit, restore drill và xử lý job bền vững với retry/dead-letter/unknown.

## Main entities

`users`, `workspaces`, `memberships`, `sessions`, `channels`, `visitors`, `conversations`, `messages`, `contacts`, `knowledge_*`, `providers`, `models`, `model_grants`, `jobs`, `usage_*`, `audit_events`, `support_grants`.

## Business rules đã có bằng chứng

- Query và widget context phải scope workspace; cross-tenant access trả lỗi.
- Workspace/model/provider/grant phải active và capability phù hợp trước routing.
- Chỉ tri thức published/public theo policy được dùng cho visitor.
- External dispatch không rõ kết quả không tự động resend; job được đánh dấu unknown.
- Restore drill phải quarantine session, pending AI/platform effects và reserved usage.

## MVP scope

Core backend slices đang triển khai: auth/membership/tenant boundary, widget/inbox/chat, knowledge lifecycle/retrieval, model/provider policy, quota/metering, workers/jobs, audit và restore verification. Full H01–H32/E01–E12 acceptance chưa đạt; xem [PROJECT-STATUS](PROJECT-STATUS.md).

## Non-MVP / future

Catalog/order, help center, đa kênh đầy đủ, SSO, billing thương mại, báo cáo nâng cao, Lark connector, mobile/accessibility parity và các E mở rộng là backlog hoặc decision gate theo CSV.

## Current limitations

HiChat được dùng làm nguồn tham chiếu UX/luồng trong `research/`; chưa có bằng chứng source nội bộ hay parity production. Provider live, email thật, browser acceptance, staging và production chưa được nghiệm thu. Retention/delete/closure chưa thể triển khai thiếu chính sách owner.
