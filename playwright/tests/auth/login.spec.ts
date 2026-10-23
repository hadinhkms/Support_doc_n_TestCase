import { test, expect } from '../fixtures/test-fixtures';
import { standardUser, invalidCredentials } from '../data/users';
import { captureJourneyStep } from '../support/evidence';
import {
  expectNoHorizontalScroll,
  expectNoTextOverflow,
  expectNotOccluded,
  expectInteractiveA11y,
  expectResponsiveIntegrity,
} from '../support/ui-checks';
import {
  expectIdempotentSubmit,
  expectSafeXssRender,
  expectStatePersistence,
  expectBoundaryRejected,
  XSS_PAYLOADS,
} from '../support/deep-guards';

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
    { tag: ['@smoke', '@p0', '@journey'] },
    async ({ loginPage, dashboardPage, page }, testInfo) => {
      const user = standardUser();

      await test.step('Mở trang đăng nhập', async () => {
        await loginPage.goto();
        await expect(loginPage.submitButton).toBeVisible();
        await captureJourneyStep(page, testInfo, 1, 'Trang dang nhap khoi tao');
      });

      await test.step('Nhập credential hợp lệ và submit', async () => {
        await loginPage.login(user.email, user.password);
        await captureJourneyStep(page, testInfo, 2, 'Nhap thong tin va submit');
      });

      await test.step('Kết quả chính: vào được dashboard', async () => {
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(dashboardPage.heading).toBeVisible();
        await captureJourneyStep(page, testInfo, 3, 'Dashboard tai thanh cong');
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
      await expectBoundaryRejected(
        page,
        async () => {
          await loginPage.login(invalidCredentials.malformedEmail, 'AnyPassword123!');
        },
        loginPage.emailValidationError,
        { mutationUrlPattern: '/api/auth/login' },
      );
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
      await expectStatePersistence(page, async () => {
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(dashboardPage.heading).toBeVisible();
      });
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

      // Lưu ý: Thuộc tính Secure và SameSite có thể không được bật trên môi trường dev http://localhost.
      // Dùng expect.soft để ghi nhận gap cấu hình mà không làm fail cứng test flow chính.
      expect(session, `không thấy cookie session trong: ${cookies.map((c) => c.name).join(', ')}`)
        .toBeDefined();
      expect.soft(session?.httpOnly, 'HttpOnly chặn JavaScript đọc cookie').toBe(true);
      expect.soft(session?.secure, 'Secure chặn gửi cookie qua HTTP (có thể fail trên http://localhost)').toBe(true);
      expect.soft(session?.sameSite, 'SameSite chặn gửi cookie khi bị CSRF (có thể fail trên http://localhost)').toBe('Lax');
    },
  );

  test(
    'TC-016 - AC-006 login form layout has no overflow, occlusion and passes interactive a11y',
    { tag: ['@p1', '@ui', '@a11y'] },
    async ({ loginPage, page }) => {
      await loginPage.goto();
      await expectNoHorizontalScroll(page);
      await expectNoTextOverflow(loginPage.formContainer);
      await expectNotOccluded(loginPage.submitButton);
      await expectInteractiveA11y(loginPage.formContainer);
    },
  );

  test(
    'TC-017 - AC-008 login layout remains intact across desktop, tablet and mobile viewports',
    { tag: ['@p2', '@ui'] },
    async ({ loginPage, page }) => {
      await loginPage.goto();
      await expectResponsiveIntegrity(page, {
        requiredLocators: [
          loginPage.emailInput,
          loginPage.passwordInput,
          loginPage.submitButton,
        ],
        optionalLocators: [loginPage.brandLogo],
      });
    },
  );

  test(
    'TC-018 - AC-009 rapid double-click on sign in sends at most one login request',
    { tag: ['@p1', '@security'] },
    async ({ loginPage, page }) => {
      const user = standardUser();

      await loginPage.goto();
      await loginPage.emailInput.fill(user.email);
      await loginPage.passwordInput.fill(user.password);
      await expectIdempotentSubmit(page, loginPage.submitButton, '/api/auth/login', {
        methods: ['POST'],
      });
    },
  );

  test(
    'TC-019 - AC-010 login error message safely escapes XSS payloads without script execution',
    { tag: ['@p1', '@security'] },
    async ({ loginPage, page }) => {
      await loginPage.goto();
      await loginPage.passwordInput.fill(invalidCredentials.wrongPassword);
      await expectSafeXssRender(
        page,
        async (payload) => {
          await loginPage.emailInput.fill(payload);
          await loginPage.submitButton.click();
        },
        {
          sinkLocator: loginPage.errorMessage,
          payloads: XSS_PAYLOADS.slice(0, 3),
        },
      );
    },
  );
});
