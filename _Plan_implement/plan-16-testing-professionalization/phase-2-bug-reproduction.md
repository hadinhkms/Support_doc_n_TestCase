# Phase 2 — Tái hiện bug & xác minh bản sửa

> **Trạng thái:** `IMPLEMENTED BUT UNVERIFIED` · **Cấp độ:** L3 · **Ngày:** 2026-11-03
> **Người soạn:** Codex, một phiên; BA/TL chưa đồng tác giả hoặc soát chéo độc lập.
> **Triển khai:** Claude Code, một phiên (2026-11-03), trên `0629f67` + thay đổi chưa commit của Phase 1 (xem §I).
> **Research:** RES-16 (R3, chưa đóng formal gate) · **Phụ thuộc:** Phase 1 (cũng đang `IMPLEMENTED BUT UNVERIFIED`)
> Không lên `VERIFIED`/`COMPLETED`: Gate 1/2 của plan chưa ký; chưa review Gate 3, QA Gate 4 hay UAT Gate 4.5
> độc lập; chưa có receipt `trust: CI` (03_ACCEPTANCE_GATES "No Self-Signoff"). Chưa tick §B1/§F.
> 3 file `ship` ở §B2 KHÔNG sửa tại chỗ; nội dung đề xuất cho Hub nằm ở [phase-2-hub-proposals.md](phase-2-hub-proposals.md).

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục tiêu & phạm vi
- Dev hoặc QA khác tái hiện đúng lỗi từ bộ hồ sơ, rồi chứng minh bản sửa ở cùng điều kiện.
- In-Scope: các task dưới đây; evidence và reproduce theo hai phụ lục của cụm plan.
- Out-of-Scope: triển khai code trong lượt lập plan; thay đổi nghiệp vụ ứng dụng đích.

### A2. Yêu cầu & quy tắc
- REQ-16-P2: Dev hoặc QA khác tái hiện đúng lỗi từ bộ hồ sơ, rồi chứng minh bản sửa ở cùng điều kiện.
- BR-16-P2: expected lấy từ contract/AC đã xác nhận; không sửa assertion/baseline để làm xanh.
- Tất cả quy định chung tại [overview](plan-overview.md) và [evidence contract](evidence-contract.md).
- REQ/AC/TC ở đây là ID hoạch định; Phase 0 ánh xạ vào canonical workspace trước tạo spec.

### A3. Flow & nhánh lỗi
- QA chọn scope → xác lập precondition → chạy caller → đối chiếu observable → lưu evidence → review.
- Lỗi app/test/env/collector được phân loại riêng; thiếu artifact hoặc stale revision không được PASS.
- Hủy chạy: lưu partial manifest và nguyên nhân; cleanup có log riêng, không ghi đè lỗi gốc.

### A4. Biên & bất biến
- EDGE-16-P2-1: chạy lại cùng test, nhiều shard/worker hoặc CI bị hủy giữa chừng.
- EDGE-16-P2-2: artifact thiếu/hash sai/hết hạn, credential không hợp lệ hoặc source thay đổi.
- EDGE-16-P2-3: expected chưa rõ phải SPEC_GAP; không tự phát minh kết quả nghiệp vụ.

### A5. Acceptance Criteria
- **AC-16-P2-1**: Given precondition hợp lệ, When thực thi scope phase, Then Ba lần chạy sạch độc lập ghi numerator/denominator, signature và nguyên nhân; chỉ Confirmed Bug khi đạt rule 14.
- **AC-16-P2-2**: Given precondition hợp lệ, When thực thi scope phase, Then Người kiểm chứng khác dựng lại synthetic state, chạy command và thấy cùng observable; không phụ thuộc phiên đăng nhập cũ.
- **AC-16-P2-3**: Given precondition hợp lệ, When thực thi scope phase, Then Before fail đúng assertion mục tiêu và after pass cùng expected; thiếu before phải ghi NOT_FEASIBLE có lý do, không tự kết luận sửa xong.

### A6. UAT
- **UAT-16-P2-1**: Persona QA/Dev tiếp quản; precondition là reference scenario và synthetic data.
- Thao tác: chạy healthy control → kích hoạt lỗi có chủ đích → đọc report → tái chạy từ recipe.
- Mong đợi: control pass, fault bị phát hiện đúng nguyên nhân và người khác truy nguyên được.
- Truy vết: REQ-16-P2, BR-16-P2, AC-16-P2-1 đến AC-16-P2-3.
- Kết quả hiện tại: NOT RUN. Mới có rehearsal trên harness và reference app tổng hợp (§I, TC-2); pilot ứng dụng cần evidence riêng.

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết định & tasks
- TECH-16-P2: ưu tiên reuse + deterministic checks nhằm bảo vệ BR-16-P2; dependency còn là proposal.
- [ ] T2.1: Áp dụng reproduction-protocol.md và nâng cấp qa-test-execution/bug template.
- [ ] T2.2: Phân biệt suspected issue, test defect, environment issue, intermittent observation và Confirmed Bug.
- [ ] T2.3: Tạo repro recipe tối giản, seed/reset/cleanup, correlation timeline và fault injection có điều kiện.
- [ ] T2.4: Lưu failing run trước sửa; rerun sau sửa và regression lân cận; reviewer tái chạy độc lập.

### B2. File inventory & ngân sách
| Path | Thao tác | Trần / mục tiêu |
|---|---|---|
| `.agents/skills/qa-test-execution/SKILL.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Tạo/Sửa sau inventory | Module ≤250 / <190; role ngoài tests theo Rule 15 |
| `docs/bug-reproduction.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `playwright/tests/support/repro-context.ts` | Tạo/Sửa sau inventory | Module ≤250 / <190; role ngoài tests theo Rule 15 |
| `playwright/deep-engine-tests/reproduction-pipeline.spec.ts` | Tạo/Sửa sau inventory | Test ≤800 / <600 |
- Thực tế triển khai (PDR-16-P2-01 và PDR-16-P2-02, chờ duyệt):
  - 3 dòng đầu là `ship` (`.agents`, `.github/ISSUE_TEMPLATE`, `docs`), nên không sửa tại satellite.
    Đề xuất nằm ở [phase-2-hub-proposals.md](phase-2-hub-proposals.md).
  - `repro-context.ts` được tách theo trách nhiệm thành `tests/support/repro-{classify,context,fix,recipe,signature}.ts`
    (163 / 139 / 120 / 129 / 40 dòng; module ≤ 250, đều < 190). `repro-signature.ts` được tách ra khi sửa review P1-2.
  - Thêm `deep-engine-tests/reproduction-reference-app.ts` (126) và `reproduction-pipeline.harness.ts` (145).
    Spec `reproduction-pipeline.spec.ts` dài 297 dòng (< 600).
- Thêm file/helper/data/schema mới phải cập nhật inventory trước code; không né hạn mức bằng nén dòng.
- Ngoài tests: service <160/200; utils <120/150; mọi file mới phải dưới vùng vàng 80%.
- Ship sửa tại Hub có thẩm quyền; seed/own theo sync-manifest, không ghi đè business project.

### B3. Contract & schemas
- Version hóa input/output artifact; REQ/AC/TC → test ID → run ID → manifest/hash.
- Phải tuân [evidence-contract.md](evidence-contract.md) và [reproduction-protocol.md](reproduction-protocol.md).
- Không đổi contract ứng dụng ngoài scope; schema/API mới phải khóa trước Gate 2.
- Đã triển khai (chưa khóa Gate 2):
  - `repro-recipe/1` (validator fail-closed). Argv chỉ sinh từ field đã validate, không shell.
    Env chỉ lưu tên. Từ chối session/storageState, nội dung giống secret, stale revision và spec bị sửa (hash).
  - `repro.json` + `timeline.json` được attach qua evidence collector của Phase 1.
    Chúng chỉ được tin sau khi `verifyEvidenceBundle` đạt.
  - `classifyReproduction` → các trạng thái §1 của protocol. `verifyFix` → `VERIFIED_FIXED` hoặc
    `FIX_IMPLEMENTED_UNVERIFIED`. Đây là trạng thái bug, không phải chữ ký gate.
- Sau review Gate 3 (PDR-16-P2-03..05):
  - **Signature** (`repro-signature.ts`):
    - Giữ dòng thông điệp, `Locator:`, Expected/Received, các dòng diff `-`/`+`, và ghép mọi error của attempt.
    - Chuẩn hoá: thời điểm, ms, đường dẫn, hex từ 32 ký tự, port khi đứng sau host, id `req-`/`state-`.
  - **`classifyReproduction`:**
    - Control phải sạch, cùng run và có state riêng (`CONTROL_*`).
    - Có `runProblems`, nên bundle không verify hoặc attempt thiếu `repro.json` sẽ chặn Confirmed.
    - Bắt `SIGNATURE_UNKNOWN`, `DUPLICATE_ATTEMPT`, `NO_ATTEMPTS`.
    - `classifyRun(run, scenario, …)` là entry point theo run.
  - **`verifyFix`:**
    - Input bắt buộc thêm `expectedSource` và `dualProof`; tùy chọn `controlScenario` và `allowUntrusted`.
    - Before phải ra `CONFIRMED_BUG`.
    - Hash/revision/profile null cho `*_UNKNOWN`; evidence không trusted cho `*_UNTRUSTED_EVIDENCE`, trừ khi
      `allowUntrusted` (khi đó chỉ ghi limitation).
    - Regression không được chứa chính scenario.
  - **`repro-recipe/1`:** grep dùng allowlist ký tự; chặn env `NODE_*`/`PATH`/`PW_`/`PLAYWRIGHT_`/`EVIDENCE_`/`DEBUG`;
    chặn spec trong `node_modules`; `recipeArgs` bắt buộc `readSpec`.
  - **Replay:** env cô lập, chỉ giữ biến hệ thống cộng với các tên mà recipe khai.

### B4. Dependencies
- Không thêm dependency trước khi có hạn chế được chứng minh. (RES-16).

### B5. NFR
- Không secret/PII trong artifact chia sẻ; không arbitrary command execution từ manifest.
- Đo runtime/storage của phase trước bật gate; fail evidence không được che bằng warning.
- Collector/report phải độc lập theo run/test/attempt/shard; không shared mutable state.

### B6. Rủi ro & rollback
- RISK-16-P2: false pass, stale report, thay đổi runner hoặc mất bằng chứng khi cleanup.
- Rollback code/config của phase riêng bằng patch có review; giữ artifact và schema reader tương thích.
- Không rollback requirement/assertion hoặc xóa bằng chứng để che lỗi.

## C. Ma Trận Kiểm Thử

| AC ID | TC ID | Mức | Critical? | File Test Dự Kiến | Ca biên / ghi chú |
|---|---|---|---|---|---|
| AC-16-P2-1 | TC-16-P2-1 | integration | Yes | `playwright/deep-engine-tests/reproduction-pipeline.spec.ts` | Public caller + healthy control |
| AC-16-P2-2 | TC-16-P2-2 | integration | Yes | `playwright/deep-engine-tests/reproduction-pipeline.spec.ts` | Negative / failure injection |
| AC-16-P2-3 | TC-16-P2-3 | integration | Yes | `playwright/deep-engine-tests/reproduction-pipeline.spec.ts` | Boundary / concurrency / stale evidence |
- Test phải có positive control và fault injection từ public caller; kiểm cả downstream outcome.
- Case không áp dụng phải có lý do trong contract; không dùng N/A cho case chưa chạy.
- Spec canonical cần @REQ-xxx, title TC-xxx - AC-yyy và priority theo rule workspace.

## D. Phạm Vi Dev Được Tự Quyết
- Tên biến, cách chia internal module và cấu trúc helper trong budget.
- Không tự đổi expected, SLO, trust, retention, dependency hay scope ngoài §B đã được khóa.

## E. Câu Hỏi Mở & Giả Định
- Q-16-P2: Race chưa dựng được trigger ổn định giữ dạng observation đang điều tra; không hạ thành lỗi timing của test bằng suy đoán.
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
- **Gate 3 (review) — đã chạy bản tập dượt, CHƯA KÝ.**
  - Ngày 2026-11-03, một reviewer agent riêng đọc diff `0629f67..f22a1f9` và chạy lại các spec. Agent này
    không phải principal `gate3` của Master Authority, nên kết quả chỉ là báo cáo.
  - Reviewer tìm được 0 P0, **2 P1, 5 P2**, cùng một số P3. Các finding đều đã sửa trong working tree
    (chưa commit), mỗi finding có probe riêng:
    - **P1-1:** vấn đề phía control (khác run, evidence chưa verify, bị interrupt, chung state với scenario)
      bị bỏ qua, nên vẫn ra CONFIRMED_BUG. Đã sửa: các vấn đề này giờ ra `CONTROL_*` và chặn Confirmed.
    - **P1-2:** signature quá thô, diff `toEqual`, `Locator:` và soft assertion bị gộp làm một.
      Đã sửa trong `repro-signature.ts`: giữ các dòng diff và Locator, ghép mọi error lại.
    - **P2-1:** `verifyFix` chấp nhận evidence untrusted hoặc hash null. Đã sửa: hash null cho `*_UNKNOWN`;
      `*_UNTRUSTED_EVIDENCE` trừ khi caller khai `allowUntrusted`.
    - **P2-2:** before không cần là bug đã xác nhận. Đã sửa: thêm `BEFORE_NOT_CONFIRMED`, và `REGRESSION_INVALID`
      khi regression chứa chính scenario.
    - **P2-3:** env của replay không cô lập. Đã sửa: `execRecipe` chỉ giữ biến hệ thống; có probe rò env từ process cha.
    - **P2-4:** attempt thiếu `repro.json` rơi khỏi mẫu số. Đã sửa: `runProblems`/`classifyRun` chặn Confirmed.
    - **P2-5:** regex port gộp giờ `10:30`, regex hex gộp id ngắn. Đã sửa: port chỉ khi đứng sau host, hex từ 32 ký tự.
    - **P3 đã sửa:** signature null, attempt đếm trùng, 0/0 attempt; grep dùng allowlist, chặn env `NODE_*`/`PATH`,
      chặn spec trong `node_modules`, `recipeArgs` bắt buộc `readSpec`; probe rerun được tách theo từng nhánh;
      kiểm timeline của mọi attempt race.
  - P3 còn mở: Protocol §6 có ba hàng Negative control, Collision và Boundary chưa có trong model. Hiện chúng là
    scenario regression do caller chọn.
  - Bằng chứng sau khi sửa: xem §I mục 8.
- Gate 4 (QA), Gate 4.5 (UAT): **CHƯA CHẠY / CHƯA KÝ**.
- Ký gate qua Master Authority (`D:\_Master_Authority`) **đang bị chặn**, vì ba lý do:
  - Repo này chưa có trong `projects-registry.json`.
  - Plan-16 chưa ký `plan-review`, nên chưa `PLAN_APPROVED` (Mốc 1). Phase này đã được code khi plan còn `DRAFT`,
    nên cần ký bù hoặc PDR.
  - Phiên dev không được dùng khóa `gate3`/`gate4`.
- Giới hạn đã biết (developer tự khai, reviewer cần xét):
  - Actor trong `repro.json` lấy từ `REPRO_ACTOR`, là tự khai, chưa gắn danh tính. `verifyFix` luôn ghi
    `INDEPENDENCE_SELF_DECLARED`.
  - Cause chỉ suy ra từ control và tag `[ENVIRONMENT]`. Nếu control và scenario cùng fail, kết quả
    `TEST_DEFECT` vẫn cần người xác nhận (protocol §1 coi TEST_DEFECT là "đã xác minh").
  - Lỗi ngắt quãng ở đây là xác định được (theo seed). Cơ chế chưa thử với flake ngẫu nhiên thật.
  - Race được dựng bằng barrier nhân tạo (`ARTIFICIAL_TRIGGER`), không suy ra tần suất production.
  - Reference app là app tổng hợp; pilot ứng dụng thật (U-2) chưa có.

## H. Nhật Ký Thay Đổi Kế Hoạch
| PDR ID | Loại | Nội dung | Ảnh hưởng | Trạng thái |
|---|---|---|---|---|
| PDR-16-P2-01 | TECH | §B2: tách `repro-context.ts` thành 4 module; thêm reference app + harness | Inventory | PENDING |
| PDR-16-P2-02 | TECH | 3 file `ship` chuyển thành đề xuất Hub ([phase-2-hub-proposals.md](phase-2-hub-proposals.md)); T2.1 chỉ xong phần seed | Scope/boundary | PENDING |
| PDR-16-P2-03 | TECH | Review P1-1/P1-2: điều kiện control (`CONTROL_*`) và thuật toán signature mới (`repro-signature.ts`, thêm vào §B2). Signature cũ không so được với signature mới | Contract classify/signature, inventory | PENDING |
| PDR-16-P2-04 | TECH | Review P2-1/P2-2: input `verifyFix` đổi (bắt buộc `expectedSource`/`dualProof`; tùy chọn `allowUntrusted`), before phải `CONFIRMED_BUG`, evidence phải trusted | Contract fix verification | PENDING |
| PDR-16-P2-05 | TECH | Review P2-3/P3: recipe dùng allowlist grep, `FORBIDDEN_ENV`, chặn `node_modules`, `recipeArgs` bắt buộc `readSpec`; replay env cô lập | Contract `repro-recipe/1` (thắt chặt; recipe cũ hợp lệ có thể bị từ chối) | PENDING |

## I. Bằng Chứng Thực Nghiệm
- Khi chạy: exact argv/cwd, exit code, counts/runtime, snippet log và full revisions/dirty identity.
- Giữ fail attempt lẫn pass retry; reviewer rerun trên cùng revision trong receipt riêng.

Developer tự kiểm ngày 2026-11-03. Tất cả chạy trên Windows 11, Node v22.3, QA revision
`0629f67acfc03c0202948f6b16392cd3d6a03e21`, worktree **dirty** (trust `INVESTIGATION_ONLY`).
Đây là bằng chứng điều tra, chưa phải bằng chứng gate.

1. Full deep-engine suite:
   - Lệnh: `playwright test -c deep-engine.config.ts --workers=2`, chạy trong `playwright/`.
   - Exit 0, 33/33 passed, 3.0 phút.
   - Receipt `test-results/evidence/local-20261103-063548-36540/unsharded/run-receipt.json`:
     counts matched/executed/expected 33, notRun 0, verdict `COMPLETE`.
2. TC-16-P2-1..3 (`reproduction-pipeline.spec.ts`): 3 passed, khoảng 2.2 phút với `--workers=1`. Mỗi TC spawn Playwright run con
   qua argv do recipe sinh ra:
   - **TC-1:** `ref-app@1` có `--repeat-each=3`. Control 3/3 pass. Order-total `CONFIRMED_BUG` 3/3 với
     signature `order total | Expected: 17 | Received: 7`. Race `CONFIRMED_BUG` 3/3 có nhãn `ARTIFICIAL_TRIGGER`;
     timeline cho thấy hai lần ghi `read 10 → wrote 7`.
     Các nhánh khác: intermittent 1/3, ENVIRONMENT_ISSUE, TEST_DEFECT (shared state, oracle sai),
     SPEC_GAP / INSUFFICIENT_ATTEMPTS / MISSING_DUAL_PROOF / CONTROL_MISSING, và grep rỗng (không có evidence).
   - **TC-2:** recipe được ghi ra đĩa và người kiểm chứng tái hiện ở thư mục mới, với tenant/actor khác:
     cùng signature 3/3, không dùng lại state nào của tác giả. 12 recipe xấu bị từ chối trước khi chạy.
   - **TC-3:** before `ref-app@1` fail 3/3, after `ref-app@2` pass 3/3, regression và rerun độc lập đều pass:
     `VERIFIED_FIXED` cho cả order-total lẫn race. Các trường hợp còn lại cho `FIX_IMPLEMENTED_UNVERIFIED`:
     sửa expected cho xanh trên build lỗi (`AFTER_EXPECTED_CHANGED` + `NO_BUILD_CHANGE`), evidence after bị tamper,
     11 probe âm, và NOT_FEASIBLE.
3. Mutation check (đã khôi phục file):
   - Bỏ nhánh control-fail trong `classifyReproduction` → TC-1 fail. Lần đầu mutation này sống sót,
     nên tôi thêm probe "oracle sai".
   - Bỏ kiểm tra expected hash trong `verifyFix` → TC-3 fail ở probe "sửa expected".
4. `npm run verify` (playwright) exit 0, 53 test được liệt kê.
5. `npm run qa:check` (gốc): boundary, drift, gaps và limits đều OK; 53 file < 80%.
6. `node --test "tools/**/*.test.js"`: 268/268. Lượt đầu có 2 fail `EBUSY rmdir` ở thư mục tạm, vì chạy song song
   với suite. Chạy lại riêng thì pass; `tools/` không bị sửa.
7. Chưa chạy: CI (`trust: CI`), review/QA/UAT độc lập, pilot app, 3 file ship (chờ Hub).
8. Sau khi sửa finding Gate 3 vòng tập dượt. Base `f22a1f90a335e2edad4ff3e66cbe6e1312e5c2aa`, worktree dirty,
   nên trust là `INVESTIGATION_ONLY`.
   - `reproduction-pipeline.spec.ts` + `evidence-pipeline.spec.ts` chạy với `--workers=1`: 6 passed (2.0 phút).
   - Mutation, mỗi lần một file, sau đó khôi phục. Mỗi mutation làm fail đúng một probe:
     | Mutation | Probe bị fail |
     |---|---|
     | Bỏ `CONTROL_OTHER_RUN` | TC-1 probe control |
     | KEEP signature về bản cũ | TC-1 probe `toEqual` diff |
     | Bỏ `BEFORE_NOT_CONFIRMED` | TC-3 probe "before is a test defect" |
     | Tắt cô lập env của replay | TC-1 probe rò `REF_APP_TENANT` |
   - Full suite `playwright test -c deep-engine.config.ts --workers=2`: exit 0, 33/33 (1.7 phút).
     Receipt `local-20261103-065903-25084`: counts 33/33/33, notRun 0, verdict `COMPLETE`.
   - `npm run verify` exit 0. `npm run qa:check` exit 0. `node --test "tools/**/*.test.js"` 268/268.

