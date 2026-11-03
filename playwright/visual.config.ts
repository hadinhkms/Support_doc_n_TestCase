import { defineConfig, devices } from '@playwright/test';
import { initEvidenceRun } from './tests/support/evidence-run';
import { VISUAL_EXPECT, VISUAL_SNAPSHOT_TEMPLATE, VISUAL_UPDATE_SNAPSHOTS, VISUAL_USE } from './tests/support/visual-env';

const isCI = !!process.env.CI;
initEvidenceRun(__dirname);

/**
 * Visual regression suite (PLAN-16 Phase 3). Chỉ chạy `*.visual.spec.ts` gọi
 * `expectApprovedScreenshot`. Env chụp cố định ở `visual-env.ts`; baseline chỉ ghi qua approval
 * (`updateSnapshots: 'none'`), `--update-snapshots` không làm baseline được tin.
 * Chưa có spec nghiệp vụ nào: cần pilot app + owner chốt browser/device (Q-16-P3) trước khi bật gate CI.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.visual.spec.ts',
  outputDir: './test-results/visual',
  snapshotPathTemplate: VISUAL_SNAPSHOT_TEMPLATE,
  updateSnapshots: VISUAL_UPDATE_SNAPSHOTS,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  workers: isCI ? 2 : undefined,
  expect: { timeout: 5_000, ...VISUAL_EXPECT },
  reporter: [
    ['list'],
    ['junit', { outputFile: 'test-results/junit-visual.xml' }],
    ['./tests/support/evidence-reporter.ts', { junitFile: 'test-results/junit-visual.xml' }],
  ],
  use: { testIdAttribute: 'data-testid', trace: 'retain-on-failure', ...VISUAL_USE },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], ...VISUAL_USE } }],
});
