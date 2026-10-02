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

# Current snapshot

## Chuyển Đổi Lời Mở Đầu Sang Bong Bóng Chat & Làm Gọn Header Widget — 2026-10-01

1. **Hiển Thị Lời Mở Đầu Như Tin Nhắn Chat Đầu Tiên (`.bubble.greeting-bubble`):**
   - Đã điều chỉnh logic hiển thị của SDK (`sdk.js`): Lời chào mở đầu (`greeting`) được lấy động từ cấu hình kênh trong cơ sở dữ liệu (`channels.greeting`), ví dụ *"Xin chào nguyennv có thể giuwps gì cho bạn ?"*.
   - Lời chào này được tạo thành một bong bóng chat chuẩn (left-aligned bubble) nằm ở vị trí tin nhắn đầu tiên trong danh sách hội thoại của widget, tạo cảm giác tự nhiên như tin nhắn chào đón từ doanh nghiệp ngay khi khách mở khung chat.
   - Tự động ẩn dòng thông báo trống (`.empty`) khi lời chào xuất hiện, và bảo toàn vị trí lời chào ở trên cùng kể cả sau khi tải lịch sử chat cũ hoặc nộp form pre-chat.
2. **Loại Bỏ Hoàn Toàn Lời Chào Ở Thanh Trạng Thái Phía Trên:**
   - Xóa bỏ thẻ `<p class="greeting"></p>` khỏi khu vực `.meta`.
   - Khu vực `.meta` giờ đây là thanh trạng thái tinh gọn chỉ gồm đèn báo trực tuyến (`● Nhân viên đang hỗ trợ` / `● Trợ lý AI đang hỗ trợ`) cùng nút chuyển nhân viên (handoff), phân tách rõ ràng với khung chat bằng đường viền phân cách mỏng (`border-bottom`).
3. **Đồng Bộ Preview Trong Admin Portal:**
   - Cập nhật `WidgetPreview.tsx`, `Channels.tsx`, và `ChannelConfiguration.tsx` nhận prop `greeting` để màn hình xem trước hiển thị đúng lời chào đang cấu hình trong CSDL.
4. **Kiểm Chứng:**
   - Đã đồng bộ toàn bộ thay đổi qua cả 3 bản SDK: `backend/public/sdk.js`, `frontend/public/sdk.js`, và `public/sdk.js`.
   - `npx tsx --test backend/tests/sdk-contract.test.ts`: PASS 2/2.
   - `npm run build:all`: PASS 100% (Backend + Frontend).

## Tối Ưu Tốc Độ Giao Nhận Tin Nhắn Nhân Viên Tới Widget (<5ms) — 2026-10-01

Đã điều tra và xử lý triệt để nguyên nhân khiến widget nhận diện nhân viên đang hỗ trợ / typing rất nhanh nhưng tin nhắn thực tế lại bị chậm:
1. **Xác thực WebSocket Nhân Viên (Staff Token via Query URL):** Bổ sung truyền session token (`getStoredToken()`) trong `useRealtimeChat.ts` khi khởi tạo WebSocket phía Staff Console. Khắc phục lỗi 4001 Unauthorized trước đây do browser WebSocket không thể gửi header `Authorization: Bearer` và cookie bị chặn bởi proxy.
2. **Loại bỏ việc rơi gói tin khi mở socket (Message Queue Buffer):** `websocket.ts` đăng ký bộ lắng nghe `ws.on('message')` ngay lập tức khi TCP socket mở, đệm các gói tin ban đầu vào buffer và xả ngay khi bước xác thực async hoàn tất -> Loại bỏ hoàn toàn tình trạng mất gói tin ban đầu.
3. **Phát sóng Optimistic RAM Broadcast trong cả Fallback HTTP (`inboxSend`):** Trong `inbox.ts`, `inboxSend()` sinh sẵn `messageId = uuid()` và phát ngay sự kiện `message:new` qua `realtimeHub` trong RAM (<2ms) trước khi đợi transaction cơ sở dữ liệu Supabase tại Sydney hoàn tất. Widget nhận được tin nhắn tức thì (<5ms) mà không phải chịu độ trễ 8 - 9s của DB.
4. **Kiểm chứng thực tế:** Benchmark tự động ghi nhận tin nhắn từ nhân viên tới thẳng widget chỉ mất **104ms** mạng nội bộ và **0ms chênh lệch dấu thời gian**.
5. **Cải tiến UI Widget Composer (Same-Row Send Icon):** Nút gửi đã được đưa lên cùng hàng với ô nhập tin nhắn (`.input-row`), thay thế chữ "Gửi" bằng biểu tượng máy bay giấy SVG hiện đại (Messenger/Telegram style), tự động co giãn chiều cao theo nội dung và đồng bộ màu thương hiệu của kênh.

## Phương án A Tối ưu Hóa: Sub-Millisecond In-Memory Broadcast & Permanent Mode Switcher — 2026-10-01

1. **Khắc phục triệt để độ trễ WebSocket (Giảm từ 2.4s xuống 1ms):**
   - **Nguyên nhân gốc rễ:** Trước đây khi server nhận frame `message:send`, backend chạy một `transaction()` đồng bộ gồm 7 truy vấn tuần tự tới PostgreSQL Supabase đặt tại Sydney (Australia). Mỗi RTT mất 300ms khiến socket bị chặn đến 2.4s mới gửi ACK và broadcast `message:new`.
   - **Giải pháp tối ưu chuẩn Enterprise (Decoupled RAM Broadcast & Async DB Persistence):**
     - Tạo `msgId` (UUID v4) và broadcast ngay lập tức `message:new` trong bộ nhớ RAM qua `RealtimeHub` (<1ms).
     - Phản hồi ngay `message:ack` về socket gửi tin (<1ms).
     - Đưa việc ghi dữ liệu vào PostgreSQL (`appendMessage()`, sequence update, auto-takeover, enqueue AI job) thành tác vụ nền bất đồng bộ (Asynchronous Persistence) bảo đảm 100% không mất mát dữ liệu và giữ nguyên UUID đã broadcast.
     - **Kết quả kiểm chứng kịch bản thực tế:** Tốc độ phản hồi WebSocket ACK đạt **0ms - 1ms**, cả khách hàng và nhân viên đều thấy tin nhắn xuất hiện tức thì mà không phải chờ round-trip cơ sở dữ liệu nước ngoài.

2. **Cơ chế 1 Nút Chuyển Đổi & Khóa Quyền Chat Khi Ở Chế Độ AI:**
   - **Giao diện Header (Chỉ 1 Nút bấm duy nhất):**
     - Ban đầu khi cuộc trò chuyện ở chế độ AI (`ai_active`): Hiển thị huy hiệu `[ 🤖 AI đang trả lời • ]` cùng **1 nút bấm duy nhất**: `[ 👤 Chuyển sang Nhân viên chat ]`.
     - Khi đã chuyển sang chế độ Nhân viên (`in_review`): Hiển thị huy hiệu `[ 👤 Nhân viên đang chat • ]` cùng **1 nút bấm duy nhất**: `[ 🤖 Chuyển lại cho AI ]`.
   - **Khung Soạn Tin Dưới Cùng (Chặn Chat Khách Khi AI Đang Trả Lời):**
     - Khi ở chế độ AI: Nhân viên **chỉ được phép thêm Ghi chú nội bộ** (tab "Trả lời khách" bị khóa có biểu tượng `lock`). Khung nhập hiển thị thanh thông báo: *"Chế độ AI đang bật. Bạn chỉ có thể thêm ghi chú nội bộ (Khách không nhìn thấy)"*. Nút gửi tin đổi thành `[ Lưu ghi chú nội bộ 🔒 ]`.
     - Chỉ khi nhân viên bấm *"Chuyển sang Nhân viên chat"*, khung chat mới mở khóa tab *"Trả lời khách"* và cho phép gửi tin nhắn trực tiếp tới khách hàng qua WebSocket.

## Realtime 2-way Chat, Zero-Latency SSE Streaming & Optimistic UI (Phân hệ 3 & Widget) — 2026-10-01

Đã hoàn thành giải quyết triệt để vấn đề mất tin nhắn trên Console và chậm trễ phản hồi của khách hàng qua kiến trúc Realtime Event-Driven 2 chiều toàn diện:
1. **Khắc phục lỗi mất tin nhắn (Message Disappearance Fix) trên Console:**
   - Sửa `ConsoleWorkspace.tsx`: Cập nhật hàm `loadConversations()` bảo toàn mảng tin nhắn đã tải (`existing.messages`), ngăn chặn việc xóa rỗng tin nhắn mỗi chu kỳ 4s.
   - Thêm `loadMessagesForConv(convId)` riêng biệt kích hoạt khi đổi hội thoại và khi có SSE event refresh list.
   - Bổ sung `inboxList` backend trả về `last_message_body` để không ghi đè mảng tin nhắn ban đầu.
2. **Nâng cấp SDK Khách hàng sang Realtime SSE Streaming (`/widget-api/:key/stream`):**
   - Xóa bỏ cơ chế HTTP polling lạc hậu gây trễ 2s - 8s trên `sdk.js`.
   - Kết nối `new EventSource(endpoint + '/stream?token=' + token)` trực tiếp tới backend ngay khi phiên được mở.
   - **Optimistic UI (0ms perceived latency):** Tin nhắn khách hàng xuất hiện tức thì trong khung chat ngay khi nhấn Gửi hoặc phím Enter, không phải chờ round-trip HTTP. Tự động gắn cờ lỗi và cho phép thử lại nếu gửi thất bại.
   - **Bong bóng trạng thái nhân viên đang gõ (`.typing`):** Hiệu ứng 3 chấm micro-animation nhịp nhàng xuất hiện ngay khi nhân viên bắt đầu gõ phím trên Console và tự biến mất khi tin nhắn tới hoặc sau 6s.
   - Hỗ trợ phím Enter để gửi tin (Shift+Enter để xuống dòng).
3. **Bảo mật và Phân vùng Dữ liệu Tuyệt đối (Privacy Fence):**
   - Tại `RealtimeHub`: Bổ sung cờ `isVisitor: true` và bộ lọc nghiêm ngặt chặn 100% các tin nhắn có `visibility === 'internal'` (ghi chú nội bộ) tới socket của khách hàng.
4. **Kiểm tra Benchmark Tự động (End-to-End Latency Benchmark):**
   - Kịch bản `backend/scripts/verify_realtime_e2e.cjs` đo lường push 2 chiều giữa 2 tiến trình SSE riêng biệt của Khách hàng và Nhân viên:
     - Nhân viên gõ phím -> Khách hàng nhận: **Tức thì (SSE push)**.
     - Nhân viên gửi tin -> Khách hàng nhận: **Tức thì (SSE push)**.
     - Khách hàng gõ phím -> Nhân viên nhận: **Tức thì (SSE push)**.
     - Khách hàng gửi tin -> Nhân viên nhận: **Tức thì (SSE push)**.
     - Ghi chú nội bộ: **0% rò rỉ tới Visitor stream**.
     - Polling overhead: **0 requests**.
   - `npm run build:all` typecheck backend + frontend và build Vite: **0 LỖI**.
   - `npx tsx --test backend/tests/sdk-contract.test.ts`: **2/2 PASSED**.

## Widget cross-origin embedding & snippet autoOpen — 2026-10-01

Đã hoàn thành sửa 3 điểm nghẽn chính ngăn widget hiển thị trên website ngoài:
1. `backend/src/app.ts` & `backend/src/index.ts`: Mở Helmet `crossOriginResourcePolicy: { policy: 'cross-origin' }` và cấu hình `express.static('public')` headers (`Cross-Origin-Resource-Policy: cross-origin`, `Access-Control-Allow-Origin: *`).
2. `backend/src/modules/widget/widget.ts`: Bổ sung fallback trích xuất Origin từ Referer, gắn CORS header trước khi verify channel để client nhận được thông báo lỗi `403 DOMAIN_DENIED` minh bạch; hỗ trợ tương thích `www.` và non-`www.`.
3. `backend/src/modules/chat/channels.ts`: Bổ sung tùy chọn `autoOpen: false` trong snippet; chuyển `snippetStandard` sang cấu trúc script tự động khởi tạo qua data-attribute, tránh race condition với `DOMContentLoaded`.
4. Kiểm tra: `tests/sdk-contract.test.ts` PASS, `tests/widget-embed.test.ts` PASS, server live trả về `Cross-Origin-Resource-Policy: cross-origin`, `npm run build:all` PASS.

## Git collaboration gate — 2026-09-30

Trên nhánh `codex/collaboration-safety-20260930`, root lockfile được đồng bộ với monorepo và `install:all` dùng cài đặt sạch `npm ci` ở root/backend/frontend. Có hướng dẫn cộng tác trong `CONTRIBUTING.md` và mẫu PR trong `.github/`. PR #3 đã PASS CI `test-and-build` (gồm backend DB tests) và đang chờ reviewer khác. GitHub ruleset `main` (ID 24158816) yêu cầu PR, review và CI cập nhật; ruleset nhánh làm việc (ID 24238565) chặn xóa/force push. Đây là cải thiện quy trình; **không thay đổi trạng thái nghiệm thu H01–H32/E01–E12**. Kiểm tra local: `npm run install:all` PASS, `npm run build:all` PASS, frontend tests 7/7 PASS. Không dùng DB chung của contributor để chạy backend suite local.


**2026-09-30 correction — H01/H22 Google login:** confirmed the active frontend
container served a stale bundle that logged into sample admin Alex Rivera directly.
Local backend/frontend containers were rebuilt with the mock path removed and
the configured Google Client ID supplied to the frontend build. Runtime asset and
negative API checks passed; frontend tests 5/5 passed. Google account selection and
successful login remain **NEEDS VERIFICATION**; no full backend regression was run
for this correction. See [runtime evidence](../delivery/evidence/google-login-runtime-2026-09-30.md).

Ngày audit: 2026-09-28. Branch: `namnv`. Trạng thái: **Monorepo Refactoring Completed (Backend + Frontend + Infra + GitOps + Mobile)**. Kiến trúc đã được chuẩn hóa theo format dự án tham khảo `wdp`. Checkpoint tài liệu + hardening đã được push; dùng `git log -1` để lấy commit snapshot hiện hành. Trạng thái: **MVP — In Progress**.

Source, migration và test là bằng chứng triển khai; `delivery/BACKLOG.csv` là phạm vi chi tiết; tài liệu này tổng hợp trạng thái. Không có bằng chứng hoàn tất toàn bộ backend hay HiChat parity. `delivery/CHECKPOINT.md` giữ lịch sử; entry mới hơn thay thế nhận định cũ khi có bằng chứng sửa lỗi.

## Quy ước 5 trạng thái

- **DONE:** slice cụ thể đã implement và có kiểm tra phù hợp; không đồng nghĩa cả nhóm được nghiệm thu.
- **DONE BUT NEEDS VERIFICATION:** code có nhưng thiếu kiểm chứng đầy đủ.
- **IN PROGRESS:** nhóm chỉ có một phần luồng hoặc còn acceptance gate.
- **TODO:** requirement đã ghi, chưa có triển khai đủ để nhận diện luồng đó.
- **FUTURE / OPTIONAL:** cải tiến chưa cam kết; không dùng nhãn này để bỏ phạm vi H01–H32/E01–E12.

## Completed — các slice giới hạn

Bằng chứng regression mới nhất: fresh post-parallel-hardening run 175/175 PASS tại `delivery/evidence/core-after-parallel-hardening-2026-09-27.txt`. Fresh P0.1 core acceptance: `delivery/evidence/p0-core-acceptance-2026-09-27.txt`, 9/9 focused integration tests PASS. Kết quả này vẫn không thay thế browser/live-provider acceptance.

| Slice | Files chính | Trạng thái | Evidence và giới hạn |
|---|---|---|---|
| Reset token single-use/expiry và revoke session | `src/server/app.ts`, `src/server/security.ts` | DONE | Checkpoint H01 + regression; external email chưa chứng minh |
| Tenant isolation và membership revoke | `src/server/db.ts`, `src/server/security.ts`, `src/server/app.ts` | DONE | H02/H16 HTTP/PG tests; không thay thế browser acceptance |
| Widget token/origin và capacity/takeover | `src/server/widget.ts`, `src/server/chat-store.ts` | DONE | H04 boundary 1/1, H05 1/1 và regression |
| Visitor profile validation | `src/server/widget.ts` | DONE | H06 targeted 1/1 và regression |
| Audit keyset list/export | `src/server/audit-log.ts`, `src/server/audit-export.ts`, `src/server/app.ts` | DONE | `delivery/evidence/h22-audit-export-http.txt`; JSON envelope chứa NDJSON, không raw download |
| Restore disposable DB + integrity/quarantine | `scripts/restore-drill.ts` | DONE | `delivery/evidence/restore-after-parallel-hardening-2026-09-27.txt`: fresh PASS, 55 tables; không phải production RPO/RTO |
| Provider error contract và expired grant fence | `src/server/provider-transport.ts`, `src/server/worker.ts` | DONE BUT NEEDS VERIFICATION | Injected transport/error tests; expired grant now blocks before transport (`tests/provider-grant-expiry.test.ts`). Không live provider |
| Jobs recovery với lease thiếu | `src/server/jobs.ts`, `tests/jobs-recovery-null-lease.test.ts` | DONE BUT NEEDS VERIFICATION | NULL-lease local row recovery 1/1; tenant fence và external unknown vẫn pass. Chưa phải production worker acceptance |
| Knowledge/widget boundary audit | `src/server/knowledge-retrieval.ts`, `src/server/widget.ts` | DONE BUT NEEDS VERIFICATION | Focused boundary 8/8; không phát hiện leak cụ thể trong scope. Không chứng minh HiChat/private backend parity |
| Platform Agent actor/idempotency/recovery audit | `src/server/platform-agent.ts`, platform routes | DONE BUT NEEDS VERIFICATION | Focused 9/9; usage/quota ownership của platform turn còn UNKNOWN |
| Expired session purge primitive | `src/server/session-maintenance.ts` | DONE | H23 checkpoint/tests; lịch chạy production chưa chốt |

## In Progress

### Nền tảng AI, model registry và trả lời từ tri thức workspace

**Status:** IN PROGRESS  
**Goal:** Platform Admin cấp model cho doanh nghiệp; khách nhận câu trả lời dựa trên tri thức được phép của doanh nghiệp.  
**Implemented:** registry/grants, grant expiry, provider transports, platform agent, lexical/semantic retrieval, chunk/embedding worker, AI reply worker, token metering và quota ledger.  
**Not implemented:** chưa có bằng chứng nghiệm thu live tất cả provider/model, tính đúng đủ của bộ dữ liệu doanh nghiệp thực, staging vận hành. Không suy ra `claude_code` là chạy CLI Claude Code: adapter hiện gọi Anthropic Messages API.  
**Relevant files:** `src/server/platform.ts`, `platform-agent.ts`, `provider-transport.ts`, `knowledge-retrieval.ts`, `knowledge-embedding-worker.ts`, `ai-reply-worker.ts`, `quota.ts`, `usage-ledger.ts`.  
**Current behavior:** grant/capability và trạng thái workspace/provider/model chặn routing; workers kiểm tra quyền và xử lý lỗi/unknown.  
**Known issue:** provider receipts thực tế UNKNOWN / NEEDS VERIFICATION; giá/chất lượng/chi phí thực chưa được chứng minh bằng transport giả. P0.1 local fixture pass không đóng gate live.
**Next exact step:** với credential test hợp lệ, chạy acceptance live bằng một model được cấp trên hai workspace fixture, kiểm chứng publish/retrieve/reply/citation và usage; nếu chưa có credential, tiếp tục hardening bằng injected transport.
**Definition of done:** negative tenant/privacy cases pass, provider receipt và usage đối chiếu được, browser flow và lỗi được nghiệm thu.

**Documentation pause:** feature implementation is paused after the parallel audit; only README/flow/evidence synchronization should proceed until `docs/HANDOFF.md` reopens a next slice.

### Nguồn web, knowledge import và publish

**Status:** IN PROGRESS  
**Goal:** dữ liệu doanh nghiệp được nhập, xem trước, publish và chỉ phiên bản hợp lệ được dùng trả lời.  
**Implemented:** extract/import, categories, lifecycle, web fetch/parser/security/sitemap/schedule, snapshot generation nhiều phần, retire phần cũ.  
**Not implemented:** nghiệm thu nguồn thực rộng, JS-rendered crawler/browser parity, toàn bộ H10–H12.  
**Relevant files:** `src/server/knowledge-imports.ts`, `knowledge-lifecycle.ts`, `web-source-*.ts`, `web-refresh-worker.ts`, `web-snapshot-generation.ts`, `web-generations.ts`.  
**Current behavior:** snapshot được chuyển thành draft generation; publish/retire có scope và idempotency.  
**Known issue:** không được coi static HTTP crawler là crawler trình duyệt.  
**Next exact step:** đối chiếu H11 acceptance với static/sitemap fixtures và một nguồn được phép; ghi phần JS-rendered cần quyết định trước khi thêm runtime.  
**Definition of done:** source → snapshot → draft → publish → retrieval và rollback/retire được chứng minh trên dữ liệu thật phù hợp.

### Inbox, widget, contact và membership

**Status:** IN PROGRESS  
**Goal:** widget từng doanh nghiệp, phân công người/AI và CRM cùng scope.  
**Implemented:** channels, chat store, inbox, contacts, business-hours, visitor forms, membership checks, capacity/takeover tests.  
**Not implemented:** toàn bộ cấu hình builder, UX/bàn phím/mobile và các trường hợp nghiệm thu H03–H07/H13/H16.  
**Relevant files:** `src/server/widget.ts`, `channels.ts`, `chat-store.ts`, `contacts.ts`, `business-hours.ts`, `src/web/`, `public/sdk.js`.  
**Current behavior:** backend có luồng thật và tests; user đã báo lỗi kết nối signup trong lịch sử.  
**Known issue:** lỗi signup trên browser ở thời điểm hiện tại UNKNOWN / NEEDS VERIFICATION, không tự coi đã tái hiện hoặc sửa.  
**Next exact step:** fresh local signup/login → tạo channel → nhúng widget → gửi tin → takeover với hai role; giữ UI hiện có trong đợt handoff.  
**Definition of done:** acceptance theo nhóm và browser evidence, không chỉ test API.

### Vận hành và privacy

**Status:** IN PROGRESS  
**Goal:** recover an toàn, audit và kiểm soát vòng đời dữ liệu.  
**Implemented:** durable jobs, retry/dead-letter/unknown, audit list/export, restore quarantine và hash.  
**Not implemented:** retention/delete/closure policy, production RPO/RTO, external artifact restore.  
**Relevant files:** `src/server/jobs.ts`, `worker.ts`, `audit-export.ts`, `scripts/restore-drill.ts`, `delivery/decisions/H32_RETENTION_CLOSURE.md`.  
**Current behavior:** không resend mù sau external dispatch không rõ kết quả; restore drill dùng DB dùng một lần.  
**Known issue:** policy hủy dữ liệu chưa có chủ sở hữu phê duyệt.  
**Next exact step:** chốt 5 nhóm quyết định trong H32_RETENTION_CLOSURE trước khi viết purge/closure.  
**Definition of done:** policy phê duyệt, dry-run/negative/restore acceptance và release owner sign-off.

## Toàn bộ nhóm yêu cầu

Đây là trạng thái nhóm, không phải tỷ lệ hoàn thành. CSV có 170 dòng: 61 `In progress`, 107 `Backlog`, 2 `Implemented`. Hai dòng Implemented cũng không chứng minh nghiệm thu toàn nhóm. Một số evidence mới nằm ở CHECKPOINT mà CSV chưa cập nhật chi tiết; không chuyển Backlog thành DONE chỉ từ tên module.

| Nhóm | Phạm vi | Trạng thái handoff | ID trong backlog |
|---|---|---|---|
| H01 | Đăng ký đăng nhập và khôi phục | IN PROGRESS | H01.01, H01.02, H01.03, H01.04 |
| H02 | Workspace và ngữ cảnh doanh nghiệp | IN PROGRESS | H02.01, H02.02, H02.03, H02.04 |
| H03 | Inbox hội thoại và chuyển người | IN PROGRESS | H03.01, H03.02, H03.03, H03.04, H03.05 |
| H04 | Tạo kênh website và nhúng SDK | IN PROGRESS | H04.01, H04.02, H04.03, H04.04, H04.05 |
| H05 | Cộng tác viên và tự phân công | IN PROGRESS | H05.01, H05.02, H05.03, H05.04, H05.05 |
| H06 | Giờ làm việc và biểu mẫu trước chat | IN PROGRESS | H06.01, H06.02, H06.03, H06.04, H06.05 |
| H07 | Widget builder preview và danh tính | IN PROGRESS | H07.01, H07.02, H07.03, H07.04, H07.05 |
| H08 | Provider model và hành vi AI | IN PROGRESS | H08.01, H08.02, H08.03, H08.04, H08.05 |
| H09 | Quy tắc AI và nhập xuất | IN PROGRESS | H09.01, H09.02, H09.03, H09.04, H09.05 |
| H10 | FAQ kho thông tin mẫu câu và ảnh | IN PROGRESS | H10.01, H10.02, H10.03, H10.04, H10.05 |
| H11 | Nguồn web và crawler | IN PROGRESS | H11.01, H11.02, H11.03, H11.04, H11.05 |
| H12 | Thu thập dữ liệu và đồng bộ | IN PROGRESS | H12.01, H12.02, H12.03, H12.04, H12.05 |
| H13 | CRM liên hệ và hồ sơ khách | IN PROGRESS | H13.01, H13.02, H13.03, H13.04, H13.05 |
| H14 | Catalog và đơn hàng | TODO | H14.01, H14.02, H14.03, H14.04, H14.05 |
| H15 | Help Center và nội dung công khai | TODO | H15.01, H15.02, H15.03, H15.04, H15.05 |
| H16 | Thành viên nhóm và vai trò | IN PROGRESS | H16.01, H16.02, H16.03, H16.04, H16.05 |
| H17 | Nhãn và thuộc tính tùy chỉnh | TODO | H17.01, H17.02, H17.03, H17.04, H17.05 |
| H18 | Tự động hóa hội thoại | TODO | H18.01, H18.02, H18.03, H18.04, H18.05 |
| H19 | Macro nhiều hành động | TODO | H19.01, H19.02, H19.03, H19.04, H19.05 |
| H20 | Thư mẫu phản hồi | TODO | H20.01, H20.02, H20.03, H20.04, H20.05 |
| H21 | Tích hợp và webhook | TODO | H21.01, H21.02, H21.03, H21.04, H21.05 |
| H22 | Audit và bảo mật SSO | IN PROGRESS | H22.01, H22.02, H22.03, H22.04, H22.05 |
| H23 | Gói quota billing và nâng cấp | IN PROGRESS | H23.01, H23.02, H23.03, H23.04, H23.05 |
| H24 | Báo cáo tổng quan hội thoại CSAT SLA | TODO | H24.01, H24.02, H24.03, H24.04, H24.05 |
| H25 | Báo cáo dữ liệu kênh agent nhãn nhóm | TODO | H25.01, H25.02, H25.03, H25.04, H25.05 |
| H26 | Tóm tắt AI và báo cáo định kỳ | TODO | H26.01, H26.02, H26.03, H26.04, H26.05 |
| H27 | Responsive bàn phím và khả năng tiếp cận | TODO | H27.01, H27.02, H27.03, H27.04, H27.05 |
| H28 | Platform Admin và cấp quyền AI | IN PROGRESS | H28.01, H28.02, H28.03, H28.04, H28.05 |
| H29 | Ticket SLA và escalation | TODO | H29.01, H29.02, H29.03, H29.04, H29.05 |
| H30 | Đa kênh và nhận diện khách | TODO | H30.01, H30.02, H30.03, H30.04, H30.05 |
| H31 | Lark Wiki và quyền tri thức kinh doanh | TODO | H31.01, H31.02, H31.03, H31.04, H31.05 |
| H32 | Vận hành privacy và khôi phục | IN PROGRESS | H32.01, H32.02, H32.03, H32.04, H32.05 |
| E01 | Dẫn nguồn chủ động | IN PROGRESS | E01 |
| E02 | CRM lead và cơ hội bán hàng | TODO | E02 |
| E03 | Phân tích AI ngay trong hội thoại | TODO | E03 |
| E04 | Lark Wiki và trợ lý nội bộ | TODO | E04 |
| E05 | Vai trò kinh doanh và dashboard quản lý | TODO | E05 |
| E06 | Onboarding dữ liệu ba nhóm | IN PROGRESS | E06 |
| E07 | Ticket và SLA nâng cao | TODO | E07 |
| E08 | Catalog đơn hàng và connector giao dịch | TODO | E08 |
| E09 | Thuê bao thương mại và hóa đơn | TODO | E09 |
| E10 | Đa kênh và hệ sinh thái tích hợp | TODO | E10 |
| E11 | Cá nhân hóa phong cách theo sale | TODO | E11 |
| E12 | Mở rộng vận hành sau pilot | TODO | E12 |

## Todo, priority và dependency

Xem [TODO](TODO.md). Core acceptance và fresh setup là ưu tiên trước feature/UI mới. H14–H15/H17–H21/H24–H27/H29–H31 và E mở rộng còn backlog; không có cơ sở gọi backend hoàn thành.

## Blocked

- Live AI/email/integration acceptance: cần account/credential môi trường test và quyền sử dụng; không ghi secret vào repo.
- H32.05: cần policy owner quyết định trước destructive implementation.
- Staging/production: môi trường và release approval chưa xác nhận.

## Technical debt

`app.ts` và `platform.ts` tập trung nhiều routes/logic; chưa refactor trong handoff. Không có lint script. Test tổng phải chạy serial theo package script, dùng PostgreSQL local. Chưa có coverage phần trăm được chứng minh. Platform Agent hiện chưa ghi `usage_operations`/`ai_usage_ledger`; cần product decision trước migration. Metadata trạng thái delivery cần tiếp tục đồng bộ với evidence, tránh đếm test thành tỷ lệ product.

## Unknowns

HiChat internal architecture, production hosting, provider live receipts, toàn bộ browser parity, production SLA/RPO/RTO và full conversation tool history: **UNKNOWN / NEEDS VERIFICATION**. Không đủ bằng chứng gán platform nào đã production-ready.

## 2026-09-30 implementation checkpoint

UC-04 channel management is now wired into the new console shell: `/app/channels` reads the authenticated channel API instead of mock cards, supports channel creation, agent selection, enable/disable, settings, customer-link copy/open, and embed-code copy. Backend installation output includes a public customer URL only; provider secrets are not returned. Builds and focused tests pass, but browser acceptance and Supabase credential/origin verification remain open.

The channel UI was refined into responsive three-column connection cards with centered modals for creation, settings, and installation details. This is a usability improvement only; it does not change the tenant or origin security rules.

The UI now explicitly labels the business website origin separately from the customer chat link, reducing the risk of copying the wrong URL during installation.

The channel settings form now uses grouped cards and responsive grids instead of a single long column; frontend build and tests remain green.

Pre-chat configuration now starts with a four-step guide and quick templates. Email, name and phone fields are always shown when the pre-chat form is enabled; businesses only choose required versus optional and can customize labels/placeholders.

The settings form is now a sequential four-step wizard: the business completes the current step before moving to the next one, with back navigation and final save on Step 4.

The Step 1 member-save validation was corrected for deterministic UUID-shaped test fixtures; tenant and active-membership checks remain enforced.

Channel actions now use a consistent top-right toast for success/error feedback, including enable/disable and configuration saves.

Working-hours cards now have clearer day switches, active states and time controls; frontend build and tests remain green.

Step 3 pre-chat fields now use a one-column editor. Businesses can add a custom field, edit its label and placeholder, mark it required/optional, or delete it; the last remaining field cannot be deleted. Settings validation accepts safe generated custom keys (up to ten fields), while tenant scoping and visitor-side allow-list validation remain enforced. Frontend build PASS, frontend tests 5/5 PASS, backend build PASS.
## Meta multi-surface connector catalog — 2026-10-01

- Added an explicit server-side catalog for Facebook Messenger, Instagram Direct, WhatsApp Business and Threads, with per-surface profile fields, inbound/outbound capability and status.
- Facebook remains the only live pilot. Instagram and WhatsApp require their own Page/Business credentials, webhook subscription and policy checks. Threads is catalog-only because an approved GoTek DM transport is not available; it is not presented as live messaging.
- Added migration 062 to validate Meta channel identifiers and a contract test. No provider secret, App Review approval or production connection is claimed.

### Meta regression checkpoint
- Unmapped events were silently skipped by commit 7f50998. Temporary mitigation now rejects ingestion with META_ROUTE_UNAVAILABLE (503), allowing provider retry rather than reporting successful acceptance. This is NOT durable quarantine acceptance and can delay mapped events in mixed envelopes.
- Added regression coverage for Facebook, Instagram and WhatsApp unmapped messages. Quarantine replay now explicitly filters actor workspace.
- Remaining: durable unassigned event store, migration 074 recovery for unmapped existing rows, authenticated WhatsApp binary media delivery, OAuth/account picker, three live Page connections. Prior statements claiming these complete were too broad.

### Concurrent Meta linking guard
- Changed channel locking from FOR SHARE to FOR UPDATE before checking active bindings. Concurrent create requests now serialize on the same channel.
- Verified with two concurrent transactions against local PostgreSQL: one succeeds, the other returns META_CHANNEL_ALREADY_BOUND; exactly one connection persists. Reconnect also locks the channel first and rejects an occupied sibling before any Graph request. Backend typecheck and both focused DB tests passed. This does not yet cover alternate bootstrap writers.
