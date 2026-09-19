import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../fixtures/test-fixtures';

/**
 * REQ-001 / AC-006 - Accessibility baseline cho màn đăng nhập.
 * Quét tự động chỉ bắt được ~30-40% lỗi a11y; vẫn cần kiểm tra keyboard/screen
 * reader thủ công (xem test-cases/REQ-001-sign-in.md, mục Uncovered risk).
 */
test.describe('REQ-001 - Sign in accessibility', { tag: '@REQ-001' }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test(
    'TC-007 - AC-006 login page has no WCAG 2.1 A/AA violations',
    { tag: ['@a11y', '@p2'] },
    async ({ loginPage, page }) => {
      await loginPage.goto();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.help}`).join('\n'),
      ).toEqual([]);
    },
  );

  test(
    'TC-008 - AC-006 form is fully operable by keyboard',
    { tag: ['@a11y', '@p2'] },
    async ({ loginPage, page }) => {
      await loginPage.goto();

      await page.keyboard.press('Tab');
      await expect(loginPage.emailInput).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(loginPage.passwordInput).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(loginPage.submitButton).toBeFocused();
    },
  );
});
