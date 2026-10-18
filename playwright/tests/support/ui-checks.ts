import { expect, type Locator, type Page } from '@playwright/test';

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Kiểm tra hai hình chữ nhật có giao nhau (đè lên nhau) vượt quá sai số cho phép hay không.
 */
export function boxesOverlap(a: BoundingBox, b: BoundingBox, tolerancePx = 1): boolean {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlapX > tolerancePx && overlapY > tolerancePx;
}

/**
 * 1. Kiểm tra hai phần tử trên UI không bị đè lên nhau (Overlap).
 * Rất hữu ích khi thông báo lỗi validation xuất hiện bên dưới input gần nút Submit.
 */
export async function expectNoOverlap(
  locatorA: Locator,
  locatorB: Locator,
  tolerancePx = 1,
): Promise<void> {
  await expect(locatorA).toBeVisible();
  await expect(locatorB).toBeVisible();

  const [boxA, boxB] = await Promise.all([locatorA.boundingBox(), locatorB.boundingBox()]);
  expect(boxA, 'Phần tử thứ nhất phải có boundingBox').not.toBeNull();
  expect(boxB, 'Phần tử thứ hai phải có boundingBox').not.toBeNull();

  if (boxA && boxB) {
    const overlapped = boxesOverlap(boxA, boxB, tolerancePx);
    expect(
      overlapped,
      `Hai phần tử bị đè lên nhau (Overlap): A=${JSON.stringify(boxA)}, B=${JSON.stringify(boxB)}`,
    ).toBe(false);
  }
}

/**
 * Kiểm tra một nhóm các phần tử (ví dụ: [emailInput, emailError, passwordInput, submitButton])
 * đôi một không có cặp nào đè lên nhau.
 */
export async function expectPairwiseNoOverlap(
  locators: readonly Locator[],
  tolerancePx = 1,
): Promise<void> {
  const boxes: { index: number; box: BoundingBox }[] = [];

  for (let i = 0; i < locators.length; i++) {
    const loc = locators[i];
    if (await loc.isVisible()) {
      const box = await loc.boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        boxes.push({ index: i, box });
      }
    }
  }

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      expect(
        boxesOverlap(a.box, b.box, tolerancePx),
        `Phần tử #${a.index} và #${b.index} bị đè lên nhau: ${JSON.stringify(a.box)} vs ${JSON.stringify(b.box)}`,
      ).toBe(false);
    }
  }
}

/**
 * 2. Kiểm tra trang không bị vỡ khung ngang (Horizontal Overflow / thanh cuộn ngang ngoài ý muốn).
 * Dùng cho cả màn hình Desktop lẫn Mobile (375x667).
 */
export async function expectNoHorizontalOverflow(page: Page, tolerancePx = 1): Promise<void> {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });

  expect(
    metrics.scrollWidth - metrics.clientWidth,
    `Trang bị tràn khung ngang: scrollWidth (${metrics.scrollWidth}px) > clientWidth (${metrics.clientWidth}px)`,
  ).toBeLessThanOrEqual(tolerancePx);
}

/**
 * 3. Kiểm tra phần tử con (ví dụ: đoạn text dài ở biên maxlength) nằm gọn trong khung chứa cha,
 * không bị tràn ra ngoài.
 */
export async function expectContainedWithin(
  child: Locator,
  container: Locator,
  tolerancePx = 1,
): Promise<void> {
  await expect(child).toBeVisible();
  await expect(container).toBeVisible();

  const [childBox, containerBox] = await Promise.all([
    child.boundingBox(),
    container.boundingBox(),
  ]);
  expect(childBox, 'Phần tử con phải có boundingBox').not.toBeNull();
  expect(containerBox, 'Khung chứa cha phải có boundingBox').not.toBeNull();

  if (childBox && containerBox) {
    expect(
      childBox.x >= containerBox.x - tolerancePx &&
        childBox.y >= containerBox.y - tolerancePx &&
        childBox.x + childBox.width <= containerBox.x + containerBox.width + tolerancePx &&
        childBox.y + childBox.height <= containerBox.y + containerBox.height + tolerancePx,
      `Phần tử con tràn ra ngoài khung chứa: child=${JSON.stringify(childBox)}, container=${JSON.stringify(containerBox)}`,
    ).toBe(true);
  }
}

/**
 * 4. Kiểm tra toàn bộ thẻ <img> đang hiển thị trên trang đều tải thành công (không bị vỡ ảnh).
 */
export async function expectNoBrokenImages(page: Page): Promise<void> {
  const brokenImages = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs
      .filter((img) => {
        const style = window.getComputedStyle(img);
        const isVisible =
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          img.getBoundingClientRect().width > 0;
        return isVisible && (!img.complete || img.naturalWidth === 0);
      })
      .map((img) => img.getAttribute('src') || img.getAttribute('alt') || '<unnamed-img>');
  });

  expect(brokenImages, `Phát hiện ảnh bị lỗi/vỡ: ${brokenImages.join(', ')}`).toEqual([]);
}

/**
 * 5. Kiểm tra textbox giới hạn đúng maxlength khi nhập chuỗi vượt biên (max + 1).
 */
export async function expectMaxLengthEnforced(
  input: Locator,
  maxLength: number,
  sampleChar = 'a',
): Promise<void> {
  const overLimitText = sampleChar.repeat(maxLength + 1);
  await input.fill(overLimitText);
  const actualValue = await input.inputValue();
  expect(
    actualValue.length,
    `Textbox không chặn ở maxlength=${maxLength} (độ dài thực tế: ${actualValue.length})`,
  ).toBeLessThanOrEqual(maxLength);
}

/**
 * 6. Kiểm tra textbox chỉ nhập số: khi người dùng gõ chữ/ký tự đặc biệt thì không nhận chữ.
 */
export async function expectNumericInputRejectsText(
  input: Locator,
  invalidChars = 'abc!@#',
): Promise<void> {
  await input.clear();
  await input.pressSequentially(invalidChars);
  const actualValue = await input.inputValue();
  expect(
    actualValue,
    `Textbox số vẫn cho phép nhập ký tự không phải số: "${actualValue}"`,
  ).not.toMatch(/[a-zA-Z!@#$%^&*()]/);
}
