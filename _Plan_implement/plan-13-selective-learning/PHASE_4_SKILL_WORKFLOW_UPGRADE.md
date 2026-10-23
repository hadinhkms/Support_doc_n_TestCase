# PHASE 4: SKILL WORKFLOW VÀ KNOWLEDGE LIFECYCLE

> Thuộc [Plan 13 v1.2](../13_SELF_EVOLVING_QA_SKILL_AND_SELECTIVE_LEARNING_PLAN.md). Phụ thuộc Phase 1–3.
> File chỉnh: .agents/skills/qa-logic-gaps/SKILL.md tại nguồn sở hữu ship.

## 1. Step 1: baseline và effective knowledge

Giữ workflow hiện tại: qa:gaps và qa:drift trước audit; đọc workspace instructions trước sửa REQ/TC/spec. Đọc policy và entry phù hợp domain/category từ shared catalog + <testCasesDir>/_learning/knowledge.json. Project chưa có kho là hợp lệ; schema/version hỏng phải hiện lỗi.

Link trong SKILL.md dùng references/SELECTIVE-LEARNING-POLICY.md, references/defect-heuristics-catalog.md, references/playwright-antipatterns-catalog.md. Project overlay resolve từ repo root/config, không từ thư mục skill. Giữ YAML front matter name/description. Không dán toàn bộ catalog vào SKILL.md; báo gap phải ghi ID bài học và AC/TC/spec evidence.

Tri thức bổ trợ audit, không thay requirement được xác nhận. Phiên mới chỉ nạp tri thức khi invoke skill; subagent cần được giao bước đọc rõ ràng. Plan không tự cấp phép spawn subagent.

## 2. Step 6: học sau verify

1. Chạy npm run qa:learn, đọc scope. Muốn học commit đã có thì chỉ định since, không giả định mặc định quét commit gần nhất.
2. Kiểm tra proposed/needsReview/rejected, old/new hoặc decision confirmed, đối chiếu bốn gate. Verify trực tiếp cần evidence file/test run + hash; engine không tự đọc chat.
3. Chưng cất Trigger/Failure Mode/Actionable Check + Category. Không tự đặt expected khi requirement im lặng; thiếu evidence giữ pending và nêu câu hỏi cụ thể.
4. Export review artifact bằng output; trình bày nội dung cụ thể, scope/nguồn. Điền approved/rejected + rationale/by/at theo quyết định review. Chỉ apply review trong phạm vi người dùng cho phép; authorization cập nhật bài học đã có trong phiên được dùng tiếp, không hỏi lại máy móc.
5. Dry-run khi cần preview; apply rồi đọc report/knowledge. Stale thì rescan/review phần đổi, không sửa hash để bypass.
6. Giữ provenance/dedup/cap. Reject noise không đồng nghĩa phải sửa catalog. Không tự xóa/gộp để né trần.

Review nội dung trước lưu không đồng nghĩa mỗi thao tác reversible cần thêm vòng xin phép. Nếu chưa có authorization thay đổi knowledge, chuẩn bị artifact cụ thể và trình bày để quyết định; không apply nội dung đang chờ duyệt.

## 3. Hub/project và graduation

Learner chỉ ghi project own overlay. Chia sẻ bài học chung cần khái quát/ẩn danh và review tại nguồn Hub; không tự push hoặc gửi message sang repo khác. Shared update không xóa overlay hoặc tái dùng ID project.

Static graduation ghi mapping entryId -> finding kind + coverage. PA-01 còn semantic remainder: URL-only có thể đúng TC; thêm visibility tùy ý chưa chứng minh data đúng. Không retire PA-01 chỉ vì rule minor tồn tại. Retire/merge cần review và replacement/tombstone.

## 4. Nghiệm thu

- Link tương đối từ SKILL.md đúng; YAML trigger chính giữ nguyên.
- Walkthrough phiên mới đọc shared/project; không overlay vẫn chạy; kho hỏng báo lỗi.
- Noise => reject không ghi; thiếu expected => pending; approved => overlay; replay => no-op; đầy => giữ kho.
- Không sửa REQ/TC/spec thật chỉ để thử workflow. Không tuyên bố tự học từ Jira/Slack/mọi subagent khi chưa có tích hợp.
