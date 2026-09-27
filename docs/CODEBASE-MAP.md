# Codebase map

## Entry points

| Path | Purpose / important dependencies / caution |
|---|---|
| `src/server/index.ts` | Local HTTP listener, Vite or built UI; production prohibited |
| `src/server/app.ts` | Workspace/auth API composition and error middleware; changes affect shared contracts |
| `src/server/db.ts` | pg pool/transaction/RLS scope; DATABASE_URL or private `.local/runtime.json` |
| `src/server/security.ts` | Argon2, token hashing, role checks, audit/challenges |
| `src/server/platform.ts` | Separate platform authorization, registry, grants, agent routes |
| `src/server/platform-agent.ts` | Durable admin chat requests, independent provider invocation |
| `src/server/provider-transport.ts` | Provider HTTP protocols, timeout/response errors; never log credentials |
| `src/server/widget.ts`, `widget-embed.ts`, `public/sdk.js` | Public origin/key/session boundaries and embed runtime |
| `src/server/channels.ts`, `inbox.ts`, `chat-store.ts` | Channel access/config, inbox actions, sequence/idempotency/ownership |
| `src/server/worker.ts`, `ai-reply-worker.ts`, `jobs.ts` | Queue lifecycle, AI orchestration, dispatch fences; never collapse unknown into retry |
| `src/server/quota.ts`, `usage-ledger.ts`, `token-metering.ts` | Entitlements, reservation settlement and token accounting |
| `src/server/knowledge*.ts`, `document-extract.ts`, `pdf-extract.ts` | Manual/import knowledge, versions/chunks, publish, lexical/semantic retrieval |
| `src/server/web-source*.ts`, `web-refresh-worker.ts`, `web-generations.ts`, `web-snapshot*.ts` | Fetch policy, static crawling/sitemaps, schedules/snapshots, knowledge generation publishing |
| `src/server/contacts.ts`, `data-collection.ts`, `onboarding.ts` | Contact lifecycle/merge, collection config, onboarding records |
| `src/server/rules.ts`, `rules-transfer.ts`, `ai-rule-snapshot.ts` | Versioned rules, import/export and prompt snapshots |
| `src/server/audit-log.ts`, `audit-export.ts`, `support.ts`, `session-maintenance.ts` | Administrative audit, bounded export, support grants, expiry cleanup |
| `src/web/main.tsx` | Browser route switch, auth forms, shell, membership/general/audit screens |
| `src/web/Inbox.tsx`, `Knowledge.tsx`, `WebSources.tsx`, `Platform.tsx` | Main feature UI; inspect associated API/services before editing |
| `src/web/api.ts` | JSON fetch/error translation; includes CSRF request header |
| `db/migrations/` | Ordered SQL source of schema and privileges; run through setup script |
| `scripts/` | Setup, workers, restore drill and operational helpers |
| `tests/` | Node test runner/tsx, Supertest and DB integration fixtures |
| `delivery/` | Backlog, contracts, decisions, checkpoint and historical validation evidence |
| `research/` | HiChat observation/specification evidence, not proof of internal implementation |
| `.agents/skills/` | Project delivery skill and reference documents |
| `.ai/skills/project-context/` | Portable continuation workflow |
| `.local/`, `node_modules/`, `dist/` | Local runtime/dependencies/build artifacts; not source handoff |

## Where to change what

- Login/reset/session policy: `app.ts`, `security.ts`, migrations and authentication tests.
- Tenant boundary: `db.ts`, `app.ts:identity`, relevant service SQL, RLS migrations; add negative cross-workspace tests.
- Widget origins/prechat/assignment: `widget.ts`, `channels.ts`, `business-hours.ts`, widget/inbox tests.
- AI reply grounding/ownership: `ai-reply-worker.ts`, `knowledge-retrieval.ts`, `workspace-prompt.ts`, `worker.ts`.
- Model protocol: `provider-transport.ts`; registration/permissions: `platform.ts`, `model-grant-policy.ts`.
- Knowledge publication: `knowledge-lifecycle.ts`, `knowledge-chunk-store.ts`; web generations: `web-generations.ts`.
- Database change: add a migration in `db/migrations` and inspect foreign keys, grants and forced RLS together.
- UI change: corresponding `src/web` component plus `style.css`/feature stylesheet; first consult HiChat screen evidence.

There are duplicate-looking filenames containing ` 2` in the current tree. Preserve them until imports/history are audited; filenames alone do not prove safe deletion. Read [HANDOFF](HANDOFF.md) before continuing unfinished work.
