import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { renderRunHealthMarkdown, summariseRunHealth, type RunHealth } from '../tests/support/run-health';

/**
 * Bug-hunting Phase 4: kiểm chứng run-health-reporter trên một Playwright run THẬT (process con)
 * với fixture có kiểm soát: 1 test sạch, 1 test fail lần đầu rồi pass khi retry, 1 test luôn fail.
 * Không cần browser/app. Đây là self-test của reporter, không phải coverage của sản phẩm.
 */
const PW_ROOT = path.resolve(__dirname, '..');
const posix = (p: string) => p.split(path.sep).join('/');
const REPORTER = posix(path.join(PW_ROOT, 'tests/support/run-health-reporter.ts'));
const CLI = require.resolve('@playwright/test/cli');

const FIXTURE_SPEC = `import { test, expect } from '@playwright/test';
test('clean @clean', () => { expect(1).toBe(1); });
test('flaky @flaky', () => { expect(test.info().retry, 'fails on first attempt').toBeGreaterThan(0); });
test('broken @broken', () => { expect(1).toBe(2); });
`;

function prepare(label: string): string {
  const dir = path.join(PW_ROOT, 'test-results', 'run-health', `${label}-${randomBytes(4).toString('hex')}`);
  fs.mkdirSync(path.join(dir, 'specs'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'nested.config.ts'),
    [
      "import { defineConfig } from '@playwright/test';",
      "export default defineConfig({ testDir: './specs', outputDir: './out', timeout: 20_000,",
      `  reporter: [['${REPORTER}', { outputFile: 'run-health.json' }]] });`,
    ].join('\n'),
  );
  fs.writeFileSync(path.join(dir, 'specs', 'probe.spec.ts'), FIXTURE_SPEC);
  return dir;
}

function playwright(dir: string, args: string[], env: Record<string, string> = {}): number | null {
  const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env };
  for (const key of Object.keys(childEnv)) if (/^(PW_|TEST_WORKER_INDEX|TEST_PARALLEL_INDEX)/.test(key)) delete childEnv[key];
  return spawnSync(process.execPath, [CLI, ...args], { cwd: dir, env: childEnv, encoding: 'utf8', timeout: 90_000 })
    .status;
}

const readHealth = (file: string): RunHealth => JSON.parse(fs.readFileSync(file, 'utf8')) as RunHealth;

test.describe('Run health reporter (bug-hunting Phase 4)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('HM-15 - retry-pass is reported as flaky, not as a first-attempt pass, while the run exits 0', () => {
    const dir = prepare('flaky');
    const exitCode = playwright(dir, ['test', '-c', 'nested.config.ts', '--retries=1', '--grep', '@clean|@flaky']);
    const health = readHealth(path.join(dir, 'run-health.json'));

    expect(exitCode, 'Playwright coi flaky là thành công -> cần reporter để thấy nó').toBe(0);
    expect(health).toMatchObject({ total: 2, firstAttemptPass: 1, flaky: 1, failed: 0, empty: false });
    expect(health.flakyRatePercent).toBe(50);
    expect(health.flakyTests).toEqual(['[-] flaky @flaky (attempts: 2)']);
  });

  test('HM-15 - a real failure is counted as failed (negative control)', () => {
    const dir = prepare('failed');
    const exitCode = playwright(dir, ['test', '-c', 'nested.config.ts', '--grep', '@broken']);
    const health = readHealth(path.join(dir, 'run-health.json'));

    expect(exitCode).not.toBe(0);
    expect(health).toMatchObject({ total: 1, firstAttemptPass: 0, flaky: 0, failed: 1, empty: false });
  });

  test('HM-15 - empty sharded selection exits 0 in every shard but is reported as empty after merge', () => {
    const dir = prepare('empty');
    for (const shard of ['1/2', '2/2']) {
      const blob = `blobs/report-${shard[0]}.zip`;
      const exitCode = playwright(
        dir,
        ['test', '-c', 'nested.config.ts', '--grep', '@nomatch', `--shard=${shard}`, '--reporter=blob'],
        { PLAYWRIGHT_BLOB_OUTPUT_FILE: blob },
      );
      expect(exitCode, `shard ${shard}: đây chính là lỗ hổng false-green CI phải tự chặn`).toBe(0);
    }
    const mergeExit = playwright(dir, ['merge-reports', `--reporter=${REPORTER}`, './blobs']);
    const health = readHealth(path.join(dir, 'test-results', 'run-health.json'));

    expect(mergeExit).toBe(0);
    expect(health).toMatchObject({ total: 0, empty: true });
  });

  test('HM-15 - merge-reports across shards keeps the flaky outcome (the CI report path)', () => {
    const dir = prepare('merge');
    for (const shard of ['1/2', '2/2']) {
      playwright(
        dir,
        ['test', '-c', 'nested.config.ts', '--retries=1', '--grep', '@clean|@flaky', `--shard=${shard}`, '--reporter=blob'],
        { PLAYWRIGHT_BLOB_OUTPUT_FILE: `blobs/report-${shard[0]}.zip` },
      );
    }
    playwright(dir, ['merge-reports', `--reporter=${REPORTER}`, './blobs']);
    const health = readHealth(path.join(dir, 'test-results', 'run-health.json'));

    expect(health).toMatchObject({ total: 2, firstAttemptPass: 1, flaky: 1, empty: false });
  });

  test('HM-15 - summary counts skipped tests apart and treats an all-skipped run as empty', () => {
    const health = summariseRunHealth([
      { id: 'a', outcome: 'skipped', attempts: 0 },
      { id: 'b', outcome: 'skipped', attempts: 0 },
    ]);
    expect(health).toMatchObject({ total: 2, skipped: 2, firstAttemptPass: 0, empty: true });
    expect(renderRunHealthMarkdown(health)).toContain('No tests were executed');
  });
});
