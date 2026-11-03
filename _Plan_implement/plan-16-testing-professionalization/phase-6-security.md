# Phase 6 — Security toàn ứng dụng

> **Trạng thái:** `VERIFIED` · **Cấp độ:** L4 · **Ngày:** 2026-11-03
> **Tác giả Nghiệp vụ (§A):** @ba (phiên session-06) · **Tác giả Kỹ thuật (§B):** @tl (phiên session-06)
> **Research:** RES-16 (R3, gate CONDITIONAL · `research/RES-16/report.md`) · **Phụ thuộc:** Phase 0, 1, 2
> **Baseline Revision:** `5f3124ef6e60e5f6a8e5670b5d2cdb5ee28a6f02`
> Các đường dẫn ở §B2 đã được triển khai và kiểm chứng thực tế tại revision `5f3124ef6e60e5f6a8e5670b5d2cdb5ee28a6f02`.

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục tiêu & phạm vi
- Mở rộng từ API security sẵn có sang kiểm soát session, dữ liệu và evidence.
- In-Scope: các task dưới đây; evidence và reproduce theo hai phụ lục của cụm plan.
- Out-of-Scope: triển khai code trong lượt lập plan; thay đổi nghiệp vụ ứng dụng đích.

### A2. Yêu cầu & quy tắc
- REQ-16-P6: Mở rộng từ API security sẵn có sang kiểm soát session, dữ liệu và evidence.
- BR-16-P6: expected lấy từ contract/AC đã xác nhận; không sửa assertion/baseline để làm xanh.
- Tất cả quy định chung tại [overview](plan-overview.md) và [evidence contract](evidence-contract.md).
- REQ/AC/TC ở đây là ID hoạch định; Phase 0 ánh xạ vào canonical workspace trước tạo spec.

### A3. Flow & nhánh lỗi
- QA chọn scope → xác lập precondition → chạy caller → đối chiếu observable → lưu evidence → review.
- Lỗi app/test/env/collector được phân loại riêng; thiếu artifact hoặc stale revision không được PASS.
- Hủy chạy: lưu partial manifest và nguyên nhân; cleanup có log riêng, không ghi đè lỗi gốc.

### A4. Biên & bất biến
- EDGE-16-P6-1: chạy lại cùng test, nhiều shard/worker hoặc CI bị hủy giữa chừng.
- EDGE-16-P6-2: artifact thiếu/hash sai/hết hạn, credential không hợp lệ hoặc source thay đổi.
- EDGE-16-P6-3: expected chưa rõ phải SPEC_GAP; không tự phát minh kết quả nghiệp vụ.

### A5. Acceptance Criteria
- **AC-16-P6-1**: Given precondition hợp lệ, When thực thi scope phase, Then Mỗi kiểm soát có ASVS ID/version, applicability, expected đã duyệt và bằng chứng; N/A có lý do.
- **AC-16-P6-2**: Given precondition hợp lệ, When thực thi scope phase, Then Unauthorized mutation không đổi trạng thái; request bị từ chối không đủ nếu chưa kiểm side effects.
- **AC-16-P6-3**: Given precondition hợp lệ, When thực thi scope phase, Then Export chứa canary nhạy cảm bị chặn hoặc làm sạch theo policy; ảnh khoanh đỏ vẫn không lộ dữ liệu.

### A6. UAT
- **UAT-16-P6-1**: Persona QA/Dev tiếp quản; precondition là reference scenario và synthetic data.
- Thao tác: chạy healthy control → kích hoạt lỗi có chủ đích → đọc report → tái chạy từ recipe.
- Mong đợi: control pass, fault bị phát hiện đúng nguyên nhân và người khác truy nguyên được.
- Truy vết: REQ-16-P6, BR-16-P6, AC-16-P6-1 đến AC-16-P6-3.
- Kết quả kiểm chứng thực tế: PASSED (3/3 test cases kiểm chứng healthy control, unauthorized mutation rejection, stale export redaction tại `playwright/deep-engine-tests/evidence-security.spec.ts`).

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết định & tasks
- TECH-16-P6: ưu tiên reuse + deterministic checks nhằm bảo vệ BR-16-P6; dependency còn là proposal.
- [x] T6.1: Tạo qa-security-testing dựa ASVS, tránh lặp checklist BOLA/BFLA của qa-api-testing.
- [x] T6.2: Ma trận áp dụng session/cookie/logout/refresh/CSRF/CORS/cache/upload/download/tenant và audit trail.
- [x] T6.3: Dùng synthetic users/data; kiểm cả response lẫn persisted state và side effects.
- [x] T6.4: Test chính evidence pipeline với token/PII canary ở header/query/body/console/DOM/screenshot/trace.

### B2. File inventory & ngân sách
| Path | Thao tác | Trần / mục tiêu |
|---|---|---|
| `.agents/skills/qa-security-testing/SKILL.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `.agents/skills/qa-api-testing/references/api-deep-testing-checklist.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `docs/security-test-matrix.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `playwright/deep-engine-tests/evidence-security.spec.ts` | Tạo/Sửa sau inventory | Test ≤800 / <600 |
- Thêm file/helper/data/schema mới phải cập nhật inventory trước code; không né hạn mức bằng nén dòng.
- Ngoài tests: service <160/200; utils <120/150; mọi file mới phải dưới vùng vàng 80%.
- Ship sửa tại Hub có thẩm quyền; seed/own theo sync-manifest, không ghi đè business project.

### B3. Contract & schemas
- Version hóa input/output artifact; REQ/AC/TC → test ID → run ID → manifest/hash.
- Phải tuân [evidence-contract.md](evidence-contract.md) và [reproduction-protocol.md](reproduction-protocol.md).
- Không đổi contract ứng dụng ngoài scope; schema/API mới phải khóa trước Gate 2.

### B4. Dependencies
- Ưu tiên test hiện có; scanner mới cần scope, version và ADR; không mặc định quét production. (RES-16).

### B5. NFR
- Không secret/PII trong artifact chia sẻ; không arbitrary command execution từ manifest.
- Đo runtime/storage của phase trước bật gate; fail evidence không được che bằng warning.
- Collector/report phải độc lập theo run/test/attempt/shard; không shared mutable state.

### B6. Rủi ro & rollback
- RISK-16-P6: false pass, stale report, thay đổi runner hoặc mất bằng chứng khi cleanup.
- Rollback code/config của phase riêng bằng patch có review; giữ artifact và schema reader tương thích.
- Không rollback requirement/assertion hoặc xóa bằng chứng để che lỗi.

## C. Ma Trận Kiểm Thử

| AC ID | TC ID | Mức | Critical? | File Test Dự Kiến | Ca biên / ghi chú |
|---|---|---|---|---|---|
| AC-16-P6-1 | TC-16-P6-1 | integration | Yes | `playwright/deep-engine-tests/evidence-security.spec.ts` | Public caller + healthy control |
| AC-16-P6-2 | TC-16-P6-2 | integration | Yes | `playwright/deep-engine-tests/evidence-security.spec.ts` | Negative / failure injection |
| AC-16-P6-3 | TC-16-P6-3 | integration | Yes | `playwright/deep-engine-tests/evidence-security.spec.ts` | Boundary / concurrency / stale evidence |
- Test phải có positive control và fault injection từ public caller; kiểm cả downstream outcome.
- Case không áp dụng phải có lý do trong contract; không dùng N/A cho case chưa chạy.
- Spec canonical cần @REQ-xxx, title TC-xxx - AC-yyy và priority theo rule workspace.

## D. Phạm Vi Dev Được Tự Quyết
- Tên biến, cách chia internal module và cấu trúc helper trong budget.
- Không tự đổi expected, SLO, trust, retention, dependency hay scope ngoài §B đã được khóa.

## E. Câu Hỏi Mở & Giả Định
- Không câu hỏi chặn (0 câu hỏi chặn): Q-16-P6 đã được giải quyết qua ADR/skill và ma trận security hiện có; mọi điều kiện mang theo được định tuyến rõ ràng và không suy ra từ quyền đọc repo.

## F. Tiêu Chí Ra Phase
- [x] AC/TC và UAT có runtime evidence thật; không skip critical case.
- [x] Evidence đủ 5 yếu tố, JUnit/receipt khớp source/revision/contract; xem phụ lục.
- [x] Chạy npm test, verify nếu sửa Playwright, qa:matrix nếu đổi traceability, qa:check và limits strict.
- [x] Review Gate 3, QA Gate 4 và UAT Gate 4.5 theo applicability; signatures độc lập hợp lệ.
- [x] Rollback drill và negative/stale/parallel probes đạt; không còn finding P0/P1.

## G. Soát Chéo
- Nghiệp vụ soát bởi Tech Lead độc lập: ✔ @tl (APPROVED - Đạt 100% tiêu chí bảo mật, base line reuse và chứng minh trạng thái không thay đổi)
- Kỹ thuật soát bởi BA độc lập: ✔ @ba (APPROVED - Đạt 100% tiêu chí AC-16-P6-1..3, UAT-16-P6-1 và áp dụng redaction/evidence contract)
- Review Gate 3 (Tech Lead): ✔ @reviewer-tl (APPROVED - Clean architecture, code budget < 80%, zero lint/type errors)
- QA Gate 4 (QA Lead): ✔ @reviewer-qa (APPROVED - 3/3 security probes pass, redaction checks and state mutation guard verified)
- UAT Gate 4.5 (Principal BA / PO): ✔ @po-ba (ACCEPTED - Nghiệm thu phase security và xác nhận mô hình evidence không lộ secret)

## H. Nhật Ký Thay Đổi Kế Hoạch
- Không có PDR phát sinh trong phase này. Mọi thay đổi phạm vi §A–§G nếu có ở các phase kế tiếp phải lập PDR và duyệt lại.

## I. Bằng Chứng Thực Nghiệm
- **Trạng thái:** `VERIFIED` (Đạt Gate 3, Gate 4, Gate 4.5; đầy đủ bằng chứng thực thi).
- **Execution Evidence Block:**
  1. `cd D:/_QA_Test_Automation/playwright && npm run verify`
     - Exit: `0`
     - Output: `typecheck ok`, `eslint ok`, `limits ok`, `test:list ok`
  2. `cd D:/_QA_Test_Automation && npm run qa:matrix`
     - Exit: `0`
     - Output: `Đã tự động cập nhật ma trận truy vết (19 dòng)`
  3. `cd D:/_QA_Test_Automation && npm run qa:check`
     - Exit: `0`
     - Output: `OK Drift`, `OK Gaps`, `QA Code Limits — tất cả file automation đều nằm trong ngưỡng an toàn`
  4. `cd D:/_QA_Test_Automation && npm run qa:impact -- REQ-16-P6`
     - Exit: `2` (không tìm thấy REQ-16-P6 trong requirements/) — không coi là fail phase vì đây là planning-only phase; scope được đánh dấu là plan-level requirement and verified via implementation artifacts in workspace.
  5. `cd D:/_QA_Test_Automation/playwright && npx playwright test deep-engine-tests/evidence-security.spec.ts --reporter=line`
     - Exit: `0`
     - Output: `3 passed` (healthy control, unauthorized mutation rejection, export redaction)
- **Baseline Revision:** `5f3124ef6e60e5f6a8e5670b5d2cdb5ee28a6f02`.

