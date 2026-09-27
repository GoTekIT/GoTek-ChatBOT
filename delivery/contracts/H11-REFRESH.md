# H11 refresh pipeline — local implementation contract

`POST /api/web-sources/:id/refresh` accepts only `{requestId: UUID}`. Server session determines workspace; Owner/Admin required. Source must currently be ACTIVE. Concurrent identical requests return the same durable `web.refresh` job and one audit event. Queue receipt does not mean fetched or published. Pausing a source blocks even an old request replay.

Worker scope: fetch one configured source document using the existing bounded DNS-pinned transport, parse URL/RSS/SITEMAP, and persist an immutable snapshot keyed by workspace/job. Network I/O runs outside transactions. Before committing, recheck active workspace, source configuration/status and live job lease. A paused or changed source must not commit newly fetched data. Existing snapshots remain unchanged on fetch failure. No automatic publication or widget retrieval from snapshots.

`GET /api/web-sources/:id/snapshots` returns latest 50 metadata records; detail route `/:snapshotId` returns the parsed document. Both require current Owner/Admin membership and tenant scope. Snapshot storage has composite tenant/source/job foreign keys and insert-only app grants.

This is a single-document capture contract, not full H11 acceptance. Sitemap links are manifests, not proof linked pages were crawled. Remaining: recursive traversal/depth/delay, bounded retry outcome classification, durable failure history, knowledge draft conversion and review/publish, refresh schedules, historical pagination, browser and source parity. These are GoTek implementation decisions, not claims about HiChat internal APIs.

### H11 local worker entry point integrated
Added npm run worker:web, explicit workspace UUID, --once/loop, production guard, redacted state logs and graceful idle SIGTERM. Root verified TypeScript plus web-refresh-cli/web-refresh-worker/web-sources suites: 4/4 PASS. Real PG and child-process checks; network responses injected in snapshot tests. In-flight fetch shutdown, recursive crawling, retries, draft conversion and publish acceptance remain open. README documents usage and limitations.

## Snapshot to knowledge draft contract (implementation in progress)

POST `/api/web-sources/:id/snapshots/:snapshotId/knowledge-drafts` accepts `{itemIndex,title,categoryId?}`. Owner/Admin only, session workspace; source and snapshot must match. Content comes from immutable stored snapshot, never client replacement text. Explicit title is 1–100 Unicode codepoints. URL/RSS text is split into at most 100 draft parts of at most 2,000 codepoints each; boundary whitespace may be trimmed to satisfy existing knowledge constraints. Original snapshot preserves full text. Oversized input fails atomically; no silent truncation. Sitemap manifest is rejected until linked pages are crawled.

Migration040 introduces WEB source type and immutable tenant-scoped mappings to exact knowledge versions. Import is idempotent per workspace/snapshot/itemIndex; changed title/category conflicts. Review of an existing snapshot is allowed when source is paused: this neither fetches nor publishes. New items remain INTERNAL and unpublished, with existing process/publish workflow required separately. Refresh-to-existing-item version updates remain a separate unfinished requirement. This contract is a GoTek backend decision under H11.05, not an observed HiChat internal API.

Migration041 foundation: `web_source_document_groups` identifies a source entry; `web_source_generations` records refresh lineage and publish state; `web_source_generation_parts` records UPSERT/RETIRE actions with tenant/version FKs. Tables have forced tenant RLS. Runtime API and atomic group publish/rollback are not implemented yet.

## Generation draft bridge — multipart contract

`POST /api/web-sources/:id/snapshots/:snapshotId/generation-draft` uses `{requestId,itemIndex,title,categoryId?}`. A stable source-entry group is derived server-side from the snapshot URL. Every imported text part becomes an UPSERT; indices from the prior published manifest absent in the new content become RETIRE. No content part is silently dropped. Publication remains explicit and requires every UPSERT version READY. Draft staging preserves the published pointer. Replays reconstruct against the original generation parent, including after publication, rather than against a newer group pointer. These are GoTek implementation decisions, not evidence of HiChat's internal design.
