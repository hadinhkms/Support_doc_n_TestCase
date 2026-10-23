import {
  baseTest,
  expect,
  expectNoConsoleOrPageError,
  expectExpectedError,
  createRuntimeTrap,
  redactSensitiveText,
  redactHeaders,
  matchesAllowRule,
  type RuntimeTrap,
  type RuntimeFailureRecord,
  type RuntimeAllowRule,
  type RuntimeFailureSource,
} from './base.fixture';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { ApiClient } from '../api/api-client';

type Fixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  api: ApiClient;
};

/**
 * Test object dùng chung cho toàn bộ spec.
 * Kế thừa `baseTest` (đã gắn sẵn `runtimeTrap` { auto: true }) và bổ sung
 * các page object / API helper theo nhu cầu của từng test.
 */
export const test = baseTest.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  api: async ({ request }, use) => {
    await use(new ApiClient(request));
  },
});

export {
  expect,
  expectNoConsoleOrPageError,
  expectExpectedError,
  createRuntimeTrap,
  redactSensitiveText,
  redactHeaders,
  matchesAllowRule,
  type RuntimeTrap,
  type RuntimeFailureRecord,
  type RuntimeAllowRule,
  type RuntimeFailureSource,
};
