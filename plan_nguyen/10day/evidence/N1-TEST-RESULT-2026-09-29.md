# N1 — Test result và evidence

**Ngày:** 29/09/2026  
**Môi trường:** PostgreSQL 16 local disposable qua Docker, port 55432; Redis 7 local; không dùng Supabase shared cho mutation test.

## Gate kết quả

| Gate | Kết quả |
|---|---|
| Docker PostgreSQL/Redis | PASS — healthy |
| Database migration | PASS — toàn bộ migration hiện tại |
| Fixture seed A/B | PASS |
| Fixture reset | PASS |
| Cleanup check | PASS — workspaces fixture 0, channels fixture 0 |
| Backend targeted N1 | PASS — 9/9 |
| Backend full suite | PASS — 170/170 |
| Frontend suite | PASS — 5/5 |
| Monorepo build | PASS — backend typecheck + frontend Vite |
| Runtime health | PASS — /api/health 200 |
| Database read-only | PASS — SELECT 1 |
| Supabase safety guard | PASS — fixture runner từ chối shared/pooler host |

## Targeted N1 coverage

- H02 workspace isolation và cross-tenant switch.
- H03 message ordering, idempotency, takeover fence, internal note boundary.
- H04 widget public key, origin và rate boundary.
- H05 assignment capacity và stale owner.
- H06 visitor profile/pre-chat scope.
- H16 membership revoke live session.
- H01 local verification.
- Resume AI ownership/version.
- Widget flow handoff/public/internal/resume.

## Defect đã phát hiện và xử lý

1. Fixture runner merge object role A/B bằng cùng key, làm user A bị ghi đè bởi user B. Đã đổi thành key ownerA/adminA/agentA/ownerB/agentB.
2. Windows migration/test harness hardcode Unix socket /tmp. Đã chuyển local test connections sang TCP 127.0.0.1:55432.
3. GET /api/me truyền response null vào controller nhưng controller gọi res.json(), gây HTTP 500. Đã sửa controller trả data để authed middleware serialize.
4. Restore report test dùng path tương đối sai từ backend working directory. Đã resolve từ file URL về repository root.
5. CLI worker shutdown assertion giả định Unix exit metadata. Đã thêm expectation tương thích Windows nhưng vẫn giữ kiểm tra idle output và signal flow.

## Câu lệnh chính đã chạy

docker compose up -d postgres redis
npm run --prefix backend db:setup
npm run fixture:seed
npm run test:backend
npm run test:frontend
npm run build:all
npm run fixture:reset

## Kết luận

N1 baseline đạt DONE ở mức local verified. Browser screenshot/network evidence, provider live receipt và quyết định provider/quota/retention vẫn là acceptance gate riêng; không được suy ra DONE từ backend test.
