# Phase 2: UI/UX Geometry, Visual Layout & Accessibility Engine

> **Cấp độ:** L3 · **Trạng thái:** READY · **Baseline Commit:** e82404bdd6b5f4f2ffe6a39aedf9dabac0e617fb · **Research Gate:** RES-14-DEEP-TEST (R0 Internal Framework)
> **Tác giả Nghiệp vụ:** @user-ba · **Tác giả Kỹ thuật:** @antigravity-tl · **Ngày cập nhật:** 2026-10-23

## A. Đặc Tả Nghiệp Vụ (Business Specification)

### A1. Mục tiêu & Bài toán (Goal & Problem Statement)
- **REQ-14-P2**: Xây dựng thư viện `playwright/src/support/ui-checks.ts` gồm 7 hàm kiểm tra hình học DOM, khả năng hiển thị thực tế và Accessibility cơ bản để bắt tự động lỗi tràn chữ, đè nút, khuất phần tử bởi sticky header/ancestor container, vỡ bố cục responsive và thiếu nhãn A11y.

### A2. Phạm vi (Scope)
- **In-Scope (`IMP-14-01`)**: Hiện thực hóa 7 hàm `expect*` trong `playwright/src/support/ui-checks.ts` với cơ chế retrying (`expect.poll` / `toPass`), tính toán giao cắt khung nhìn của tổ tiên (`ancestor clipping`), kiểm soát nghiêm ngặt phần tử ẩn/rỗng (`R14-02`), và kiểm chứng qua `HM-03`, `HM-04`, `HM-05` trong `playwright/deep-engine-tests/ui-checks.spec.ts`.
- **Out-of-Scope**: So khớp ảnh chụp màn hình theo pixel (visual snapshot diffing).

### A3. Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)
- **BR-14-P2-01** (kiểm chứng qua **AC-14-P2-01**): Mọi phép đo hình học trong `ui-checks.ts` phải bọc trong `expect.poll` hoặc `expect(async () => ...).toPass()`, chờ `document.fonts?.ready` và chỉ kết luận khi kích thước/vị trí ổn định qua 2 lần lấy mẫu liên tiếp (`R14-02`).
- **BR-14-P2-02** (kiểm chứng qua **AC-14-P2-02**): `expectPairwiseNoOverlap(locators)` bắt buộc mọi locator đầu vào phải đang hiển thị (`isVisible() === true`) và có `boundingBox() !== null`; tuyệt đối không bỏ qua (`continue`) phần tử ẩn để tránh false-green (`R14-02`).
- **BR-14-P2-03** (kiểm chứng qua **AC-14-P2-03**): `expectContainedIn` và `expectNotOccluded` phải tính toán vùng nhìn thấy thực tế (`effectiveVisibleRect`) bằng cách giao cắt (`intersect`) hình chữ nhật của phần tử với cả viewport lẫn mọi tổ tiên (`parentElement`) có `overflowX`/`overflowY` thuộc `['hidden', 'clip', 'scroll', 'auto']`, đồng thời kiểm tra `elementFromPoint` tại tâm và 4 góc co vào `2px` (`R14-02`).
- **BR-14-P2-04** (kiểm chứng qua **AC-14-P2-04**): `expectResponsiveIntegrity` phải phân biệt rõ `requiredLocators` (bắt buộc `count() > 0` và `isVisible()` trên mọi viewport) với `optionalLocators` (cho phép ẩn hoặc `count() === 0` ở một số breakpoint như menu thu gọn trên mobile).

### A4. Điều kiện biên & Luồng lỗi (Edge Cases & Error Flows)
- Phần tử cố tình dùng `text-overflow: ellipsis`: chỉ hợp lệ khi truyền `{ allowEllipsis: true }` VÀ `getComputedStyle(el)` có đủ bộ ba `overflowX === 'hidden'`, `whiteSpace === 'nowrap'`, `textOverflow === 'ellipsis'`.
- Phần tử nằm ngoài màn hình ban đầu nhưng có thể cuộn tới: khi `scrollIntoView: true` (mặc định), gọi `locator.scrollIntoViewIfNeeded()` trước khi đo `elementFromPoint`; nếu vẫn bị sticky header che sau khi cuộn thì đánh fail.

### A5. Tiêu chí nghiệm thu (Acceptance Criteria — Gherkin)
- **AC-14-P2-01** (gắn **BR-14-P2-01**): *Given* phần tử có `scrollWidth > clientWidth + 1` hoặc render muộn sau 150ms, *When* gọi `expectNoTextOverflow`, *Then* hàm đợi phần tử ổn định và bắt chính xác lỗi tràn chữ (`HM-03`).
- **AC-14-P2-02** (gắn **BR-14-P2-02**): *Given* hai nút chồng lên nhau `12x12px` hoặc 1 nút bị ẩn (`display:none`), *When* gọi `expectPairwiseNoOverlap`, *Then* hàm đánh fail ngay lập tức với thông tin tọa độ/trạng thái (`HM-04`).
- **AC-14-P2-03** (gắn **BR-14-P2-03**): *Given* nút bấm bị che bởi sticky header (`z-index: 999`) hoặc bị cắt bởi thẻ cha `overflow: hidden`, *When* gọi `expectNotOccluded` hoặc `expectContainedIn`, *Then* hàm phát hiện vùng bị cắt/che và đánh fail (`HM-04`).
- **AC-14-P2-04** (gắn **BR-14-P2-04**): *Given* bảng rộng `900px` trên viewport `320px` và nút chỉ chứa `<svg>` không có `aria-label`, *When* gọi `expectResponsiveIntegrity` và `expectInteractiveA11y`, *Then* cả hai lỗi đều bị bắt chính xác (`HM-05`).

### A6. Kịch bản kiểm thử chấp nhận (UAT Scenarios — L3)
- **UAT-14-P2-01** (kiểm chứng **REQ-14-P2**, **BR-14-P2-01**..**BR-14-P2-04**): Chạy `npm --prefix playwright run test:deep-engine -- ui-checks.spec.ts` kiểm chứng `HM-03`, `HM-04`, `HM-05` (cả case bắt lỗi và case đối chứng Pass) đạt Exit 0.

## B. Thiết Kế Kỹ Thuật (Technical Design)

### B1. Kiến trúc & Giải pháp kỹ thuật (Architecture & Technical Decisions)
- **TECH-14-P2-01**: Hiện thực hóa 7 hàm kiểm tra trong `playwright/src/support/ui-checks.ts` cho **REQ-14-P2** (**IMP-14-01**) vì cần bộ công cụ đo lường DOM chuẩn xác bằng toán học hình học thay cho kiểm tra bằng mắt.
- **TECH-14-P2-02**: Áp dụng thuật toán giao cắt chuỗi tổ tiên (`computeEffectiveClipRect`) cho **BR-14-P2-03** nhằm phát hiện phần tử bị cắt khuất bởi container cha có `overflow: hidden/auto/scroll` dù vẫn nằm trong viewport (`R14-02`).
- **TECH-14-P2-03**: Tách bạch `requiredLocators` (tương thích ngược với `checkLocators`) và `optionalLocators` trong `expectResponsiveIntegrity` cho **BR-14-P2-04** để vừa chống false-green khi mất phần tử chính, vừa hỗ trợ adaptive UI trên mobile/tablet.

### B2. File dự kiến tạo mới / sửa đổi (File Inventory & Line Caps)
| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|---|---|---|
| `playwright/tests/support/ui-geometry-dom.ts` | Module | Create | 250 | 235 |
| `playwright/tests/support/ui-checks.ts` | Module | Modify | 250 | 240 |
| `playwright/deep-engine-tests/ui-checks.spec.ts` | Test | Create | 800 | 240 |

### B3. Hợp đồng giao diện / Schema (Contracts & Schemas)
```ts
export interface ViewportConfig { name: string; width: number; height: number; }
export const DEFAULT_VIEWPORTS: ViewportConfig[] = [
  { name: 'mobile-320', width: 320, height: 640 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
];

export async function expectNoHorizontalScroll(page: Page, label?: string, options?: { timeout?: number }): Promise<void>;
export async function expectNoTextOverflow(
  scope: Page | Locator,
  selectors?: string,
  options?: { allowEllipsis?: boolean; allowScrollable?: boolean; optionalSelectors?: string; timeout?: number },
): Promise<void>;
export async function expectPairwiseNoOverlap(
  locators: Locator[],
  options?: { tolerancePx?: number; timeout?: number },
): Promise<void>;
export async function expectContainedIn(
  child: Locator,
  parent: Locator,
  tolerancePx?: number,
  options?: { checkAncestorClips?: boolean; timeout?: number },
): Promise<void>;
export async function expectNotOccluded(
  locator: Locator,
  options?: { samplePoints?: ('center' | 'corners')[]; scrollIntoView?: boolean; timeout?: number },
): Promise<void>;
export async function expectInteractiveA11y(
  scope: Page | Locator,
  options?: { checkFocusRing?: boolean; maxElements?: number; timeout?: number },
): Promise<void>;
export async function expectResponsiveIntegrity(
  page: Page,
  options?: {
    viewports?: ViewportConfig[];
    requiredLocators?: Locator[];
    optionalLocators?: Locator[];
    checkLocators?: Locator[];
    timeout?: number;
  },
): Promise<void>;
```

### B4. Dependencies mới (New Dependencies)
- Zero external npm runtime dependency; tính toán trực tiếp qua Browser DOM APIs (`getBoundingClientRect`, `getComputedStyle`, `elementFromPoint`) và giữ nguyên root `package.json` (tham chiếu **IMP-14-01**, **RES-14-DEEP-TEST**).

## C. Ma Trận Truy Vết (Traceability Matrix — REQ ↔ AC ↔ TC ↔ File)
| REQ / BR | AC | TC | File Test Dự Kiến | File Impl Dự Kiến |
|---|---|---|---|---|
| REQ-14-P2 | AC-14-P2-01 | TC-14-P2-01 | `playwright/deep-engine-tests/ui-checks.spec.ts` | `playwright/tests/support/ui-checks.ts` |
| BR-14-P2-01 | AC-14-P2-01 | TC-14-P2-02 | `playwright/deep-engine-tests/ui-checks.spec.ts` | `playwright/tests/support/ui-geometry-dom.ts` |
| BR-14-P2-02 | AC-14-P2-02 | TC-14-P2-03 | `playwright/deep-engine-tests/ui-checks.spec.ts` | `playwright/tests/support/ui-checks.ts` |
| BR-14-P2-03 | AC-14-P2-03 | TC-14-P2-04 | `playwright/deep-engine-tests/ui-checks.spec.ts` | `playwright/tests/support/ui-geometry-dom.ts` |
| BR-14-P2-04 | AC-14-P2-04 | TC-14-P2-05 | `playwright/deep-engine-tests/ui-checks.spec.ts` | `playwright/tests/support/ui-checks.ts` |

## D. Tiêu Chí Nghiệm Thu Tổng (Exit Gate)
- [x] `python .master_process/master.py plan-check` đạt `Exit 0 — PLAN-CHECK: PASS`.
- [x] `npm --prefix playwright run verify` và `npm --prefix playwright run test:deep-engine -- ui-checks.spec.ts` đạt Exit Code `0`.

## E. Câu Hỏi Mở (Open Questions)
- Hiện có **0 câu hỏi chặn** (zero blocking questions). Hợp đồng 7 hàm `ui-checks.ts` đã khóa hoàn toàn.

## F. Kế Hoạch Rollback & Rủi Ro (Risk & Rollback)
- Nếu hiệu ứng CSS transition kéo dài trên 1000ms ở một trang đặc thù, caller có thể truyền `{ timeout: 5000 }` vào `options` của từng hàm mà không cần sửa logic lõi.

## G. Ký Duyệt Trước Thực Thi (Pre-Execution Sign-off)
- [x] **Nghiệp vụ soát bởi:** @user-ba — **Ngày:** 2026-10-23 — **Trạng thái:** APPROVED ✔
- [x] **Kỹ thuật soát bởi:** @antigravity-tl — **Ngày:** 2026-10-23 — **Trạng thái:** APPROVED ✔

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Log — PDR)
| PDR ID | Hạng mục & File liên quan | Lý do cập nhật | Trạng thái |
|---|---|---|---|
| PDR-14-00 | Baseline & Phase 0..5 working-tree (`package.json`, `.agents/skills/qa-logic-gaps/SKILL.md`, `.github/copilot-instructions.md`, `tools/qa/README.md`, `tools/qa/index.js`, `tools/qa/lib/config.js`, `tools/qa/lib/commands.js`, `tools/qa/lib/commands.test.js`, `tools/qa/lib/sources.js`, `tools/qa/lib/sources.test.js`, `sync-manifest.json`, `playwright/package.json`, `playwright/tsconfig.json`, `playwright/eslint.config.mjs`, `playwright/tests/fixtures/test-fixtures.ts`, `playwright/tests/auth/login.spec.ts`, `playwright/tests/pages/login.page.ts`, `requirements/REQ-001-sign-in.md`, `test-cases/REQ-001-sign-in.md`, `test-cases/traceability.md`) | Ghi nhận các file đang thay đổi từ Plan 13 và Phase 0..5 trên baseline `e82404bdd6b5f4f2ffe6a39aedf9dabac0e617fb` | APPROVED |
| PDR-14-P2 | Chuẩn hóa retrying geometry, ancestor clipping và nghiêm cấm bỏ qua locator ẩn trong `expectPairwiseNoOverlap` (`R14-02`) | Loại bỏ hoàn toàn nguy cơ false-green và flaky do CSS animation/font loading | APPROVED |

## I. Lịch Sử Phiên Bản (Version History)
- **v1.0 (2026-10-22)**: Bản khởi tạo Phase 2.
- **v1.1 (2026-10-23)**: Bổ sung retrying, ancestor clipping, sample points 4 góc và `HM-03`..`HM-05`.
- **v1.2 (2026-10-23)**: Khóa chữ ký hàm thống nhất với Phase 4/5 (`R14-02`) và đạt chuẩn P1–P7.
