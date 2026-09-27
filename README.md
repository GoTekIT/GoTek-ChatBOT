# GoTek Chatbot

GoTek Chatbot là nền tảng hỗ trợ khách hàng cho doanh nghiệp: mỗi workspace có hội thoại, widget và kho tri thức riêng; AI trả lời theo dữ liệu đã xuất bản của doanh nghiệp.

**Status: Active Development / MVP In Progress.** Core backend đang phát triển; chưa nghiệm thu toàn bộ H01–H32/E01–E12, chưa phát hành production. HiChat (hichat.asia, sản phẩm HiLab) là tham chiếu chức năng/UI; không có bằng chứng về kiến trúc backend nội bộ HiChat.

## Product purpose

Tập trung tiếp nhận khách hàng, chuyển tiếp AI/nhân viên, quản lý dữ liệu doanh nghiệp và kiểm soát model/quota từ Platform Admin. Workspace Admin và Platform Admin là hai miền quyền khác nhau.

## Main features

- ✅ Các lát cắt backend đã có kiểm thử local: auth, tenant/RLS, widget/hội thoại, tri thức có phiên bản, quota/jobs/audit. Mức xác minh từng phần ở [PROJECT-STATUS](docs/PROJECT-STATUS.md), không đồng nghĩa nghiệm thu toàn module.
- 🚧 AI grounding, provider/model registry, web ingestion và luồng agent; còn live-provider/browser acceptance.
- ⏳ Phần còn lại của H01–H32 và E01–E12 theo [backlog](delivery/BACKLOG.csv).
- ⚠️ Production bị chặn trong entrypoint; các test DB yêu cầu cluster local chuyên dụng. Không dùng dữ liệu khách thật.

## Tech stack

React 19 + Vite 6; Express 5 + TypeScript; PostgreSQL 16 qua `pg`, SQL migrations (không ORM); Argon2 và cookie session; PostgreSQL durable jobs; local file/runtime storage. Provider transports có Gemini, OpenAI/ChatGPT, Anthropic/Claude Code và custom LLM. Có adapter không đồng nghĩa đã kiểm thử API thật. Không có production hosting/CI/CD đã được xác nhận.

## Quick start

```sh
git clone https://github.com/GoTekIT/GoTek-ChatBOT.git
cd GoTek-ChatBOT
git checkout codex/chatbot-delivery
npm ci
```

Chuẩn bị PostgreSQL theo [DEVELOPMENT](docs/DEVELOPMENT.md), sau đó:

```sh
npm run db:setup
npm run dev
```

Mở http://127.0.0.1:4317. `db:setup` yêu cầu cluster đã chạy; nó không tự cài/start PostgreSQL. `.env.example` chỉ là danh mục cấu hình: backend **không tự đọc `.env`**. Mặc định kết nối qua `.local/runtime.json` do setup tạo; các biến khác phải export trong shell.

## Common commands

| Command | Purpose |
|---|---|
| `npm run dev` | Express + Vite middleware local |
| `npm run build` | TypeScript check + frontend build |
| `npx tsc --noEmit` | TypeScript check |
| `npm test` | Node test runner, serial, có DB integration |
| `npm run db:setup` | Apply SQL migrations |
| `npm run db:restore-drill` | Local backup/restore verification |
| `npm run worker:ai` | AI worker, cần workspace env hoặc `-- --all` |
| `npm run worker:embedding` | Một batch embedding, cần env |
| `npm run worker:web` | Web refresh worker, cần workspace env |

Không có script lint. Xem [TESTING](docs/TESTING.md) trước khi chạy test.

## Documentation map

1. [Start here](docs/00-START-HERE.md)
2. [Project status](docs/PROJECT-STATUS.md)
3. [Architecture](docs/ARCHITECTURE.md)
4. [System flow](docs/SYSTEM-FLOW.md)
5. [Development handoff](docs/HANDOFF.md)
6. [AI agent instructions](AGENTS.md)

Nguồn yêu cầu: [handoff v2.0](delivery/GoTek_Chatbot_Skill_Dev_Kit/handoff/GoTek_ChatBOT_Ban_giao_Dev_Toan_bo.docx), [chỉ đạo](research/USER_DIRECTION.md), [ghi chép khảo sát HiChat](research/HICHAT_AI_SPEC.md), [checkpoint](delivery/CHECKPOINT.md). Tài liệu lịch sử/snapshot không thay thế trạng thái hiện hành và bằng chứng kiểm thử.
