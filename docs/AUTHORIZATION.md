# Authorization — 2026-09-30

User-approved model: Platform Admin is separate; workspace roles are Owner, Admin, Agent.
This implements the H01/H02/H16/H28 authorization slice, not full module acceptance.

| Capability | Owner | Admin | Agent |
|---|---|---|---|
| Workspace identity, inbox within channel/assignment rules | Yes | Yes | Yes |
| Workspace configuration, channels, knowledge, usage, audit | Yes | Yes | No |
| Invite Admin/Agent, change/revoke Admin/Agent membership | Yes | Yes | No |
| Assign or change Owner membership | Yes | No | No |
| Demote/revoke final active Owner | No | No | No |
| Platform APIs | Only with separate active platform grant | Same | Same |

Platform Admin does not add workspace permissions. Reading tenant chat through platform support still requires the existing scoped, expiring, audited support grant. Google authenticates an identity; it does not grant Platform Admin. A newly created personal workspace has its creator as Owner.

## Contracts

- `GET /api/me` returns the current DB membership role, `permissions`, active memberships and independent `platformAdmin`. The user projection excludes password hashes. Camel-case profile names are returned alongside legacy `full_name` / `verified_at`.
- The session determines the active workspace; arbitrary client workspace IDs do not confer membership. Switching checks active membership.
- `PATCH /api/members/:userId` takes `{role: "Owner"|"Admin"|"Agent", active: boolean}`. Owner/Admin can manage members; only Owner can change an existing Owner or assign Owner. Last-owner protection returns `409 LAST_OWNER`; cross-workspace target returns `404 NOT_FOUND`; insufficient permission returns `403 FORBIDDEN`.
- Roles are read on every request. Revocation deletes sessions for that user and workspace in the same transaction. Restoring membership does not restore old sessions; other workspace sessions survive.
- Invites remain Admin/Agent only. Their existing `local_delivery` behavior is not external email delivery.
- Workspace permissions are defined in `backend/src/core/authorization.ts`. Existing role, channel membership, ownership, tenant SQL and RLS guards remain authoritative. Frontend permissions only control presentation.

## UI

`/app/settings/members` loads real member/invitation APIs, persists role/revoke/restore actions and refreshes identity afterward. The last active Owner is disabled. Admin cannot edit Owners or select Owner. Navigation, command palette and direct management URLs enforce permissions; `/platform/*` requires the separate flag. Workspace selection and account labels use `/me`. Identity refreshes on window focus, and workspace/user/role changes remount the console to clear previous component state.

Screen contract: reuse the existing GoTek console and MembersSettings table/form; preserve current theme, show real roles and disabled states, validate at API, and show load/action errors. Desktop dark/light verification is recorded in the evidence. A HiChat reference screenshot for this implementation is unavailable: parity remains **NEEDS VERIFICATION**. Other console modules still contain pre-existing mock data and are not accepted by this change.

## Local Docker database boundary

`docker compose up` runs `db-setup` before backend. Setup applies ordered migrations using the migrator, creates/hardens `gotek_app` with NOSUPERUSER/NOBYPASSRLS and stores a private random password in the `gotek_app_runtime` volume. Backend mounts it read-only using `DB_RUNTIME_FILE`; it no longer receives the migrator URL. Explicit runtime-file failures stop startup rather than falling back to other credentials. Preserve this volume between starts. Do not print or commit its contents.

This change applies to `docker-compose.yml` local development. Production compose/Kubernetes credentials and deployment remain **NEEDS VERIFICATION**. No deployed migration history was rewritten.

See [verification evidence](../delivery/evidence/authorization-2026-09-30.md).
