# Audit và kế hoạch workshop 2 tuần — Nguyên

**Dự án:** GoTek Chatbot  
**Vai trò:** Nguyên / TV3 trong file demo  
**Nguồn công việc:** GoTek_Demo_Workshop_2_Tuan.xlsx, sheet WBS Demo và Lich 2 tuan  
**Phạm vi trực tiếp:** D-UC06, D-UC07, D-UC08, QA-01, BUF-03  
**Thời gian:** N1–N10, trong đó N1 là ngày làm việc thứ nhất  
**Ngày audit:** 29/09/2026

## Kết luận của lead

Code nền cho handoff, takeover, public reply, internal note, status và lịch sử đã tồn tại. Tuy nhiên, phạm vi Nguyên chưa đạt mức sẵn sàng demo thực tế vì còn thiếu browser evidence, fixture hai tenant có thể reset, test chạy lặp và một control quan trọng trên widget.

Đánh giá nghiêm ngặt hiện tại:

- Độ sẵn sàng workshop toàn bộ 8 UC: 4,6/10.
- Độ sẵn sàng phạm vi Nguyên: 4,8/10.
- Trạng thái: IN PROGRESS, chưa được gọi là DONE hoặc Accepted.

Thang điểm:

- 0–2: chưa có lát cắt sử dụng được.
- 3–4: có một phần code nhưng còn blocker trực tiếp.
- 5–6: code path khá đầy đủ nhưng thiếu runtime/browser/evidence.
- 7–8: đã chạy end-to-end và có negative case, còn thiếu hardening.
- 9: chạy lặp ổn định, có evidence và runbook.
- 10: có đủ code, data, quyền, lỗi, browser, vận hành và sign-off.

## Căn cứ code hiện tại

### Đã có

- Backend có POST /widget-api/:key/handoff và phân biệt HANDOFF_PENDING, HUMAN_ACTIVE, AI_ACTIVE trong backend/src/modules/widget/widget.ts.
- Backend có takeover với owner_version fence tại backend/src/modules/chat/chat-store.ts và route POST /api/conversations/:id/takeover.
- Agent có thể gửi public reply hoặc internal note tại backend/src/modules/chat/inbox.ts.
- UI Inbox có takeover, public reply, internal note, status open/resolved/snoozed, polling message và lưu retry draft tại frontend/src/screens/inbox/Inbox.tsx.
- Database có workspaces, memberships, channels, visitors, conversations, messages, jobs, knowledge, provider/model/grant và audit tables. Kiểm tra read-only trên Supabase Pooler xác nhận các bảng core tồn tại.
- Có targeted tests liên quan widget boundary, chat store, takeover/resume AI, assignment và worker stale-owner.
- Supabase Session Pooler đã kết nối được bằng SELECT 1; backend đã được cấu hình local qua Pooler.

### Chưa đủ hoặc đang thiếu

1. D-UC06 chưa demo được trên browser: SDK hiển thị trạng thái HANDOFF_PENDING nhưng không có nút và handler gọi /handoff.
2. D-UC07 chưa có browser receipt evidence: Inbox UI có takeover và gửi tin, nhưng chưa chứng minh visitor nhận tin thật, receipt được ghi và AI cũ bị chặn trong đúng phiên demo.
3. D-UC08 chưa đủ trải nghiệm lịch sử: Inbox list hiện hiển thị tên kênh và một phần conversation ID; chưa hiển thị rõ danh tính visitor/profile. Search chủ yếu theo tên kênh và list giới hạn 100.
4. Knowledge UI đang publish INTERNAL: frontend/src/screens/knowledge/Knowledge.tsx gửi audience INTERNAL và nút ghi Xuất bản nội bộ. Điều này chưa đủ cho D-UC05 vì visitor/AI grounding cần nguồn PUBLIC đã publish.
5. Import file chưa có UI tương ứng hoàn chỉnh: backend có route import, nhưng màn Knowledge hiện tập trung tạo draft thủ công.
6. AI live receipt chưa xác minh: worker/provider/grant/quota code có, nhưng chưa có bằng chứng provider thật trả lời trên workspace demo.
7. QA suite chưa phải browser acceptance: frontend chỉ có 5 unit tests; backend tests có targeted cases nhưng không thay thế browser evidence.
8. Fixture demo chưa có quy trình reset chuẩn: test hiện tạo UUID ngẫu nhiên và cleanup theo từng test; chưa có fixture workshop có seed, reset, account, origin, channel key và evidence manifest.
9. Handoff chưa có audit event riêng ở route public; cần chốt có ghi conversation.handoff_requested hay không.
10. assigned_to và reply_owner phải được trình bày tách biệt. Đã assign capacity không có nghĩa Agent đã takeover.

## Bảng đánh giá từng hạng mục

| Hạng mục | Owner | Code hiện tại | Thiếu để nghiệm thu | Điểm |
|---|---|---|---|---:|
| D-UC01 Login/workspace | Nam | Auth, session, workspace switch có | Browser evidence và tài khoản demo sạch | 6,0 |
| D-UC02 Knowledge | Lợi | Draft/process/publish backend có; UI chỉ publish INTERNAL | PUBLIC publish, 5–10 FAQ, evidence retrieval | 4,0 |
| D-UC03 Model AI | Nam | Registry/grant/provider/quota có | Provider key, model thật, live receipt | 4,0 |
| D-UC04 Widget | Lợi | SDK/API/origin/prechat/message có | Website thật, origin hợp lệ, browser evidence | 6,0 |
| D-UC05 AI grounded reply | Nam | Worker, retrieval, citation, quota fence có | PUBLIC source, model thật, 5 câu hỏi đối chiếu | 3,0 |
| D-UC06 Handoff | Nguyên | API /handoff có; SDK thiếu control | Nút yêu cầu người, pending state, browser | 5,0 |
| D-UC07 Takeover/reply | Nguyên | Inbox/takeover/fence/public-note có | Hai role/browser, receipt, stale AI, 3 lần chạy | 6,0 |
| D-UC08 Resolve/history | Nguyên | Status route/UI và polling có | Visitor identity, reload/history, permission negative | 5,5 |
| QA-01 Demo QA | Nguyên | Có nhiều targeted tests | Fixture hai tenant, matrix, browser, 3 runs | 3,0 |
| BUF-03 Handoff buffer | Nguyên | Có ngân sách dự phòng | Defect register, triage rule, reset/re-run checklist | 3,0 |

Điểm là điểm sẵn sàng nghiệm thu, không phải điểm chất lượng code riêng lẻ. Source tồn tại chỉ được tính là Implemented, chưa tự động là Verified hay Accepted.

## Việc Nguyên phải hoàn thành

### D-UC06 — Khách yêu cầu gặp nhân viên

Acceptance bắt buộc:

- Visitor mở widget đúng origin.
- Có nút rõ ràng Yêu cầu gặp nhân viên.
- Bấm nút chuyển AI_ACTIVE thành HANDOFF_PENDING và tăng owner_version.
- Không hiển thị Nhân viên đang hỗ trợ trước khi Agent takeover.
- Bấm lại không tạo side effect hoặc tăng version sai.
- Sai origin, token hết hạn và visitor khác channel bị chặn.
- Agent thấy hội thoại chờ xử lý trong Inbox.

Code cần làm:

- Thêm control và handler /handoff vào backend/public/sdk.js; đồng bộ frontend/public/sdk.js.
- Hiển thị riêng AI_ACTIVE, HANDOFF_PENDING, HUMAN_ACTIVE.
- Khóa nút trong lúc request, xử lý lỗi/reconnect, giữ trạng thái sau reload.
- Bổ sung contract test cho SDK và widget API test cho wrong-origin, expired-token, repeat request.
- Chốt và nếu cần thêm audit event conversation.handoff_requested.

### D-UC07 — Nhân viên takeover và trả lời

Acceptance bắt buộc:

- Agent chỉ thấy conversation đúng membership, channel và workspace.
- Hai thao tác takeover đồng thời chỉ có một winner.
- Version cũ trả STALE_REPLY_OWNER.
- Chỉ Agent đã takeover mới gửi public reply.
- Internal note không xuất hiện ở widget visitor.
- AI reply đến muộn sau takeover không được append.
- Visitor nhận public reply và receipt được ghi.
- Retry cùng clientId không nhân đôi message.

Code cần làm hoặc xác minh:

- Giữ owner-version fence trong chat-store.ts, không bypass bằng UI.
- Cập nhật UI sau takeover để nút gửi phản ánh HUMAN_ACTIVE và assigned_to.
- Phân biệt Đã lưu · Chưa có xác nhận phía khách và Khách đã nhận.
- Thêm browser evidence cho Agent và Visitor.
- Ghi transcript, client ID, owner version và receipt vào evidence đã redact.

### D-UC08 — Kết thúc và xem lại lịch sử

Acceptance bắt buộc:

- Agent chuyển open → resolved.
- Có thể mở lại resolved → open.
- snoozed không bị hiểu là resolved.
- Reload hoặc mở lại conversation vẫn thấy lịch sử đúng visitor.
- Workspace khác không thấy conversation.
- Internal note còn trong Agent history nhưng không lộ ra visitor.

Code cần làm hoặc xác minh:

- Trả visitor profile tối thiểu được phép hiển thị trong inboxList và render identity rõ ràng trong Inbox.
- Quy định search/history cho workshop: ít nhất tìm đúng visitor hoặc conversation, không chỉ tìm tên kênh.
- Nếu giữ giới hạn 100 trong demo, ghi rõ giới hạn; production-like acceptance cần cursor pagination.
- Test status transition, reload, cross-tenant và role denial.

### QA-01 — Kiểm chứng vòng demo và lỗi thiết yếu

Bộ ca bắt buộc:

1. Tenant A và Tenant B dùng cùng code path.
2. Owner/Admin/Agent của A không đọc được dữ liệu B.
3. Draft/private knowledge không xuất hiện ở visitor.
4. Wrong origin và token hết hạn bị chặn.
5. Visitor handoff không bị ghi là human takeover.
6. Takeover cạnh tranh chỉ một winner.
7. AI stale response không ghi sau takeover.
8. Public reply hiển thị, internal note không hiển thị.
9. Duplicate client ID không nhân đôi message.
10. Quota thiếu hoặc unknown không tạo retry mù.
11. Reload browser vẫn giữ lịch sử và trạng thái đúng.
12. Chạy vòng chính liên tiếp 3 lần sau reset fixture.

Không được dùng một screenshot, một API 200, một unit test hoặc video ghi sẵn để tuyên bố toàn bộ demo đạt.

### BUF-03 — Dự phòng handoff và vòng hội thoại

- Chỉ sửa lỗi chặn các UC đã chốt.
- Mỗi defect có mã, severity, bước tái hiện, owner, commit và evidence.
- P0: leak tenant/private, sai takeover, lộ secret, duplicate side effect.
- P1: visitor không nhận public reply, handoff không tới Inbox, status/history sai.
- P2: text/layout/empty state không chặn luồng.
- Không mở ticket, CRM hoặc automation mới trong buffer.

## Kế hoạch N1–N10 cho Nguyên

### N1 — Baseline, contract và fixture

Mục tiêu: biết chính xác demo đang đứng ở đâu trước khi sửa.

- Đọc WBS Demo, Lich 2 tuan, PROJECT-STATUS, HANDOFF và các route/widget/inbox.
- Chốt screen/API contract cho D-UC06–08: role, origin, state, control, error, receipt, evidence.
- Tạo fixture workshop riêng: Tenant A/B, Owner/Admin/Agent, channel, origin, visitor và sample conversation.
- Không dùng dữ liệu production; seed/reset đã chạy trên PostgreSQL disposable local, không dùng Supabase shared.
- Viết và chạy checklist reset theo manifest UUID, không dùng lệnh xóa rộng; cleanup kiểm tra còn 0 workspace/channel fixture.
- Chạy build, frontend test và full backend integration trên DB test cô lập.

Code: ưu tiên seed/reset script an toàn và contract test.  
Evidence: fixture manifest đã redact, schema check, acceptance matrix, blocker list.  
Gate N1: hai tenant, reset và full local suite đã đạt; browser acceptance vẫn là gate tiếp theo, không tự suy ra từ API test.

Kế hoạch thực thi chi tiết và kết quả chạy hiện tại: xem [NGAY-1-KE-HOACH-CHI-TIET-2026-09-29.md](NGAY-1-KE-HOACH-CHI-TIET-2026-09-29.md) và [NGAY-1-TIEN-DO-2026-09-29.md](NGAY-1-TIEN-DO-2026-09-29.md).

### N2 — Handoff từ widget

Mục tiêu: khách có thể yêu cầu nhân viên bằng thao tác thật.

Kế hoạch chi tiết: xem [NGAY-2-KE-HOACH-CHI-TIET-2026-09-30.md](NGAY-2-KE-HOACH-CHI-TIET-2026-09-30.md).

- Implement nút và handler /handoff trong SDK canonical, đồng bộ bản sao.
- Hiển thị Đang kết nối nhân viên, không hiển thị Nhân viên đang hỗ trợ khi chưa takeover.
- Test repeat click, refresh, reconnect, wrong origin và expired token.
- Kiểm tra visitor profile/pre-chat không mất sau handoff.

Evidence: browser screenshot/video visitor và API transcript.  
Gate: D-UC06 chỉ đạt khi visitor tự bấm được và Inbox nhận đúng conversation.

### N3 — Handoff permission và inbox visibility

Mục tiêu: handoff vào đúng workspace và đúng hàng đợi.

- Chạy test hai tenant, hai origin, token sai và Agent không thuộc channel.
- Chốt assigned_to khác reply_owner; UI thể hiện pending vs human active.
- Thêm audit event nếu product decision yêu cầu trace việc khách xin người.
- Kiểm tra channel disabled, workspace disabled và conversation resolved/snoozed khi handoff lại.

Evidence: request/response redact, DB state trước/sau, audit row nếu có.  
Gate: không cross-tenant leak và không có trạng thái giả đã takeover.

### N4 — Takeover và public/internal reply

Mục tiêu: Agent tiếp quản và trả lời thật.

- Chạy Agent UI với conversation pending.
- Test concurrent takeover và stale owner version.
- Gửi public reply; mở visitor widget xác nhận message.
- Gửi internal note; xác nhận visitor không thấy.
- Test duplicate clientId, mất mạng/retry và message pending localStorage.

Evidence: hai role/browser, transcript sequence, owner version, receipt.  
Gate: một winner takeover, không duplicate, không lộ note.

### N5 — Resolve, reopen và lịch sử

Mục tiêu: hoàn tất D-UC08 trên UI.

- Bổ sung visitor identity tối thiểu vào Inbox nếu cần.
- Chạy open → resolved → open và open → snoozed → open.
- Reload browser, đổi tab, mở lại conversation và kiểm message ordering.
- Kiểm role Agent/Owner/Admin và cross-tenant.

Evidence: screenshot trạng thái, history sau reload, permission negative.  
Gate: người xem hiểu conversation nào, khách nào, đang ở trạng thái nào.

### N6 — Nối vòng D-UC06 → D-UC08

Mục tiêu: một câu chuyện liền mạch từ widget đến Agent.

- Visitor gửi câu hỏi → AI hoặc pending → yêu cầu người → Agent takeover → public reply → resolve → mở lịch sử.
- Nguyên phụ trách handoff/takeover/Agent/history; phối hợp Nam về AI worker và Lợi về website/knowledge.
- Không sửa thêm tính năng ngoài 8 UC.
- Chạy targeted tests sau mỗi fix.

Evidence: transcript một vòng hoàn chỉnh và defect list.  
Gate: chạy liền một vòng không thao tác SQL thủ công giữa chừng.

### N7 — QA hard cases

Mục tiêu: đóng QA-01 ở mức có thể tin cậy.

- Chạy 12 ca bắt buộc trong QA matrix.
- Đối chiếu private/draft/public knowledge, quota, unknown outcome, retry và stale AI.
- Chạy cùng bộ ca cho Tenant A và B.
- Lặp vòng chính 3 lần sau reset fixture.

Evidence: matrix pass/fail, commit, environment, role, tenant, timestamp, defect owner.  
Gate: lỗi quyền, secret, takeover hoặc duplicate side effect còn mở thì chưa tổng duyệt.

### N8 — Tổng duyệt trên máy trình diễn

Mục tiêu: biết lỗi khi chạy browser, mạng và máy thật.

- Dùng đúng browser, viewport, mạng và tài khoản workshop.
- Diễn tập Admin → Visitor → Agent; kiểm widget script, origin và session resume.
- Ghi hình từ lần chạy thật; không dùng video thay live evidence.
- Ghi lỗi timing, polling và receipt để xử lý trong buffer.

Evidence: video có timestamp/commit, screenshot state, run log.  
Gate: có dữ liệu reset và người khác lặp lại được theo script.

### N9 — Buffer và candidate freeze

Mục tiêu: sửa defect chặn và khóa bản ứng viên.

- Chỉ xử lý P0/P1 liên quan handoff, takeover, reply, history và privacy.
- Sau mỗi fix chạy lại targeted test và browser flow bị ảnh hưởng.
- Không thêm provider, CRM, ticket, automation, đa kênh hoặc dashboard.
- Ghi rõ known limitation nếu chưa đạt.

Evidence: defect closure report, changed files, checks run, remaining risks.  
Gate: candidate workshop có commit rõ và không còn lỗi P0.

### N10 — Khóa demo và hỗ trợ trình diễn

Mục tiêu: không làm hỏng bản ổn định vào ngày cuối.

- Reset fixture, kiểm tra account, origin, channel key, quota và provider readiness.
- Chạy smoke: login → widget → handoff → takeover → reply → resolve → history.
- Kiểm script/video dự phòng, gắn nhãn bản ghi nếu không live.
- Khóa commit, ghi version, người xác nhận và known limitations.
- Không chạy migration hoặc destructive command trên Supabase dùng chung.

Evidence: final checklist, smoke transcript, reset proof, commit/version.  
Gate: 8 UC chỉ ghi demo-ready khi từng UC có evidence; nếu không, công bố chính xác UC chưa đạt.

## Phụ thuộc với Nam và Lợi

| Phụ thuộc | Người | Cần cung cấp cho Nguyên |
|---|---|---|
| D-UC01 | Nam | Tài khoản demo, workspace active, login chạy và reset được |
| D-UC02 | Lợi | 5–10 FAQ/tài liệu giả lập, version READY, audience PUBLIC đã publish |
| D-UC03 | Nam | Provider/model thật, grant chat, quota và credential server-side |
| D-UC04 | Lợi | Website/domain demo, origin đúng, channel key và widget mở được |
| D-UC05 | Nam | Worker đang chạy, 5 câu hỏi có đáp án chuẩn, citation/unknown behavior |

Nếu một phụ thuộc chưa đạt, Nguyên phải ghi QA là BLOCKED / NEEDS VERIFICATION, không ghi PASS bằng mock hoặc video cũ.

## Checklist nghiệm thu cuối

- [ ] D-UC06 visitor có nút handoff thật và pending state đúng.
- [ ] D-UC07 takeover có một winner, public reply tới visitor, internal note bị chặn khỏi widget.
- [ ] D-UC07 stale AI bị chặn sau takeover.
- [ ] D-UC08 resolve/reopen/snooze và history sau reload đúng.
- [ ] Hai tenant không nhìn thấy dữ liệu của nhau.
- [ ] Wrong origin, expired token và role denied có evidence.
- [ ] Duplicate client ID và retry không duplicate side effect.
- [ ] Fixture reset được và chạy 3 vòng liên tiếp.
- [ ] Provider, quota và knowledge PUBLIC đã được người phụ trách xác nhận.
- [ ] Có commit/version, transcript, screenshot/video thật và known limitations.
- [ ] Không có secret trong evidence, browser payload hoặc repository.

## Kết luận cuối

Nguyên có nền backend tốt cho handoff/takeover, nhưng điểm yếu nằm ở lớp cuối: widget control, browser flow, visitor identity/history và evidence có thể lặp lại. Ưu tiên trong 10 ngày là một vertical slice có UI, API, database, permission, error và evidence; không mở rộng thêm module.

Nếu giữ nguyên code mà chỉ trình diễn, D-UC06 chưa hoàn thành end-to-end vì khách không có nút yêu cầu nhân viên; D-UC05 cũng chưa chắc chạy vì Knowledge UI đang publish INTERNAL. Hai gap này phải được xử lý hoặc công bố rõ trước khi gọi workshop đạt.
