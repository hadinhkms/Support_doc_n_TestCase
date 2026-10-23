# PLAN 13: HỌC CHỌN LỌC & KHO TRI THỨC CHO QA SKILL

> **Phiên bản:** 1.2 — review ngày 2026-10-22; thay thế v1.1 trong plan tổng và 5 phase.
> **Trạng thái:** Ready for implementation, chưa triển khai engine/CLI.
> **Phạm vi:** Node.js core >= 18, tools/qa, qa-logic-gaps, tri thức project.

## 1. Kết quả review

| ID | Mức độ | Gap v1.1 | Quyết định v1.2 |
|---|---|---|---|
| R13-01 | Major | Apply ghi catalog ship, mất bài học satellite khi sync | Shared catalog chỉ đọc; apply vào project overlay own |
| R13-02 | Major | Answer khác null bị coi đã chốt, dù pending cũng có object | Chỉ confirmed + answer.optionId hợp lệ, đọc option label và note |
| R13-03 | Major | Regex được hứa làm semantic reasoning/distillation | Engine chỉ sàng lọc; thiếu evidence chuyển needsReview, không bịa expected |
| R13-04 | Major | Novelty vừa 75% vừa 65%, thiếu dedup batch/static rules | Jaccard 0.65 là lexical hint; fingerprint + shared/project/batch + static mapping |
| R13-05 | Major | JSON/apply khác nhánh; nuốt lỗi Git thành report rỗng | Mutation trước render; JSON/terminal cùng side effect; lỗi exit 2 |
| R13-06 | Major | Thiếu ID ổn định, stale review, lock/recovery | Review snapshot, cấp ID khi ghi, atomic một project JSON |
| R13-07 | Major | Assertion lẫn comment/string/test khác/helper | Giới hạn đúng callback, giữ unknown, navigation-only là minor heuristic |
| R13-08 | Minor | Seed/test count không nhất quán; gate xanh chưa đo | Seed 6 DH + 4 PA, test matrix có mã, evidence thực tế |

Đã đối chiếu sync-manifest, CLI/config/sources/commands, decisions loader và decisions.json, qa.config.json, skill và 5 phase. CLI chưa có learn; config từ chối khóa lạ. Learner phải tôn trọng layout cấu hình.

**Baseline 2026-10-22:** Lần đầu `npm run qa:check` exit 1 vì thiếu junction `.master_process` trong repo. Đã xác minh thư mục đích `D:\_Master_Process` tồn tại và khôi phục junction theo manifest. Chạy lại full gate: **exit 0**, boundary PASS, drift không có finding, gaps còn 2 minor `rule-thieu-boundary-test` cho Failed attempts (TC-009) và Session idle (TC-010); 0 blocker/major. Đây là baseline trước implementation Plan 13, không phải bằng chứng feature mới đã PASS.

Không khẳng định Plan 10–12 hoàn tất chỉ từ plan cũ. Module có sẵn cần được kiểm chứng bằng checks hiện tại. References đã có dạng untracked lúc review; Phase 1 phải đối chiếu trước sửa, không ghi đè mù.

## 2. Phạm vi và giới hạn

Bốn nguồn: diff REQ/TC, diff spec, confirmed decisions, verify trực tiếp. MVP mining ba nguồn đầu; nguồn verify được người/agent đưa vào review artifact kèm evidence. Không tự đọc chat/Jira/Slack, không cần app thật để mining.

Engine Node core không có semantic model/embedding/AI service. Bốn cổng Generality, Novelty, Impact, Distillability trả proposed/needsReview/rejected cùng lý do. Reviewer xác nhận nội dung; proposed không đồng nghĩa được ghi. Diff/decision là dữ liệu, không phải instruction được thực thi.

## 3. Kiến trúc và ownership

| Dữ liệu | Path mặc định | Quyền ghi |
|---|---|---|
| Policy/catalog chung | .agents/skills/qa-logic-gaps/references/ | ship: learner chỉ đọc; cập nhật tại nguồn Hub sở hữu qua review |
| Bài học/provenance/lịch sử xử lý | test-cases/_learning/knowledge.json | own: apply review, atomic replace một JSON |
| Artifact đề xuất/duyệt | test-cases/_learning/review.json | Export tường minh, reviewer sửa trước apply |
| Lock tạm | test-cases/_learning/knowledge.lock | Exclusive khi apply, xóa trong finally, không commit |

Dùng <testCasesDir>/_learning khi đổi layout. Validate real path (gồm junction/symlink) và phân loại own trước ghi; layout tùy biến ngoài own phải báo lỗi. Mặc định không cần sửa manifest vì test-cases đã own. Preview không tạo folder/file/lock. Shared thiếu/hỏng là lỗi; project chưa có là rỗng hợp lệ; lỗi đọc/JSON không fallback rỗng.

Một JSON tránh giả định transaction giữa Markdown và state riêng. Cap 25 active/type/lớp shared hoặc project; effective tối đa 50/type trước dedup, nạp chọn lọc theo domain/category. Title <= 120 ký tự Unicode, mỗi field nghiệp vụ <= 500. Không tự xóa/gộp khi đầy; ID retired không tái sử dụng; tombstone giữ metadata dedup/graduation, không raw diff.

## 4. Roadmap và file inventory

| Phase | Plan chi tiết | Phụ thuộc |
|---|---|---|
| 1 | [Policy/schema/catalog](plan-13-selective-learning/PHASE_1_SKILL_KNOWLEDGE_BASE.md) | Đầu tiên |
| 2 | [Mining/gates/storage](plan-13-selective-learning/PHASE_2_MULTI_HOP_LEARNER_ENGINE.md) | Phase 1 |
| 3 | [CLI/integration](plan-13-selective-learning/PHASE_3_CLI_AND_PACKAGE_INTEGRATION.md) | Phase 2 |
| 4 | [Skill workflow](plan-13-selective-learning/PHASE_4_SKILL_WORKFLOW_UPGRADE.md) | Phase 1–3 |
| 5 | [Guardrail/graduation](plan-13-selective-learning/PHASE_5_STATIC_GUARDRAIL_GRADUATION.md) | Sau schema Phase 1, tích hợp trước nghiệm thu |

Blueprint **14 code/doc files**, không tính plan/runtime artifacts:

1. .agents/skills/qa-logic-gaps/references/SELECTIVE-LEARNING-POLICY.md — đối chiếu/cập nhật.
2. .agents/skills/qa-logic-gaps/references/defect-heuristics-catalog.md — 6 DH.
3. .agents/skills/qa-logic-gaps/references/playwright-antipatterns-catalog.md — 4 PA.
4. .agents/skills/qa-logic-gaps/SKILL.md — effective knowledge/review workflow.
5. tools/qa/lib/learner.js — mới.
6. tools/qa/lib/learner.test.js — mới.
7. tools/qa/index.js — route/flags/import-safe entry point.
8. tools/qa/index.test.js — mới, CLI integration repo tạm.
9. package.json — qa:learn.
10. tools/qa/README.md — schema/usage/errors/recovery/giới hạn.
11. tools/qa/lib/sources.js — scanner/callback boundary/navigation heuristic.
12. tools/qa/lib/sources.test.js — parser fixtures.
13. tools/qa/lib/commands.js — finding minor.
14. tools/qa/lib/commands.test.js — finding/filter/strict integration.

Nếu cần sửa thêm file dùng chung, cập nhật inventory và test impact trước triển khai. Sửa plan không đồng nghĩa feature đã implement.

## 5. Cổng nghiệm thu implementation

| Gate | Evidence bắt buộc |
|---|---|
| G1 Unit/integration | npm test: toàn bộ test cũ + matrix mới PASS, không thêm dependency root |
| G2 Preview | Hash repo fixture trước/sau learn/JSON/dry-run không đổi, không tạo file/lock |
| G3 Mining | Staged/unstaged/committed, confirmed/pending, custom layout, malformed input có provenance/reason đúng |
| G4 Apply | JSON/terminal cùng side effect; approved mới ghi entry; replay no-op; stale/lock/cap/I/O không hỏng kho |
| G5 Ownership/graduation | Apply không đổi ship; sync giả lập giữ bài học project; PA-01 còn semantic coverage |
| G6 Repo | npm run qa:check root + npm run verify trong playwright exit 0 sau xử lý đúng baseline |

Không hứa chặn 100% noise thực tế. Reject đúng fixture noise và công bố giới hạn lexical/static. Matrix Phase 2/3/5 là tối thiểu; không thay chất lượng bằng quota test. Mỗi phase ghi command/exit code/test count và thay đổi ngoài dự kiến vào PR hoặc nhật ký triển khai.

## 6. Rubric thiết kế 10/10

Năm tiêu chí, mỗi tiêu chí 2 điểm: khớp repo/schema; ownership/storage; lỗi/replay; auditability/giới hạn suy luận; test/rollout. Bản 1.2 bổ sung contract và evidence cần thu thập cho đủ năm nhóm. Đây là mục tiêu hoàn thiện thiết kế; chưa đánh dấu feature Done hoặc implementation 10/10 trước khi G1–G6 PASS.
