# Local development

## Prerequisites

Môi trường audit: Node v20.20.2, npm 10.8.2, PostgreSQL 16.15. Repo không khai báo `engines`; tính tương thích phiên bản khác: UNKNOWN / NEEDS VERIFICATION. Cần `initdb`, `pg_ctl`, `psql`, `pg_dump`, `pg_restore` trên PATH. Native `argon2` có thể cần toolchain nếu không có binary phù hợp.

## Installation and database setup

```sh
npm ci
```

`setup-db.ts` cố định admin connection `/tmp:55432`, role `gotek_migrator`, database `gotek_chatbot`. Nó tạo role `gotek_app` không BYPASSRLS, mật khẩu ngẫu nhiên, apply migration theo tên và ghi `.local/runtime.json` mode 0600. Không có seed script tổng quát; migration chứa dữ liệu cấu hình hệ thống. Chạy lại chỉ apply migration chưa có trong `schema_migrations`.

Với **checkout mới chưa có cluster**, chuẩn bị cluster local riêng (không chạy lại initdb trên cluster có dữ liệu):

```sh
mkdir -p .local
initdb -D .local/postgres -U gotek_migrator --auth-local=trust --auth-host=scram-sha-256
pg_ctl -D .local/postgres -l .local/postgres.log -o "-p 55432 -k /tmp -h 127.0.0.1" start
npm run db:setup
```

Các command bootstrap trên được đối chiếu với PostgreSQL CLI và cấu hình source; kiểm thử clone sạch toàn bộ: UNKNOWN / NEEDS VERIFICATION. Local socket trust chỉ dành cluster phát triển riêng; không đưa cấu hình này lên server chia sẻ/production. Nếu cluster đã tồn tại, kiểm tra `pg_ctl -D .local/postgres status` và chỉ start nếu đã dừng. Không xóa `.local/postgres` để xử lý lỗi.

## Environment variables

Backend không có dotenv loader. `.env.example` là inventory, không phải file cấu hình tự nạp. Export biến cần dùng trước khi chạy. Nếu `DATABASE_URL` không được set, `src/server/db.ts` đọc `.local/runtime.json`. Không export `DATABASE_URL` rỗng thành một URL giả. Test có admin connections hardcode local nên thay DATABASE_URL không làm toàn suite trở thành portable.

| Variable | Use/default |
|---|---|
| DATABASE_URL | Optional app DB override; otherwise runtime.json |
| NODE_ENV | `production` bị từ chối ở entrypoints |
| SERVE_BUILD | `true` phục vụ `dist` thay Vite middleware |
| APP_ORIGIN | Origin validation/widget URL; mặc định http://127.0.0.1:4317 |
| COOKIE_SECURE | `true` bật Secure cookie; local HTTP không dùng |
| GOTEK_DEFAULT_AI_RESPONSE_QUOTA | Default 1000 |
| GOTEK_WORKER_WORKSPACE | UUID workspace cho worker |
| GOTEK_KNOWLEDGE_VERSION | UUID phiên bản cho embedding |
| GOTEK_EMBEDDING_MODEL | UUID model registry |
| GOTEK_EMBEDDING_BATCH_SIZE | Default 20, maximum 100 |
| GOTEK_PROMPT_MICROS_PER_1K | Default 0; metering rate, không chứng minh pricing thật |
| GOTEK_COMPLETION_MICROS_PER_1K | Default 0 |
| provider secret_ref | Tên biến môi trường do registry quy định, không có tên API key cố định |

## Start / build / checks

```sh
npm run dev
npm run build
npx tsc --noEmit
npm test
```

Server bind 127.0.0.1:4317. `npm run dev` khởi động Express kèm Vite middleware; không chạy riêng Vite rồi kỳ vọng backend 4318. Không có lint script hoặc standalone typecheck script; build đã bao gồm tsc.

Preview build local: `SERVE_BUILD=true npm run dev` sau build. `NODE_ENV=production` cố ý thất bại. `npm run db:restore-drill` dùng cluster local, tạo backup riêng tư và DB restore tạm; cần quyền admin và dung lượng đĩa.

## Workers

```sh
GOTEK_WORKER_WORKSPACE=<workspace-uuid> npm run worker:ai -- --once
npm run worker:ai -- --all --once
GOTEK_WORKER_WORKSPACE=<workspace-uuid> npm run worker:web -- --once
GOTEK_WORKER_WORKSPACE=<workspace-uuid> GOTEK_KNOWLEDGE_VERSION=<version-uuid> GOTEK_EMBEDDING_MODEL=<model-uuid> npm run worker:embedding
```

Thay placeholder bằng UUID thật của local/test. AI/web bỏ `--once` để chạy liên tục. AI `--all` không dùng đồng thời GOTEK_WORKER_WORKSPACE. Embedding là batch hữu hạn. Provider call thật có thể tiêu tốn quota; test fixture không phải API receipt. Worker không tự publish nội dung web.

## Debugging and conventions

- ENOENT runtime.json: start cluster rồi `npm run db:setup`.
- ECONNREFUSED 55432: kiểm tra cluster/status, không tạo cluster trùng.
- Password authentication failed: kiểm tra runtime config và role hiện tại; setup không reset password của role đã tồn tại.
- Port 4317 busy: xác định process đang chạy trước khi stop; không kill process không thuộc nhiệm vụ.
- “Không thể kết nối”: kiểm tra HTTP `/api/health`, process server và DB; không suy ra UI là nguyên nhân.
- Provider missing secret/grant: đọc registry và trạng thái grant; không bypass validation.

Dùng TypeScript strict, SQL tham số hóa, transaction + tenant scope, stable error codes và kiểm thử quyền âm. Migrations mới theo thứ tự hiện hành; không sửa migration đã triển khai nếu chưa có kế hoạch. Các fixture như `scripts/ui-platform-fixture.ts` chỉ dành local/test, không phải seed production.
