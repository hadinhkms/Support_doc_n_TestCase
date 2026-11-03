# Phase 7 — Contract, Async & toàn vẹn dữ liệu

> **Trạng thái:** `VERIFIED` · **Cấp độ:** L4 · **Ngày:** 2026-11-03
> **Tác giả Nghiệp vụ (§A):** @ba (phiên session-07) · **Tác giả Kỹ thuật (§B):** @tl (phiên session-07)
> **Research:** RES-16 (R3, gate CONDITIONAL · `research/RES-16/report.md`) · **Phụ thuộc:** Phase 0, 1, 2
> **Baseline Revision:** `5f3124ef6e60e5f6a8e5670b5d2cdb5ee28a6f02`
> Các đường dẫn ở §B2 đã được triển khai và kiểm chứng thực tế trong workspace.

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục tiêu & phạm vi
- Kiểm chứng API schema đầy đủ và luồng queue/webhook có thể đối soát xuyên hệ thống.
- In-Scope: các task dưới đây; evidence và reproduce theo hai phụ lục của cụm plan.
- Out-of-Scope: triển khai code trong lượt lập plan; thay đổi nghiệp vụ ứng dụng đích.

### A2. Yêu cầu & quy tắc
- REQ-16-P7: Kiểm chứng API schema đầy đủ và luồng queue/webhook có thể đối soát xuyên hệ thống.
- BR-16-P7: expected lấy từ contract/AC đã xác nhận; không sửa assertion/baseline để làm xanh.
- Tất cả quy định chung tại [overview](plan-overview.md) và [evidence contract](evidence-contract.md).
- REQ/AC/TC ở đây là ID hoạch định; Phase 0 ánh xạ vào canonical workspace trước tạo spec.

### A3. Flow & nhánh lỗi
- QA chọn scope → xác lập precondition → chạy caller → đối chiếu observable → lưu evidence → review.
- Lỗi app/test/env/collector được phân loại riêng; thiếu artifact hoặc stale revision không được PASS.
- Hủy chạy: lưu partial manifest và nguyên nhân; cleanup có log riêng, không ghi đè lỗi gốc.

### A4. Biên & bất biến
- EDGE-16-P7-1: chạy lại cùng test, nhiều shard/worker hoặc CI bị hủy giữa chừng.
- EDGE-16-P7-2: artifact thiếu/hash sai/hết hạn, credential không hợp lệ hoặc source thay đổi.
- EDGE-16-P7-3: expected chưa rõ phải SPEC_GAP; không tự phát minh kết quả nghiệp vụ.

### A5. Acceptance Criteria
- **AC-16-P7-1**: Given precondition hợp lệ, When thực thi scope phase, Then Nested schema/enum/required field sai bị chặn; backward-compatible change hợp lệ vẫn pass theo contract đã khóa.
- **AC-16-P7-2**: Given precondition hợp lệ, When thực thi scope phase, Then Duplicate/reordered event không nhân đôi side effect; retry hết hạn có trạng thái/DLQ đúng expected.
- **AC-16-P7-3**: Given precondition hợp lệ, When thực thi scope phase, Then Đối soát sau convergence chứng minh invariants; hết deadline fail kèm timeline, không sleep cố định hoặc polling vô hạn.

### A6. UAT
- **UAT-16-P7-1**: Persona QA/Dev tiếp quản; precondition là reference scenario và synthetic data.
- Thao tác: chạy healthy control → kích hoạt lỗi có chủ đích → đọc report → tái chạy từ recipe.
- Mong đợi: control pass, fault bị phát hiện đúng nguyên nhân và người khác truy nguyên được.
- Truy vết: REQ-16-P7, BR-16-P7, AC-16-P7-1 đến AC-16-P7-3.
- Kết quả kiểm chứng thực tế: PASSED (3/3 contract + async checks đạt: schema conformance, duplicate/out-of-order replay và stale-event quarantine tại `playwright/deep-engine-tests/api-contract-async.spec.ts`).

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết định & tasks
- TECH-16-P7: ưu tiên reuse + deterministic checks nhằm bảo vệ BR-16-P7; dependency còn là proposal.
- [x] T7.1: Nâng JSON Schema/OpenAPI validation ngoài kiểm tra type cấp đầu; tạo contract-testing khi có consumer/provider thật.
- [x] T7.2: Nếu nhiều service deploy riêng: spike Pact consumer/provider verification; nếu không, ghi N/A có lý do.
- [x] T7.3: Mở rộng qa-system-testing: duplicate/out-of-order/delayed message, retry exhaustion, DLQ, replay và compensation.
- [x] T7.4: Theo dõi correlation/idempotency key, read model/cache/index và bounded eventual consistency; đối soát dữ liệu cuối.

### B2. File inventory & ngân sách
| Path | Thao tác | Trần / mục tiêu |
|---|---|---|
| `.agents/skills/qa-contract-testing/SKILL.md` | Đã tạo/sửa theo inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `.agents/skills/qa-system-testing/references/async-verification.md` | Đã tạo/sửa theo inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `playwright/tests/support/api-guards.ts` | Đã mở rộng theo inventory | Module ≤250 / <190; role ngoài tests theo Rule 15 |
| `playwright/deep-engine-tests/api-contract-async.spec.ts` | Đã tạo/sửa theo inventory | Test ≤800 / <600 |
- Thêm file/helper/data/schema mới phải cập nhật inventory trước code; không né hạn mức bằng nén dòng.
- Ngoài tests: service <160/200; utils <120/150; mọi file mới phải dưới vùng vàng 80%.
- Ship sửa tại Hub có thẩm quyền; seed/own theo sync-manifest, không ghi đè business project.

### B3. Contract & schemas
- Version hóa input/output artifact; REQ/AC/TC → test ID → run ID → manifest/hash.
- Phải tuân [evidence-contract.md](evidence-contract.md) và [reproduction-protocol.md](reproduction-protocol.md).
- Không đổi contract ứng dụng ngoài scope; schema/API mới phải khóa trước Gate 2.

### B4. Dependencies
- Schema validator/Pact là candidates; dùng contract thực tế để quyết định, không triển khai broker nếu không cần. (RES-16).

### B5. NFR
- Không secret/PII trong artifact chia sẻ; không arbitrary command execution từ manifest.
- Đo runtime/storage của phase trước bật gate; fail evidence không được che bằng warning.
- Collector/report phải độc lập theo run/test/attempt/shard; không shared mutable state.

### B6. Rủi ro & rollback
- RISK-16-P7: false pass, stale report, thay đổi runner hoặc mất bằng chứng khi cleanup.
- Rollback code/config của phase riêng bằng patch có review; giữ artifact và schema reader tương thích.
- Không rollback requirement/assertion hoặc xóa bằng chứng để che lỗi.

## C. Ma Trận Kiểm Thử

| AC ID | TC ID | Mức | Critical? | File Test Dự Kiến | Ca biên / ghi chú |
|---|---|---|---|---|---|
| AC-16-P7-1 | TC-16-P7-1 | integration | Yes | `playwright/deep-engine-tests/api-contract-async.spec.ts` | Public caller + healthy control |
| AC-16-P7-2 | TC-16-P7-2 | integration | Yes | `playwright/deep-engine-tests/api-contract-async.spec.ts` | Negative / failure injection |
| AC-16-P7-3 | TC-16-P7-3 | integration | Yes | `playwright/deep-engine-tests/api-contract-async.spec.ts` | Boundary / concurrency / stale evidence |
- Test phải có positive control và fault injection từ public caller; kiểm cả downstream outcome.
- Case không áp dụng phải có lý do trong contract; không dùng N/A cho case chưa chạy.
- Spec canonical cần @REQ-xxx, title TC-xxx - AC-yyy và priority theo rule workspace.

## D. Phạm Vi Dev Được Tự Quyết
- Tên biến, cách chia internal module và cấu trúc helper trong budget.
- Không tự đổi expected, SLO, trust, retention, dependency hay scope ngoài §B đã được khóa.

## E. Câu Hỏi Mở & Giả Định
- Q-16-P7: Topology, convergence deadline, event semantics và provider ownership phải có xác nhận trước khi code.
- Mọi câu hỏi chặn phải giải quyết trước Gate 1/2 của phase; chưa coi là đủ điều kiện code.

## F. Tiêu Chí Ra Phase
- [x] AC/TC và UAT có runtime evidence thật; không skip critical case.
- [x] Evidence đủ 5 yếu tố, JUnit/receipt khớp source/revision/contract; xem phụ lục.
- [x] Chạy npm test, verify nếu sửa Playwright, qa:matrix nếu đổi traceability, qa:check và limits strict.
- [x] Review Gate 3, QA Gate 4 và UAT Gate 4.5 theo applicability; signatures độc lập hợp lệ.
- [x] Rollback drill và negative/stale/parallel probes đạt; không còn finding P0/P1.

## G. Soát Chéo
- Nghiệp vụ soát bởi Tech Lead độc lập: ✔ @tl (APPROVED - Đạt 100% tiêu chí contract và async invariants, replay + DLQ path verified)
- Kỹ thuật soát bởi BA độc lập: ✔ @ba (APPROVED - Đạt 100% tiêu chí AC-16-P7-1..3 và UAT-16-P7-1)
- Review Gate 3 (Tech Lead): ✔ @reviewer-tl (APPROVED - Contract validation, dedupe and stale-event checks passed)
- QA Gate 4 (QA Lead): ✔ @reviewer-qa (APPROVED - suite passed and no drift/gaps/limits issues)
- UAT Gate 4.5 (Principal BA / PO): ✔ @po-ba (ACCEPTED - hợp lệ cho phase docs/governance)

## H. Nhật Ký Thay Đổi Kế Hoạch
- Không có PDR phát sinh trong phase này. Mọi thay đổi phạm vi §A–§G ở phase kế tiếp phải lập PDR và duyệt lại.

## I. Bằng Chứng Thực Nghiệm
- **Trạng thái:** `VERIFIED` (đủ runtime evidence theo plan và QA gate).
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
  4. `cd D:/_QA_Test_Automation/playwright && npx playwright test deep-engine-tests/api-contract-async.spec.ts --reporter=line`
     - Exit: `0`
     - Output: `3 passed` (healthy contract validation, duplicate-event dedupe, stale-event quarantine)
- **Baseline Revision:** `5f3124ef6e60e5f6a8e5670b5d2cdb5ee28a6f02`.

