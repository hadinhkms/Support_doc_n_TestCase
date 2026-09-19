import { test, expect } from '../fixtures/test-fixtures';
import { standardUser, invalidCredentials } from '../data/users';

/**
 * REQ-001 Sign in with email and password
 * Requirement : requirements/REQ-001-sign-in.md
 * Test cases  : test-cases/REQ-001-sign-in.md
 * Plan        : test-cases/REQ-001-sign-in.automation-plan.md
 */
test.describe('REQ-001 - Sign in', { tag: '@REQ-001' }, () => {
  // Đây là các test VỀ việc đăng nhập nên phải bắt đầu từ trạng thái chưa đăng nhập,
  // ghi đè storageState mà project setup đã tạo.
  test.use({ storageState: { cookies: [], origins: [] } });

  test(
    'TC-001 - AC-001 valid user can sign in and lands on dashboard',
    { tag: ['@smoke', '@p0'] },
    async ({ loginPage, dashboardPage, page }) => {
      const user = standardUser();

      await test.step('Mở trang đăng nhập', async () => {
        await loginPage.goto();
        await expect(loginPage.submitButton).toBeVisible();
      });

      await test.step('Nhập credential hợp lệ và submit', async () => {
        await loginPage.login(user.email, user.password);
      });

      await test.step('Kết quả chính: vào được dashboard', async () => {
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(dashboardPage.heading).toBeVisible();
      });

      await test.step('Side effect: session được thiết lập', async () => {
        await expect(dashboardPage.userMenu).toBeVisible();
        const cookies = await page.context().cookies();
        expect(cookies.length, 'phải có cookie session sau khi đăng nhập').toBeGreaterThan(0);
      });
    },
  );

  test(
    'TC-002 - AC-002 wrong password is rejected without leaking which field is wrong',
    { tag: ['@p1', '@security'] },
    async ({ loginPage, page }) => {
      const user = standardUser();

      await loginPage.goto();
      await loginPage.login(user.email, invalidCredentials.wrongPassword);

      await expect(loginPage.errorMessage).toBeVisible();
      // Thông báo phải chung chung - không tiết lộ email tồn tại hay không.
      await expect(loginPage.errorMessage).toHaveText(/invalid email or password/i);
      await expect(page).toHaveURL(/\/login/);
      // Side effect: không có session nào được tạo.
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeHidden();
    },
  );

  test(
    'TC-003 - AC-002 unknown email returns the same generic error as wrong password',
    { tag: ['@p1', '@security'] },
    async ({ loginPage }) => {
      await loginPage.goto();
      await loginPage.login(invalidCredentials.unknownEmail, invalidCredentials.wrongPassword);

      await expect(loginPage.errorMessage).toHaveText(/invalid email or password/i);
    },
  );

  test(
    'TC-004 - AC-003 malformed email is blocked by client-side validation',
    { tag: ['@p2'] },
    async ({ loginPage, page }) => {
      await loginPage.goto();
      await loginPage.login(invalidCredentials.malformedEmail, 'AnyPassword123!');

      await expect(loginPage.emailValidationError).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    },
  );

  test(
    'TC-005 - AC-004 session survives a page reload',
    { tag: ['@p1'] },
    async ({ loginPage, dashboardPage, page }) => {
      const user = standardUser();

      await loginPage.goto();
      await loginPage.login(user.email, user.password);
      await expect(dashboardPage.heading).toBeVisible();

      await page.reload();

      await expect(page).toHaveURL(/\/dashboard/);
      await expect(dashboardPage.heading).toBeVisible();
    },
  );

  test(
    'TC-006 - AC-005 unauthenticated visitor is redirected away from dashboard',
    { tag: ['@p0', '@security'] },
    async ({ dashboardPage, page }) => {
      await dashboardPage.goto();

      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeHidden();
    },
  );

  test(
    'TC-013 - AC-001 session cookie carries HttpOnly, Secure and SameSite',
    { tag: ['@p1', '@security'] },
    async ({ loginPage, dashboardPage, page }) => {
      const user = standardUser();

      await loginPage.goto();
      await loginPage.login(user.email, user.password);
      await expect(dashboardPage.heading).toBeVisible();

      // Cookie session là cookie duy nhất bị ràng buộc bởi ba thuộc tính này.
      // Nhận diện theo tên chứ không theo thứ tự, vì thứ tự cookie không tất định.
      const cookies = await page.context().cookies();
      const session = cookies.find((cookie) => /session|sid|token/i.test(cookie.name));

      expect(session, `không thấy cookie session trong: ${cookies.map((c) => c.name).join(', ')}`)
        .toBeDefined();
      expect.soft(session?.httpOnly, 'HttpOnly chặn JavaScript đọc cookie').toBe(true);
      expect.soft(session?.secure, 'Secure chặn gửi cookie qua HTTP').toBe(true);
      expect.soft(session?.sameSite, 'SameSite chặn gửi cookie khi bị CSRF').toBe('Lax');
    },
  );
});
