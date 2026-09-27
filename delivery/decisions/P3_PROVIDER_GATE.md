# P3 provider gate — 2026-09-24

Status: Open decision / external prerequisite.

The local implementation has provider registry, model/capability grants, secret references, quota ledger and a worker kill switch. Real AI generation is intentionally disabled until the owner supplies an approved provider credential and confirms provider/model, retention, timeout, fallback and receipt policy.

No API key is stored in the repository, browser bundle, fixture, or evidence. No P3 H08–H12 item is marked Accepted from UI-only configuration. Once approved, the adapter must run through the existing job/quota/audit path and prove tenant isolation, timeout, unknown receipt and takeover fencing.
