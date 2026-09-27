# Testing

## Framework and commands

Node `node:test` + `assert`, chạy qua `tsx`; Supertest cho HTTP, PostgreSQL thật cho nhiều integration tests. `npm test` chạy `tests/*.test.ts` với concurrency 1 để tránh fixture DB xung đột. Không chạy toàn suite song song cùng cluster.

```sh
npm test
npm run build
npx tsc --noEmit
npm run db:restore-drill
```

Các command tồn tại/được đối chiếu trong package/source. Lint: NOT AVAILABLE (không có script/config lint). Coverage percentage: UNKNOWN / NEEDS VERIFICATION (không có coverage report chuẩn trong audit). Test có thể tạo dữ liệu fixture; chỉ dùng cluster local riêng theo [DEVELOPMENT](DEVELOPMENT.md).

## Current verification

Fresh handoff validation (2026-09-27): `npm run build` PASS; after the expired-grant fix, `npm test` PASS 174/174 (serial); P0.1 focused core acceptance PASS 9/9; `npm run db:restore-drill` PASS trên 55 bảng. Logs: `delivery/evidence/handoff-build-2026-09-27.txt`, `delivery/evidence/handoff-tests-2026-09-27.txt`, `delivery/evidence/build-after-expired-grant-2026-09-27.txt`, `delivery/evidence/core-after-expired-grant-2026-09-27.txt`, `delivery/evidence/p0-core-acceptance-2026-09-27.txt`, `delivery/evidence/p0-provider-contract-2026-09-27.txt`, `delivery/evidence/handoff-restore-drill-2026-09-27.txt`. `npx tsc --noEmit` được chạy trong focused provider audit và build. Kết quả này không thay thế browser/live-provider acceptance. Xem `delivery/evidence/` và checkpoint cho các lần chạy trước.

| Check | Current handoff result |
|---|---|
| Build | PASS (2026-09-27) |
| Typecheck | PASS via build (2026-09-27) |
| Tests | PASS 174/174 (2026-09-27, after grant expiry fix) |
| Restore drill | PASS, 55 tables (2026-09-27) |
| Lint | NOT AVAILABLE |
| Manual/browser end-to-end | NOT VERIFIED for complete scope |
| Real provider API receipt | NOT VERIFIED |
| P0.1 focused core acceptance | PASS, 9/9 local integration tests (2026-09-27) |

## Current verification matrix

| Feature | Implemented | Unit / focused tests | Integration tests | Manually verified in handoff |
|---|---|---|---|---|
| Signup/reset/session | Backend slices | auth-reset, auth-signup-verify | Supertest + DB | Not run |
| Workspace/RLS/permissions | Backend slices | security/tenant tests in tests | DB negative cases | Not run |
| Widget/chat/handoff | Backend slices | widget/chat/ownership suites | DB + HTTP fixtures | Not run |
| AI provider/grounding/quota | Backend slices | injected provider/worker suites | DB job/quota suites | Live API not verified |
| Knowledge/web ingestion | Backend slices | parser/retrieval/web suites | snapshot/version/jobs | Browser not verified |
| Audit export | Backend slice | audit-export/audit-log | audit-export-http | Not run |
| Backup restore | Local drill | standalone script | temporary restored DB | No staging acceptance |
| Complete HiChat parity | Incomplete | tests do not prove parity | Incomplete scope | Not verified |

## Manual acceptance checklist

- Signup/login/logout/reset success and invalid/expired token; second workspace cannot read first workspace data.
- Configure widget token/domain and verify revoked token, wrong domain and visitor isolation.
- Publish PUBLIC knowledge; verify answer source, private content exclusion and missing evidence handoff.
- Staff takeover while AI job in flight; verify stale reply never appears and retries do not duplicate effects.
- Platform Admin vs Workspace Admin permission negatives, support grant expiry and audit record.
- Provider secret/grant/quota failure; approved live-model request and confirmed usage/receipt.
- Web ingestion errors, draft review/publish/rollback; UI and database state agree.

Record environment, commit, command/steps and evidence; redact credentials/customer content. Green tests do not substitute for external receipt, browser acceptance or production readiness. Tests absent for a full H/E requirement must remain unverified in status, even if a narrow service test passes.
