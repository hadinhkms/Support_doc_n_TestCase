# Phase 1: Runtime Bug-Trap Fixture (Bẫy Lỗi Ngầm Tự Động 100%)

> **Cấp độ:** L3 · **Trạng thái:** READY · **Baseline Commit:** e82404bdd6b5f4f2ffe6a39aedf9dabac0e617fb · **Research Gate:** RES-14-DEEP-TEST (R0 Internal Framework)
> **Tác giả Nghiệp vụ:** @user-ba · **Tác giả Kỹ thuật:** @antigravity-tl · **Ngày cập nhật:** 2026-10-23

## A. Đặc Tả Nghiệp Vụ (Business Specification)

### A1. Mục tiêu & Bài toán (Goal & Problem Statement)
- **REQ-14-P1**: Tích hợp cảm biến tự động `runtimeTrap` (`{ auto: true }`) vào `playwright/src/fixtures/base.fixture.ts` để bắt 100% lỗi runtime ngầm (`pageerror`, `console.error`, `requestfailed`, `response.status() >= 500`) mà không cần sửa từng spec hiện có.

### A2. Phạm vi (Scope)
- **In-Scope (`IMP-14-01`)**: Nâng cấp `base.fixture.ts`, bổ sung helper `expectNoConsoleOrPageError` và `expectExpectedError` cho negative test, cơ chế redact thông tin nhạy cảm, cơ chế flush hàng đợi sự kiện trình duyệt ở teardown (`R14-08`), và bộ kiểm chứng `HM-01`, `HM-02` trong `playwright/deep-engine-tests/runtime-trap.spec.ts`.
- **Out-of-Scope**: Các phép đo hình học DOM (Phase 2) và kiểm tra idempotency/XSS (Phase 3).

### A3. Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)
- **BR-14-P1-01** (kiểm chứng qua **AC-14-P1-01**): Trước khi gọi `assertClean()` ở teardown, `runtimeTrap` bắt buộc thực thi `if (!page.isClosed()) { await page.evaluate(() => {}).catch(() => {}); }` để ép trình duyệt đẩy hết các sự kiện `pageerror` / `console.error` bất đồng bộ cuối cùng về Node.js (`R14-08`).
- **BR-14-P1-02** (kiểm chứng qua **AC-14-P1-02**): Mọi URL query nhạy cảm và header (`authorization`, `cookie`, `set-cookie`, `x-api-key`, `token`, `password`, `secret`) phải bị thay bằng `[REDACTED]` trước khi ghi vào `records`, `testInfo.attach('runtime-failures')` hoặc thông báo lỗi.
- **BR-14-P1-03** (kiểm chứng qua **AC-14-P1-03**): Nếu test chính đã fail (`Boolean(testInfo.error)`), teardown vẫn đính kèm `runtime-failures` vào report để hỗ trợ debug nhưng không ném lỗi đè lên nguyên nhân fail gốc; nếu test chính đang xanh mà có lỗi ngoài allow-list thì `assertClean()` phải throw Error làm fail test (`R14-08`).
- **BR-14-P1-04** (kiểm chứng qua **AC-14-P1-04**): Mọi quy tắc `runtimeTrap.allow(rule)` hoặc `expectExpectedError(...)` bắt buộc có trường `reason` không rỗng; việc bỏ qua `requestfailed` chỉ áp dụng cho `net::ERR_ABORTED` / `NS_BINDING_ABORTED` của tài nguyên không phải `document`/`xhr`/`fetch`.

### A4. Điều kiện biên & Luồng lỗi (Edge Cases & Error Flows)
- Trang bị đóng chủ động trong kịch bản test (`await page.close()`): `page.isClosed() === true` sẽ bỏ qua lệnh `page.evaluate` flush nhưng vẫn kiểm tra đầy đủ `records` đã thu thập trước đó.
- Kịch bản negative test mong đợi lỗi HTTP `500` hoặc `console.error`: dùng `await expectExpectedError(runtimeTrap, rule, action)` để vừa đăng ký allow-list tạm thời vừa bắt buộc lỗi đó phải thực sự xuất hiện ít nhất 1 lần (nếu không xuất hiện sẽ fail test vì bẫy lỗi vô hiệu).

### A5. Tiêu chí nghiệm thu (Acceptance Criteria — Gherkin)
- **AC-14-P1-01** (gắn **BR-14-P1-01**): *Given* trang kích hoạt `Promise.reject(new Error('boom'))` hoặc `console.error` ở microtask cuối cùng, *When* test kết thúc, *Then* `runtimeTrap` flush hàng đợi và bắt đủ cả 2 lỗi (`HM-01`).
- **AC-14-P1-02** (gắn **BR-14-P1-02**): *Given* request `/api/orders?token=abc` kèm `Authorization: Bearer xyz` trả về HTTP `500`, *When* `runtimeTrap` ghi nhận lỗi, *Then* dữ liệu đính kèm và message chỉ chứa `[REDACTED]` (`HM-02`).
- **AC-14-P1-03** (gắn **BR-14-P1-03**): *Given* test đã fail do assertion DOM và đồng thời có `console.error`, *When* teardown chạy, *Then* `runtime-failures` được attach vào `testInfo` nhưng thông báo lỗi chính của test không bị ghi đè.
- **AC-14-P1-04** (gắn **BR-14-P1-04**): *Given* negative test gọi `expectExpectedError` cho `/api/orders` `500`, *When* API trả `200` (không lỗi), *Then* `expectExpectedError` đánh fail test vì lỗi mong đợi không xảy ra.

### A6. Kịch bản kiểm thử chấp nhận (UAT Scenarios — L3)
- **UAT-14-P1-01** (kiểm chứng **REQ-14-P1**, **BR-14-P1-01**..**BR-14-P1-04**): Chạy `npm --prefix playwright run test:deep-engine -- runtime-trap.spec.ts` kiểm chứng `HM-01` và `HM-02` đạt Pass 100%.

## B. Thiết Kế Kỹ Thuật (Technical Design)

### B1. Kiến trúc & Giải pháp kỹ thuật (Architecture & Technical Decisions)
- **TECH-14-P1-01**: Thiết kế `RuntimeTrap` trong `playwright/src/fixtures/base.fixture.ts` cho **REQ-14-P1** (**IMP-14-01**) vì cần tự động hóa 100% việc bắt lỗi runtime trên mọi spec kế thừa `base.fixture.ts` mà không phá vỡ tương thích ngược (`R14-02`).
- **TECH-14-P1-02**: Bổ sung bước đồng bộ vòng lặp sự kiện `await page.evaluate(() => {})` trước `assertClean()` cho **BR-14-P1-01** nhằm triệt tiêu race condition giữa `Promise.reject` trong browser và teardown của Playwright (`R14-08`).
- **TECH-14-P1-03**: Cung cấp hàm `expectExpectedError` và `expectNoConsoleOrPageError` экспоrt từ `base.fixture.ts` cho **BR-14-P1-04** để vừa phục vụ negative test tường minh vừa để `tools/qa` nhận diện bằng chứng assertion.

### B2. File dự kiến tạo mới / sửa đổi (File Inventory & Line Caps)
| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|---|---|---|
| `playwright/tests/fixtures/base.fixture.ts` | Module | Create | 250 | 220 |
| `playwright/tests/fixtures/test-fixtures.ts` | Module | Modify | 250 | 60 |
| `playwright/deep-engine-tests/runtime-trap.spec.ts` | Test | Create | 800 | 240 |

### B3. Hợp đồng giao diện / Schema (Contracts & Schemas)
```ts
export type RuntimeFailureSource = 'pageerror' | 'console.error' | 'requestfailed' | 'http-5xx';

export interface RuntimeFailureRecord {
  source: RuntimeFailureSource;
  message: string;
  url?: string;
  method?: string;
  status?: number;
  resourceType?: string;
  timestamp: string;
  redactedHeaders?: Record<string, string>;
}

export interface RuntimeAllowRule {
  source: RuntimeFailureSource | '*';
  pattern: RegExp | string;
  status?: number;
  reason: string;
}

export interface RuntimeTrap {
  readonly records: ReadonlyArray<RuntimeFailureRecord>;
  allow(rule: RuntimeAllowRule): void;
  clearAllowed(): void;
  assertClean(): void;
}
```
- **Teardown Contract (`R14-08`)**:
  1. `if (!page.isClosed()) { await page.evaluate(() => {}).catch(() => {}); }`
  2. Lọc các `records` không khớp `allowRules`.
  3. Nếu `unexpected.length > 0`, gọi `await testInfo.attach('runtime-failures', { body: JSON.stringify(unexpected, null, 2), contentType: 'application/json' })`.
  4. Nếu `!testInfo.error`, gọi `trap.assertClean()` để throw Error chi tiết làm fail test.

### B4. Dependencies mới (New Dependencies)
- Zero external npm runtime dependency; sử dụng hoàn toàn API gốc của `@playwright/test` và giữ nguyên root `package.json` (tham chiếu **IMP-14-01**, **RES-14-DEEP-TEST**).

## C. Ma Trận Truy Vết (Traceability Matrix — REQ ↔ AC ↔ TC ↔ File)
| REQ / BR | AC | TC | File Test Dự Kiến | File Impl Dự Kiến |
|---|---|---|---|---|
| REQ-14-P1 | AC-14-P1-01 | TC-14-P1-01 | `playwright/deep-engine-tests/runtime-trap.spec.ts` | `playwright/tests/fixtures/base.fixture.ts` |
| BR-14-P1-01 | AC-14-P1-01 | TC-14-P1-02 | `playwright/deep-engine-tests/runtime-trap.spec.ts` | `playwright/tests/fixtures/base.fixture.ts` |
| BR-14-P1-02 | AC-14-P1-02 | TC-14-P1-03 | `playwright/deep-engine-tests/runtime-trap.spec.ts` | `playwright/tests/fixtures/base.fixture.ts` |
| BR-14-P1-03 | AC-14-P1-03 | TC-14-P1-04 | `playwright/deep-engine-tests/runtime-trap.spec.ts` | `playwright/tests/fixtures/test-fixtures.ts` |
| BR-14-P1-04 | AC-14-P1-04 | TC-14-P1-05 | `playwright/deep-engine-tests/runtime-trap.spec.ts` | `playwright/tests/fixtures/base.fixture.ts` |

## D. Tiêu Chí Nghiệm Thu Tổng (Exit Gate)
- [x] `python .master_process/master.py plan-check` đạt `Exit 0 — PLAN-CHECK: PASS`.
- [x] `npm --prefix playwright run verify` và `npm --prefix playwright run test:deep-engine -- runtime-trap.spec.ts` đạt Exit Code `0`.

## E. Câu Hỏi Mở (Open Questions)
- Hiện có **0 câu hỏi chặn** (zero blocking questions). Hợp đồng `RuntimeTrap` và cơ chế flush/redaction đã khóa.

## F. Kế Hoạch Rollback & Rủi Ro (Risk & Rollback)
- Nếu một trang legacy phát sinh lỗi `console.error` từ thư viện thứ ba chưa kịp sửa, test dùng `runtimeTrap.allow({ source: 'console.error', pattern: /third-party/, reason: 'Known issue #123' })` thay vì tắt fixture toàn cục.

## G. Ký Duyệt Trước Thực Thi (Pre-Execution Sign-off)
- [x] **Nghiệp vụ soát bởi:** @user-ba — **Ngày:** 2026-10-23 — **Trạng thái:** APPROVED ✔
- [x] **Kỹ thuật soát bởi:** @antigravity-tl — **Ngày:** 2026-10-23 — **Trạng thái:** APPROVED ✔

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Log — PDR)
| PDR ID | Hạng mục & File liên quan | Lý do cập nhật | Trạng thái |
|---|---|---|---|
| PDR-14-00 | Baseline & Phase 0..5 working-tree (`package.json`, `.agents/skills/qa-logic-gaps/SKILL.md`, `.github/copilot-instructions.md`, `tools/qa/README.md`, `tools/qa/index.js`, `tools/qa/lib/config.js`, `tools/qa/lib/commands.js`, `tools/qa/lib/commands.test.js`, `tools/qa/lib/sources.js`, `tools/qa/lib/sources.test.js`, `sync-manifest.json`, `playwright/package.json`, `playwright/tsconfig.json`, `playwright/eslint.config.mjs`, `playwright/tests/support/ui-checks.ts`, `playwright/tests/auth/login.spec.ts`, `playwright/tests/pages/login.page.ts`, `requirements/REQ-001-sign-in.md`, `test-cases/REQ-001-sign-in.md`, `test-cases/traceability.md`) | Ghi nhận các file đang thay đổi từ Plan 13 và Phase 0..5 trên baseline `e82404bdd6b5f4f2ffe6a39aedf9dabac0e617fb` | APPROVED |
| PDR-14-P1 | Xóa bỏ đoạn code v1.0 cũ (`R14-02`) và bổ sung cơ chế flush event queue + bảo toàn `testInfo.error` (`R14-08`) | Ngăn ngừa trượt lỗi bất đồng bộ cuối test và không che khuất lỗi assertion gốc | APPROVED |

## I. Lịch Sử Phiên Bản (Version History)
- **v1.0 (2026-10-22)**: Bản khởi tạo Phase 1.
- **v1.1 (2026-10-23)**: Bổ sung `RuntimeFailureRecord`, redaction, `expectExpectedError` và `HM-01`, `HM-02`.
- **v1.2 (2026-10-23)**: Chuẩn hóa hợp đồng duy nhất (`R14-02`), bổ sung event-loop flush (`R14-08`) và đạt chuẩn P1–P7.
