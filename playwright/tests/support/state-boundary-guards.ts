import { expect, type Locator, type Page, type Request, type Response } from '@playwright/test';

export const DEFAULT_MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export function matchesUrlPattern(
  req: Request,
  pattern?: string | RegExp | ((request: Request) => boolean),
): boolean {
  if (!pattern) return true;
  if (typeof pattern === 'function') return pattern(req);
  const url = req.url();
  return typeof pattern === 'string'
    ? url.includes(pattern.replace(/^\*\*\/?/, ''))
    : pattern.test(url);
}

/** HM-08: Kiểm chứng trạng thái bền vững trước và sau page.reload() (chống optimistic UI giả). */
export async function expectStatePersistence(
  page: Page,
  assertFn: () => Promise<void>,
  options?: { expectStorageKeys?: { storage: 'local' | 'session'; key: string }[] },
): Promise<void> {
  await assertFn();
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (options?.expectStorageKeys?.length) {
    for (const item of options.expectStorageKeys) {
      const val = await page.evaluate(
        ({ storage, key }) =>
          storage === 'local'
            ? window.localStorage.getItem(key)
            : window.sessionStorage.getItem(key),
        item,
      );
      expect(
        val,
        `[expectStatePersistence] Storage key "${item.key}" missing after reload`,
      ).not.toBeNull();
    }
  }
  await assertFn();
}

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
): Promise<void> {
  const forbidMutation =
    options?.forbidMutationRequest !== false && !options?.allowServerValidation;
  const mutationRequests: Request[] = [];
  const responsePromises: Promise<Response | null>[] = [];

  const onRequest = (req: Request): void => {
    if (
      DEFAULT_MUTATION_METHODS.includes(req.method().toUpperCase()) &&
      matchesUrlPattern(req, options?.mutationUrlPattern)
    ) {
      mutationRequests.push(req);
      responsePromises.push(req.response().catch(() => null));
    }
  };

  page.on('request', onRequest);
  try {
    await trigger();
    await new Promise((resolve) => setTimeout(resolve, 60));
  } finally {
    page.off('request', onRequest);
  }

  await expect(errorLocator, '[expectBoundaryRejected] Error locator must be visible').toBeVisible();
  if (options?.expectedPattern !== undefined) {
    await expect(errorLocator).toContainText(options.expectedPattern);
  }

  if (forbidMutation) {
    expect(mutationRequests, '[expectBoundaryRejected] Expected 0 mutation requests').toHaveLength(
      0,
    );
  } else if (options?.allowServerValidation && responsePromises.length > 0) {
    const responses = (await Promise.all(responsePromises)).filter(
      (r): r is Response => r !== null,
    );
    for (const res of responses) {
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    }
  }
}

