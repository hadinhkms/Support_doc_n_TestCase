# Phase 1 — Nền tảng Evidence

> **Trạng thái:** `IMPLEMENTED BUT UNVERIFIED` (đã chạy phiên review/QA/UAT rehearsal; chờ ký độc lập) · **Cấp độ:** L3 · **Ngày:** 2026-11-03
> **Người soạn:** Codex, một phiên; BA/TL chưa đồng tác giả hoặc soát chéo độc lập.
> **Triển khai:** Claude Code, một phiên (2026-11-03): `0629f67` + bản sửa finding review (xem §G, §I).
> **Research:** RES-16 (R3, chưa đóng formal gate) · **Phụ thuộc:** Phase 0
> Không lên `VERIFIED`/`COMPLETED`: chưa có chữ ký Gate 3/4/4.5 gắn danh tính, chưa có receipt `trust: CI`,
> UAT pilot chưa chạy (03_ACCEPTANCE_GATES "No Self-Signoff"). Chưa tick task §B1/§F.

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục tiêu & phạm vi
- Tạo evidence đủ truy nguyên, không mất khi test fail hoặc cleanup; dùng chung mọi skill.
- In-Scope: các task dưới đây; evidence và reproduce theo hai phụ lục của cụm plan.
- Out-of-Scope: triển khai code trong lượt lập plan; thay đổi nghiệp vụ ứng dụng đích.

### A2. Yêu cầu & quy tắc
- REQ-16-P1: Tạo evidence đủ truy nguyên, không mất khi test fail hoặc cleanup; dùng chung mọi skill.
- BR-16-P1: expected lấy từ contract/AC đã xác nhận; không sửa assertion/baseline để làm xanh.
- Tất cả quy định chung tại [overview](plan-overview.md) và [evidence contract](evidence-contract.md).
- REQ/AC/TC ở đây là ID hoạch định; Phase 0 ánh xạ vào canonical workspace trước tạo spec.

### A3. Flow & nhánh lỗi
- QA chọn scope → xác lập precondition → chạy caller → đối chiếu observable → lưu evidence → review.
- Lỗi app/test/env/collector được phân loại riêng; thiếu artifact hoặc stale revision không được PASS.
- Hủy chạy: lưu partial manifest và nguyên nhân; cleanup có log riêng, không ghi đè lỗi gốc.

### A4. Biên & bất biến
- EDGE-16-P1-1: chạy lại cùng test, nhiều shard/worker hoặc CI bị hủy giữa chừng.
- EDGE-16-P1-2: artifact thiếu/hash sai/hết hạn, credential không hợp lệ hoặc source thay đổi.
- EDGE-16-P1-3: expected chưa rõ phải SPEC_GAP; không tự phát minh kết quả nghiệp vụ.

### A5. Acceptance Criteria
- **AC-16-P1-1**: Given precondition hợp lệ, When thực thi scope phase, Then Mỗi run có QA/app revision, dirty identity, command, exit, counts, test/retry/shard/worker ID và hash artifact.
- **AC-16-P1-2**: Given precondition hợp lệ, When thực thi scope phase, Then Secret canary không xuất hiện trong JSON/log/ảnh/trace được phép chia sẻ; manifest phân loại hạn chế hoặc từ chối export.
- **AC-16-P1-3**: Given precondition hợp lệ, When thực thi scope phase, Then Artifact thiếu/hỏng/hash lệch/ghi lỗi/cleanup fail được báo riêng; không có PASS giả hoặc ghi đè evidence giữa workers.

### A6. UAT
- **UAT-16-P1-1**: Persona QA/Dev tiếp quản; precondition là reference scenario và synthetic data.
- Thao tác: chạy healthy control → kích hoạt lỗi có chủ đích → đọc report → tái chạy từ recipe.
- Mong đợi: control pass, fault bị phát hiện đúng nguyên nhân và người khác truy nguyên được.
- Truy vết: REQ-16-P1, BR-16-P1, AC-16-P1-1 đến AC-16-P1-3.
- Kết quả hiện tại: NOT RUN; harness chỉ kiểm công cụ, pilot ứng dụng cần evidence riêng.

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết định & tasks
- TECH-16-P1: ưu tiên reuse + deterministic checks nhằm bảo vệ BR-16-P1; dependency còn là proposal.
- [ ] T1.1: Áp dụng toàn bộ evidence-contract.md; schema versioned và validator fail-closed.
- [ ] T1.2: Tách collector, manifest, redaction, attachment; không dồn vào evidence.ts đang có.
- [ ] T1.3: Chụp snapshot trạng thái trước cleanup; ghi lỗi collector riêng, giữ lỗi gốc.
- [ ] T1.4: Tích hợp reporter/CI: JUnit + receipt + artifact index; kiểm chứng download trên runner mới.

### B2. File inventory & ngân sách
| Path | Thao tác | Trần / mục tiêu |
|---|---|---|
| `playwright/tests/support/evidence.ts` | Tạo/Sửa sau inventory | Module ≤250 / <190; role ngoài tests theo Rule 15 |
| `playwright/tests/support/evidence-manifest.ts` | Tạo/Sửa sau inventory | Module ≤250 / <190; role ngoài tests theo Rule 15 |
| `playwright/tests/support/evidence-redaction.ts` | Tạo/Sửa sau inventory | Module ≤250 / <190; role ngoài tests theo Rule 15 |
| `playwright/tests/fixtures/test-fixtures.ts` | Tạo/Sửa sau inventory | Module ≤250 / <190; role ngoài tests theo Rule 15 |
| `.github/workflows/playwright.yml` | Tạo/Sửa sau inventory | Module ≤250 / <190; role ngoài tests theo Rule 15 |
| `playwright/deep-engine-tests/evidence-pipeline.spec.ts` | Tạo/Sửa sau inventory | Test ≤800 / <600 |
- Bổ sung khi triển khai (PDR-16-P1-01, chờ duyệt) — `evidence.ts` giữ nguyên, logic mới tách theo T1.2:
  `tests/support/evidence-{collector,integrity,manifest-build,receipt,reporter,run,verify}.ts` (89–191 dòng;
  collector/manifest 191 > mục tiêu <190 nhưng < vùng vàng 200),
  `tests/fixtures/evidence.fixture.ts` (90), `deep-engine-tests/evidence-pipeline.harness.ts` (105),
  `deep-engine-tests/evidence-download-drill.spec.ts` (34); sửa `playwright.config.ts`, `deep-engine.config.ts`.
- `.github/workflows/playwright.yml` 216 dòng: vượt mục tiêu <190 (trần 250); YAML ngoài phạm vi `qa:limits`.
- Thêm file/helper/data/schema mới phải cập nhật inventory trước code; không né hạn mức bằng nén dòng.
- Ngoài tests: service <160/200; utils <120/150; mọi file mới phải dưới vùng vàng 80%.
- Ship sửa tại Hub có thẩm quyền; seed/own theo sync-manifest, không ghi đè business project.

### B3. Contract & schemas
- Version hóa input/output artifact; REQ/AC/TC → test ID → run ID → manifest/hash.
- Phải tuân [evidence-contract.md](evidence-contract.md) và [reproduction-protocol.md](reproduction-protocol.md).
- Không đổi contract ứng dụng ngoài scope; schema/API mới phải khóa trước Gate 2.

### B4. Dependencies
- Ưu tiên Node core và reporter hiện có; đánh giá storage SDK chỉ khi backend đã được duyệt. (RES-16).

### B5. NFR
- Không secret/PII trong artifact chia sẻ; không arbitrary command execution từ manifest.
- Đo runtime/storage của phase trước bật gate; fail evidence không được che bằng warning.
- Collector/report phải độc lập theo run/test/attempt/shard; không shared mutable state.

### B6. Rủi ro & rollback
- RISK-16-P1: false pass, stale report, thay đổi runner hoặc mất bằng chứng khi cleanup.
- Rollback code/config của phase riêng bằng patch có review; giữ artifact và schema reader tương thích.
- Không rollback requirement/assertion hoặc xóa bằng chứng để che lỗi.

## C. Ma Trận Kiểm Thử

| AC ID | TC ID | Mức | Critical? | File Test Dự Kiến | Ca biên / ghi chú |
|---|---|---|---|---|---|
| AC-16-P1-1 | TC-16-P1-1 | integration | Yes | `playwright/deep-engine-tests/evidence-pipeline.spec.ts` | Public caller + healthy control |
| AC-16-P1-2 | TC-16-P1-2 | integration | Yes | `playwright/deep-engine-tests/evidence-pipeline.spec.ts` | Negative / failure injection |
| AC-16-P1-3 | TC-16-P1-3 | integration | Yes | `playwright/deep-engine-tests/evidence-pipeline.spec.ts` | Boundary / concurrency / stale evidence |
- Test phải có positive control và fault injection từ public caller; kiểm cả downstream outcome.
- Case không áp dụng phải có lý do trong contract; không dùng N/A cho case chưa chạy.
- Spec canonical cần @REQ-xxx, title TC-xxx - AC-yyy và priority theo rule workspace.

## D. Phạm Vi Dev Được Tự Quyết
- Tên biến, cách chia internal module và cấu trúc helper trong budget.
- Không tự đổi expected, SLO, trust, retention, dependency hay scope ngoài §B đã được khóa.

## E. Câu Hỏi Mở & Giả Định
- Q-16-P1: Kế thừa Q về retention/access từ Phase 0; chưa chốt thì chỉ dùng dữ liệu synthetic local.
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
- **Gate 3 (review phiên, 2026-11-03):** reviewer agent tách context, đọc code `0629f67`, không chạy/sửa.
  Kết luận: P0 0, **P1 4** → đã sửa toàn bộ, có probe + mutation kiểm chứng:
  (1) verdict bỏ qua run bị hủy/test không chạy/toàn skipped → `runLevelProblems`, `decideVerdict(counts)`;
  (2) worker crash để lại attempt mồ côi → `ORPHANED_ATTEMPT`; (3) manifest ghi PASS khi auto fixture
  fail sau đó → `OUTCOME_MISMATCH`; (4) redaction hụt `client_secret`, camelCase, `Authorization: <scheme>`,
  giá trị có dấu cách, `<input>` nhạy cảm → regex theo cấu trúc. P2 đã sửa: enum/`expiresAt` trong validator,
  redact observable/label/name/title, `EVIDENCE_TTL_DAYS=7` ở CI, drill tải theo pattern + `requireTrusted`,
  cleanup fail hiện ở receipt, đếm `interrupted/notRun/executed`, kiểm `TRUST_ESCALATION`.
  **P2 còn mở (cần owner quyết):** CI chưa có kho RESTRICTED riêng (bundle upload chung, `evaluateExport`
  chưa enforce); thiếu contract/source hash, browser version, Correlation/State/Review block (evidence-contract §2);
  `exitCode` suy từ runner status; synthetic binary phụ thuộc cờ caller; chưa có probe shard thật/upload fail;
  rerun cùng `EVIDENCE_RUN_ID` để lại receipt cũ (PLAUSIBLE). P3: path ADS/device name Windows, TOCTOU.
  Decision: **CHƯA KÝ** — reviewer là agent, không phải danh tính SCM độc lập; cần Tech Lead review lại bản sửa.
- **Gate 4 (QA phiên):** rerun critical + full suite (§I.8–9), trust `LOCAL_UNTRUSTED`/`INVESTIGATION_ONLY`.
  Decision: **CHƯA KÝ** — Gate 4 cần receipt `trust: CI` cùng revision và QA Lead khác người ký Gate 3.
- **Gate 4.5 (UAT rehearsal):** chạy đủ 4 bước UAT-16-P1-1 trên harness (§I.10). Pilot app (U-2) chưa có →
  không thể ACCEPTED; cần Principal BA/PO chạy trên pilot và ký.
- **Gate 3 vòng 2 (2026-11-03, bản tập dượt, CHƯA KÝ):**
  - Reviewer agent riêng soát lại các bản sửa ở `f22a1f9` và xác nhận 4 P1 cũ không tái phát: verdict khi
    run bị interrupt hoặc có test không chạy; orphan attempt; `OUTCOME_MISMATCH`; redaction đã mở rộng.
  - Finding mới (P3) đã sửa, chưa commit: redaction bỏ sót `scheme://user:pass@host`, `pass=`/`db_pass=` và khối
    PEM private key. Đã thêm vào `evidence-redaction.ts` và bảng `shapes` của TC-16-P1-2. Có control âm
    `tests passed=3`, giá trị này không được redact.
  - Replay của Phase 2 dùng `runNested(..., isolate=true)`. Harness chỉ còn giữ biến hệ thống (Phase 2, review P2-3).
  - P3 còn mở:
    - `token: [abc]` (giá trị là mảng) chưa được redact dạng text.
    - Attempt `NOT_COLLECTED` (không có manifest) không sinh problem nếu worker crash trước khi tạo thư mục attempt.
    - Verifier chưa đối chiếu `counts` với `attempts`.
- Ký gate qua Master Authority **đang bị chặn**: repo chưa có trong `projects-registry.json`, plan-16 chưa
  `PLAN_APPROVED`, và phiên dev không được dùng khóa `gate3`/`gate4`. Chi tiết ở Phase 2 §G.

## H. Nhật Ký Thay Đổi Kế Hoạch
| PDR ID | Loại | Nội dung | Ảnh hưởng | Trạng thái |
|---|---|---|---|---|
| PDR-16-P1-01 | TECH | Thêm module/fixture/harness ngoài §B2 (liệt kê ở §B2); manifest schema `1.1` song song reader `1.0` của Phase 0 | File inventory, schema | PENDING |
| PDR-16-P1-02 | TECH | Retention CI giữ 7 ngày như hiện hữu vì Q-16-P1 chưa chốt; chỉ dữ liệu synthetic | Retention | PENDING |

## I. Bằng Chứng Thực Nghiệm
- Revision: `22990373675ab9ae54bd513094beaa3c4abe363c` + working tree **dirty** (chưa commit) → chỉ là
  `INVESTIGATION_ONLY`, không dùng làm gate evidence. Máy: Windows 11, Node v22.3.0, Playwright 1.55.
- Kết quả local (2026-11-03, cwd `playwright/` trừ khi ghi khác):
  1. `npx playwright test -c deep-engine.config.ts evidence-contract.spec.ts evidence-pipeline.spec.ts evidence-download-drill.spec.ts --workers=2`
     → exit `0`, `6 passed (24.2s)` (HM-09 ×3, HM-10 TC-16-P1-1..3); receipt `verdict=COMPLETE`.
  2. Download drill mô phỏng: copy `test-results/evidence` → `EVIDENCE_DRILL_ROOT`, `EVIDENCE_EXPECTED_REVISION=HEAD`,
     `npm run test:deep-engine -- evidence-download-drill.spec.ts` → exit `0`, `1 passed`. Chưa chạy trên runner CI mới.
  3. Mutation: tắt xóa literal secret trong `redactText` → TC-16-P1-2 fail (`Expected SHAREABLE / Received RESTRICTED`); đã khôi phục.
  4. `npm run verify` → exit `0` (typecheck + lint + limits + `--list` 53 tests).
  5. `npm run qa:check` (gốc) → exit `0` (boundary, drift, gaps, limits strict: 45 file trong ngưỡng).
  6. `npm test` (gốc) → exit `1`: `Cannot find module 'D:\_QA_Test_Automation\tools'` — `node --test tools/` không chạy được
     trên Node 22.3 (CI dùng Node 20); không liên quan thay đổi này. Thay thế: `node --test "tools/**/*.test.js"` → `268 pass, 0 fail`.
  7. `npm run test:deep-engine -- --workers=2` (toàn bộ) → exit `1`: Chromium chưa cài trên máy
     (`Executable doesn't exist ... chrome-headless-shell`), mọi HM dùng `page` fail; 3 test HM-10 không được
     schedule (`workerIndex: -1`). Đã chạy `npx playwright install chromium` (exit `0`) rồi chạy lại với
     `--workers=2` và `--workers=1`: cả hai crash do máy hết RAM (~700 MB free/15 GB; `FATAL ... out of memory`,
     `browserType.launch: spawn UNKNOWN`, worker exit `0xC0000409`) trước khi assertion chạy (mục 1–7: bản `0629f67`).
- Sau sửa finding Gate 3 (base `0629f67` + working tree dirty → `INVESTIGATION_ONLY`; RAM ~6.4 GB free):
  8. `npx playwright test -c deep-engine.config.ts evidence-pipeline.spec.ts --workers=1` → exit `0`, `3 passed (26.6s)`.
     Mutation: tắt kiểm `OUTCOME_MISMATCH` → TC-16-P1-3 fail đúng assertion; đã khôi phục.
  9. Full suite: `npm run test:deep-engine -- --workers=2` (PowerShell nuốt `--workers=2`; receipt ghi đúng argv thực
     `playwright test -c deep-engine.config.ts`, 8 workers) → exit `0`, `30 passed (30.7s)`; counts
     `matched=executed=expected=30, notRun=0`; receipt `verdict=COMPLETE`, trust `INVESTIGATION_ONLY`.
  10. UAT rehearsal: (a) healthy control = mục 9; (b) fault: sửa 1 artifact trong bản sao bundle; (c) drill:
      bản sạch `1 passed` exit `0`, bản lỗi exit `1` với `SIZE_MISMATCH ... expected 2661 bytes, got 2671`;
      (d) tái chạy từ recipe (argv/cwd trong receipt, gõ tay) → `30 passed`, `verdict=COMPLETE`, khớp receipt gốc.
  11. `npm run verify` exit `0`; `npm run qa:check` exit `0` (46 file trong ngưỡng); `node --test "tools/**/*.test.js"` 268/268.
- UAT-16-P1-1 trên pilot app: NOT RUN (U-2 chưa chốt); mục 10 chỉ là rehearsal công cụ.
- Còn thiếu để đóng phase: CI run trên commit sạch (quality + evidence-drill xanh), chữ ký Gate 3/4/4.5 độc lập.
- Giữ fail attempt lẫn pass retry; reviewer rerun trên cùng revision trong receipt riêng.

