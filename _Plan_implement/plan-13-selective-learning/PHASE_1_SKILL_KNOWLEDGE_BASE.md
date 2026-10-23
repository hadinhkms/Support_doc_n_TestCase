# PHASE 1: POLICY, CATALOG CHUNG VÀ SCHEMA PROJECT

> Thuộc [Plan 13 v1.2](../13_SELF_EVOLVING_QA_SKILL_AND_SELECTIVE_LEARNING_PLAN.md). Thay thế Phase 1 v1.1. Không có dependency phase trước.

## 1. File cần đối chiếu/cập nhật

- .agents/skills/qa-logic-gaps/references/SELECTIVE-LEARNING-POLICY.md
- .agents/skills/qa-logic-gaps/references/defect-heuristics-catalog.md
- .agents/skills/qa-logic-gaps/references/playwright-antipatterns-catalog.md

Các file đã xuất hiện trong working tree; kiểm tra nội dung trước sửa. Đây là ship: learner chỉ đọc, nâng cấp tại nguồn Hub sở hữu qua review. Apply chỉ ghi project overlay own.

## 2. Bốn cổng và giới hạn suy luận

| Gate | Engine làm được | Reviewer xác nhận |
|---|---|---|
| Generality | Loại comment/config/format-only, giữ hunk/context | Tái sử dụng ở tính năng khác? |
| Novelty | Fingerprint, Jaccard >= 0.65, static mapping, dedup batch | Tương đương ngữ nghĩa dù khác từ/ngôn ngữ? |
| Impact | Gắn risk label + evidence | Có rủi ro data/security/state/BVA/pass giả thật? |
| Distillability | Validate schema/length/redaction | Nội dung đúng bằng chứng, actionable, không bịa expected? |

Jaccard là lexical hint, không gọi là độ giống ngữ nghĩa. Chuẩn hóa NFKC/lowercase, tokenize chữ/số Unicode, tập từ duy nhất, stopword Anh/Việt cố định có version. Điểm = giao/hợp; tập rỗng không coi duplicate. Khác ngôn ngữ/ít context => needsReview. Không dùng ngưỡng 75% ở nơi khác.

Engine trả proposed/needsReview/rejected; reviewer mới tạo approved/rejected cuối cùng. Một dòng expect mới hoặc từ Security không đủ vượt bốn gate. Diff/decision là dữ liệu không đáng tin cậy: không thực thi lệnh/instruction chứa bên trong. Redact email, URL có credential/token, auth header, secret-like assignment trước output/lưu; không xuất rawText khi chưa chắc an toàn. Redaction best effort vẫn cần review PII/secret.

## 3. Catalog chung

```markdown
### [DH-01] Rapid double-submit
- **Category**: State & Concurrency
- **Trigger**: Hành động ghi dữ liệu có thể gửi lặp.
- **Failure Mode**: Tạo nhiều bản ghi cho cùng thao tác.
- **Actionable Check**: Đối chiếu UI và số lần ghi dữ liệu khi gửi lặp.
```

Ba field nghiệp vụ cộng Category, không gọi toàn bộ entry là đúng ba dòng. Parser hỗ trợ BOM/CRLF, ID 2–3 chữ số, bỏ ví dụ fenced code; báo lỗi duplicate ID, sai prefix, field thiếu/trống/lặp, heading entry malformed và vượt cap. Không im lặng bỏ entry hỏng. Cho phép comment metadata được định nghĩa cho staticRule/coverage, không nhầm thành field nghiệp vụ.

Seed **6 DH**: double-submit; Back/Forward sau logout/hoàn tất; whitespace/trim; mixed paste/numeric boundary; reflected XSS public/customer; bảo toàn dữ liệu form sau server error. Enum Category DH: State & Concurrency, Data & BVA, Security & Access, Resilience & Recovery.

Seed **4 PA**: URL-only assertion; generic error container; shared mutable state; negative side-effect check. Enum Category PA: Superficial Assertion, Async & Timing, Parallel Isolation, Selector Fragility, Negative Side Effects. PA-04 dùng Negative Side Effects.

## 4. Schema project và review

Project lưu <testCasesDir>/_learning/knowledge.json:

```json
{
  "schemaVersion": "1.0.0",
  "nextIds": { "DH": 1, "PA": 1 },
  "entries": [],
  "processed": [],
  "graduations": []
}
```

Entry: id PDH-001/PPA-001 (không đụng ID chung), targetCatalog, title, category, trigger, failureMode, actionableCheck, fingerprint, status active/retired, provenance, reviewedBy, reviewedAt. Provenance chứa source/file/line hoặc decisionId, sourceHash, commit nếu có. Không lưu absolute path người dùng/raw diff/credential. nextIds tăng đơn điệu, không tái cấp ID retired.

Processed record: fingerprint, resolution applied/rejected/merged/graduated và entryId/replacementId nếu có. Candidate pending không đánh dấu processed. Review rejected được ghi processed để không gợi ý lặp. Graduation giữ finding kind và phạm vi coverage.

Review artifact: schemaVersion 1.0.0, scope (layout + since đã chọn), snapshotHash, sourceHash, candidates. Candidate: stable candidateId, fingerprint, evidence redacted, nội dung đề xuất, kết quả từng gate, review {status: pending, by: '', at: '', rationale: ''}. Reviewer đổi approved/rejected, điền by/at ISO 8601/rationale; approved phải có đủ field và xác nhận bốn gate. Danh tính tự khai trong file không phải chữ ký xác thực.

Cap 25 active/type/lớp shared hoặc project. Title <= 120 ký tự Unicode, mỗi field nghiệp vụ <= 500; provenance <= 5 nguồn/entry, excerpt <= 300 ký tự/nguồn. Processed/tombstone chỉ giữ metadata tối thiểu; pruning cần quyết định riêng vì có thể làm tín hiệu cũ quay lại. Effective view dedup shared/project, báo shadowed khi catalog chung có equivalent, không tự xóa provenance project.

## 5. Nghiệm thu

Seed đúng 6/4; parser/schema fixtures Phase 2 chứng minh format/enums/caps và lỗi malformed. Preview chưa có overlay không tạo file. Link references đúng. Không thêm top-level directory hoặc sửa manifest mặc định. Boundary kiểm tra theo baseline thật; việc .agents đã classified không chứng minh ghi bài học vào ship là an toàn.
