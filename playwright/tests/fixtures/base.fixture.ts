import { test as base, expect, type Page } from '@playwright/test';

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
  allowRecord(record: RuntimeFailureRecord): void;
  clearAllowed(): void;
  getUnexpectedRecords(): RuntimeFailureRecord[];
  flushBrowserQueue(): Promise<void>;
  assertClean(): void;
}

const SENSITIVE_HEADER_NAME =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token)$/i;
const SENSITIVE_KEY_PART = /(token|secret|password|passwd|api[-_]?key|session|sid)/i;
const SENSITIVE_QUERY_PARAM =
  /([?&](?:token|access_token|refresh_token|api_key|apikey|password|secret|auth|key|session|sid)=)([^&#\s]+)/gi;
const SENSITIVE_AUTH_SCHEME = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi;

export function redactSensitiveText(input: string): string {
  if (!input) return input;
  return input
    .replace(SENSITIVE_QUERY_PARAM, '$1[REDACTED]')
    .replace(SENSITIVE_AUTH_SCHEME, '$1 [REDACTED]');
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_NAME.test(key) || SENSITIVE_KEY_PART.test(key)) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = redactSensitiveText(value);
    }
  }
  return out;
}

export function matchesAllowRule(record: RuntimeFailureRecord, rule: RuntimeAllowRule): boolean {
  if (rule.source !== '*' && rule.source !== record.source) {
    return false;
  }
  if (rule.status !== undefined && rule.status !== record.status) {
    return false;
  }
  const haystacks = [record.message, record.url ?? ''];
  const { pattern } = rule;
  if (typeof pattern === 'string') {
    return haystacks.some((h) => h.includes(pattern));
  }
  return haystacks.some((h) => pattern.test(h));
}

function isCriticalResourceType(resourceType: string): boolean {
  return resourceType === 'document' || resourceType === 'xhr' || resourceType === 'fetch';
}

function isBenignAbortedSubresource(
  url: string,
  resourceType: string,
  errorText: string,
): boolean {
  if (isCriticalResourceType(resourceType)) {
    return false;
  }
  if (url.endsWith('/favicon.ico')) {
    return true;
  }
  return /ERR_ABORTED|NS_BINDING_ABORTED|cancelled|canceled/i.test(errorText);
}

interface InternalRuntimeTrap extends RuntimeTrap {
  getUnacknowledgedForTeardown(): RuntimeFailureRecord[];
}

export function createRuntimeTrap(page: Page): InternalRuntimeTrap {
  const records: RuntimeFailureRecord[] = [];
  const allowRules: RuntimeAllowRule[] = [];
  const allowedRecords = new WeakSet<RuntimeFailureRecord>();
  const inspectedRecords = new WeakSet<RuntimeFailureRecord>();

  page.on('pageerror', (err) => {
    const rawMessage = err?.stack || err?.message || String(err);
    records.push({
      source: 'pageerror',
      message: redactSensitiveText(rawMessage),
      url: redactSensitiveText(page.url()),
      timestamp: new Date().toISOString(),
    });
  });

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    const locUrl = redactSensitiveText(msg.location()?.url || '');
    // Chỉ bỏ qua bản tin console tự động của trình duyệt khi có đúng một bản ghi http-5xx tương ứng cùng URL.
    const isBrowserNetworkEcho =
      /^Failed to load resource: the server responded with a status of 5\d{2}\b/.test(text) &&
      Boolean(locUrl) &&
      records.some((r) => r.source === 'http-5xx' && r.url === locUrl);
    if (isBrowserNetworkEcho) {
      return;
    }
    records.push({
      source: 'console.error',
      message: redactSensitiveText(text),
      url: locUrl || redactSensitiveText(page.url()),
      timestamp: new Date().toISOString(),
    });
  });

  const recordRequestFailure = (
    rawUrl: string,
    method: string,
    resourceType: string,
    errorText: string,
    headers: Record<string, string> = {},
  ): void => {
    if (isBenignAbortedSubresource(rawUrl, resourceType, errorText)) {
      return;
    }
    const redactedUrl = redactSensitiveText(rawUrl);
    if (
      resourceType === 'fetch' &&
      records.some(
        (r) => r.source === 'requestfailed' && r.resourceType === 'fetch' && r.url === redactedUrl,
      )
    ) {
      return;
    }
    records.push({
      source: 'requestfailed',
      message: redactSensitiveText(`${method} ${rawUrl} failed: ${errorText}`),
      url: redactedUrl,
      method,
      resourceType,
      timestamp: new Date().toISOString(),
      redactedHeaders: redactHeaders(headers),
    });
  };

  void page
    .exposeBinding(
      '__runtimeTrapReportFetchFailure',
      (_source, payload: { url: string; method: string; errorText: string }) => {
        if (payload && typeof payload.url === 'string') {
          recordRequestFailure(
            payload.url,
            payload.method || 'GET',
            'fetch',
            payload.errorText || 'Failed to fetch',
          );
        }
      },
    )
    .catch(() => {});

  void page
    .addInitScript(() => {
      const w = window as unknown as {
        __runtimeTrapFetchPatched?: boolean;
        __runtimeTrapReportFetchFailure?: (p: {
          url: string;
          method: string;
          errorText: string;
        }) => Promise<void>;
      };
      if (w.__runtimeTrapFetchPatched || typeof window.fetch !== 'function') return;
      w.__runtimeTrapFetchPatched = true;
      const origFetch = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        try {
          return await origFetch(input, init);
        } catch (err) {
          const rawUrl =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input?.url || '';
          const resolvedUrl = new URL(rawUrl, window.location.href).href;
          const method =
            init?.method || (input instanceof Request ? input.method : undefined) || 'GET';
          if (typeof w.__runtimeTrapReportFetchFailure === 'function') {
            await w
              .__runtimeTrapReportFetchFailure({
                url: resolvedUrl,
                method,
                errorText: err instanceof Error ? err.message : String(err),
              })
              .catch(() => {});
          }
          throw err;
        }
      };
    })
    .catch(() => {});

  page.on('requestfailed', (req) => {
    const errorText = req.failure()?.errorText ?? 'unknown request failure';
    recordRequestFailure(req.url(), req.method(), req.resourceType(), errorText, req.headers());
  });

  page.on('response', (res) => {
    const status = res.status();
    if (status < 500) return;
    const req = res.request();
    const redactedUrl = redactSensitiveText(res.url());
    // Nếu Chromium phát sự kiện console.error của network 5xx trước sự kiện response, lọc bỏ bản sao đó.
    for (let i = records.length - 1; i >= 0; i--) {
      const prev = records[i]!;
      if (
        prev.source === 'console.error' &&
        prev.url === redactedUrl &&
        /^Failed to load resource: the server responded with a status of 5\d{2}\b/.test(
          prev.message,
        )
      ) {
        records.splice(i, 1);
      }
    }
    records.push({
      source: 'http-5xx',
      message: redactSensitiveText(`HTTP ${status} on ${req.method()} ${res.url()}`),
      url: redactedUrl,
      method: req.method(),
      status,
      resourceType: req.resourceType(),
      timestamp: new Date().toISOString(),
      redactedHeaders: redactHeaders(req.headers()),
    });
  });

  const computeUnexpected = (): RuntimeFailureRecord[] =>
    records.filter(
      (record) =>
        !allowedRecords.has(record) && !allowRules.some((rule) => matchesAllowRule(record, rule)),
    );

  const flushBrowserQueue = async (): Promise<void> => {
    if (!page.isClosed()) {
      await page
        .evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 10)))
        .catch(() => {});
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  };

  return {
    get records(): ReadonlyArray<RuntimeFailureRecord> {
      return records;
    },
    allow(rule: RuntimeAllowRule): void {
      if (!rule.reason || !rule.reason.trim()) {
        throw new Error('runtimeTrap.allow() bắt buộc phải khai báo trường reason không rỗng.');
      }
      allowRules.push(rule);
    },
    allowRecord(record: RuntimeFailureRecord): void {
      allowedRecords.add(record);
    },
    clearAllowed(): void {
      allowRules.length = 0;
    },
    getUnexpectedRecords(): RuntimeFailureRecord[] {
      const unexpected = computeUnexpected();
      for (const rec of unexpected) {
        inspectedRecords.add(rec);
      }
      return unexpected;
    },
    getUnacknowledgedForTeardown(): RuntimeFailureRecord[] {
      return computeUnexpected().filter((rec) => !inspectedRecords.has(rec));
    },
    flushBrowserQueue,
    assertClean(): void {
      const unexpected = computeUnexpected();
      if (unexpected.length === 0) return;
      const summary = unexpected
        .map(
          (r, idx) =>
            `  [${idx + 1}] [${r.source}] ${r.message}${
              r.redactedHeaders ? ` | headers=${JSON.stringify(r.redactedHeaders)}` : ''
            }`,
        )
        .join('\n');
      throw new Error(
        `Runtime Bug-Trap phát hiện ${unexpected.length} lỗi ngầm không nằm trong allow-list:\n${summary}`,
      );
    },
  };
}

export function expectNoConsoleOrPageError(trap: RuntimeTrap): void {
  trap.assertClean();
}

export async function expectExpectedError(
  trap: RuntimeTrap,
  rule: RuntimeAllowRule,
  action: () => Promise<void>,
): Promise<RuntimeFailureRecord[]> {
  if (!rule.reason || !rule.reason.trim()) {
    throw new Error('expectExpectedError() bắt buộc phải khai báo trường reason không rỗng.');
  }
  const startIndex = trap.records.length;
  await action();
  await trap.flushBrowserQueue();

  const newRecords = trap.records.slice(startIndex);
  const matched = newRecords.filter((record) => matchesAllowRule(record, rule));
  if (matched.length === 0) {
    throw new Error(
      `expectExpectedError thất bại: Không bắt được lỗi mong đợi khớp với source="${rule.source}", pattern="${String(
        rule.pattern,
      )}".`,
    );
  }
  for (const record of matched) {
    trap.allowRecord(record);
  }
  return matched;
}

export type BaseTrapFixtures = {
  runtimeTrap: RuntimeTrap;
};

export const baseTest = base.extend<BaseTrapFixtures>({
  runtimeTrap: [
    async ({ page }, use, testInfo) => {
      const trap = createRuntimeTrap(page);
      await use(trap);

      await trap.flushBrowserQueue();
      const unacknowledged = trap.getUnacknowledgedForTeardown();
      if (unacknowledged.length > 0) {
        await testInfo.attach('runtime-failures', {
          body: JSON.stringify(unacknowledged, null, 2),
          contentType: 'application/json',
        });
        if (!testInfo.error) {
          trap.assertClean();
        }
      }
    },
    { auto: true },
  ],
});

export { baseTest as test, expect };
