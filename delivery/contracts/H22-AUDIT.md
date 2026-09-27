# H22 audit history — GoTek backend contract

Owner/Admin may read `GET /api/audit?limit=100&before=<event UUID>` in their session workspace. Default and maximum page size are 100. Response remains an array for existing clients. Order is descending creation timestamp, then UUID as a deterministic tie-breaker. Use the last event ID as the next page cursor; an empty page ends traversal. Cursor resolution is tenant-scoped: a missing or foreign event returns 404. Invalid query values return 400. Agent and anonymous access are denied.

This is a GoTek backend decision, not a claim about HiChat internal API. Export, retention and expanded audit metadata remain separate requirements. UI remains deferred by user instruction.
