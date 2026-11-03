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
  // threshold 0: mọi sai khác màu của một pixel đều tính (mặc định 0.2 cho lọt #000→#333). Env cố định nên không cần dung sai.
  toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', maxDiffPixels: 0, threshold: 0 },
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
  /** Độ rộng render của một chuỗi mẫu theo từng font family: bộ font hệ thống khác → giá trị khác. */
  fontProbe: string;
}

/** Env quan sát được trong trang (không tin cấu hình khai báo): baseline chỉ hợp lệ khi khớp. */
export async function observeVisualEnv(page: Page): Promise<VisualEnvKey> {
  const inPage = await page.evaluate(() => ({
    dpr: window.devicePixelRatio,
    locale: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    fonts: (() => {
      const ctx = document.createElement('canvas').getContext('2d');
      return ['Arial', 'sans-serif', 'serif', 'monospace']
        .map((f) => { if (ctx) ctx.font = `16px ${f}`; return `${f}=${ctx?.measureText('AaBbQqWw0123').width.toFixed(2)}`; })
        .join(',');
    })(),
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
    fontProbe: inPage.fonts,
  };
}

export function diffEnv(approved: VisualEnvKey, actual: VisualEnvKey): string[] {
  return (Object.keys(approved) as (keyof VisualEnvKey)[])
    .filter((k) => approved[k] !== actual[k])
    .map((k) => `${k}: approved ${approved[k]} != actual ${actual[k]}`);
}
