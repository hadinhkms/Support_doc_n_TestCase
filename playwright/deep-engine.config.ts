import { defineConfig, devices } from '@playwright/test';
import { initEvidenceRun } from './tests/support/evidence-run';

const isCI = !!process.env.CI;
// Chốt runId/command/source identity một lần ở runner; worker kế thừa qua env.
initEvidenceRun(__dirname);

/**
 * Harness kiểm chứng độc lập cho Deep Test Engine (HM-00 .. HM-08).
 * Sử dụng page.setContent() và page.route() hoàn toàn tự chủ, không cần app server.
 * Tách khỏi `./tests` để không làm nhiễu traceability của `tools/qa`.
 */
export default defineConfig({
  testDir: './deep-engine-tests',
  outputDir: './test-results/deep-engine',

  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  workers: isCI ? 2 : undefined,

  timeout: 15_000,
  expect: { timeout: 3_000 },

  // evidence-reporter chạy sau junit (onExit) để hash JUnit + ghi run-receipt.json.
  reporter: [
    ['list'],
    ['junit', { outputFile: 'test-results/junit-deep-engine.xml' }],
    ['./tests/support/evidence-reporter.ts', { junitFile: 'test-results/junit-deep-engine.xml' }],
  ],

  use: {
    testIdAttribute: 'data-testid',
    actionTimeout: 5_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
