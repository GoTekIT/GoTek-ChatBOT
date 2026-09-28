# Changelog

## 2026-09-27 — Handoff audit snapshot (unreleased)

- Added self-contained project status, architecture handoff and AI continuation documentation.
- Recorded core backend evidence: auth/tenant, widget, knowledge, provider/grants, jobs, audit and restore slices.
- Recorded verification boundaries: live provider/email, browser parity, staging/production and H32.05 policy remain open.
- Preserved existing source, delivery evidence, migrations and unfinished work; no feature was marked complete solely from a file name.
- Added fresh P0.1 focused core acceptance evidence: 9/9 local integration tests covering tenant, widget, knowledge, grounded AI fixture, quota and audit boundaries.
- Fixed expired model-grant enforcement in the AI worker before provider I/O; focused provider contract is 19/19 and full regression is now 174/174.
- Hardened stale-job recovery for `running` rows with a NULL lease and added a tenant-isolation regression.
- Added parallel audit evidence for jobs (NULL lease), knowledge/widget boundaries (8/8) and Platform Agent (9/9); Platform Agent billing/quota ownership remains explicitly unresolved.
- Expanded README with role-based usage, state transitions, next-step gates, reference images and corrected Mermaid syntax; added `docs/USER-GUIDE.md`.
- Added `.env.example` local/test template and `docs/ENVIRONMENT.md` with variable inventory, provider `secret_ref` procedure, worker commands, troubleshooting and handoff security rules. Backend remains explicit-export; no dotenv loader was introduced.
- Added `docs/GoTek_Chatbot_Environment_Database_Handoff.docx`, a 16-page environment/database runbook with rendered and accessibility verification; no real `.env` or secret is included.
- Re-ran the full serial suite after these changes: **175/175 PASS**. The next feature slice is paused while this documentation checkpoint is reviewed.

This snapshot is not a production release.
