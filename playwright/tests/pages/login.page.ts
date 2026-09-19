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

  constructor(page: Page) {
    super(page);
    // Locator ưu tiên role/label/testid - không dùng CSS phụ thuộc layout.
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
    this.errorMessage = page.getByRole('alert');
    this.emailValidationError = page.getByTestId('email-error');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
