# Architecture and product decisions

## ADR-001 — Workspace là tenant doanh nghiệp
- **Status:** Accepted in current implementation
- **Date:** conversation/checkpoint date unknown; evidence in code
- **Context:** widget và dữ liệu phải tách giữa các doanh nghiệp.
- **Decision:** mọi workspace-scoped query, membership, token và knowledge retrieval kiểm tra workspace; visitor chỉ nhận context public/published được phép.
- **Consequences:** không dùng account ID hard-code; tests cross-tenant là bắt buộc.

## ADR-002 — Provider secret chỉ ở server
- **Status:** Accepted in current implementation
- **Context:** Gemini/OpenAI/Anthropic/custom LLM cần tích hợp nhưng widget không được biết key.
- **Decision:** provider registry/model grants và transport ở backend; response/error không chứa endpoint/key.
- **Consequences:** live receipt cần secret môi trường test; không commit `.env`.

## ADR-003 — Durable jobs và unknown dispatch
- **Status:** Accepted in current implementation
- **Context:** retry external side effect có thể gửi trùng.
- **Decision:** lease/retry/dead-letter; external result không rõ chuyển `unknown`, không resend mù.
- **Consequences:** cần reconciliation/manual decision cho unknown.

## ADR-004 — Restore phải quarantine tác động ngoài DB
- **Status:** Accepted in current implementation
- **Context:** pg restore không thể khôi phục an toàn session, provider claim hay reserved usage.
- **Decision:** disposable restore + hash/policy checks; quarantine sessions, pending platform/AI, reserved usage và jobs.
- **Consequences:** drill không phải production RPO/RTO/object storage restore.

## ADR-005 — H32.05 không tự suy đoán policy
- **Status:** Decision required
- **Context:** purge/delete/closure là destructive và thiếu retention/legal/owner decision.
- **Decision:** giữ backlog; chỉ ghi decision gate trong `delivery/decisions/H32_RETENTION_CLOSURE.md`.
- **Consequences:** không đánh dấu privacy/closure complete.

## ADR-006 — Backend/core trước UI
- **Status:** Accepted from user direction
- **Context:** user yêu cầu hoàn thiện core backend trước và UI sau, bám reference HiChat.
- **Decision:** ưu tiên API, data, auth, provider, jobs, knowledge và evidence; chưa coi UI parity là done.
- **Consequences:** browser/UI acceptance remains open.

## ADR-007 — HiChat là reference khảo sát, không phải implementation evidence
- **Status:** Accepted constraint
- **Context:** research specs mô tả luồng quan sát được nhưng không chứng minh source HiChat nội bộ.
- **Decision:** chỉ gọi “theo reference/đề xuất” khi chưa có evidence; không claim parity.
- **Consequences:** cần visual/flow sign-off riêng.
