# H10.02 — Kho thông tin cho AI

Ngày: 2026-09-25. Trạng thái: đề xuất triển khai GoTek, chưa Implemented/Verified/Accepted. Phạm vi lát cắt: dữ liệu nhập thủ công; H10.01 FAQ, H10.03 mẫu câu, H10.04 ảnh và import/export H10.05 vẫn giữ nguyên backlog.

## Nguồn và bằng chứng

- `delivery/GoTek_Chatbot_Skill_Dev_Kit/gotek-chatbot-delivery/references/HANDOFF.md`, H10 dòng 1418–1450; pipeline D2 dòng 321, quyền publish dòng 285.
- `delivery/BACKLOG.csv`: H10.02 và H10.05; `research/HICHAT_AI_SPEC.md`: form đã đọc, chưa lưu hoặc retrieval.
- O: tiêu đề “Thông tin cho AI” bắt buộc tối đa 100; nội dung bắt buộc tối đa 2000; danh mục tùy chọn/thêm danh mục; active mặc định bật; lọc danh mục/trạng thái/nguồn thủ công/mới-cũ.
- P: hành vi lưu, chỉnh sửa, import, retrieval và pixel/layout parity. Sơ đồ H10 trong handoff không phải screenshot. Chưa xác định được screenshot cùng route/role/state để khóa visual baseline.
- D: draft/job/version/publish/rollback, audience và isolation là yêu cầu GoTek, không phải hành vi HiChat được quan sát.
- Repo đã kiểm: Express/TypeScript/PostgreSQL, `rules.ts`, migration 015, RLS theo `app.workspace_id`, giao dịch/audit hiện có; chưa có knowledge module tại thời điểm khảo sát. Tái sử dụng nền tảng này, không đổi kiến trúc.

## Screen contract

Route GoTek đề xuất `/settings/knowledge`; giữ shell/menu Cài đặt AI hiện có, nhãn “Kho thông tin”. Workspace Owner/Admin được quản lý; Agent bị chặn cả route và API, không mặc định đọc nội dung qua console. Đây là quyết định quyền GoTek; editor riêng chưa tồn tại trong repo.

Danh sách gồm tìm kiếm; lọc danh mục, active, nguồn “Thủ công”; sắp xếp mới/cũ; nút thêm. Mỗi mục có tiêu đề, danh mục, active, trạng thái bản nháp/bản phục vụ, cập nhật và thao tác sửa. Không thêm KPI/hero. Pagination không cắt im lặng ở 100 mục. Có loading, empty, empty search, retry lỗi và forbidden.

Form theo thứ tự đã quan sát: “Thông tin cho AI” với counter /100; editor “Nội dung” counter /2000; danh mục tùy chọn kèm thêm danh mục; active mặc định bật; Hủy/Tạo hoặc Lưu bản nháp. Tạo bị vô hiệu khi trường bắt buộc chỉ có whitespace. Lỗi đặt đúng trường; lỗi mạng giữ nội dung và requestId; Hủy không ghi. Sau lưu đọc lại từ API, không chỉ toast.

Quyết định kỹ thuật: nội dung chuẩn lưu plain text; editor cần giữ xuống dòng. Rich-text toolbar/format HiChat chưa có bằng chứng; không tuyên bố tương đương editor HiChat nếu chỉ có textarea. Đếm Unicode code points sau trim, đồng nhất JS `Array.from(text).length` với PostgreSQL `char_length`; không dùng `.length` UTF-16 làm giới hạn server. Có test emoji, tiếng Việt và 100/101, 2000/2001.

Publish là thao tác riêng có xác nhận audience PUBLIC/INTERNAL và phiên bản cụ thể; tạo/lưu/active không tự publish. Hiển thị rõ bản đang phục vụ khác bản nháp. Audience mặc định INTERNAL; chuyển PUBLIC yêu cầu người quản lý chủ động xác nhận. Không cần xin thêm phép người dùng để triển khai cơ chế này trong local/test.

Viewport đề xuất kiểm thử 1440/1280, 768, 390/360; giữ theme hiện tại. Chưa có screenshot HiChat tương ứng: responsive/focus/error là yêu cầu chất lượng GoTek, chưa xác nhận parity. Khi dùng modal: focus/trap/Escape và trả focus về trigger.

## Schema đề xuất

- `knowledge_categories`: id, workspace_id, name (trim 1..100), created_by, timestamps; unique(workspace_id, normalized_name). Giới hạn tên 100 là quyết định GoTek.
- `knowledge_items`: id, workspace_id, category_id nullable, source_type MANUAL, active true, audience INTERNAL/PUBLIC, revision bigint, draft_version_id nullable, published_version_id nullable, archived_at nullable, created_by, timestamps.
- `knowledge_versions`: id, workspace_id, item_id, version_no, title (trim 1..100), content (trim 1..2000), content_hash, state DRAFT/QUEUED/PROCESSING/READY/FAILED, failure_code nullable, created_by, created_at, processed_at. Unique(workspace_id,item_id,version_no).
- `knowledge_mutations`: workspace_id, request_id, operation, payload_hash, result_ref/response; unique(workspace_id,request_id). Ghi cùng transaction với side effect; không lưu mật khẩu/credential.
- Dùng composite FK workspace+item/category/version để không gắn version/danh mục của tenant khác; unique(workspace_id,id) ở bảng đích. Con trỏ published phải thuộc đúng item bằng kiểm tra khóa trong transaction và composite FK phù hợp.
- Tất cả bảng FORCE RLS USING/WITH CHECK workspace session; API không nhận workspace_id từ body. Quyền worker phải kiểm tenant của payload với bản ghi, không dùng role bypass RLS chung.
- Nội dung của version sau QUEUED bất biến; sửa tạo version DRAFT mới. `revision` item dùng optimistic concurrency cho cập nhật pointer/active/audience/category. Bản đang publish không bị ghi đè khi draft thay đổi.

## API và transaction

Tất cả endpoint dùng `/api/knowledge/items` và `/api/knowledge-categories`, session → membership → workspace → Owner/Admin. Input strict; UUID và giới hạn được kiểm trước truy vấn nghiệp vụ. Response không chứa nội dung tenant khác hoặc stack lỗi.

| Endpoint | Hợp đồng |
| --- | --- |
| GET /api/knowledge/items | search, categoryId, active, source=MANUAL, sort=newest/oldest, cursor, limit 1..100; trả items,nextCursor; query parameter sai trả 400 |
| GET /api/knowledge/items/:id | dữ liệu item + draft/phiên bản phục vụ theo quyền; foreign/missing đều 404 |
| POST /api/knowledge/items | requestId bắt buộc; title,content,categoryId?,active; tạo item INTERNAL + version DRAFT, chưa phục vụ |
| PATCH /api/knowledge/items/:id/draft | requestId,expectedRevision,title,content,categoryId?; tạo draft version mới hoặc thay draft chưa queued; revision tăng |
| POST /api/knowledge/items/:id/process | requestId,expectedRevision,versionId; DRAFT → QUEUED và enqueue cùng transaction/outbox; trả 202 và jobId |
| POST /api/knowledge/items/:id/publish | requestId,expectedRevision,versionId,audience; chỉ READY và active, item chưa archived; kiểm audience, đổi pointer nguyên tử, audit, invalidation outbox |
| POST /api/knowledge/items/:id/rollback | requestId,expectedRevision,versionId; chỉ bản tốt đã từng publish của chính item; kiểm lại audience/quyền, đổi pointer + audit |
| PATCH /api/knowledge/items/:id/state | requestId,expectedRevision,active; tắt có hiệu lực retrieval ngay; tăng revision + audit/invalidation |
| POST /api/knowledge/items/:id/archive | requestId,expectedRevision; ngừng phục vụ, giữ lịch sử, audit/invalidation |
| GET /api/knowledge-categories | danh mục trong tenant |
| POST /api/knowledge-categories | requestId,name; trùng tên trả 409 CATEGORY_EXISTS, không tạo đôi |

Replay cùng requestId + normalized payload trả kết quả trước; đổi operation/payload trả 409 IDEMPOTENCY_CONFLICT. Khóa mutation theo workspace/requestId, khóa item rồi kiểm expectedRevision; request đồng thời chỉ một cập nhật thành công. Audit một lần cho side effect thành công. Rollback transaction khi enqueue/audit lỗi; failure xử lý worker được ghi ở transaction khác, không làm mất bản tốt.

Error contract: 400 VALIDATION_ERROR có field path; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND; 409 VERSION_CONFLICT/IDEMPOTENCY_CONFLICT/NOT_READY/INACTIVE/CATEGORY_EXISTS; 429 QUOTA_EXCEEDED chỉ khi có quota thực, không tự lấy quota 2 từ sandbox HiChat; 503 xử lý tạm lỗi, không trả trạng thái publish giả. UI giữ draft khi lỗi và cho tải lại khi conflict.

## Worker và truy xuất

MANUAL processor xác thực nội dung, chuẩn hóa/chunk deterministic có version ID và tenant; job idempotent, retries không sinh chunk đôi. Không gọi provider để “xử lý” nếu chưa có credential. READY chỉ chứng minh index/representation thực đã lưu thành công; không ghi READY chỉ vì enqueue thành công. Provider embedding nếu cần là bước riêng có receipt, không giả dữ liệu vector.

Retrieval phải lọc workspace + item active + chưa archived + published_version_id + audience trước khi đọc chunk. Widget chỉ PUBLIC, INTERNAL không đi qua widget kể cả người quản trị đã nhập. Phiên bản draft/failed tuyệt đối không đưa vào prompt. Nội dung nguồn không được coi là lệnh vượt policy. Cache khóa tenant/version/audience và kiểm lại pointer/revision trước phục vụ; tắt/thu hồi không chờ cache TTL. Đích bot/source binding cần nối khi module bot có hợp đồng; không tự publish mọi nguồn vào mọi bot.

## Bằng chứng để nghiệm thu

1. UI tạo đủ 100/2000, reload giữ dữ liệu; vượt giới hạn và whitespace báo tại trường; tạo danh mục rồi lọc, search, pagination/sort có dữ liệu thật.
2. Hai tenant và Owner/Admin/Agent: tenant B không list/get/edit/process/publish/rollback ID A; Agent 403; test trực tiếp DB RLS và FK ghép không vượt workspace.
3. Publish bản 1; sửa bản 2 DRAFT rồi job FAILED: retrieval vẫn bản 1; retry xử lý READY rồi publish bản 2; rollback về 1; audit/version/pointer đọc lại thực.
4. Active=false/archive/revoke PUBLIC loại khỏi truy xuất và cache ngay; INTERNAL không xuất hiện trong visitor dù cùng workspace.
5. Duplicate/concurrent request chỉ một mutation/job/audit; expectedRevision cũ 409; error transaction không ghi dở.
6. Browser screenshot đúng trạng thái + ảnh nguồn tương ứng hoặc gap parity rõ; provider câu trả lời/citation thực là bằng chứng riêng. Build/unit/API xanh chưa đủ Accepted H10.02 và không đóng toàn bộ H10.
