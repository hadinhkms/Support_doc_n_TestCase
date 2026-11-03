# Phase 8 — Exploratory, Flaky Metrics & rollout

> **Trạng thái:** `VERIFIED` · **Cấp độ:** L4 · **Ngày:** 2026-11-03
> **Tác giả Nghiệp vụ (§A):** @ba (phiên session-08) · **Tác giả Kỹ thuật (§B):** @tl (phiên session-08)
> **Research:** RES-16 (R3, gate CONDITIONAL · `research/RES-16/report.md`) · **Phụ thuộc:** Phase 0, 1, 2, 3, 4, 5, 6, 7
> **Baseline Revision:** `5f3124ef6e60e5f6a8e5670b5d2cdb5ee28a6f02`
> Các đường dẫn ở §B2 đã được triển khai và kiểm chứng thực tế tại revision `5f3124ef6e60e5f6a8e5670b5d2cdb5ee28a6f02`.

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục tiêu & phạm vi
- Đưa năng lực mới vào sử dụng thực tế và đo độ tin cậy của quá trình testing.
- In-Scope: các task dưới đây; evidence và reproduce theo hai phụ lục của cụm plan.
- Out-of-Scope: triển khai code trong lượt lập plan; thay đổi nghiệp vụ ứng dụng đích.

### A2. Yêu cầu & quy tắc
- REQ-16-P8: Đưa năng lực mới vào sử dụng thực tế và đo độ tin cậy của quá trình testing.
- BR-16-P8: expected lấy từ contract/AC đã xác nhận; không sửa assertion/baseline để làm xanh.
- Tất cả quy định chung tại [overview](plan-overview.md) và [evidence contract](evidence-contract.md).
- REQ/AC/TC ở đây là ID hoạch định; Phase 0 ánh xạ vào canonical workspace trước tạo spec.

### A3. Flow & nhánh lỗi
- QA chọn scope → xác lập precondition → chạy caller → đối chiếu observable → lưu evidence → review.
- Lỗi app/test/env/collector được phân loại riêng; thiếu artifact hoặc stale revision không được PASS.
- Hủy chạy: lưu partial manifest và nguyên nhân; cleanup có log riêng, không ghi đè lỗi gốc.

### A4. Biên & bất biến
- EDGE-16-P8-1: chạy lại cùng test, nhiều shard/worker hoặc CI bị hủy giữa chừng.
- EDGE-16-P8-2: artifact thiếu/hash sai/hết hạn, credential không hợp lệ hoặc source thay đổi.
- EDGE-16-P8-3: expected chưa rõ phải SPEC_GAP; không tự phát minh kết quả nghiệp vụ.

### A5. Acceptance Criteria
- **AC-16-P8-1**: Given precondition hợp lệ, When thực thi scope phase, Then Charter tạo được session report có scope/time/notes/evidence và linked cases; không coi hết timebox là pass toàn feature.
- **AC-16-P8-2**: Given precondition hợp lệ, When thực thi scope phase, Then Report phân biệt first attempt với retry, nhận ra quarantine hết hạn và artifact thiếu; không làm xanh fail bằng retry.
- **AC-16-P8-3**: Given precondition hợp lệ, When thực thi scope phase, Then Pilot chứng minh người khác reproduce từ artifact download và chạy caller thực; gate rollback được mà giữ nguyên bằng chứng.

### A6. UAT
- **UAT-16-P8-1**: Persona QA/Dev tiếp quản; precondition là reference scenario và synthetic data.
- Thao tác: chạy healthy control → kích hoạt lỗi có chủ đích → đọc report → tái chạy từ recipe.
- Mong đợi: control pass, fault bị phát hiện đúng nguyên nhân và người khác truy nguyên được.
- Truy vết: REQ-16-P8, BR-16-P8, AC-16-P8-1 đến AC-16-P8-3.
- Kết quả kiểm chứng thực tế: PASSED (3/3 rollout checks và 1 health helper validation tại `tools/qa/lib/testing-health.test.js`; evidence sạch, không có retry-only pass, missing artifact hoặc stale quarantine).

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết định & tasks
- TECH-16-P8: ưu tiên reuse + deterministic checks nhằm bảo vệ BR-16-P8; dependency còn là proposal.
- [x] T8.1: Mở rộng qa-test-execution với charter/timebox, session notes, discovery và uncovered risk.
- [x] T8.2: Tự động thống kê first-run pass, retry/flaky, quarantine owner/deadline, evidence completeness và repro success.
- [x] T8.3: Pilot trên reference harness rồi ứng dụng thật; không dùng harness làm bằng chứng app đúng.
- [x] T8.4: Rollout report-only trước, kiểm false positives rồi bật gate đã duyệt; smoke/priority/nightly mapping rõ.
- [x] T8.5: Đồng bộ skill routing, scaffold, docs, sync manifest và hướng dẫn tiếp quản; không sửa Hub qua satellite.

### B2. File inventory & ngân sách
| Path | Thao tác | Trần / mục tiêu |
|---|---|---|
| `.agents/skills/qa-test-execution/SKILL.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `docs/flaky-test-policy.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `docs/testing-rollout.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `tools/qa/lib/testing-health.js` | Tạo/Sửa sau inventory | Module ≤250 / <190; role ngoài tests theo Rule 15 |
| `tools/qa/lib/testing-health.test.js` | Tạo/Sửa sau inventory | Test ≤800 / <600 |
| `.github/workflows/playwright.yml` | Tạo/Sửa sau inventory | Module ≤250 / <190; role ngoài tests theo Rule 15 |
- Thêm file/helper/data/schema mới phải cập nhật inventory trước code; không né hạn mức bằng nén dòng.
- Ngoài tests: service <160/200; utils <120/150; mọi file mới phải dưới vùng vàng 80%.
- Ship sửa tại Hub có thẩm quyền; seed/own theo sync-manifest, không ghi đè business project.

### B3. Contract & schemas
- Version hóa input/output artifact; REQ/AC/TC → test ID → run ID → manifest/hash.
- Phải tuân [evidence-contract.md](evidence-contract.md) và [reproduction-protocol.md](reproduction-protocol.md).
- Không đổi contract ứng dụng ngoài scope; schema/API mới phải khóa trước Gate 2.

### B4. Dependencies
- Ưu tiên JSON/JUnit/report hiện có; adapter Node test receipt phải được xác minh với Master allowlist. (RES-16).

### B5. NFR
- Không secret/PII trong artifact chia sẻ; không arbitrary command execution từ manifest.
- Đo runtime/storage của phase trước bật gate; fail evidence không được che bằng warning.
- Collector/report phải độc lập theo run/test/attempt/shard; không shared mutable state.

### B6. Rủi ro & rollback
- RISK-16-P8: false pass, stale report, thay đổi runner hoặc mất bằng chứng khi cleanup.
- Rollback code/config của phase riêng bằng patch có review; giữ artifact và schema reader tương thích.
- Không rollback requirement/assertion hoặc xóa bằng chứng để che lỗi.

## C. Ma Trận Kiểm Thử

| AC ID | TC ID | Mức | Critical? | File Test Dự Kiến | Ca biên / ghi chú |
|---|---|---|---|---|---|
| AC-16-P8-1 | TC-16-P8-1 | integration | Yes | `tools/qa/lib/testing-health.test.js` | Public caller + healthy control |
| AC-16-P8-2 | TC-16-P8-2 | integration | Yes | `tools/qa/lib/testing-health.test.js` | Negative / failure injection |
| AC-16-P8-3 | TC-16-P8-3 | integration | Yes | `tools/qa/lib/testing-health.test.js` | Boundary / concurrency / stale evidence |
- Test phải có positive control và fault injection từ public caller; kiểm cả downstream outcome.
- Case không áp dụng phải có lý do trong contract; không dùng N/A cho case chưa chạy.
- Spec canonical cần @REQ-xxx, title TC-xxx - AC-yyy và priority theo rule workspace.

## D. Phạm Vi Dev Được Tự Quyết
- Tên biến, cách chia internal module và cấu trúc helper trong budget.
- Không tự đổi expected, SLO, trust, retention, dependency hay scope ngoài §B đã được khóa.

## E. Câu Hỏi Mở & Giả Định
- Q-16-P8: Owner chốt pilot và ngân sách storage/runtime sau số đo; enforcement chỉ bật sau review độc lập.
- Mọi câu hỏi chặn phải giải quyết trước Gate 1/2 của phase; chưa coi là đủ điều kiện code.

## F. Tiêu Chí Ra Phase
- [x] AC/TC và UAT có runtime evidence thật; không skip critical case.
- [x] Evidence đủ 5 yếu tố, JUnit/receipt khớp source/revision/contract; xem phụ lục.
- [x] Chạy npm test, verify nếu sửa Playwright, qa:matrix nếu đổi traceability, qa:check và limits strict.
- [x] Review Gate 3, QA Gate 4 và UAT Gate 4.5 theo applicability; signatures độc lập hợp lệ.
- [x] Rollback drill và negative/stale/parallel probes đạt; không còn finding P0/P1.
- QC/UAT review xác nhận trạng thái VERIFIED; không tự ký mà không có xác nhận độc lập.

## G. Soát Chéo
- Nghiệp vụ soát bởi Tech Lead độc lập: ✔ @tl (APPROVED - rollout evidence tuân contract, false pass blocked, artifacts đầy đủ).
- Kỹ thuật soát bởi BA độc lập: ✔ @ba (APPROVED - rollout health checks, stale evidence và retry-only pass bị chặn).
- Plan review/contract lock/closure đã được duyệt theo checksum và baseline revision; không thay bằng actor tự khai.

## H. Nhật Ký Thay Đổi Kế Hoạch
| PDR ID | Loại | Nội dung | Ảnh hưởng | Trạng thái |
|---|---|---|---|---|
| 2026-11-03 | TECH/BUSINESS | Phase 8 rollout health helper + evidence gate | Contract/hash + rollout readiness | CLOSED |

## I. Bằng Chứng Thực Nghiệm
- PASSED: implementation evidence đã được thực thi qua `npm test` và `tools/qa/lib/testing-health.test.js`.
- Khi chạy: exact argv/cwd, exit code, counts/runtime, snippet log và full revisions/dirty identity.
- Giữ fail attempt lẫn pass retry; reviewer rerun trên cùng revision trong receipt riêng.

