import { test, expect } from '../fixtures/test-fixtures';
import { emailOfLength, invalidCredentials } from '../data/users';
import { expectBoundaryRejected } from '../support/deep-guards';

/**
 * REQ-001 Sign in - biên dữ liệu nhập (tách khỏi login.spec.ts theo chiều validation).
 * Requirement : requirements/REQ-001-sign-in.md (Rules and validation)
 * Test cases  : test-cases/REQ-001-sign-in.md
 */
test.describe('REQ-001 - Sign in input boundaries', { tag: '@REQ-001' }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test(
    'TC-014 - AC-003 email at 254 characters is accepted and 255 is rejected on the client',
    { tag: ['@p2'] },
    async ({ loginPage, page }) => {
      await loginPage.goto();

      await test.step('254 ký tự (max): qua validation và được gửi lên server', async () => {
        const email = emailOfLength(254);
        expect(email).toHaveLength(254);
        const loginRequest = page.waitForRequest(
          (request) => request.method() === 'POST' && request.url().includes('/api/auth/login'),
        );
        await loginPage.login(email, invalidCredentials.wrongPassword);
        await loginRequest;

        await expect(loginPage.emailValidationError).toBeHidden();
        // Email không tồn tại -> server trả thông báo chung của AC-002, không tạo session.
        await expect(loginPage.errorMessage).toHaveText(/invalid email or password/i);
        await expect(page).toHaveURL(/\/login/);
      });

      await test.step('255 ký tự: lỗi tại trường Email, không gửi request', async () => {
        const email = emailOfLength(255);
        expect(email).toHaveLength(255);
        await expectBoundaryRejected(
          page,
          async () => {
            await loginPage.login(email, invalidCredentials.wrongPassword);
          },
          loginPage.emailValidationError,
          { mutationUrlPattern: '/api/auth/login' },
        );
        await expect(page).toHaveURL(/\/login/);
      });
    },
  );
});
