/**
 * Tóm tắt sức khỏe một lần chạy từ outcome THẬT của Playwright (`TestCase.outcome()`),
 * để retry-pass hiện ra là `flaky` thay vì lẫn vào pass lần đầu (bug-hunting Phase 4).
 * Không đặt ngưỡng chặn: chưa có ngưỡng nào được owner duyệt (docs/flaky-test-policy.md).
 */
export const RUN_HEALTH_SCHEMA_VERSION = 1;

export type TestOutcome = 'expected' | 'unexpected' | 'flaky' | 'skipped';

export interface RunHealthRow {
  id: string;
  outcome: TestOutcome;
  attempts: number;
}

export interface RunHealth {
  schemaVersion: number;
  total: number;
  firstAttemptPass: number;
  flaky: number;
  failed: number;
  skipped: number;
  /** flaky / test đã chạy, %; docs/flaky-test-policy.md: > 2% -> dừng thêm test mới (không tự chặn). */
  flakyRatePercent: number;
  /** Không có test nào được chọn/chạy: không bao giờ coi là xanh. */
  empty: boolean;
  flakyTests: string[];
  failedTests: string[];
}

export function summariseRunHealth(rows: readonly RunHealthRow[]): RunHealth {
  const pick = (outcome: TestOutcome) => rows.filter((row) => row.outcome === outcome);
  const executed = rows.length - pick('skipped').length;
  return {
    schemaVersion: RUN_HEALTH_SCHEMA_VERSION,
    total: rows.length,
    // 'expected' sau nhiều attempt không xảy ra với Playwright, nhưng vẫn loại ra cho chắc.
    firstAttemptPass: pick('expected').filter((row) => row.attempts <= 1).length,
    flaky: pick('flaky').length,
    failed: pick('unexpected').length,
    skipped: pick('skipped').length,
    flakyRatePercent: executed ? Math.round((pick('flaky').length / executed) * 10_000) / 100 : 0,
    empty: executed === 0,
    flakyTests: pick('flaky').map((row) => `${row.id} (attempts: ${row.attempts})`),
    failedTests: pick('unexpected').map((row) => row.id),
  };
}

export function renderRunHealthMarkdown(health: RunHealth): string {
  const lines = [
    '## Run health',
    '',
    '| First-attempt pass | Flaky (pass after retry) | Failed | Skipped | Total | Flaky rate |',
    '|---:|---:|---:|---:|---:|---:|',
    `| ${health.firstAttemptPass} | ${health.flaky} | ${health.failed} | ${health.skipped} | ${health.total} | ${health.flakyRatePercent}% |`,
  ];
  if (health.empty) lines.push('', '> **No tests were executed.** Check the grep/project/shard selection.');
  if (health.flakyRatePercent > 2) {
    lines.push('', '> Flaky rate > 2%: policy says stop adding tests and stabilise first.');
  }
  if (health.flakyTests.length) {
    lines.push('', '**Flaky — not a clean pass** (xử lý theo docs/flaky-test-policy.md):');
    lines.push(...health.flakyTests.map((id) => `- ${id}`));
  }
  if (health.failedTests.length) lines.push('', '**Failed:**', ...health.failedTests.map((id) => `- ${id}`));
  return `${lines.join('\n')}\n`;
}
