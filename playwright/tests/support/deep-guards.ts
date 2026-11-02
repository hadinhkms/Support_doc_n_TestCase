import { expect, type Dialog, type Locator, type Page, type Request, type Response } from '@playwright/test';
import { DEFAULT_MUTATION_METHODS, matchesUrlPattern } from './state-boundary-guards';

export {
  expectNetworkFaultRecovery,
  expectMultiTabConcurrency,
  expectPerformanceBudget,
  type PreservedInputCheck,
  type NetworkFaultRecoveryOptions,
  type MultiTabConcurrencyScenario,
} from './resilience-guards';

export { expectStatePersistence, expectBoundaryRejected } from './state-boundary-guards';

export const XSS_PAYLOADS = [
  '<img src=x onerror="window.__xss_triggered=true">',
  '"><script>window.__xss_triggered=true</script>',
  '<svg onload="window.__xss_triggered=true">',
  'javascript:window.__xss_triggered=true',
] as const;

export const SQLI_EDGE_PAYLOADS = ["' OR '1'='1' --", "admin'--", '1; DROP TABLE users --'] as const;

export const UNICODE_OVERFLOW_PAYLOADS = ['\u0000\u200B\uFEFF', '👨‍👩‍👧‍👦'.repeat(20), 'A'.repeat(1024)] as const;

async function isButtonDisabledOrBusy(locator: Locator): Promise<boolean> {
  return locator
    .evaluate((el) => {
      const btn = el as HTMLButtonElement;
      return (
        btn.disabled === true ||
        el.getAttribute('aria-disabled') === 'true' ||
        el.getAttribute('aria-busy') === 'true' ||
        el.getAttribute('data-loading') === 'true' ||
        el.classList.contains('loading') ||
        el.classList.contains('is-loading')
      );
    })
    .catch(() => false);
}

/** HM-06: Kiểm chứng tính idempotent khi bấm đúp / gửi đồng thời (chặn >1 request, 409/5xx, quên khoá nút). */
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
): Promise<Response> {
  const methods = (options?.methods ?? DEFAULT_MUTATION_METHODS).map((m) => m.toUpperCase());
  const requireLock = options?.requireDisabledOrLoading !== false;
  const settleMs = options?.settleMs ?? 200;
  const btnLocator = options?.buttonLocator ?? (typeof trigger !== 'function' ? trigger : undefined);
  const matchedRequests: Request[] = [];
  const responsePromises: Promise<Response | null>[] = [];
  let sawDisabledOrBusy = false;

  const sampleButtonLock = async (): Promise<void> => {
    if (btnLocator && !sawDisabledOrBusy && (await isButtonDisabledOrBusy(btnLocator))) {
      sawDisabledOrBusy = true;
    }
  };

  const onRequest = (req: Request): void => {
    if (methods.includes(req.method().toUpperCase()) && matchesUrlPattern(req, urlPattern)) {
      matchedRequests.push(req);
      responsePromises.push(req.response().catch(() => null));
      void sampleButtonLock();
    }
  };

  page.on('request', onRequest);
  try {
    if (typeof trigger === 'function') {
      await trigger();
    } else {
      await trigger.click();
      await sampleButtonLock();
      await trigger.click({ force: true, timeout: 500 }).catch(() => {});
    }
    await sampleButtonLock();
    await new Promise((resolve) => setTimeout(resolve, settleMs));
    await sampleButtonLock();
  } finally {
    page.off('request', onRequest);
  }

  expect(
    matchedRequests.length,
    `[expectIdempotentSubmit] Expected exactly 1 mutation request, got ${matchedRequests.length}`,
  ).toBe(1);

  if (requireLock && btnLocator) {
    expect(
      sawDisabledOrBusy,
      '[expectIdempotentSubmit] Expected submit button to be disabled or aria-busy during submission',
    ).toBe(true);
  }

  const responses = (await Promise.all(responsePromises)).filter((r): r is Response => r !== null);
  expect(responses.length, '[expectIdempotentSubmit] Expected mutation HTTP response').toBeGreaterThanOrEqual(1);
  for (const res of responses) {
    expect(res.status(), '[expectIdempotentSubmit] Unexpected HTTP 409 Conflict').not.toBe(409);
    expect(res.status(), `[expectIdempotentSubmit] Unexpected HTTP 5xx (${res.status()})`).toBeLessThan(500);
  }

  if (options?.postSubmitAssert) await options.postSubmitAssert(responses[0]);
  return responses[0];
}

/** HM-07: Kiểm chứng XSS payload phản chiếu an toàn vào sink đang hiển thị mà không thực thi mã độc. */
export async function expectSafeXssRender(
  page: Page,
  inputAction: (payload: string) => Promise<void>,
  options: { sinkLocator: Locator; payloads?: readonly string[]; expectReflectedText?: boolean },
): Promise<void> {
  const payloads = options.payloads ?? XSS_PAYLOADS;
  const expectReflected = options.expectReflectedText !== false;
  expect(payloads.length, '[expectSafeXssRender] Payloads list cannot be empty').toBeGreaterThan(0);

  let dialogTriggered = '';
  const onDialog = (dialog: Dialog): void => {
    dialogTriggered = `${dialog.type()}: ${dialog.message()}`;
    void dialog.dismiss().catch(() => {});
  };

  page.on('dialog', onDialog);
  try {
    for (const payload of payloads) {
      dialogTriggered = '';
      await page.evaluate(() => {
        (window as unknown as Record<string, unknown>).__xss_triggered = false;
      });
      await inputAction(payload);
      await expect(options.sinkLocator, '[expectSafeXssRender] Sink locator must be attached').toBeAttached();

      const audit = await options.sinkLocator.evaluate((sink) => {
        const win = window as unknown as Record<string, unknown>;
        const selector =
          'script, iframe, object, embed, svg[onload], [onerror], [onload], [onclick], [onmouseover], a[href^="javascript:" i]';
        return {
          xssTriggered: win.__xss_triggered === true,
          dangerousNodes: Array.from(sink.querySelectorAll(selector)).map((el) => el.tagName.toLowerCase()),
          textContent: (sink.textContent || '').trim(),
        };
      });

      expect(dialogTriggered, `[expectSafeXssRender] Unexpected dialog for "${payload}"`).toBe('');
      expect(audit.xssTriggered, `[expectSafeXssRender] __xss_triggered sentinel fired for "${payload}"`).toBe(false);
      expect(
        audit.dangerousNodes,
        `[expectSafeXssRender] Dangerous DOM elements injected for "${payload}": ${audit.dangerousNodes.join(', ')}`,
      ).toEqual([]);
      await expect(options.sinkLocator, '[expectSafeXssRender] Sink locator must be visible').toBeVisible();
      if (expectReflected) {
        expect(audit.textContent, `[expectSafeXssRender] Sink must safely reflect "${payload}"`).toContain(payload);
      }
    }
  } finally {
    page.off('dialog', onDialog);
  }
}
