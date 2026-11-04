import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

/** Page Object cho màn đăng nhập. REQ-001. */
export class LoginPage extends BasePage {
  protected readonly path = '/login';

  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly emailValidationError: Locator;
  readonly formContainer: Locator;
  readonly brandLogo: Locator;

  constructor(page: Page) {
    super(page);
    // Locator ưu tiên role/label/testid - không dùng CSS phụ thuộc layout.
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
    this.errorMessage = page.getByRole('alert');
    this.emailValidationError = page.getByTestId('email-error');
    this.formContainer = page.locator('form, [role="form"], main').first();
    this.brandLogo = page.getByTestId('brand-logo');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /**
   * Tên cookie mang session, nhận diện theo tên như TC-013 (thứ tự cookie không tất định).
   * Bỏ cookie CSRF (`csrftoken`, `XSRF-TOKEN`): app có thể đặt/xoay nó cả khi đăng nhập thất bại.
   */
  async sessionCookieNames(): Promise<string[]> {
    const cookies = await this.page.context().cookies();
    return cookies
      .filter((cookie) => /session|sid|token/i.test(cookie.name) && !/csrf|xsrf/i.test(cookie.name))
      .map((cookie) => cookie.name)
      .sort();
  }
}
