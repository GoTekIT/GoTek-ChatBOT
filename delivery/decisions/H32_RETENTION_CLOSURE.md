# H32.05 retention, export, delete and tenant closure gate

Status: **Decision required before implementation**

This decision record prevents a guessed retention or deletion policy from being
implemented as if it were part of the handoff. The current repository proves
tenant-scoped audit reads/export, backup/restore quarantine, and platform
workspace disable. It does not define the policy needed to implement H32.05.

## Required owner decisions

1. **Retention:** retention period and clock for audit events, conversations,
   messages, knowledge versions/chunks, snapshots, uploaded files and vector
   indexes; whether legal hold pauses deletion; purge cadence and dry-run/audit
   requirements.
2. **Export:** subject and scope (workspace-wide or selected datasets), format,
   identity verification, asynchronous job/expiry, encryption and download
   delivery, and whether export includes deleted/held records.
3. **Delete:** who may request/approve it, grace period, idempotency key,
   datasets and derived artifacts covered, treatment of backups, and the
   receipt needed to prove completion. Hard-delete must not be inferred from
   the existing contact soft-delete behavior.
4. **Tenant closure:** lifecycle states, required owner confirmation,
   membership/session revocation, provider/worker kill behavior, treatment of
   queued or in-flight external effects, restore behavior, and reopening rules.
5. **Operational targets:** RPO/RTO, incident owner and rollback/kill-switch
   authority, plus the release owner who signs the evidence.

## Current evidence and limits

- `GET /api/audit` and `GET /api/audit/export` are tenant-scoped Owner/Admin
  endpoints. They do not establish a retention or data-subject export policy.
- `scripts/restore-drill.ts` verifies a disposable PostgreSQL restore,
  checksums, RLS and quarantine. It explicitly does not implement object
  storage/vector-index restore or production RPO/RTO.
- Platform disable removes sessions and blocks subsequent work; it does not
  delete business data and cannot recall an already-dispatched external effect.

Until the owner decisions above are recorded, H32.05 must remain Backlog /
decision-needed. Implementing a purge, closure endpoint, or delete cascade now
would create an unapproved destructive policy and would not be valid acceptance
evidence.
