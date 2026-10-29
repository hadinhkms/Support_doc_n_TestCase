import { expect, type Locator, type Page } from '@playwright/test';
import {
  boxesOverlap,
  DEFAULT_VIEWPORTS,
  evaluateInteractiveA11yInScope,
  evaluateTextOverflowInScope,
  waitForLayoutStability,
  type BoundingBox,
  type ViewportConfig,
} from './ui-geometry-dom';
import {
  expectContainedIn,
  expectContainedWithin,
  expectNoHorizontalOverflow,
  expectNoHorizontalScroll,
  expectNoOverlap,
  expectNotOccluded,
  expectPairwiseNoOverlap,
} from './ui-box-checks';

export {
  boxesOverlap,
  DEFAULT_VIEWPORTS,
  expectContainedIn,
  expectContainedWithin,
  expectNoHorizontalOverflow,
  expectNoHorizontalScroll,
  expectNoOverlap,
  expectNotOccluded,
  expectPairwiseNoOverlap,
  type BoundingBox,
  type ViewportConfig,
};

function pageOf(scope: Page | Locator): Page {
  return 'mainFrame' in scope ? scope : scope.page();
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
