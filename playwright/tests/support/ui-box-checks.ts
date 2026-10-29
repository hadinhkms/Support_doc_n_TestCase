import { expect, type Locator, type Page } from '@playwright/test';
import {
  boxesOverlap,
  evaluateContainmentAndAncestorClip,
  evaluateOcclusionOnElement,
  waitForLayoutStability,
  type BoundingBox,
} from './ui-geometry-dom';

/**
 * 1. Kiểm tra trang không xuất hiện thanh cuộn ngang ngoài ý muốn (Retrying + Font/RAF stability).
 */
export async function expectNoHorizontalScroll(
  page: Page,
  label = 'viewport',
  options?: { tolerancePx?: number; timeout?: number },
): Promise<void> {
  const tolerancePx = options?.tolerancePx ?? 1;
  const timeout = options?.timeout ?? 2_500;

  await expect(async () => {
    await waitForLayoutStability(page, 16);
    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollWidth = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
      return { scrollWidth, clientWidth: doc.clientWidth };
    });
    expect(
      metrics.scrollWidth - metrics.clientWidth,
      `[${label}] Trang bị tràn khung ngang: scrollWidth (${metrics.scrollWidth}px) > clientWidth (${metrics.clientWidth}px)`,
    ).toBeLessThanOrEqual(tolerancePx);
  }).toPass({ timeout });
}

export async function expectNoHorizontalOverflow(page: Page, tolerancePx = 1): Promise<void> {
  await expectNoHorizontalScroll(page, 'viewport', { tolerancePx });
}

/**
 * 3. Kiểm tra danh sách phần tử đôi một không đè lên nhau (Nghiêm cấm bỏ qua phần tử ẩn - BR-14-P2-02).
 */
export async function expectPairwiseNoOverlap(
  locators: readonly Locator[],
  options?: number | { tolerancePx?: number; timeout?: number },
): Promise<void> {
  const tolerancePx = typeof options === 'number' ? options : (options?.tolerancePx ?? 1);
  const timeout = typeof options === 'number' ? 2_500 : (options?.timeout ?? 2_500);
  expect(locators.length, 'expectPairwiseNoOverlap cần ít nhất 2 locator').toBeGreaterThanOrEqual(2);

  await expect(async () => {
    const boxes: { index: number; box: BoundingBox }[] = [];
    for (let i = 0; i < locators.length; i++) {
      const loc = locators[i]!;
      const visible = await loc.isVisible();
      expect(
        visible,
        `Phần tử #${i} không hiển thị (isVisible=false) — expectPairwiseNoOverlap cấm bỏ qua âm thầm`,
      ).toBe(true);
      const box = await loc.boundingBox();
      expect(box, `Phần tử #${i} phải có boundingBox hợp lệ`).not.toBeNull();
      expect(box!.width, `Phần tử #${i} có width <= 0`).toBeGreaterThan(0);
      expect(box!.height, `Phần tử #${i} có height <= 0`).toBeGreaterThan(0);
      boxes.push({ index: i, box: box! });
    }

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        expect(
          boxesOverlap(a.box, b.box, tolerancePx),
          `Phần tử #${a.index} và #${b.index} bị đè lên nhau (overlap): ${JSON.stringify(a.box)} vs ${JSON.stringify(b.box)}`,
        ).toBe(false);
      }
    }
  }).toPass({ timeout });
}

export async function expectNoOverlap(
  locatorA: Locator,
  locatorB: Locator,
  tolerancePx = 1,
): Promise<void> {
  await expectPairwiseNoOverlap([locatorA, locatorB], { tolerancePx });
}

/**
 * 4. Kiểm tra phần tử con nằm gọn trong phần tử cha và không bị cắt bởi ancestor overflow.
 */
export async function expectContainedIn(
  child: Locator,
  parent: Locator,
  tolerancePx = 1,
  options?: { checkAncestorClips?: boolean; timeout?: number },
): Promise<void> {
  const timeout = options?.timeout ?? 2_500;
  const checkAncestorClips = options?.checkAncestorClips ?? true;

  await expect(async () => {
    await expect(child).toBeVisible();
    await expect(parent).toBeVisible();
    const res = await evaluateContainmentAndAncestorClip(
      child,
      parent,
      tolerancePx,
      checkAncestorClips,
    );
    expect(res.ok, res.reason).toBe(true);
  }).toPass({ timeout });
}

export const expectContainedWithin = expectContainedIn;

/**
 * 5. Kiểm tra phần tử không bị che khuất bởi sticky header/modal/ancestor clip tại tâm và 4 góc (HM-04).
 */
export async function expectNotOccluded(
  locator: Locator,
  options?: {
    samplePoints?: ('center' | 'corners')[];
    scrollIntoView?: boolean;
    timeout?: number;
  },
): Promise<void> {
  const timeout = options?.timeout ?? 2_500;
  const samplePoints = options?.samplePoints ?? ['center', 'corners'];
  if (options?.scrollIntoView !== false) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
  }

  await expect(async () => {
    await expect(locator, 'Phần tử mục tiêu phải hiển thị trước khi đo che khuất').toBeVisible();
    const res = await evaluateOcclusionOnElement(locator, samplePoints);
    expect(res.ok, `Phần tử bị che khuất (occluded): ${res.reason}`).toBe(true);
  }).toPass({ timeout });
}

