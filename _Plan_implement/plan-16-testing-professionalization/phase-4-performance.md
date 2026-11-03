# Phase 4 — Performance & tải

> **Trạng thái:** `IMPLEMENTED BUT UNVERIFIED` · **Cấp độ:** L3 · **Ngày:** 2026-11-03
> **Người soạn:** Codex, một phiên; BA/TL chưa đồng tác giả hoặc soát chéo độc lập.
> **Triển khai:** Claude Code, một phiên (2026-11-03), trên `e5e35dc` + thay đổi chưa commit (xem §I).
> **Research:** RES-16 (R3, chưa đóng formal gate) · **Phụ thuộc:** Phase 1, 2 (cả hai đang `IMPLEMENTED BUT UNVERIFIED`)
> Không lên `VERIFIED`/`COMPLETED`, vì:
> - Plan chưa `PLAN_APPROVED`.
> - Q-16-P4 (SLO, tải mục tiêu, quyền chạy load) chưa trả lời; runner production (T4.2) chưa chọn.
> - Chưa có Gate 3/4/4.5 hay receipt `trust: CI`.
> Chưa tick §B1/§F. 2 file `ship` ở §B2 không sửa tại chỗ; đề xuất và so sánh runner ở [phase-4-hub-proposals.md](phase-4-hub-proposals.md).

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
- Kết quả hiện tại: NOT RUN. Mới có rehearsal công cụ trên app tham chiếu (§I); pilot ứng dụng cần evidence riêng.

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
- Thực tế triển khai (PDR-16-P4-01..03, chờ duyệt):
  - 2 dòng đầu là `ship`, nên không sửa. Đề xuất ở [phase-4-hub-proposals.md](phase-4-hub-proposals.md).
  - Thêm `tests/support/perf-{profile,metrics,loadgen,compare}.ts` (81 / 119 / 77 / 83 dòng).
  - Thêm `deep-engine-tests/performance-{reference-app,adapter.harness}.ts` (38 / 108). Spec `performance-adapter.spec.ts` dài 148 dòng.
- Thêm file/helper/data/schema mới phải cập nhật inventory trước code; không né hạn mức bằng nén dòng.
- Ngoài tests: service <160/200; utils <120/150; mọi file mới phải dưới vùng vàng 80%.
- Ship sửa tại Hub có thẩm quyền; seed/own theo sync-manifest, không ghi đè business project.

### B3. Contract & schemas
- Version hóa input/output artifact; REQ/AC/TC → test ID → run ID → manifest/hash.
- Phải tuân [evidence-contract.md](evidence-contract.md) và [reproduction-protocol.md](reproduction-protocol.md).
- Không đổi contract ứng dụng ngoài scope; schema/API mới phải khóa trước Gate 2.
- Đã triển khai (chưa khóa Gate 2):
  - `perf-profile/1`:
    - Workload theo mô hình mở (constant arrival rate), có warm-up, maxInFlight, dataset seed và stop conditions.
    - SLO phải có `source`; `approval` của owner phải khác tác giả (so sau chuẩn hoá).
    - `workloadHash` chỉ tính trên phần workload (không gồm SLO/approval) và dùng để quyết định hai run có so được không.
  - `perf-result/1`: tính lại được từ raw `perf-samples.ndjson`.
    - Verdict `SLO_MET` / `SLO_BREACHED` chỉ khi profile đã duyệt; nếu không thì `THRESHOLD_CHECK_ONLY` /
      `THRESHOLD_BREACHED`, kèm `NOT_AN_SLA_CLAIM`.
    - `INVALID_RUN` khi profile lỗi hoặc thiếu sample. Exit: 0 / 1 / 2.
    - Thống kê loại warm-up; percentile theo nearest-rank; dropped được đếm riêng.
  - `compareRuns`: kết quả `NOT_COMPARABLE` / `INSUFFICIENT_SAMPLES` / `INCONCLUSIVE_BUSY_ENV` / `INCONCLUSIVE` /
    `NO_REGRESSION` / `REGRESSION_REPRODUCED`.
    - Chỉ áp cho metric latency; dung sai 20% + 10 ms.
    - Bận nghĩa là độ trễ event loop p99 của generator > 50 ms.
  - Evidence mỗi attempt: profile, raw NDJSON, telemetry (gồm env), result, report text.

### B4. Dependencies
- k6 là candidate, chưa chọn phiên bản; adapter test dùng subprocess thật của runner được chốt. (RES-16).
- Thực tế:
  - **Không** thêm dependency. Harness dùng generator Node core chạy trong Playwright run con thật. Đó là subprocess
    thật, nhưng **không phải runner production đã chốt**.
  - T4.2 chưa quyết, xem bảng so sánh ở [phase-4-hub-proposals.md](phase-4-hub-proposals.md) (PDR-16-P4-02).

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
- Gate 3 / Gate 4 / Gate 4.5: **CHƯA CHẠY / CHƯA KÝ**. Developer chỉ tự kiểm (§I).
- Giới hạn đã biết (developer tự khai):
  - Generator chạy đơn tiến trình và chỉ trên host local. Không có telemetry hệ thống đích (CPU/memory/DB của app),
    nên T4.4 mới có telemetry của phía generator.
  - Chưa có soak/spike thật; `kind` mới chỉ được validate.
  - "Môi trường bận" mới chỉ đo phía generator (độ trễ event loop). Tải của hệ thống đích hay noisy neighbour chưa đo.
  - Dung sai so sánh (20% + 10 ms), ngưỡng bận (50 ms) và số lần lặp tối thiểu (3) là dev đặt.
    Theo §D, đây là quyết định của owner (PDR-16-P4-03).
  - SLO trong harness (p95 ≤ 100 ms, error ≤ 1%, dropped = 0) là SLO tham chiếu tổng hợp, có `source` giả lập.
    Không phải SLO thật của sản phẩm.

## H. Nhật Ký Thay Đổi Kế Hoạch
| PDR ID | Loại | Nội dung | Ảnh hưởng | Trạng thái |
|---|---|---|---|---|
| PDR-16-P4-01 | TECH | §B2: thêm 4 module support + reference app/harness; 2 file `ship` chuyển thành đề xuất Hub (T4.1 chỉ xong phần seed) | Inventory, scope | PENDING |
| PDR-16-P4-02 | TECH | §B4: không thêm k6; harness dùng generator Node core (chỉ local) làm runner kiểm công cụ; T4.2 chờ owner duyệt version/license sau spike | Dependency | PENDING |
| PDR-16-P4-03 | BUSINESS | Ngưỡng do dev đặt (cần owner): dung sai so sánh 20% + 10 ms, bận khi event-loop lag > 50 ms, tối thiểu 3 lần lặp, SLO tham chiếu của harness | Threshold/SLO (§D) | PENDING |

## I. Bằng Chứng Thực Nghiệm
- Khi chạy: exact argv/cwd, exit code, counts/runtime, snippet log và full revisions/dirty identity.

Developer tự kiểm ngày 2026-11-03.
- Môi trường: Windows 11, Node v22.3, Playwright 1.63.
- QA revision `e5e35dc5b30872f9ef9eef796d599acab9bb7eb9`, worktree **dirty** (trust `INVESTIGATION_ONLY`).
- Đây là bằng chứng điều tra, chưa phải gate.

1. `performance-adapter.spec.ts` (HM-13) với `--workers=1`: 3 passed (2.5 phút).
   Mỗi run con chạy 40 rps × 3 s (warm-up 0.5 s) vào app tham chiếu local.
   - **TC-1:**
     - Profile đã duyệt + healthy → exit 0, `SLO_MET`. Report có statement "not a production capacity or SLA claim" ở dòng đầu.
     - Cùng raw samples nhưng không approval / tự duyệt (`' QA-Author '`) / không lý do → `THRESHOLD_CHECK_ONLY`
       kèm `NOT_AN_SLA_CLAIM`, và report không có "SLO_MET".
     - Ngưỡng không có nguồn, không có SLO, closed model, URL tuyệt đối, warm-up dài hơn run → `INVALID_RUN`, exit 2.
     - Generator từ chối host không phải local.
   - **TC-2:** control exit 0.
     - `latency` → p95 vượt; `errors` → error_rate 0.25; `slow` → dropped > 0. Cả ba exit 1, `SLO_BREACHED`.
     - Raw NDJSON đủ 120 sample, tính lại khớp `perf-result.json`.
     - `minSamples` 5000 → `INVALID_RUN`.
     - Raw bị sửa → `SIZE_MISMATCH` / `HASH_MISMATCH`.
   - **TC-3:** mỗi nhóm 3 lần (`--repeat-each=3`).
     - healthy↔healthy → `NO_REGRESSION`; healthy↔latency → `REGRESSION_REPRODUCED` (mọi candidate > mọi baseline).
     - Healthy chạy trên máy tạo tải bận (lag > 50 ms) → `INCONCLUSIVE_BUSY_ENV`.
     - Một sample → `INSUFFICIENT_SAMPLES`.
     - Khác seed / workload / env, hoặc một attempt bị đếm hai lần → `NOT_COMPARABLE`. Throughput → `UNSUPPORTED_METRIC`.
     - Replay từ receipt (argv + `recordedEnv`) → cùng exit, cùng verdict.
2. Mutation, mỗi lần một file, sau đó khôi phục. Mỗi mutation làm fail đúng một probe:

   | Mutation | Probe bị fail |
   |---|---|
   | Coi mọi profile là đã duyệt | TC-1 |
   | Không đếm dropped | TC-2 `slow` |
   | Bỏ kiểm số lần lặp | TC-3 "một sample" |
   | Bỏ kiểm môi trường bận | TC-3 busy |

   Không chạy mutation "bỏ chặn host không phải local", vì bản đó sẽ gửi request thật ra host ngoài.
3. Full suite `playwright test -c deep-engine.config.ts --workers=2`: exit 0, 39/39 (4.6 phút).
   Receipt `local-20261103-091334-20040`: counts 39/39/39, verdict `COMPLETE`.
   - Phase 4 làm suite chậm thêm khoảng 2 phút. Cần cân nhắc tách job CI hoặc giảm thời lượng workload.
4. typecheck và lint sạch; `limits` 70 file < 80%; `qa:check` exit 0; tool tests 268/268.
5. Chưa chạy: CI, review / QA / UAT độc lập, runner production (k6), telemetry hệ thống đích, soak/spike thật,
   môi trường thật (Q-16-P4).
- Giữ fail attempt lẫn pass retry; reviewer rerun trên cùng revision trong receipt riêng.

