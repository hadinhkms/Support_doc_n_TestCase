# Phase 4 — Performance & tải

> **Trạng thái:** `DRAFT` · **Cấp độ:** L3 · **Ngày:** 2026-11-02
> **Người soạn:** Codex, một phiên; BA/TL chưa đồng tác giả hoặc soát chéo độc lập.
> **Research:** RES-16 (R3, chưa đóng formal gate) · **Phụ thuộc:** Phase 1, 2
> Các đường dẫn ở §B2 là đề xuất, chưa phải artifact đã triển khai.

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục tiêu & phạm vi
- Đo hành vi dưới workload được duyệt, tái hiện bottleneck bằng cấu hình và dữ liệu xác định.
- In-Scope: các task dưới đây; evidence và reproduce theo hai phụ lục của cụm plan.
- Out-of-Scope: triển khai code trong lượt lập plan; thay đổi nghiệp vụ ứng dụng đích.

### A2. Yêu cầu & quy tắc
- REQ-16-P4: Đo hành vi dưới workload được duyệt, tái hiện bottleneck bằng cấu hình và dữ liệu xác định.
- BR-16-P4: expected lấy từ contract/AC đã xác nhận; không sửa assertion/baseline để làm xanh.
- Tất cả quy định chung tại [overview](plan-overview.md) và [evidence contract](evidence-contract.md).
- REQ/AC/TC ở đây là ID hoạch định; Phase 0 ánh xạ vào canonical workspace trước tạo spec.

### A3. Flow & nhánh lỗi
- QA chọn scope → xác lập precondition → chạy caller → đối chiếu observable → lưu evidence → review.
- Lỗi app/test/env/collector được phân loại riêng; thiếu artifact hoặc stale revision không được PASS.
- Hủy chạy: lưu partial manifest và nguyên nhân; cleanup có log riêng, không ghi đè lỗi gốc.

### A4. Biên & bất biến
- EDGE-16-P4-1: chạy lại cùng test, nhiều shard/worker hoặc CI bị hủy giữa chừng.
- EDGE-16-P4-2: artifact thiếu/hash sai/hết hạn, credential không hợp lệ hoặc source thay đổi.
- EDGE-16-P4-3: expected chưa rõ phải SPEC_GAP; không tự phát minh kết quả nghiệp vụ.

### A5. Acceptance Criteria
- **AC-16-P4-1**: Given precondition hợp lệ, When thực thi scope phase, Then Workload và SLO đã được owner duyệt; không tự đặt ngưỡng rồi tuyên bố hệ thống đạt SLA.
- **AC-16-P4-2**: Given precondition hợp lệ, When thực thi scope phase, Then Injected latency/error vượt threshold khiến runner exit khác 0 và giữ raw metrics; healthy control đạt ngưỡng.
- **AC-16-P4-3**: Given precondition hợp lệ, When thực thi scope phase, Then Re-run cùng dataset seed và profile có hồ sơ so sánh; không coi một sample hoặc môi trường bận là regression đã xác minh.

### A6. UAT
- **UAT-16-P4-1**: Persona QA/Dev tiếp quản; precondition là reference scenario và synthetic data.
- Thao tác: chạy healthy control → kích hoạt lỗi có chủ đích → đọc report → tái chạy từ recipe.
- Mong đợi: control pass, fault bị phát hiện đúng nguyên nhân và người khác truy nguyên được.
- Truy vết: REQ-16-P4, BR-16-P4, AC-16-P4-1 đến AC-16-P4-3.
- Kết quả hiện tại: NOT RUN; harness chỉ kiểm công cụ, pilot ứng dụng cần evidence riêng.

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết định & tasks
- TECH-16-P4: ưu tiên reuse + deterministic checks nhằm bảo vệ BR-16-P4; dependency còn là proposal.
- [ ] T4.1: Tạo qa-performance-testing; phân biệt browser timing, API latency và system load.
- [ ] T4.2: So sánh k6 với stack sẵn có; spike version/license, CI receipt/JUnit và workload trước chọn dependency.
- [ ] T4.3: Thiết kế load/spike/soak, warm-up, arrival rate, dataset, environment capacity và stop conditions.
- [ ] T4.4: Lưu raw metrics, p95/p99, error rate, throughput, dropped work và resource telemetry; so baseline cùng điều kiện.

### B2. File inventory & ngân sách
| Path | Thao tác | Trần / mục tiêu |
|---|---|---|
| `.agents/skills/qa-performance-testing/SKILL.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `docs/performance-testing.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `playwright/deep-engine-tests/performance-adapter.spec.ts` | Tạo/Sửa sau inventory | Test ≤800 / <600 |
- Thêm file/helper/data/schema mới phải cập nhật inventory trước code; không né hạn mức bằng nén dòng.
- Ngoài tests: service <160/200; utils <120/150; mọi file mới phải dưới vùng vàng 80%.
- Ship sửa tại Hub có thẩm quyền; seed/own theo sync-manifest, không ghi đè business project.

### B3. Contract & schemas
- Version hóa input/output artifact; REQ/AC/TC → test ID → run ID → manifest/hash.
- Phải tuân [evidence-contract.md](evidence-contract.md) và [reproduction-protocol.md](reproduction-protocol.md).
- Không đổi contract ứng dụng ngoài scope; schema/API mới phải khóa trước Gate 2.

### B4. Dependencies
- k6 là candidate, chưa chọn phiên bản; adapter test dùng subprocess thật của runner được chốt. (RES-16).

### B5. NFR
- Không secret/PII trong artifact chia sẻ; không arbitrary command execution từ manifest.
- Đo runtime/storage của phase trước bật gate; fail evidence không được che bằng warning.
- Collector/report phải độc lập theo run/test/attempt/shard; không shared mutable state.

### B6. Rủi ro & rollback
- RISK-16-P4: false pass, stale report, thay đổi runner hoặc mất bằng chứng khi cleanup.
- Rollback code/config của phase riêng bằng patch có review; giữ artifact và schema reader tương thích.
- Không rollback requirement/assertion hoặc xóa bằng chứng để che lỗi.

## C. Ma Trận Kiểm Thử

| AC ID | TC ID | Mức | Critical? | File Test Dự Kiến | Ca biên / ghi chú |
|---|---|---|---|---|---|
| AC-16-P4-1 | TC-16-P4-1 | integration | Yes | `playwright/deep-engine-tests/performance-adapter.spec.ts` | Public caller + healthy control |
| AC-16-P4-2 | TC-16-P4-2 | integration | Yes | `playwright/deep-engine-tests/performance-adapter.spec.ts` | Negative / failure injection |
| AC-16-P4-3 | TC-16-P4-3 | integration | Yes | `playwright/deep-engine-tests/performance-adapter.spec.ts` | Boundary / concurrency / stale evidence |
- Test phải có positive control và fault injection từ public caller; kiểm cả downstream outcome.
- Case không áp dụng phải có lý do trong contract; không dùng N/A cho case chưa chạy.
- Spec canonical cần @REQ-xxx, title TC-xxx - AC-yyy và priority theo rule workspace.

## D. Phạm Vi Dev Được Tự Quyết
- Tên biến, cách chia internal module và cấu trúc helper trong budget.
- Không tự đổi expected, SLO, trust, retention, dependency hay scope ngoài §B đã được khóa.

## E. Câu Hỏi Mở & Giả Định
- Q-16-P4: SLO, tải mục tiêu và quyền chạy load test là câu hỏi chặn riêng của phase này.
- Mọi câu hỏi chặn phải giải quyết trước Gate 1/2 của phase; chưa coi là đủ điều kiện code.

## F. Tiêu Chí Ra Phase
- [ ] AC/TC và UAT có runtime evidence thật; không skip critical case.
- [ ] Evidence đủ 5 yếu tố, JUnit/receipt khớp source/revision/contract; xem phụ lục.
- [ ] Chạy npm test, verify nếu sửa Playwright, qa:matrix nếu đổi traceability, qa:check và limits strict.
- [ ] Review Gate 3, QA Gate 4 và UAT Gate 4.5 theo applicability; signatures độc lập hợp lệ.
- [ ] Rollback drill và negative/stale/parallel probes đạt; không còn finding P0/P1.
- Dev chỉ báo IMPLEMENTED BUT UNVERIFIED; không tự tick hoàn thành hoặc tự ký.

## G. Soát Chéo
- Nghiệp vụ soát bởi Tech Lead độc lập: PENDING.
- Kỹ thuật soát bởi BA độc lập: PENDING.
- Plan review/contract lock/closure cần chữ ký Master Authority; không thay bằng actor tự khai.

## H. Nhật Ký Thay Đổi Kế Hoạch
| PDR ID | Loại | Nội dung | Ảnh hưởng | Trạng thái |
|---|---|---|---|---|
| Chưa phát sinh | TECH/BUSINESS | Thay đổi §A–§G cần PDR và duyệt lại | Contract/hash | PENDING |

## I. Bằng Chứng Thực Nghiệm
- NOT RUN: đây là kế hoạch; chưa có implementation evidence.
- Khi chạy: exact argv/cwd, exit code, counts/runtime, snippet log và full revisions/dirty identity.
- Giữ fail attempt lẫn pass retry; reviewer rerun trên cùng revision trong receipt riêng.

