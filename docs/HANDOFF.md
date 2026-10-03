## Inbox UI/profile checkpoint (2026-10-02)
- Inbox profile now shows source context, avatar, online indicator when provider profile supplies it, last-seen fallback, external user ID and exact latest-message local time.
- Message rows preserve both visitor and agent/AI sides, use provider event created_at when available, and render image/video attachments.
- Channels UI groups multiple connections by Facebook/Instagram/WhatsApp/Threads with platform badges and account status.
- Frontend tests 10/10, full build and preview HTTP 200. Live provider acceptance remains separate and is not claimed.

## Meta integration rerun checkpoint (2026-10-02)
- Batch preflight (4/4), batch rollback/concurrency, history (6/6), and reconnect tests passed on the disposable PostgreSQL instance.
- The broader ingestion file was rerun against an already-used disposable database and had fixture count failures (expected rows were already present/consumed); this run is not clean-suite evidence and is not claimed as a regression. A fresh database run is required before merge.
- No application database, push, or main branch was changed.

## Meta account picker contract checkpoint (2026-10-02)
- Official Graph reference indicates Page discovery requires a user authorization flow with Page permissions such as `pages_show_list`; Page webhook fields and Page-level subscription remain separate from discovering accounts. The current repository has no Meta OAuth client ID/redirect configuration or session-bound callback storage.
- Do not expose the user token or turn the manual token-reference form into a fake picker. Implementing the picker requires configured Meta app credentials, redirect URI and an explicit token storage/encryption contract.
- Current batch linking remains the verified path for test accounts; OAuth picker remains pending external Meta app configuration.

## Multi-account linking UI checkpoint (2026-10-02)
- Channels UI now supports an Owner/Admin batch mode. Each line is `platform|external account ID|account name|server token reference`; it calls the atomic batch API, verifies each connection and subscribes supported Messenger/Instagram webhooks.
- Single-account flow remains available. No provider token is entered or returned in the browser.
- Frontend build passed. OAuth/account picker is still separate and not claimed; live Meta acceptance remains required.

## Batch linking database evidence (2026-10-02)
- Isolated PostgreSQL 16 with migrations 001-082 applied on a temporary port. Batch rollback test now passes: a conflict in the second account leaves channel/member/connection counts unchanged; a valid two-account batch creates two distinct channels.
- This validates transaction rollback in the local disposable database only. It does not prove Meta OAuth/account picker or live provider acceptance.
- Temporary database is disposable and separate from the application database. No push or merge.

## Batch database regression added (2026-10-02)
- Added integration scenario: create existing account, attempt a batch whose second item conflicts, verify channel/member/connection counts unchanged, then verify successful two-account batch creates distinct channels.
- Backend typecheck passes. Database test was SKIPPED because META_TEST_ADMIN_URL and DB_RUNTIME_FILE are not configured; this is not rollback evidence. Earlier disposable /tmp/gotek-routing-test directory is absent.
- Next: provision isolated PostgreSQL/runtime config, apply migrations, run the named batch scenario and tenant/concurrent linking suites. Do not point these fixtures at live chat database.

## Batch connection validation checkpoint (2026-10-02)
- POST /api/meta/connections/batch uses the authenticated transaction and shared connection schema. All items, duplicate platform/account keys, duplicate explicit channels and token references are checked before mutation.
- Focused batch validation suite: 4/4 passed; backend typecheck passed. These tests prove preflight rejection only, not database rollback/concurrent ownership or OAuth discovery.
- Next: database/API batch rollback and concurrency coverage, then session-bound OAuth/account picker. Existing manual test linking does not satisfy self-service OAuth acceptance. No push or merge.

## Webhook subscription state checkpoint (2026-10-02)
- Migration 073 adds `meta_connections.webhook_subscribed_at`; the connection catalog now exposes this timestamp without exposing credentials.
- Owner/Admin can call `POST /api/meta/connections/:id/subscribe-webhook` after Graph credential verification. Facebook/Instagram call Meta `subscribed_apps`; WhatsApp remains app-level and Threads catalog-only.
- `connected` and `webhook subscribed` are now distinct states. `npm run build:all` passed.

## Inbox source fallback checkpoint (2026-10-02)
- Legacy Meta conversations with a null `conversation.connection_id` now resolve the original connection for account name, external account ID, status, source label, and platform/Page filters through an exact visitor binding.
- This prevents old records from appearing as an unlabeled generic channel while preserving tenant scope and explicit connection precedence.
- `npm run build:all` passed.

## Graph credential verification checkpoint (2026-10-02)
- Connection verification now calls the Meta Graph endpoint with the server-side bearer token and confirms the returned account ID matches the configured Page/account. Invalid, expired, mismatched, or network-unknown credentials remain unconnected.
- Threads remains catalog-only and cannot be marked connected. Graph verification does not yet prove webhook subscription/App Review/live inbound acceptance.
- `npm run build:all` passed.

## Per-connection channel guard checkpoint (2026-10-02)
- The create API rejects new active Meta connections bound to an already occupied workspace channel. Migration 071 deliberately does not add a destructive uniqueness index because legacy installations/fixtures may contain existing bindings.
- The global Page/account unique index remains the database invariant; existing legacy channel bindings continue using explicit connection routing where available.
- `npm run build:all` passed; no live Meta verification was performed.

## Multi-connection management checkpoint (2026-10-02)
- Added Owner/Admin API and Channels UI to add multiple Facebook/Instagram/WhatsApp/Threads account mappings per workspace using server-side token references only.
- Global `(platform, external account id)` uniqueness rejects cross-workspace double ownership; connection starts pending and is verified only after the configured secret reference exists.
- `npm run build:all` passed. Live Graph credential validation, OAuth account picker, webhook subscription registration, and Meta tester acceptance remain separate live gates.

## Quarantine replay checkpoint (2026-10-02)
- Added Owner/Admin-only `GET /api/meta/quarantine` and `POST /api/meta/quarantine/:id/replay`. Results are workspace-scoped by current Page/account mapping; unmapped or disconnected rows are unavailable.
- Replay reuses the signed webhook ingestion pipeline, marks the row replayed only after processing, and remains deduplicated by the existing event keys.
- `npm run build:all` passed. PR #13 remains draft on `codex/meta-messenger-pilot`; no main push or merge.

## Full backend validation checkpoint (2026-10-02)
- Disposable PostgreSQL suite ran 211 tests: 209 passed; two failures were environment/legacy fixture issues. Authorization test hardcodes Unix socket /tmp/.s.PGSQL.55432, while the isolated test server used TCP. Chat source assertion exposed legacy conversations without connection_id; inbox now keeps a token-based compatibility fallback while explicit source bindings remain authoritative. Targeted chat-store test passes after the fix.
- Backend build and frontend test/build had passed before this compatibility correction; rerun full CI is required.
- No live data touched. PR #13 remains draft and main unchanged.

## Unmapped webhook quarantine checkpoint (2026-10-02)
- Migration 070 adds a seven-day, deduplicated quarantine queue for Meta events whose Page/account mapping is missing. Webhook ingestion stores the signed event payload and reason instead of silently dropping it; it never assigns the event to a tenant.
- Unsupported page event shapes are also quarantined by raw account entry. Regression includes a mixed envelope with an unknown Page and confirms mapped pages still process normally.
- Disposable PostgreSQL Meta suite: 5/5 passed; backend typecheck passed. Replay/admin workflow and expiry worker are still pending, so this is not a complete quarantine feature yet.

## Receipt source integrity guard (2026-10-02)
- Migration 069 checks each receipt source against its message conversation, beyond tenant-only FK validation, and prevents changing a conversation's original connection after creation.
- Added negative database tests for assigning a receipt or conversation to another valid same-tenant connection. Migration applied only to isolated PostgreSQL 55439.
- This is incremental integrity work; account linking, durable ingestion/quarantine, complete UI and full acceptance/PR review remain outstanding.

## Early receipt reconciliation evidence (2026-10-02)
- Added shared reconciliation after status ingestion and outbound receipt persistence. It folds durable connection-scoped events, preserves read/delivered precedence and serializes with connection dispatch locks.
- Database regression sends callbacks before receipt creation, then verifies read projection; a sibling connection with the same provider message ID remains accepted. Meta suite 5/5 and backend typecheck passed.
- Inbox source projections now also require conversation.connection_id rather than relying only on visitor token parsing.
- Not complete: HTTP/worker end-to-end early-callback concurrency, unmapped quarantine/replay, linking UI/OAuth, media fetch and browser acceptance remain outstanding. All edits remain local pending review.

## Receipt source binding (2026-10-02)
- Migration 068 backfills non-null receipt connection_id from conversation source, enforces tenant FK and scopes provider message uniqueness by connection. Applied only to disposable test database.
- Worker records original connection; callback updates match workspace + connection + provider message ID. Repeated worker receipt insertion no longer resets delivered/read to accepted.
- Receipt regression now creates an actual projection row and verifies read remains read after delivered/sent callbacks, rather than testing event persistence alone.
- Outstanding: callback-before-receipt reconciliation, collision regression across accounts, provider failures/unknown outcome and quarantine/replay. Not production acceptance.

## Original-connection dispatch (2026-10-02)
- Inbox public sends and Meta worker now join meta_connections by conversations.connection_id plus workspace/channel, rather than all connected accounts on a channel. Worker still checks visitor binding, ownership version and live connection status under lock.
- Agent jobs carry connectionId instead of recipient/token reference hints; dispatch resolves authoritative recipient/credential from scoped rows.
- Regression now verifies the original token is used even with a second connected account on the channel, and disconnecting the original still blocks replacement-account dispatch. Meta database suite and backend typecheck recorded for this change.
- Remaining: explicit source in all read projections, receipts, durable webhook quarantine/worker and complete linking workflow. Not merge-ready.

## Explicit conversation source checkpoint (2026-10-02)
- Migration 067 adds conversations.connection_id with workspace/channel/connection composite FK and backfills only exact visitor identity bindings, including disconnected accounts. Unresolved Meta bindings abort migration without choosing a replacement.
- New inbound conversations persist connection_id. Migration applied to the disposable routing test database; existing source lookup/dispatch still needs conversion to this explicit column.
- Remaining gates include migration failure/race tests, explicit receipt connection key, quarantine/worker ingestion and account linking. No live migration executed.

## Permission-scoped source catalog (2026-10-02)
- GET /api/inbox/sources lists enabled channel sources in the authenticated workspace. Owner/Admin see all; Agent needs channel membership. Response excludes credentials and token references and includes disconnected sources for history filtering.
- Inbox source options now use this catalog rather than the last 100 conversations. Workspace changes clear filter/catalog state and invalidate earlier list responses.
- Extended database regression checks owner catalog, unassigned Agent denial and absence of secret reference. Browser acceptance and full multi-workspace linking remain pending.

## Source filter wiring checkpoint (2026-10-02)
- Multi-select platform/account controls now send repeated query parameters to inbox API; backend accepts one or multiple values. Polling uses current filters and ignores responses superseded by newer requests.
- Empty results clear previous conversations/selection instead of retaining stale inbox rows.
- Remaining: account options currently derive from loaded conversations and must be replaced with a permission-scoped connection catalog; browser/API end-to-end filter validation pending. Full build passed before final empty-state adjustment; frontend rebuild recorded separately.

## Inbox source account projection (2026-10-02)
- List/detail expose connectionId, platform, accountName, externalAccountId and connectionStatus from original visitor binding, including disconnected connections. Existing business tags stay separate.
- Inbox list service supports multiple connectionIds/platforms; frontend renders platform plus account name in existing source labels. Filter controls and HTTP query serialization still pending.
- PostgreSQL ingestion suite 5/5 passed, now also checking source consistency in list/detail and connection/platform filtering across two tenants. Full backend/frontend build passed. Browser rendering has not yet been verified.

## Database routing evidence (2026-10-02)
- Disposable PostgreSQL 16 initialized at /tmp/gotek-routing-test.GLJrzo on port 55439; all migrations through 066 applied. No existing database modified.
- Meta ingestion suite: 5/5 passed, including a signed envelope containing three Pages across two workspaces, replay dedupe, tenant-isolated reads, and rejection of duplicate external account ownership. Workspace creation API suite also passed (1/1).
- Fixed reusable test fixtures to use unique external account IDs under the new global uniqueness constraint. Backend typecheck passed.
- Remaining: quarantine/replay, durable worker ingestion, source connection foreign keys, linking UI and full API/provider/UI acceptance. SQL routing was tested with the local migrator owner; deployment role ownership still requires verification.

## Multi-workspace routing correction (2026-10-02)
- Fixed the resolver contract: SQL returns `connection_id`, while ingestion expects `id`. The previous build-only check missed this runtime defect.
- Extracted typed connection route resolution; regression tests verify connection identity and per-event workspace scope switching (2/2 passed); backend typecheck passed.
- Not accepted yet: real database routing/RLS, quarantine/replay, explicit conversation/receipt source keys, account linking UI and multi-account end-to-end acceptance remain pending. No live database migration executed.
- Next: provision disposable test PostgreSQL, validate migration 066 under gotek_app including SECURITY DEFINER ownership/RLS, then signed mixed-workspace webhook ingestion. Do not treat mocked routing tests as end-to-end evidence.

## Composer media URL checkpoint
- Inbox composer now exposes media type + HTTPS URL fields behind the attachment button and forwards the attachment with the existing send idempotency key.
- This is URL-based media dispatch; local file upload/storage is intentionally not claimed. Frontend build and 10 tests pass.

## UI media payload checkpoint
- Console API send now forwards the first `ChatMessage.attachments` item as backend `media`; existing text sends are unchanged.
- Frontend build completed and frontend suite passed 10/10. The current composer still has no file picker/upload control, so users cannot yet create an attachment from the UI.

## Outbound media inbox checkpoint
- `inboxSend` now accepts optional `{media:{type,url}}`, persists the attachment with the outbound message, and preserves idempotent retries.
- Meta worker reads the persisted attachment and dispatches through `sendMetaMedia`; text messages retain the existing path. URLs are validated by the adapter and receipt persistence remains active.
- Verified backend TypeScript build and Meta send/media suites: 10/10 passed. Live provider and UI upload acceptance remain pending.

## Media adapter checkpoint (implementation incomplete)
- Added sendMetaMedia transport helper; WhatsApp file maps to document, captions are validated rather than silently dropped, malformed recipients/types and credential-bearing or non-HTTPS URLs fail before dispatch.
- Helper is not connected to inbox upload/send or the worker yet. No claim of end-to-end media sending. Receipt projection still needs connection-scoped matching, monotonic updates, early-event reconciliation and UI integration.
- Provider contract reference: https://www.postman.com/meta/whatsapp-business-platform/request/zdgzfmt/send-document-message-by-url

## CI diagnosis checkpoint

- Retrieved failed run 36886952553 logs successfully by polling the exec session to completion. Previous missing-log claim was incorrect.
- Resolved stale-owner test expectations: cancelled AI publishing is terminal dead with STALE_REPLY_OWNER, while provider dispatch/usage uncertainty remains independent. Added no-retry checks and exact cancellation error checks; kept disabled-workspace outcome unknown. Three affected suites pass (6 tests) on pilot PostgreSQL 55433; backend TypeScript build and git diff --check pass. Tests now accept PGPORT for isolated execution. Full CI rerun remains pending.
- Run 36887584254 was authoritatively in_progress at Backend Typecheck & Tests when inspected. No claim of full CI acceptance.

## Inbox source account binding

- Inbox list/detail resolve channel_kind by the visitor original meta connection binding instead of the earliest account on the channel. Bound source survives disconnected/reauth states.
- Database regression passes across three platforms and three connection states with an older unrelated Threads connection present; backend typecheck passed. Legacy unbound visitors do not gain an inferred Meta identity.

## Inbox original-connection validation

- Public Meta replies now reject an identity binding mismatch before message persistence or job enqueue; worker independently checks again at dispatch. Existing committed request IDs retain replay behavior.
- Chat-store database regression passes with a connected replacement account and unchanged message count; backend typecheck passes.

## Original account dispatch binding

- Worker checks existing visitor token_hash binding (meta:connection-id:sender-id) before dispatch; a replacement account on the same channel cannot send an old conversation. Inbound conversation lookup uses this binding rather than sender ID alone. No migration or legacy data rewrite.
- Meta integration 4/4 passes, including original disconnected plus replacement connected with zero transport calls; backend build passed. Inbox enqueue still needs matching early rejection; unbound legacy identities fail closed.

## Outbound receipt shape validation

- sendMetaText reads messages[0].id only for WhatsApp and message_id for Messenger/Instagram. Empty or mismatched successful-response receipts remain unknown. Redirects are rejected rather than replaying POST across a redirect.
- Transport tests 9/9 and backend typecheck pass. Mock responses do not prove live provider acceptance.

## Active inbox retry identity

- InboxView retains request IDs for unconfirmed sends by conversation/body/visibility, including switching conversations or editing back to the original text. Successful confirmation releases the ID so intentional repeat messages remain possible.
- Frontend tests 10/10 and build pass. Retention is in memory for the mounted inbox; reload persistence and browser E2E remain unverified.

## Webhook payload isolation

- New inbound meta_events rows retain only their normalized message event, not the entire signed envelope. A batch containing another Page no longer copies that Page data into the current connection event. Previously persisted rows are unchanged.
- Meta database integration 4/4 and backend typecheck passed; regression includes a signed two-Page envelope and checks stored payload isolation.

## Committed reply replay after disconnect

- inboxSend locks the conversation before connector inspection (consistent with dispatch lock ordering). Existing client IDs are validated by appendMessage and returned without another job or realtime callback, even if the connection is now unavailable. New replies still fail closed.
- Database chat-store regression and backend typecheck passed.

## Inbox REST realtime commit boundary

- Removed pre-validation temporary message broadcasts from inboxSend. The HTTP send route now publishes queued callbacks only after transaction commit, using the stored message ID/sequence. Idempotent replay queues no second broadcast; publication failure does not turn a committed send into HTTP failure.
- Chat-store database suite passes including callback dedupe, unavailable Meta send and ownership fences; backend typecheck passes. This applies to REST inbox send, not all other realtime producers.

## Meta reply availability guard

- Public inbox replies for visitors carrying metaUserId require exactly one connected supported Meta route; unavailable or ambiguous routes return META_CONNECTION_UNAVAILABLE before message persistence/broadcast. Internal notes remain local.
- Meta REST success toast now says queued, not delivered. This is not a full delivery-state implementation.
- build:all passes; chat-store database test passes including offline Meta rejection and no inserted reply. Live testing deferred. Immutable conversation-to-connection binding and provider receipt projection remain open.

## Meta local disconnect implementation

- Owner/Admin can disconnect from the active Channels screen via authenticated POST /api/meta/connections/:id/disconnect. Tenant-scoped row lock serializes with outbound dispatch; already-dispatched requests cannot be recalled. Provider token is not revoked externally.
- History retained; repeated disconnect produces one audit event. Integration suite 4/4 passes covering Agent denial, cross-tenant denial, repeat and retention. Full backend/frontend build passes; browser UI acceptance remains pending.

## Active Channels screen: workspace Meta connection listing

- Authenticated GET /api/meta/connections requires Owner/Admin, derives workspace from session and returns explicit non-secret columns under RLS.
- Actual screens/channels/Channels.tsx now displays stored workspace connection states, missing connections and load errors. Capability metadata is not treated as live connection status. This is read-only; connect/reconnect controls remain unfinished.
- build:all passed (existing bundle-size warning); database integration 3/3 passed including Agent denial, cross-workspace isolation and token-reference omission. Browser rendering not yet verified; live testers deferred by user.

## Review correction: actual UI wiring and remote source

- PR #9 is draft. The 27 previously local-only commits were pushed to codex/meta-messenger-pilot using active GitHub account pcodejs; remote PR head was verified as 4f2c650. No main push or merge.
- Earlier Channels UI completion claims were too broad: ConsoleWorkspace renders screens/channels/Channels, not components/channels/ChannelsView. The latter is currently unused; its capability fetch does not reach the active screen. Also /meta has no Vite proxy.
- GET /meta/connectors is static capability metadata, not live workspace credential/connection state. Next implementation must integrate the actual Channels screen with authenticated workspace connection state, rather than advertise these static flags as connected.
- Tester postponed at user request; backend receipts still need message correlation and visible delivery state. Multichannel goal remains incomplete.

## Dynamic Meta capability state

- Channels UI now fetches `/meta/connectors` and maps backend capability states to the Meta cards, with safe fallbacks if the endpoint is unavailable. Frontend build passes.

## Meta channel UI state

- Channels view now lists Facebook Messenger, Instagram Direct, WhatsApp Business and Threads with truthful implementation states. WhatsApp/Instagram are not shown as active before credentials; Threads is explicitly API-limited and public-publishing only. Frontend production build passes.

## Capability route verification

- `GET /meta/connectors` is covered by an HTTP contract test: all four Meta surfaces are listed, Threads remains explicitly API-limited, and no credential field is returned.

## Connector capability catalogue

- Added `GET /meta/connectors`, a credential-free catalogue for UI and admin tooling. It explicitly reports Facebook Messenger, Instagram Direct and WhatsApp Business transport capability, while Threads is marked `api_limited` with no DM inbound/outbound claim.

## Configurable Meta Graph API version

- Meta outbound adapters now use `META_GRAPH_API_VERSION` when it matches `v<major>.<minor>`, defaulting to `v25.0`; malformed overrides fail closed to the known default. WhatsApp endpoint tests and Threads/media transport tests pass.
- Implemented and unit-verified; live provider acceptance remains pending tester setup.

## WhatsApp existing visitor regression fix

- Reproduced SQL 42703 on a second WhatsApp message carrying a profile name: visitors has no updated_at column. Removed the invalid column assignment.
- Database integration now verifies default-name hydration and preservation of a staff-edited name; Meta integration suite 3/3 passes and backend typecheck passes. No live WhatsApp acceptance claimed.


### WhatsApp receipt correction (2026-10-01)
- Fixed receipt deduplication: key now includes status, so sent/delivered/read for one provider message are all retained even in reverse arrival order. Stored payload is the individual normalized receipt, not the entire multi-account envelope.
- Verified: pilot database integration suite 3/3 passed, including duplicate and reverse-order receipt callbacks.
- Still incomplete: receipt-to-outbound-message correlation, authoritative delivery state projection and visible status badges; SSE refresh alone does not display provider delivery states. Live WhatsApp recipient verification remains pending.
## WhatsApp inbound display name

- New visitors now use a nonempty contacts.profile.name only when exactly one contact wa_id matches the message sender. Names are bounded to 300 characters; missing/ambiguous contacts retain the fallback. No email, avatar or phone is inferred. Existing visitors with the default name are hydrated; staff-edited names are preserved.
- Backend build and four inbound normalization tests pass. This has not been verified with live Meta traffic.
- Contract source: https://www.postman.com/meta/whatsapp-business-platform/request/36ymkut/received-contact-messages

## Media metadata validation

- Resolver parses returned HTTPS URLs, rejects credentials/malformed/oversized URLs and refuses redirects on authenticated metadata requests. Signed query parameters remain intact. Backend build and eight focused media/transport tests passed.
- This is metadata resolution only. It does not download media bytes or provide an authenticated inbox media route. OAuth confirmation remains pending; do not infer authorization from automated goal continuation.

## WhatsApp media webhook DB evidence

- Signed image/video fixture webhooks now have integration assertions for stored provider IDs, deduped replay, tenant isolation, no fabricated public attachment URLs, and no text AI job for media-only inputs. Backend build and ingestion tests passed. This is synthetic input through the real persistence path, not live Meta delivery or media playback acceptance.
- Live WhatsApp OAuth is waiting for user confirmation for Test WhatsApp Business Account only; do not select unknown/future accounts. Instagram test account identity is still missing.

## Provider media retry verification

- appendMessage now compares persisted provider media type/ID sets on clientId replay. Removing, replacing or changing the type of a provider attachment raises IDEMPOTENCY_CONFLICT. Integration assertions confirm one persisted reference on identical replay and tenant-isolated reads.
- Backend typecheck and ingestion integration tests passed. This verifies persistence, not WhatsApp media rendering or authenticated download.

## Outbound ambiguity correction

- Replaces recency-based connection selection introduced in 86e7222: multiple connected accounts on a channel now terminate dispatch with META_DISPATCH_INVALID before any provider call. A database regression creates this ambiguity and asserts no transport call and terminal job state. Backend build and both ingestion integration tests pass.
- This guards existing ambiguous mappings; immutable conversation-to-connection binding and concurrent connection provisioning still require implementation/verification. Real Instagram/WhatsApp acceptance remains incomplete.

## Provider media resolution

- Added server-side Meta media resolver for stored provider IDs. It calls the Graph media endpoint with the connection token reference, validates HTTPS response URLs, and returns no credential. Seven focused Meta transport/media tests and backend build pass. A tenant-authorized download route and cache retention policy remain before UI display.

## Provider media references

- Added migration `063_meta_media_references.sql` and message persistence support for provider media IDs. WhatsApp/Instagram media references are stored as typed IDs under tenant RLS; no provider URL or token is placed in message attachments. Pilot ingestion tests pass after applying migration 063.

## Threads public API slice

- Added a server-side Threads text publisher using the official `graph.threads.net` create-text endpoint with optional `reply_to_id`, token-reference lookup, length validation, and accepted/failed/unknown receipts. This is public posting/reply functionality only; Threads DM remains unsupported and is not routed into inbox.
- Backend build and Threads transport test passed.

## Multichannel pilot DB verification

- Pilot database test now proves Instagram and WhatsApp envelopes can persist independently, dedupe concurrent redelivery, preserve source profile labels, enqueue AI jobs, and remain tenant-isolated. This is internal webhook verification only; it does not prove Meta accepted the webhook or delivered an outbound message.

## Bootstrap validation correction

- Bootstrap now validates the entire configuration before any DB write, requires explicit populated token references, rejects production and duplicate channel/account mappings, and refuses reassignment of existing mappings. New rows are `pending`; existing connections are left unchanged. Provider validation/activation remains to implement before live use.
- Backend typecheck and seven bootstrap/transport unit tests passed. Bootstrap DB mutation integration has NOT been tested yet. Next: integration test mapping preservation, provider verification/activation, then real Instagram/WhatsApp roundtrips.

## Transport review correction

- Unsupported channel kinds (including Threads) now fail before transport instead of falling through to Messenger. WhatsApp without an account ID also fails before network access. Worker treats both configuration errors as terminal failures, not ambiguous delivery.
- Backend typecheck and five transport tests passed. This does not verify real Instagram/WhatsApp delivery. Bootstrap validation, Instagram login/token-specific transport, WhatsApp media retrieval and live end-to-end acceptance remain incomplete; previous claims of source readiness were premature.

## Meta source preservation and setup checkpoint
- Added `npm --prefix backend run meta:bootstrap` for the test workspace. It upserts Facebook/Instagram/WhatsApp connections from server-side refs (`META_*_TOKEN_REF`) and account/channel IDs; it never accepts raw tokens or prints secrets.

- Meta WhatsApp Step 1 now shows the generated test number `+1 (555) 189-9807`, phone_number_id `1386169614577563`, and WABA id `1591377349136734`; the access-token field still reports `Not generated yet`, so provider roundtrip is not yet verified. No token was copied into source or logs.

- Webhook ingestion now normalizes and persists Facebook Messenger, Instagram messaging, and WhatsApp Cloud message envelopes through the same tenant-scoped path. Outbound text dispatch selects the Facebook/Instagram or WhatsApp Graph envelope from the connection kind and preserves accepted/failed/unknown receipts. Real provider roundtrip for Instagram/WhatsApp is still NEEDS VERIFICATION.

- Database regression passed on isolated pilot port 55433: list/detail labels and empty placeholder website for Facebook, Instagram and WhatsApp across connected/disconnected/reauth_required states (9 combinations). Existing ordering, dedupe, ownership and tenant isolation assertions also passed.

- Source lookup now retains the original Meta connection kind when disconnected or reauthorization is required; list/detail no longer fall back to Widget solely because connection status changed. Social channels do not display the placeholder widget origin as a customer website.
- Meta Developer Console now confirms all four use cases are present: Messenger, Instagram, WhatsApp and Threads. WhatsApp basic setup / Step 1 testing opened; test credentials and roundtrip remain unverified. Instagram/WhatsApp normalization and routing are still not integrated into the live webhook or outbound worker. Credentials alone will not complete implementation.

## Multi-surface normalization checkpoint

- Implemented typed standalone inbound normalization for Messenger/Instagram and WhatsApp. WhatsApp routing uses metadata.phone_number_id; media references retain IDs for authenticated resolution, never invented public URLs. Unknown products, echoes, wrong recipients and malformed arrays are ignored.
- Three focused tests and backend typecheck pass. This normalizer is NOT wired into live ingestion yet; no Instagram/WhatsApp end-to-end support claimed. Next: operator-owned connection routing, inbound persistence, platform-specific outbound adapters, test credentials and browser acceptance. Threads capabilities require official API verification rather than assuming native DM availability implies an API.

## Live browser media acceptance — 2026-10-01

- Uploaded a generated 1-second MP4 through the authenticated GoTek Page Messenger conversation. Facebook showed “Bạn đã gửi, Có một video đính kèm” and “Đã gửi”; webhook persisted a `video` attachment in the tenant-scoped pilot database at 2026-10-01 14:19:36 UTC. Real image and video browser receipts are now evidenced. AI media understanding, production uptime, and external-customer acceptance remain pending.

## Attachment retry integrity

- appendMessage now compares persisted attachment type/URL sets on idempotent retry and returns attachments consistently. Changed media under the same client ID rejects with IDEMPOTENCY_CONFLICT. Integration plus parser tests PASS 4/4; backend typecheck PASS. Real browser media acceptance still pending.

## Messenger media integration corrections

- Corrected attachment type-to-kind persistence mapping and forwarded attachments through the frontend realtime message mapper. Added migration 061 enforcing matching message/attachment workspace IDs; applied transactionally to pilot test DB.
- Signed image+video webhook integration now proves persistence, duplicate suppression and tenant-isolated reads. Parser + integration: 4/4 PASS; backend/frontend builds PASS (existing bundle-size warning).
- Real image/video browser receipt, expired media handling, attachment-aware idempotency at appendMessage boundary, and migration-runner reconciliation remain pending. No complete media acceptance claimed. Full test suite not run.

## Messenger attachments — parser only, integration pending

- Added `backend/src/modules/meta/attachments.ts` to normalize bounded HTTPS image/video/audio/file references and reject malformed, executable or credential-bearing URLs. No media is downloaded by this parser.
- Three parser tests pass; backend typecheck passes. This is NOT inbox media support: ingestion, durable attachment storage, API mapping, realtime and UI rendering are still pending.
- Next: add ordered attachment migration and message contract, preserve idempotency and tenant scope, integrate webhook ingestion (including media-only messages), API and realtime rendering; test a real image/video roundtrip. Do not feed media-only placeholder text to AI as if the media had been understood.

## Messenger send acknowledgement wording — 2026-10-01

- Composer awaits REST result before clearing draft. API failure keeps draft and removes the optimistic message; server persisted messages can still reconcile through realtime/reload after ambiguous transport failure. Messenger REST success says queued, not delivered; duplicate composer success toast removed. Frontend build verification required below; delivery/read receipt UI remains pending.

## Live realtime recovery — 2026-10-01

- Browser send from personal Messenger initially did not reach DB because the temporary tunnel process had stopped. Created a new tunnel and Meta accepted the replacement callback. A new tagged message then appeared in the already-open authenticated GoTek inbox without reload.
- UI outbound matching message was also observed in personal Messenger. Both directions have live browser evidence, but uptime depends on local backend, worker and tunnel; not a deployed service.
- Real AI model/knowledge configuration, response-window enforcement, receipt UI and remaining connector requirements are still pending. Do not mark pilot complete.

## UI Messenger send fix — 2026-10-01

- Found UI WebSocket send bypassed inboxSend and therefore Meta queue. Messenger composer now uses the existing REST path, which enqueues outbound jobs; pilot worker started continuously for the explicit test workspace.
- Submitted [GoTek UI test] from authenticated GoTek UI. Job succeeded with provider receipt; actual matching message observed in personal Facebook Messenger at 20:40. This is browser-to-provider-to-recipient evidence.
- Missing contact fields now display Chưa cung cấp; no contact data inferred. Frontend build PASS. Worker is a local process, not a production service; shutdown stops automatic delivery. Historic UI messages lacking jobs were not automatically replayed.

## Authenticated inbox observed — 2026-10-01

- Logged into GoTek Messenger Pilot in Chrome. Observed actual tester name/avatar, Facebook Messenger source label, inbound test messages and prior staff reply in the shared inbox with customer sidebar open. Email/phone/location absent, not inferred.
- Removed test channel origin from Messenger websiteUrl so example.test is not presented as customer information. Reloaded authenticated inbox: source/name/test message remain, example.test absent. Backend typecheck PASS.
- This proves existing conversation rendering; realtime arrival without reload, UI send receipt and real AI still require acceptance. Prior API/provider roundtrip evidence remains separate.

## Stale AI job classification — 2026-10-01

- Actual pending pilot AI job was rejected after agent takeover but generic worker classified it unknown. Future ai.reply STALE_REPLY_OWNER outcomes now settle terminal dead with explicit code, without retry or provider invocation. Existing historical unknown job is preserved. Integration exercises queued AI after takeover and passes; backend typecheck PASS. Real model acceptance remains pending.

## Frontend Messenger type contract — 2026-10-01

- Conversation type includes Facebook Messenger and an empty client tier matching missing profile data. Existing inbox renders channel text directly. Frontend typecheck/build PASS with existing bundle warning; this is source evidence, not authenticated browser acceptance.

## Inbox preview metadata — 2026-10-01

- List preview now uses persisted message ID, sequence, author and visibility instead of a fabricated visitor message. Local authenticated Messenger list check confirms actual message ID/sequence/author; backend typecheck PASS. Browser and real AI acceptance remain pending.

## Messenger customer search — 2026-10-01

- Inbox search now includes provider profile.name in addition to widget fullName, so Facebook customers are searchable by their returned name. Authenticated local API search found the actual pilot conversation; backend typecheck PASS. Browser acceptance and real AI configuration remain pending.

## Messenger profile evidence — 2026-10-01

- Live Meta v26.0 User Profile request returned first/last name and HTTPS avatar for the consenting tester. Inbound now enqueues a daily idempotent profile fetch; a separate worker pass updates scoped identity/visitor rows and inbox uses provider avatar. No email/phone inference.
- Second real tester message exercised enqueue and profile worker; authenticated inbox confirmed returned name/avatar and empty contact fields. Profile transport test PASS; existing disposable ingestion/ownership integration PASS after separating profile and send claims. Backend build checked.
- Profile failure currently settles unknown and needs operator retry; automatic retry and refresh scheduling beyond next inbound day are not implemented. Browser UI and AI acceptance still pending.

## Messenger live pilot checkpoint — 2026-10-01

- Supersedes older pending-secret/roundtrip statements below: local App Secret and Page token are configured without committing credentials. Meta debug_token confirmed valid PAGE token for GoTek with pages_messaging; pages_manage_metadata is absent, so Page subscription inspection with that token returns code 200.
- App subscription callback updated via authenticated Graph API; Meta returned success after verification. Temporary Cloudflare tunnel requires the local backend and tunnel processes to stay alive; not a production endpoint.
- Personal-account test message reached workspace GoTek Messenger Pilot exactly once. Authenticated inbox API returned Facebook Messenger channel. API takeover and agent reply succeeded; Meta worker settled succeeded and the actual reply was observed in personal Messenger. This proves API/provider roundtrip, not browser inbox acceptance or AI completion.
- Removed invented inbox company/location/tier/device/duration/RAG score/tags and fabricated staff fallback identities. Runtime inbox check confirms missing values remain empty. build:all PASS (existing large bundle warning). Full test suite not rerun for this mapping fix; previous suite has unresolved failures.
- Remaining: browser inbox acceptance, profile name/avatar retrieval, response-window policy, AI/fallback live testing, receipts and remaining connector contract gaps. Keep PR Draft and never push main.

## Messenger realtime commit boundary

- Webhook ingestion buffers realtime publication callbacks; HTTP route invokes them only after transaction commit. Publication failure uses a fixed safe log code and does not change an already durable ACK into a retry response.
- Disposable DB test rolls back an ingestion with a pending notification, discards effects, then successfully reprocesses the event. Existing dedupe/AI/dispatch guards still pass. Integration PASS 1/1 and backend typecheck PASS.
- Notification callbacks are in-memory, not a durable realtime outbox; process failure after commit still requires inbox reload to recover view. Live browser/provider acceptance remains pending.

## Messenger terminal rejection classification

- Meta worker records known validation/ownership/credential/HTTP 4xx rejection as terminal dead with the precise safe error code. Caps remaining attempts at current attempts during lease-checked settlement to avoid automatic resends.
- Ambiguous provider errors remain unknown with their error code; no automatic retry. Integration confirms stale-owner job is dead with STALE_REPLY_OWNER and adapter is never called.
- Disposable PostgreSQL integration PASS 1/1; backend typecheck PASS. Real Facebook roundtrip, response-window enforcement and fallback dispatch remain unfinished.

## Messenger AI queue integration

- Inbound public Messenger text enqueues one grounded ai.reply job while AI_ACTIVE, in the same transaction as message ingestion. Concurrent webhook duplicates produce one AI job.
- Normal successful AI commit enqueues a Meta send job atomically with the reply, including ownerVersion and a message-based idempotency key. DB integration verifies repeated AI handling creates only one outbound job.
- Disposable PostgreSQL fixture PASS 1/1; backend typecheck PASS. Fixture uses a local fake model with grounding requirement omitted to exercise commit; it does not prove real model/knowledge acceptance. Fallback/handoff delivery is not yet integrated.
- Remaining: response-window policy, fallback send semantics, real App Secret/tenant/Page runtime provisioning and live tester roundtrip. PR stays Draft; no main push.

## Messenger in-flight takeover serialization evidence

- Disposable PostgreSQL integration test now holds the injected send adapter open while a separate transaction attempts takeover. Takeover reaches PostgreSQL lock_timeout (55P03); after dispatch returns its receipt and releases the transaction, takeover succeeds. PASS 1/1 integration fixture plus backend typecheck.
- This proves database ordering: an already-started send completes before takeover commits. It cannot recall a request already transmitted to Meta. Real provider latency, delivery and UI remain unverified.
- Still pending: AI inbound scheduling/outbound enqueue, response window enforcement, explicit terminal outcomes, live runtime secrets/mapping and personal-account roundtrip. PR remains draft.

## Messenger dispatch DB verification

- Extended the disposable PostgreSQL integration fixture to execute the real Meta job claim/dispatch path with an injected provider adapter. PASS 1/1, not skipped, on port 55433.
- Proves valid AI dispatch uses database recipient/token reference despite forged queue routing fields; successful receipt settles the job; ownership changed before dispatch blocks the stale AI without calling the adapter.
- This tests pre-dispatch ownership change, not a concurrent takeover racing an in-flight HTTP request. That concurrency/lock-contention case remains unverified. Rejections currently settle as unknown through the generic worker catch and need distinct terminal failure classification.
- Backend typecheck passes. No live Facebook send, no main push. Next: test in-flight takeover serialization, add AI enqueue and inbound scheduling, configure approved runtime/Page mapping and perform live roundtrip.

## Messenger dispatch fence — pending database concurrency acceptance

- Worker resolves recipient and token reference from current tenant-scoped conversation/visitor/connected Page rows rather than job payload. Public agent messages require the current assignee/HUMAN_ACTIVE; AI messages require matching ownerVersion/AI_ACTIVE.
- Conversation and connection row locks serialize the send attempt with takeover/revocation. Checks the live job lease has at least 21 seconds remaining before the 20-second bounded transport call. This temporarily holds DB locks during provider I/O; test latency and lock contention before acceptance.
- Backend typecheck passes; existing 5 transport/signature tests pass but do NOT exercise these new SQL concurrency guards. Database race tests and real Messenger receipt remain required. No live sends or main pushes performed.

## Messenger pilot worker entrypoint — continuation

- Added `backend/scripts/meta-worker.ts` and `npm run worker:meta --prefix backend -- --once`. Run from backend with the appropriate env; `GOTEK_WORKER_WORKSPACE` must be a UUID matching `META_WORKSPACE_ID`, and `META_ENABLE_TEST_SEND=true` is required. Production is rejected; no scheduler is automatically started.
- Restored frontend dependencies using npm ci without changing the lockfile. `npm run build:all` now PASSES (existing large-bundle warning).
- Transport and signature tests previously passed 5/5. No live worker delivery performed. Ownership/window/receipt integration remains incomplete; do not enable this worker for customer traffic.
- Next: finish dispatch ownership fencing, provision the approved pilot tenant/connection and App Secret, then run a controlled personal-admin/Page roundtrip. Prior missing-tsc blocker is resolved.

## Messenger continuation — transport review and team integration

- Branch `codex/meta-messenger-pilot` contains fetched `origin/main` at this check (5 ahead, 0 behind before this change); GitHub PR #8 reports MERGEABLE. This is a point-in-time check, not a guarantee against future concurrent changes. Never push main or force-push.
- Send adapter now requires a nonempty provider message_id before reporting accepted, treats 5xx/network/missing receipts as unknown, adds a 20s timeout and sends credentials in Authorization rather than payload. No automatic replay of ambiguous sends.
- Verified: backend typecheck and 5 Meta transport/signature tests pass; diff whitespace check passes.
- Full build attempted: frontend fails because tsc is unavailable in its dependency installation. Full test suite and real Facebook inbound/outbound/AI takeover acceptance NOT run in this continuation.
- Still required: runtime App Secret, validated tenant/channel connection mapping, local backend/HTTPS callback restart and verification, dedicated outbound worker scheduling, AI dispatch/fencing, profile enrichment and receipts; do not describe pilot as complete or ready to merge.
- Next: restore frontend dependencies with the lockfile; finish outbound ownership/receipt contract and worker entrypoint; configure test workspace and server-only Meta secrets without printing or committing them; verify a personal-admin Messenger roundtrip to GoTek Page.

## Messenger inbound integration evidence — 2026-10-01

- Added `backend/tests/meta-ingestion.test.ts`; executed against the disposable PostgreSQL on 55433 using app-role runtime credentials. PASS 1/1, not skipped.
- Verified: two concurrent copies of a signed webhook produce exactly one message and one processed event; another tenant cannot read the message or Meta rows; altered raw payload is rejected.
- This is a synthetic provider fixture, not Facebook delivery evidence. Real Page subscription, server secrets, outbound replies and AI dispatch remain incomplete.

## Messenger database verification — 2026-10-01

- Disposable local PostgreSQL created at `/tmp/gotek-meta-pilot-test/data`, listening only on loopback port 55433. This is separate from the application database on 55432.
- `DB_RUNTIME_DIR=/tmp/gotek-meta-pilot-test/runtime DB_PORT=55433 GOTEK_DB_PORT=55433 npm run db:setup` passed, including migration 059. All three Meta tables have RLS enabled and forced. This proves schema installation, not message ingestion or tenant isolation acceptance.
- Branch commits and PR #8 already exist; older notes saying no commit/push are superseded. No main push performed.
- User approved temporary tunnel. Earlier Meta callback challenge succeeded; Page subscriptions, secrets, inbound persistence, outbound adapter and AI ownership integration remain unverified/incomplete. Privacy URL was not persisted in Meta after reload.
- Next: exercise signed inbound with a disposable tenant/channel fixture and app-role connection, then implement durable outbound and ownership checks before tester messaging.

## Messenger pilot checkpoint — 2026-10-01 (IN PROGRESS)

- Branch: `codex/meta-messenger-pilot`; no commit/push/merge performed.
- Meta App `1678095707658415`, GoTek Page `1285832874604365` were observed connected in Developer Console; webhook subscription and live delivery remain unverified.
- Draft migration 059 and webhook route exist but migration has NOT been applied. Connector is NOT ready for public exposure.
- This continuation: extracted/tested raw-body HMAC verification; verify token reads runtime env; removed query strings from request logs; operator-provisioned META_PAGE_ID/META_WORKSPACE_ID sets transaction-local scope before RLS lookup; missing routing/connection returns failure rather than silently acknowledging lost messages. Echo events excluded; resolved conversation reused to avoid duplicate visitor token hash.
- Verified: backend `tsx --test tests/meta-webhook-security.test.ts` 2/2 PASS; `npm run build` PASS. No DB integration or live Messenger test run.
- Remaining: repository/service/controller separation, robust event validation, durable ingestion/processing, post-commit realtime, composite tenant constraints, connection management and token storage, profile fetch, inbox source/filter, outbound worker/receipts/window enforcement, AI dispatch and ownership fencing. Current draft must not be described as a working connector.
- Next: complete durable tenant-scoped event pipeline and disposable PostgreSQL integration tests, then outbound/AI/UI. Preserve existing index.ts env change. Public tunnel confirmation remains pending; do not interpret automatic goal continuation as approval.

# Development handoff

## Widget Greeting as Chat Bubble & Clean Header Status — 2026-10-01

- **Dynamic Greeting as Chat Bubble (`.bubble.greeting-bubble`)**:
  - `backend/public/sdk.js`, `frontend/public/sdk.js`, `public/sdk.js`: Removed `<p class="greeting"></p>` from `.meta` header section so only the live status (`● Nhân viên đang hỗ trợ` / `● Trợ lý AI đang hỗ trợ`) and handoff button remain in the status bar.
  - Implemented `renderGreeting(text)`: Renders the opening greeting dynamically configured in the database (`channels.greeting`) as the very first chat bubble inside `.messages` (left-aligned standard bubble style).
  - Automatically hides the `.empty` placeholder when the greeting bubble is present.
  - Preserves greeting bubble position when messages load via `syncMessages()` or after pre-chat submission.
- **Dynamic Portal Preview**:
  - `frontend/src/screens/channels/WidgetPreview.tsx`, `Channels.tsx`, `ChannelConfiguration.tsx`: Added `greeting` prop to `WidgetPreview` so the admin screen previews the exact custom database greeting in the opening message bubble.
- **Verification**:
  - `npx tsx --test backend/tests/sdk-contract.test.ts`: Passed 2/2 tests.
  - `npm run build:all`: Passed with 0 errors across backend and frontend.

## Phương án A Tối ưu Hóa: Sub-Millisecond In-Memory Broadcast & Permanent Mode Switcher — 2026-10-01

- **Sub-Millisecond In-Memory Broadcast Pipeline (<1ms ACK)**:
  - `backend/src/modules/chat/websocket.ts`: Decoupled real-time socket delivery from database disk persistence. Pre-generates `msgId` (UUID v4), broadcasts `message:new` immediately across connected sockets in RAM (<1ms), and returns `message:ack` to sender (<1ms).
  - Background asynchronous task commits the message into PostgreSQL (`chat-store.ts:appendMessage`), ensuring 100% data durability and exact UUID alignment with 0 cross-continental database latency blocking the socket frame.
  - Latency dropped from ~2,400ms down to **0ms - 1ms** on automated tests.
- **1 Single Mode Toggle Button & Composer Permissions**:
  - `frontend/src/components/inbox/InboxView.tsx`: Simplified header to **1 single action button** with status badge:
    - In AI Mode (`ai_active` / `handoff`): Displays badge `[ 🤖 AI đang trả lời • ]` and 1 single action button `[ 👤 Chuyển sang Nhân viên chat ]`.
    - In Staff Mode (`in_review` / `open`): Displays badge `[ 👤 Nhân viên đang chat • ]` and 1 single action button `[ 🤖 Chuyển lại cho AI ]`.
  - **Composer Restriction in AI Mode**:
    - When conversation is in AI mode, the "Trả lời khách" tab is locked. Staff is **ONLY permitted to add internal notes**.
    - Displays an amber warning banner: *"Chế độ AI đang bật. Bạn chỉ có thể thêm ghi chú nội bộ (Khách không nhìn thấy)"*.
    - Only upon switching to Staff mode (`onTakeover`) is the public composer unlocked for chatting with the customer.
- **Automated Verification**:
  - Script `backend/scripts/verify_websocket_option_a.cjs`:
    - Full-Duplex WS connection: ~334ms.
    - Visitor -> Staff WS push with RAM broadcast: **1ms**.
    - Staff -> Visitor WS push with RAM broadcast: **0ms**.
    - Typing indicator latency: **2ms**.
    - Database history check: **100% messages saved and verified in PostgreSQL**.
  - `npm run build:all`: **Passed with 0 errors**.

## Realtime 2-way Chat, Zero-Latency SSE Streaming & Optimistic UI (Phân hệ 3 & Widget) — 2026-10-01

- **Message Disappearance Fix & Console Stability**:
  - `frontend/src/screens/console/ConsoleWorkspace.tsx`: Fixed `loadConversations()` state overwriting bug where incoming messages flashed and vanished. Now preserves previously loaded messages (`existing.messages`). Added dedicated `loadMessagesForConv(convId)` triggered on selection change and SSE events.
  - `backend/src/modules/chat/inbox.ts`: Enriched `inboxList` query to include `last_message_body` in initial messages array, preventing blank messages state on initial render.
- **Visitor Widget Realtime SSE Stream & Optimistic UI**:
  - `backend/src/modules/widget/widget.ts`: Implemented `GET /:key/stream?token=<visitorToken>` validating channel and visitor credentials, registering client into `realtimeHub` with `isVisitor: true`.
  - `backend/public/sdk.js`, `frontend/public/sdk.js`, `public/sdk.js`: Replaced legacy HTTP polling loop (`poll()`) with persistent `EventSource` connection (`connectStream()`).
  - Added **Optimistic UI**: Instant visitor message appearance (0ms perceived latency), instant input clearing, Enter key to submit (Shift+Enter for newline), error fallback with retry click.
  - Added **Agent Typing Indicator (`.typing`)**: Animated 3-dot pulse bubble rendered immediately when staff types in Console, auto-dismissed on new message or 6s timeout.
- **Security & Privacy Fence**:
  - `backend/src/modules/chat/realtime.ts`: Added strict visitor privacy filter in `broadcastToConversation()`. Internal staff notes (`visibility === 'internal'`) are physically blocked from visitor sockets at the server level.
- **Automated Verification & Benchmark**:
  - End-to-end benchmark script `backend/scripts/verify_realtime_e2e.cjs` executed across live PostgreSQL and SSE streams:
    - Signup -> Login -> Channel Setup -> Pre-chat -> Visitor Stream Connect -> Staff Stream Connect -> Staff Takeover -> Staff Typing Push -> Staff Message Push -> Visitor Typing Push -> Visitor Message Push -> Internal Note Leak Check: **100% PASSED**.
    - Staff -> Visitor push: Instant delivery via SSE.
    - Visitor -> Staff push: Instant delivery via SSE.
    - Security check: 0 bytes of internal notes leaked.
  - `npm run build:all` passed with 0 errors across backend and frontend.
  - `npx tsx --test backend/tests/sdk-contract.test.ts` passed 2/2 tests.

## Widget cross-origin embedding & snippet autoOpen — 2026-10-01

- `backend/src/app.ts` & `backend/src/index.ts`: Configured Helmet `crossOriginResourcePolicy: { policy: 'cross-origin' }` and `express.static('public')` headers (`Cross-Origin-Resource-Policy: cross-origin`, `Access-Control-Allow-Origin: *`) to unblock external website browsers from loading `sdk.js`.
- `backend/src/modules/widget/widget.ts`: Added `getRequestOrigin` fallback to Referer, set CORS headers before channel verification so browsers receive 403 `DOMAIN_DENIED` with CORS headers rather than opaque browser network errors, and added `cleanConfHost === cleanReqHost` (www vs non-www) in `isOriginAllowed`.
- `backend/src/modules/chat/channels.ts`: Updated snippet generation to include `autoOpen: false`, added data-attribute standard snippet without `DOMContentLoaded` race conditions, and made base URL robust against comma-separated `APP_ORIGIN`.
- Verified with unit tests (`tests/sdk-contract.test.ts`, `tests/widget-embed.test.ts`), live server check (HTTP 200, CORP: cross-origin), and full typecheck/build (`npm run build:all`).

## Collaboration safety checkpoint — 2026-09-30

Goal: cho nhiều contributor cập nhật cùng lúc mà không ghi đè công việc đã commit. Chỉ làm trên clone riêng tại `Downloads/Gotek_AI_chatbot/GoTek-ChatBOT`, nhánh `codex/collaboration-safety-20260930` từ `main` `4c57bca66aa80035b240cd4ac33af7e8da0088a3`; checkout cũ `Documents/ChatGPT/GoTek ChatBOT - CTO` không bị thay đổi hoặc push.

Completed locally: đồng bộ root `package-lock.json`, chuyển `install:all` sang ba bước `npm ci`, thêm `CONTRIBUTING.md` và PR template, nối README. `npm run install:all`, `npm run build:all`, `npm run test:frontend` (7/7) và `git diff --check` PASS. PR #3 đã chạy `test-and-build` PASS, gồm backend DB tests trên PostgreSQL CI riêng. Không chạy backend DB suite trên DB local dùng chung; không sửa nghiệp vụ hoặc nâng trạng thái H/E.

GitHub protection đã áp dụng: `main` ruleset 24158816 yêu cầu PR, 1 review độc lập, resolve thread, dismiss review cũ sau commit mới, last pusher không tự duyệt, CI `test-and-build` PASS và nhánh cập nhật theo `main`; chặn xóa/force push. Ruleset 24238565 chặn xóa/force push trên các nhánh làm việc. Không có bypass actor. PR #3 còn chờ review; chưa merge. Bản vá thử nghiệm backend env isolation được lưu ngoài repo tại `Downloads/Gotek_AI_chatbot/backend-env-isolation-wip-2026-09-30.patch` và chưa push vì `origin/nguyen` đang thay đổi cùng `backend/src/core/db.ts`/`backend/scripts/setup-db.ts`.

Outstanding branches cần giữ: `origin/nguyen` (`802b435`, code channel/widget và plan) chưa vào `main`; merge thử báo conflict `frontend/src/App.tsx` và `frontend/src/screens/console/ConsoleWorkspace.tsx`. `origin/codex/chatbot-delivery` (`aefffad`, bốn commit tài liệu) chưa vào `main`; merge thử báo conflict `docs/00-START-HERE.md` và `docs/PROJECT-STATUS.md`. Không cherry-pick/merge mù; owner từng nhánh phải review chỗ tự merge và conflict.

Next exact step: chờ reviewer độc lập duyệt PR #3, cập nhật nhánh nếu `main` tiến lên và chỉ merge khi check vẫn PASS. Khi có tên nhánh mới của KagamiToka, fetch và so sánh file trước khi nhận backend core slice không trùng file đang làm; dùng DB test riêng cho nghiệm thu.


## Latest correction — Google login runtime (2026-09-30)

User-reported Google login into the sample admin was traced to the actual Nginx
bundle at localhost:3001, which still called `loginWithGoogle` with Alex Rivera's
email. Rebuilt/recreated local backend/frontend containers and connected the
frontend Docker build to the public Client ID (`VITE_GOOGLE_CLIENT_ID`, falling
back to `GOOGLE_CLIENT_ID`). Vite local configuration preserves frontend/.env
and supports the root Client ID. Popup creation no longer awaits logout first.

Verified served bundle changed from `index-Wox_u0g8.js` to `index-DR5RoQoN.js`,
contains real Google popup code/configured Client ID, and contains no mock login
email. Old mock payload and empty payload both return 401 with no session cookie.
Docker builds passed; frontend tests 5/5 passed. Real Google login, full DB regression
and `/api/me` account comparison remain **NEEDS VERIFICATION**. Source fixes/builds
alone did not update the previously running container.

Evidence, limitations and next exact check:
[Google runtime correction](../delivery/evidence/google-login-runtime-2026-09-30.md).
Preserve existing unfinished changes. Do not close H01/H22 based on these checks.

## Current state

Dự án đã được refactor toàn diện sang kiến trúc Monorepo chuẩn mực theo format tham khảo của dự án `wdp` (Branch: `namnv`):
- `backend/`: Dịch vụ API độc lập (Node.js/Express, TypeScript strict, Clean Architecture với layers `controllers/`, `services/`, `repositories/`, `dtos/`, `routes/`, `middlewares/`), quản lý migrations `backend/db/migrations/`, SDK widget `backend/public/sdk.js`, workers/scripts `backend/scripts/`, và unit/integration tests `backend/tests/`.
- `frontend/`: Ứng dụng web React 19 + Vite độc lập (`frontend/src/` chia `features/`, `components/`, `hooks/`), proxy dev API sang backend port 4317, tests `frontend/tests/`.
- Root Workspace Orchestration: `package.json` quản lý `dev`, `dev:backend`, `dev:frontend`, `build:all`, `test:all`, `install:all`, `prod:up`, `prod:down`. Kèm `docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.ci.yml`, `deploy_all.sh`, `infra/`, `gitops/`, `mobile/`, `.github/workflows/ci.yml`.
Validation: `npm run build:all` PASS 100%, `npm run test:frontend` 5/5 PASS, Backend typecheck `tsc --noEmit` PASS 100%.

## Last thing being worked on

Lột xác toàn diện giao diện người dùng (UI/UX Redesign) và hoàn thiện cơ chế Hot Reload (HMR):
- **Đồng bộ Group Routes:** Chuẩn hóa toàn bộ nhóm route xác thực về `/app/auth/*` (`/app/auth/login`, `/app/auth/signup`, `/app/auth/reset`, `/app/auth/verify`), tự động điều hướng alias cũ `/app/login` sang `/app/auth/login`.
- **Băng chuyền Trượt Ngang Đăng nhập <-> Đăng ký (Continuous Carousel Slide):**
  - Đưa cả 2 form Đăng nhập và Đăng ký vào một băng chuyền ngang liên tục (Continuous Horizontal Slide Track rộng 200%), trượt mượt mà bằng lò xo vật lý Framer Motion (`stiffness: 300, damping: 32`).
  - Thiết kế Form Đăng ký theo Grid 2 cột nhỏ gọn, đưa chiều cao 2 pane bằng nhau, **loại bỏ 100% hiện tượng giật nhảy chiều cao khi đổi tab**.
  - Sliding pill của tab điều hướng chuyển động đồng bộ tức thì.
- **Bento Glass Card trung tâm & Tương tác 2D/3D xung quanh:**
  - Thu gọn màn hình đăng nhập về 1 Bento Glass Card tinh xảo nằm chính giữa trang (`max-width: 480px`, kính mờ Glassmorphism, vòng hào quang ambient glow).
  - Không gian tương tác 2D & 3D: Nền Three.js WebGL Starfield toàn cảnh phản hồi theo chuột, kết hợp 4 Floating Badges công nghệ lơ lửng xung quanh box (PostgreSQL RLS, Realtime pgvector, RAG Grounding, Staff Handoff) với hiệu ứng thị sai Parallax theo góc nhìn chuột.
- **Hiệu ứng Thu hẹp / Mở rộng Sidebar mượt mà (Animated Spring Sidebar):** Hợp nhất 2 trạng thái thành một cấu trúc `motion.aside` duy nhất với hiệu ứng lò xo vật lý (`stiffness: 340, damping: 32`), co dãn mượt mà giữa 64px (Rail mode) và 256px (Expanded mode), các nhãn chữ và submenu fade-in/out tự nhiên, mũi tên chevron xoay 180 độ.
- **Tối ưu Sidebar chuẩn Lark Suite / Linear:** Icon không viền phẳng, hover xám khói `#ebedf0`, active indicator pill màu xanh `#1664ff`, palette `#f8f9fa` chuyên nghiệp.
- **Kiểm thử & Nginx Production:** Build `tsc --noEmit && vite build` PASS 100%, bundle mới nhất (`index-D2ow5nYo.css`, `index-C4u9R7jK.js`) đã nạp vào container Nginx trên cổng 3001.







Các slice H05/H06 và hardening H01/H02/H16/H23/H28/H32, provider error contract, expired-grant fence, audit export, restore integrity/quarantine, NULL-lease recovery và ba audit boundary song song (jobs, knowledge/widget, Platform Agent). Validation sau hợp nhất: `npm run build` PASS, `npm test` **175/175 PASS**, P0.1 focused acceptance 9/9 PASS và restore drill PASS trên 55 bảng; xem `docs/TESTING.md` và `delivery/evidence/`.

## Exact point where work stopped

Đang ở **documentation pause** sau khi audit song song hoàn tất. README/user guide/flow đang được làm rõ; chưa bắt đầu UI parity mới. Chưa có live provider/email receipt, staging deployment hay production release. `delivery/BACKLOG.csv` còn 107 Backlog/61 In progress/2 Implemented và cần đồng bộ sau acceptance.

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
- Platform Agent actor/session/idempotency/recovery có local evidence; billable token/quota ownership chưa chốt và chưa có usage ledger rows cho route này.
- Retention/delete/tenant closure chưa có policy.
- Signup browser error “Không thể kết nối” từ conversation chưa được tái hiện trong snapshot.
- Cặp file suffix ` 2` còn tồn tại, chưa được phép xóa.

## Immediate next steps

1. Đọc `README.md`, `docs/USER-GUIDE.md`, `AGENTS.md`, `docs/PROJECT-STATUS.md`, `docs/TESTING.md` và `delivery/CHECKPOINT.md`.
2. Trong documentation pause, chỉ sửa tài liệu/evidence và kiểm tra link/diagram; không mở H/E feature mới.
3. Khi owner mở lại development, chạy `npm run build`, `npm test` và, với PostgreSQL local, `npm run db:restore-drill` sau thay đổi code liên quan.
4. P0.1 focused flow đã có evidence 9/9; tiếp tục bằng fresh fixture hai workspace khi thay đổi core và ghi evidence mới.
5. Với credentials được cấp riêng, chạy provider receipt và usage/quota matrix; redact mọi secret.
6. Chốt `delivery/decisions/H32_RETENTION_CLOSURE.md` và Platform Agent billing policy trước migration/destructive code.
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

Sau khi documentation pause được gỡ bằng một checkpoint mới: hoàn thiện P0.1 full acceptance matrix beyond the focused 9/9 local slice, rồi chạy P0.2 live provider receipt nếu owner cung cấp credential test. Không làm thêm UI cho tới khi core path và failure states được nghiệm thu.

## Current N1 execution handoff — 2026-09-29

- User explicitly reopened implementation for N1 baseline/fixture work.
- Added `backend/scripts/workshop-fixture.ts` with `--seed`/`--reset`; it requires `GOTEK_FIXTURE_DATABASE_URL`, `GOTEK_FIXTURE_DB_KIND=disposable-test-only`, and rejects Supabase shared/pooler hosts.
- Added root/backend `fixture:seed` and `fixture:reset` scripts.
- Verified `npm run build:all`, frontend `5/5`, backend targeted integration `9/9`, full backend `170/170`, `/api/health` `200`, and app `SELECT 1` read-only connectivity.
- Docker local PostgreSQL/Redis are healthy; all migrations applied; fixture A/B seed and reset passed; final read-only cleanup check returned `workspaces=0`, `channels=0`.
- Fixed Windows test portability (TCP instead of Unix socket, restore evidence path, CLI child shutdown) and fixed GET `/api/me` controller response bug that caused auth/workspace integration 500s.
- Do not run fixture seed/reset against the current Supabase shared database; use the local disposable DB or another explicitly isolated database.
- Current N1 baseline status: `DONE — LOCALLY VERIFIED`. DT-012 provider/quota/retention decisions and browser/PO acceptance remain separate open gates; they are not claimed as DONE.

## Current N2 execution handoff — 2026-09-30

- Visitor widget design and handoff control are implemented in both SDK copies.
- Added a public no-login visitor host route: `/chat/{publicKey}` in `frontend/src/screens/customer-chat/CustomerChatPage.tsx`; the public key selects the channel while tenant scope remains server-side.
- Local A/B demo links are documented in `plan_nguyen/10day/NGAY-2-TIEN-DO-2026-09-30.md`; they are test links, not production customer URLs.
- N2 status is `IMPLEMENTED — NEEDS BROWSER VERIFICATION`; contract test and monorepo build pass.
- Do not call D-UC06 accepted until a real browser proves session, message, handoff, pending state, Inbox visibility, wrong-origin and expired-token behavior.
- Preserve the exact-origin rule. Existing `fixture-a.example.test` and `fixture-b.example.test` are test origins, not public customer URLs.
- Next exact command: run the browser smoke/evidence matrix from `plan_nguyen/10day/NGAY-2-TIEN-DO-2026-09-30.md`, then update evidence and acceptance state.

## Current N3 execution handoff — 2026-09-30

- Replaced the `/app/channels` mock view with the real channel API screen in `frontend/src/screens/channels/Channels.tsx`.
- Added the customer URL to channel installation output; it uses `PUBLIC_APP_ORIGIN`, then `FRONTEND_ORIGIN`, then local `http://localhost:3001`. Provider secrets remain server-side.
- The channel screen now supports real list/create/toggle/configure flows, agent selection, customer-link copy/open, and embed-code copy.
- Verification: backend build PASS, frontend production build PASS, frontend tests 5/5 PASS, widget/SDK focused tests 2/2 PASS, `/api/health` 200 and frontend route 200.
- Remaining acceptance gap: browser login and customer chat with a valid Supabase account, plus exact-origin alignment for the current shared channels, still need explicit browser evidence.

### N3 UI refinement — 2026-09-30

- Reworked the channel console from a dense table/detail panel into responsive connection cards: three columns on desktop, two on medium screens, one on mobile.
- Create channel, installation link/embed code, and channel settings now open in centered modal dialogs with backdrop, Escape/close handling, and mobile sizing.
- UI labels now distinguish the website allowed to embed the widget from the direct customer chat URL; action buttons use clear icon hierarchy. Channel reads remain workspace-scoped by the authenticated membership.
- Rebuilt the channel settings form into grouped sections with agent cards, compact working-hour day cards, toggles, pre-chat field cards, widget settings and a sticky save footer. API payloads and permission boundaries are unchanged.
- Added a four-step explanatory guide and quick pre-chat form templates (Basic, Support, Full). Individual pre-chat fields no longer have an enable toggle; they stay visible and only their required/optional state is configurable. The server still receives `enabled: true` for compatibility with the existing contract.
- Converted the guide into a real wizard: only the active step is shown, Step 1–3 use `Tiếp tục`, prior steps use `Quay lại`, and Step 4 exposes the final save action.
- Fixed Step 1 `400 VALIDATION` for existing test memberships whose database UUID-shaped IDs are deterministic fixtures rather than RFC-versioned UUIDs; channel member validation now accepts the database UUID shape while retaining workspace membership checks.
- Added a reusable top-right toast for channel success/error feedback. Enable/disable, copy, create, template selection and settings save now use the toast; inline errors remain for field-level correction.
- Refined the working-hours UI with larger day switches, active/inactive day styling, clearer all-day controls, brighter time fields and responsive spacing; persistence behavior is unchanged.
- Updated Step 3 pre-chat fields to a one-column editor with `+ Thêm thông tin`, editable display label and input hint, required/optional checkbox, and a delete icon per field. Custom fields use safe generated keys, are persisted through the tenant-scoped settings API, and the UI prevents deleting the last remaining field.
- Extended the backend settings contract from the three fixed fields to safe custom field keys with a bounded maximum of ten fields; the widget already renders arbitrary configured keys and validates them against the channel configuration.
- Frontend build and tests after the refinement: PASS, 5/5 tests.

### Meta regression checkpoint
- Unmapped events were silently skipped by commit 7f50998. Temporary mitigation now rejects ingestion with META_ROUTE_UNAVAILABLE (503), allowing provider retry rather than reporting successful acceptance. This is NOT durable quarantine acceptance and can delay mapped events in mixed envelopes.
- Added regression coverage for Facebook, Instagram and WhatsApp unmapped messages. Quarantine replay now explicitly filters actor workspace.
- Remaining: durable unassigned event store, migration 075 recovery for unmapped existing rows, authenticated WhatsApp binary media delivery, OAuth/account picker, three live Page connections. Prior statements claiming these complete were too broad.

### Concurrent Meta linking guard
- Changed channel locking from FOR SHARE to FOR UPDATE before checking active bindings. Concurrent create requests now serialize on the same channel.
- Verified with two concurrent transactions against local PostgreSQL: one succeeds, the other returns META_CHANNEL_ALREADY_BOUND; exactly one connection persists. Reconnect also locks the channel first and rejects an occupied sibling before any Graph request. Backend typecheck and both focused DB tests passed. This does not yet cover alternate bootstrap writers.

### Local subscription response validation
- Subscription timestamp/audit now require HTTP success and JSON success=true; false, missing success, malformed JSON and HTTP errors leave no subscription mutation.
- Verified: backend npm run build; meta-subscription-result.test.ts (1 passed, 0 skipped). This is a mocked provider test, not live Meta acceptance.
- No push or merge. OAuth picker, durable ingress/claim/replay, authenticated media delivery and live multi-Page acceptance remain incomplete. Subscription field selection still needs platform-specific verification.
- Meta connection linking now provisions a dedicated channel automatically when the operator leaves Channel xử lý empty; this keeps each Page/account isolated without requiring a website channel first.
## Durable Meta ingress and subscription gate checkpoint (2026-10-02)
- Local branch `codex/meta-messenger-pilot` now has migrations 076–079 for a per-event Meta ingress queue, lease/retry/dead/quarantine states, expiry recovery, and an Owner/Admin claim path for events received before a Page/account mapping existed. Existing quarantine rows are imported; no payload is discarded.
- Webhook POST validates the raw-body signature and persists every normalized message/status/unsupported event before ACK. The worker claims one event under `app.meta_worker`, resolves the exact platform + external account mapping, processes it in the original workspace/connection, and publishes realtime callbacks only after commit. Unmapped or unsupported events remain quarantined instead of being assigned to a tenant.
- Migration 078 separates credential verification from live routing. `verifyMetaConnection` returns `verified`; `subscribeMetaWebhook` changes the row to `connected` only after Meta returns an explicit success. This prevents a verified token without a subscribed webhook from receiving traffic. WhatsApp remains app-level subscription; Threads remains catalog-only.
- Local evidence: `npm run build:all` passed; `tests/meta-ingress-queue.test.ts` passed 1/1 with a signed envelope containing three Page IDs across two workspaces, tenant-isolated processing, unmapped quarantine and duplicate redelivery; `tests/meta-subscription-result.test.ts` passed 1/1; `git diff --check` passed. RabbitMQ emitted reconnect warnings during the test but the test completed successfully.
- Live Meta acceptance is still pending: each of the three user-owned Pages needs a server-side token reference, a public HTTPS callback that reaches this worker, and a real Page subscription. The local test does not prove Meta live delivery. Name/avatar are stored only when Meta returns them; email/phone are never inferred. WhatsApp media still needs an authenticated download/proxy path before UI acceptance.
- Working tree contains uncommitted implementation and test changes only. No push, merge, or `main` update was performed. Next continuation: run the review diff, then perform the authenticated tester flow when public callback and per-Page credentials are available.

## Worker least-privilege checkpoint (2026-10-02)
- Review found that a custom `app.meta_worker` GUC could be forged by the application role. Migration 080 adds a dedicated `gotek_meta_worker` role and makes claim/recover/finish require `session_user` to be that role; legacy quarantine reads are no longer granted by GUC alone. Replay and annotation use tenant-scoped SECURITY DEFINER functions.
- `runMetaIngressOnce` now uses a separate `META_WORKER_DATABASE_URL` pool. If that secret is absent, the worker fails closed with `META_WORKER_DATABASE_NOT_CONFIGURED`. Provision the login/password outside Git and inject it only into the worker process. The migration intentionally creates the role as NOLOGIN until operations provisions it.
- Backend build and `git diff --check` pass after this correction. Live tester remains gated on worker credential provisioning, public HTTPS callback and per-Page tokens.

## Three-workspace routing evidence checkpoint (2026-10-02)
- `backend/tests/meta-ingress-queue.test.ts` now exercises one signed envelope containing three mapped Facebook Page accounts across three workspaces plus one unmapped Page. Each workspace receives exactly its own message and connection; the unmapped event remains quarantined. The test passes 1/1 with the dedicated worker database role.
- Workspace creation and workspace switching remain covered by the authenticated API test (2/2). No external Meta message was sent during this fixture run.

## Live Meta two-way realtime checkpoint (2026-10-02)
- Three Facebook Page events were sent from the authenticated Facebook tester and routed to their separate workspaces: GoTek, FSUB.vn - Học AI Từ Số 0, and FSUB.vn - Digital Marketing Solutions.
- Webhook ingress rows for all three Page IDs reached `succeeded`; inbox source labels retain platform, Page name, and external account ID. Profile name/avatar were received; contact fields remain unavailable when Meta does not return them.
- The local Meta worker is now intended to run continuously through `npm run dev:meta` or `npm run dev:with-meta`. Worker-to-API realtime bridge emits `inbox:refresh`, and the frontend listens for it.
- A real web-originated reply produced an `accepted` Meta delivery with a provider message ID on FSUB.vn - Học AI Từ Số 0. This proves one outbound Page, not every Page/media path.
- Local quick tunnels are temporary; live acceptance requires keeping the current tunnel process alive. No push or merge to `main`.

## History recovery safety checkpoint (2026-10-02)
- History sync is NOT accepted or enabled by default. Worker calls are gated by META_ENABLE_HISTORY_SYNC=true while implementation is completed.
- Historical inbound imports suppress AI reply jobs. Paging rejects non-Graph hosts and redirects; access_token is removed before persisting a paging URL.
- Remaining blockers: nested message pagination, outbound history, media and original timestamps, bounded scheduling/backoff, worker-role grants and tenant composite FK, restart/integration acceptance. The current draft must not be represented as complete historical recovery.
- Validation: backend typecheck and two history cursor security tests pass. No live historical import was run in this checkpoint; no push/merge.

## History checkpoint validation (2026-10-02, continuation)
- Dispatch pass runs before history; a history exception is caught per workspace instead of aborting subsequent history work. History requests remain sequential and can still delay the next realtime pass; separate scheduling remains required.
- Reject malformed Graph success payloads before advancing cursor. Added tests for busy locks, recent-completion cooldown, and malformed responses preserving cursor.
- Five focused history tests and backend typecheck pass; these are mocked unit tests, not restart/database/Meta acceptance.
- Migration 082 is authored but not applied in this checkpoint. History import remains opt-in and incomplete (nested paging, outbound/media/timestamps).

## History worker isolation checkpoint (2026-10-02)
- History recovery now has a separate `worker:meta-history` process and never waits inside the realtime Meta ingress/send loop.
- `worker:meta-history` is opt-in and requires `META_ENABLE_HISTORY_SYNC=true`; the regular worker remains realtime-only.
- Backend typecheck and diff validation pass. Live history sync remains unverified and still lacks nested pagination/media/original timestamps.

## Live history sync checkpoint (2026-10-02)
- Migration 082 applied to the local runtime database.
- Opt-in history worker ran against real configured Meta connections: workspace 3 imported 306 visitor messages and retained a Graph paging cursor (`pending`); workspace 1 imported 12 and reached `complete`; workspace 2 reached `complete` with no additional rows.
- Import is deduplicated through the existing Meta event/message keys and does not enqueue AI replies for historical rows.
- This is real local Meta evidence, not a fixture, but it is not yet full acceptance: the workspace 3 cursor needs later pages, media/original timestamps are not imported, and restart replay plus live UI verification remain open.

## History cursor completion checkpoint (2026-10-02)
- Continued the real Meta history cursor for workspace 3: imported 367 messages, then 93 messages; its checkpoint is now `complete` with no next cursor and 767 visitor messages visible under tenant scope.
- Workspace 1 remains `complete` with 15 visitor messages; workspace 2 remains `complete` with 1 visitor message.
- No provider token was persisted in cursor URLs. Realtime worker remains separate from history worker.
- Full historical acceptance is still not claimed: media/original provider timestamps and restart replay require additional work; live history import evidence is local runtime only.

## Runtime recovery and Meta callback checkpoint (2026-10-02)
- Direct Meta Developer inspection confirmed existing Messenger subscriptions on GoTek, FSUB.vn - Học AI Từ Số 0 and FSUB.vn - Digital Marketing Solutions. Earlier blanket claims that subscriptions were absent were not supported.
- The saved callback host jessica-island-thriller-produced.trycloudflare.com did not resolve; local ports 4317 and 3001 were also down. Restarted the local app and Meta worker, without database seeding or source changes. Preview returned HTTP 200; the worker processed idle cycles.
- Started a replacement temporary tunnel at https://fluid-function-register-blocking.trycloudflare.com. Authenticated verification GET returned HTTP 200 and the exact requested challenge. This proves callback reachability, not message delivery.
- The replacement URL is entered in Meta Developer but NOT saved: Verify and Save remains disabled until the existing META_WEBHOOK_VERIFY_TOKEN is entered into the verification field. Browser virtual clipboard could not consume the local clipboard; local clipboard was cleared. No token value was printed.
- Next: complete the Meta verification form, observe save success, then test the three authorized Pages and reconcile inbound/outbound provider IDs with their original workspace. Do not regenerate working Page tokens without evidence of expiry. Temporary tunnel depends on its running process. No push or merge performed.

## Nested Messenger history pagination correction (2026-10-02)
- Found a concrete source defect: only the first expanded messages page was read, so a conversation with more than 100 messages could be marked complete with missing older messages.
- History importer now follows nested message paging before updating the outer checkpoint; validates Graph host, strips URL tokens, rejects redirect/error/malformed responses, and bounds repeated paging.
- Validation: meta-history.test.ts 7/7 passed, backend TypeScript build passed. Tests use mocked provider/database, not live or restart acceptance.
- Still incomplete: historical Page-originated replies are explicitly skipped in history.ts; two-way historical acceptance must not be claimed. Nested paging currently completes within one transaction and has a 100-page bound; resumable per-conversation paging remains needed for larger histories. Meta callback save remains pending. No push/merge.

## Page-originated history implementation (2026-10-02)
- Historical Page replies are no longer skipped. The importer resolves the single non-Page participant, rejects ambiguous recipients, and records public agent-side history with no local staff attribution. It retains the provider timestamp, attachments and connection-scoped message ID.
- A dedicated history repository records these already-sent messages without enqueueing outbound/AI jobs or changing conversation ownership. Existing GoTek receipts are checked to avoid duplicating a reply already sent from the inbox.
- Evidence: history and history-reply focused tests 10/10 PASS; backend build and diff check PASS. These are mocked tests, not database/concurrent/restart/live acceptance.
- Next: database integration for historical customer/Page pairs, provider receipt race, attachments and restart dedupe; validate timeline ordering and external Page attribution in UI. No live history run was triggered, no push or merge.

## Historical two-sided database regression (2026-10-02)
- Added opt-in meta-history-database.test.ts. Ran with META_HISTORY_DB_TEST=true against local PostgreSQL using gotek_app, in a transaction rolled back in finally (no fixture rows committed).
- PASS 1/1: Page and customer history persist with correct author side/original timestamps; repeated scan keeps two messages; no AI/send jobs; owner remains unchanged; another tenant cannot read the fixture messages. Provider transport is mocked.
- This does not cover live Meta delivery, restart across committed transactions, concurrent receipt races, or full API/worker/UI acceptance. Next: verify timeline ordering, which may still use insertion sequence for historical rows. No push or merge.

### 2026-10-02 — Inbox timeline and complete message pagination
- Inbox rendering orders messages by provider timestamp, preserving durable sequence as the pagination cursor. Latest-message SQL uses timestamp then sequence.
- Frontend now loads beyond the first 100 messages, rejects non-advancing cursors, discards stale requests after workspace changes, and preserves unconfirmed sending messages.
- Validation: frontend tests 15/15 PASS; backend and frontend build PASS (existing bundle-size warning). Full ingestion suite and live two-way Meta acceptance remain pending.
- Public callback challenge checked again: HTTP 200 and exact challenge match. Browser CDP timed out before command dispatch, so Meta console save is not confirmed by this check. No push or merge.

### 2026-10-02 — Provider delivery status in Inbox
- Message history API reads Meta receipt by workspace, message and original connection. Public agent/AI messages without receipt report queued instead of sent.
- UI distinguishes accepted, failed and unknown from delivered/read. This fixes misleading presentation; it does not prove live delivery.
- Validation: build:all PASS; scalar receipt lookup backed by UNIQUE(workspace_id,message_id). Live receipt-to-UI verification and full integration tests remain pending. Branch codex/meta-messenger-pilot; no push/merge.

### 2026-10-02 — Receipt projection database coverage
- Extended opt-in rollback database test to call inboxMessages and verify accepted/sent/delivered/read/failed/unknown projection, existing receipt invisibility under another tenant, and foreign-workspace conversation rejection.
- Initial test attempted DELETE on receipts; gotek_app correctly denied it. Removed that fixture operation without widening database grants. Receipt-free queued fallback still needs a dedicated fixture.

### 2026-10-02 — Historical Page sender attribution
- Historical public agent messages without a local actor now identify the source Page/account and display “Tin từ tài khoản nền tảng”, avoiding fabricated staff attribution. Lookup is scoped to conversation connection and workspace.
- Conversation detail latest-message timestamp comes from all persisted messages by provider time, not the first 100-message response.
- Opt-in database rollback test PASS including sender attribution and six receipt states; backend typecheck PASS. OAuth/account picker is still absent: connections currently resolve server environment token references. Live acceptance remains unverified.

### 2026-10-02 — Compact Inbox source filters and running history recovery
- Replaced native multi-select boxes with platform toggle chips and expandable Page/account checkboxes; source IDs remain secondary text and names wrap. Frontend build PASS.
- Process inspection found outbound worker running but no history worker. Started dev:meta-history (session 27104); observed one workspace complete/imported=5 and failures for other iterations. Full history is NOT confirmed.
- Read-only outbound diagnostic session 40418 in progress; initial workspace result: six succeeded jobs and one running. This is not recipient-delivery proof. Continue with per-connection history failures and provider error diagnostics; do not reset jobs or resend unknown outcomes. No push/merge.

### 2026-10-02 — Isolate inbound dispatch latency
- Found combined Meta loop awaits profile fetch/outbound provider calls before next ingress sweep. Added ingress-only and dispatch-only process modes; dev:meta now launches separate lanes. Ingress advances tenant cursor instead of always scanning first 100 tenants. Internal realtime bridge now has 5-second timeout.
- Backend typecheck PASS. Ingress-only one-shot smoke process session 40850 still running at checkpoint; previous combined runtime not yet replaced. Do not claim live fix deployed. Next: inspect DB waits, finish smoke test, gracefully replace combined process, verify real tester inbound and outbound.

### 2026-10-02 — Runtime lanes and callback verified
- Graph API app subscriptions GET returned HTTP 200, object page active=true, callback https://fluid-function-register-blocking.trycloudflare.com/meta/webhook. No credential values logged.
- Gracefully stopped old combined worker PID 85058 and verified exit. Started independent inbound session 24690 and outbound session 80761; history remains session 27104. dev:meta uses npx concurrently because root binary was absent.
- Live tester-to-Inbox-to-tester proof remains pending; active callback and running workers alone are insufficient.

### 2026-10-02 — Live Page permission diagnostic
- Read-only GET subscribed_apps for Page IDs 1267396789788615,107825635331883,1285832874604365 returned HTTP 403, Graph code 200 with current server token refs. GoTek error explicitly: Requires pages_manage_metadata permission to manage the object.
- This demonstrates insufficient metadata permission for this operation, NOT absence of Page subscriptions and NOT proof pages_messaging is missing. App-level callback was independently active. Need inspect/re-authorize Page token scopes and verify per-Page subscriptions/live tests. No token printed.
- Several connected rows are old fixture accounts with missing env token refs; do not delete them automatically.

### 2026-10-02 — Token and ingress evidence
- GoTek debug_token HTTP200: valid PAGE token for app1678095707658415, pages_messaging present, pages_manage_metadata absent. Do not equate subscription-inspection403 with missing send permission.
- Scoped read-only ingress aggregation for workspace24f7d642-00aa-47c6-ae77-d32d4047aeec:10 succeeded,27 quarantined META_EVENT_UNSUPPORTED; latest succeeded received2026-10-02T14:13:06.845Z. This proves some events reach processing, not UI delivery or full coverage. Inspect unsupported event normalization next, especially echoes.
- History worker now logs only stable HttpError code/workspace on failure, no payload or secrets. Backend typecheck PASS; running history process needs graceful restart to load logging change.

### 2026-10-02 — Provider webhook timestamps
- Normalization previously dropped Messenger/Instagram event timestamp and WhatsApp message timestamp. Now preserves valid provider time (milliseconds vs seconds), avoiding arrival-time substitution after delayed delivery. Six inbound tests PASS and backend typecheck PASS.
- Quarantined payload structure inspection showed message, delivery and read event families. Payload is individual event, not entry wrapper; next inspect echo flag and watermark keys without logging message contents. Echo and watermark support remains incomplete; no live completion claimed.

### 2026-10-02 — Valid Page echo ingestion
- Normalizer accepts provider echo only when sender equals entry account, recipient is a distinct customer and provider timestamp valid. Marks Page reply direction; processing records agent-side message through receipt dedupe, suppresses AI/send jobs and publishes message_sent refresh.
- Ten focused tests PASS, backend typecheck PASS; rollback DB test PASS including duplicate live echo, agent direction and absence of AI/outbound jobs.
- Running ingress process must be refreshed to load handler change; unknown quarantined echoes have NOT been replayed. Live two-way verification and watermark receipts remain pending.

### 2026-10-02 — Echo worker runtime refreshed
- Gracefully stopped ingress PID90627, verified exit, started updated ingress session27181; observed repeated successful idle sweeps.
- Current quarantined aggregate in scoped workspace:7 echoes,13 delivery watermark,11 read watermark. Counts changed with new arrivals; these are not31 lost customer messages.
- Existing replay explicitly rejects unknown event kinds. Need controlled re-normalization/reclassification and watermark support; do not blindly requeue unchanged unknown events or change old records directly. Echo handling is loaded in worker; live client proof still pending.

### 2026-10-02 — Receipt customer binding correction
- Actual quarantined webhook structure confirms customer sender / Page recipient. Normalizer now assigns recipientId from sender and rejects missing sender or mismatched Page recipient. Previously it assigned Page ID as recipient.
- Eight inbound and two status tests PASS; backend typecheck PASS. Renamed misleading normalization test: it does not prove projection monotonicity. Watermark-only callbacks and replay remain unfinished.

### 2026-10-02 — Outbound receipt realtime notification
- Outbound worker now notifies API realtime bridge after successful send transaction and successful job settlement, so Inbox can reload accepted receipt without waiting for another inbound callback.
- Bridge reports missing configuration and non-2xx HTTP via stable codes, with 5s timeout; no payload/secrets logged. Backend typecheck PASS. Live UI verification and worker runtime reload remain pending.

### 2026-10-02 — Runtime outage recovery
- Fresh process/port inspection found all app, Meta workers and tunnel stopped. Restarted app session17134; Vite3001/API4317 report listening. RabbitMQ unavailable.
- Docker daemon unavailable at user socket; launched Docker Desktop. No database reset/seed performed. Direct inbound29923/outbound63072 processes currently report iteration failure while dependencies are unavailable.
- Concurrent npx startup hit cache ENOTEMPTY; used direct worker scripts without deleting npm cache. Tunnel absent, callback restoration remains pending after database recovery. Do not claim live receipt fixed.

### 2026-10-02 — Restored public callback after runtime outage
- Docker postgres/redis/rabbitmq healthy; direct inbound29923/outbound63072 recovered from connection failures to idle sweeps.
- New tunnel session38442 URL https://jews-truck-invision-available.trycloudflare.com. Challenge returned exact expected value. Read existing App page subscription fields, preserved them and updated callback via authenticated Graph API:HTTP200 success=true. No token output, no permission expansion.
- API/frontend session17134 running. History process still needs restart; live tester roundtrip and full goal acceptance remain pending.

### 2026-10-02 — History connection isolation and restart
- History worker uses one transaction per connection, preserving completed Page imports if another Page fails. Returns per-connection stable error codes and emits realtime refresh after committed imports.
- Backend typecheck PASS. Runtime session66898 restarted history: two live connections complete, one more/paginating in first observed sweep; fixture connections report META_TOKEN_NOT_CONFIGURED. No claim all historical content verified.
- Failure-isolation integration test still required. No data reset or push/merge.

### 2026-10-02 — History retry cooldown
- Retry checkpoint cooldown now runs before credential validation, so missing credentials do not fail every worker sweep. Failed connections wait 60 seconds; retries retain the saved paging cursor.
- Focused history tests PASS 9/9, including missing-token cooldown and expired retry resuming the saved cursor. Backend typecheck PASS.
- Running history process has not been refreshed for this change. Full integration suite, durable nested pagination, OAuth picker and receipt watermark handling remain open; live acceptance deferred. No push or merge.

### 2026-10-02 — Channel-scoped worker refresh
- Internal worker realtime bridge validates UUIDs and resolves connection channel within a tenant-scoped database transaction before publishing; missing mappings return 404.
- Workspace broadcasts exclude visitor subscriptions; channel-scoped broadcasts deny Agents with missing channel membership rather than failing open.
- Realtime scope regression PASS across Owner, assigned Agent, other-channel Agent, missing memberships, visitor and foreign workspace. Backend typecheck PASS. HTTP bridge integration test and live acceptance remain pending. No push/merge.

### 2026-10-02 — Realtime HTTP contract regression
- Added HTTP test through createApp: unauthorized requests avoid DB, malformed identifiers return 400, missing mapping returns 404 without broadcast, valid mapping resolves tenant channel and publishes after COMMIT.
- HTTP and hub tests PASS 2/2; backend typecheck PASS. HTTP test mocks database transport and does not prove real RLS or end-to-end Meta delivery. Those integration gates remain open; live acceptance deferred.

### 2026-10-02 — Retained Facebook echo replay
- Owner/Admin replay now permits previously unknown raw Facebook messages only when the current normalizer recovers exactly one event matching immutable Page and external message IDs. Worker re-normalizes independently before ordinary connection validation and deduplicated processing.
- Unsupported events remain quarantined; Instagram/WhatsApp recovery is unchanged. No stored payload overwritten and no live replay triggered.
- Normalizer and inbound regression tests run this checkpoint; full replay API/database/worker integration remains required.

### 2026-10-02 — Outbound failure visibility
- Inbox resolves receipt-less Meta send status from scoped dispatcher jobs: dead/cancelled -> failed, unknown or succeeded without provider receipt -> unknown, pending/running -> queued. Provider receipt remains authoritative.
- Meta worker emits refresh after terminal failure/unknown settlement when source connection resolved; media validation/caption rejections are known terminal failures.
- Delivery status unit tests PASS; backend typecheck PASS. Extended rollback database test PASS for queued/dead/unknown/succeeded-without-receipt inbox projection. Initial fixture failed jobs receipt constraint, corrected fixture; all inserted data rolled back. No real sends, push or merge.
- OAuth picker, durable nested history, watermark receipts and whole-pipeline tests remain open.

### 2026-10-02 — Durable nested history pagination
- Added migration 083 pending_threads checkpoint; applied transactionally to local database with migration ledger. Existing messages preserved.
- History does one Graph request per pass, saves nested message-page cursors and participant identity separately from outer conversation cursor, then resumes pending threads before advancing outer pages. Removes all-pages-in-one-transaction and 100-page ceiling. Tokens stripped from persisted cursors; self-repeating cursor rejected.
- History tests PASS 10/10, rollback database integration PASS including persisted nested resume, duplicate messages, both directions and tenant isolation; backend typecheck PASS.
- Rollback: deploy previous history code only after nested work drained or explicitly restart scan; preserve checkpoint column/data. Do not drop pending cursors while work remains. Runtime worker has not been reloaded. Longer cursor cycles, expired provider cursors, Graph historical media format and live acceptance remain unverified. No push or merge.

### 2026-10-02 — Encrypted Page credential foundation
- Migration084 adds tenant-scoped encrypted credential storage with composite connection FK and worker read-only access; applied locally without migrating existing env tokens.
- AES-256-GCM envelope binds token to workspace/connection/purpose. Missing key or authentication failure fails closed; key comes from META_CREDENTIAL_ENCRYPTION_KEY (32-byte base64), never database. Existing env credentials remain fallback only when no stored credential exists.
- Verification/subscription, history, profile and outgoing text/media now resolve stored credentials server-side. Tokens do not enter jobs or API responses.
- Vault/history tests PASS11/11; rollback DB test PASS for encrypted resolution and cross-tenant invisibility; backend typecheck PASS. No real token persisted, no key configured yet. OAuth state/callback/account picker still needs implementation. No push/merge.
- Provider account-discovery reference: https://www.postman.com/meta/facebook/request/bqfxwbp/get-access-tokens-of-pages-you-manage . Official Meta login manual documentation returned429; callback contract needs further verification.

### 2026-10-02 — Facebook OAuth and multi-Page picker implementation
- Added tenant/session/user-bound OAuth state with 15-minute expiry, one-use callback, encrypted Page account list, paginated server discovery and account selection restricted to the offered set. API callback returns only session UUID to Channels; no provider tokens enter frontend.
- Owner/Admin can select multiple Pages in new FacebookConnect UI. Each Page connects independently; verification and subscription must succeed before connected status. Existing Page in same workspace reconnects in place; global uniqueness preserves cross-workspace ownership. Legacy server test configuration retained.
- Migration085 applied locally. OAuth unit test PASS; real PostgreSQL rollback test with mocked Graph PASS for two Pages/two channels, credential resolution, wrong session, unoffered Page and cross-tenant session isolation. Backend/frontend build PASS (existing large bundle warning). No live OAuth tested or real tokens stored.
- Required runtime config: META_APP_ID, META_APP_SECRET, META_OAUTH_REDIRECT_URI ending /api/meta/oauth/callback on the same browser origin as GoTek session, META_CREDENTIAL_ENCRYPTION_KEY (32 random bytes base64; back up securely). Redirect must be allowlisted in Meta App. HTTPS required except localhost development. All API/worker processes must share encryption key before storing actual tokens.
- Remaining OAuth gates: HTTP callback/session expiry tests, concurrent cross-workspace Page claim, rejected subscription rollback, browser picker verification, expired-token handling and configurable Graph version consolidation. Full Facebook objective still open; no push/merge and live acceptance deferred.

### 2026-10-02 — Review remediation: configuration and Graph version consistency
- Removed runnable database/broker/runtime defaults from .env.example; placeholders are empty and local credentials remain generated by db:setup.
- Profile lookup now uses validated META_GRAPH_API_VERSION with the same v25.0 fallback as the send adapter, avoiding hard-coded version drift.
- Removed trailing whitespace and blank EOF issues reported by git diff --check. Backend and full build:all PASS; focused profile/OAuth/vault tests PASS.
- Remaining review findings are architectural (route/controller/repository split), receipt watermark reconciliation, live OAuth/browser integration and media end-to-end. No push/merge.


### Facebook watermark receipt continuation (2026-10-02)
- Normalize durable delivery/read watermark callbacks with customer-scoped stable event IDs; avoid also quarantining recognized callbacks as unknown.
- Reconcile only against provider Page-echo timestamps on the same workspace/connection/customer. Local message creation time is not sufficient evidence of provider send time. Receipt state cannot regress from read.
- Reconcile again when delayed echoes arrive and when outbound receipts are recorded. Missing echo evidence leaves the existing status unchanged.
- Verified: backend typecheck; 6/6 focused tests including rollback-only PostgreSQL history/receipt test (watermark before/after echo, later message exclusion, monotonic status, tenant isolation). No live Meta acceptance in this pass; full suite not rerun.
- Remaining: full Facebook OAuth/UI and ingestion regression review; history media completeness; retained pre-change watermark replay. No commit/push/merge.


### Facebook history media continuation (2026-10-02)
- Added Graph-history attachment normalization for image_data.url, video_data.url, file_url; preserved webhook-shaped compatibility, HTTPS validation and video precedence over image thumbnails.
- History requests now honor validated META_GRAPH_API_VERSION (same v25.0 fallback as OAuth), removing the hardcoded v26.0 initial request.
- Rollback PostgreSQL test now verifies customer video and Page image reach message_attachments and inboxMessages; provider transport is mocked.
- Verified 21/21 focused tests with no skips: history, media, OAuth two-Page linking, encrypted credentials and receipts. Backend typecheck and diff whitespace check pass.
- Meta documentation fetch returned HTTP 429; actual provider media payload/live playback remains unverified and is deferred with live acceptance. Parser support does not establish full historical media availability.
- Remaining: browser OAuth/UI regression, full ingestion integration coverage, retained watermark replay, attachment pagination/unavailable-media behavior. No commit, push or merge.


### Review remediation — WebSocket commit boundary (2026-10-02)
- Deferred takeover, message ACK, conversation and inbox publications until transaction resolves after COMMIT. Rollback does not publish queued callbacks; publication errors cannot be reported as persistence failures.
- ACK/message IDs now use appendMessage's persisted ID, including idempotent retries, instead of a newly generated unused ID.
- Verified backend typecheck and existing WebSocket membership-revocation/channel-isolation integration test. Dedicated forced-commit-failure regression still required; existing test does not prove that scenario.
- Review remains open. No commit/push/merge; full-suite database environment failures are unresolved.


### Review loop update (2026-10-02)
- Moved AI and bot controller Zod DTOs to `backend/src/dtos/` and replaced controller `Promise<any>` with service-derived return types.
- Added opt-in `META_WORKER_ENABLED=true` scheduler in backend startup for durable Meta ingress and Facebook history passes; it remains disabled unless a trusted worker database URL and explicit environment are configured.
- Fixed WebSocket post-commit publication boundary; ACK and realtime broadcasts now run only after COMMIT.
- Focused Meta/Realtime suite: 73 passed, 9 skipped (database-dependent skips), 0 failed. `npm run build:all` passed; only existing frontend chunk-size warning remains. Full `npm run test:all` still requires the configured PostgreSQL test socket and is not a clean environmental run.
- Remaining review P2: frontend channel component/API-layer separation and tokenized color cleanup. Remaining Facebook acceptance: browser/provider live test and fresh clean DB migration run. No commit, push or merge.


### Scheduler corrective review (2026-10-02)
- Replaced overlapping setInterval passes with serial loops; persisted tenant pagination cursor between passes so tenants beyond the first 100 are serviced.
- History loop is independent from ingress; shutdown waits for active work before closing the worker pool. Meta startup no longer waits for RabbitMQ initialization.
- Corrected widget form default back to a literal hex value: CSS var() is styling syntax, not valid color-input/API configuration data. Earlier token substitution broke this contract.
- Backend typecheck and two scheduler concurrency/pagination/drain regression tests passed. Not a full review completion; outgoing dispatch still uses the separate explicit worker process.
- No commit/push/merge. Remaining findings and full integration/clean-database checks remain open.


### Facebook Graph configuration review (2026-10-02)
- Centralized version selection for send, profile, OAuth, connection verification/subscription and new history scans. META_GRAPH_API_VERSION wins; legacy META_GRAPH_VERSION remains supported; malformed configuration falls back to v25.0 consistently with existing send contract. Saved history paging URLs remain unchanged.
- Removed subscription/verification hardcoded v20.0 divergence. WhatsApp media resolver remains outside this Facebook-focused change.
- Backend typecheck and 22 focused tests passed without skips. Full review still open; no Git publication.


### Receipt queue dedupe correction (2026-10-02)
- Found P1: ingress uniqueness used provider message ID + generic status kind, so delivery could consume the same queue key as a later read callback.
- Status queue identity now hashes provider event ID, status and recipient; original provider IDs remain unchanged in normalized payload/meta_events for reconciliation. Hash bounds queue key length.
- Verified six normalization/queue tests and rollback PostgreSQL regression: delivery + read produce exactly two durable rows even after duplicate envelope replay. Backend typecheck passed.
- Existing callbacks already discarded by old dedupe cannot be reconstructed from missing payload; subsequent provider callbacks are required. No data deletion/migration or Git publication.


### Ingress retry atomicity (2026-10-03)
- Added a PostgreSQL savepoint around each claimed Meta ingress projection. If normalization/profile/message/status processing fails, projection and dedupe writes roll back before the event is marked retry/quarantined; post-commit notifications are cleared. A lost lease now aborts cleanly rather than publishing.
- Added rollback database regression proving a failed projection leaves no `meta_events` dedupe row and remains retryable.
- Backend typecheck and database regression pass. No commit/push/merge.


### Worker role validation (2026-10-03)
- Meta ingress/history transactions now verify authenticated session_user and effective current_user are gotek_meta_worker with neither superuser nor BYPASSRLS privileges. Misconfiguration fails before projection/history queries.
- Added documented disabled-by-default scheduler/worker URL settings to .env.example without secrets.
- Backend typecheck and four focused role/scheduler tests pass; role tests use mocked DB responses and do not replace dedicated-role database integration acceptance.
- Review remains open; no commit/push/merge.


### Retained Facebook receipt replay (2026-10-03)
- Quarantine replay and ingress worker now recognize retained raw delivery/read events, including watermark-only callbacks. Route and immutable original envelope hash/provider event identity must match.
- Recovered statuses use existing monotonic reconciliation; no message creation path is invoked. Existing authorization/expiry/tenant gates remain.
- Nine parser/queue regression tests and backend typecheck passed; full worker/database replay integration remains to verify. No live replay or Git publication performed.


### Expired Meta ingress cleanup (2026-10-03)
- Added migration 086 with a bounded, worker-role-only cleanup function for expired quarantined/succeeded/dead ingress rows. Processing/retry rows are retained until settled.
- Scheduler invokes cleanup before each ingress pass; payloads are not exposed to the app role.
- Backend typecheck and scheduler/role tests pass. Migration must be applied on the target database before enabling the scheduler. No commit/push/merge.

### Final Facebook code-audit checkpoint (2026-10-03)
- npm run build:all passed. Facebook/Meta, scheduler, replay, history, OAuth, receipt, realtime and role test selection: 79 passed, 9 skipped only where PostgreSQL integration environment is not enabled; 0 failed. git diff --check passed.
- Source remains on codex/meta-messenger-pilot; 85 changed/untracked entries are still local. No commit, push, pull or merge was performed in this checkpoint.
- Code-level Facebook work is substantially complete for the requested pre-acceptance stage. Live Meta webhook/provider delivery, applying migrations 076-086 to a clean target database, and browser acceptance remain explicit gates before production/live claim.

### Final local verification (2026-10-03)
- Frontend suite: 15/15 passed. git diff --check passed.
- No source publication was performed. Live Meta and clean-database migration gates remain intentionally separate from local verification.

### Scheduler cleanup regression (2026-10-03)
- Added a regression proving expiry cleanup executes before each ingress pass and remains serialized.
- Backend typecheck and three scheduler tests pass; diff whitespace check passes.
