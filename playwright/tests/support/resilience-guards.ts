import { expect, type Locator, type Page, type Route } from '@playwright/test';

export interface PreservedInputCheck {
  locator: Locator;
  expectedValue: string;
}

export interface NetworkFaultRecoveryOptions {
  urlPattern: string | RegExp;
  faultMode?: 'http-500' | 'http-503' | 'network-abort';
  errorLocator: Locator;
  expectedErrorPattern?: string | RegExp;
  submitButton?: Locator;
  preservedInputs?: PreservedInputCheck[];
  clearedInputs?: Locator[];
  allowRuntimeTrap?: { allow: (rule: { source: 'http-5xx' | 'requestfailed'; pattern: string | RegExp; reason: string }) => void };
}

/**
 * DH-06 / Gate 4 Step 4: Bơm lỗi mạng (500/503/abort) khi submit để kiểm chứng:
 * 1. Hiển thị thông báo lỗi rõ ràng (errorLocator).
 * 2. Nút Submit thoát khỏi trạng thái loading/disabled (không bị treo xoay vòng vĩnh viễn).
 * 3. Bảo toàn dữ liệu người dùng vừa nhập trên form (preservedInputs), không làm mất trắng.
 */
export async function expectNetworkFaultRecovery(
  page: Page,
  trigger: () => Promise<void>,
  options: NetworkFaultRecoveryOptions,
): Promise<void> {
  const mode = options.faultMode ?? 'http-500';
  if (options.allowRuntimeTrap) {
    options.allowRuntimeTrap.allow({
      source: mode === 'network-abort' ? 'requestfailed' : 'http-5xx',
      pattern: options.urlPattern,
      reason: `Fault injection via expectNetworkFaultRecovery (${mode})`,
    });
  }

  let faultInjected = false;
  const handler = async (route: Route): Promise<void> => {
    if (!faultInjected) {
      faultInjected = true;
      if (mode === 'network-abort') {
        await route.abort('failed');
      } else {
        const status = mode === 'http-503' ? 503 : 500;
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'FAULT_INJECTED', message: `Simulated ${status} fault` }),
        });
      }
      return;
    }
    await route.fallback();
  };

  await page.route(options.urlPattern, handler);
  try {
    await trigger();
    expect(faultInjected, '[expectNetworkFaultRecovery] Fault route was never triggered').toBe(true);
    await expect(options.errorLocator, '[expectNetworkFaultRecovery] Error banner must be visible').toBeVisible();
    if (options.expectedErrorPattern !== undefined) {
      await expect(options.errorLocator).toContainText(options.expectedErrorPattern);
    }

    if (options.submitButton) {
      await expect
        .poll(
          async () =>
            options.submitButton!.evaluate((el) => {
              const btn = el as HTMLButtonElement;
              return (
                btn.disabled === true ||
                el.getAttribute('aria-disabled') === 'true' ||
                el.getAttribute('aria-busy') === 'true' ||
                el.getAttribute('data-loading') === 'true'
              );
            }),
          { message: '[expectNetworkFaultRecovery] Submit button remained stuck in loading/disabled state after failure' },
        )
        .toBe(false);
    }

    if (options.preservedInputs?.length) {
      for (const item of options.preservedInputs) {
        await expect(
          item.locator,
          `[expectNetworkFaultRecovery] Form input value "${item.expectedValue}" was lost after fault`,
        ).toHaveValue(item.expectedValue);
      }
    }

    if (options.clearedInputs?.length) {
      for (const loc of options.clearedInputs) {
        await expect(loc, '[expectNetworkFaultRecovery] Sensitive input must be cleared after fault').toHaveValue('');
      }
    }
  } finally {
    await page.unroute(options.urlPattern, handler).catch(() => {});
  }
}

export interface MultiTabConcurrencyScenario {
  setupBothTabs: (tabA: Page, tabB: Page) => Promise<void>;
  tabAAction: (tabA: Page) => Promise<void>;
  tabBConflictingAction: (tabB: Page) => Promise<void>;
  verifyConflictOrIsolation: (tabA: Page, tabB: Page) => Promise<void>;
}

/**
 * Gate 4 Adversarial Pass: Mở Tab thứ 2 trong cùng BrowserContext để kiểm chứng:
 * - Hai tab cùng sửa 1 bản ghi -> báo xung đột (409) hoặc cảnh báo dữ liệu cũ, cấm ghi đè âm thầm.
 * - Tab A đăng xuất / đổi quyền -> Tab B bị chặn thao tác và điều hướng an toàn.
 */
export async function expectMultiTabConcurrency(
  page: Page,
  scenario: MultiTabConcurrencyScenario,
): Promise<void> {
  const tabB = await page.context().newPage();
  try {
    await scenario.setupBothTabs(page, tabB);
    await scenario.tabAAction(page);
    await scenario.tabBConflictingAction(tabB);
    await scenario.verifyConflictOrIsolation(page, tabB);
  } finally {
    if (!tabB.isClosed()) {
      await tabB.close().catch(() => {});
    }
  }
}

export async function expectPerformanceBudget(
  page: Page,
  action: () => Promise<void>,
  budget: { maxActionMs: number; maxDomInteractiveMs?: number; maxTransferSizeBytes?: number },
): Promise<{ elapsedMs: number }> {
  const start = performance.now();
  await action();
  const elapsedMs = Math.round(performance.now() - start);
  expect(elapsedMs, `[expectPerformanceBudget] ${elapsedMs}ms > ${budget.maxActionMs}ms`).toBeLessThanOrEqual(
    budget.maxActionMs,
  );
  if (budget.maxDomInteractiveMs !== undefined || budget.maxTransferSizeBytes !== undefined) {
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return {
        domInteractiveMs: nav ? Math.round(nav.domInteractive) : 0,
        transferSizeBytes: (nav?.transferSize ?? 0) + res.reduce((s, r) => s + (r.transferSize || 0), 0),
      };
    });
    if (budget.maxDomInteractiveMs !== undefined) expect(m.domInteractiveMs).toBeLessThanOrEqual(budget.maxDomInteractiveMs);
    if (budget.maxTransferSizeBytes !== undefined) expect(m.transferSizeBytes).toBeLessThanOrEqual(budget.maxTransferSizeBytes);
  }
  return { elapsedMs };
}
