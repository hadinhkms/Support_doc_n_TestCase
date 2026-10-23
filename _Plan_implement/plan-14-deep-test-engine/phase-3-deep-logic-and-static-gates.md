# Phase 3: Deep Logic Invariant Guards & Static AST Quality Gates

> **Cấp độ:** L3 · **Trạng thái:** READY · **Baseline Commit:** e82404bdd6b5f4f2ffe6a39aedf9dabac0e617fb · **Research Gate:** RES-14-DEEP-TEST (R0 Internal Framework)
> **Tác giả Nghiệp vụ:** @user-ba · **Tác giả Kỹ thuật:** @antigravity-tl · **Ngày cập nhật:** 2026-10-23

## A. Đặc Tả Nghiệp Vụ (Business Specification)

### A1. Mục tiêu & Bài toán (Goal & Problem Statement)
- **REQ-14-P3**: Xây dựng bộ bảo vệ bất biến nghiệp vụ & bảo mật `playwright/src/support/deep-guards.ts` (`HM-06`, `HM-07`, `HM-08`) kết hợp nâng cấp bộ phân tích tĩnh `tools/qa/` để bắt spec giả tạo, thiếu `await` trên custom helper và thiếu độ phủ UI/XSS/Idempotency.

### A2. Phạm vi (Scope)
- **In-Scope (`IMP-14-01`)**: Hiện thực hóa `deep-guards.ts`, bộ test `deep-guards.spec.ts`, và nâng cấp 5 module trong `tools/qa/lib/` (`config.js`, `parser.js`, `sources.js`, `commands.js`, `learner.js`) cùng unit tests (`sources.test.js`, `commands.test.js`) (`R14-05`, `R14-06`, `R14-07`, `R14-09`).
- **Out-of-Scope**: Sửa đổi mẫu sinh code `tools/scaffold` (thuộc Phase 4).

### A3. Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)
- **BR-14-P3-01** (kiểm chứng qua **AC-14-P3-01**): `expectIdempotentSubmit` phải chứng minh tính nhân quả: khi kích hoạt đúp (`click` + `click({ force: true })`), hệ thống chỉ phát sinh đúng `1` request mutation (`POST|PUT|PATCH|DELETE`), không trả về HTTP `409`/`5xx`, và nút bấm phải chuyển sang trạng thái khóa hoặc loading (`HM-06`).
- **BR-14-P3-02** (kiểm chứng qua **AC-14-P3-02**): `expectSafeXssRender` phải gắn sentinel `window.__xss_triggered = false`, bẫy `page.on('dialog')`, bắt buộc `sinkLocator` đang hiển thị có phản chiếu nội dung vừa nhập dưới dạng text an toàn, và không chứa phần tử nguy hiểm (`script`, `iframe`, `[onerror]`, `[onload]`, `a[href^="javascript:"]`) (`HM-07`).
- **BR-14-P3-03** (kiểm chứng qua **AC-14-P3-03**): `expectStatePersistence` phải thực thi `assertFn()` cả trước và sau `await page.reload({ waitUntil: 'domcontentloaded' })` để bắt lỗi lưu giả trên bộ nhớ tạm (optimistic UI) (`HM-08`).
- **BR-14-P3-04** (kiểm chứng qua **AC-14-P3-04**): `tools/qa/lib/sources.js` phải phân giải chính xác import (kể cả alias `as` và multiline import) từ `support/ui-checks`, `support/deep-guards` và `fixtures/base.fixture` qua `extractVerifiedHelperImports`, ghi nhận `helper:<canonicalName>` vào `assertionProfile.matchers`, đồng thời báo lỗi `missing-await` nếu lời gọi helper thiếu `await`/`return`/`Promise.all` (`R14-05`).
- **BR-14-P3-05** (kiểm chứng qua **AC-14-P3-05**): `tools/qa/lib/config.js` phải khai báo `checkDeepCoverage: false` trong `DEFAULTS` và `BOOLEAN_KEYS` (`R14-09`); `tools/qa/lib/learner.js` phải cập nhật `STATIC_RULE_MAPPING` đồng bộ với các cổng tĩnh mới (`weak-existence-assertion`, `missing-idempotency-guard`) (`R14-06`).

### A4. Điều kiện biên & Luồng lỗi (Edge Cases & Error Flows)
- Spec đặt tên hàm nội bộ trùng tên `expectNoTextOverflow` nhưng không import từ `support/ui-checks`: `extractVerifiedHelperImports` từ chối công nhận là verified helper.
- Khi `checkDeepCoverage: false` (mặc định): các phát hiện thiếu `@visual`/`@security`/`idempotency` chỉ xuất ở mức `WARN` trong `qa:gaps`, không làm gãy CI của các REQ cũ; khi `checkDeepCoverage: true` hoặc chạy `--strict`, nâng lên mức `ERROR`.

### A5. Tiêu chí nghiệm thu (Acceptance Criteria — Gherkin)
- **AC-14-P3-01** (gắn **BR-14-P3-01**): *Given* form không khóa nút Submit khi click đúp làm gửi 2 POST request, *When* gọi `expectIdempotentSubmit`, *Then* hàm bắt lỗi `Expected exactly 1 mutation request, got 2` (`HM-06`).
- **AC-14-P3-02** (gắn **BR-14-P3-02**): *Given* trang chèn trực tiếp `<img src=x onerror="window.__xss_triggered=true">` vào DOM hoặc không render vào sink, *When* gọi `expectSafeXssRender`, *Then* hàm đánh fail ngay lập tức (`HM-07`).
- **AC-14-P3-03** (gắn **BR-14-P3-03**): *Given* trang chỉ cập nhật biến RAM khi lưu mà mất dữ liệu sau `reload()`, *When* gọi `expectStatePersistence`, *Then* hàm fail tại bước kiểm chứng sau reload (`HM-08`).
- **AC-14-P3-04** (gắn **BR-14-P3-04**): *Given* spec import `{ expectNoTextOverflow as checkOverflow } from '../../src/support/ui-checks'` nhưng gọi `checkOverflow(page)` không có `await`, *When* `sources.js` phân tích, *Then* ghi nhận `helper:expectNoTextOverflow` và báo lỗi `missing-await`.
- **AC-14-P3-05** (gắn **BR-14-P3-05**): *Given* spec chỉ dùng `expect(x).toBeDefined()`, *When* chạy `npm test` và `qa:gaps`, *Then* báo lỗi `weak-existence-assertion` và đồng bộ hoàn toàn với `learner.js`.

### A6. Kịch bản kiểm thử chấp nhận (UAT Scenarios — L3)
- **UAT-14-P3-01** (kiểm chứng **REQ-14-P3**, **BR-14-P3-01**..**BR-14-P3-05**): Chạy `npm --prefix playwright run test:deep-engine -- deep-guards.spec.ts` (`HM-06`..`HM-08`) và `npm test` cho `tools/qa` đạt Pass 100%.

## B. Thiết Kế Kỹ Thuật (Technical Design)

### B1. Kiến trúc & Giải pháp kỹ thuật (Architecture & Technical Decisions)
- **TECH-14-P3-01**: Xây dựng 5 hàm bảo vệ trong `playwright/src/support/deep-guards.ts` cho **REQ-14-P3** (**IMP-14-01**) vì cần kiểm chứng nhân quả giữa hành động UI, gói tin mạng, DOM sink và trạng thái lưu trữ sau reload.
- **TECH-14-P3-02**: Bổ sung `extractVerifiedHelperImports(fileLines)` và mở rộng `findMissingAwaits` trong `tools/qa/lib/sources.js` cho **BR-14-P3-04** nhằm chống giả mạo tên hàm và bắt lỗi quên `await` trên async helper (`R14-05`).
- **TECH-14-P3-03**: Đăng ký `checkDeepCoverage` trong `tools/qa/lib/config.js` và cập nhật `STATIC_RULE_MAPPING` trong `tools/qa/lib/learner.js` cho **BR-14-P3-05** để đảm bảo toàn bộ unit test của `tools/qa` xanh 100% (`R14-06`, `R14-09`).

### B2. File dự kiến tạo mới / sửa đổi (File Inventory & Line Caps)
| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|---|---|---|
| `playwright/tests/support/deep-guards.ts` | Module | Create | 250 | 245 |
| `playwright/deep-engine-tests/deep-guards.spec.ts` | Test | Create | 800 | 220 |
| `tools/qa/lib/config.js` | Module | Modify | 250 | 135 |
| `tools/qa/lib/sources.js` | Module | Modify | 250 | 248 |
| `tools/qa/lib/commands.js` | Module | Modify | 250 | 248 |
| `tools/qa/lib/learner.js` | Module | Modify | 250 | 235 |
| `tools/qa/lib/sources.test.js` | Test | Modify | 800 | 520 |
| `tools/qa/lib/commands.test.js` | Test | Modify | 800 | 720 |

### B3. Hợp đồng giao diện / Schema (Contracts & Schemas)
```ts
export async function expectIdempotentSubmit(
  page: Page,
  trigger: Locator | (() => Promise<void>),
  urlPattern: string | RegExp | ((req: Request) => boolean),
  options?: {
    methods?: string[];
    requireDisabledOrLoading?: boolean;
    buttonLocator?: Locator;
    postSubmitAssert?: (res: Response) => Promise<void>;
    settleMs?: number;
  },
): Promise<Response>;

export async function expectSafeXssRender(
  page: Page,
  inputAction: (payload: string) => Promise<void>,
  options: { sinkLocator: Locator; payloads?: readonly string[]; expectReflectedText?: boolean },
): Promise<void>;

export async function expectStatePersistence(
  page: Page,
  assertFn: () => Promise<void>,
  options?: { expectStorageKeys?: { storage: 'local' | 'session'; key: string }[] },
): Promise<void>;

export async function expectBoundaryRejected(
  page: Page,
  trigger: () => Promise<void>,
  errorLocator: Locator,
  options?: {
    expectedPattern?: RegExp | string;
    forbidMutationRequest?: boolean;
    mutationUrlPattern?: string | RegExp;
    allowServerValidation?: boolean;
  },
): Promise<void>;

export async function expectPerformanceBudget(
  page: Page,
  action: () => Promise<void>,
  budget: { maxActionMs: number; maxDomInteractiveMs?: number; maxTransferSizeBytes?: number },
): Promise<{ elapsedMs: number }>;
```

### B4. Dependencies mới (New Dependencies)
- Zero external npm runtime dependency; phân tích tĩnh bằng regex/token-state thuần Node.js trong `tools/qa/lib/` và giữ nguyên root `package.json` (tham chiếu **IMP-14-01**, **RES-14-DEEP-TEST**).

## C. Ma Trận Truy Vết (Traceability Matrix — REQ ↔ AC ↔ TC ↔ File)
| REQ / BR | AC | TC | File Test Dự Kiến | File Impl Dự Kiến |
|---|---|---|---|---|
| REQ-14-P3 | AC-14-P3-01 | TC-14-P3-01 | `playwright/deep-engine-tests/deep-guards.spec.ts` | `playwright/src/support/deep-guards.ts` |
| BR-14-P3-01 | AC-14-P3-01 | TC-14-P3-02 | `playwright/deep-engine-tests/deep-guards.spec.ts` | `playwright/src/support/deep-guards.ts` |
| BR-14-P3-02 | AC-14-P3-02 | TC-14-P3-03 | `playwright/deep-engine-tests/deep-guards.spec.ts` | `playwright/src/support/deep-guards.ts` |
| BR-14-P3-03 | AC-14-P3-03 | TC-14-P3-04 | `playwright/deep-engine-tests/deep-guards.spec.ts` | `playwright/src/support/deep-guards.ts` |
| BR-14-P3-04 | AC-14-P3-04 | TC-14-P3-05 | `tools/qa/lib/sources.test.js` | `tools/qa/lib/sources.js` |
| BR-14-P3-05 | AC-14-P3-05 | TC-14-P3-06 | `tools/qa/lib/commands.test.js` | `tools/qa/lib/commands.js` |

## D. Tiêu Chí Nghiệm Thu Tổng (Exit Gate)
- [x] `python .master_process/master.py plan-check` đạt `Exit 0 — PLAN-CHECK: PASS`.
- [x] `npm test` (toàn bộ `tools/qa/lib/*.test.js`) và `npm --prefix playwright run test:deep-engine -- deep-guards.spec.ts` đạt Exit Code `0`.

## E. Câu Hỏi Mở (Open Questions)
- Hiện có **0 câu hỏi chặn** (zero blocking questions). Hợp đồng `deep-guards.ts` và AST rules trong `tools/qa` đã khóa.

## F. Kế Hoạch Rollback & Rủi Ro (Risk & Rollback)
- Cờ `checkDeepCoverage` mặc định là `false` trong `tools/qa/lib/config.js`, đảm bảo không gây vỡ CI cho các requirement chưa nâng cấp lên bộ deep test.

## G. Ký Duyệt Trước Thực Thi (Pre-Execution Sign-off)
- [x] **Nghiệp vụ soát bởi:** @user-ba — **Ngày:** 2026-10-23 — **Trạng thái:** APPROVED ✔
- [x] **Kỹ thuật soát bởi:** @antigravity-tl — **Ngày:** 2026-10-23 — **Trạng thái:** APPROVED ✔

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Log — PDR)
| PDR ID | Hạng mục & File liên quan | Lý do cập nhật | Trạng thái |
|---|---|---|---|
| PDR-14-00 | Baseline & Phase 0..5 working-tree (`package.json`, `.agents/skills/qa-logic-gaps/SKILL.md`, `.github/copilot-instructions.md`, `tools/qa/README.md`, `tools/qa/index.js`, `tools/qa/lib/commands.js`, `tools/qa/lib/commands.test.js`, `tools/qa/lib/sources.js`, `tools/qa/lib/sources.test.js`, `sync-manifest.json`, `playwright/package.json`, `playwright/tsconfig.json`, `playwright/eslint.config.mjs`, `playwright/tests/fixtures/test-fixtures.ts`, `playwright/tests/support/ui-checks.ts`, `playwright/tests/auth/login.spec.ts`, `playwright/tests/pages/login.page.ts`, `requirements/REQ-001-sign-in.md`, `test-cases/REQ-001-sign-in.md`, `test-cases/traceability.md`) | Ghi nhận các file đang thay đổi từ Plan 13 và Phase 0..5 trên baseline `e82404bdd6b5f4f2ffe6a39aedf9dabac0e617fb` | APPROVED |
| PDR-14-P3 | Bổ sung `extractVerifiedHelperImports` + `findMissingAwaits` (`R14-05`), `learner.js` (`R14-06`), `config.js` (`R14-09`) | Khép kín chuỗi nhận diện helper từ AST đến Learner catalog và giữ tương thích cấu hình | APPROVED |

## I. Lịch Sử Phiên Bản (Version History)
- **v1.0 (2026-10-22)**: Bản khởi tạo Phase 3.
- **v1.1 (2026-10-23)**: Bổ sung `HM-06`..`HM-08`, causality guards và `verifiedHelperCalls`.
- **v1.2 (2026-10-23)**: Giải quyết `R14-05`, `R14-06`, `R14-07`, `R14-09` và đạt chuẩn P1–P7.
