# Conversation summary

## Initial request

Xây GoTek Chatbot theo hồ sơ bàn giao và khảo sát HiChat, triển khai P0–P6, ưu tiên core/backend, không dừng ở mock UI, giữ workspace/tenant isolation, widget token riêng và AI model integration.

## Requirement evolution

- User yêu cầu mỗi workspace là một doanh nghiệp; widget chỉ trả lời dữ liệu workspace đã công khai.
- Admin cấp Gemini, ChatGPT/OpenAI, Claude/Anthropic và custom LLM; tối ưu token và phân tích context.
- User yêu cầu chạy đa luồng không xung đột, backend trước UI; chỉ staging trước production approval.
- User nhấn mạnh HiChat/HiLab là reference cho flow/UX; sau đó yêu cầu handoff package là single source of truth.

## Important decisions

- Tenant boundaries, server-side provider secrets, capability grants, usage/quota và durable jobs là core.
- Unknown external dispatch không được resend mù.
- Restore phải quarantine active/session/AI effects.
- Không suy đoán retention/delete/closure policy (H32.05).
- HiChat research không được dùng để claim internal parity.

## Features implemented (slice-level)

Auth/session/membership, workspace/channel/widget, visitor/contact/inbox primitives, knowledge import/lifecycle/retrieval, web static/sitemap/security pieces, provider transport/model grants, platform agent, quota/metering, jobs/workers, audit export, restore drill. Xem PROJECT-STATUS để biết giới hạn evidence.

## Features partially implemented

Full H01–H13, H16, H22–H23, H28, H32; crawler/browser parity; AI live receipt; UI builder/accessibility; staging. BACKLOG CSV is authoritative for individual rows but status may lag newer evidence.

## Features not implemented / backlog

Catalog/order, Help Center, labels/automation/macros/templates, integrations/webhooks, reports/CSAT/SLA, ticket escalation, omnichannel, Lark, commercial subscription và E01–E12 expansion chưa có đủ implementation/acceptance.

## Bugs discussed

Conversation reported signup UI “Không thể kết nối. Kiểm tra mạng và thử lại.” This remains UNKNOWN / NEEDS VERIFICATION in this audit; no claim of fix without fresh browser evidence.

## UX/UI decisions

GoTek branding and HiChat-like layout/flows were requested. User explicitly prioritized backend/core before UI; current repository evidence is primarily backend/tests. No pixel parity claim.

## Architecture decisions

Express 5 + TypeScript + PostgreSQL + React/Vite; migration-driven schema; workers through durable jobs; provider registry in backend; public widget routes separated from authenticated app routes.

## Business rules

Published/public knowledge only for widget; workspace membership and grants required; provider secrets never client-side; quota reservation before dispatch; unknown result must be reconciled; audit and restore evidence bounded.

## Important corrections made by user

“Hilab” in prior wording means HiChat at hichat.asia as reference. UI should not be invented as vector/mock. Do not purchase services, message customers or deploy production without approval.

## Open questions

Full conversation history may not be available to future agents; this summary is distilled only from accessible context and repository evidence. Production host, provider credentials, email, retention policy, Platform Agent billing/quota ownership and HiChat acceptance artifacts remain unresolved.

## Context future AI must not lose

Read `AGENTS.md`, `docs/USER-GUIDE.md`, `docs/PROJECT-STATUS.md`, `docs/HANDOFF.md`, then delivery checkpoint/contracts. Preserve incomplete source and evidence distinctions. The latest configured regression is **175 tests pass** after NULL-lease recovery hardening; it does not accept all product groups. Documentation pause is explicit until the next checkpoint reopens implementation.
