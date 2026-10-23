# Phase 4: AI Skill, Copilot Instructions & Scaffold Generator Upgrade

> **Cấp độ:** L3 · **Trạng thái:** READY · **Baseline Commit:** e82404bdd6b5f4f2ffe6a39aedf9dabac0e617fb · **Research Gate:** RES-14-DEEP-TEST (R0 Internal Framework)
> **Tác giả Nghiệp vụ:** @user-ba · **Tác giả Kỹ thuật:** @antigravity-tl · **Ngày cập nhật:** 2026-10-23

## A. Đặc Tả Nghiệp Vụ (Business Specification)

### A1. Mục tiêu & Bài toán (Goal & Problem Statement)
- **REQ-14-P4**: Nâng cấp bộ não AI (`.agents/skills/qa-logic-gaps/SKILL.md`, `.github/copilot-instructions.md`, catalogs) và bộ khung sinh mã tự động (`tools/scaffold/template.js`) để mọi tính năng mới sinh ra mặc định có đủ 6 trụ cột kiểm thử chuyên sâu.

### A2. Phạm vi (Scope)
- **In-Scope (`IMP-14-01`)**: Cập nhật `tools/scaffold/template.js` và `tools/scaffold/scaffold.test.js` theo đúng Canonical Schema của Phase 0 (`R14-07`) và chữ ký hàm của Phase 2/3 (`R14-02`), cập nhật `.agents/skills/qa-logic-gaps/SKILL.md`, `bug-hunting-heuristics.md`, `anti-pattern-catalog.md` (`R14-06`) và `.github/copilot-instructions.md`.
- **Out-of-Scope**: Thay đổi giao diện dòng lệnh `tools/scaffold/index.js` ngoài việc cập nhật nội dung mẫu sinh ra.

### A3. Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)
- **BR-14-P4-01** (kiểm chứng qua **AC-14-P4-01**): `renderRequirementTemplate` và `renderTestCaseTemplate` trong `tools/scaffold/template.js` phải sinh đúng 100% cú pháp Canonical Metadata của Phase 0 (`Page exposure`, `UI coverage`, `XSS applicability`, bảng `## Coverage notes`, và `- **Capabilities**: ...` trong TC) (`R14-07`).
- **BR-14-P4-02** (kiểm chứng qua **AC-14-P4-02**): `renderSpecTemplate` trong `tools/scaffold/template.js` phải sinh sẵn 6 bài test khung (`TC-xxx-01`..`TC-xxx-06`) sử dụng đúng chữ ký hàm v1.2 (`expectResponsiveIntegrity` với `requiredLocators`/`optionalLocators`, `expectSafeXssRender` với `sinkLocator`, `expectIdempotentSubmit`) (`R14-02`).
- **BR-14-P4-03** (kiểm chứng qua **AC-14-P4-03**): Danh mục `bug-hunting-heuristics.md` và `anti-pattern-catalog.md` phải gắn thẻ metadata `<!-- rule-meta: ... -->` khớp với `STATIC_RULE_MAPPING` trong `tools/qa/lib/learner.js` (`R14-06`).
- **BR-14-P4-04** (kiểm chứng qua **AC-14-P4-04**): `.agents/skills/qa-logic-gaps/SKILL.md` phải hướng dẫn quy trình rà soát 5 chiều (Functional, Deep Logic/Race, UI/UX Geometry & A11y, Security & Boundary, Spec Quality) và bảng ánh xạ triệu chứng sang hàm trong `ui-checks.ts` / `deep-guards.ts`.

### A4. Điều kiện biên & Luồng lỗi (Edge Cases & Error Flows)
- Chạy `npm run qa:scaffold` ở chế độ forward (sinh mới REQ/TC/Spec) hoặc reverse (từ spec có sẵn): cả hai chế độ đều giữ nguyên khả năng tương thích với các bài unit test hiện có trong `tools/scaffold/scaffold.test.js`.
- Spec mới sinh ở trạng thái `@wip`: vẫn vượt qua `npm --prefix playwright run verify` (không vi phạm lint/typecheck) trước khi lập trình viên điền selector thật.

### A5. Tiêu chí nghiệm thu (Acceptance Criteria — Gherkin)
- **AC-14-P4-01** (gắn **BR-14-P4-01**): *Given* chạy `renderRequirementTemplate({ reqId: 'REQ-200', slug: 'checkout', title: 'Checkout' })`, *When* `tools/qa/lib/parser.js` đọc nội dung vừa sinh, *Then* trích xuất đúng `pageExposure: 'Authenticated'`, `uiCoverage: 'Required'`, `xssApplicability: 'Applicable'` và đủ 4 hàng trong `coverageNotes`.
- **AC-14-P4-02** (gắn **BR-14-P4-02**): *Given* chạy `renderSpecTemplate`, *When* kiểm tra nội dung TypeScript sinh ra, *Then* có đủ import từ `support/ui-checks`, `support/deep-guards` và truyền đúng tham số `{ requiredLocators, optionalLocators }` và `{ sinkLocator }`.
- **AC-14-P4-03** (gắn **BR-14-P4-03**): *Given* các rule `DH-05` và `PA-04` trong catalog, *When* chạy `npm test`, *Then* bài kiểm thử `learner.js` trong `tools/qa/lib/commands.test.js` xác nhận trạng thái rule khớp 100%.
- **AC-14-P4-04** (gắn **BR-14-P4-04**): *Given* tài liệu `SKILL.md` và `.github/copilot-instructions.md`, *When* đối chiếu với Phase 0..Phase 3, *Then* mọi tên hàm và quy tắc đều nhất quán tuyệt đối.

### A6. Kịch bản kiểm thử chấp nhận (UAT Scenarios — L3)
- **UAT-14-P4-01** (kiểm chứng **REQ-14-P4**, **BR-14-P4-01**..**BR-14-P4-04**): Chạy `node --test tools/scaffold/scaffold.test.js` và `npm test` đạt Pass 100%.

## B. Thiết Kế Kỹ Thuật (Technical Design)

### B1. Kiến trúc & Giải pháp kỹ thuật (Architecture & Technical Decisions)
- **TECH-14-P4-01**: Đồng bộ hóa mẫu sinh trong `tools/scaffold/template.js` với parser của `tools/qa/lib/parser.js` cho **BR-14-P4-01** (**IMP-14-01**) vì bất kỳ độ lệch cú pháp nào giữa scaffold và parser đều gây lỗi `qa:gaps` ngay sau khi tạo file (`R14-07`).
- **TECH-14-P4-02**: Cập nhật mẫu spec trong `tools/scaffold/template.js` dùng đúng hợp đồng `requiredLocators`/`optionalLocators` và `sinkLocator` cho **BR-14-P4-02** nhằm loại bỏ hoàn toàn mẫu code v1.0 cũ (`R14-02`).
- **TECH-14-P4-03**: Chuẩn hóa `bug-hunting-heuristics.md`, `anti-pattern-catalog.md` và `SKILL.md` cho **BR-14-P4-03**, **BR-14-P4-04** để AI Agent và `qa:learn` sử dụng chung một nguồn tri thức (`R14-06`).

### B2. File dự kiến tạo mới / sửa đổi (File Inventory & Line Caps)
| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|---|---|---|
| `tools/scaffold/template.js` | Module | Modify | 250 | 220 |
| `tools/scaffold/scaffold.test.js` | Test | Modify | 800 | 240 |
| `.agents/skills/qa-logic-gaps/SKILL.md` | Skill | Modify | 250 | 195 |
| `.agents/skills/qa-logic-gaps/references/bug-hunting-heuristics.md` | Doc | Modify | 250 | 160 |
| `.agents/skills/qa-logic-gaps/references/anti-pattern-catalog.md` | Doc | Modify | 250 | 160 |
| `.github/copilot-instructions.md` | Doc | Modify | 250 | 210 |

### B3. Hợp đồng giao diện / Schema (Contracts & Schemas)
- **6 trụ cột mặc định do `tools/scaffold/template.js` sinh ra**:
  - `AC-1` / `TC-xxx-01` (`@smoke @p0`): Happy Path & State Persistence (`expectStatePersistence`).
  - `AC-2` / `TC-xxx-02` (`@p1 @negative`): Validation & Boundary Rejection (`expectBoundaryRejected`).
  - `AC-3` / `TC-xxx-03` (`@p1 @edge`): Idempotent Double-Submit (`expectIdempotentSubmit`).
  - `AC-4` / `TC-xxx-04` (`@p1 @visual`): UI/UX Geometry, Occlusion & A11y (`expectNoHorizontalScroll`, `expectNoTextOverflow`, `expectNotOccluded`, `expectInteractiveA11y`).
  - `AC-5` / `TC-xxx-05` (`@p2 @visual`): Multi-Viewport Responsive (`expectResponsiveIntegrity` với `requiredLocators` và `optionalLocators`).
  - `AC-6` / `TC-xxx-06` (`@p1 @security`): XSS Safe Rendering (`expectSafeXssRender` với `{ sinkLocator }`).

### B4. Dependencies mới (New Dependencies)
- Zero external npm runtime dependency; chỉ cập nhật template string trong `tools/scaffold/template.js` và tài liệu Markdown, giữ nguyên root `package.json` (tham chiếu **IMP-14-01**, **RES-14-DEEP-TEST**).

## C. Ma Trận Truy Vết (Traceability Matrix — REQ ↔ AC ↔ TC ↔ File)
| REQ / BR | AC | TC | File Test Dự Kiến | File Impl Dự Kiến |
|---|---|---|---|---|
| REQ-14-P4 | AC-14-P4-01 | TC-14-P4-01 | `tools/scaffold/scaffold.test.js` | `tools/scaffold/template.js` |
| BR-14-P4-01 | AC-14-P4-01 | TC-14-P4-02 | `tools/scaffold/scaffold.test.js` | `tools/scaffold/template.js` |
| BR-14-P4-02 | AC-14-P4-02 | TC-14-P4-03 | `tools/scaffold/scaffold.test.js` | `tools/scaffold/template.js` |
| BR-14-P4-03 | AC-14-P4-03 | TC-14-P4-04 | `tools/scaffold/scaffold.test.js` | `.agents/skills/qa-logic-gaps/references/anti-pattern-catalog.md` |
| BR-14-P4-04 | AC-14-P4-04 | TC-14-P4-05 | `tools/scaffold/scaffold.test.js` | `.agents/skills/qa-logic-gaps/SKILL.md` |

## D. Tiêu Chí Nghiệm Thu Tổng (Exit Gate)
- [x] `python .master_process/master.py plan-check` đạt `Exit 0 — PLAN-CHECK: PASS`.
- [ ] `node --test tools/scaffold/scaffold.test.js` và `npm test` đạt Exit Code `0`.

## E. Câu Hỏi Mở (Open Questions)
- Hiện có **0 câu hỏi chặn** (zero blocking questions). Cú pháp template giữa Phase 0, Phase 3 và Phase 4 đã thống nhất 100%.

## F. Kế Hoạch Rollback & Rủi Ro (Risk & Rollback)
- Thay đổi chỉ nằm ở template sinh mới và tài liệu hướng dẫn AI; có thể revert độc lập `tools/scaffold/template.js` mà không ảnh hưởng tới các spec hiện hữu.

## G. Ký Duyệt Trước Thực Thi (Pre-Execution Sign-off)
- [x] **Nghiệp vụ soát bởi:** @user-ba — **Ngày:** 2026-10-23 — **Trạng thái:** APPROVED ✔
- [x] **Kỹ thuật soát bởi:** @antigravity-tl — **Ngày:** 2026-10-23 — **Trạng thái:** APPROVED ✔

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Log — PDR)
| PDR ID | Hạng mục & File liên quan | Lý do cập nhật | Trạng thái |
|---|---|---|---|
| PDR-14-00 | Baseline & Phase 0..5 working-tree (`package.json`, `.agents/skills/qa-logic-gaps/SKILL.md`, `tools/qa/README.md`, `tools/qa/index.js`, `tools/qa/lib/config.js`, `tools/qa/lib/commands.js`, `tools/qa/lib/commands.test.js`, `tools/qa/lib/sources.js`, `tools/qa/lib/sources.test.js`, `sync-manifest.json`, `playwright/package.json`, `playwright/tsconfig.json`, `playwright/eslint.config.mjs`, `playwright/tests/fixtures/test-fixtures.ts`, `playwright/tests/support/ui-checks.ts`, `playwright/tests/auth/login.spec.ts`, `playwright/tests/pages/login.page.ts`, `requirements/REQ-001-sign-in.md`, `test-cases/REQ-001-sign-in.md`, `test-cases/traceability.md`) | Ghi nhận các file đang thay đổi từ Plan 13 và Phase 0..5 trên baseline `e82404bdd6b5f4f2ffe6a39aedf9dabac0e617fb` | APPROVED |
| PDR-14-P4 | Khóa chặt cú pháp Canonical Schema (`R14-07`) và chữ ký hàm v1.2 (`R14-02`) trong `tools/scaffold/template.js` | Triệt tiêu độ lệch giữa code sinh tự động và bộ parser `tools/qa` | APPROVED |

## I. Lịch Sử Phiên Bản (Version History)
- **v1.0 (2026-10-22)**: Bản khởi tạo Phase 4.
- **v1.1 (2026-10-23)**: Bổ sung 6 trụ cột kiểm thử vào `tools/scaffold/template.js`.
- **v1.2 (2026-10-23)**: Đồng bộ tuyệt đối Canonical Schema (`R14-07`), chữ ký hàm (`R14-02`), catalog metadata (`R14-06`) và chuẩn P1–P7.
