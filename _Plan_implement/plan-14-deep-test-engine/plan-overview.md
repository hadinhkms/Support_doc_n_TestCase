# Plan Overview — Plan 14 (v1.2): Deep Logic, Security & UI/UX Bug-Hunting Framework

> **Cấp độ:** L3 · **Trạng thái:** READY · **Baseline Commit:** e82404bdd6b5f4f2ffe6a39aedf9dabac0e617fb · **Research Gate:** RES-14-DEEP-TEST (R0 Internal Framework)
> **Tác giả Nghiệp vụ:** @user-ba · **Tác giả Kỹ thuật:** @antigravity-tl · **Ngày cập nhật:** 2026-10-23
> **Tài liệu gốc:** [14_DEEP_LOGIC_AND_UI_UX_BUG_HUNTING_FRAMEWORK_PLAN.md](../14_DEEP_LOGIC_AND_UI_UX_BUG_HUNTING_FRAMEWORK_PLAN.md)

## 1. Tầm Nhìn & Kiến Trúc Tổng Thể (4 Lớp Bảo Vệ)

Hệ thống nâng cấp năng lực tự động hóa kiểm thử của kho mã lên chuẩn **Deep Bug-Hunting** với 4 lớp phòng thủ phối hợp:
1. **Lớp 1 — Runtime Bug-Trap Fixture (`base.fixture.ts`)**: Tự động gắn cảm biến `{ auto: true }` bắt 100% lỗi `pageerror`, `console.error`, `requestfailed` và HTTP `>= 500`, có flush hàng đợi sự kiện trình duyệt trước teardown, redact dữ liệu nhạy cảm và hỗ trợ `expectExpectedError` cho negative test (`HM-01`, `HM-02`).
2. **Lớp 2 — UI/UX Geometry & A11y Engine (`ui-checks.ts`)**: Bộ 7 hàm toán học hình học DOM có cơ chế retrying (`expect.poll`/`toPass`), tính toán giao cắt tổ tiên (`ancestor clipping`), kiểm tra nghiêm ngặt trạng thái hiển thị (`requiredLocators` vs `optionalLocators`) và kiểm tra nhãn A11y (`HM-03`, `HM-04`, `HM-05`).
3. **Lớp 3 — Deep Logic & Security Invariant Guards (`deep-guards.ts`)**: Bộ 5 hàm bảo vệ bất biến nghiệp vụ và bảo mật có kiểm chứng nhân quả: chống click đúp (`expectIdempotentSubmit`), chống XSS trên visible sink (`expectSafeXssRender`), kiểm chứng bền vững sau reload (`expectStatePersistence`), chặn request biến đổi dữ liệu khi lỗi biên (`expectBoundaryRejected`) và kiểm soát ngân sách hiệu năng (`expectPerformanceBudget`) (`HM-06`, `HM-07`, `HM-08`).
4. **Lớp 4 — Static AST Quality Gates, AI Skill & Scaffold (`tools/qa`, `tools/scaffold`, `SKILL.md`)**: Phân giải `extractVerifiedHelperImports`, bắt thiếu `await` trên custom helper, đồng bộ `learner.js` + catalogs, chuẩn hóa Canonical Markdown Schema và áp dụng mẫu chuẩn E2E trên `REQ-101`.

## 2. Danh Mục 6 Phase Thực Thi (Phase Index & Dependencies)

| Thứ tự | Phase (Chuẩn `plan-check`) | Bản đối ứng (`PHASE_N`) | Mục tiêu & Đầu ra chính | Phụ thuộc |
|---|---|---|---|---|
| 0 | [Phase 0](phase-0-contracts-and-matrix.md) | [PHASE_0](PHASE_0_CONTRACTS_AND_VERIFICATION_MATRIX.md) | Fixture Matrix, Canonical Schema, `deep-engine.config.ts`, ESLint/TSConfig, `sync-manifest.json`, `HM-01`..`HM-08` | Không |
| 1 | [Phase 1](phase-1-runtime-bug-trap.md) | [PHASE_1](PHASE_1_RUNTIME_BUG_TRAP_FIXTURE.md) | `runtimeTrap` fixture (`{ auto: true }`), event-loop flush, redaction, `HM-01`, `HM-02` | Phase 0 |
| 2 | [Phase 2](phase-2-ui-ux-geometry-engine.md) | [PHASE_2](PHASE_2_UI_UX_GEOMETRY_AND_A11Y_ENGINE.md) | 7 hàm `ui-checks.ts` (retrying, ancestor clip, visibility), `HM-03`..`HM-05` | Phase 0, 1 |
| 3 | [Phase 3](phase-3-deep-logic-and-static-gates.md) | [PHASE_3](PHASE_3_DEEP_LOGIC_INVARIANT_GUARDS_AND_STATIC_GATES.md) | 5 hàm `deep-guards.ts` (`HM-06`..`HM-08`) + nâng cấp `tools/qa/lib/*` (`config`, `parser`, `sources`, `commands`, `learner`) | Phase 0, 1, 2 |
| 4 | [Phase 4](phase-4-ai-skill-and-scaffold.md) | [PHASE_4](PHASE_4_AI_SKILL_AND_SCAFFOLD_UPGRADE.md) | Nâng cấp `tools/scaffold/template.js`, `SKILL.md`, `.github/copilot-instructions.md`, catalogs | Phase 0, 2, 3 |
| 5 | [Phase 5](phase-5-reference-dogfooding.md) | [PHASE_5](PHASE_5_REFERENCE_DOGFOODING_AND_CI_GATE.md) | Dogfooding `REQ-101` (`TC-101-01`..`09`), cập nhật `test-cases/traceability.md`, khóa CI Gate | Phase 1..4 |

## 3. Bảng Giải Quyết Triệt Để 10 Điểm Rà Soát Kiến Trúc (`R14-01` .. `R14-10`)

| Mã | Vấn đề rà soát ở v1.1 | Giải pháp khóa chặt trong v1.2 | Phase xử lý |
|---|---|---|---|
| `R14-01` | ESLint `expect-expect`, `valid-title-format` & `tsconfig.json` chặn helper/HM spec | Cấu hình `assertFunctionNames: ['expect*']`, cho phép `^HM-[0-9]{2}` ở `deep-engine-tests/` và thêm vào `tsconfig.json` | Phase 0 |
| `R14-02` | Xung đột mẫu code v1.0 cũ với hợp đồng v1.1 | Xóa bỏ hoàn toàn mẫu v1.0 cũ; thống nhất chữ ký hàm retrying, ancestor clip và `requiredLocators`/`optionalLocators` | Phase 1, 2, 4 |
| `R14-03` | Harness `deep-engine.config.ts` nằm ở Phase 5 làm Phase 1..3 không chạy được `HM-xx` | Chuyển việc khởi tạo `deep-engine.config.ts` và `deep-engine-tests/` về ngay Phase 0 | Phase 0 |
| `R14-04` | Lỗi `qa:boundary` (`path-khong-ton-tai` / `chua-phan-loai`) khi cập nhật lệch nhịp | Cập nhật nguyên tử `sync-manifest.json` cùng lúc tạo `deep-engine.config.ts` và `deep-engine-tests/` tại Phase 0 | Phase 0 |
| `R14-05` | `sources.js` chưa phân giải alias import và chưa bắt thiếu `await` trên custom helper | Bổ sung `extractVerifiedHelperImports(fileLines)` và tích hợp vào `extractAssertionProfile` + `findMissingAwaits` | Phase 3 |
| `R14-06` | `learner.js` (`STATIC_RULE_MAPPING`) lệch với các cổng tĩnh mới (`DH-05`, `PA-04`) | Cập nhật `tools/qa/lib/learner.js`, `anti-pattern-catalog.md`, `bug-hunting-heuristics.md` và `commands.test.js` | Phase 3, 4 |
| `R14-07` | Cú pháp Markdown metadata chưa khóa chặt giữa Phase 0, `parser.js` và `template.js` | Khóa Canonical Markdown Schema tại Phase 0 và áp dụng đồng nhất tại `parser.js` (Phase 3) & `template.js` (Phase 4) | Phase 0, 3, 4 |
| `R14-08` | Race condition khi `pageerror` đến muộn ở teardown hoặc ghi đè `testInfo.error` | Thực thi `await page.evaluate(() => {})` khi `!page.isClosed()` trước `assertClean()` và bảo toàn `testInfo.error` | Phase 1 |
| `R14-09` | Cờ `checkDeepCoverage` chưa đăng ký trong `tools/qa/lib/config.js` | Thêm `checkDeepCoverage: false` vào `DEFAULTS` và `'checkDeepCoverage'` vào `BOOLEAN_KEYS` trong `config.js` | Phase 3 |
| `R14-10` | Lệch đường dẫn `traceability.md` và thiếu file trong bảng tổng hợp | Chuẩn hóa thành `test-cases/traceability.md` và liệt kê đầy đủ 23 file trong File Inventory | Phase 0..5 |

## 4. Cổng Kiểm Định Thực Thi Tổng Thể (Master Verification Gates)

1. `python .master_process/master.py plan-check _Plan_implement/plan-14-deep-test-engine/plan-overview.md` -> **`Exit 0 — PLAN-CHECK: PASS (6 phase(s) checked)`**
2. `python .master_process/master.py plan-check _Plan_implement/14_DEEP_LOGIC_AND_UI_UX_BUG_HUNTING_FRAMEWORK_PLAN.md` -> **`Exit 0 — PLAN-CHECK: PASS (1 phase(s) checked)`**
3. Khi thực thi code: `npm test` && `npm --prefix playwright run verify` && `npm --prefix playwright run test:deep-engine` && `npm run qa:check` -> **`Exit Code 0`**.
