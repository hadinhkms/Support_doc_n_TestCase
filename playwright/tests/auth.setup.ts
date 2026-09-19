import { test as setup, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { standardUser } from './data/users';
import { STORAGE_STATE } from './support/paths';

/**
 * Đăng nhập một lần và lưu session ra file.
 * Mọi project khác `dependencies: ['setup']` nên không phải login lại qua UI.
 */
setup('authenticate as standard user', async ({ page }) => {
  const user = standardUser();
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login(user.email, user.password);

  // Chờ theo trạng thái quan sát được, không dùng waitForTimeout.
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
