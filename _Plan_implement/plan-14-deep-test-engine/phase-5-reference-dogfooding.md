# Phase 5: Reference Dogfooding (`REQ-101`), Traceability & Final CI Gate

> **Cấp độ:** L3 · **Trạng thái:** READY · **Baseline Commit:** e82404bdd6b5f4f2ffe6a39aedf9dabac0e617fb · **Research Gate:** RES-14-DEEP-TEST (R0 Internal Framework)
> **Tác giả Nghiệp vụ:** @user-ba · **Tác giả Kỹ thuật:** @antigravity-tl · **Ngày cập nhật:** 2026-10-23

## A. Đặc Tả Nghiệp Vụ (Business Specification)

### A1. Mục tiêu & Bài toán (Goal & Problem Statement)
- **REQ-14-P5**: Áp dụng thực chiến (dogfooding) toàn bộ bộ công cụ của Phase 0..Phase 4 vào luồng chuẩn `REQ-101` (Đăng nhập) mở rộng lên 9 tiêu chí (`TC-101-01`..`TC-101-09`) trong `playwright/tests/auth/login.spec.ts`, đồng thời khóa toàn bộ cổng kiểm định CI (`npm test`, `verify`, `test:deep-engine`, `qa:check`).

### A2. Phạm vi (Scope)
- **In-Scope (`IMP-14-01`)**: Nâng cấp `requirements/REQ-101-login.md`, `test-cases/TC-101-login.md`, `playwright/src/pages/login.page.ts`, `playwright/tests/auth/login.spec.ts`, cập nhật `test-cases/traceability.md` (`R14-10`) và xác nhận toàn bộ lệnh kiểm định đạt Exit Code `0`.
- **Out-of-Scope**: Viết thêm requirement nghiệp vụ ngoài `REQ-101`.

### A3. Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)
- **BR-14-P5-01** (kiểm chứng qua **AC-14-P5-01**): `requirements/REQ-101-login.md` phải khai báo đầy đủ Canonical Metadata (`Page exposure: Public`, `UI coverage: Required`, `XSS applicability: Applicable`), bảng `## Coverage notes`, và 4 tiêu chí mới (`AC-6` UI Geometry & A11y, `AC-7` Multi-Viewport Responsive, `AC-8` Double-Submit Idempotency, `AC-9` XSS Safe Error Rendering).
- **BR-14-P5-02** (kiểm chứng qua **AC-14-P5-02**): `test-cases/TC-101-login.md` phải định nghĩa đầy đủ `TC-101-06`..`TC-101-09` kèm dòng `- **Capabilities**: ...` khớp với các hàm kiểm chứng trong `playwright/tests/auth/login.spec.ts`.
- **BR-14-P5-03** (kiểm chứng qua **AC-14-P5-03**): `playwright/tests/auth/login.spec.ts` phải hiện thực đầy đủ `TC-101-01`..`TC-101-09` hoàn chỉnh (không gắn `@wip`), sử dụng đúng các hàm từ `support/ui-checks` và `support/deep-guards` với đầy đủ `await`.
- **BR-14-P5-04** (kiểm chứng qua **AC-14-P5-04**): Ma trận truy vết tại `test-cases/traceability.md` (`R14-10`) phải được cập nhật tự động qua `npm run qa:matrix`, và toàn bộ 4 cổng (`npm test`, `npm --prefix playwright run verify`, `npm --prefix playwright run test:deep-engine`, `npm run qa:check`) phải đạt Exit Code `0`.

### A4. Điều kiện biên & Luồng lỗi (Edge Cases & Error Flows)
- Logo thương hiệu (`loginPage.brandLogo`) có thể ẩn trên màn hình mobile `320px`: truyền vào `optionalLocators: [loginPage.brandLogo]` trong `expectResponsiveIntegrity`, trong khi `usernameInput`, `passwordInput`, `submitButton` nằm trong `requiredLocators`.
- Khi chạy `npm run qa:check -- --strict` (hoặc bật `checkDeepCoverage: true`): `REQ-101` phải đạt `0` lỗi và `0` cảnh báo.

### A5. Tiêu chí nghiệm thu (Acceptance Criteria — Gherkin)
- **AC-14-P5-01** (gắn **BR-14-P5-01**): *Given* `requirements/REQ-101-login.md` được nâng cấp lên 9 AC, *When* chạy `npm run qa:coverage`, *Then* `REQ-101` hiển thị độ phủ `9/9 AC (100%)`.
- **AC-14-P5-02** (gắn **BR-14-P5-02**): *Given* `test-cases/TC-101-login.md` có `TC-101-01`..`TC-101-09`, *When* chạy `npm run qa:drift`, *Then* không có bất kỳ độ lệch liên kết nào giữa REQ, TC và Spec.
- **AC-14-P5-03** (gắn **BR-14-P5-03**): *Given* `playwright/tests/auth/login.spec.ts` chứa 9 bài test sử dụng `ui-checks` và `deep-guards`, *When* chạy `npm --prefix playwright run verify`, *Then* TypeScript, ESLint và `playwright test --list` liệt kê đủ 27 lượt chạy (9 test x 3 trình duyệt) với Exit Code `0`.
- **AC-14-P5-04** (gắn **BR-14-P5-04**): *Given* toàn bộ codebase sau khi hoàn tất 6 phase, *When* chạy `npm test`, `npm --prefix playwright run test:deep-engine`, `npm run qa:matrix` và `npm run qa:check`, *Then* tất cả đều đạt Exit Code `0` (`Health Score = 100/100`).

### A6. Kịch bản kiểm thử chấp nhận (UAT Scenarios — L3)
- **UAT-14-P5-01** (kiểm chứng **REQ-14-P5**, **BR-14-P5-01**..**BR-14-P5-04**): Chạy chuỗi lệnh nghiệm thu tổng thể (`npm test && npm --prefix playwright run verify && npm --prefix playwright run test:deep-engine && npm run qa:matrix && npm run qa:check`) đạt Exit Code `0` tuyệt đối.

## B. Thiết Kế Kỹ Thuật (Technical Design)

### B1. Kiến trúc & Giải pháp kỹ thuật (Architecture & Technical Decisions)
- **TECH-14-P5-01**: Mở rộng `playwright/src/pages/login.page.ts` và `playwright/tests/auth/login.spec.ts` cho **REQ-14-P5** (**IMP-14-01**) vì cần một mẫu chuẩn (Gold Standard Reference) chứng minh toàn bộ 4 lớp bảo vệ hoạt động nhịp nhàng cùng nhau.
- **TECH-14-P5-02**: Chuẩn hóa đường dẫn `test-cases/traceability.md` khi chạy `npm run qa:matrix` cho **BR-14-P5-04** nhằm tránh lệch đường dẫn tài liệu gốc (`R14-10`).

### B2. File dự kiến tạo mới / sửa đổi (File Inventory & Line Caps)
| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|---|---|---|
| `requirements/REQ-001-sign-in.md` | Doc | Modify | 250 | 150 |
| `test-cases/REQ-001-sign-in.md` | Doc | Modify | 250 | 220 |
| `test-cases/traceability.md` | Doc | Modify | 250 | 80 |
| `playwright/tests/pages/login.page.ts` | Module | Modify | 250 | 40 |
| `playwright/tests/auth/login.spec.ts` | Test | Modify | 800 | 240 |

### B3. Hợp đồng giao diện / Schema (Contracts & Schemas)
- **4 kịch bản kiểm thử chuyên sâu bổ sung vào `playwright/tests/auth/login.spec.ts`**:
  - `TC-101-06 - AC-6 bo cuc form dang nhap khong tran chu, khong de nut, khong bi che khuat va dat chuan A11y @p1 @visual`
  - `TC-101-07 - AC-7 giao dien dang nhap hien thi nguyen ven tren mobile 320px, tablet 768px va desktop 1280px @p2 @visual`
  - `TC-101-08 - AC-8 chong double-submit khi click lien tiep vao nut dang nhap @p1 @edge`
  - `TC-101-09 - AC-9 escape an toan chuoi XSS va ky tu dac biet trong thong bao loi dang nhap @p1 @security`

### B4. Dependencies mới (New Dependencies)
- Zero external npm runtime dependency; sử dụng toàn bộ module nội bộ đã xây dựng ở Phase 0..Phase 4 và giữ nguyên root `package.json` (tham chiếu **IMP-14-01**, **RES-14-DEEP-TEST**).

## C. Ma Trận Truy Vết (Traceability Matrix — REQ ↔ AC ↔ TC ↔ File)
| REQ / BR | AC | TC | File Test Dự Kiến | File Impl Dự Kiến |
|---|---|---|---|---|
| REQ-14-P5 | AC-14-P5-01 | TC-14-P5-01 | `playwright/tests/auth/login.spec.ts` | `requirements/REQ-101-login.md` |
| BR-14-P5-01 | AC-6, AC-7, AC-8, AC-9 | TC-101-06..TC-101-09 | `playwright/tests/auth/login.spec.ts` | `requirements/REQ-101-login.md` |
| BR-14-P5-02 | AC-14-P5-02 | TC-14-P5-03 | `playwright/tests/auth/login.spec.ts` | `test-cases/TC-101-login.md` |
| BR-14-P5-03 | AC-14-P5-03 | TC-14-P5-04 | `playwright/tests/auth/login.spec.ts` | `playwright/src/pages/login.page.ts` |
| BR-14-P5-04 | AC-14-P5-04 | TC-14-P5-05 | `playwright/tests/auth/login.spec.ts` | `test-cases/traceability.md` |

## D. Tiêu Chí Nghiệm Thu Tổng (Exit Gate)
- [x] `python .master_process/master.py plan-check` đạt `Exit 0 — PLAN-CHECK: PASS`.
- [x] `npm test`, `npm --prefix playwright run verify`, `npm --prefix playwright run test:deep-engine`, `npm run qa:matrix`, `npm run qa:check` đều đạt Exit Code `0`.

## E. Câu Hỏi Mở (Open Questions)
- Hiện có **0 câu hỏi chặn** (zero blocking questions). Toàn bộ 6 phase của Plan 14 đã hoàn chỉnh và khép kín.

## F. Kế Hoạch Rollback & Rủi Ro (Risk & Rollback)
- Nếu cần quay lui phần mẫu `REQ-101`, chỉ cần revert `requirements/REQ-101-login.md`, `test-cases/TC-101-login.md`, `playwright/tests/auth/login.spec.ts` và chạy lại `npm run qa:matrix`.

## G. Ký Duyệt Trước Thực Thi (Pre-Execution Sign-off)
- [x] **Nghiệp vụ soát bởi:** @user-ba — **Ngày:** 2026-10-23 — **Trạng thái:** APPROVED ✔
- [x] **Kỹ thuật soát bởi:** @antigravity-tl — **Ngày:** 2026-10-23 — **Trạng thái:** APPROVED ✔

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Log — PDR)
| PDR ID | Hạng mục & File liên quan | Lý do cập nhật | Trạng thái |
|---|---|---|---|
| PDR-14-00 | Baseline & Phase 0..4 working-tree (`package.json`, `.agents/skills/qa-logic-gaps/SKILL.md`, `.github/copilot-instructions.md`, `tools/qa/README.md`, `tools/qa/index.js`, `tools/qa/lib/config.js`, `tools/qa/lib/commands.js`, `tools/qa/lib/commands.test.js`, `tools/qa/lib/sources.js`, `tools/qa/lib/sources.test.js`, `sync-manifest.json`, `playwright/package.json`, `playwright/tsconfig.json`, `playwright/eslint.config.mjs`, `playwright/tests/fixtures/test-fixtures.ts`, `playwright/tests/support/ui-checks.ts`) | Ghi nhận các file đang thay đổi từ Plan 13 và Phase 0..4 trên baseline `e82404bdd6b5f4f2ffe6a39aedf9dabac0e617fb` | APPROVED |
| PDR-14-P5 | Chuẩn hóa đường dẫn `test-cases/traceability.md` (`R14-10`) và chuyển việc tạo `sync-manifest.json` + `deep-engine.config.ts` về Phase 0 (`R14-03`, `R14-04`) | Đảm bảo không lỗi boundary ở các phase trước và khớp đường dẫn thực tế của dự án | APPROVED |

## I. Lịch Sử Phiên Bản (Version History)
- **v1.0 (2026-10-22)**: Bản khởi tạo Phase 5.
- **v1.1 (2026-10-23)**: Bổ sung `optionalLocators` cho `REQ-101` và ma trận nghiệm thu cuối.
- **v1.2 (2026-10-23)**: Chuẩn hóa `test-cases/traceability.md` (`R14-10`) và đạt chuẩn P1–P7 (`PLAN-CHECK: PASS`).
