# PHASE 1: DEEP UI/UX GEOMETRY, OCCLUSION & VISUAL ENGINE

> **Thuộc:** [Plan 14 — Deep Logic, Runtime Bug-Trap & UI/UX Geometry Engine](../14_DEEP_LOGIC_AND_UI_UX_BUG_HUNTING_FRAMEWORK_PLAN.md)  
> **Phiên bản:** 1.1 — 2026-10-23  
> **Phụ thuộc:** Phase 0
> **File mục tiêu:** [`playwright/tests/support/ui-checks.ts`](../../playwright/tests/support/ui-checks.ts)
> **Review gần nhất:** `NOT APPROVED` — 2026-10-23; xem [biên bản review](evidence/PHASE_1_REVIEW_2026-10-23.md).

---

## 1. Mục Tiêu & Các Loại Bug UI/UX Cần Bắt Tự Động Bằng Code

Hiện tại, [`playwright/tests/support/ui-checks.ts`](../../playwright/tests/support/ui-checks.ts) đã có 7 hàm kiểm tra cơ bản (`expectNoOverlap`, `expectPairwiseNoOverlap`, `expectNoHorizontalOverflow`, `expectContainedWithin`, `expectNoBrokenImages`, `expectMaxLengthEnforced`, `expectNumericInputRejectsText`).

Tuy nhiên, trong thực tế kiểm thử giao diện chuyên sâu (Deep UI/UX), có **4 nhóm lỗi giao diện nghiêm trọng** vẫn lọt qua các hàm trên:

1. **Lỗi cắt chữ nội bộ (`Internal Text Clipping / Truncation Bug`)**:
   - Thẻ `<button>` hoặc `<div class="error">` nằm gọn trong khung `<form>` (nên `expectContainedWithin` báo PASS), nhưng do CSS đặt `max-height` / `overflow: hidden` hoặc `white-space: nowrap`, phần chữ bên trong bị cắt mất một nửa (`element.scrollWidth > element.clientWidth` hoặc `element.scrollHeight > element.clientHeight`).
2. **Lỗi che khuất theo trục Z (`Z-Index Occlusion / Unclickable Control Bug`)**:
   - Nút `Submit` hoặc ô `Input` có `toBeVisible() === true`, nhưng bị một thanh sticky header/footer, toast thông báo, hoặc lớp backdrop trong suốt đè lên trên theo trục Z (`z-index`), khiến người dùng thật bấm vào không ăn. Có thể dùng hit-test như `document.elementFromPoint(centerX, centerY)` để kiểm tra phần tử nhận click thực tế tại tâm điểm.
3. **Lỗi vùng chạm quá nhỏ trên Mobile (`Small Touch / Tap Target Bug` — WCAG 2.2 SC 2.5.8)**:
   - Trên màn hình Mobile (`375x667`), nút bấm, link hoặc icon đóng/mở có kích thước nhỏ hơn `24x24px` (chuẩn tối thiểu WCAG 2.2 AA) làm người dùng bấm trượt.
4. **Thiếu hàm kiểm toán tổng hợp 1 dòng (`One-Line Composite UI Audit`)**:
   - Nếu bắt tester gọi rời rạc 5–6 hàm trong mỗi test thì code spec sẽ dài và dễ bị bỏ quên. Cần một hàm tổng hợp `expectCleanUiState(page, options)` để kiểm tra nhanh toàn bộ sức khỏe giao diện tại bất kỳ trạng thái nào của trang.

---

## 2. Thiết Kế Chi Tiết Các Hàm Bổ Sung Trong `ui-checks.ts`

### 2.1. Hàm `expectNoTextClipping(locator, tolerancePx = 2)`
Kiểm tra phần tử không bị cắt mất nội dung chữ bên trong do `overflow: hidden` / `clip` mà không có chủ đích:

```typescript
/**
 * 7. Kiểm tra phần tử hiển thị văn bản (nhãn nút, thông báo lỗi, tiêu đề) không bị cắt cụt
 * nội dung bên trong (scrollWidth > clientWidth hoặc scrollHeight > clientHeight khi bị ẩn thanh cuộn).
 */
export async function expectNoTextClipping(
  locator: Locator,
  tolerancePx = 2,
): Promise<void> {
  await expect(locator).toBeVisible();

  const metrics = await locator.evaluate((el, tol) => {
    const style = window.getComputedStyle(el);
    const clipsX =
      style.overflowX === 'hidden' || style.overflowX === 'clip';
    const clipsY = style.overflowY === 'hidden' || style.overflowY === 'clip';

    const clippedWidth = clipsX ? el.scrollWidth - el.clientWidth : 0;
    const clippedHeight = clipsY ? el.scrollHeight - el.clientHeight : 0;

    return {
      clippedWidth,
      clippedHeight,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      tag: el.tagName.toLowerCase(),
      clipped: clippedWidth > tol || clippedHeight > tol,
    };
  }, tolerancePx);

  expect(
    metrics.clipped,
    `Phần tử <${metrics.tag}> bị cắt mất nội dung bên trong: ` +
      `scroll=(${metrics.scrollWidth}x${metrics.scrollHeight}) vs client=(${metrics.clientWidth}x${metrics.clientHeight})`,
  ).toBe(false);
}
```

### 2.2. Hàm `expectNotOccluded(locator)` (Kiểm tra che khuất trục Z bằng Hit-Test)
Đảm bảo tại tâm của phần tử tương tác (`button`, `input`, `a`), không có phần tử ngoại lai nào đè lên trên mặt phẳng hiển thị:

```typescript
/**
 * 8. Kiểm tra phần tử tương tác không bị lớp phủ (overlay, sticky header/footer, toast)
 * che khuất tại điểm chính giữa theo trục Z (document.elementFromPoint).
 */
export async function expectNotOccluded(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();

  const hitResult = await locator.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const topEl = document.elementFromPoint(centerX, centerY);

    if (!topEl) {
      return { ok: false, reason: `Toạ độ tâm (${Math.round(centerX)}, ${Math.round(centerY)}) nằm ngoài viewport` };
    }

    // Chỉ chấp nhận target/descendant, không chấp nhận ancestor tùy tiện.
    const isSelfOrRelated = el === topEl || el.contains(topEl);
    return {
      ok: isSelfOrRelated,
      reason: isSelfOrRelated
        ? ''
        : `Bị che khuất bởi <${topEl.tagName.toLowerCase()} class="${topEl.className}"> tại (${Math.round(centerX)}, ${Math.round(centerY)})`,
    };
  });

  expect(hitResult.ok, `Phần tử bị che khuất (Z-index Occlusion): ${hitResult.reason}`).toBe(true);
}
```

### 2.3. Hàm `expectMinTapTargetSize(locator, minWidth = 24, minHeight = 24)`
Kiểm tra kích thước vùng bấm tối thiểu theo chuẩn WCAG 2.2 AA (`24x24px`) hoặc chuẩn Mobile khuyên dùng (`44x44px`):

```typescript
/**
 * 9. Kiểm tra kích thước vùng chạm/bấm (Tap Target Size) đạt chuẩn tối thiểu
 * (Mặc định 24x24px theo WCAG 2.2 AA SC 2.5.8; có thể truyền 44x44px cho Mobile).
 */
export async function expectMinTapTargetSize(
  locator: Locator,
  minWidth = 24,
  minHeight = 24,
): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, 'Phần tử phải có boundingBox').not.toBeNull();

  if (box) {
    expect(
      box.width >= minWidth && box.height >= minHeight,
      `Kích thước vùng bấm quá nhỏ: (${Math.round(box.width)}x${Math.round(box.height)}px), yêu cầu tối thiểu (${minWidth}x${minHeight}px)`,
    ).toBe(true);
  }
}
```

### 2.4. Hàm tổng hợp `expectCleanUiState(page, options)`
Cho phép kiểm tra toàn diện trạng thái UI/UX chỉ với **1 lệnh gọi**:

```typescript
export type CleanUiStateOptions = {
  /** Danh sách các locator không được phép đè lên nhau (Overlap). */
  nonOverlappingLocators?: readonly Locator[];
  /** Danh sách các phần tử tương tác không được phép bị che khuất (Z-Index Occlusion). */
  interactiveLocators?: readonly Locator[];
  /** Danh sách các phần tử văn bản không được bị cắt cụt nội dung. */
  textLocators?: readonly Locator[];
  /** Kiểm tra ảnh vỡ (mặc định: true). */
  checkBrokenImages?: boolean;
  /** Kiểm tra tràn khung ngang (mặc định: true). */
  checkHorizontalOverflow?: boolean;
  /** Sai số pixel cho phép (mặc định: 1). */
  tolerancePx?: number;
};

/**
 * 10. Kiểm toán tổng hợp trạng thái giao diện (One-Call Deep UI/UX Check):
 * - Không tràn khung ngang (Horizontal Overflow)
 * - Không có ảnh vỡ (Broken Images)
 * - Các phần tử chỉ định không đè nhau (Pairwise No Overlap)
 * - Các nút/ô nhập không bị che khuất theo trục Z (Not Occluded)
 * - Các thông báo/nhãn không bị cắt cụt chữ (No Text Clipping)
 */
export async function expectCleanUiState(
  page: Page,
  options: CleanUiStateOptions = {},
): Promise<void> {
  const tolerancePx = options.tolerancePx ?? 1;

  if (options.checkHorizontalOverflow !== false) {
    await expectNoHorizontalOverflow(page, tolerancePx);
  }

  if (options.checkBrokenImages !== false) {
    await expectNoBrokenImages(page);
  }

  if (options.nonOverlappingLocators && options.nonOverlappingLocators.length > 1) {
    await expectPairwiseNoOverlap(options.nonOverlappingLocators, tolerancePx);
  }

  if (options.interactiveLocators) {
    for (const loc of options.interactiveLocators) {
      await expectNotOccluded(loc);
    }
  }

  if (options.textLocators) {
    for (const loc of options.textLocators) {
      await expectNoTextClipping(loc, tolerancePx);
    }
  }
}
```

---

### 2.5. Hợp đồng bắt buộc bổ sung trong bản 1.1

Các snippet trên minh họa phép đo; phải bổ sung trước nghiệm thu:

- Geometry dùng expect.poll/toPass với timeout hữu hạn, lấy metrics lại mỗi lần thử khi font/layout sẵn sàng; không assert snapshot evaluate cũ.
- Text clipping đo cả target và ancestor clip rect/text bounds trong phạm vi hỗ trợ. Ellipsis/line-clamp chỉ miễn theo locator có lý do. Unsupported transform/frame/shadow phải ghi rõ.
- Occlusion lấy điểm trong phần giao target/viewport và ownerDocument đúng; ancestor nhận hit không chứng minh control nhận tương tác. Label/shadow DOM xử lý riêng; hit-test chỉ chứng minh các điểm lấy mẫu.
- Locator truyền vào là required; hidden/missing/ambiguous phải fail. Optional có options riêng, reason và số bỏ qua. Không isVisible rồi âm thầm skip. Yêu cầu capability với danh sách rỗng phải báo lỗi cấu hình.
- Composite chuyển tolerancePx nhất quán. Thêm option tapTargets với minWidth/minHeight nếu cần; interactiveLocators chưa bao gồm tap target audit.
- Ngưỡng kích thước chỉ là geometry theo project; các mô tả WCAG trong bản gốc không có nghĩa helper chứng nhận tuân thủ. Kiểm tra initial/error/pending/success riêng.
- Chữ ký helper cũ giữ tương thích; options mới có test.

## 3. Tiêu Chuẩn Nghiệm Thu Phase 1

1. Toàn bộ hàm mới trong [`playwright/tests/support/ui-checks.ts`](../../playwright/tests/support/ui-checks.ts) có đầy đủ JSDoc tiếng Việt rõ ràng và kiểu TypeScript chặt chẽ (`strict: true`).
2. Chạy `npm run verify` trong thư mục `playwright/` đạt `0` lỗi TypeScript và `0` lỗi ESLint.
3. Không sửa đổi bất kỳ chữ ký hàm cũ nào để đảm bảo tương thích ngược 100%.
4. HM-05..HM-07 đủ case sạch/cài bug trên ba browser: overlay, ancestor-hit, hidden/missing, delayed layout, ancestor clipping, ellipsis chưa miễn. Verify static không thay runtime proof.
