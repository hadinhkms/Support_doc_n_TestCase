import { test as base, expect } from '@playwright/test';
import {
  matchesAllowRule,
  redactHeaders,
  redactSensitiveText,
  type RuntimeAllowRule,
  type RuntimeFailureRecord,
  type RuntimeFailureSource,
  type RuntimeTrap,
} from './runtime-trap-redaction';
import { createRuntimeTrap } from './runtime-trap';

export {
  createRuntimeTrap,
  matchesAllowRule,
  redactHeaders,
  redactSensitiveText,
  type RuntimeAllowRule,
  type RuntimeFailureRecord,
  type RuntimeFailureSource,
  type RuntimeTrap,
};

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
