import type { Page } from '@playwright/test';

/**
 * Lớp nền cho Page Object.
 *
 * Nguyên tắc (docs/automation-strategy.md):
 * - Page Object chỉ gom locator và hành vi dùng lại.
 * - KHÔNG đặt assertion nghiệp vụ ở đây; assertion phải nằm trong spec để
 *   người đọc test thấy được expected result mà không phải mở file khác.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Đường dẫn tương đối so với baseURL. */
  protected abstract readonly path: string;

  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }
}
