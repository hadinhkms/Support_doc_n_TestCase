import type { Page, PlaywrightTestConfig } from '@playwright/test';

/**
 * Môi trường chụp cố định cho visual regression (PLAN-16 Phase 3, T3.2). Dùng chung cho
 * `visual.config.ts` và harness kiểm chứng để cả hai đi cùng một cấu hình.
 * Baseline phụ thuộc platform/browser: env thực tế được ghi vào approval và so lại mỗi lần chạy.
 */
export const VISUAL_USE = {
  viewport: { width: 1024, height: 768 },
  deviceScaleFactor: 1,
  locale: 'en-US',
  timezoneId: 'UTC',
  colorScheme: 'light',
  reducedMotion: 'reduce',
} as const satisfies NonNullable<PlaywrightTestConfig['use']>;

export const VISUAL_EXPECT = {
  toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', maxDiffPixels: 0 },
} as const satisfies NonNullable<PlaywrightTestConfig['expect']>;

/** Baseline chỉ được ghi qua approval; Playwright không tự ghi baseline thiếu. */
export const VISUAL_UPDATE_SNAPSHOTS = 'none' as const;
export const VISUAL_SNAPSHOT_TEMPLATE = '{testDir}/__baselines__/{testFileName}/{arg}{-projectName}-{platform}{ext}';

export interface VisualEnvKey {
  os: string;
  browser: string;
  viewport: string;
  deviceScaleFactor: number;
  locale: string;
  timezone: string;
  colorScheme: string;
}

/** Env quan sát được trong trang (không tin cấu hình khai báo): baseline chỉ hợp lệ khi khớp. */
export async function observeVisualEnv(page: Page): Promise<VisualEnvKey> {
  const inPage = await page.evaluate(() => ({
    dpr: window.devicePixelRatio,
    locale: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dark: window.matchMedia('(prefers-color-scheme: dark)').matches,
  }));
  const size = page.viewportSize();
  const browser = page.context().browser();
  return {
    os: process.platform,
    browser: `${browser?.browserType().name() ?? 'unknown'}@${browser?.version() ?? 'unknown'}`,
    viewport: size ? `${size.width}x${size.height}` : 'unknown',
    deviceScaleFactor: inPage.dpr,
    locale: inPage.locale,
    timezone: inPage.timezone,
    colorScheme: inPage.dark ? 'dark' : 'light',
  };
}

export function diffEnv(approved: VisualEnvKey, actual: VisualEnvKey): string[] {
  return (Object.keys(approved) as (keyof VisualEnvKey)[])
    .filter((k) => approved[k] !== actual[k])
    .map((k) => `${k}: approved ${approved[k]} != actual ${actual[k]}`);
}
