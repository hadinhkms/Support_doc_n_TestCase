import { test as base, expect } from '@playwright/test';
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
 * Import từ đây thay vì từ '@playwright/test' để mọi test có sẵn page object
 * và API helper, đồng thời dễ thêm setup/cleanup tập trung về sau.
 */
export const test = base.extend<Fixtures>({
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

export { expect };
