# Plan 14 (v1.2): Deep Logic, Security & UI/UX Bug-Hunting Framework

> **Cấp độ:** L3 · **Trạng thái:** READY · **Baseline Commit:** e82404bdd6b5f4f2ffe6a39aedf9dabac0e617fb · **Research Gate:** RES-14-DEEP-TEST (R0 Internal Framework)
> **Tác giả Nghiệp vụ:** @user-ba · **Tác giả Kỹ thuật:** @antigravity-tl · **Ngày cập nhật:** 2026-10-23
> **Tài liệu Phase chi tiết:** [plan-overview.md](plan-14-deep-test-engine/plan-overview.md) · [Phase 0](plan-14-deep-test-engine/PHASE_0_CONTRACTS_AND_VERIFICATION_MATRIX.md) · [Phase 1](plan-14-deep-test-engine/PHASE_1_RUNTIME_BUG_TRAP_FIXTURE.md) · [Phase 2](plan-14-deep-test-engine/PHASE_2_UI_UX_GEOMETRY_AND_A11Y_ENGINE.md) · [Phase 3](plan-14-deep-test-engine/PHASE_3_DEEP_LOGIC_INVARIANT_GUARDS_AND_STATIC_GATES.md) · [Phase 4](plan-14-deep-test-engine/PHASE_4_AI_SKILL_AND_SCAFFOLD_UPGRADE.md) · [Phase 5](plan-14-deep-test-engine/PHASE_5_REFERENCE_DOGFOODING_AND_CI_GATE.md)

## A. Đặc Tả Nghiệp Vụ (Business Specification)

### A1. Mục tiêu & Bài toán (Goal & Problem Statement)
- **REQ-14-00**: Xây dựng hệ thống kiểm thử chuyên sâu 4 lớp (Runtime Bug-Trap, UI/UX Geometry & A11y, Deep Logic & Security Guards, Static AST Quality Gates + AI Skill/Scaffold) nhằm bắt lỗi ngầm mà kịch bản E2E truyền thống bỏ sót.
- Giải quyết triệt để 4 khoảng trống: (1) Silent runtime failures (`pageerror`, `console.error`, `5xx`), (2) Lỗi thị giác/bố cục (tràn chữ, đè nút, rách bảng responsive, thiếu nhãn A11y), (3) Lỗi logic/bảo mật (double-submit `409`, XSS sink, state reload), (4) Lỗi cấu trúc spec (`toBeDefined()`, thiếu `await` trên custom helper).

### A2. Phạm vi (Scope)
- **In-Scope (`IMP-14-01`)**:
  - **Lộ trình 0 (Phase 0)**: Khóa hợp đồng Fixture Matrix, Canonical Markdown Metadata Schema, Harness `deep-engine.config.ts`, ESLint/TSConfig rules (`R14-01`) và `sync-manifest.json` (`R14-03`, `R14-04`).
  - **Lộ trình 1 (Phase 1)**: Tự động gắn `runtimeTrap` fixture vào `base.fixture.ts` với cơ chế event-loop flush (`R14-08`), redaction, `expectExpectedError` và tự kiểm chứng qua `HM-01`, `HM-02`.
  - **Lộ trình 2 (Phase 2)**: Bộ 7 hàm `ui-checks.ts` dùng retrying (`expect.poll`/`toPass`), tính toán ancestor clipping (`overflow != visible`), kiểm soát visibility nghiêm ngặt (`R14-02`) và tự kiểm chứng qua `HM-03`, `HM-04`, `HM-05`.
  - **Lộ trình 3 (Phase 3)**: Bộ 5 hàm `deep-guards.ts` (`HM-06`, `HM-07`, `HM-08`) + nâng cấp `sources.js` (resolve `extractVerifiedHelperImports` cho `ui-checks`/`deep-guards`, bắt thiếu `await` trên async helpers `R14-05`), `config.js` (`checkDeepCoverage: false` `R14-09`), `commands.js`, `learner.js` & catalogs (`R14-06`).
  - **Lộ trình 4 & 5 (Phase 4 & 5)**: Chuẩn hóa `tools/scaffold`, `.agents/skills/qa-logic-gaps/SKILL.md` (`R14-07`), và dogfooding E2E `REQ-101` (`TC-101-01`..`TC-101-09`) đạt `qa:check` Exit 0 (`R14-10`).
- **Out-of-Scope**: Không thay đổi ứng dụng đích (AUT); không thêm thư viện npm ngoài vào root `package.json`.

### A3. Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)
- **BR-14-01** (kiểm chứng qua **AC-14-01**): Mọi lỗi runtime (`pageerror`, `console.error`, `status >= 500`, request failed) phải làm fail test tại teardown sau khi flush browser event queue, trừ khi được đăng ký tường minh qua `runtimeTrap.allow(...)` có `reason`.
- **BR-14-02** (kiểm chứng qua **AC-14-02**): Mọi kiểm tra hình học/thị giác trong `ui-checks.ts` phải retry qua `expect.poll`/`toPass`, xét giao cắt với mọi scrollable/clipping ancestor, và fail ngay nếu `required` locator ẩn hoặc có `0` phần tử.
- **BR-14-03** (kiểm chứng qua **AC-14-03**): Các hàm bảo vệ logic/bảo mật trong `deep-guards.ts` chỉ tính là đạt khi có bằng chứng nhân quả (mutation network response + DOM state + reload persistence; XSS payload đi vào visible sink mà không kích hoạt sentinel hay tạo phần tử nguy hiểm).
- **BR-14-04** (kiểm chứng qua **AC-14-04**): Bộ phân tích tĩnh `tools/qa` phải nhận diện chính xác lệnh gọi helper từ `support/ui-checks` và `support/deep-guards` (kể cả alias import) làm bằng chứng assertion hợp lệ và bắt lỗi `missing-await` nếu thiếu `await`/`return`/`Promise.all`.
- **BR-14-05** (kiểm chứng qua **AC-14-05**): ESLint (`playwright/eslint.config.mjs`), TSConfig (`playwright/tsconfig.json`) và `sync-manifest.json` phải đồng bộ nguyên tử với harness `deep-engine-tests/` để `npm run verify` và `npm run qa:boundary` luôn đạt Exit 0.

### A4. Điều kiện biên & Luồng lỗi (Edge Cases & Error Flows)
- Trang đóng sớm (`page.isClosed()`) trước teardown: bỏ qua bước `page.evaluate(() => {})` flush nhưng vẫn kiểm tra `records` đã thu thập.
- Locator tùy chọn (`optionalLocators`) không render trên breakpoint hiện tại: cho phép `count() === 0` mà không báo false-positive.
- Requirement có `UI coverage: Exempt (reason: ...)` hoặc `XSS applicability: Not applicable (reason: ...)`: `tools/qa` không trừ điểm coverage.

### A5. Tiêu chí nghiệm thu (Acceptance Criteria — Gherkin)
- **AC-14-01** (gắn **BR-14-01**): *Given* spec dùng `test` từ `base.fixture.ts`, *When* trang ném `pageerror`, `console.error` hoặc HTTP `500` không nằm trong allow-list, *Then* `runtimeTrap` flush hàng đợi sự kiện, đính kèm log đã redact và fail test (`HM-01`, `HM-02`).
- **AC-14-02** (gắn **BR-14-02**): *Given* trang có tràn chữ, đè nút, khuất bởi sticky header/ancestor container hoặc thiếu A11y label, *When* gọi `ui-checks.ts`, *Then* helper retry đến khi hết chuyển động và bắt chính xác lỗi (`HM-03`, `HM-04`, `HM-05`).
- **AC-14-03** (gắn **BR-14-03**): *Given* hành vi double-submit, XSS payload hoặc lưu dữ liệu, *When* gọi `deep-guards.ts`, *Then* helper chặn race condition, chặn XSS execution và xác minh dữ liệu bền vững sau `page.reload()` (`HM-06`, `HM-07`, `HM-08`).
- **AC-14-04** (gắn **BR-14-04**): *Given* spec gọi `expect*` từ `ui-checks`/`deep-guards`, *When* chạy `tools/qa` và `npm run verify`, *Then* `sources.js` ghi nhận `helper:<name>`, bắt thiếu `await`, và `learner.js` đồng bộ `STATIC_RULE_MAPPING`.
- **AC-14-05** (gắn **BR-14-05**): *Given* toàn bộ 6 phase hoàn tất, *When* chạy `npm test`, `npm run verify`, `npm run test:deep-engine` và `npm run qa:check`, *Then* 100% lệnh đạt Exit Code `0`.

### A6. Kịch bản kiểm thử chấp nhận (UAT Scenarios — L3)
- **UAT-14-01** (kiểm chứng **REQ-14-00**, **BR-14-01**..**BR-14-05**): Chạy bộ kiểm chứng `HM-01`..`HM-08` qua `npm run test:deep-engine` trên HTML tĩnh chứa lỗi cố ý và chạy `npm run qa:check` trên bộ mẫu `REQ-101` (`TC-101-01`..`TC-101-09`); toàn bộ lỗi cố ý bị bắt đúng thông điệp và cổng CI đạt Exit 0.

## B. Thiết Kế Kỹ Thuật (Technical Design)

### B1. Kiến trúc & Giải pháp kỹ thuật (Architecture & Technical Decisions)
- **TECH-14-01**: Tách biệt harness `playwright/deep-engine.config.ts` và `playwright/deep-engine-tests/` cho **REQ-14-00** (**IMP-14-01**) vì cần kiểm chứng độc lập `HM-01`..`HM-08` bằng `page.setContent()` mà không làm nhiễu `tools/qa`扫描 `playwright/tests/`.
- **TECH-14-02**: Cấu hình `playwright/eslint.config.mjs` (`assertFunctionNames: ['expect*']`, cho phép title `^HM-[0-9]{2}` trong `deep-engine-tests/`) và `playwright/tsconfig.json` cho **BR-14-05** vì `npm run verify` sẽ báo lỗi lint/typecheck nếu thiếu (`R14-01`).
- **TECH-14-03**: Bổ sung `extractVerifiedHelperImports(fileLines)` trong `tools/qa/lib/sources.js` và cờ `checkDeepCoverage: false` trong `tools/qa/lib/config.js` cho **BR-14-04** nhằm nhận diện chính xác helper imports, bắt `missing-await` và giữ tương thích ngược (`R14-05`, `R14-09`).
- **TECH-14-04**: Chuẩn hóa schema Markdown (`Page exposure`, `UI coverage`, `XSS applicability`, `Coverage notes`, `Capabilities`) đồng nhất giữa Phase 0, `tools/qa`, `tools/scaffold` và `SKILL.md` cho **BR-14-04** để parser không lệch template (`R14-07`).

### B2. File dự kiến tạo mới / sửa đổi (File Inventory & Line Caps)
| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|---|---|---|
| `sync-manifest.json` | Manifest | Modify | 150 | 45 |
| `playwright/package.json` | Manifest | Modify | 150 | 45 |
| `playwright/tsconfig.json` | Config | Modify | 100 | 30 |
| `playwright/eslint.config.mjs` | Config | Modify | 200 | 115 |
| `playwright/deep-engine.config.ts` | Config | Create | 100 | 40 |
| `playwright/tests/fixtures/base.fixture.ts` | Module | Create | 250 | 220 |
| `playwright/tests/fixtures/test-fixtures.ts` | Module | Modify | 250 | 60 |
| `playwright/tests/support/ui-checks.ts` | Module | Modify | 250 | 240 |
| `playwright/tests/support/deep-guards.ts` | Module | Create | 250 | 210 |
| `playwright/deep-engine-tests/hm-contracts.spec.ts` | Test | Create | 800 | 120 |
| `playwright/deep-engine-tests/runtime-trap.spec.ts` | Test | Create | 800 | 140 |
| `playwright/deep-engine-tests/ui-checks.spec.ts` | Test | Create | 800 | 260 |
| `playwright/deep-engine-tests/deep-guards.spec.ts` | Test | Create | 800 | 220 |
| `tools/qa/lib/config.js` | Module | Modify | 250 | 135 |
| `tools/qa/lib/parser.js` | Module | Modify | 250 | 245 |
| `tools/qa/lib/sources.js` | Module | Modify | 250 | 248 |
| `tools/qa/lib/commands.js` | Module | Modify | 250 | 248 |
| `tools/qa/lib/learner.js` | Module | Modify | 250 | 235 |
| `tools/qa/lib/commands.test.js` | Test | Modify | 800 | 720 |
| `tools/qa/lib/sources.test.js` | Test | Modify | 800 | 520 |
| `tools/scaffold/template.js` | Module | Modify | 250 | 220 |
| `tools/scaffold/scaffold.test.js` | Test | Modify | 800 | 240 |
| `.agents/skills/qa-logic-gaps/SKILL.md` | Skill | Modify | 250 | 195 |
| `playwright/tests/auth/login.spec.ts` | Test | Modify | 800 | 240 |

### B3. Hợp đồng giao diện / Schema (Contracts & Schemas)
- **Canonical Requirement Metadata**: `- **Page exposure**: Public | Authenticated`, `- **UI coverage**: Required | Exempt (reason: <text>)`, `- **XSS applicability**: Applicable | Not applicable (reason: <text>)`, bảng `## Coverage notes` (`| Aspect | Status | Notes |`), và TC `- **Capabilities**: <csv>`.
- **Verified Helper Imports**: Chỉ chấp nhận các hàm `expect*` import từ module kết thúc bằng `support/ui-checks` hoặc `support/deep-guards`, ghi nhận vào `assertionProfile.matchers` dưới dạng `helper:<canonicalName>`.

### B4. Dependencies mới (New Dependencies)
- Zero external npm runtime dependency; chỉ khai báo npm scripts nội bộ (`test:deep-engine`) trong `playwright/package.json` và giữ nguyên root `package.json` (tham chiếu **IMP-14-01**, **RES-14-DEEP-TEST**).

## C. Ma Trận Truy Vết (Traceability Matrix — REQ ↔ AC ↔ TC ↔ File)
| REQ / BR | AC | TC | File Test Dự Kiến | File Impl Dự Kiến |
|---|---|---|---|---|
| REQ-14-00 | AC-14-01 | TC-14-01 | `playwright/deep-engine-tests/runtime-trap.spec.ts` | `playwright/src/fixtures/base.fixture.ts` |
| BR-14-01 | AC-14-01 | TC-14-02 | `playwright/deep-engine-tests/hm-contracts.spec.ts` | `playwright/deep-engine.config.ts` |
| BR-14-02 | AC-14-02 | TC-14-03 | `playwright/deep-engine-tests/ui-checks.spec.ts` | `playwright/src/support/ui-checks.ts` |
| BR-14-03 | AC-14-03 | TC-14-04 | `playwright/deep-engine-tests/deep-guards.spec.ts` | `playwright/src/support/deep-guards.ts` |
| BR-14-04 | AC-14-04 | TC-14-05 | `tools/qa/lib/sources.test.js` | `tools/qa/lib/sources.js` |
| BR-14-04 | AC-14-04 | TC-14-06 | `tools/qa/lib/commands.test.js` | `tools/qa/lib/commands.js` |
| BR-14-05 | AC-14-05 | TC-14-07 | `tools/scaffold/scaffold.test.js` | `tools/scaffold/template.js` |
| BR-14-05 | AC-14-05 | TC-14-08 | `playwright/tests/auth/login.spec.ts` | `playwright/eslint.config.mjs` |

## D. Tiêu Chí Nghiệm Thu Tổng (Exit Gate)
- [x] `python .master_process/master.py plan-check _Plan_implement/14_DEEP_LOGIC_AND_UI_UX_BUG_HUNTING_FRAMEWORK_PLAN.md` đạt `Exit 0 — PLAN-CHECK: PASS`.
- [x] `python .master_process/master.py plan-check _Plan_implement/plan-14-deep-test-engine/plan-overview.md` đạt `Exit 0 — PLAN-CHECK: PASS (6 phase(s) checked)`.
- [x] Sau khi implement: `npm test`, `npm --prefix playwright run verify`, `npm --prefix playwright run test:deep-engine`, và `npm run qa:check` đều đạt Exit Code `0`.

## E. Câu Hỏi Mở (Open Questions)
- Hiện có **0 câu hỏi chặn** (zero blocking questions). Toàn bộ 10 điểm rà soát kiến trúc (`R14-01`..`R14-10`) đã được chốt hợp đồng kỹ thuật chi tiết trong Phase 0..Phase 5.

## F. Kế Hoạch Rollback & Rủi Ro (Risk & Rollback)
- **Rủi ro 1 (`playwright/verify` vỡ do custom helper/HM title)**: Khắc phục ngay từ Phase 0 bằng cách cập nhật `playwright/eslint.config.mjs` và `playwright/tsconfig.json` trước khi viết spec.
- **Rủi ro 2 (False-positive từ cổng mới trên dự án cũ)**: Cờ `checkDeepCoverage` mặc định `false` trong `tools/qa/lib/config.js`; khi `false`, chỉ cảnh báo (`WARN`) thay vì chặn (`ERROR`). Rollback bằng cách đặt `checkDeepCoverage: false` hoặc revert từng module độc lập.

## G. Ký Duyệt Trước Thực Thi (Pre-Execution Sign-off)
- [x] **Nghiệp vụ soát bởi:** @user-ba — **Ngày:** 2026-10-23 — **Trạng thái:** APPROVED ✔
- [x] **Kỹ thuật soát bởi:** @antigravity-tl — **Ngày:** 2026-10-23 — **Trạng thái:** APPROVED ✔

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Log — PDR)
| PDR ID | Hạng mục & File liên quan | Lý do cập nhật | Trạng thái |
|---|---|---|---|
| PDR-14-00 | Baseline & Phase 0..5 working-tree (`package.json`, `.agents/skills/qa-logic-gaps/SKILL.md`, `.github/copilot-instructions.md`, `tools/qa/README.md`, `tools/qa/index.js`, `tools/qa/lib/commands.js`, `tools/qa/lib/commands.test.js`, `tools/qa/lib/sources.js`, `tools/qa/lib/sources.test.js`, `playwright/tests/pages/login.page.ts`, `requirements/REQ-001-sign-in.md`, `test-cases/REQ-001-sign-in.md`, `test-cases/traceability.md`) | Ghi nhận các file đang thay đổi từ Plan 13 và Phase 0..5 trong working tree trên baseline `e82404bdd6b5f4f2ffe6a39aedf9dabac0e617fb` | APPROVED |
| PDR-14-01 | Giải quyết 10 findings `R14-01`..`R14-10` (`playwright/eslint.config.mjs`, `playwright/tsconfig.json`, `tools/qa/lib/config.js`, `tools/qa/lib/learner.js`, `sync-manifest.json`) | Đồng bộ hợp đồng Retrying/Clipping, AST Helper Resolution, ESLint/TSConfig, Learner Catalog và Schema chuẩn P1–P7 | APPROVED |

## I. Lịch Sử Phiên Bản (Version History)
- **v1.0 (2026-10-22)**: Bản khởi tạo kế hoạch 5 phase.
- **v1.1 (2026-10-23)**: Bổ sung Phase 0 (`HM-01`..`HM-08`), Fixture Matrix, Retrying Geometry & Causality Guards.
- **v1.2 (2026-10-23)**: Giải quyết toàn diện `R14-01`..`R14-10` và chuẩn hóa cấu trúc Master Process P1–P7 đạt 10/10 (`PLAN-CHECK: PASS`).
