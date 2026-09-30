# API surface

Base URL in local development: `http://127.0.0.1:4317`. Workspace routes are under `/api`; public website widget routes are under `/widget-api`. All non-GET `/api` requests require `X-Gotek-Request: 1` and matching `Origin` (default `http://127.0.0.1:4317`). Cookies are HttpOnly; do not put session/provider secrets in JSON. Inputs are strict Zod schemas; responses and exact fields should be read in the handler before integration.

## Common contract

- Success usually returns JSON directly; mutations may return `{ok:true}` or a resource. Validation returns HTTP 400 `{error:"VALIDATION",fields}`. Stable auth/tenant/permission codes include `UNAUTHENTICATED`, `FORBIDDEN`, `PLATFORM_FORBIDDEN`, `WORKSPACE_DISABLED`, `DOMAIN_DENIED`, `VISITOR_SESSION_EXPIRED`, `STALE_REPLY_OWNER`, `MODEL_NOT_GRANTED`, `PROVIDER_SECRET_MISSING`, `RATE_LIMITED`, `CONFLICT` and `INTERNAL`.
- `src/web/api.ts` prefixes `/api`, sets JSON content type and the CSRF header, parses stable error codes into Vietnamese labels. Widget clients call `/widget-api` directly.
- Every authenticated workspace handler obtains membership from the session and sets DB tenant scope. A client-supplied workspace ID is not trusted; endpoint-specific IDs are checked against that scope.

## Authentication and workspace

Authorization update (2026-09-30): `/api/me` now includes workspace `permissions` and a safe user projection without password hashes. Workspace Owner/Admin/Agent and Platform Admin remain separate. Member revocation invalidates sessions for that workspace; role changes apply on the next API request. See [authorization contract](AUTHORIZATION.md).

| Method/path | Auth / purpose | Handler |
|---|---|---|
| POST `/api/auth/signup` | Public; creates user + workspace + Owner + quota; generic 202 | `app.ts` |
| POST `/api/auth/login` | Public; Argon2 verification and session cookie | `app.ts` |
| POST `/api/auth/logout` | Public; deletes current session | `app.ts` |
| POST `/api/auth/request-reset` | Public generic response; local reset delivery | `app.ts` |
| POST `/api/auth/reset` | Public one-time token/password | `app.ts` |
| POST `/api/auth/verify` | Public one-time email token | `app.ts` |
| POST `/api/auth/resend` | Session; creates local verification delivery | `app.ts` |
| GET `/api/health` | Public local-test health | `app.ts` |
| GET `/api/me` | Session; identity, memberships, platform flag | `app.ts` |
| GET/PATCH `/api/workspace` | Owner/Admin for PATCH | `app.ts` |
| POST `/api/workspace/switch` | Membership required | `app.ts` |
| GET `/api/members` / PATCH `/api/members/:id` | Owner/Admin; role/active and seat/final-owner checks | `app.ts` |
| GET `/api/invitations` / POST `/api/invitations` / POST `/api/invitations/:id/revoke` / POST `/api/invitations/accept` | Owner/Admin to manage; session + verified invited user to accept | `app.ts` |
| GET `/api/usage`, GET `/api/usage/ai` | Owner/Admin; bounded usage/ledger views | `app.ts`, `quota.ts` |
| GET `/api/jobs` | Owner/Admin; job metadata | `app.ts`, `jobs.ts` |

## Channels, inbox and widget

| Method/path | Purpose / auth | Handler |
|---|---|---|
| GET/POST `/api/channels` | Workspace channel list/create; admin for mutation | `channels.ts`, `app.ts` |
| GET/PATCH `/api/channels/:id/settings` | Channel config (origin, prechat, business hours, widget options) | `channels.ts` |
| GET/PATCH `/api/channels/:id/agents` | Channel assignment membership/capacity | `channels.ts` |
| PATCH `/api/channels/:id/state` | Enable/disable channel | `channels.ts` |
| GET `/api/channels/:id/installation` | Embed/public key installation metadata | `channels.ts` |
| GET `/api/conversations` | Inbox list, status/search/assigned filters and channel membership | `inbox.ts` |
| GET `/api/conversations/:id/messages` | Cursor messages, membership scoped | `inbox.ts` |
| POST `/api/conversations/:id/takeover` | Human takeover with ownership version | `inbox.ts` |
| POST `/api/conversations/:id/resume-ai` | Authorized explicit return to AI with version | `inbox.ts` |
| POST `/api/conversations/:id/messages` | Agent public/internal message, idempotent client ID | `inbox.ts` |
| PATCH `/api/conversations/:id/status` | Open/resolved/snoozed | `inbox.ts` |
| GET `/widget-api/:key/config` | Public exact-origin channel config/prechat | `widget.ts` |
| POST `/widget-api/:key/session` | Public exact-origin visitor token/conversation bootstrap | `widget.ts` |
| POST `/widget-api/:key/profile` | Visitor bearer; prechat profile update | `widget.ts` |
| GET `/widget-api/:key/state`, GET `/widget-api/:key/messages` | Visitor bearer state/cursor messages; public visibility only | `widget.ts` |
| POST `/widget-api/:key/messages` | Visitor bearer append + conditional AI enqueue | `widget.ts` |
| POST `/widget-api/:key/handoff` | Visitor asks human; cannot choose agent/resume AI | `widget.ts` |
| POST `/widget-api/:key/receipts` | Visitor acknowledgement for public replies | `widget.ts` |
| GET `/widget.js` | Public embed loader | `widget-embed.ts` |

## Knowledge and web sources

| Method/path | Purpose / status | Handler |
|---|---|---|
| GET/POST/PATCH `/api/knowledge`, `/api/knowledge/:id` | Manual knowledge item/draft CRUD | `knowledge.ts` |
| POST `/api/knowledge/imports`, GET `/api/knowledge/imports`, GET `/api/knowledge/imports/:id`, GET `/api/knowledge/imports/:id/file` | Bounded multipart/import lifecycle | `knowledge-imports.ts`, `document-extract.ts` |
| POST `/api/knowledge/:id/process`, `/publish`, `/rollback` | Process/publish/rollback version | `knowledge-lifecycle.ts` |
| GET `/api/knowledge/:id/chunks`, POST `/api/knowledge/retrieve` | Stored chunks and lexical/semantic retrieval preview | `knowledge-chunk-store.ts`, `knowledge-retrieval.ts` |
| GET/POST `/api/knowledge/categories` | Category listing/creation | `knowledge-categories.ts` |
| GET/POST `/api/data-collection`, POST `/api/data-collection/complete` | Collection configuration/onboarding completion | `data-collection.ts` |
| POST/GET/DELETE `/api/citations` | Active citation create/list/revoke | `active-citations.ts` |
| POST/GET `/api/onboarding/sources`, POST `/api/onboarding/ready` | Onboarding source and ready state | `onboarding.ts` |
| GET/POST `/api/web-sources`, PATCH `/api/web-sources/:id/state`, GET `/api/web-sources/:id/preview`, POST `/api/web-sources/:id/refresh`, GET `/api/web-sources/:id/snapshots`, GET `/api/web-sources/:id/snapshots/:snapshotId` | URL policy/source/schedule snapshot operations | `web-sources.ts` |
| POST `/api/web-sources/:id/schedule`, GET `/api/web-sources/:id/schedule` | Schedule read/write | `web-source-schedule.ts` |
| POST `/api/web-sources/:id/generations`, POST `/api/web-generations/:id/publish`, POST `/api/web-generations/:id/rollback` | Snapshot generation/publish lifecycle | `web-generations.ts`, `web-snapshot-generation.ts` |
| GET/POST/PATCH `/api/ai-rules`, `/api/ai-rules/:id/state` | Versioned AI rules | `rules.ts` |
| POST `/api/ai-rules/export`, POST `/api/ai-rules/import` | Rule transfer | `rules-transfer.ts` |

## Contacts, audit and support

| Method/path | Purpose / auth | Handler |
|---|---|---|
| GET/POST/PATCH/DELETE `/api/contacts`, `/api/contacts/:id` | Contact list/create/update/soft-delete/restore | `contacts.ts` |
| POST `/api/contacts/merge/preview`, POST `/api/contacts/merge`, POST `/api/contacts/merge/undo` | Revisioned merge lifecycle | `contacts.ts` |
| GET `/api/contacts/export` | Bounded contact export | `contacts.ts` |
| GET/PUT `/api/contacts/:id/tags`, GET `/api/contact-tags` | Tag management/list | `contacts.ts` |
| GET `/api/audit`, GET `/api/audit/export` | Keyset audit list and bounded NDJSON-in-JSON export | `audit-log.ts`, `audit-export.ts` |
| GET `/api/support`, POST `/api/support`, POST `/api/support/:id/revoke` | Owner/Admin support grants with scope/reason/expiry | `support.ts` |

## Platform Admin API

All `/api/platform/*` routes require a session joined to active `platform_admins`; they set platform RLS and audit actor. Provider secret values are never accepted in request body; requests carry only an environment variable reference.

| Method/path | Purpose |
|---|---|
| GET `/api/platform/registry` | Providers/models/grants |
| POST `/api/platform/providers`, PATCH `/api/platform/providers/:id/state`, POST `/api/platform/providers/:id/test` | Register, enable/disable, connectivity test |
| POST `/api/platform/models`, PATCH `/api/platform/models/:id/state` | Model registry state |
| POST `/api/platform/grants`, PATCH `/api/platform/grants/:id/state` | Workspace capability grants, including expiry where supported |
| GET `/api/platform/workspaces/:id`, PATCH `/api/platform/workspaces/:id/state` | Tenant inspection/state |
| GET `/api/platform/support/:id` | Inspect explicit support grant |
| GET `/api/platform/agent/sessions`, GET `/api/platform/agent/sessions/:id/messages` | Actor-owned platform-agent history |
| POST `/api/platform/agent/chat` | Detached durable admin agent request; actor/session/idempotency/recovery are covered locally, while token/cost/quota ownership and live receipt remain `UNKNOWN / NEEDS VERIFICATION` |

Route names above are extracted from the current app/service code; exact request schemas evolve with Zod handlers and tests. There is no generated OpenAPI document. Treat undocumented endpoints or browser assumptions as **UNKNOWN / NEEDS VERIFICATION** and add tests before relying on them.
