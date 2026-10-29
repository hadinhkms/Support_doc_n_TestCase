import type { Page } from '@playwright/test';
import { attachFetchFailureProbe } from './runtime-trap-fetch-probe';
import {
  isBenignAbortedSubresource,
  matchesAllowRule,
  redactHeaders,
  redactSensitiveText,
  type InternalRuntimeTrap,
  type RuntimeAllowRule,
  type RuntimeFailureRecord,
} from './runtime-trap-redaction';

const HTTP_5XX_CONSOLE_RE =
  /^Failed to load resource: the server responded with a status of 5\d{2}\b/;

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
      HTTP_5XX_CONSOLE_RE.test(text) &&
      Boolean(locUrl) &&
      records.some((r) => r.source === 'http-5xx' && r.url === locUrl);
    if (isBrowserNetworkEcho) return;
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
    if (isBenignAbortedSubresource(rawUrl, resourceType, errorText)) return;
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

  attachFetchFailureProbe(page, (url, method, errorText) => {
    recordRequestFailure(url, method, 'fetch', errorText);
  });

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
        HTTP_5XX_CONSOLE_RE.test(prev.message)
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
      for (const rec of unexpected) inspectedRecords.add(rec);
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
