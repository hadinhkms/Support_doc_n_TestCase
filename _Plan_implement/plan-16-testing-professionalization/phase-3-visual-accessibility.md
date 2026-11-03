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
  - Thêm `tests/support/visual-{env,baseline,assert}.ts` (60 / 134 / 91) và `tests/support/a11y-{flows,scan}.ts` (112 / 83).
  - Thêm `deep-engine-tests/visual-accessibility.{harness,pages}.ts` (105 / 79). Spec `visual-accessibility.spec.ts` dài 167 dòng.
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
- Gate 3 / Gate 4 / Gate 4.5: **CHƯA CHẠY / CHƯA KÝ**. Developer chỉ tự kiểm (§I). Ký qua Master Authority đang bị chặn
  (repo chưa đăng ký; vault được provision cho SID của một máy khác).
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
- Giữ fail attempt lẫn pass retry; reviewer rerun trên cùng revision trong receipt riêng.

