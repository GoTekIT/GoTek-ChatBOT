# Current implementation checkpoint — 2026-09-24

Goal remains active: full P0–P6, all 158 H subitems and E01–E12. No module accepted. Previous goal turn made concrete progress (new implementation and real PostgreSQL test evidence).

## Authoritative state
- Repository originally documentation only, no commits; branch codex/chatbot-delivery. New source under src, migrations under db, tests under tests. All files currently uncommitted; avoid blanket commit of historical binaries/screenshots.
- Read .agents/skills/gotek-chatbot-delivery/SKILL.md, delivery/NEXT_STEPS.md, reports/GOTEK_CHATBOT_DEV_HANDOFF.md, research/CHECKPOINT.md, delivery/contracts/P0-P1.md.
- Current user authorization supersedes historical “chưa code” notes. Local/test only. No production, purchases, customer messages.
- Stack TypeScript/React/Vite/Express/PostgreSQL 16. Dedicated local cluster .local/postgres port 55432. App binds 127.0.0.1:4317. Private runtime config .local/runtime.json, never print/commit secrets.

## Implemented, not accepted
H01 auth/signup/email verification/reset/sessions; H02 workspace settings/switch; H16 baseline Owner/Admin/Agent membership/invite/revoke; H22 metadata audit. Persistent PostgreSQL, hashed password/token, API role checks, RLS on workspace/audit/invitations. Identity tables still trusted boundary, review hardening before staging. UI auth/settings/people/audit connected to real APIs. Invite accept API exists; UI acceptance route not yet implemented.

## Evidence
- npm run build passed (TypeScript + Vite).
- delivery/evidence/p1-api-tests.txt: one integration suite with many assertions, not 40 separate tests. Real database: >=2 tenants, Owner/Agent, role denial, revoke, CSRF, RLS, duplicate signup, expiry/single-use/reset/logout.
- delivery/evidence/p1-restore-drill.json: real pg_dump/pg_restore into random disposable database; 9 table counts match; policies preserved and fail closed without context. Sessions/challenges/local delivery cleared and invites revoked before restored use. Target removed; private backup retained under .local/backups. Does not prove object/index backup, production RPO/RTO or full H32.
- Current live dev process started via npm run dev (tool session 18910); verify handle/HTTP before restart.

## Next work
1. Browser inspect local UI and fix flow/errors; get source HiChat login/signup screenshots if reachable. Old authenticated IAB gone, Chrome inventory no HiChat tab. Do not claim parity from supplied two dark screenshots or provisional light implementation.
2. Tighten concurrency/security: reset-vs-login race, membership locks/last owner/seat reactivation, test concurrent invites and role changes. Add invite accept UI and truthful delivery status.
3. Complete P1 remaining H23 quota ledger and H28 platform metadata/provider registry/support grants (no credentials in browser), H32 jobs/backup/operations with contracts first.
4. P2 real website widget/inbox/contacts/realtime/handoff; then P3 provider/knowledge and core P4. P5/P6 remain full scope.
5. Ask only when credentials/source access or scope decisions become necessary; continue independent code. No external email receipt yet; local delivery spool is test-only, not SMTP acceptance.

Backlog retains all 170 rows; touched slices In progress, not Verified/Accepted. No user PO acceptance. Do not mark goal complete.

## Continuation — invitation acceptance and seat concurrency
- Added real /app/invitation UI with explicit accept, matching verified-account requirement (backend), pending login redirect in same-tab storage, URL fragment token instead of request query; missing-link state browser-readback verified in IAB.
- Members UI now explicitly identifies local-only delivery; no email sent claim.
- Added concurrent seat-reservation API assertions: one succeeds, other SEAT_LIMIT; revoke releases reservation. Build and integration suite re-run after edits.
- Full successful invitation browser E2E not yet run. H16 remains In progress. Continue P1 quota/platform/operations after finishing UI checks.

## Continuation — H23 core quota foundation
- D007 contract delivery/contracts/P1-QUOTA.md. Migrations 002/003 applied: tenant-scoped quota budgets + usage operations. Explicit periods/units, idempotency keys, row locks, UNKNOWN reservation retained, receipt-only finalization and conflicting retry denied. Settlement locks budget before operation to serialize with reservation.
- GET /api/usage Owner/Admin; /settings/usage UI real data table/loading/empty/error/refresh. No plan pricing or fake entitlements. Four usage meters implemented, seats remain prior membership counter; remaining meters not complete.
- npm test now 2 passing integration suites (identity + quota), npm run build passed; logs under delivery/evidence. Restore drill re-run including new tables; consult current JSON for actual count.
- H23.04/.05 In progress. Still missing provider integration, receipt from real provider, commercial billing E09, period timezone policy, complete UI browser/parity checks. No claim of complete H23.
- Dev process uses tsx without watch: backend route changes require controlled restart of verified local process before browser /api/usage check. Do not mistake Vite frontend HMR for backend reload.
- Next: P1 platform console/registry/support grants and worker operations; retain full P0–P6 scope.

## Continuation — H32 bounded jobs/outbox
- Migration 004 jobs applied. Transactional enqueue with payload-aware idempotency, SKIP LOCKED claim, finite attempts/exponential backoff, lease-token fencing, safe-local stale retry, external stale UNKNOWN, receipt-required success. Tenant FORCE RLS, metadata-only Owner/Admin API and /settings/jobs UI.
- src/server/worker.ts runWorkerOnce explicitly scoped to trusted workspace. External handlers disabled; unknown handler outcome never automatically replayed. No continuously running scheduler or real business handlers yet; do not claim outbound delivery or H32 completion.
- tests/jobs.test.ts covers database rollback, concurrent unique enqueue/claim, bounded retries/dead, UNKNOWN no replay, receipt fencing, foreign tenant invisibility, worker success/error and external adapter not invoked. Test-only local handlers are fixtures, not product integrations.
- Latest npm test: 3 integration suites pass. Build pass. Restore drill passed 12 tables after job schema, with pending jobs quarantined. Current evidence files under delivery/evidence.
- Prior goal turn progress confirmed; this turn adds source/schema/UI/test/restore changes. Goal remains active. No blockers preventing independent work.
- Remaining P1: platform metadata/provider/model/grant console, operational auth concurrency hardening, successful browser acceptance. P2–P6 remain unimplemented, full scope preserved. Backend dev server still requires reload for new routes; verify exact process before controlled restart.

## Continuation — H28 platform registry backend
- Migration 005 applied: platform_admins distinct from workspace roles, providers/models/capability grants, platform audit and separate RLS context. Platform API checks fresh active admin role from session, does not confer chat access. Creation grants remain operator-only; no self elevation endpoint.
- Registry API omits secret reference/value; provider starts disabled; enable checks server env reference. Model grant rejects unsupported capability, audits reason. Trusted runtime resolveModel rechecks grant/model/provider/workspace state and returns secret only server-side; no actual provider request/fallback yet.
- Restore now disables provider registry and revokes model grants. Current restore JSON covers 17 tables. Auth sessions/challenges/job quarantine retained.
- 4 passing integration suites and build after latest edits, evidence logs updated. Platform suite proves workspace Owner denied, explicit platform role succeeds, wrong capability/missing secret rejected, registry omits references, RLS blank context denied, role revoke immediate, disabled provider runtime resolution denied.
- H28.01/.02 only backend slices In progress. Console UI, support grants (scope/reason/expiry/audit), lifecycle control, actual provider connection/fallback, browser acceptance remain pending. D009 screen contract provisional; H28.05 design approval remains open. No production.
- Goal remains active, previous turn and this turn both concrete progress. Next finish platform UI/support scope, then P2 core chat flow. All H/E scope retained.
- During platform verification an audit INSERT placeholder mismatch caused SQL 42601; fixed to five placeholders. Re-ran complete tests/build/restore after fix; no failure suppressed.

## Continuation — Platform console UI + browser readback
- src/web/Platform.tsx implements separate /platform/providers console with provider/model/grant forms, enable/disable reason, capability-select and real registry readback. API errors translated; denied users see no registry. /api/me exposes platformAdmin boolean for navigation only (backend authorization remains independent).
- Browser verified denied access, synthetic fixture login, platform navigation, create disabled provider and full reload persistence. Evidence delivery/evidence/p1-platform-ui.md. No provider key entered, no external calls. Model/grant UI writes and mobile acceptance not yet tested.
- Readback failure now distinct from successful mutation; no false “read back” success. Form cleared after save. Fresh tests/build pass after final edits.
- Controlled restart: verified old PID/command and terminated its tsx parent; npm run dev new session 93756. API serves platform/usage/jobs changes. Check live handle/HTTP before restarting again.
- UI fixture script scripts/ui-platform-fixture.ts creates test-only account and operator platform role; do not run against staging/production. No actual user credentials in evidence.
- Next: support grants, tenant lifecycle, P1 security concurrency review, then P2 widget/inbox. H28 remains In progress; full P0–P6 goal active.

## Continuation — H28.03 scoped support metadata
- Migration 006, support.ts and Support.tsx: workspace Owner/Admin creates/revokes grant for existing active platform administrator, explicit operational_metadata scope/reason and 5–60 minute expiry (D010 local policy). Platform viewer gets workspace name/status and job counts only. No conversation content grant exists yet; unsupported scope rejected.
- Grant use verifies subject/expiry/revoke, sets tenant only after grant check and audits every allowed metadata read. Separate platform role does not change user's workspace session. UI controls create/list/revoke and metadata viewer; browser acceptance pending.
- 5 integration suites pass, build pass; restore 18 tables passes and revokes support grants. Evidence files updated. Tests cover wrong subject/tenant, unsupported content scope, revoke, expiry, platform role revoke, audit and default-deny RLS.
- Previous turn created authoritative source/schema/UI; current turn added real API test evidence and checkpoint/backlog. Goal active, not complete. H28.03 In progress.
- Runtime still needs controlled backend reload before browser support check. Next complete P1 tenant lifecycle and concurrency hardening, then P2 website channel/widget/inbox; provider keys/production untouched.

## Continuation — identity lock order and worker tenant state
- Reset/verify now lock user before consuming challenge, matching request-reset/resend lock order and serializing against login password verification/session creation. Prevents challenge/user lock inversion during concurrent reset/resend.
- Added real API reset-vs-login race assertion: after successful reset, any session obtained with old password is invalid. Worker refuses dispatch for missing/disabled workspace; test added.
- Complete 5-suite integration run and build pass after changes. This is source/test progress, not full P1 acceptance. Remaining P1 lifecycle UI/API, browser support acceptance, then P2 chat still outstanding.

## Continuation — workspace lifecycle
- D011 platform lookup exact workspace UUID (metadata only), enable/disable with reason and transactional platform audit. Disable removes workspace sessions, keeps business data. Re-enable requires new login. UI Lifecycle.tsx integrated into console with lookup/status/reason/readback.
- Platform test expanded: ordinary workspace role denied lifecycle, disable revokes session/blocks login, re-enable does not resurrect old session, fresh login sees preserved name. Complete 5 integration suites/build passed after change.
- H28.04 In progress; plan catalog/operational health and browser lifecycle acceptance still missing. In-flight side effects are not claimed cancellable. Full P0–P6 goal remains active. Next P1 remaining acceptance/concurrency, then P2.

## Continuation — atomic worker lifecycle gate
- Worker now checks/locks active workspace, recovers stale jobs and claims in one transaction. Eliminated gap between separate status read and job claim. Platform disable and worker claim serialize on workspace row.
- Added disable transaction vs worker test; worker sees disabled after committed lifecycle change. Complete integration suites/build pass. Claimed work preceding disable still not promised cancellable; adapter cancellation remains future work.
- Goal remains active; change is concrete source/test progress, not P1 acceptance. Next implement P2 channel/chat slice while retaining unfinished P1 acceptance gates explicitly.

## Continuation — P2 website channel backend
- D012 contract, migration 007 channels/channel_members applied. Owner/Admin create with active workspace members, exact website origin validation, server public key, transactional audit and request UUID idempotency. Agent listing limited to explicit channel membership; composite tenant FKs and FORCE RLS.
- tests/channels.test.ts proves persistence/retry conflict/cross-tenant member rejection/origin rejection/default-deny DB context. Full 6-suite tests/build pass, evidence p2-api-tests.txt/p2-build.txt.
- Backend slice only: channel wizard UI, SDK, visitor/session/inbox messages not yet implemented; H04 cannot be completed. No provider secret or HiChat token copied. Next channel wizard and real widget/inbox vertical slice. P1 outstanding gates retained; goal active.

## Continuation — website channel wizard UI
- Channels.tsx connected to real /api/channels and /api/members. Four-step Website selection/details/agents/result, server-generated persisted channel ID, duplicate retry key held through errors. Membership choices from active server data; Agent list-only. No fabricated SDK snippet or send success.
- Build passed. Browser create/reload and exact HiChat state comparison not yet run. SDK/widget/inbox next; H04 remains In progress. Full goal active.

## Continuation — chat persistence foundation
- D013 and migration 008: visitors/conversations/messages with tenant-composite FKs, sequence and client-ID uniqueness, public/internal visibility, ownership version and visitor receipt column.
- chat-store.ts append serializes on conversation, compares replay payload/author/visibility, rejects stale AI version and public agent reply without ownership. takeover compare-and-swap version. These are internal storage primitives, NOT authorized public endpoints; caller must enforce visitor/channel identity. No API exposed yet.
- Migration applied/build passed. Chat-specific runtime tests not yet added; do not claim Verified. Next add scoped widget session endpoints, message API/receipt and chat tests, then SDK/inbox UI. Full P0–P6 goal remains active.

## Continuation — chat persistence race tests
- Added tests/chat-store.test.ts with real PostgreSQL fixture: simultaneous retry yields one message/sequence, changed retry conflicts, two takeovers yield one winner, stale AI after takeover rejected, public agent requires ownership, internal note types validated, other tenant invisible. Stored reply has null visitor receipt (not delivered).
- Full 7-suite tests/build pass. Restore 23 tables passes; visitor sessions now expire during quarantine in addition to prior session/grant/job safeguards.
- Storage evidence only, not UI/visitor delivery. Next expose authenticated/scoped API then SDK/inbox. Goal remains active.

## Continuation — scoped inbox API
- inbox.ts list/cursor messages/takeover/send wired to authenticated API. Agent channel membership enforced; disabled channel blocked; tenant/author derived from session. Owner/Admin workspace-wide access.
- Chat test expanded: Agent without channel sees no list/read; explicit join permits cursor/read/send; removed membership blocks takeover. Seven full integration suites/build pass. Browser/API transport-specific inbox E2E and channel revoke race not yet verified.
- Next visitor token/bootstrap and public-only messages/receipt API, SDK and inbox UI. H03 still In progress; goal active.

## Continuation — inbox authorization transaction locks
- inbox access now acquires channel and Agent channel-membership share locks before message/read/takeover transaction. Revocation/deactivation serializes against authorized operations, replacing a single unlocked EXISTS check. Migration 009 grants column update privilege required for row share lock.
- Migration/full seven-suite tests/build pass. No new visitor API yet; next public bootstrap/session/message/receipt slice remains outstanding. Goal active.

## Continuation — real visitor API round trip
- widget.ts /widget-api endpoints: exact-origin bootstrap, bearer session, resume, public send/read/cursor, receipt. Migration 010 exact public-key routing policy. Separate from cookie workspace API; all actions validate domain/channel/workspace/session. No provider secret returned.
- tests/widget.test.ts real HTTP + PostgreSQL flow: visitor sends -> inbox reads -> agent takeover/reply -> visitor reads -> receipt readback. Tests retry one copy, internal note absent, receipt cannot touch note/other visitor, wrong origin/token and disabled channel denied.
- Full 8-suite tests/build passed. Evidence p2-api-tests.txt/p2-build.txt. This proves API flow, not browser widget/SDK parity or actual visitor rendering. Next SDK and Inbox UI E2E. HMAC/attachments/prechat remain later H05–07 work. Goal active.

## Continuation — connected Inbox UI
- Inbox.tsx /dashboard now connected to scoped API: list filters, selection, cursor message history, takeover, reply/note, draft per conversation, retry retains client ID/payload. Public reply displays saved vs visitor receipt separately; notes visually labeled.
- Build passes. Polling is interim; no browser E2E/parity acceptance yet. Potential polling/send race and long-history pagination need verification. SDK still missing. Full goal active; next implement SDK then browser roundtrip.

## Continuation — first functional SDK
- public/sdk.js implements gotekSDK.run websiteToken/baseUrl, singleton mount, shadow-root launcher/panel, session resume in per-origin/key localStorage, real API send/read/cursor and receipt after DOM render. User content inserted with textContent; no provider keys. Same client ID retained on failed send; close/focus and reconnect states.
- node --check and build pass. No browser SDK test yet; installation snippet API/UI next. Session-expired recovery intentionally returns explicit error currently (new-session action still needed). Polling interim transport. No widget parity acceptance. Goal active.

## 2026-09-24 – P2 installation handoff
- Added owner/admin-only `GET /api/channels/:id/installation`; tenant scoped, returns exact registered origin, opaque public key and SDK snippet using configured APP_ORIGIN (never request Host).
- Channels UI now exposes “Mã nhúng” with read-only snippet and origin warning; creation status no longer claims SDK unavailable.
- Validation: `npm run build` passes. Browser/live installation acceptance remains pending; no production deployment.
- Added channel installation API test (tenant scope, public-only snippet) and SDK expired-resume recovery: stale visitor token is cleared and a fresh visitor session is created after explicit expiry.
- Validation: `npm test` 9/9 suites, `node --check public/sdk.js`.

## 2026-09-24 – H05 assignment settings slice
- Migration 011 adds persisted channel assignment policy (`assignment_enabled`, bounded `assignment_limit`). Owner/Admin-only GET/PATCH settings endpoints validate, lock and audit updates; no round-robin behavior is claimed without HiChat evidence.
- Validation: migration applied to local PostgreSQL; `npm test` 10/10; `npm run build` passes. Full availability/capacity/distribution UI and browser acceptance remain open.

## 2026-09-24 – H06 hours/pre-chat data slice
- Migration 012 persists channel business-hours (timezone, weekday windows) and pre-chat field configuration. Owner/Admin settings API validates IANA timezone, unique weekdays, bounded HH:MM windows and field schema, then locks/audits update.
- Widget session now returns `available` and public pre-chat configuration based on server time; no unsupported holiday/DST policy is claimed.
- Validation: migration applied; `npm test` 10/10; `npm run build` and SDK syntax check pass. Settings UI/mobile browser acceptance remains open.
- Added a real H05/H06 configuration panel to Channels UI for assignment, timezone/business-hours toggle and pre-chat toggle; save maps server response fields to validated API contract. Full weekday editor and mobile visual acceptance remain pending.
- Widget SDK now honors server `available`: it shows an outside-hours message and disables sending; it announces configured pre-chat requirement. Session/API test verifies returned pre-chat fields and availability. Actual visitor field collection and full weekday editor remain open.

## 2026-09-24 – H06 visitor profile persistence
- Migration 013 adds RLS-scoped visitor `profile` JSONB. Widget session validates submitted profile keys/required fields against channel pre-chat config, rejects unknown/missing fields, stores profile transactionally, and returns it on session/resume. SDK accepts optional `config.profile` for the configured website.
- Validation: migration applied; `npm test` 10/10; `npm run build`; SDK syntax check. A visual pre-chat form/editor is still pending and is not claimed complete.

## 2026-09-24 – H06 real widget pre-chat form
- SDK now renders enabled pre-chat fields from the server schema, blocks chat until required fields are submitted, and posts the profile to `/widget-api/:key/profile`. New visitor sessions may bootstrap without profile; profile endpoint enforces required/allowed fields and persists under visitor RLS.
- Validation: `npm test` 10/10, `npm run build`, `node --check public/sdk.js`; widget test covers profile update and subsequent chat flow.

## Corrective audit – prechat/build (2026-09-24)
- Prior build-success statements for profile slices were incorrect: z.record used the obsolete one-argument signature. Fixed all three usages; current npm run build exited 0.
- Removed tenant-provided labels/placeholders interpolated as HTML; SDK creates DOM nodes and sets textContent/properties.
- Fixed bootstrap without config.profile, disabled-prechat composer lock, and textarea remaining locked after successful profile submission.
- Enforced required prechat server-side before message append; tests now prove direct API bypass denied, unknown fields rejected, profile save followed by chat succeeds.
- Removed unsupported outside-hours send prohibition; outside-hours message remains, accepting queued messages is provisional GoTek behavior pending parity decision.
- npm test: 10 tests passed, 0 failed. Browser acceptance remains pending. Channels configuration panel previously claimed implemented is absent from rendered JSX; do not claim complete H05/H06 UI.
- H07 migration 014 and API fields exist, widget settings optional to preserve existing PATCH clients. H07 UI/runtime application remains incomplete.

## Configuration UI connected – H06/H07
- Added ChannelConfiguration component and verified its JSX is mounted from Channels after settings fetch. Includes enabled/full-day/start/end per seven weekdays, timezone, three prechat field toggles/required/labels/placeholders, message, launcher title/position/mode; submits validated API payload and reads saved data back.
- SDK applies persisted title, left/right positioning and standard/expanded width on session connect. No HiChat parity acceptance claimed.
- Build exited 0; SDK syntax check exited 0; npm test exited 0 (10 tests), saved in delivery/evidence/p2-current-tests.txt. Added widget settings persistence/readback assertions.
- Remaining: browser interaction/visual acceptance; settings conflict control; full assignment implementation; runtime hours boundaries; H07 preview/upload/remaining toggles and identity signatures. Scope P0–P6/H01–H32/E01–E12 remains open.

## H06 deterministic hours correction
- Extracted business-hours evaluator; fixed end boundary (exclusive) and overnight carry into next weekday/week rollover.
- Provisional GoTek semantics, not verified HiChat parity: schedule follows IANA local wall clock; start inclusive/end exclusive; same start/end is empty (use fullDay for 24h); repeated DST hour matches twice, spring gap has no invented instant. Holiday exceptions remain absent.
- Added 3 deterministic tests covering boundaries, disabled/full-day, overnight/week rollover, spring/fall DST. Build exited 0; all 13 tests passed (delivery/evidence/p2-current-tests.txt).

## H07 configuration preview
- WidgetPreview now mounted inside channel configuration. Uses draft launcher title, left/right alignment and standard/expanded width; toggles open/closed without saving or sending messages.
- Explicit sample-message/unsaved-draft label prevents presenting preview as real chat evidence. Responsive max-width prevents expanded preview exceeding its container.
- npm run build exited 0. No browser/visual parity acceptance claimed; sample preview is not SDK E2E verification.

## H06 validation hardening
- Channel settings now reject duplicate pre-chat keys and disabled-required fields; API error catalog includes actionable Vietnamese messages for channel, hours, pre-chat and email validation errors.
- Build and all tests pass after correcting a malformed test edit; current evidence is delivery/evidence/p2-current-tests.txt. Browser acceptance and full scope remain open.

## H05 channel agent membership
- Added tenant-scoped GET/PUT channel-agent APIs. Updates require Owner/Admin, only active workspace memberships are accepted, at least one agent is required, replacement is transactional and audited.
- Added API test for list, idempotent same-agent replacement and empty-agent rejection. Build and 14 tests pass. Auto-assignment algorithm, availability/capacity and browser UI remain pending because HiChat evidence is incomplete.

## H05 agent UI wiring
- ChannelConfiguration now loads active workspace members and current channel agents, renders checkbox selection, rejects empty selection client-side, saves agents via PUT before settings PATCH, and reports errors.
- Build and 14 tests pass. Browser acceptance, concurrent edit conflict and auto-assignment behavior remain open.

## H03 resolve/reopen
- Added PATCH `/api/conversations/:id/status` with access check, allowed open/resolved/snoozed states, updated timestamp and audit. Inbox UI exposes Giải quyết/Mở lại.
- Build passes. API status transition test is next; no realtime or HiChat parity claim yet.
- Added H03 status integration test: resolve → reopen, audit action readback, and cross-tenant 404. Current test count: 15/15 passed.

## H03 inbox search/filter
- Inbox API now accepts validated `search` (channel name) and `status` (`open|resolved|snoozed`) query filters under existing tenant/channel access scope. UI adds search and status controls while retaining assignment filters.
- Build and 15 tests pass; API search-specific fixture and browser acceptance remain open.
- Added H03 Inbox query fixture: search returns no unrelated conversations; status=resolved/open reflects transition in the same tenant. Current test count 16/16.
- Inbox UI now exposes Tạm hoãn/Mở lại for the existing `snoozed` status API. Build and 16 tests pass; scheduling/reminder semantics and browser acceptance remain open.

## H04 channel state control
- Added Owner/Admin PATCH `/api/channels/:id/state`; row lock, tenant scope, audit and UI Bật/Tắt kênh. Disabled channels stop widget bootstrap and Inbox visibility through existing channel checks.
- Added enable/disable API test; build and 17 tests pass. Browser acceptance and finer lifecycle policy remain open.

## P2 verification snapshot
- Current repository verification: build passes and 17/17 tests pass. Backlog status audit confirms H03/H04/H05/H06/H07 remain In progress/Backlog as appropriate; no P2 item was incorrectly marked Accepted.
- Remaining acceptance gaps are explicit: browser E2E/mobile screenshots, HiChat visual parity, realtime/pagination, auto-assignment policy, provider/identity signature decisions and production-like staging.
- H03.04 Inbox drafts now persist per user in browser localStorage, restore on reload, and are removed only after successful send. Drafts are not transmitted until explicit send; build and 17 tests pass. Browser UX/reload evidence remains pending.
- Runtime UI recheck 2026-09-24: local preview at 127.0.0.1:4317/dashboard reloads successfully with authenticated Owner fixture; Inbox visibly exposes Tìm kiếm, Trạng thái (Mở/Đã giải quyết/Tạm hoãn) and assignment filters. This is local runtime evidence only, not staging acceptance.

## P3 provider gate
- Added explicit P3 decision record. Real AI/provider work remains gated on approved credential and provider/model/policy decisions; no secrets or fake provider responses are introduced. H08–H12 are not marked complete.

## Restore regression check
- After migrations 011–014 and P2 changes, isolated `npm run db:restore-drill` passed: 23 tables, 615ms. Build and 17 tests also pass. This validates backup/restore structure only; it does not prove browser or production acceptance.

## 2026-09-24 — H05 cấu hình kênh: tách thao tác lưu
- Implemented: `src/web/ChannelConfiguration.tsx` tách lưu cộng tác viên (`PUT /channels/:id/agents`) và lưu cấu hình (`PATCH /channels/:id/settings`), mỗi phần có trạng thái đọc lại riêng; thêm điều khiển assignment enabled/limit; khi tắt trường pre-chat tự hạ `required=false` để không gửi payload mâu thuẫn.
- Verification: `npm run build` PASS (`tsc --noEmit` + Vite). Preview local `http://127.0.0.1:4317/settings/inboxes` đang mở; workspace Owner hiện chưa có hộp thư nên chưa thể thao tác form cấu hình trên dữ liệu thật.
- Acceptance: Implemented, chưa Accepted; cần tạo/kết nối một kênh test và kiểm tra lưu thành công/lỗi/quyền bằng UI.

## 2026-09-24 — H05 auto-assignment core
- Implemented: widget session creation now assigns the new conversation to the active channel member with the fewest open conversations; `assignment_limit` is enforced, and no eligible member leaves the conversation unassigned for manual Inbox handling. Tenant/workspace scope remains in SQL.
- Verification: added assertion to `tests/widget.test.ts` for real visitor session → assigned member; `npm test` PASS 17/17; `npm run build` PASS.
- Acceptance: Implemented and test-verified; browser acceptance with a real configured test channel remains pending.

## 2026-09-24 — Evidence hygiene
- Repaired `delivery/evidence/p1-restore-drill.json`: removed an invalid concatenated second JSON object and preserved its summary as `verification_summary` inside the primary record.
- Verification: `json.loads` PASS. Restore evidence still explicitly limits scope to PostgreSQL; object storage/vector index and production RPO/RTO remain incomplete.

## 2026-09-24 — H03 status update locking
- Implemented: `inboxSetStatus` now locks the conversation row after authorization and reads `previousStatus` inside the same transaction immediately before update. Concurrent status changes cannot report a stale previous state.
- Verification: `npm run build` PASS; `npm test` PASS 17/17.
- Acceptance: Implemented and test-verified; a two-browser concurrent UI race remains a staging acceptance case.

## 2026-09-24 — H04/H07 SDK session expiry reset
- Implemented: `public/sdk.js` clears the expired visitor token and resets cursor, seen IDs, receipts, pending send, rendered messages and pre-chat UI before creating a fresh session.
- Verification: `node --check public/sdk.js` PASS; `npm run build` PASS.
- Acceptance: Implemented; browser expiry/reconnect and reload receipt behavior remain staging acceptance cases.

## 2026-09-24 — H03.04 draft hydration
- Implemented: Inbox draft persistence now validates the stored object and waits for localStorage hydration before writing, preventing an initial empty state from overwriting drafts on reload.
- Verification: `npm run build` PASS; `npm test` PASS 17/17.
- Acceptance: Implemented; browser reload/restore of a draft remains a staging UI case.

## 2026-09-24 — Backlog synchronization
- Updated only evidence-backed tickets: H03.04, H04.05, H05.03 and H05.05 → `Implemented`.
- Their gaps remain explicit: browser/staging acceptance is still open; no ticket was marked Verified or Accepted.
- CSV parse verification: all rows remain readable with the original header schema.

## 2026-09-24 — H05 removed-agent assignment release
- Implemented: updating channel agents now finds removed members, clears their assignments on open conversations in the same transaction, and records `channel.assignments.released` plus the membership audit.
- Verification: `npm run build` PASS; `npm test` PASS 17/17 (existing regression suite; dedicated removed-agent fixture still needed).
- Acceptance: Implemented, not Verified for the removed-agent scenario.

## 2026-09-24 — H05 evidence follow-up
- Dedicated removed-agent fixture was reviewed but not added in this slice because the current test helper has no second membership/invitation fixture; behavior remains covered by implementation and full regression build/test only.
- No status was promoted to Verified or Accepted on this basis.

## 2026-09-24 — H05.04 removed-agent fixture verified
- Added a local invitation/membership fixture and API test: assigned owner creates a visitor conversation, owner is removed from channel agents, assignment becomes null, and `channel.assignments.released` is audited.
- Verification: `npm test` PASS 18/18; `npm run build` PASS.
- Backlog H05.04 promoted to Implemented; browser/staging acceptance remains open.

## 2026-09-24 — H02.03 workspace switch verification
- Reviewed `src/web/main.tsx`: workspace switch clears `me`, refreshes identity, navigates to General, and remounts the content subtree with `key={workspaceId+path}`; old workspace view state is discarded before new data loads.
- Existing `tests/identity.test.ts` covers allowed switch and cross-tenant denial; no source change was needed in this slice.
- Browser two-workspace cache acceptance remains pending.

## H03.01 — server assignment filters and retained UI filters
- API filters mine/unassigned before LIMIT 100, using authenticated actor and existing tenant/channel permission predicates.
- Inbox polling and refresh after takeover/status use the same filtered URL.
- Removed-agent fixture now explicitly takes ownership before removal; previous assertion depended on random UUID sort order and was flaky.
- Tests assert mine/unassigned before and after removal, invalid filter 400, and no leakage into the second account's original workspace.
- npm test: 18 passed, raw output delivery/evidence/h03-assignment-filter-tests.txt. npm run build: PASS.
- H03.01 remains In progress: pagination, full sidebar/labels and browser parity pending. This is not full H03 acceptance.

## H05 — concurrent bootstrap capacity
- Added per-channel transaction advisory lock before counting open assignments; parallel widget sessions use committed capacity decisions.
- New API regression: 20 concurrent sessions with limit 1 give exactly 1 assigned/19 unassigned; resolving frees one slot; disabling auto assignment leaves new sessions unassigned.
- Full tests 19/19 PASS (h05-capacity-tests.txt). Initial build detected test helper typing error; fixed unknown -> object and build PASS (h05-capacity-build.txt).
- H05.03/H05.04 returned to In progress: full requirements and commit gate are not met. Offline presence, reopened/manual assignment capacity policy, browser acceptance remain open.
- Runtime backend not restarted in this slice; verification uses createApp in test process.

## H05 — removed Agent permissions and ownership fencing
- Open assigned conversations now release to HANDOFF_PENDING and increment owner_version when channel membership removes their assignee.
- Missing channel agents update returns CHANNEL_NOT_FOUND (404), rather than proceeding to an FK failure.
- Existing two-member API fixture extended: Agent switches workspace, takes ownership, cannot administer membership; after Owner removes Agent, list hides conversation and reads/public sends return 404. Owner readback confirms null assignee and incremented ownership version.
- Targeted test PASS; full regression 19/19 PASS; build PASS. Raw evidence h05-revoke-{permissions,regression,build}.txt.
- Still In progress; browser, closed/snoozed release lifecycle and HiChat parity remain open. Backend preview not restarted by this test run.

## H06 — changed prechat schema with existing visitors
- Regression reproduced 400 instead of 200 when previously collected fullName was removed from channel schema (h06-profile-schema-before.txt).
- Message validation projects stored profile onto currently enabled keys; skips prechat requirements when form disabled. Does not delete stored historical profile.
- New profile writes still reject unknown/disabled keys. Newly required phone still blocks messages with PRECHAT_REQUIRED.
- UI field disable now actually clears required on that field; earlier checkpoint claim was premature (previous code only cleared it when toggling whole form).
- Full tests 19/19 PASS; build PASS, raw logs h06-profile-schema-{tests,build}.txt.
- Browser config-change state refresh, optional prechat UI and parity remain open; no acceptance promotion.

## H02.03/H03.04 — workspace-scoped drafts
- Inbox now receives workspaceId and uses v2 user+workspace storage keys. Old user-only keys retained but intentionally not imported because their workspace cannot be established safely.
- Hydration uses a loaded key rather than boolean: a scope change cannot save previous drafts into the new key; missing/corrupt storage initializes empty.
- Parser accepts UUID conversation keys and strings up to composer limit; rejects objects/arrays/invalid JSON without rendering them as text.
- Tests for workspace/user separation, Vietnamese multiline preservation and malformed entries added. Full suite 21/21 PASS; build PASS, evidence h03-scoped-drafts-{tests,build}.txt.
- These tests cover storage helpers, not React browser lifecycle. Browser switch/reload and pending-send persistence remain open; no acceptance promotion.

## H03.04 — pending send persistence
- Persists clientId/body/visibility under user+workspace pending key before dispatch. Storage failure prevents first POST and leaves retryable payload.
- Restores pending body and internal/public mode on reload; retry retains same idempotency identity. Removes persisted payload only after acknowledged POST.
- If cleanup storage write fails, pending identity remains for a safe retry. Multi-tab coordination/retention policy still pending.
- Parser round-trip and invalid-payload tests added. Build PASS; suite 22/22 PASS (h03-pending-{build,tests}.txt).
- Browser network-loss/reload flow not yet proven; tests exercise serialization and existing backend idempotency, not complete UI lifecycle.

## H03.04 — retry after ownership transfer
- UI permits retry of an immutable pending payload even when another agent owns replies, allowing reconciliation of an already committed send; server still checks channel access.
- Extended real PostgreSQL scoped-service test: transfer ownership, retry prior message returns same ID; new message fails TAKEOVER_REQUIRED; altered retry fails IDEMPOTENCY_CONFLICT; message count remains 4. Removing membership denies even an old retry.
- Targeted chat-store test PASS; build PASS (h03-retry-owner-{tests,build}.txt). No claim of new full-suite run or browser verification.
- New sending rights unchanged. If pending send was never committed, new owner check correctly rejects it; UI still needs explicit recovery for that case.


## H03 — reference-based UI correction
- Inspected actual HiChat inbox-empty.png (not generated module diagram).
- Replaced assignment dropdown with horizontal functional filter buttons in source order; moved title under search; centered no-selection detail.
- Build PASS: h03-filter-layout-build.txt. Browser rendering comparison not yet performed.
- Full HiChat visual parity still open: theme, sidebar, banner position, icons, exact dimensions and populated states.

## 2026-09-24 — H09 partial implementation cross-reference
Detailed current state and evidence are in `delivery/CHECKPOINT-LOCAL-BLOCKER.md` and `delivery/evidence/h09-browser-preview-2026-09-24.txt`. H09 remains In progress/Backlog-level acceptance: CRUD/list/toggle, role gate, API error parsing, CAS versioning and local browser preview are implemented; edit, checkbox selection, XLSX/CSV import/export, idempotency, cross-tenant live tests, runtime AI effects and HiChat screen contract remain open. `delivery/NEXT_STEPS.md` is absent; use the referenced Skill Dev Kit copy only as fallback and record this source gap.

## 2026-09-27 — Platform Agent lease recovery and stale completion fence
- Added migration `050_platform_agent_pending_recovery.sql` with `lease_expires_at` and `dispatched_at` markers.
- Platform Agent now persists dispatch intent before provider I/O, recovers expired claims in a bounded actor-scoped transaction, marks the user turn and request `unknown`, releases the session fence, and never automatically resends an uncertain provider request. Completion checks token/status/lease and discards late provider output.
- Added gated integration coverage: replay while provider is suspended returns `AGENT_REQUEST_EXPIRED`, a new request can proceed, expired prompt is excluded from later history, late answer is not stored, and replay remains durable.
- Applied migrations 050 and 051 locally. Targeted platform + quota tests: 3/3 PASS; TypeScript PASS.
- This verifies local PostgreSQL recovery behavior only. Multiprocess process-level execution, provider receipts for Gemini/OpenAI/Anthropic/custom LLM, quota expiry/error settlement, and staging acceptance remain open.

## 2026-09-27 — AI worker quota failure and lexical history correction
- Transactional AI worker now settles a reserved quota operation to `unknown` when provider invocation fails before rethrowing; it rechecks the job lease in that settlement transaction.
- Lexical knowledge retrieval now receives the same bounded visitor/agent/AI history used by semantic retrieval, so follow-up context is consistent across retrieval paths.
- Targeted AI worker + Platform Agent tests: **4/4 PASS**; TypeScript PASS. Full regression and real provider receipts remain pending.

## 2026-09-27 — Recovered interrupted quota/provider branches
- Inspected saved edits after agents stopped; provider agent reported usage-limit failure. No agents remain live.
- AI response budgets now reject new reservations when a provisioned period is expired/future; never-provisioned legacy workspaces still bypass budgeting. Automatic renewal and cross-period retry reconciliation remain open.
- HTTP provider probe snapshots configuration in a short transaction, invokes outside it, then authenticates/logs in a new transaction. Added HTTP fixture assertion that pool has no checked-out client during provider call.
- Targeted quota/probe/platform/H09 tests 6/6 PASS. Full parallel run previously ended 134/135 with H09 ECONNRESET; earlier statement that it had completed without a TAP summary was premature. Failure cause remains unverified.
- Configured serial npm test completed successfully; raw evidence: delivery/evidence/core-followup-full-2026-09-27.txt. No provider-live or HiChat parity acceptance claimed.

## 2026-09-27 — Cross-period AI quota replay
- reserveAiResponse now serializes operation identity and resolves an existing operation to its original budget before selecting a current budget. Expiry/renewal no longer changes the accounting identity of a retry.
- PostgreSQL test covers unknown receipt replay after expiry, rejection of new work without active budget, renewal, concurrent duplicate replay and a separate new-period reservation. Quota tests 3/3 PASS; TypeScript PASS. Evidence: delivery/evidence/quota-renewal-retry-2026-09-27.txt.
- Critical next gap from independent review: quota state is not a provider dispatch fence. Widget ai.reply jobs have external_effect=false; stale lease recovery can retry after a provider call. Worker ignores existing reservation state. Need durable dispatch marker, expired-dispatched unknown recovery and regression proving no duplicate call. Do not claim exactly-once inference from quota idempotency.

## Durable widget dispatch integration repair
- Applied migrations052/053: tenant-scoped ai_reply_dispatches stores unknown before scheduler inference, confirmed with published reply.
- Fixed initial agent implementation: restored lease check before publishing late results; final lease/owner validation now shares the claim transaction; post-invoke commit errors settle quota unknown.
- Preserved existing expired-output rejection assertion and added actual transactional handler retry asserting AI_DISPATCH_UNKNOWN with zero duplicate provider calls. Later independent failure cases now use fresh source messages.
- Scheduler-only tests in ai-dispatch-fence.test.ts do not prove the new table behavior; direct retry proof is in ai-reply-worker.test.ts.
- Remaining: true multiprocess/crash test, concurrent distinct jobs same source, pre-dispatch quota release; legacy caller-transaction aiReplyHandler has no durable fence on rollback. Core acceptance remains open.

## 2026-09-27 — AI quota reservation moved behind dispatch validation
- Transactional worker no longer reserves quota during initial context preparation. It validates lease/owner/knowledge, claims the durable dispatch fence, then reserves quota in the same claim transaction before provider I/O.
- Validation/grounding/model failures now leave no `reserved` operation. Existing dispatch unknown still blocks replay before quota/provider work.
- Targeted AI worker + quota tests: **5/5 PASS**; TypeScript PASS. Remaining: explicit test for every pre-dispatch failure and true multiprocess crash recovery.

## 2026-09-27 — Dispatch fence + quota timing verification
- Kept legacy `aiReplyHandler` compatibility path free of the scheduler dispatch table; transactional worker alone owns `ai_reply_dispatches`, avoiding false failures in non-scheduler unit adapters.
- Added `dispatchClaimed` state so assistant commits confirm only a durable scheduler claim. Pre-dispatch validation does not create quota reservations; provider failure/late lease settles quota unknown.
- Targeted context, worker, and dispatch fence tests: **5/5 PASS**; TypeScript PASS. Full regression rerun had one stale test expectation before this compatibility fix; rerun targeted suite is green.

## 2026-09-27 — Verified full regression and quota edge assertions
- Recovered completed regression evidence: core-final-regression-2026-09-27.txt ends with 139/139 PASS. This is local/test evidence, not core acceptance.
- Previous delegated edge-test file was never saved; added assertions directly to real PostgreSQL worker integration fixture instead.
- Grounding failure now explicitly proves usage_operations count unchanged. After ownership/lease failure following provider dispatch, joined dispatch/usage records explicitly prove unknown quota state. Targeted worker test 2/2 PASS, evidence dispatch-quota-edges-2026-09-27.txt.
- Remaining acceptance: process crash/restart, distinct jobs same source racing, live providers, full H/E scope and staging.

## 2026-09-27 — Dispatch authorization window closed
- Revalidated public knowledge versions and AI rule snapshot inside the same transaction that checks lease/owner and claims `ai_reply_dispatches`; revocation between validation and provider dispatch is now blocked before network I/O.
- Quota unknown settlement uses an independent scoped transaction after inference/commit failure, avoiding dependence on the original worker transaction.
- Targeted worker + dispatch tests: **4/4 PASS**; TypeScript PASS. Distinct job IDs sharing one source and process crash/restart remain separate acceptance gaps.

## 2026-09-27 — Core regression after dispatch authorization hardening
- Full configured serial regression: **139/139 PASS** (`delivery/evidence/core-final-regression-2-2026-09-27.txt`); TypeScript PASS.
- Distinct job IDs sharing one source remain an explicit unverified concurrency gap; the delegated test branch did not produce a file, so no acceptance claim is made.

## 2026-09-27 — Dispatch fence scope closed for implementation
- The durable dispatch fence, pre-dispatch quota timing, and authorization-window fixes are implemented and covered by the 139/139 serial regression plus targeted edge tests.
- Distinct job IDs sharing one source and process crash/restart are retained as explicit acceptance tests; they are not treated as an unresolved implementation loop. Work proceeds to the next core gap (H11 web ingestion audit).

## H11 bounded transient web retry
- SOURCE_TIMEOUT/SOURCE_FETCH_FAILED in read-only web.refresh now use bounded job retries/backoff and dead at max_attempts; other ambiguous handlers retain unknown behavior.
- PostgreSQL integration proves five timeout attempts, no snapshot on failure, delayed retry not immediately claimed, terminal dead. TypeScript PASS; H11 targeted test 1/1 PASS (delivery/evidence/h11-bounded-retry.txt).
- H11 remains incomplete: bounded crawl, scheduling and full import/publish acceptance pending. Audit agent hit usage limit; implementation completed by main.

## H11 retry recovery proof
- Added real PostgreSQL regression for transient SOURCE_FETCH_FAILED followed by success: same job reaches attempt2, clears error_code, stores receipt and exactly one snapshot. Existing max-attempt/backoff/tenant/lease checks retained.
- Targeted web-refresh test PASS; evidence delivery/evidence/h11-retry-recovery.txt. Crawl traversal and scheduling remain implementation gaps.

## H11 bounded URL crawl implemented
- URL refresh now traverses static HTML links breadth-first within the same origin. Enforces maxPages/maxDepth/delay, total byte budget and 25-second deadline; each fetch retains pinned-DNS/redirect security. Page failure rejects the refresh rather than storing partial success. Each item records its final page URL.
- Tests prove link/depth/page bounds, fragment deduplication, external link exclusion and aggregate overflow, plus existing PostgreSQL snapshot worker regression. Targeted 3/3 PASS; implementation agent TypeScript PASS. Evidence delivery/evidence/h11-crawl.txt.
- Limits: no JavaScript rendering or base-tag handling; sitemap remains a manifest; periodic scheduler and full source-version refresh acceptance still pending. This is GoTek implementation policy, not proof of HiChat internal crawler behavior.

## H11 sitemap traversal
- Implemented sitemapindex/urlset traversal with same-origin secure fetch, shared request/byte/time/depth budgets and URL provenance. Worker now stores parsed page content as URL snapshot items so existing draft import can consume them; no pages => error.
- Parallel ownership: agent web-sitemap-crawl.ts; main worker wiring and tests. TypeScript PASS; sitemap/worker/snapshot-import suites 3/3 PASS (delivery/evidence/h11-sitemap-crawl.txt). Covers nested sitemap and PostgreSQL snapshot content, not full browser parity.
- Scheduling, JS rendering, source refresh to existing knowledge and acceptance still pending. Request limits count manifests too (GoTek policy).

## H11 opt-in periodic refresh backend
- Migration054 adds nullable interval (5..10080 min), next due and schedule CAS version. Owner/Admin GET/PATCH schedule APIs wired; default disabled. CLI enqueues due sources per tenant before worker iteration, with source row locks, bounded100 batch, deterministic due-time identity and maxAttempts3.
- Concurrent scheduler PostgreSQL test proves one job, Agent denial, stale version rejection and disable; 1/1 PASS. TypeScript PASS. Evidence delivery/evidence/h11-schedule.txt.
- Prior delegated scheduler agent was no longer live and had saved no files; main implemented. HTTP/browser acceptance, long-running scheduler operations and full H11 acceptance remain open. Production guard unchanged.

## H11 schedule HTTP and CLI verification
- Added HTTP schedule read/write/readback, cross-tenant and anonymous denial, interval bounds, CAS conflict, disable and audit-count assertions to existing source API test. Schedule/API/CLI suites 4/4 PASS (h11-schedule-http.txt).
- Independent review found --once reported exit0 for failed returned outcomes. Fixed non-success/non-idle exit1; child-process test injects malformed web job, verifies unknown output and exit1. CLI suites 2/2 PASS; TypeScript PASS (h11-cli-exit.txt).
- UI remains deferred; long-running operational acceptance and full H11 parity remain open.

## H11 schedule state safety
- Scheduler regression now covers paused source and disabled workspace: no due job is created. Existing concurrent due claim/CAS/tenant tests remain green (1/1).
- No automatic cleanup of previously queued refresh jobs is performed; worker source/status check preserves existing snapshot and marks the job outcome unknown/paused. This is an explicit operational policy gap for later retention/cleanup, not silently treated as success.

## H11 pending schedule guard evidence
- Direct PG assertions now force source due while existing job is queued/retry/running: no extra job and due timestamp unchanged. Dead job allows next schedule. Disabled workspace is now tested while schedule actually due/enabled (previous disabled test had disabled schedule, weak evidence).
- Test 1/1 PASS: delivery/evidence/h11-schedule-guard-states.txt. Prior 143/143 full regression predates this extra assertion.
- Parallel read-only audit identified next real gap: document-group/generation schema and publish/rollback exist, but production does not create web_source_document_groups; snapshot import still creates independent drafts. Next slice must connect source URL identity to document group and generation staging, preserving published parent until explicit publish.

## H11 generation publication metadata hardening
- Generation publish now stamps `knowledge_versions.first_published_at` once and `knowledge_items.published_at/published_by` for UPSERT parts, aligning web-generation lifecycle metadata with normal knowledge publish.
- Runtime generation test extended to assert timestamps/actor; 1/1 PASS (delivery/evidence/h11-generation-metadata.txt). Snapshot→document-group→generation orchestration remains next implementation slice; current API still requires group/parts prepared by caller.

## H11 snapshot-to-generation bridge
- Added `POST /api/web-sources/:id/snapshots/:snapshotId/generation-draft`. It derives a stable page group key from snapshot URL, imports the snapshot item as a draft, and creates a tenant-scoped UPSERT generation under advisory lock. Existing published generation remains untouched until explicit publish.
- TypeScript PASS. This initial bridge covers one snapshot item per request; multi-item RETIRE manifest, HTTP integration and idempotency receipt tests remain pending. It is not yet full refresh-to-existing-item acceptance.

## 2026-09-27 — core regression after H11 generation bridge
- `npx tsc --noEmit && npm test` passed: 143/143 tests, 0 failed. Evidence: `delivery/evidence/core-after-generation-2026-09-27.txt`.
- This validates the current backend baseline after snapshot-to-generation bridge and generation publication metadata changes; it does not mean H11 or the whole product is complete.

## 2026-09-27 — H11 generation-draft HTTP evidence
- Added HTTP coverage for snapshot-to-generation draft: tenant isolation, authentication, generation response, and same-request replay.
- Targeted result: 1/1 pass. Evidence: `delivery/evidence/h11-generation-http-2026-09-27.txt`.
- The bridge remains a single-item draft path; multi-item RETIRE manifest and publish acceptance are still pending.

## 2026-09-27 — full regression after generation-draft HTTP slice
- `npx tsc --noEmit && npm test` passed: 143/143 tests, 0 failed. Evidence: `delivery/evidence/core-after-h11-generation-http-2026-09-27.txt`.

## 2026-09-27 — H11 multipart generation bridge closed at backend verification
- Added HTTP integration coverage in `tests/web-generation-bridge.test.ts`: >5,000-character source splits to multiple UPSERT parts, real knowledge processing/publish, shorter refresh emits RETIRE parts, and superseded items become inactive.
- Targeted result: 1/1 pass. Full regression after this slice: 144/144 pass, TypeScript pass. Evidence: `delivery/evidence/h11-generation-bridge-multipart-2026-09-27.txt`, `delivery/evidence/core-final-h11-multipart-2026-09-27.txt`.
- H11 remains Implemented/Verified for this backend slice; browser parity, JS rendering and broader source-provider acceptance remain open and are not marked Accepted.

## 2026-09-27 — distinct scheduler jobs dispatch fence proof
- Added isolated PostgreSQL integration test for two different job IDs targeting the same conversation/message. One provider invocation remains in flight; the second worker returns `AI_DISPATCH_UNKNOWN`, provider calls remain 1, and only one assistant message is committed.
- Targeted result: 1/1 pass; TypeScript pass. Evidence: `delivery/evidence/ai-dispatch-distinct-jobs-2026-09-27.txt`.
- This closes the distinct-job same-source regression gap locally. Crash/restart and live-provider receipt acceptance remain separate gates.

## 2026-09-27 — core regression after distinct dispatch proof
- `npx tsc --noEmit && npm test` passed: 147/147 tests, 0 failed. Evidence: `delivery/evidence/core-after-dispatch-distinct-2026-09-27.txt`.
- Core backend remains in progress; live provider receipts, crash/restart acceptance, and remaining H/E modules are not complete.

## Provider receipt recovery and malformed response handling
- Correction: the interrupted provider agent did save `tests/provider-receipt-contract.test.ts`; it was included in the preceding 147-test run. The prior statement that it produced no result was inaccurate.
- Re-ran adapter fixtures and added malformed JSON coverage. Transport now rejects null/scalar/array envelopes and invalid Gemini/Anthropic collection shapes with PROVIDER_INVALID_RESPONSE rather than leaking parser exceptions.
- TypeScript and targeted 3/3 tests PASS (`delivery/evidence/provider-receipt-contract-verified.txt`). Injected responses prove adapter parsing only, not live provider API acceptance.

## AI worker process crash/restart proof
- Real child process is SIGKILLed during injected provider callback after durable dispatch claim. A new child recovers/retries the expired job without invoking provider again; unknown outcome is retained and no assistant message is created.
- Targeted 1/1 PASS; evidence `delivery/evidence/ai-crash-recovery-verified.txt`. Lease expiry advanced in test DB; this is process-level local proof with injected provider, not an external receipt test.

## 2026-09-27 — H22 audit keyset pagination
- Added tenant-scoped Owner/Admin audit pagination at `GET /api/audit?limit=&before=` while preserving the existing array response shape. Keyset order is `created_at DESC, id DESC`, with strict bounds and tenant-scoped cursor checks.
- PostgreSQL targeted test: 1/1 pass, including 105 tied timestamps, role/tenant isolation and validation. TypeScript pass. Evidence: `delivery/evidence/h22-audit-pagination-2026-09-27.txt`.
- Full serial regression after route/service integration: 150/150 pass. Evidence: `delivery/evidence/core-after-audit-pagination-2026-09-27.txt`.
- H22 export, retention and browser acceptance remain open.

## 2026-09-27 — H22 audit export
- Added and wired `GET /api/audit/export` as bounded tenant-scoped NDJSON export. Owner/Admin only, limit 1..1000, keyset `before` cursor and foreign cursor rejection.
- Targeted PostgreSQL export test: 1/1 pass; TypeScript pass. Full serial regression after route integration: 151/151 pass. Evidence: `delivery/evidence/h22-audit-export-2026-09-27.txt`, `delivery/evidence/core-after-audit-export-2026-09-27.txt`.
- Backup/restore remains a documented gap: no production restore service/format/checksum/atomic API exists yet, so no fake drill was added.

## Restore evidence correction and current schema drill
- Prior backup audit omitted `scripts/restore-drill.ts`. A pg_dump/pg_restore operational drill already exists; absence of a product restore API does not mean backup/restore is absent.
- Added private SHA-256 sidecar and checksum verification before restore. Ran `npm run db:restore-drill`: PASS, 55 tables, 1843ms. Count equality, policy equality, fail-closed workspace RLS and quarantine are checked; disposable target dropped.
- Evidence: `delivery/evidence/p1-restore-drill.json`. Counts/policy names are not full content-integrity or production RPO/RTO proof; external storage and complete quarantine acceptance remain open.

## Audit export HTTP verification
- Export route returns a JSON envelope `{contentType,body,count,nextCursor}` whose body is NDJSON; it is not a raw NDJSON download response. Earlier shorthand export description is clarified here.
- Real signup/login HTTP test covers two-page ordering, foreign/missing cursor, validation, anonymous and live Agent-role denial. 1/1 PASS: `delivery/evidence/h22-audit-export-http.txt`.

## Restore content and AI quarantine hardening
- Restore drill now hashes canonical JSON rows for all 55 tables before/after `pg_restore`; count-only equality is no longer the sole integrity check.
- Restored pending Platform Agent requests are marked `unknown` with `RESTORE_QUARANTINED`, matching user messages become unknown, reserved usage operations become unknown, and existing AI dispatch fences are preserved. Providers/model grants/support/session delivery state remain quarantined.
- `npm run db:restore-drill` PASS (55 tables, 3127ms); TypeScript PASS. Evidence remains `delivery/evidence/p1-restore-drill.json`.

## 2026-09-27 — restore quarantine assertions completed
- Added restored-database assertions: no pending platform-agent claims, no reserved usage operations, and no queued/running/retry/unknown jobs remain after quarantine.
- Report now explicitly records platform request/message quarantine, quota reservation quarantine and preserved AI dispatch fences.
- `npm run db:restore-drill` PASS (55 tables, content hashes, 8621ms); TypeScript PASS.

## 2026-09-27 — current core regression after restore hardening
- Full configured serial regression: **152/152 PASS**, 0 failures/cancellations. Evidence: `delivery/evidence/core-current-2026-09-27.txt`.
- TypeScript and `npm run db:restore-drill` also pass. Core remains Implemented/Verified in slices; full H/E acceptance, live provider receipts, browser parity and production gates remain open.

## 2026-09-27 — build gate after restore/core changes
- `npm run build` passed: TypeScript plus Vite production bundle, 1917 modules. Evidence: `delivery/evidence/build-current-2026-09-27.txt`.
- This is a build gate only; it does not close browser parity or production acceptance.

## 2026-09-27 — AI quota pre-dispatch failure matrix
- Added PostgreSQL matrix covering missing model, stale owner, grounded-source validation and revoked-source paths. Each path proves provider invocation count remains zero and no quota reservation/unknown dispatch is created; worker may return succeeded or unknown according to durable job outcome.
- Targeted result: 4/4 pass; TypeScript pass. Full serial regression: **156/156 pass**. Evidence: `delivery/evidence/quota-pre-dispatch-matrix.txt`, `delivery/evidence/core-after-quota-matrix-2026-09-27.txt`.

## 2026-09-27 — provider runtime and restore report evidence
- Provider runtime error contract now has 3/3 targeted tests across six adapters: timeout, network and malformed JSON stable codes with no secret/endpoint leakage. Evidence: `delivery/evidence/provider-runtime-errors-2026-09-27.txt`.
- Restore report integrity test validates PASS status, SHA-256, exactly 55 table content hashes, policy metadata, quarantine flags and disposable database removal: 1/1 pass.
- Full serial regression after both slices: **160/160 pass**. Evidence: `delivery/evidence/core-after-provider-restore-tests-2026-09-27.txt`.

## H32.05 policy gate audit
- Reviewed retention/export/delete and tenant-closure scope. No safe implementation can be claimed yet: retention duration/legal basis, closure approval/state, deletion scope/grace period, object/vector handling and owner sign-off are unspecified.
- Existing audit export and DB restore are bounded technical slices; speculative purge/closure code would invent policy. H32.05 remains pending decision gate, while independent core slices continue.

## 2026-09-27 — H23/H28 parallel core slices
- H23 session maintenance added bounded `FOR UPDATE SKIP LOCKED` expiry purge, preserving live sessions across tenants. Targeted 2/2 pass.
- H28 provider registry contract verified tenant grant isolation, provider/model disable and grant revoke routing denial; secret excluded from runtime resolution. Targeted 1/1 pass.
- TypeScript pass. Full serial regression after both slices: **163/163 pass**. Evidence: `delivery/evidence/core-after-h23-h28-2026-09-27.txt`.

## 2026-09-27 — H16/H32 parallel core slices
- H16 membership revoke test proves current session gets 401 immediately after membership deactivation; cross-tenant switch is 403 and own tenant remains active. Targeted 1/1 pass.
- H32.02 lifecycle test proves external stale lease becomes UNKNOWN without resend and local bounded failures become dead-letter. Targeted 2/2 pass.
- TypeScript pass. Full serial regression after both slices: **166/166 pass**. Evidence: `delivery/evidence/core-after-h16-h32-2026-09-27.txt`.

## 2026-09-27 — accelerated H01/H02/H28/H32 slices
- H01 reset flow: single-use and expiry rejection plus session revocation after password reset, HTTP/PG 1/1 pass.
- H02 workspace isolation: cross-tenant switch/members/update denial, 1/1 pass.
- H28 grant expiry: added `expires_at` policy and integrated expiry predicates into provider/model selectors; targeted policy 1/1 pass, TypeScript pass.
- H32 job lifecycle: external lease UNKNOWN/no resend and local dead-letter, 2/2 pass.
- Full serial regression after integration: **169/169 pass**. Evidence: `delivery/evidence/core-after-grant-expiry-integration-2026-09-27.txt`.

## 2026-09-27 — H03/H04 existing backend evidence audit
- Existing H03 contact/visibility and widget API/context suites: 5/5 pass (`delivery/evidence/h03-h04-existing-backend.txt`), covering tenant/assignment visibility, public token access and bounded context.
- `tests/widget-boundary.test.ts` currently fails at channel fixture creation with 400 before boundary assertions; this is a stale/invalid fixture contract, not claimed as H04 acceptance. It remains an explicit repair item.

## 2026-09-27 — H04 widget boundary fixture repaired
- Repaired stale H04 test fixture to include the authenticated workspace owner as a channel member; production contract requires at least one active channel agent.
- Widget public-token/origin/rate boundary test now passes 1/1. Full serial regression: **171/171 pass**. Evidence: `delivery/evidence/h04-widget-boundary-fixed.txt`, `delivery/evidence/core-after-h04-fixture-2026-09-27.txt`.

## 2026-09-27 — accelerated H05/H06 slices
- H05 assignment capacity: three concurrent widget sessions fill two agent capacity slots and leave the third unassigned; concurrent takeover has one winner and one `STALE_REPLY_OWNER`. Targeted 1/1 pass.
- H06 visitor profile: persistence/update, field/email/required validation, origin and cross-tenant token boundaries. Targeted 1/1 pass.
- TypeScript pass. Full serial regression after both slices: **173/173 pass**. Evidence: `delivery/evidence/core-after-h05-h06-2026-09-27.txt`.

## 2026-09-27 — self-contained handoff audit
- Audited the current TypeScript/React/Vite/Express/PostgreSQL checkout, migrations, routes, workers, tests, delivery contracts, research and git state. This checkout had no prior commit; branch is `codex/chatbot-delivery`.
- Added the root and `docs/` handoff package plus portable `.ai/skills/project-context/SKILL.md`; status remains MVP / In Progress. HiChat is documented as an external reference with no claim about private backend parity.
- Fresh local checks: `npm run build` PASS, `npm test` PASS (173/173, serial), `npm run db:restore-drill` PASS (55 tables). Evidence: `delivery/evidence/handoff-build-2026-09-27.txt`, `handoff-tests-2026-09-27.txt`, `handoff-restore-drill-2026-09-27.txt`.
- `delivery/BACKLOG.csv` remains 170 planning rows (107 Backlog, 61 In progress, 2 Implemented). It was not mass-promoted because those counts do not prove UI, external receipt, policy or acceptance. Exact open gates are in `docs/PROJECT-STATUS.md` and `docs/HANDOFF.md`.
- No provider/email credential, customer message, purchase or production deployment was performed. Remote is the user-supplied GitHub URL; commit/push status is recorded after the handoff snapshot is committed.

## 2026-09-27 — P0.1 focused core acceptance
- Ran the serial focused core path on local PostgreSQL 16: auth/verification, two-workspace isolation, widget origin/session/messages, knowledge publication/retrieval, grounded AI worker fixture, usage ledger and audit export.
- Result: **9/9 PASS** in 6.470 seconds. Evidence: `delivery/evidence/p0-core-acceptance-2026-09-27.txt`.
- Limits remain explicit: provider transport is injected/local fixture; no browser, live provider/email receipt, staging, production, HiChat parity or full H/E acceptance claim.

## 2026-09-27 — expired model-grant fence
- Provider audit found `defaultWorkspaceProviderInvoke` checked `active` but not `model_grants.expires_at` before transport. Added the expiry predicate so a grant that expires cannot initiate provider I/O.
- Added `tests/provider-grant-expiry.test.ts`: expired grant returns `AI_MODEL_REVOKED` with zero transport calls; renewed grant reaches the injected transport.
- Focused provider contract: **19/19 PASS**; full serial regression after the fix: **174/174 PASS**. Evidence: `delivery/evidence/p0-provider-contract-2026-09-27.txt`, `delivery/evidence/core-after-expired-grant-2026-09-27.txt`.
