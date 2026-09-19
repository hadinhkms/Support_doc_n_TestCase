import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

/** Page Object cho dashboard sau đăng nhập. REQ-001. */
export class DashboardPage extends BasePage {
  protected readonly path = '/dashboard';

  readonly heading: Locator;
  readonly userMenu: Locator;
  readonly signOutButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'Dashboard' });
    this.userMenu = page.getByRole('button', { name: /account menu/i });
    this.signOutButton = page.getByRole('menuitem', { name: 'Sign out' });
  }

  async signOut(): Promise<void> {
    await this.userMenu.click();
    await this.signOutButton.click();
  }
}
