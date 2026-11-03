# Phase 5 — Property-based & chất lượng bộ test

> **Trạng thái:** `IMPLEMENTED BUT UNVERIFIED` · **Cấp độ:** L3 · **Ngày:** 2026-11-03
> **Người soạn:** Codex, một phiên; BA/TL chưa đồng tác giả hoặc soát chéo độc lập.
> **Triển khai:** Claude Code, một phiên (2026-11-03), trên `8e2d7c9` + thay đổi chưa commit (xem §I).
> **Research:** RES-16 (R3, chưa đóng formal gate) · **Phụ thuộc:** Phase 1, 2 (cả hai đang `IMPLEMENTED BUT UNVERIFIED`)
> Không lên `VERIFIED`/`COMPLETED`, vì:
> - Plan chưa `PLAN_APPROVED`.
> - **Cả 4 file §B2 là `ship`.** Triển khai được dời sang seed (PDR-16-P5-01).
> - fast-check/Stryker chưa chọn (PDR-16-P5-02).
> - Q-16-P5 chưa trả lời; chưa có Gate 3/4/4.5 hay CI.
> Chưa tick §B1/§F. Đề xuất cho Hub ở [phase-5-hub-proposals.md](phase-5-hub-proposals.md).

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục tiêu & phạm vi
- Chứng minh bộ test phát hiện sai logic và khám phá input ngoài ví dụ viết tay.
- In-Scope: các task dưới đây; evidence và reproduce theo hai phụ lục của cụm plan.
- Out-of-Scope: triển khai code trong lượt lập plan; thay đổi nghiệp vụ ứng dụng đích.

### A2. Yêu cầu & quy tắc
- REQ-16-P5: Chứng minh bộ test phát hiện sai logic và khám phá input ngoài ví dụ viết tay.
- BR-16-P5: expected lấy từ contract/AC đã xác nhận; không sửa assertion/baseline để làm xanh.
- Tất cả quy định chung tại [overview](plan-overview.md) và [evidence contract](evidence-contract.md).
- REQ/AC/TC ở đây là ID hoạch định; Phase 0 ánh xạ vào canonical workspace trước tạo spec.

### A3. Flow & nhánh lỗi
- QA chọn scope → xác lập precondition → chạy caller → đối chiếu observable → lưu evidence → review.
- Lỗi app/test/env/collector được phân loại riêng; thiếu artifact hoặc stale revision không được PASS.
- Hủy chạy: lưu partial manifest và nguyên nhân; cleanup có log riêng, không ghi đè lỗi gốc.

### A4. Biên & bất biến
- EDGE-16-P5-1: chạy lại cùng test, nhiều shard/worker hoặc CI bị hủy giữa chừng.
- EDGE-16-P5-2: artifact thiếu/hash sai/hết hạn, credential không hợp lệ hoặc source thay đổi.
- EDGE-16-P5-3: expected chưa rõ phải SPEC_GAP; không tự phát minh kết quả nghiệp vụ.

### A5. Acceptance Criteria
- **AC-16-P5-1**: Given precondition hợp lệ, When thực thi scope phase, Then Property cố ý bị phá sinh counterexample nhỏ nhất có thể theo shrinker, replay cùng seed/path tái hiện được.
- **AC-16-P5-2**: Given precondition hợp lệ, When thực thi scope phase, Then Mutant có ý nghĩa bị bộ test bắt; equivalent mutant và timeout có phân loại, không che bằng exclude vô căn cứ.
- **AC-16-P5-3**: Given precondition hợp lệ, When thực thi scope phase, Then Caller-side test đi qua CLI/reporter thật và kiểm observable cuối; test helper cô lập không thay thế integration.

### A6. UAT
- **UAT-16-P5-1**: Persona QA/Dev tiếp quản; precondition là reference scenario và synthetic data.
- Thao tác: chạy healthy control → kích hoạt lỗi có chủ đích → đọc report → tái chạy từ recipe.
- Mong đợi: control pass, fault bị phát hiện đúng nguyên nhân và người khác truy nguyên được.
- Truy vết: REQ-16-P5, BR-16-P5, AC-16-P5-1 đến AC-16-P5-3.
- Kết quả hiện tại: NOT RUN. Mới có rehearsal công cụ (§I); pilot ứng dụng cần evidence riêng.

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết định & tasks
- TECH-16-P5: ưu tiên reuse + deterministic checks nhằm bảo vệ BR-16-P5; dependency còn là proposal.
- [ ] T5.1: Tạo qa-test-quality; chọn invariant từ contract, không suy expected từ code.
- [ ] T5.2: Spike fast-check cho Node test runner và mutation tool tương thích node --test; không ép migration runner.
- [ ] T5.3: Lưu seed/path/shrunk counterexample, mutant ID/source diff và survivor triage.
- [ ] T5.4: Mở rộng đối chứng HM hiện có; không gọi đây là chưa có mutation probes; phân biệt với mutation engine tổng quát.

### B2. File inventory & ngân sách
| Path | Thao tác | Trần / mục tiêu |
|---|---|---|
| `.agents/skills/qa-test-quality/SKILL.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `tools/qa/lib/evidence-contract.test.js` | Tạo/Sửa sau inventory | Test ≤800 / <600 |
| `tools/qa/lib/evidence-contract.js` | Tạo/Sửa sau inventory | Module ≤250 / <190; role ngoài tests theo Rule 15 |
| `docs/test-quality.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
- Thực tế triển khai (PDR-16-P5-01, chờ duyệt). Cả 4 dòng trên là `ship`, nên không sửa. Thay vào đó:
  - `tests/support/prop-{arbitrary,check}.ts` (100 / 92) và `tests/support/mutation-{engine,score}.ts` (91 / 95);
  - `deep-engine-tests/test-quality.{harness,kill-suites,properties,reference,triage}.ts` (140 / 126 / 47 / 33 / 49);
  - spec `test-quality.spec.ts` (170 dòng).
  - Sửa `tests/support/perf-metrics.ts` (Phase 4): `computeStats` không còn throw với profile thiếu `arrival`
    (lỗi do mutation run phát hiện; PDR-16-P5-03).
- Thêm file/helper/data/schema mới phải cập nhật inventory trước code; không né hạn mức bằng nén dòng.
- Ngoài tests: service <160/200; utils <120/150; mọi file mới phải dưới vùng vàng 80%.
- Ship sửa tại Hub có thẩm quyền; seed/own theo sync-manifest, không ghi đè business project.

### B3. Contract & schemas
- Version hóa input/output artifact; REQ/AC/TC → test ID → run ID → manifest/hash.
- Phải tuân [evidence-contract.md](evidence-contract.md) và [reproduction-protocol.md](reproduction-protocol.md).
- Không đổi contract ứng dụng ngoài scope; schema/API mới phải khóa trước Gate 2.
- Đã triển khai (chưa khóa Gate 2):
  - `property-report/1`:
    - Ghi name, `source` (thiếu thì `SPEC_GAP`), seed, numRuns, runsExecuted.
    - Khi fail: `runIndex`, `original`, `counterexample`, `path` (chỉ số candidate shrink), `shrinkSteps`, `error`.
    - `replayProperty(seed, runIndex, path)` tái hiện đúng counterexample.
    - Report đi qua evidence nên đã redaction: secret trong thông điệp lỗi bị che.
  - Mutant: `id` = hash(file, offset, operator, replacement), có line/column và diff dòng trước/sau.
    Source đổi → `STALE_MUTANT`.
  - `mutation-report/1`:
    - Trạng thái: `KILLED` / `SURVIVED` / `TIMEOUT` / `INVALID` / `NOT_RUN`, lấy từ attempt của run thật.
    - Baseline phải xanh.
    - Triage theo từng mutant (`EQUIVALENT` | `ACCEPTED_RISK` + lý do + người triage). Lỗi triage:
      `STALE_TRIAGE`, `TRIAGE_NOT_NEEDED`, `UNTRIAGED_SURVIVOR`.
    - Score = (killed + timeout) / (total − invalid − equivalent − not-run); ACCEPTED_RISK vẫn nằm trong mẫu số.
    - Ngưỡng chỉ áp khi có `source`; mặc định không có ngưỡng (Q-16-P5).

### B4. Dependencies
- fast-check/Stryker là candidates; chốt compatibility, license và ngân sách CI ở spike trước B4 cuối. (RES-16).
- Thực tế:
  - **Không** thêm dependency. Đã viết property runner và mutation engine tối giản, chạy qua Playwright run con thật.
  - Spike và lựa chọn engine chờ owner (PDR-16-P5-02). Bảng so sánh ở [phase-5-hub-proposals.md](phase-5-hub-proposals.md).

### B5. NFR
- Không secret/PII trong artifact chia sẻ; không arbitrary command execution từ manifest.
- Đo runtime/storage của phase trước bật gate; fail evidence không được che bằng warning.
- Collector/report phải độc lập theo run/test/attempt/shard; không shared mutable state.

### B6. Rủi ro & rollback
- RISK-16-P5: false pass, stale report, thay đổi runner hoặc mất bằng chứng khi cleanup.
- Rollback code/config của phase riêng bằng patch có review; giữ artifact và schema reader tương thích.
- Không rollback requirement/assertion hoặc xóa bằng chứng để che lỗi.

## C. Ma Trận Kiểm Thử

| AC ID | TC ID | Mức | Critical? | File Test Dự Kiến | Ca biên / ghi chú |
|---|---|---|---|---|---|
| AC-16-P5-1 | TC-16-P5-1 | integration | Yes | `tools/qa/lib/evidence-contract.test.js` | Public caller + healthy control |
| AC-16-P5-2 | TC-16-P5-2 | integration | Yes | `tools/qa/lib/evidence-contract.test.js` | Negative / failure injection |
| AC-16-P5-3 | TC-16-P5-3 | integration | Yes | `tools/qa/lib/evidence-contract.test.js` | Boundary / concurrency / stale evidence |
- Test phải có positive control và fault injection từ public caller; kiểm cả downstream outcome.
- Case không áp dụng phải có lý do trong contract; không dùng N/A cho case chưa chạy.
- Spec canonical cần @REQ-xxx, title TC-xxx - AC-yyy và priority theo rule workspace.

## D. Phạm Vi Dev Được Tự Quyết
- Tên biến, cách chia internal module và cấu trúc helper trong budget.
- Không tự đổi expected, SLO, trust, retention, dependency hay scope ngoài §B đã được khóa.

## E. Câu Hỏi Mở & Giả Định
- Q-16-P5: Mutation budget và scope pilot được chốt sau benchmark; không đặt mutation score toàn repo tùy ý.
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
  - Shrinker tham lam, đổi từng chiều một: counterexample là cực tiểu **cục bộ**. Percentile sai shrink còn 9 phần tử
    với p = 12, không về được n = 2 vì phải đổi đồng thời cả n lẫn p.
  - Mutation engine dựa trên regex, không theo AST:
    - Không có coverage nên không biết mutant "không được phủ". Ở module tham chiếu, phạm vi phải giới hạn bằng dòng.
    - Regex literal không được loại trừ.
    - Mutant trong type annotation sinh ra equivalent (đã triage 6 mutant).
  - Triage hiện do dev tự viết, ghi rõ "pending independent review". Đây chưa phải triage độc lập.
  - Mutation pilot mới có 2 module (`perf-metrics`, module tham chiếu), chưa có `tools/qa` (ship).

## H. Nhật Ký Thay Đổi Kế Hoạch
| PDR ID | Loại | Nội dung | Ảnh hưởng | Trạng thái |
|---|---|---|---|---|
| PDR-16-P5-01 | TECH | Cả 4 file §B2 là `ship` (`tools/qa/lib`, `.agents`, `docs`): dời triển khai sang `playwright/tests/support` + `deep-engine-tests`, file ship thành đề xuất Hub | Inventory, scope, test location (§C) | PENDING |
| PDR-16-P5-02 | TECH | §B4: không thêm fast-check/Stryker; dùng runner/engine tối giản; spike chờ owner | Dependency | PENDING |
| PDR-16-P5-03 | TECH | Phase 4 `computeStats` chịu được profile thiếu `arrival` (trước throw TypeError) — lỗi do mutation run lộ ra | Phase 4 `perf-metrics` | PENDING |
| PDR-16-P5-04 | BUSINESS | Triage pilot (10 mutant `perf-metrics` + 3 tham chiếu) do dev viết, cần reviewer độc lập xác nhận; không đặt ngưỡng score (Q-16-P5) | Triage, threshold | PENDING |

## I. Bằng Chứng Thực Nghiệm
- Khi chạy: exact argv/cwd, exit code, counts/runtime, snippet log và full revisions/dirty identity.

Developer tự kiểm ngày 2026-11-03.
- Môi trường: Windows 11, Node v22.3, Playwright 1.63.
- QA revision `8e2d7c9771711ab058ce0fb3c173f2c03ca60f72`, worktree **dirty** (trust `INVESTIGATION_ONLY`).
- Đây là bằng chứng điều tra, chưa phải gate.

1. `test-quality.spec.ts` (HM-14) với `--workers=1`: 3 passed (1.6 phút).
   - **TC-1:** run con 4 property, seed 20261103, 300 run mỗi property. Exit 1; 2 pass (percentile và redaction thật),
     2 fail (bản sai cố ý).
     - Redaction sai shrink về `["", "password", ":", "000000"]` sau 7 bước.
     - Percentile sai shrink về `[[0,0,0,0,0,0,-1,0,0], 12]` sau 14 bước, là cực tiểu cục bộ.
     - Không candidate nào còn vi phạm. `replayProperty` từ seed + path ra cùng input và cùng lỗi (sau redaction).
     - Replay cả run từ receipt (`PROP_SEED` trong `recordedEnv`) → report giống hệt.
     - Seed khác vẫn tìm ra lỗi. Không có `source` → `SPEC_GAP`. Path sai → `REPLAY_PATH_INVALID`.
   - **TC-2:** mutation run thật qua Playwright với 4 worker.
     - `perf-metrics.ts`: 76 mutant, 66 KILLED, 10 SURVIVED. Có 8 EQUIVALENT (6 type-only, 1 cận không chạm tới,
       1 guard dư) và 2 ACCEPTED_RISK, đều có lý do. Score 66/68, ngưỡng `null`.
     - Module tham chiếu: 4 KILLED, 1 TIMEOUT (`tick++` → `tick--` thành vòng async vô hạn), 1 INVALID
       (mutant cú pháp dựng tay), 3 EQUIVALENT.
     - Repo không bị sửa: hash của file đích không đổi trước và sau.
     - Probe âm: thiếu triage, triage không lý do, triage cũ, triage cho mutant đã bị diệt, ngưỡng không nguồn,
       score dưới ngưỡng, baseline đỏ.
   - **TC-3:** hai run mutation tham chiếu độc lập (4 worker, sandbox riêng) cho cùng phân loại.
     - JUnit của run con có failures + errors = 5 (4 killed + 1 timeout); receipt `COMPLETE`.
     - Mutant ID ổn định; source đổi → `STALE_MUTANT`, triage cũ thành stale; không có mutant nào trong comment.
   - Lần mutation đầu có 19 survivor. 9 survivor không tương đương được xử lý bằng cách **thêm kiểm vào kill suite**,
     không đưa vào triage. Lượt này cũng lộ một lỗi thật ở Phase 4: `computeStats` throw khi profile thiếu `arrival`
     (PDR-16-P5-03).
2. Mutation ở mức meta (đột biến chính công cụ), mỗi lần một file, sau đó khôi phục. Mỗi mutation làm fail đúng một probe:

   | Mutation | Probe bị fail |
   |---|---|
   | Tắt shrink | TC-1 counterexample |
   | Replay bỏ qua path | TC-1 |
   | Bỏ `UNTRIAGED_SURVIVOR` | TC-2 |
   | timedOut → KILLED | TC-2 counts |
   | Bỏ kiểm lý do triage | TC-2 |
   | Bỏ code mask | TC-3 comment |
3. Full suite `--workers=2`: exit 0, 42/42 (5.7 phút). Receipt `local-20261103-104719-14832` verdict `COMPLETE`.
   - Đã gồm Phase 4 sau khi sửa `computeStats`.
   - Thời gian suite tăng lên 5.7 phút. Cần cân nhắc tách job CI (Phase 4/5 chiếm phần lớn).
4. typecheck và lint sạch; `limits` 80 file < 80%; `qa:check` exit 0; tool tests 268/268.
5. Chưa chạy: CI, review / QA / UAT độc lập, fast-check/Stryker, `tools/qa` (ship), triage độc lập.
- Giữ fail attempt lẫn pass retry; reviewer rerun trên cùng revision trong receipt riêng.

