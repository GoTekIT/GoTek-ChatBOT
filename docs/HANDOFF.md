# Development handoff

## Current state

Checkout `codex/chatbot-delivery` đang ở MVP core backend, chưa có commit lịch sử trong branch. Source có backend Express/PostgreSQL, React/Vite web, public widget SDK, migrations tới `056_model_grant_expiry.sql`, workers và test suites. Core slices có bằng chứng local; toàn sản phẩm vẫn **IN PROGRESS**.

## Last thing being worked on

Các slice H05/H06 và hardening H01/H02/H16/H23/H28/H32, provider error contract, expired-grant fence, audit export, restore integrity/quarantine. Bản handoff mới đã chạy `npm run build` PASS, `npm test` 174/174 PASS sau expired-grant fix, P0.1 focused acceptance 9/9 PASS và `npm run db:restore-drill` PASS trên 55 bảng; xem `docs/TESTING.md`, `delivery/evidence/p0-core-acceptance-2026-09-27.txt` và `delivery/evidence/p0-provider-contract-2026-09-27.txt`.

## Exact point where work stopped

Đang chuyển từ implement core sang audit/handoff. Chưa bắt đầu UI parity mới. Chưa có live provider/email receipt, staging deployment hay production release. `delivery/BACKLOG.csv` còn 107 Backlog/61 In progress/2 Implemented và cần đồng bộ sau acceptance.

## Files currently involved

- Backend routes/orchestration: `src/server/app.ts`, `platform.ts`, `platform-agent.ts`.
- Auth/tenant/security: `security.ts`, `db.ts`, migrations trong `db/migrations/`.
- Conversations/widget: `widget.ts`, `channels.ts`, `chat-store.ts`, `inbox.ts`, `public/sdk.js`.
- Knowledge/web: `knowledge*.ts`, `web-*.ts`, `web-snapshot-generation.ts`.
- AI/jobs: `provider-transport.ts`, `ai-reply-worker.ts`, `worker.ts`, `jobs.ts`, `quota.ts`, `usage-ledger.ts`.
- Verification: `tests/*.test.ts`, `delivery/evidence/`, `delivery/CHECKPOINT.md`.

## What already works (evidence-limited)

- TypeScript/build gate và serial test suite từng pass; xem `docs/TESTING.md`.
- Tenant/membership checks, widget boundary, assignment capacity, visitor profile, audit list/export, provider stable errors và restore drill có targeted evidence.
- Restore drill kiểm tra 55 tables, SHA-256 canonical row hashes, RLS/policy metadata, quarantine và disposable DB cleanup.

## What currently does not work or is unverified

- Không thể tuyên bố full H01–H32/E01–E12 accepted.
- Provider live calls, external email, browser parity, JS crawler, staging/production chưa verify.
- Retention/delete/tenant closure chưa có policy.
- Signup browser error “Không thể kết nối” từ conversation chưa được tái hiện trong snapshot.
- Cặp file suffix ` 2` còn tồn tại, chưa được phép xóa.

## Immediate next steps

1. Đọc `README.md`, `AGENTS.md`, `docs/PROJECT-STATUS.md`, `docs/TESTING.md` và `delivery/CHECKPOINT.md`.
2. Đọc log verification mới ở `delivery/evidence/handoff-*-2026-09-27.txt`; chạy lại trên checkout/môi trường của mình nếu cần tái lập.
3. Chạy `npm run build`, `npm test` và, với PostgreSQL local, `npm run db:restore-drill` sau thay đổi code liên quan.
4. P0.1 focused flow đã có evidence 9/9; tiếp tục bằng fresh fixture hai workspace khi thay đổi core và ghi evidence mới.
5. Với credentials được cấp riêng, chạy provider receipt và usage/quota matrix; redact mọi secret.
6. Chốt `delivery/decisions/H32_RETENTION_CLOSURE.md` trước bất kỳ purge/closure code nào.
7. Cập nhật PROJECT-STATUS/BACKLOG/CHECKPOINT cùng acceptance evidence; chỉ sau đó mở P1 feature hoặc UI browser acceptance.

## Do not break

- Không bỏ tenant predicates, provider grant/capability/expiry, public knowledge boundary hoặc no-resend unknown semantics.
- Không commit `.env`, key, cookie, token, backup/runtime files trong `.local/`.
- Không refactor lớn/xóa duplicate trước khi owner xác nhận.
- Không gọi HiChat parity hoặc production-ready nếu chỉ có research/test giả.

## Assumptions

Local PostgreSQL configuration và credentials chỉ là môi trường dev; không suy ra production topology. `claude_code` adapter hiện là provider transport tương thích Anthropic trong source; cần product decision nếu muốn chạy CLI riêng.

## Open questions

Provider accounts nào được dùng cho staging? Email delivery nào? H32 retention/delete policy và owner? Browser acceptance reference/screenshots nào đủ cho HiChat parity? Hosting/CI/CD/staging domain nào? Tất cả là UNKNOWN / NEEDS VERIFICATION.

## Recommended next task

Hoàn thiện P0.1 full acceptance matrix beyond the focused 9/9 local slice, then run P0.2 live provider receipt if the owner supplies credentials. Không làm thêm UI cho tới khi core path và failure states được nghiệm thu.
