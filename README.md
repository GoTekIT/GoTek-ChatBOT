# GoTek Chatbot

GoTek Chatbot là nền tảng hỗ trợ khách hàng cho doanh nghiệp: mỗi workspace có hội thoại, widget và kho tri thức riêng; AI trả lời theo dữ liệu đã xuất bản của doanh nghiệp.

**Status: Active Development / MVP In Progress.** Core backend đang phát triển; chưa nghiệm thu toàn bộ H01–H32/E01–E12, chưa phát hành production. HiChat (hichat.asia, sản phẩm HiLab) là tham chiếu chức năng/UI; không có bằng chứng về kiến trúc backend nội bộ HiChat.

## Product purpose

Tập trung tiếp nhận khách hàng, chuyển tiếp AI/nhân viên, quản lý dữ liệu doanh nghiệp và kiểm soát model/quota từ Platform Admin. Workspace Admin và Platform Admin là hai miền quyền khác nhau.

## Main features

- ✅ Các lát cắt backend đã có kiểm thử local: auth, tenant/RLS, widget/hội thoại, tri thức có phiên bản, quota/jobs/audit. Mức xác minh từng phần ở [PROJECT-STATUS](docs/PROJECT-STATUS.md), không đồng nghĩa nghiệm thu toàn module.
- 🚧 AI grounding, provider/model registry, web ingestion và luồng agent; còn live-provider/browser acceptance.
- ⏳ Phần còn lại của H01–H32 và E01–E12 theo [backlog](delivery/BACKLOG.csv).
- ⚠️ Production bị chặn trong entrypoint; các test DB yêu cầu cluster local chuyên dụng. Không dùng dữ liệu khách thật.

## Tech stack

React 19 + Vite 6; Express 5 + TypeScript; PostgreSQL 16 qua `pg`, SQL migrations (không ORM); Argon2 và cookie session; PostgreSQL durable jobs; local file/runtime storage. Provider transports có Gemini, OpenAI/ChatGPT, Anthropic/Claude Code và custom LLM. Có adapter không đồng nghĩa đã kiểm thử API thật. Không có production hosting/CI/CD đã được xác nhận.

## Quick start

```sh
git clone https://github.com/GoTekIT/GoTek-ChatBOT.git
cd GoTek-ChatBOT
git checkout codex/chatbot-delivery
npm ci
```

Chuẩn bị PostgreSQL theo [DEVELOPMENT](docs/DEVELOPMENT.md), sau đó:

```sh
npm run db:setup
npm run dev
```

Mở http://127.0.0.1:4317. `db:setup` yêu cầu cluster đã chạy; nó không tự cài/start PostgreSQL. `.env.example` là template an toàn, còn backend **không tự đọc `.env`**; cách export biến, provider secret và worker profile nằm trong [ENVIRONMENT](docs/ENVIRONMENT.md). Mặc định kết nối qua `.local/runtime.json` do setup tạo.

## Common commands

| Command | Purpose |
|---|---|
| `npm run dev` | Express + Vite middleware local |
| `npm run build` | TypeScript check + frontend build |
| `npx tsc --noEmit` | TypeScript check |
| `npm test` | Node test runner, serial, có DB integration |
| `npm run db:setup` | Apply SQL migrations |
| `npm run db:restore-drill` | Local backup/restore verification |
| `npm run worker:ai` | AI worker, cần workspace env hoặc `-- --all` |
| `npm run worker:embedding` | Một batch embedding, cần env |
| `npm run worker:web` | Web refresh worker, cần workspace env |

Không có script lint. Xem [TESTING](docs/TESTING.md) trước khi chạy test.

## Documentation map

1. [Start here](docs/00-START-HERE.md)
2. [User guide](docs/USER-GUIDE.md)
3. [Environment and configuration](docs/ENVIRONMENT.md)
4. [Environment and database Word handoff](docs/GoTek_Chatbot_Environment_Database_Handoff.docx)
5. [Project status](docs/PROJECT-STATUS.md)
6. [Architecture](docs/ARCHITECTURE.md)
7. [System flow](docs/SYSTEM-FLOW.md)
8. [Development handoff](docs/HANDOFF.md)
9. [AI agent instructions](AGENTS.md)

Nguồn yêu cầu: [handoff v2.0](delivery/GoTek_Chatbot_Skill_Dev_Kit/handoff/GoTek_ChatBOT_Ban_giao_Dev_Toan_bo.docx), [chỉ đạo](research/USER_DIRECTION.md), [ghi chép khảo sát HiChat](research/HICHAT_AI_SPEC.md), [checkpoint](delivery/CHECKPOINT.md). Tài liệu lịch sử/snapshot không thay thế trạng thái hiện hành và bằng chứng kiểm thử.

## Visual reference and product evidence

The repository contains GoTek assets and captured HiChat reference observations. These images document the source material and current investigation; they do not prove that GoTek has pixel parity or that HiChat's private implementation is known.

![GoTek logo](public/gotek-logo.png)

| Reference | What it documents | Evidence boundary |
|---|---|---|
| ![AI data collection reference](research/ui-evidence/ai-data-collection.png) | Knowledge/data collection surface observed during HiChat research | Reference UX only |
| ![AI rules reference](research/ui-evidence/h09-rules-1440-live.png) | AI rule list and settings arrangement | Reference UX only |
| ![Knowledge reference](research/ui-evidence/h10-knowledge-1440-live.png) | Knowledge management layout and controls | Reference UX only |
| ![Web sources reference](research/ui-evidence/h11-list-live.png) | Web source list and refresh states | Reference UX only |
| ![Core scope map](delivery/GoTek_Chatbot_Skill_Dev_Kit/gotek-chatbot-delivery/assets/CORE.png) | Handoff scope illustration for the core | Planning/reference asset, not runtime architecture |
| [H09 create screenshot](research/ui-evidence/h09-rule-create-live-2026-09-25.png) | Rule creation form captured during the HiChat study | Reference interaction only; not a GoTek acceptance result |
| [H11 create screenshot](research/ui-evidence/h11-create-live.png) | Web-source creation state captured during the study | Reference interaction only; JS crawler parity is not established |
| [Inbox empty screenshot](research/ui-evidence/inbox-empty.png) | Empty inbox visual state used for UX comparison | Reference visual only; current browser acceptance is open |
| [GoTek brand palette](delivery/GoTek_Chatbot_Skill_Dev_Kit/gotek-chatbot-delivery/assets/brand-palette.png) | GoTek identity handoff asset | Brand reference; it does not describe runtime behavior |

## Product model

### Users and permission domains

| Actor | Responsibility | Boundary |
|---|---|---|
| Visitor | Opens a business widget and asks questions | Receives public published knowledge and public messages for that channel only |
| Agent | Reads assigned inbox work and replies | Workspace membership, channel assignment and conversation ownership are checked server-side |
| Workspace Admin/Owner | Configures a business workspace, channels, knowledge, rules and members | Can operate only inside active workspace membership |
| Platform Admin | Registers providers/models, grants capabilities and handles platform operations | Separate platform permission; does not automatically read tenant chat |
| Support operator | Performs an approved operational action | Requires an expiring scoped support grant with reason and audit |

Each workspace represents one business. A widget public key identifies a channel, while the visitor bearer token identifies the visitor session. Neither credential contains a provider secret. The server derives workspace scope from a session, membership or validated widget credential; a client supplied workspace ID is never trusted as authorization.

### Core value

The core path connects business data to a bounded customer answer:

1. A business creates a workspace and channel.
2. Workspace staff import or write knowledge.
3. A draft is processed and explicitly published as `PUBLIC`.
4. The widget creates a visitor session and stores an idempotent message.
5. The worker retrieves current, public, tenant-scoped context.
6. A granted provider receives the grounded prompt on the server.
7. The worker checks ownership, quota and grant state again before committing an answer.
8. A human can take over; stale AI work becomes unknown or is prevented from writing.

## Current delivery status

The current state is **MVP / core backend in progress**. The initial handoff snapshot is `fb8f2589c30d1de936c3cb6b35e067fc2558322d` on branch `codex/chatbot-delivery`; the current commit also includes the expired-grant hardening, fresh core evidence and this expanded guide.

### How to read the status and evidence

This README separates three claims deliberately:

1. **Implemented** means source code for the slice exists.
2. **Verified** means an identified local test, build, restore drill or browser check passed and the evidence file is linked.
3. **Accepted** means the required product owner/reference/live-provider/staging gate has also passed.

The repository currently contains many **Implemented + Verified** slices, but no claim that the whole product or HiChat parity is **Accepted**. A screenshot, a route, a passing fixture or a component name is not enough to close a group. Missing external evidence must remain `UNKNOWN / NEEDS VERIFICATION`.

### Verified local evidence

| Area | Current result | What this proves | What it does not prove |
|---|---:|---|---|
| Full configured regression after parallel hardening | **175/175 PASS** | Existing serial unit/integration suites plus the NULL-lease recovery regression remain green | Full product acceptance or browser parity |
| P0.1 focused core path | **9/9 PASS** | Auth, tenant isolation, widget, knowledge, grounded AI fixture, quota and audit boundaries | Live provider/email, browser, staging or production |
| Provider/grant focused contract | **19/19 PASS** | Wire shapes, stable errors, endpoint policy, embedding and expired grant fence | Vendor latency, streaming, live receipt or cost |
| Jobs recovery hardening | **1/1 new regression + existing jobs/AI recovery checks PASS** | A `running` row with a missing lease is recovered in its tenant; external unknown/no-resend semantics remain | Production worker crash/restart behavior |
| Knowledge/widget boundary audit | **8/8 PASS** | Public publication, audience, origin, token, visitor context and bounded source checks | HiChat private backend or browser parity |
| Platform Agent audit | **9/9 PASS** | Actor/session isolation, idempotency, lease recovery and redacted provider errors | Platform Agent token/cost/quota policy and live receipt |
| TypeScript/build | **PASS** | `tsc --noEmit` and Vite build | Deployment readiness |
| Restore drill after parallel hardening | **PASS, 55 tables** | Disposable database restore, hashes, policy/RLS and quarantine checks | Production RPO/RTO or external object restore |

Evidence files are in [`delivery/evidence/`](delivery/evidence/), including `core-after-parallel-hardening-2026-09-27.txt`, `build-after-parallel-hardening-2026-09-27.txt`, `restore-after-parallel-hardening-2026-09-27.txt`, `p0-jobs-recovery-2026-09-27.txt`, `p0-knowledge-widget-2026-09-27.txt` and `p0-platform-agent-2026-09-27.txt`. The source of truth for detailed status is [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md); the resumable handoff is [`docs/HANDOFF.md`](docs/HANDOFF.md).

### Documentation pause checkpoint

**Current mode: DOCUMENTATION PAUSED (2026-09-27).** The three parallel backend audits have finished and their shared validation is green. Feature implementation is paused while this README, the flow diagrams and the handoff evidence are being made clear enough for a new developer to follow. Do not start a new H/E implementation from this file until the updated `docs/HANDOFF.md` and `delivery/CHECKPOINT.md` explicitly reopen the next slice.

### H/E group status at this snapshot

This table is a scope map, not a completion percentage. A group remains `IN PROGRESS` when only backend slices or focused tests exist.

| Status | H groups | E groups |
|---|---|---|
| `IN PROGRESS` | H01–H13, H16, H22–H23, H28, H32 | E01, E06 |
| `TODO` | H14–H15, H17–H21, H24–H27, H29–H31 | E02–E05, E07–E12 |
| `DONE` | Only explicitly verified slices listed in PROJECT-STATUS | None as a whole epic |
| `DONE BUT NEEDS VERIFICATION` | Provider/grant hardening and other listed slices | None as a whole epic |

The backlog contains 170 rows: 107 `Backlog`, 61 `In progress`, and 2 `Implemented`. These values are intentionally not mass-promoted by passing tests. Group acceptance still requires UI, API/data, permissions, failure states, side-effect evidence and the applicable reference/owner decision.

## End-to-end flows

The diagrams below describe the implementation currently present in the repository. Read the linked system-flow document for preconditions, database changes and failure states.

### Operator walkthrough

**Workspace Admin/Owner:** create or enter the business workspace, configure a website channel and its exact origin, prepare a knowledge draft, process it, review the version and explicitly publish it as `PUBLIC`. Add active channel members before expecting an Agent to receive inbox work. The installation response contains an opaque public widget key and SDK snippet; it never contains a provider secret. Workspace settings and chat data are derived from the authenticated membership.

**Visitor:** load the installed widget from the registered origin, create or resume a channel-scoped visitor session, complete mandatory pre-chat fields, send a message with a stable `clientId`, and poll public messages by sequence. The visitor sees public replies and receipts only. Internal notes, unpublished drafts, another tenant's messages and expired visitor tokens are rejected.

**Agent:** open the scoped inbox, read only conversations allowed by membership/channel assignment, take over with the current ownership version, then send a public reply or an internal note. A takeover increments the ownership fence. If a worker returns after the fence changes, the stale answer is not appended.

**Platform Admin:** register a provider using a server-side environment-variable reference, create/enable a model and capability, grant it to a workspace with an optional expiry, then use the separate Platform Agent session. Platform identity is not workspace membership. Platform Agent actor/session isolation and idempotency are verified locally; its billable token/quota policy remains `UNKNOWN / NEEDS VERIFICATION`.

### 1. Registration, verification and workspace session

```mermaid
sequenceDiagram
    participant U as User
    participant FE as React/Vite
    participant API as Express API
    participant DB as PostgreSQL
    participant LD as Local delivery spool
    U->>FE: Submit business, email, phone, password
    FE->>API: POST /api/auth/signup
    API->>DB: Create user, workspace, owner, quota, challenge
    API->>LD: Store verification challenge for local/test
    API-->>FE: 202 generic response
    U->>FE: Submit verification token
    FE->>API: POST /api/auth/verify
    API->>DB: Consume single-use challenge
    U->>FE: Login
    FE->>API: POST /api/auth/login
    API->>DB: Verify Argon2 hash and active membership
    API-->>FE: HttpOnly gotek_session cookie
```

The local delivery spool is test infrastructure. SMTP, email provider receipts and browser acceptance remain open. Reset consumes a single-use token and revokes existing sessions.

### 2. Workspace, channel and visitor widget

```mermaid
sequenceDiagram
    participant A as Workspace Admin
    participant API as Express API
    participant DB as PostgreSQL/RLS
    participant W as Embedded widget
    A->>API: POST /api/channels
    API->>DB: Create channel and public key
    A->>API: GET /api/channels/:id/installation
    API-->>A: Widget script/key/origin metadata
    W->>API: GET /widget-api/:key/config with exact Origin
    API->>DB: Validate channel, origin and enabled state
    W->>API: POST /widget-api/:key/session
    API->>DB: Create visitor, conversation and bearer token
    W->>API: POST /widget-api/:key/messages with clientId
    API->>DB: Append idempotent visitor message
    API-->>W: Conversation state and sequence
```

Wrong origin, expired visitor token, disabled channel and cross-tenant identifiers fail with stable errors. Internal staff notes never appear in the public transcript.

### 3. Knowledge import, publish and retrieval

```mermaid
flowchart LR
    Upload[Upload text / JSON / CSV / PDF / DOCX] --> Draft[Knowledge draft]
    Draft --> Process[Process and chunk]
    Process --> Ready[READY version]
    Ready --> Publish[Explicit PUBLIC publish]
    Publish --> Retrieve[Lexical or semantic retrieval]
    Retrieve --> Context[Bounded grounded context]
    Context --> Reply[AI reply or human handoff]
    Draft -. INTERNAL .-> Private[Excluded from visitor context]
```

Knowledge versions are immutable after processing. Retrieval checks workspace, audience, active publication, source validity and embedding model/dimension. A visitor cannot select an arbitrary version or private note. Web snapshots follow a similar snapshot → generation draft → publish/rollback lifecycle.

### 4. AI worker, quota and takeover fence

```mermaid
sequenceDiagram
    participant V as Visitor
    participant API as Widget API
    participant Q as PostgreSQL jobs/quota
    participant W as AI worker
    participant P as Provider API
    participant H as Human agent
    V->>API: Send question
    API->>Q: Append message and enqueue ai.reply
    W->>Q: Claim lease and lock owner version
    W->>Q: Check workspace, rules, public knowledge, grant and quota
    W->>P: Grounded request with server-side secret
    P-->>W: Answer and usage metadata
    H->>API: Takeover / resume AI with expected owner version
    API->>Q: CAS owner version and record handoff state
    W->>Q: Recheck lease, owner version, grant and workspace state
    alt AI still owns conversation
        W->>Q: Commit public answer and settle usage
    else Human takeover or state changed
        W->>Q: Record unknown or handoff, do not append stale answer
    end
```

Provider failure responses are redacted into stable codes. A grant expiry now stops provider transport before I/O. A dispatched result whose final state is unknown is not blindly retried.

### 5. Platform Admin model and agent flow

```mermaid
flowchart TD
    PA[Platform Admin] --> Registry[Provider/model registry]
    Registry --> Grant[Workspace capability grant + expiry]
    Grant --> Worker[Workspace AI worker]
    PA --> Agent[Platform agent request]
    Agent --> Actor[Actor-scoped session/history]
    Agent --> Provider[Approved provider transport]
    Provider --> Agent
    Agent --> Unknown[Confirmed or unknown receipt]
```

Supported adapter labels are Gemini, Anthropic, `claude_code`, OpenAI, ChatGPT and `custom_llm`. The `claude_code` label currently uses the Anthropic Messages transport; it is not evidence that a Claude Code CLI process is spawned. Provider credentials are environment references on the server and are never accepted as client secrets.

### 6. Web source refresh and generation

```mermaid
sequenceDiagram
    participant A as Workspace Admin
    participant API as API
    participant J as Durable job
    participant F as Fetch/parser
    participant K as Knowledge generation
    A->>API: Create URL/SITEMAP/RSS source
    API->>API: Validate HTTPS, host and crawl bounds
    A->>API: Request refresh
    API->>J: Queue web.refresh with tenant scope
    J->>F: Fetch approved static source
    F-->>J: Snapshot or stable failure
    J->>K: Stage generation parts
    A->>API: Review and publish/rollback
```

Static HTTP and sitemap paths have focused tests. A browser JavaScript crawler and broad real-source acceptance are not implemented/verified.

### 7. Audit, backup and restore

```mermaid
flowchart LR
    Mutation[Scoped mutation] --> Audit[Audit event]
    Audit --> Export[Keyset audit export]
    DB[(PostgreSQL)] --> Dump[pg_dump + SHA-256]
    Dump --> Temp[Disposable restored database]
    Temp --> Verify[55-table hashes, RLS/policies, quarantine]
    Verify --> Drop[Drop temporary database]
```

The restore drill quarantines sessions, challenges, local delivery, invitations, jobs and provider effects. It is a local verification tool and does not constitute a production backup policy.

## Failure and state semantics

| Situation | Stored/result state | Expected behavior |
|---|---|---|
| Invalid session or membership | `401` / `403` | No tenant data returned |
| Wrong widget origin | `403 DOMAIN_DENIED` | No widget state or message access |
| Duplicate client/request ID | Existing receipt | No duplicate side effect |
| AI ownership changed | `STALE_REPLY_OWNER` / handoff | Stale AI output is not appended |
| Provider timeout/network/malformed response | Stable provider error | Redacted fallback and handoff; no secret/body leak |
| External dispatch result unknown | `unknown` | No blind resend; reconcile explicitly |
| Expired model grant | `AI_MODEL_REVOKED` | Provider call blocked before transport |
| Quota period closed/exceeded | `QUOTA_PERIOD_CLOSED` / `QUOTA_EXCEEDED` | No dispatch; owner must provision/renew |
| Workspace disabled | `WORKSPACE_DISABLED` | Workers stop claiming/processing work |

## State transitions a developer must preserve

| Domain | Normal path | Terminal/exception path | Why the state matters |
|---|---|---|---|
| Identity | `signup pending → verified challenge → active session` | `expired/reused challenge`, revoked session, disabled workspace | A generic signup response protects account enumeration; verification/reset tokens are single-use and hashed |
| Knowledge | `draft → processing → READY → explicitly PUBLIC published` | extraction failure, version conflict, rollback/retire | A stored upload is not retrievable visitor context until a READY version is published |
| Conversation | `HANDOFF_PENDING ↔ AI_ACTIVE → human takeover` | stale owner, disabled channel, expired visitor token | `owner_version` prevents a late AI result from overwriting a human decision |
| AI job | `queued → running lease → retry/dead` | external dispatch `unknown` | `unknown` is not success and is not a blind retry because the provider side effect may have happened |
| Provider grant | `enabled provider/model → active grant → optional expiry` | revoked/expired/missing secret/capability | The worker blocks before provider I/O when the grant is not currently usable |
| Platform Agent turn | `pending → dispatched → completed` | `SESSION_BUSY`, lease expiry, `unknown`, idempotency conflict | Actor/session/request fences prevent duplicate calls and cross-actor history |
| Backup drill | `dump → disposable restore → hash/RLS/quarantine verify → drop` | integrity mismatch or unsafe credential state | The drill proves a local recovery procedure; it is not a production RPO/RTO commitment |

## Repository map and where to change what

```text
src/server/        Express routes and backend services
src/web/           React/Vite application pages and API wrapper
public/sdk.js      Public embeddable widget client
db/migrations/     Ordered PostgreSQL schema, RLS and grants
scripts/           Database setup, AI/embedding/web workers, restore drill
tests/             Serial node:test suites and local fixtures
delivery/          H/E requirements, contracts, backlog, checkpoint, evidence
research/          HiChat observations, screenshots and handoff source material
docs/              Current architecture, status, flows and handoff
.ai/               Portable context protocol for coding agents
```

| Change needed | Start here | Check before editing |
|---|---|---|
| Auth/session/tenant | `src/server/app.ts`, `security.ts`, `db.ts` | H01/H02 tests and RLS migrations |
| Widget/inbox/handoff | `widget.ts`, `inbox.ts`, `chat-store.ts`, `channels.ts` | ownership, origin, idempotency and public/private visibility |
| Knowledge/RAG | `knowledge*.ts`, `knowledge-retrieval.ts`, embedding worker | version/audience/publish and model-grant checks |
| Provider/model | `platform.ts`, `provider-transport.ts`, `model-grant-policy.ts` | secrets, endpoint policy, expiry and usage receipt |
| Jobs/workers | `jobs.ts`, `worker.ts`, `scripts/*worker.ts` | lease, retry, unknown and tenant scope |
| Database | `db/migrations/` | add ordered migration; do not rewrite deployed history |
| UI | `src/web/` | use observed HiChat screen/state evidence; preserve GoTek identity |
| Acceptance state | `docs/PROJECT-STATUS.md`, `docs/HANDOFF.md`, `delivery/CHECKPOINT.md` | label Implemented / Verified / Accepted separately |

## Local usage guide

### Prerequisites

- Node/npm and PostgreSQL 16-compatible local tools (`initdb`, `pg_ctl`, `psql`, `pg_dump`, `pg_restore`).
- A dedicated local PostgreSQL cluster on socket `/tmp`, port `55432` for the current test scripts.
- No production account or provider key is needed for auth/widget/knowledge fixture tests.

### Install and run

```sh
npm ci
mkdir -p .local
initdb -D .local/postgres -U gotek_migrator --auth-local=trust --auth-host=scram-sha-256
pg_ctl -D .local/postgres -l .local/postgres.log -o "-p 55432 -k /tmp -h 127.0.0.1" start
npm run db:setup
npm run dev
```

Open `http://127.0.0.1:4317`. The backend does not load `.env` automatically. If `DATABASE_URL` is absent, it reads the private `.local/runtime.json` created by `db:setup`. Never commit that file.

### Build, test and restore

```sh
npm run build
npx tsc --noEmit
npm test
npm run db:restore-drill
```

The package test script runs serially because integration fixtures share the dedicated local database. Do not run the full suite concurrently against the same cluster.

### Worker commands

```sh
GOTEK_WORKER_WORKSPACE=<workspace-uuid> npm run worker:ai -- --once
npm run worker:ai -- --all --once
GOTEK_WORKER_WORKSPACE=<workspace-uuid> npm run worker:web -- --once
GOTEK_WORKER_WORKSPACE=<workspace-uuid> \
GOTEK_KNOWLEDGE_VERSION=<version-uuid> \
GOTEK_EMBEDDING_MODEL=<model-uuid> \
npm run worker:embedding
```

Workers are separate processes from the web server. `--all` and a specific workspace selector are mutually exclusive. Provider calls may consume real quota when credentials are configured.

### Environment inventory

See [.env.example](.env.example) and the detailed [Environment and database Word handoff](docs/GoTek_Chatbot_Environment_Database_Handoff.docx). Important variables are `DATABASE_URL`, `APP_ORIGIN`, `COOKIE_SECURE`, `SERVE_BUILD`, `GOTEK_DEFAULT_AI_RESPONSE_QUOTA`, worker selectors, embedding selectors and token-metering rates. Provider rows hold the name of a server-side secret environment variable; actual key values never belong in this file or the database payload.

## What is not implemented yet

The following is intentionally explicit so a new developer does not mistake a route or component for a complete feature:

- Full browser acceptance for signup, email, workspace switch, widget embed, inbox takeover and mobile/accessibility states.
- Live Gemini/OpenAI/Anthropic/custom LLM receipts, vendor rate limits, streaming/tool calls and real cost reconciliation.
- JavaScript-rendered web crawler and broad source-provider acceptance.
- Catalog/orders, Help Center, labels, automations, macros, templates, integrations/webhooks, reports, CSAT/SLA, ticket escalation, omnichannel and Lark Wiki flows.
- Commercial subscription/invoicing and the E02–E12 expansion groups.
- H32.05 retention/delete/tenant closure policy, legal hold, object/vector deletion, owner sign-off and production RPO/RTO.
- Production hosting, CI/CD, secrets manager, monitoring, multi-instance rate limiting and staging release evidence.

Do not close any of these from a green unit test alone. Use `UNKNOWN / NEEDS VERIFICATION` when the required external evidence or owner decision is absent.

## Next steps after the documentation pause

The next work is ordered by dependency and acceptance evidence, not by the number of screens:

1. **P0.2 — live provider receipt (blocked on authorized test credentials).** Use two isolated local/test workspaces, one enabled model and a bounded public knowledge fixture. Record request ID, provider adapter, redacted receipt, normalized token usage, quota reservation/settlement and the resulting citation. Exercise success, timeout, malformed response, expired grant and human takeover during dispatch. Never commit a key or send a customer message.
2. **P0.3 — browser vertical slice.** Fresh signup/verification/login, workspace/channel creation, widget installation from the exact origin, visitor pre-chat/message, inbox takeover, public reply and receipt. Record screenshots and network/error evidence. Revisit the earlier “Không thể kết nối” report only from a reproducible current browser run.
3. **P1 — close the core acceptance matrix.** Reconcile each H01–H13, H16, H22–H23, H28 and H32 acceptance item against UI, backend/data, permission, failure-state, evidence and backlog row. Keep a group `IN PROGRESS` if any gate is missing.
4. **P1 policy gate — Platform Agent billing.** Decide whether platform-admin turns are billable, which workspace/grant owns them when `workspaceId` is supplied, and whether usage belongs in `usage_operations`/`ai_usage_ledger`. Only then design an ordered migration and receipt tests; do not infer the policy from the current route.
5. **P1 policy gate — retention/closure.** Approve owner, retention periods, legal hold, object/vector deletion and restore expectations in `delivery/decisions/H32_RETENTION_CLOSURE.md` before writing destructive code.
6. **P2–P6 — remaining H14–H15, H17–H21, H24–H27, H29–H31 and E02–E12.** Implement one evidenced vertical slice at a time, retaining the same tenant, role, idempotency, error and documentation gates. Production remains out of scope until staging acceptance and release approval.

When work resumes, start with `docs/HANDOFF.md`, update the checkpoint before coding, assign disjoint files to parallel workers and run the shared PostgreSQL suite serially. The detailed API, database, test and deployment constraints remain in the linked docs below.

## Parallel delivery protocol

Parallel work is allowed only with disjoint file ownership:

1. Name the H/E or P0 slice and its acceptance contract.
2. Assign one source/test/evidence area to each worker; do not let two workers edit the same migration, route or status document.
3. Run shared PostgreSQL suites serially from the integration owner.
4. Rebase or inspect every diff before integration; never discard another worker's unfinished changes.
5. The integration owner runs build, full tests, restore drill and updates checkpoint/backlog.

This protocol is why the current core work can proceed in multiple tracks without presenting conflicting status as one completed feature.

## Further reading

- [First 30 minutes](docs/00-START-HERE.md)
- [Local user guide](docs/USER-GUIDE.md)
- [Product overview](docs/PRODUCT-OVERVIEW.md)
- [Current project status](docs/PROJECT-STATUS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [System flows](docs/SYSTEM-FLOW.md)
- [Database](docs/DATABASE.md)
- [API inventory](docs/API.md)
- [Development setup](docs/DEVELOPMENT.md)
- [Testing and verification matrix](docs/TESTING.md)
- [Known issues](docs/KNOWN-ISSUES.md)
- [Actionable TODO](docs/TODO.md)
- [Development handoff](docs/HANDOFF.md)
- [Conversation summary](docs/CONVERSATION-SUMMARY.md)
- [AI agent rules](AGENTS.md)
- [Portable project-context skill](.ai/skills/project-context/SKILL.md)

The exact next task after this documentation pause is P0.2 live-provider receipt acceptance when an authorized test account is available. Until the pause is explicitly lifted in `docs/HANDOFF.md`, only documentation/evidence corrections should be made; do not claim new feature completion.
