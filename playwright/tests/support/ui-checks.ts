import { expect, type Locator, type Page } from '@playwright/test';
import {
  boxesOverlap,
  DEFAULT_VIEWPORTS,
  evaluateContainmentAndAncestorClip,
  evaluateInteractiveA11yInScope,
  evaluateOcclusionOnElement,
  evaluateTextOverflowInScope,
  waitForLayoutStability,
  type BoundingBox,
  type ViewportConfig,
} from './ui-geometry-dom';

export { boxesOverlap, DEFAULT_VIEWPORTS, type BoundingBox, type ViewportConfig };

function pageOf(scope: Page | Locator): Page {
  return 'mainFrame' in scope ? scope : scope.page();
}

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
 * 2. Kiểm tra văn bản không bị tràn/cắt cụt (HM-03: đợi ổn định qua settleMs & bắt đúng selector).
 */
export async function expectNoTextOverflow(
  scope: Page | Locator,
  selectors = 'h1,h2,h3,h4,p,span,label,button,a,td,th,li,[data-testid]',
  options?: {
    allowEllipsis?: boolean;
    allowScrollable?: boolean;
    optionalSelectors?: string;
    settleMs?: number;
    timeout?: number;
  },
): Promise<void> {
  const page = pageOf(scope);
  const timeout = options?.timeout ?? 2_500;
  const settleMs = options?.settleMs ?? 180;

  await expect(async () => {
    await waitForLayoutStability(page, settleMs);
    const res = await evaluateTextOverflowInScope(scope, selectors, {
      allowEllipsis: Boolean(options?.allowEllipsis),
      allowScrollable: Boolean(options?.allowScrollable),
    });
    expect(
      res.visibleCount,
      `expectNoTextOverflow: Bắt buộc có ít nhất 1 phần tử hiển thị khớp selector "${selectors}"`,
    ).toBeGreaterThan(0);
    expect(
      res.offenders,
      `Phát hiện tràn chữ (Text Overflow) tại: ${res.offenders.join('; ')}`,
    ).toEqual([]);

    if (options?.optionalSelectors) {
      const optRes = await evaluateTextOverflowInScope(scope, options.optionalSelectors, {
        allowEllipsis: Boolean(options?.allowEllipsis),
        allowScrollable: Boolean(options?.allowScrollable),
      });
      expect(
        optRes.offenders,
        `Phát hiện tràn chữ trên optional selector tại: ${optRes.offenders.join('; ')}`,
      ).toEqual([]);
    }
  }).toPass({ timeout });
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

/**
 * 6. Kiểm tra các phần tử tương tác đều có nhãn Accessible Name hợp lệ và kích thước bấm được (HM-05).
 */
export async function expectInteractiveA11y(
  scope: Page | Locator,
  options?: { checkFocusRing?: boolean; maxElements?: number; timeout?: number },
): Promise<void> {
  const timeout = options?.timeout ?? 2_500;
  const maxElements = options?.maxElements ?? 50;

  await expect(async () => {
    const res = await evaluateInteractiveA11yInScope(scope, maxElements);
    expect(
      res.visibleInteractiveCount,
      'Phải có ít nhất 1 phần tử tương tác hiển thị trong vùng kiểm tra',
    ).toBeGreaterThan(0);
    expect(
      res.violations,
      `Vi phạm Interactive Accessibility: ${res.violations.join('; ')}`,
    ).toEqual([]);
  }).toPass({ timeout });
}

/**
 * 7. Kiểm tra tính toàn vẹn Responsive qua nhiều breakpoint (mobile 320px, tablet 768px, desktop 1280px).
 */
export async function expectResponsiveIntegrity(
  page: Page,
  options?: {
    viewports?: ViewportConfig[];
    requiredLocators?: Locator[];
    optionalLocators?: Locator[];
    checkLocators?: Locator[];
    timeout?: number;
  },
): Promise<void> {
  const viewports = options?.viewports ?? DEFAULT_VIEWPORTS;
  const required = options?.requiredLocators ?? options?.checkLocators ?? [];
  const optional = options?.optionalLocators ?? [];
  const initialViewport = page.viewportSize();

  try {
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await expectNoHorizontalScroll(page, vp.name, { timeout: options?.timeout });

      const activeLocators: Locator[] = [];
      for (const reqLoc of required) {
        const target = reqLoc.first();
        await expect(
          target,
          `[${vp.name}] Required locator phải hiển thị trên viewport ${vp.width}x${vp.height}`,
        ).toBeVisible();
        await expectNotOccluded(target, { timeout: options?.timeout });
        activeLocators.push(target);
      }

      for (const optLoc of optional) {
        if ((await optLoc.count()) > 0 && (await optLoc.first().isVisible())) {
          await expectNotOccluded(optLoc.first(), { timeout: options?.timeout });
          activeLocators.push(optLoc.first());
        }
      }

      if (activeLocators.length >= 2) {
        await expectPairwiseNoOverlap(activeLocators, { timeout: options?.timeout });
      }
    }
  } finally {
    if (initialViewport) {
      await page.setViewportSize(initialViewport).catch(() => {});
    }
  }
}

export async function expectNoBrokenImages(page: Page): Promise<void> {
  const broken = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img'))
      .filter((img) => {
        const st = window.getComputedStyle(img);
        return (
          st.display !== 'none' &&
          st.visibility !== 'hidden' &&
          img.getBoundingClientRect().width > 0 &&
          (!img.complete || img.naturalWidth === 0)
        );
      })
      .map((img) => img.getAttribute('src') || '<unnamed-img>'),
  );
  expect(broken, `Phát hiện ảnh bị vỡ: ${broken.join(', ')}`).toEqual([]);
}
