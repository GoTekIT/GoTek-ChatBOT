# Deployment

**Deployment has not been finalized.** Current hosting: UNKNOWN / NEEDS VERIFICATION. Không có production deployment được chấp thuận. `src/server/index.ts` và worker entrypoints từ chối NODE_ENV=production; server bind loopback 4317.

## Current build and infrastructure

`npm run build` typecheck và tạo frontend `dist`; không đóng gói compiled backend/server release. `SERVE_BUILD=true npm run dev` chỉ preview local/test qua tsx. Repo không có Docker/Compose hoặc CI/CD workflow được xác nhận trong audit này. Không có deployment command production hợp lệ để hướng dẫn.

Database PostgreSQL và credentials hiện bootstrap bằng script local; cần tách migration role/app role, secret management, TLS, backup retention và worker supervision trước staging. Provider secrets chỉ qua environment reference, không đưa vào frontend hoặc git.

## Release gate

1. Chốt target staging, hosting, TLS, domain/origin, DB và storage.
2. Thiết kế config/migration/deploy/rollback phù hợp môi trường đó; hiện chưa có quy trình deploy tự động.
3. Chạy regression, browser multi-role/tenant, real-provider acceptance với tài khoản được cho phép.
4. Chứng minh backup/restore, quarantine jobs, monitoring, retention và rollback trên staging.
5. Bàn giao staging, kết quả nghiệm thu và kế hoạch phát hành để user duyệt production.

## Rollback

Source rollback sau khi có release commit và data rollback sau migration chưa có runbook staging đã nghiệm thu. `scripts/restore-drill.ts` kiểm tra backup/restore local nhưng không phải công cụ phục hồi production; không chạy đối với dữ liệu thật. Giữ backup ở `.local` ngoài Git. Chi tiết rủi ro trong [KNOWN-ISSUES](KNOWN-ISSUES.md).
