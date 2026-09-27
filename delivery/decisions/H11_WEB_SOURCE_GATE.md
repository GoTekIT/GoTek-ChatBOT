# H11 web source gate — implementation decision

Status: open for implementation, not accepted.

The handoff supplies UI observations (name, URL, URL/Sitemap/RSS, max pages 20, depth 2, delay 0) but does not provide a verified crawler receipt or parser contract. Before coding the crawl path, GoTek must enforce:

- http/https only; reject credentials, fragments and unsupported schemes.
- Resolve and validate every redirect target; reject loopback, RFC1918/link-local, IPv6 local, cloud metadata and DNS rebinding.
- Apply host, byte, time and redirect limits before fetching.
- Persist source versions and preserve the last published version when a crawl fails.

Current repository has no H11 source table, crawl job, or provider receipt. Do not mark H11 implemented from the form observation alone. This decision record is the authoritative gap until the source schema and crawl receipt contract are approved.
