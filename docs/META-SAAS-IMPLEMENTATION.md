# H30.01 — Meta SaaS connector implementation

Status: IN PROGRESS. User authorized Facebook first, then Instagram, with commits on codex/chatbot-delivery and PR review. This is GoTek's connector design, not inferred HiChat internals.

## Scope and acceptance

1. Owner/Admin connects through Meta OAuth, selects an authorized business asset. State is random, expires, single-use and bound to session/user/workspace; callback rechecks membership. Never accept client workspace IDs as authority.
2. Persist encrypted tokens, granted scopes, asset ID, channel mapping, expiry and connection status. Same external asset cannot silently bind to another tenant. Reconnection/disconnection is audited; no plaintext tokens in responses/logs.
3. Verify webhook HMAC over raw bytes. Persist inbound receipts before acknowledging; deduplicate provider event IDs, map asset to tenant server-side, prevent echo loops and handle out-of-order deliveries.
4. Normalize into existing conversation/message contracts. History sync is paginated and resumable, limited by provider access. No claim of unlimited historical inbox access.
5. Human and AI outbound use a durable outbox, current connection/scope/window/ownership checks and provider receipts. Unknown outcomes require reconciliation; do not blindly resend.
6. AI is opt-in per channel, uses public knowledge and existing quota/dispatch ownership fences. Internal notes never go to Meta.
7. UI Connect/status/reconnect/disconnect, empty/loading/denied/failure states, per-channel role checks and Inbox source labels. Test two tenants, revoke, duplicate/reordered webhooks, expired tokens and unknown delivery outcomes.
8. Instagram adapter is a distinct provider/login scope family; do not substitute Messenger token/endpoints. Verify current Meta contracts before transport implementation.

## Planned API and storage boundary (not implemented yet)

Authenticated /api/integrations/meta endpoints for status, OAuth start, asset selection, reconnect and disconnect; Owner/Admin channels.manage required. Callback consumes server-side OAuth state and redirects only to a fixed app route. Public /integrations/meta/webhook GET for challenge and POST for signed receipts must precede JSON parser. All tenant data uses RLS and transaction-local scope. Raw ingress lookup requires a deliberately bounded privileged resolver, not global tenant bypass in request handlers.

New ordered migrations will cover OAuth attempts, connections, inbound receipts and outbox. External asset uniqueness and workspace foreign keys must be explicit. Retention and deletion policy remains an acceptance decision, not an invented indefinite retention default.

## Configuration required for live verification

Meta App ID, server-side App Secret, webhook verify secret, token encryption key, chosen Graph API version, HTTPS staging origin/callback, test Page and Instagram Professional account. Only IDs/domain may appear in handoff; secrets through private environment. No credentials supplied yet. Business verification/App Review may proceed alongside development. No production send or customer account connection during local tests.

## Git coordination

Existing PR #4 remains open on codex/chatbot-delivery. New connector work is not complete merely because previous remediation CI passed. Start with additive backend/src/modules/meta files. Fetch before push; reject remote divergence; never force push or replace another contributor branch. Review shared app/router/channel/worker changes against origin/nguyen before integration. No merge/main push or automatic customer messaging.

## Checkpoint

Implemented only raw-byte HMAC verification and AES-256-GCM token envelope with tenant/asset authenticated context. Tests cover tampering, foreign tenant/asset, malformed signature/key and nonce uniqueness. These utilities are not yet wired to endpoints. Next: verify official OAuth/webhook contracts, ordered schema and RLS, OAuth state repository, authenticated connect flow; then durable inbound/outbound and UI. Real Meta receipt and App Review remain unverified.

## Server OAuth configuration

New `backend/src/modules/meta/config.ts` requires explicit configuration and has no default live API version:
- `META_GRAPH_VERSION`: version supported/configured for the Meta App.
- `META_FACEBOOK_APP_ID`, `META_FACEBOOK_APP_SECRET`, `META_FACEBOOK_REDIRECT_URI`, `META_FACEBOOK_LOGIN_CONFIG_ID`.
- `META_INSTAGRAM_APP_ID`, `META_INSTAGRAM_APP_SECRET`, `META_INSTAGRAM_REDIRECT_URI` (Instagram API with Instagram Login; use its own app credentials).
- Callback URI must be server-configured HTTPS without userinfo/query/fragment; register the identical URI in Meta. No request-supplied callback is accepted.
- Facebook uses a Login for Business configuration; Instagram requests only business basic and messaging scopes. Config helper does not constitute provider approval or route activation.
- Missing/malformed configuration returns stable `META_NOT_CONFIGURED`, without secret details.

Reference: Meta-maintained Instagram collection https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login and Messenger conversations collection https://www.postman.com/meta/messenger-platform-api/folder/22794852-255610cd-47f5-4f4d-b3fa-71aec360be9a . Verify the Facebook Login for Business configuration against the actual app dashboard before live acceptance.

## Instagram send contract reference (2026-10-01)

Meta-maintained collection: https://www.postman.com/meta/instagram/request/scob1z4/text-message and https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-fc851f39-7194-4522-a475-2cea8de46d16 . Instagram Login uses graph.instagram.com with account token, recipient.id and message.text; adapter only accepts a matching recipient_id plus message_id as API acceptance. This is not delivery/read proof. Internal transport implemented with fixtures, not activated before tenant-bound connection, scope/window and outbox integration.
