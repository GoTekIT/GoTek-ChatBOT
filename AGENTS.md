# Project

GoTek Chatbot: multi-business customer chat, tenant-scoped widget/knowledge/AI and staff handoff. HiChat is a reference product; do not infer its private API/architecture.

## Current objective and status

Current task is an accurate handoff snapshot. Preserve unfinished work; do not implement features during documentation audit. Development objective afterward: core backend first, then evidenced UI and remaining H01–H32/E01–E12. MVP IN PROGRESS; consult [PROJECT-STATUS](docs/PROJECT-STATUS.md) and [HANDOFF](docs/HANDOFF.md) for exact stopping point. Test passes are not full product acceptance.

## Stack and map

TypeScript strict, Express, React/Vite, PostgreSQL via pg, SQL migrations, Argon2/cookie sessions. `src/server` backend; `src/web` UI; `public/sdk.js` widget; `db/migrations`; `scripts` setup/workers/drill; `tests`; `delivery` requirements/evidence; `research` reference observations; `docs` current handoff.

## Commands

`npm ci`; `npm run db:setup` (existing local PostgreSQL cluster required); `npm run dev`; `npm run build`; `npx tsc --noEmit`; `npm test`; `npm run db:restore-drill`. No lint script. Read DEVELOPMENT before setup: `.env` is not auto-loaded; runtime defaults to ignored `.local/runtime.json`. Tests use a dedicated DB and run serially.

## Environment rules

Read [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) before creating `.env`, starting a worker or testing a provider. `.env.example` contains placeholders only; export variables explicitly, keep `.env`/`.local` out of Git, and provide provider secrets through the exact server-side `providers.secret_ref` name. `NODE_ENV=production` is intentionally rejected by current entrypoints.

## Architecture / database / API / authentication rules

- Derive tenant from authenticated membership or validated widget credential, never trust arbitrary client workspace ID.
- Use transaction-local tenant scope, parameterized SQL and RLS; app role must not BYPASSRLS.
- Preserve platform/workspace permission separation. Platform Admin does not automatically read tenant chat; support grant is scoped, expiring and audited.
- Provider secrets stay server-side. Visitor sees only eligible public published content, never internal notes/private knowledge.
- Preserve idempotency, ownership fences, quota reservation and unknown-outcome handling.
- Add ordered migrations; do not rewrite deployed migration history without explicit authorization.
- Follow existing stable error and validation conventions; inspect contracts before changing them.

## Before modifying code

Read README, docs/00-START-HERE, PROJECT-STATUS, HANDOFF, relevant architecture/flow/known issues. Inspect implementation and dependencies, identify tests, make minimal coherent changes. User requests override stale reference snapshots. For parallel work assign disjoint files and serialize shared DB tests/git operations.

## After modifying code

Run relevant tests/build/typecheck and manual flow where applicable. State exact checks not run. Update affected docs, PROJECT-STATUS and HANDOFF; preserve goal/current code/files/issues/next command when stopping mid-task.

## Do not

Do not invent contracts or completion; do not discard unfinished source; do not expose secrets; do not commit .local/.env; do not force push; do not rewrite working modules unnecessarily. No service purchases, customer messaging or production deployment without user authorization. Backend first; UI changes require HiChat screen evidence and GoTek identity. Explicitly label UNKNOWN / NEEDS VERIFICATION.

## Shared protocol

[Portable skill](.ai/skills/project-context/SKILL.md). Current handoff: [docs/HANDOFF.md](docs/HANDOFF.md).
