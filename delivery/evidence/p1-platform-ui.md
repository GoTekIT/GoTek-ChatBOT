# Platform UI browser check — 2026-09-24
Environment: local 127.0.0.1:4317, IAB, synthetic platform fixture created through local API plus trusted operator SQL. No real keys/provider calls or external deliveries.

Observed:
- /platform/providers without authorized session: denied message and login link, no registry data.
- Login via UI using synthetic fixture -> workspace settings -> Platform Admin navigation present.
- Platform page shows real providers/models/grants from PostgreSQL API, separate from workspace settings.
- Submitted provider name `Local UI registry check`, OpenAI adapter, environment variable reference (no credential), test reason. UI success and provider listed as disabled.
- Full page reload: same provider still listed, disabled; form blank and registry excludes secret reference/value.

Not run: model/grant mutations in browser, narrow viewport/keyboard screen review, provider connectivity or fallback. Backend tests cover those registry permission/capability/error paths but not external receipts. UI is provisional GoTek-specific design; no HiChat platform parity claim and no PO acceptance.
