# TODO

Các mục dưới đây được rút từ source, `delivery/BACKLOG.csv`, checkpoint và decision records. Mỗi mục phải cập nhật evidence trước khi đổi trạng thái.

## P0 — Blocking

### P0.1 Fresh core acceptance
- **Description:** chạy local PostgreSQL mới và kiểm tra auth → workspace → channel/widget → visitor message → agent/AI reply → knowledge retrieval → usage/audit.
- **Current evidence:** focused local slice 9/9 PASS (`delivery/evidence/p0-core-acceptance-2026-09-27.txt`); full browser/live-provider acceptance remains open.
- **Dependency:** migration, fixture, provider test credential nếu chạy live.
- **Relevant files:** `src/server/app.ts`, `src/server/widget.ts`, `src/server/worker.ts`, `src/server/knowledge-retrieval.ts`, `tests/`.
- **Acceptance:** hai workspace không đọc chéo; lỗi và trạng thái thành công được ghi; evidence mới.

### P0.2 Provider live receipt gate
- **Description:** kiểm tra tối thiểu Gemini/OpenAI/Anthropic hoặc custom LLM được owner cấp quyền; ghi usage, stable error và không ghi secret.
- **Dependency:** test account/key; hiện **BLOCKED / UNKNOWN** nếu chưa có.
- **Acceptance:** receipt thật, timeout/network/malformed, quota và revoke đều có kết quả.

### P0.3 H32.05 policy decision
- **Description:** quyết định retention, export, delete, tenant closure, RPO/RTO và owner sign-off.
- **Dependency:** PO/legal/ops quyết định; xem `delivery/decisions/H32_RETENTION_CLOSURE.md`.
- **Acceptance:** ADR được chốt trước khi viết destructive purge/closure.

## P1 — Needed for MVP

- Hoàn tất H01–H06 browser acceptance, email/link expiry, workspace switching và widget embed.
- Hoàn tất H07–H13 builder, AI rules, knowledge/web crawler/import, contacts trên dữ liệu fixture có evidence.
- H16 membership/role UI và H22 audit/security SSO acceptance.
- H23 quota/billing policy và H28 platform model grants end-to-end.
- H32 durable jobs, restore, privacy sau khi policy H32.05 được chốt.
- Cập nhật `BACKLOG.csv` để phản ánh evidence mới, nhưng giữ phân biệt Implemented/Verified/Accepted.

## P2 — Important improvement

- H14–H15 catalog, order, Help Center.
- H17–H21 labels, automation, macros, templates, integrations/webhooks.
- H24–H26 reports, CSAT/SLA, AI summaries.
- H29–H31 ticket escalation, omnichannel, Lark Wiki/business knowledge.
- E01–E12 expansion, connectors và commercial subscription.

## P3 — Nice to have / Future

- Tối ưu chi phí/token theo provider sau khi có usage thật.
- JS-rendered crawler nếu product decision yêu cầu.
- Accessibility/mobile polish và visual parity sau khi backend acceptance ổn định.

## Suggested order

1. P0.1 core acceptance và fresh evidence.
2. P0.2 credentials/provider receipt và quota audit.
3. P0.3 policy H32.05.
4. P1 browser/feature acceptance theo dependency.
5. Chỉ sau đó mở rộng P2/P3 và staging.
