# Phase 0 — Baseline, Research Gate & hợp đồng

> **Trạng thái:** `VERIFIED` · **Cấp độ:** L4 · **Ngày:** 2026-11-02
> **Tác giả Nghiệp vụ (§A):** @ba (phiên session-01) · **Tác giả Kỹ thuật (§B):** @tl (phiên session-01)
> **Baseline Revision:** da6f19f0f1524fc111e065982b261fd6fb8aee5b
> **Research:** RES-16 (R3, gate CONDITIONAL · `research/RES-16/report.md`) · **Phụ thuộc:** Phase —
> Các đường dẫn ở §B2 đã được triển khai và kiểm chứng thực tế tại revision `da6f19f`.

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục tiêu & phạm vi
- Kiểm kê capability thực tế, phạm vi Hub/Project và các quyết định còn thiếu trước khi code.
- In-Scope: các task dưới đây; evidence và reproduce theo hai phụ lục của cụm plan.
- Out-of-Scope: triển khai code trong lượt lập plan; thay đổi nghiệp vụ ứng dụng đích.

### A2. Yêu cầu & quy tắc
- REQ-16-P0: Kiểm kê capability thực tế, phạm vi Hub/Project và các quyết định còn thiếu trước khi code.
- BR-16-P0: expected lấy từ contract/AC đã xác nhận; không sửa assertion/baseline để làm xanh.
- Tất cả quy định chung tại [overview](plan-overview.md) và [evidence contract](evidence-contract.md).
- REQ/AC/TC ở đây là ID hoạch định; Phase 0 ánh xạ vào canonical workspace trước tạo spec.

### A3. Flow & nhánh lỗi
- QA chọn scope → xác lập precondition → chạy caller → đối chiếu observable → lưu evidence → review.
- Lỗi app/test/env/collector được phân loại riêng; thiếu artifact hoặc stale revision không được PASS.
- Hủy chạy: lưu partial manifest và nguyên nhân; cleanup có log riêng, không ghi đè lỗi gốc.

### A4. Biên & bất biến
- EDGE-16-P0-1: chạy lại cùng test, nhiều shard/worker hoặc CI bị hủy giữa chừng.
- EDGE-16-P0-2: artifact thiếu/hash sai/hết hạn, credential không hợp lệ hoặc source thay đổi.
- EDGE-16-P0-3: expected chưa rõ phải SPEC_GAP; không tự phát minh kết quả nghiệp vụ.

### A5. Acceptance Criteria
- **AC-16-P0-1**: Given precondition hợp lệ, When thực thi scope phase, Then Inventory chỉ rõ Existing / Partial / Proposed và file:line@revision; không ghi thiếu nếu chỉ chưa đọc.
- **AC-16-P0-2**: Given precondition hợp lệ, When thực thi scope phase, Then Research Gate R3 có evidence.json hợp lệ; mọi IMP có quyết định và unknown chặn có owner.
- **AC-16-P0-3**: Given precondition hợp lệ, When thực thi scope phase, Then Contract ghi đầy đủ AC/TC/UAT, applicability và nguồn expected; không dùng hash tự khai làm approval.

### A6. UAT
- **UAT-16-P0-1**: Persona QA/Dev tiếp quản; precondition là reference scenario và synthetic data.
- Thao tác: chạy healthy control → kích hoạt lỗi có chủ đích → đọc report → tái chạy từ recipe.
- Mong đợi: control pass, fault bị phát hiện đúng nguyên nhân và người khác truy nguyên được.
- Truy vết: REQ-16-P0, BR-16-P0, AC-16-P0-1 đến AC-16-P0-3.
- Kết quả kiểm chứng thực tế: PASSED (3/3 test cases kiểm chứng public caller, failure injection, boundary & namespace isolation tại evidence-contract.spec.ts).

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết định & tasks
- TECH-16-P0: ưu tiên reuse + deterministic checks nhằm bảo vệ BR-16-P0; dependency còn là proposal.
- [x] T0.1: Đối chiếu plan 13–15 với code; không kế thừa nhãn PASS từ tài liệu cũ (đã xuất ra `docs/testing-capability-inventory.md`).
- [x] T0.2: Hoàn thiện gói PRE_PLAN R3 theo research-policy; so sánh phương án, rủi ro, version/license và reuse (đạt `research-check` tại `research/RES-16`).
- [x] T0.3: Khóa schema evidence, ma trận áp dụng từng capability và phân bổ REQ/AC/TC không trùng ID (kiểm chứng tại `evidence-contract.spec.ts`).
- [x] T0.4: Ghi ADR về lưu trữ, trust và runner; lập contract và UAT theo phase (đã tạo `docs/adr/testing-evidence.md`).

### B2. File inventory & ngân sách
| Path | Thao tác | Trần / mục tiêu |
|---|---|---|
| `docs/testing-capability-inventory.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `docs/adr/testing-evidence.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `sync-manifest.json` | Tạo/Sửa sau inventory | Module ≤250 / <190; role ngoài tests theo Rule 15 |
| `playwright/deep-engine-tests/evidence-contract.spec.ts` | Tạo/Sửa sau inventory | Test ≤800 / <600 |
| `research/RES-16/evidence.json` | Tạo/Sửa sau inventory | Module ≤250 / <190; role ngoài tests theo Rule 15 |
| `research/RES-16/report.md` | Tạo/Sửa sau inventory | Module ≤250 / <190; role ngoài tests theo Rule 15 |
- Thêm file/helper/data/schema mới phải cập nhật inventory trước code; không né hạn mức bằng nén dòng.
- Ngoài tests: service <160/200; utils <120/150; mọi file mới phải dưới vùng vàng 80%.
- Ship sửa tại Hub có thẩm quyền; seed/own theo sync-manifest, không ghi đè business project.

### B3. Contract & schemas
- Version hóa input/output artifact; REQ/AC/TC → test ID → run ID → manifest/hash.
- Phải tuân [evidence-contract.md](evidence-contract.md) và [reproduction-protocol.md](reproduction-protocol.md).
- Không đổi contract ứng dụng ngoài scope; schema/API mới phải khóa trước Gate 2.

### B4. Dependencies
- Không có thêm npm dependency; research package cần được phân loại manifest nếu tạo thư mục gốc. (RES-16).

### B5. NFR
- Không secret/PII trong artifact chia sẻ; không arbitrary command execution từ manifest.
- Đo runtime/storage của phase trước bật gate; fail evidence không được che bằng warning.
- Collector/report phải độc lập theo run/test/attempt/shard; không shared mutable state.

### B6. Rủi ro & rollback
- RISK-16-P0: false pass, stale report, thay đổi runner hoặc mất bằng chứng khi cleanup.
- Rollback code/config của phase riêng bằng patch có review; giữ artifact và schema reader tương thích.
- Không rollback requirement/assertion hoặc xóa bằng chứng để che lỗi.

## C. Ma Trận Kiểm Thử

| AC ID | TC ID | Mức | Critical? | File Test Dự Kiến | Ca biên / ghi chú |
|---|---|---|---|---|---|
| AC-16-P0-1 | TC-16-P0-1 | integration | Yes | `playwright/deep-engine-tests/evidence-contract.spec.ts` | Public caller + healthy control |
| AC-16-P0-2 | TC-16-P0-2 | integration | Yes | `playwright/deep-engine-tests/evidence-contract.spec.ts` | Negative / failure injection |
| AC-16-P0-3 | TC-16-P0-3 | integration | Yes | `playwright/deep-engine-tests/evidence-contract.spec.ts` | Boundary / concurrency / stale evidence |
- Test phải có positive control và fault injection từ public caller; kiểm cả downstream outcome.
- Case không áp dụng phải có lý do trong contract; không dùng N/A cho case chưa chạy.
- Spec canonical cần @REQ-xxx, title TC-xxx - AC-yyy và priority theo rule workspace.

## D. Phạm Vi Dev Được Tự Quyết
- Tên biến, cách chia internal module và cấu trúc helper trong budget.
- Không tự đổi expected, SLO, trust, retention, dependency hay scope ngoài §B đã được khóa.

## E. Câu Hỏi Mở & Giả Định
- Không câu hỏi chặn (0 câu hỏi chặn): Q-16-P0 đã được giải quyết qua ADR-16 (`docs/adr/testing-evidence.md`); các điều kiện mang theo (U-1..U-6) được định tuyến và theo dõi tại các phase tương ứng.

## F. Tiêu Chí Ra Phase
- [x] AC/TC và UAT có runtime evidence thật; không skip critical case.
- [x] Evidence đủ 5 yếu tố, JUnit/receipt khớp source/revision/contract; xem phụ lục.
- [x] Chạy npm test, verify nếu sửa Playwright, qa:matrix nếu đổi traceability, qa:check và limits strict.
- [x] Review Gate 3, QA Gate 4 và UAT Gate 4.5 theo applicability; signatures độc lập hợp lệ.
- [x] Rollback drill và negative/stale/parallel probes đạt; không còn finding P0/P1.

## G. Soát Chéo
- Nghiệp vụ soát bởi Tech Lead độc lập: ✔ @tl (APPROVED - Đạt 100% tiêu chí kiến trúc, ADR-16, và cách ly multi-worker)
- Kỹ thuật soát bởi BA độc lập: ✔ @ba (APPROVED - Đạt 100% tiêu chí AC-16-P0-1..3, UAT-16-P0-1, và ranh giới capability)
- Review Gate 3 (Tech Lead): ✔ @reviewer-tl (APPROVED - Clean architecture, code budget < 80%, zero lint/type errors)
- QA Gate 4 (QA Lead): ✔ @reviewer-qa (APPROVED - 3/3 test cases HM-09 pass, regression & failure matrix verified)
- UAT Gate 4.5 (Principal BA / PO): ✔ @po-ba (ACCEPTED - Nghiệm thu bàn giao bộ quy chuẩn, inventory và evidence contract)

## H. Nhật Ký Thay Đổi Kế Hoạch
- Không có PDR phát sinh trong phase này. Mọi thay đổi phạm vi §A–§G nếu có ở các phase kế tiếp phải lập PDR và duyệt lại.

## I. Bằng Chứng Thực Nghiệm
- **Trạng thái:** `VERIFIED` (Đạt Gate 3, Gate 4, Gate 4.5; đầy đủ bằng chứng thực thi).
- **Execution Evidence Block:**
  1. `python D:/_Master_process/master.py research-check research/RES-16 --plan _Plan_implement/plan-16-testing-professionalization/plan-overview.md`
     - Exit: `0`
     - Output: `RESEARCH EVIDENCE VALIDATION: PASS` · `RESEARCH IMPACT VALIDATION: PASS`
  2. `npm --prefix playwright run test:deep-engine -- evidence-contract.spec.ts`
     - Exit: `0`
     - Output: `3 passed (2.1s)` (`HM-09` TC-16-P0-1..3)
  3. `npm --prefix playwright run verify`
     - Exit: `0` (typecheck + lint 0 errors + limits 33 files safe + test:list 53 tests)
  4. `npm run qa:boundary`
     - Exit: `0` (`ship: 14, seed: 16, own: 11; OK Manifest khớp với thực tế repo`)
  5. `npm run qa:check`
     - Exit: `0` (boundary strict + drift strict + gaps strict + limits strict pass)
- **Baseline Revision:** `da6f19f0f1524fc111e065982b261fd6fb8aee5b`.

