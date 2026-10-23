# Phase 0: Hợp Đồng Nền Tảng, Schema Chuẩn & Ma Trận Kiểm Chứng (`HM-01`..`HM-08`)

> **Cấp độ:** L3 · **Trạng thái:** READY · **Baseline Commit:** e82404bdd6b5f4f2ffe6a39aedf9dabac0e617fb · **Research Gate:** RES-14-DEEP-TEST (R0 Internal Framework)
> **Tác giả Nghiệp vụ:** @user-ba · **Tác giả Kỹ thuật:** @antigravity-tl · **Ngày cập nhật:** 2026-10-23

## A. Đặc Tả Nghiệp Vụ (Business Specification)

### A1. Mục tiêu & Bài toán (Goal & Problem Statement)
- **REQ-14-P0**: Thiết lập hợp đồng nền tảng (Single Source of Truth) cho toàn bộ 5 phase tiếp theo: Fixture Ownership Matrix, Canonical Markdown Schema, Harness `deep-engine.config.ts`, cấu hình ESLint/TSConfig (`R14-01`) và phân loại `sync-manifest.json` (`R14-03`, `R14-04`).

### A2. Phạm vi (Scope)
- **In-Scope (`IMP-14-01`)**: Khóa giao diện fixture, cú pháp metadata chuẩn giữa `tools/qa` và `tools/scaffold`, cấu hình chạy độc lập `playwright/deep-engine-tests/` bằng `page.setContent()`, và ma trận 8 bài test đột biến `HM-01`..`HM-08`.
- **Out-of-Scope**: Logic chi tiết bên trong `ui-checks.ts` (Phase 2) và `deep-guards.ts` (Phase 3).

### A3. Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)
- **BR-14-P0-01** (kiểm chứng qua **AC-14-P0-01**): Mọi fixture trong `base.fixture.ts` phải tuân thủ đúng vòng đời và phạm vi sở hữu; chỉ `runtimeTrap` được phép đặt `{ auto: true }`.
- **BR-14-P0-02** (kiểm chứng qua **AC-14-P0-02**): `playwright/eslint.config.mjs` phải cấu hình `assertFunctionPatterns: ['^expect[A-Z]']` cho `playwright/expect-expect` và cho phép mẫu tiêu đề `^HM-[0-9]{2} - .+` trong `deep-engine-tests/**/*.spec.ts`; `playwright/tsconfig.json` phải bao gồm `deep-engine.config.ts` và `deep-engine-tests/**/*.ts` (`R14-01`).
- **BR-14-P0-03** (kiểm chứng qua **AC-14-P0-03**): Việc tạo `playwright/deep-engine.config.ts`, `playwright/deep-engine-tests/` và khai báo vào `sync-manifest.json` phải diễn ra nguyên tử trong cùng một bước để `npm run qa:boundary` không bao giờ báo `path-khong-ton-tai` hoặc `chua-phan-loai` (`R14-03`, `R14-04`).
- **BR-14-P0-04** (kiểm chứng qua **AC-14-P0-04**): Cú pháp Markdown cho `Page exposure`, `UI coverage`, `XSS applicability`, bảng `Coverage notes` và TC `Capabilities` phải thống nhất tuyệt đối giữa parser (`Phase 3`) và template (`Phase 4`) (`R14-07`).

### A4. Điều kiện biên & Luồng lỗi (Edge Cases & Error Flows)
- Chạy `npm run test:deep-engine` khi không có `.env` hoặc không có app server: phải chạy xanh 100% nhờ dữ liệu HTML tĩnh qua `page.setContent()` và `page.route()`.
- Chạy `npm run qa:check`: công cụ `tools/qa` chỉ quét `playwright/tests/`, tuyệt đối không báo orphan/traceability gap trên `playwright/deep-engine-tests/`.

### A5. Tiêu chí nghiệm thu (Acceptance Criteria — Gherkin)
- **AC-14-P0-01** (gắn **BR-14-P0-01**): *Given* bảng Fixture Ownership Matrix, *When* khởi tạo test bất kỳ, *Then* `runtimeTrap` tự kích hoạt `{ auto: true }` còn `apiClient`, `authContext`, `seedData` chỉ chạy khi test khai báo tường minh.
- **AC-14-P0-02** (gắn **BR-14-P0-02**): *Given* spec dùng `expectNoConsoleOrPageError` hoặc tiêu đề `HM-01 - ...` trong `deep-engine-tests/`, *When* chạy `npm --prefix playwright run verify`, *Then* ESLint và TypeScript đều đạt Exit Code `0`.
- **AC-14-P0-03** (gắn **BR-14-P0-03**): *Given* `deep-engine.config.ts` và `deep-engine-tests/hm-contracts.spec.ts` được tạo cùng `sync-manifest.json`, *When* chạy `npm run qa:boundary`, *Then* kết quả báo `0 van de`.
- **AC-14-P0-04** (gắn **BR-14-P0-04**): *Given* văn bản REQ/TC tuân theo Canonical Schema ở mục B3, *When* `tools/qa/lib/parser.js` đọc file, *Then* trích xuất chính xác 100% trường metadata và `Coverage notes`.

### A6. Kịch bản kiểm thử chấp nhận (UAT Scenarios — L3)
- **UAT-14-P0-01** (kiểm chứng **REQ-14-P0**, **BR-14-P0-01**..**BR-14-P0-04**): Chạy `npm --prefix playwright run verify`, `npm --prefix playwright run test:deep-engine` và `npm run qa:boundary`; tất cả đạt Exit 0.

## B. Thiết Kế Kỹ Thuật (Technical Design)

### B1. Kiến trúc & Giải pháp kỹ thuật (Architecture & Technical Decisions)
- **TECH-14-P0-01**: Định nghĩa Fixture Matrix trong `playwright/src/fixtures/base.fixture.ts` cho **BR-14-P0-01** (**IMP-14-01**) vì cần tách bạch rõ auto-trap (`runtimeTrap`) với on-demand fixtures (`apiClient`, `authContext`, `seedData`).
- **TECH-14-P0-02**: Mở rộng `playwright/eslint.config.mjs` và `playwright/tsconfig.json` cho **BR-14-P0-02** vì rule `playwright/expect-expect` mặc định từ chối custom `expect*` helper và rule `valid-title-format` từ chối prefix `HM-xx` (`R14-01`).
- **TECH-14-P0-03**: Khởi tạo nguyên tử `playwright/deep-engine.config.ts`, `playwright/deep-engine-tests/hm-contracts.spec.ts` và cập nhật `sync-manifest.json` cho **BR-14-P0-03** để kiểm chứng `HM-01`..`HM-08` ngay từ Phase 1 mà không vi phạm boundary (`R14-03`, `R14-04`).

### B2. File dự kiến tạo mới / sửa đổi (File Inventory & Line Caps)
| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|---|---|---|
| `sync-manifest.json` | Manifest | Modify | 150 | 45 |
| `playwright/package.json` | Manifest | Modify | 150 | 45 |
| `playwright/tsconfig.json` | Config | Modify | 100 | 30 |
| `playwright/eslint.config.mjs` | Config | Modify | 200 | 115 |
| `playwright/deep-engine.config.ts` | Config | Create | 100 | 40 |
| `playwright/deep-engine-tests/hm-contracts.spec.ts` | Test | Create | 800 | 120 |

### B3. Hợp đồng giao diện / Schema (Contracts & Schemas)

#### 1. Fixture Ownership & Lifecycle Matrix
| Fixture | Scope | Auto | Lifecycle | Trách nhiệm duy nhất |
|---|---|---|---|---|
| `page` | `test` | N/A | Playwright core | Cung cấp browser tab sạch cho mỗi test. |
| `runtimeTrap` | `test` | `true` | Attach đầu test -> Flush queue & `assertClean()` cuối test | Thu thập `pageerror`, `console.error`, `requestfailed`, `5xx`; redact nhạy cảm; đánh fail nếu có lỗi ngoài allow-list. |
| `apiClient` | `test` | `false` | Khởi tạo theo yêu cầu -> `dispose()` cuối test | Gọi HTTP API chuẩn bị/dọn dữ liệu, tách biệt khỏi browser context. |
| `authContext` | `test` | `false` | Khởi tạo theo yêu cầu -> Đóng context cuối test | Cung cấp phiên đăng nhập độc lập theo role khi test phân quyền/multi-role. |
| `seedData` | `test` | `false` | Setup đầu test -> Cleanup cuối test (reverse order) | Tạo dữ liệu test có định danh (`runId`) và thu hồi sau khi test kết thúc. |

#### 2. Canonical Requirement & TC Metadata Schema (`R14-07`)
```markdown
- **Page exposure**: Public | Authenticated
- **UI coverage**: Required | Exempt (reason: <text>)
- **XSS applicability**: Applicable | Not applicable (reason: <text>)

## Coverage notes
| Aspect | Status | Notes |
|---|---|---|
| Negative / boundary | Covered | Tested via TC-xxx-02 |
| UI / UX | Covered | Tested via TC-xxx-04 |
| Security / XSS | N/A | Read-only numeric configuration |
| Performance | Covered | Tested via TC-xxx-09 |
```
- Trong `test-cases/*.md`, mỗi TC bổ sung dòng: `- **Capabilities**: <comma-separated list>` (ví dụ: `overflow, overlap, occlusion, a11y, responsive`).

#### 3. Ma trận Kiểm chứng Đột biến (`HM-01` .. `HM-08`)
| Mã HM | Phase | Lỗi giả lập (`setContent` / `route`) | Dấu hiệu bắt lỗi bắt buộc | Đối chứng Pass |
|---|---|---|---|---|
| `HM-01` | P1 | `Promise.reject(new Error('boom'))` + `console.error` | `runtimeTrap` bắt cả 2 lỗi sau khi flush event queue | Đăng ký `runtimeTrap.allow({ source, pattern, reason })` |
| `HM-02` | P1 | `fetch('/api/orders')` trả `500` kèm `Authorization: Bearer secret` | Fail `status=500`, log đính kèm đã redact `[REDACTED]` | Endpoint `/api/health` trả `200` |
| `HM-03` | P2 | `scrollWidth > clientWidth` + văn bản động đến muộn sau 150ms | `expectNoTextOverflow` đợi ổn định và báo đúng selector | Container đủ rộng |
| `HM-04` | P2 | Hai button chồng `12x12px` + 1 nút bị che bởi sticky header / parent `overflow:hidden` | `expectPairwiseNoOverlap` & `expectNotOccluded` fail chính xác | Layout tách rời, `elementFromPoint` khớp tâm |
| `HM-05` | P2 | Bảng `900px` làm tràn viewport `320px` + `<button><svg></svg></button>` không nhãn | `expectResponsiveIntegrity` & `expectInteractiveA11y` fail | Bảng bọc `.table-responsive`, nút có `aria-label` |
| `HM-06` | P3 | Nút Submit không khóa khi click đúp -> 2 POST `/api/submit` | `expectIdempotentSubmit` fail vì `mutationCount === 2` | Nút khóa sau click 1, chỉ 1 POST được gửi |
| `HM-07` | P3 | Input phản chiếu nguyên văn `<img src=x onerror="window.__xss_triggered=true">` | `expectSafeXssRender` fail vì sentinel/dangerous node xuất hiện | Escape thành text an toàn trong sink hiển thị |
| `HM-08` | P3 | UI báo "Đã lưu" trên state giả lập nhưng khi `reload()` mất dữ liệu | `expectStatePersistence` fail ở bước đối chiếu sau reload | Dữ liệu giữ nguyên sau `page.reload()` |

### B4. Dependencies mới (New Dependencies)
- Zero external npm runtime dependency; chỉ khai báo npm scripts nội bộ (`test:deep-engine`) trong `playwright/package.json` và giữ nguyên root `package.json` (tham chiếu **IMP-14-01**, **RES-14-DEEP-TEST**).

## C. Ma Trận Truy Vết (Traceability Matrix — REQ ↔ AC ↔ TC ↔ File)
| REQ / BR | AC | TC | File Test Dự Kiến | File Impl Dự Kiến |
|---|---|---|---|---|
| REQ-14-P0 | AC-14-P0-01 | TC-14-P0-01 | `playwright/deep-engine-tests/hm-contracts.spec.ts` | `playwright/deep-engine.config.ts` |
| BR-14-P0-01 | AC-14-P0-01 | TC-14-P0-02 | `playwright/deep-engine-tests/hm-contracts.spec.ts` | `playwright/deep-engine.config.ts` |
| BR-14-P0-02 | AC-14-P0-02 | TC-14-P0-03 | `playwright/deep-engine-tests/hm-contracts.spec.ts` | `playwright/eslint.config.mjs` |
| BR-14-P0-03 | AC-14-P0-03 | TC-14-P0-04 | `playwright/deep-engine-tests/hm-contracts.spec.ts` | `sync-manifest.json` |
| BR-14-P0-04 | AC-14-P0-04 | TC-14-P0-05 | `playwright/deep-engine-tests/hm-contracts.spec.ts` | `playwright/tsconfig.json` |

## D. Tiêu Chí Nghiệm Thu Tổng (Exit Gate)
- [x] `python .master_process/master.py plan-check` đạt `Exit 0 — PLAN-CHECK: PASS`.
- [x] `npm --prefix playwright run verify`, `npm --prefix playwright run test:deep-engine` và `npm run qa:boundary` đạt Exit Code `0`.

## E. Câu Hỏi Mở (Open Questions)
- Hiện có **0 câu hỏi chặn** (zero blocking questions). Hợp đồng Phase 0 đã khóa hoàn toàn.

## F. Kế Hoạch Rollback & Rủi Ro (Risk & Rollback)
- Nếu `deep-engine.config.ts` xung đột cấu hình với `playwright.config.ts`, cô lập hoàn toàn qua cờ `-c deep-engine.config.ts` và revert độc lập 4 file cấu hình.

## G. Ký Duyệt Trước Thực Thi (Pre-Execution Sign-off)
- [x] **Nghiệp vụ soát bởi:** @user-ba — **Ngày:** 2026-10-23 — **Trạng thái:** APPROVED ✔
- [x] **Kỹ thuật soát bởi:** @antigravity-tl — **Ngày:** 2026-10-23 — **Trạng thái:** APPROVED ✔

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Log — PDR)
| PDR ID | Hạng mục & File liên quan | Lý do cập nhật | Trạng thái |
|---|---|---|---|
| PDR-14-00 | Baseline & Phase 1..5 working-tree (`package.json`, `.agents/skills/qa-logic-gaps/SKILL.md`, `.github/copilot-instructions.md`, `tools/qa/README.md`, `tools/qa/index.js`, `tools/qa/lib/config.js`, `tools/qa/lib/commands.js`, `tools/qa/lib/commands.test.js`, `tools/qa/lib/sources.js`, `tools/qa/lib/sources.test.js`, `playwright/tests/fixtures/test-fixtures.ts`, `playwright/tests/support/ui-checks.ts`, `playwright/tests/auth/login.spec.ts`, `playwright/tests/pages/login.page.ts`, `requirements/REQ-001-sign-in.md`, `test-cases/REQ-001-sign-in.md`, `test-cases/traceability.md`) | Ghi nhận các file đang thay đổi từ Plan 13 và Phase 1..5 trên baseline `e82404bdd6b5f4f2ffe6a39aedf9dabac0e617fb` | APPROVED |
| PDR-14-P0 | Đưa `playwright/eslint.config.mjs`, `playwright/tsconfig.json`, `playwright/deep-engine.config.ts`, `sync-manifest.json` về Phase 0 (`R14-01`, `R14-03`, `R14-04`) | Đảm bảo `verify` và `qa:boundary` xanh ngay từ đầu và mở đường cho `HM-01`..`HM-08` | APPROVED |

## I. Lịch Sử Phiên Bản (Version History)
- **v1.1 (2026-10-23)**: Khởi tạo Phase 0.
- **v1.2 (2026-10-23)**: Bổ sung ESLint/TSConfig rules (`R14-01`), atomic `sync-manifest.json` (`R14-03`, `R14-04`), Canonical Schema (`R14-07`) và chuẩn hóa P1–P7.
