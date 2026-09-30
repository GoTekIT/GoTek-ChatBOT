# Project

GoTek Chatbot: multi-business customer chat, tenant-scoped widget/knowledge/AI and staff handoff. HiChat is a reference product; do not infer its private API/architecture.

## Current objective and status

Current task is an accurate handoff snapshot. Monorepo refactoring completed (`backend/` + `frontend/` + `infra/` + `gitops/` + `mobile/`). Preserve unfinished work; do not implement features during documentation audit. Development objective afterward: core backend first, then evidenced UI and remaining H01–H32/E01–E12. MVP IN PROGRESS; consult [PROJECT-STATUS](docs/PROJECT-STATUS.md) and [HANDOFF](docs/HANDOFF.md) for exact stopping point. Test passes are not full product acceptance.

## Stack and map

TypeScript strict, Express 5, React 19 / Vite 6, PostgreSQL 16 via pg, SQL migrations, Argon2/cookie sessions.
- Monorepo root orchestrates tasks via npm scripts and Docker compose.
- `backend/`: Express API service, Clean Architecture (`core/`, `modules/`, `controllers/`, `services/`, `repositories/`, `dtos/`, `routes/`, `middlewares/`), `backend/db/migrations/`, `backend/public/sdk.js`, `backend/scripts/`, `backend/tests/`.
- `frontend/`: React 19 / Vite SPA, Screen-based architecture (`api/`, `screens/`, `components/common/`, `hooks/`, `styles/`), `frontend/tests/`.
- `infra/`: Terraform and Docker/Nginx reverse proxy configurations.
- `gitops/`: Kubernetes deployment manifests (`base/`).
- `mobile/`: Mobile application client skeleton.
- `scripts/`: Root automation and orchestration scripts (`dev.sh`, `build.sh`, `deploy-prod.sh`).
- `docs/`: Comprehensive system architecture and handoff documentation.

## Commands

- `npm run install:all`: Install dependencies for root workspace, backend, and frontend.
- `npm run dev`: Run both backend (port 4317) and frontend (port 3001) concurrently.
- `npm run dev:backend`: Run backend API server standalone.
- `npm run dev:frontend`: Run frontend Vite dev server (with automatic API proxy).
- `npm run build:all`: Typecheck and build both backend and frontend.
- `npm run test:all`: Run test suites across backend and frontend.
- `npm run test:backend`: Run backend unit and integration tests.
- `npm run test:frontend`: Run frontend unit tests.
- `npm run db:setup`: Setup local database and apply migrations.
- `npm run db:restore-drill`: Execute disposable restore drill and verify row hashes.
- `npm run prod:up` / `npm run prod:down`: Manage production docker-compose stack.

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
- Follow Clean Architecture: controllers handle HTTP, services own business rules, repositories own SQL queries.

## Before modifying code

Read README, docs/00-START-HERE, docs/PROJECT-STRUCTURE, PROJECT-STATUS, HANDOFF, relevant architecture/flow/known issues. Inspect implementation and dependencies, identify tests, make minimal coherent changes. User requests override stale reference snapshots. For parallel work assign disjoint files and serialize shared DB tests/git operations.

## After modifying code

Run relevant tests/build/typecheck and manual flow where applicable (`npm run build:all`, `npm run test:all`). State exact checks not run. Update affected docs, PROJECT-STATUS and HANDOFF; preserve goal/current code/files/issues/next command when stopping mid-task.

## Do not

Do not invent contracts or completion; do not discard unfinished source; do not expose secrets; do not commit .local/.env; do not force push; do not rewrite working modules unnecessarily. No service purchases, customer messaging or production deployment without user authorization. Backend first; UI changes require HiChat screen evidence and GoTek identity. Explicitly label UNKNOWN / NEEDS VERIFICATION.

## Shared protocol

[Portable skill](.ai/skills/project-context/SKILL.md). Current handoff: [docs/HANDOFF.md](docs/HANDOFF.md).
Detailed System & Component Design: [docs/SYSTEM-DESIGN-AND-STANDARDS.md](docs/SYSTEM-DESIGN-AND-STANDARDS.md).
Project Structure & Vibe Coding Guide: [docs/PROJECT-STRUCTURE.md](docs/PROJECT-STRUCTURE.md).
SOLID & Structure Rules: [.agents/rules/architecture_solid_and_structure_rules.md](.agents/rules/architecture_solid_and_structure_rules.md).
