# Phase 3 — Visual Regression & Accessibility

> **Trạng thái:** `IMPLEMENTED BUT UNVERIFIED` · **Cấp độ:** L3 · **Ngày:** 2026-11-03
> **Người soạn:** Codex, một phiên; BA/TL chưa đồng tác giả hoặc soát chéo độc lập.
> **Triển khai:** Claude Code, một phiên (2026-11-03), trên `56dad3c` + thay đổi chưa commit (xem §I).
> **Research:** RES-16 (R3, chưa đóng formal gate) · **Phụ thuộc:** Phase 1, 2 (cả hai đang `IMPLEMENTED BUT UNVERIFIED`)
> Không lên `VERIFIED`/`COMPLETED`, vì:
> - Plan chưa `PLAN_APPROVED` (Mốc 1).
> - Gate 3/4/4.5 chưa có chữ ký Master Authority; repo chưa đăng ký, xem Phase 2 §G.
> - Chưa có receipt `trust: CI`; chưa có pilot app.
> Chưa tick §B1/§F. 2 file `ship` ở §B2 không sửa tại chỗ; đề xuất ở [phase-3-hub-proposals.md](phase-3-hub-proposals.md).

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục tiêu & phạm vi
- Bắt regression giao diện có baseline được duyệt, đồng thời kiểm tra khả năng thao tác.
- In-Scope: các task dưới đây; evidence và reproduce theo hai phụ lục của cụm plan.
- Out-of-Scope: triển khai code trong lượt lập plan; thay đổi nghiệp vụ ứng dụng đích.

### A2. Yêu cầu & quy tắc
- REQ-16-P3: Bắt regression giao diện có baseline được duyệt, đồng thời kiểm tra khả năng thao tác.
- BR-16-P3: expected lấy từ contract/AC đã xác nhận; không sửa assertion/baseline để làm xanh.
- Tất cả quy định chung tại [overview](plan-overview.md) và [evidence contract](evidence-contract.md).
- REQ/AC/TC ở đây là ID hoạch định; Phase 0 ánh xạ vào canonical workspace trước tạo spec.

### A3. Flow & nhánh lỗi
- QA chọn scope → xác lập precondition → chạy caller → đối chiếu observable → lưu evidence → review.
- Lỗi app/test/env/collector được phân loại riêng; thiếu artifact hoặc stale revision không được PASS.
- Hủy chạy: lưu partial manifest và nguyên nhân; cleanup có log riêng, không ghi đè lỗi gốc.

### A4. Biên & bất biến
- EDGE-16-P3-1: chạy lại cùng test, nhiều shard/worker hoặc CI bị hủy giữa chừng.
- EDGE-16-P3-2: artifact thiếu/hash sai/hết hạn, credential không hợp lệ hoặc source thay đổi.
- EDGE-16-P3-3: expected chưa rõ phải SPEC_GAP; không tự phát minh kết quả nghiệp vụ.

### A5. Acceptance Criteria
- **AC-16-P3-1**: Given precondition hợp lệ, When thực thi scope phase, Then Thay đổi UI cố ý sai tạo actual/expected/diff và fail; thay đổi dữ liệu đã mask không gây nhiễu.
- **AC-16-P3-2**: Given precondition hợp lệ, When thực thi scope phase, Then Baseline thiếu hoặc thay đổi chưa duyệt không được tự ghi nhận pass; reviewer thấy cả ảnh gốc và diff.
- **AC-16-P3-3**: Given precondition hợp lệ, When thực thi scope phase, Then Luồng modal/form lỗi có kiểm chứng focus và thao tác; automated scan không được ghi thành WCAG conformance.

### A6. UAT
- **UAT-16-P3-1**: Persona QA/Dev tiếp quản; precondition là reference scenario và synthetic data.
- Thao tác: chạy healthy control → kích hoạt lỗi có chủ đích → đọc report → tái chạy từ recipe.
- Mong đợi: control pass, fault bị phát hiện đúng nguyên nhân và người khác truy nguyên được.
- Truy vết: REQ-16-P3, BR-16-P3, AC-16-P3-1 đến AC-16-P3-3.
- Kết quả hiện tại: NOT RUN. Mới có rehearsal công cụ trên trang tham chiếu (§I); pilot ứng dụng cần evidence riêng.

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết định & tasks
- TECH-16-P3: ưu tiên reuse + deterministic checks nhằm bảo vệ BR-16-P3; dependency còn là proposal.
- [ ] T3.1: Tạo qa-visual-regression; mở rộng references của qa-ui-review cho accessibility.
- [ ] T3.2: Cố định OS/browser/fonts/locale/timezone/color scheme/data; chụp theo component và trạng thái rủi ro.
- [ ] T3.3: Thiết lập baseline approval, diff review, mask allowlist có lý do; không cập nhật baseline để xóa lỗi.
- [ ] T3.4: Mở rộng axe, keyboard, focus trap/restoration, error/live region, zoom/reflow; manual screen reader có script.

### B2. File inventory & ngân sách
| Path | Thao tác | Trần / mục tiêu |
|---|---|---|
| `.agents/skills/qa-visual-regression/SKILL.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `.agents/skills/qa-ui-review/references/accessibility-workflow.md` | Tạo/Sửa sau inventory | Tài liệu chia theo chủ đề; skill entry gọn |
| `playwright/visual.config.ts` | Tạo/Sửa sau inventory | Module ≤250 / <190; role ngoài tests theo Rule 15 |
| `playwright/deep-engine-tests/visual-accessibility.spec.ts` | Tạo/Sửa sau inventory | Test ≤800 / <600 |
- Thực tế triển khai (PDR-16-P3-01 và PDR-16-P3-02, chờ duyệt):
  - 2 dòng `.agents` thuộc nhóm `ship`, nên không sửa tại satellite. Đề xuất ở [phase-3-hub-proposals.md](phase-3-hub-proposals.md).
  - `playwright/visual.config.ts` (32 dòng): chỉ chạy `*.visual.spec.ts`; hiện chưa có spec nghiệp vụ nào.
    Đã phân loại `seed` trong `sync-manifest.json`.
  - Thêm `tests/support/visual-{env,baseline,assert}.ts` (70 / 143 / 116) và `tests/support/a11y-{flows,scan}.ts` (166 / 89).
  - Thêm `deep-engine-tests/visual-accessibility.{harness,pages}.ts` (128 / 105). Spec `visual-accessibility.spec.ts` dài 231 dòng.
  - Phase 1 `evidence-run.ts`/`evidence-receipt.ts`/`evidence-reporter.ts`: thêm `recordedEnv` (QA P2, replay).
  - `evidence-pipeline.harness.ts`: `runNested` có thêm `runLabel` để tách runId khi một thư mục chạy nhiều lần.
- Thêm file/helper/data/schema mới phải cập nhật inventory trước code; không né hạn mức bằng nén dòng.
- Ngoài tests: service <160/200; utils <120/150; mọi file mới phải dưới vùng vàng 80%.
- Ship sửa tại Hub có thẩm quyền; seed/own theo sync-manifest, không ghi đè business project.

### B3. Contract & schemas
- Version hóa input/output artifact; REQ/AC/TC → test ID → run ID → manifest/hash.
- Phải tuân [evidence-contract.md](evidence-contract.md) và [reproduction-protocol.md](reproduction-protocol.md).
- Không đổi contract ứng dụng ngoài scope; schema/API mới phải khóa trước Gate 2.
- Đã triển khai (chưa khóa Gate 2):
  - `visual-baselines/1` (`baselines.approved.json` cạnh ảnh): hash, người duyệt khác tác giả, lý do, env quan sát được,
    mask có lý do và nguồn ứng viên (run/attempt/hash artifact).
  - `visual-review/1`: attach mỗi lần so ảnh, kèm ảnh expected / actual / diff.
  - `a11y-scan/1`: `conformanceClaim` luôn là `NONE`; checklist screen reader thủ công ở `NOT_RUN`.
- Bất biến:
  - Baseline chỉ được ghi qua `approveBaseline`, vì `updateSnapshots: 'none'`.
  - Approval được kiểm cả trước và sau khi so, nên `--update-snapshots` ghi đè baseline sẽ bị bắt.
- Sau QA/UAT tập dượt (PDR-16-P3-03..06):
  - **Dung sai so ảnh:** `maxDiffPixels: 0, threshold: 0`. Mọi sai khác pixel đều fail (PDR-16-P3-03, cần owner xác nhận
    trước khi bật gate, vì baseline CI có thể cần dung sai khác).
  - **Approval:**
    - `sha256` phải bằng `source.artifactSha256`.
    - Người duyệt được so với tác giả sau `normalizeActor` (NFKC, bỏ ký tự định dạng, gộp khoảng trắng, chữ thường).
  - **Mask:** selector chỉ tìm trong target; tổng diện tích ≤ `MAX_MASK_AREA_RATIO` 25% (`MASK_TOO_LARGE`).
    `visual-review/1` thêm `maskCoverage`.
  - **Bỏ qua so ảnh:** `--ignore-snapshots` / `ignoreSnapshots` → `VISUAL_SNAPSHOTS_IGNORED`, kết quả `BLOCKED`.
  - **Env key** thêm `fontProbe` (độ rộng render theo font family). Approval cũ không có field này sẽ ra `STALE_BASELINE_ENV`.
  - **Mã a11y mới** (`a11y-flows`): `DIALOG_NO_CONTROLS`, `CONTROL_NOT_TABBABLE`, `FOCUS_CYCLE_INCOMPLETE`,
    `ERROR_MESSAGE_HIDDEN`, `REFLOW_CONTENT_CLIPPED`.
    - Focus phải nằm trên control, không tính container.
    - Live region phải đổi nội dung sau submit và hiện với công nghệ hỗ trợ.
    - Reflow không còn dung sai +1px.
  - **Tự nhận conformance:** `conformanceClaimProblems` thêm các mẫu meets/compliant with/WCAG-compliant/100% accessible/ADA-compliant.
  - **Replay:** run con ghi `EVIDENCE_RECORD_ENV`; test ngoài attach `nested-runs.json`.

### B4. Dependencies
- Dùng Playwright và axe sẵn có; dịch vụ visual bên ngoài là lựa chọn cần ADR. (RES-16).

### B5. NFR
- Không secret/PII trong artifact chia sẻ; không arbitrary command execution từ manifest.
- Đo runtime/storage của phase trước bật gate; fail evidence không được che bằng warning.
- Collector/report phải độc lập theo run/test/attempt/shard; không shared mutable state.

### B6. Rủi ro & rollback
- RISK-16-P3: false pass, stale report, thay đổi runner hoặc mất bằng chứng khi cleanup.
- Rollback code/config của phase riêng bằng patch có review; giữ artifact và schema reader tương thích.
- Không rollback requirement/assertion hoặc xóa bằng chứng để che lỗi.

## C. Ma Trận Kiểm Thử

| AC ID | TC ID | Mức | Critical? | File Test Dự Kiến | Ca biên / ghi chú |
|---|---|---|---|---|---|
| AC-16-P3-1 | TC-16-P3-1 | integration | Yes | `playwright/deep-engine-tests/visual-accessibility.spec.ts` | Public caller + healthy control |
| AC-16-P3-2 | TC-16-P3-2 | integration | Yes | `playwright/deep-engine-tests/visual-accessibility.spec.ts` | Negative / failure injection |
| AC-16-P3-3 | TC-16-P3-3 | integration | Yes | `playwright/deep-engine-tests/visual-accessibility.spec.ts` | Boundary / concurrency / stale evidence |
- Test phải có positive control và fault injection từ public caller; kiểm cả downstream outcome.
- Case không áp dụng phải có lý do trong contract; không dùng N/A cho case chưa chạy.
- Spec canonical cần @REQ-xxx, title TC-xxx - AC-yyy và priority theo rule workspace.

## D. Phạm Vi Dev Được Tự Quyết
- Tên biến, cách chia internal module và cấu trúc helper trong budget.
- Không tự đổi expected, SLO, trust, retention, dependency hay scope ngoài §B đã được khóa.

## E. Câu Hỏi Mở & Giả Định
- Q-16-P3: Owner chốt phạm vi browser/device và baseline reviewer trước khi bật gate.
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
- Gate 3 (review): **CHƯA CHẠY**. Thiếu Gate 3 thì Gate 4 không đóng được (Master: "thiếu Gate 3 khi đóng Gate 4").
- **Gate 4 (QA) + Gate 4.5 (UAT) — đã chạy bản tập dượt ngày 2026-11-03, CHƯA KÝ.**
  - Thực hiện bởi một agent QA riêng, không phải principal `gate4` của Master Authority.
  - Chạy trên HEAD `017bf80`, tree sạch, trust `TRUSTED_CANDIDATE`:
    - spec 3/3 (`local-20261103-080221-7316`);
    - full suite 36/36 (`local-20261103-080335-41892`);
    - chạy lại spec từ argv/cwd của receipt: 3/3;
    - verdict `COMPLETE`; `verify` và `qa:check` exit 0.
  - Verdict theo AC: AC-1 **PARTIAL**, AC-2 **NOT MET**, AC-3 **PARTIAL**. Có 2 P1, 8 P2 và 5 P3, đều đã chạy probe xác nhận.
  - **P1 — đã sửa** (chưa commit), mỗi lỗi có probe và mutation check:
    1. Sửa tay `baselines.approved.json` (sha256/bytes) cho khớp ảnh mới thì regression vẫn pass.
       - Đã sửa: approval phải có `sha256 === source.artifactSha256` (chính ứng viên đã review).
       - **Còn hở:** sửa cả hai field vẫn lọt, vì manifest chưa có chữ ký. Cần chữ ký approval qua Master Authority,
         hoặc CODEOWNERS cho `__baselines__/`.
    2. `--ignore-snapshots` làm mọi case pass và review ghi `MATCH` giả. Đã sửa: `VISUAL_SNAPSHOTS_IGNORED` → `BLOCKED`.
  - **P2 — đã sửa** (chưa commit). Mỗi lỗi có variant hoặc probe riêng và một mutation check:
    - **Ngưỡng pixel:** `threshold: 0`. Probe variant `tint` (#000→#333) giờ bị bắt.
    - **Tự duyệt:** so sau `normalizeActor` (NFKC, bỏ ký tự zero-width, gộp khoảng trắng, chữ thường).
      Các alias `Dev-Author`, khoảng trắng thừa, zero-width và chữ full-width đều bị từ chối.
    - **Mask:** chỉ tìm trong target, nên mask che chính target ra `MASK_EMPTY`. Diện tích mask tối đa 25%
      (`MASK_TOO_LARGE`); `maskCoverage` được ghi vào review.
    - **Dialog:** focus phải nằm trên control bên trong; control có `tabindex=-1` ra `CONTROL_NOT_TABBABLE`;
      Tab phải đi qua mọi control (`FOCUS_CYCLE_INCOMPLETE`).
    - **Form lỗi:** thông điệp bị ẩn ra `ERROR_MESSAGE_HIDDEN`. Live region chỉ được tính khi nội dung đổi sau submit
      và hiện với công nghệ hỗ trợ: `aria-hidden` hoặc `role=status` cũ không đổi đều ra `ERROR_NOT_ANNOUNCED`.
    - **Reflow:** bỏ dung sai +1px; thêm `REFLOW_CONTENT_CLIPPED` cho phần tử vượt mép viewport mà không có vùng cuộn
      (bắt được `overflow-x:hidden` trên `html`/`body`).
    - **Regex tự nhận WCAG:** thêm 5 mẫu (meets/compliant with/WCAG-compliant/100% accessible/ADA-compliant);
      có 7 probe câu.
    - **Replay:** `EVIDENCE_RECORD_ENV` ghi env replay (đã redact, bỏ tên secret) vào `receipt.execution.recordedEnv`.
      TC-1 replay chỉ từ receipt ra cùng kết cục 2 pass / 3 fail.
  - **UAT friction đã xử lý:**
    - TC-1/TC-2 attach `nested-runs.json` (runId, runRoot, verdict, counts, recordedEnv của từng run con).
    - Report của mọi variant a11y lỗi đều được attach.
    - Thêm 9 variant: `no-focus-move`, `no-role`, `tabindex-trap`, `hidden-live`, `stale-status`, `hidden-msg`,
      `no-invalid`, `no-error-focus`, `clipped`.
    - Mỗi variant phải báo đúng mã ở check bị cài lỗi, và hai check còn lại phải sạch.  - **P3:**
    - `--update-snapshots=changed` bị bắt nhưng đã phá ảnh đã duyệt trên đĩa.
    - Baseline nằm trong junction.
    - Đã sửa: bỏ ANSI trong `VISUAL_DIFF`; chọn attachment theo đúng tên; env key thêm `fontProbe`; có negative control cho mọi mã a11y.
    - Còn mở: `--update-snapshots=changed` vẫn phá ảnh đã duyệt trên đĩa (dù bị chặn); baseline nằm trong junction.
  - **UAT-16-P3-1** (người tiếp quản chỉ dùng tài liệu và code):
    - (a) Healthy control chỉ chạy được qua harness, vì `visual.config.ts` chưa có spec.
    - (b) Thêm fault mới phải đọc code harness. Report a11y của các variant lỗi không được attach.
    - (c) `visual-review.json` cùng ba ảnh đọc được rõ, hash khớp. Nhưng receipt ngoài không trỏ tới bundle của run con
      (phải đoán đường dẫn), và bundle tạm bị ghi đè.
    - (d) Run ngoài replay được; run con thì không.
    - Kết luận: truy nguyên được với các fault có sẵn; chưa truy nguyên được lỗi bất kỳ chỉ từ evidence.
      → UAT **NOT ACCEPTED**; vẫn thiếu pilot app.
- Ký qua Master Authority đang bị chặn (repo chưa đăng ký; vault được provision cho SID của một máy khác).
- Giới hạn đã biết (developer tự khai):
  - Baseline phụ thuộc OS/browser. Approval của harness được tạo trong lúc chạy trên máy local; chưa có baseline nghiệp vụ hay baseline CI.
  - Tên người duyệt baseline là tự khai, chưa gắn danh tính.
  - Chưa kiểm text zoom 200%, contrast của trạng thái hover/focus, high-contrast mode hay screen reader thật
    (`SCREEN_READER_SCRIPT` vẫn `NOT_RUN`).
  - `checkFormErrors` coi live region có sẵn từ trước là đủ, chưa đo cách screen reader thật đọc nó.
  - Quan sát khi chạy (xác nhận lại P2 đã biết của Phase 1): chạy lại cùng runId thì reporter không ghi được receipt
    (`EEXIST`) và receipt cũ vẫn nằm đó. Harness đã né bằng `runLabel`; bản thân reporter chưa sửa.
- Trang tham chiếu dùng `page.setContent` (`document.write`), nên script phải bọc IIFE, nếu không `const`
  của trang trước sẽ làm script lỗi.

## H. Nhật Ký Thay Đổi Kế Hoạch
| PDR ID | Loại | Nội dung | Ảnh hưởng | Trạng thái |
|---|---|---|---|---|
| PDR-16-P3-01 | TECH | §B2: thêm 5 module support + harness/pages; `visual.config.ts` chưa có spec nghiệp vụ | Inventory | PENDING |
| PDR-16-P3-02 | TECH | 2 file `ship` chuyển thành đề xuất Hub; T3.1 chỉ xong phần seed | Scope/boundary | PENDING |
| PDR-16-P3-03 | TECH | Dung sai so ảnh `threshold: 0` (trước là mặc định 0.2) theo QA P2. Owner cần xác nhận cho baseline CI/đa browser (Q-16-P3) | Tolerance (§D: dev không tự khóa) | PENDING |
| PDR-16-P3-04 | TECH | QA P1: approval phải khớp hash ứng viên đã review; `--ignore-snapshots` bị chặn. Phần còn hở (sửa cả hai field) cần chữ ký approval hoặc CODEOWNERS | Contract `visual-baselines/1` | PENDING |
| PDR-16-P3-05 | TECH | QA P2: mask chỉ tìm trong target, trần 25%; tự duyệt so sau chuẩn hoá; env key thêm `fontProbe` (approval cũ bị coi là stale) | Contract `visual-baselines/1`, `visual-review/1` | PENDING |
| PDR-16-P3-06 | TECH | QA P2/UAT: mã a11y mới, live region phải đổi nội dung và hiện với AT, reflow bắt nội dung bị cắt, regex tự nhận rộng hơn; thêm 9 variant tham chiếu; `nested-runs.json`; replay qua `recordedEnv` (PDR-16-P1-03) | Contract a11y flows, harness | PENDING |

## I. Bằng Chứng Thực Nghiệm
- Khi chạy: exact argv/cwd, exit code, counts/runtime, snippet log và full revisions/dirty identity.

Developer tự kiểm ngày 2026-11-03.
- Môi trường: Windows 11, Node v22.3, Playwright 1.63, chromium@153, axe-core 4.13.
- QA revision `56dad3c76724df3f2b605a3cc2a513d8e1cae48e`, worktree **dirty** (trust `INVESTIGATION_ONLY`).
- Đây là bằng chứng điều tra, chưa phải bằng chứng gate.

1. `visual-accessibility.spec.ts` (HM-12) với `--workers=1`: 3 passed (35.9s).
   - **TC-1:** run con 4 case trên baseline đã duyệt: 2 pass (UI đúng, timestamp đã mask đổi); 2 fail (nút lệch
     12px, giá đổi), mỗi case có review `DIFF` và đủ 3 ảnh expected / actual / diff, hash khớp artifact.
     Control: bỏ mask thì chính thay đổi timestamp gây `DIFF`.
   - **TC-2:**
     - Thiếu baseline (kể cả có `--update-snapshots=missing`) → `BLOCKED` + ảnh ứng viên, không ghi baseline.
     - Approval bị từ chối khi tự duyệt, không có lý do, hoặc ứng viên bị giả.
     - Kiểm theo dữ liệu: env lệch, mask chưa duyệt hoặc không lý do, approval hỏng, chưa duyệt.
     - `--update-snapshots=all` với UI sai → `BASELINE_CHANGED`. Sau đó UI đúng vẫn bị chặn, kèm
       `MASK_NOT_APPROVED` và `MASK_EMPTY`.
   - **TC-3:** variant đúng → dialog / form / reflow / axe đều sạch, focus trở về `button#open`.
     7 lỗi cài cố ý đều bị phát hiện đúng mã; `unlabeled` → axe `button-name`.
     Report luôn có `conformanceClaim: NONE`, statement ở dòng đầu, 5 manual check vẫn `NOT_RUN`, và chặn được
     "WCAG 2.1 AA compliant".
2. Mutation, mỗi lần một file, sau đó khôi phục. Mỗi mutation làm fail đúng một probe:

   | Mutation | Probe bị fail |
   |---|---|
   | Bỏ kiểm approval sau khi so | TC-2 `--update-snapshots=all` |
   | Bỏ so hash baseline | TC-2 |
   | Bỏ `MASK_EMPTY` | TC-2 |
   | Bỏ `FOCUS_NOT_RESTORED` | TC-3 |
   | Bỏ `LIVE_REGION_CREATED_LATE` | TC-3 |
3. Full suite `playwright test -c deep-engine.config.ts --workers=2`: exit 0, 36/36 (2.8 phút).
   Receipt `local-20261103-074642-44600`: counts 36/36/36, notRun 0, verdict `COMPLETE`.
4. `npx playwright test -c visual.config.ts --list`: 0 test, exit 1, receipt `INVALID_EMPTY_RUN`. Đúng là chưa có spec
   nghiệp vụ, và run rỗng không thành PASS.
5. `npm run verify` exit 0 (53 test). `npm run qa:check` exit 0, sau khi phân loại `playwright/visual.config.ts`.
   `node --test "tools/**/*.test.js"` 268/268.
6. Chưa chạy: CI, review / QA / UAT độc lập, baseline nghiệp vụ trên pilot app, screen reader thật, 2 file ship (chờ Hub).
7. QA / UAT tập dượt và kết quả sau khi sửa P1 (chi tiết ở §G):
   - Agent QA chạy trên `017bf80`, tree sạch, `TRUSTED_CANDIDATE`: spec 3/3 (`local-20261103-080221-7316`) và full suite
     36/36 (`local-20261103-080335-41892`), cả hai verdict `COMPLETE`.
   - Sửa hai P1, rồi chạy spec: 3 passed (52.1s).
   - Mutation, sau đó khôi phục:
     - bỏ `VISUAL_SNAPSHOTS_IGNORED` → probe `--ignore-snapshots` của TC-2 fail;
     - bỏ kiểm `sha256 === source.artifactSha256` → probe sửa tay approval fail.
   - Full suite 36/36 (2.0 phút), receipt `local-20261103-081457-31764` verdict `COMPLETE`. Base `017bf80` nhưng tree dirty,
     nên trust là `INVESTIGATION_ONLY`.
   - `npm run verify` exit 0, `npm run qa:check` exit 0.
8. Sau khi sửa 8 P2 (base `017bf80`, tree dirty, trust `INVESTIGATION_ONLY`):
   - Spec HM-12 3/3 (1.1 phút).
   - Mutation, mỗi lần một file, sau đó khôi phục. Mỗi mutation làm fail đúng một probe:

     | Mutation | Probe bị fail |
     |---|---|
     | Bỏ `threshold: 0` | TC-1 `tint` |
     | `normalizeActor` không chuẩn hoá | TC-2 alias tự duyệt |
     | Bỏ `MASK_TOO_LARGE` | TC-2 |
     | `focusOnControl` chấp nhận container | TC-3 `tabindex-trap` |
     | Không lọc thông điệp bị ẩn | TC-3 `hidden-msg` |
     | Bỏ `REFLOW_CONTENT_CLIPPED` | TC-3 `clipped` |
     | Regex chỉ còn mẫu đầu | TC-3 câu tự nhận WCAG |
     | Không ghi `recordedEnv` | TC-1 replay |
   - Full suite 36/36 (2.4 phút), receipt `local-20261103-083418-39384` verdict `COMPLETE`.
   - typecheck và lint sạch; `limits` 63 file < 80%; `qa:check` exit 0; tool tests 268/268.
- Giữ fail attempt lẫn pass retry; reviewer rerun trên cùng revision trong receipt riêng.

