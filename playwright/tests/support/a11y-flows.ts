import type { Locator, Page } from '@playwright/test';

/**
 * Kiểm chứng thao tác bàn phím & focus cho modal/form lỗi (PLAN-16 Phase 3, T3.4). Mỗi check
 * TRẢ VỀ problems + trace (không throw) để harness chứng minh được cả positive control lẫn lỗi
 * cài cố ý; `expectA11yFlow` là wrapper fail cho spec nghiệp vụ.
 */
export interface FlowResult {
  problems: string[];
  trace: string[];
}

const describeActive = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return 'body';
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.getAttribute('data-testid') ? `[${el.getAttribute('data-testid')}]` : ''}`;
  });

const holdsFocus = (scope: Locator) => scope.evaluate((el) => el.contains(document.activeElement));

/** Modal: mở bằng bàn phím, có role/name/aria-modal, focus vào trong, Tab/Shift+Tab không thoát, Escape đóng, focus về trigger. */
export async function checkDialogFocus(page: Page, c: { trigger: Locator; dialog: Locator }): Promise<FlowResult> {
  const problems: string[] = [];
  const trace: string[] = [];
  await c.trigger.focus();
  await page.keyboard.press('Enter');
  try {
    await c.dialog.waitFor({ state: 'visible', timeout: 2_000 });
  } catch {
    return { problems: ['DIALOG_NOT_OPENED: trigger did not open the dialog from the keyboard'], trace };
  }
  const sem = await c.dialog.evaluate((el) => ({
    role: el.getAttribute('role'),
    modal: el.getAttribute('aria-modal'),
    named: Boolean(el.getAttribute('aria-label') || document.getElementById(el.getAttribute('aria-labelledby') ?? '')?.textContent?.trim()),
    focusables: el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])').length,
  }));
  if (sem.role !== 'dialog' && sem.role !== 'alertdialog') problems.push(`DIALOG_SEMANTICS: role '${sem.role}'`);
  if (sem.modal !== 'true') problems.push('DIALOG_SEMANTICS: aria-modal is not true');
  if (!sem.named) problems.push('DIALOG_SEMANTICS: dialog has no accessible name');
  trace.push(`open -> ${await describeActive(page)}`);
  if (!(await holdsFocus(c.dialog))) problems.push('FOCUS_NOT_MOVED: focus stayed outside the dialog on open');
  for (const [key, steps] of [['Tab', sem.focusables + 2], ['Shift+Tab', sem.focusables + 2]] as const) {
    for (let i = 1; i <= steps; i++) {
      await page.keyboard.press(key);
      trace.push(`${key} ${i} -> ${await describeActive(page)}`);
      if (!(await holdsFocus(c.dialog))) {
        problems.push(`FOCUS_ESCAPED: ${key} #${i} left the dialog`);
        break;
      }
    }
  }
  await page.keyboard.press('Escape');
  if (await c.dialog.isVisible()) problems.push('DIALOG_NOT_DISMISSIBLE: Escape did not close the dialog');
  const restored = await c.trigger.evaluate((el) => el === document.activeElement);
  trace.push(`close -> ${await describeActive(page)}`);
  if (!restored) problems.push('FOCUS_NOT_RESTORED: focus did not return to the trigger');
  return { problems, trace };
}

/** Form lỗi: submit bằng bàn phím → field đánh dấu aria-invalid, có thông điệp liên kết, focus về field lỗi đầu, lỗi được thông báo qua live region có sẵn. */
export async function checkFormErrors(page: Page, c: { submit: Locator; invalid: Locator[] }): Promise<FlowResult> {
  const problems: string[] = [];
  const trace: string[] = [];
  const liveSelector = '[role="alert"],[role="status"],[aria-live="polite"],[aria-live="assertive"]';
  const before = await page.locator(liveSelector).evaluateAll((els) => els.map((e) => e.id || e.outerHTML.slice(0, 60)));
  await c.submit.focus();
  await page.keyboard.press('Enter');
  for (const field of c.invalid) {
    const info = await field.evaluate((el) => {
      const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
      return {
        name: el.getAttribute('name') ?? el.id,
        invalid: el.getAttribute('aria-invalid'),
        message: ids.map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim(),
      };
    });
    trace.push(`${info.name}: aria-invalid=${info.invalid} message='${info.message}'`);
    if (info.invalid !== 'true') problems.push(`FIELD_NOT_MARKED_INVALID: ${info.name}`);
    if (!info.message) problems.push(`ERROR_NOT_ASSOCIATED: ${info.name} has no aria-describedby message`);
  }
  const first = c.invalid[0];
  if (first && !(await first.evaluate((el) => el === document.activeElement))) {
    problems.push(`FOCUS_NOT_ON_ERROR: focus is on ${await describeActive(page)}`);
  }
  const live = await page.locator(liveSelector).evaluateAll((els) =>
    els.map((e) => ({ key: e.id || e.outerHTML.slice(0, 60), text: e.textContent?.trim() ?? '' })),
  );
  const announced = live.filter((l) => l.text);
  if (announced.length === 0) problems.push('ERROR_NOT_ANNOUNCED: no live region carries the error');
  else if (!announced.some((l) => before.includes(l.key))) {
    problems.push('LIVE_REGION_CREATED_LATE: live region was inserted with the message; screen readers may miss it');
  }
  return { problems, trace };
}

/** Reflow (WCAG 1.4.10 tham chiếu): ở 320 CSS px không có cuộn ngang. Khôi phục viewport sau khi đo. */
export async function checkReflow(page: Page, width = 320): Promise<FlowResult> {
  const original = page.viewportSize();
  await page.setViewportSize({ width, height: 640 });
  const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  if (original) await page.setViewportSize(original);
  const trace = [`width ${width}: scrollWidth ${m.scroll}, clientWidth ${m.client}`];
  return { problems: m.scroll > m.client + 1 ? [`REFLOW_HORIZONTAL_SCROLL: ${m.scroll}px > ${m.client}px at ${width}px`] : [], trace };
}

export function expectA11yFlow(label: string, result: FlowResult): void {
  if (result.problems.length > 0) {
    throw new Error(`A11Y_FLOW_FAILED (${label}): ${result.problems.join('; ')}\n${result.trace.join('\n')}`);
  }
}
