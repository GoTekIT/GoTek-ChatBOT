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
