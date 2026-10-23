import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

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

  reporter: [['list']],

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
