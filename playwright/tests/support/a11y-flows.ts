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

const CONTROLS = 'a[href],button,input,select,textarea,[role="button"],[role="link"],[contenteditable="true"]';

/** Focus phải nằm trên một control BÊN TRONG scope — chính container (tabindex=-1) không tính. */
const focusOnControl = (scope: Locator) =>
  scope.evaluate((el, sel) => {
    const a = document.activeElement;
    return Boolean(a && a !== el && el.contains(a) && a.matches(sel));
  }, CONTROLS);

/** Modal: mở bằng bàn phím, có role/name/aria-modal, focus vào control trong, Tab/Shift+Tab không thoát và tới được mọi control, Escape đóng, focus về trigger. */
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
  const sem = await c.dialog.evaluate((el, sel) => {
    const controls = Array.from(el.querySelectorAll<HTMLElement>(sel)).filter((x) => !(x as HTMLButtonElement).disabled);
    return {
      role: el.getAttribute('role'),
      modal: el.getAttribute('aria-modal'),
      named: Boolean(el.getAttribute('aria-label') || document.getElementById(el.getAttribute('aria-labelledby') ?? '')?.textContent?.trim()),
      controls: controls.length,
      untabbable: controls.filter((x) => x.tabIndex < 0).map((x) => x.id || x.tagName.toLowerCase()),
    };
  }, CONTROLS);
  if (sem.role !== 'dialog' && sem.role !== 'alertdialog') problems.push(`DIALOG_SEMANTICS: role '${sem.role}'`);
  if (sem.modal !== 'true') problems.push('DIALOG_SEMANTICS: aria-modal is not true');
  if (!sem.named) problems.push('DIALOG_SEMANTICS: dialog has no accessible name');
  if (sem.controls === 0) problems.push('DIALOG_NO_CONTROLS: dialog has no interactive control');
  if (sem.untabbable.length > 0) problems.push(`CONTROL_NOT_TABBABLE: ${sem.untabbable.join(', ')} unreachable by Tab`);
  trace.push(`open -> ${await describeActive(page)}`);
  if (!(await focusOnControl(c.dialog))) problems.push('FOCUS_NOT_MOVED: focus is not on a control inside the dialog after open');
  const visited = new Set<string>();
  for (const [key, steps] of [['Tab', sem.controls + 2], ['Shift+Tab', sem.controls + 2]] as const) {
    for (let i = 1; i <= steps; i++) {
      await page.keyboard.press(key);
      const now = await describeActive(page);
      trace.push(`${key} ${i} -> ${now}`);
      if (!(await focusOnControl(c.dialog))) {
        problems.push(`FOCUS_ESCAPED: ${key} #${i} left the dialog (or stopped on a non-control)`);
        break;
      }
      visited.add(now);
    }
  }
  const tabbable = sem.controls - sem.untabbable.length;
  if (tabbable > 0 && visited.size < tabbable) problems.push(`FOCUS_CYCLE_INCOMPLETE: Tab reached ${visited.size}/${tabbable} controls`);
  await page.keyboard.press('Escape');
  if (await c.dialog.isVisible()) problems.push('DIALOG_NOT_DISMISSIBLE: Escape did not close the dialog');
  const restored = await c.trigger.evaluate((el) => el === document.activeElement);
  trace.push(`close -> ${await describeActive(page)}`);
  if (!restored) problems.push('FOCUS_NOT_RESTORED: focus did not return to the trigger');
  return { problems, trace };
}

const LIVE = '[role="alert"],[role="status"],[aria-live="polite"],[aria-live="assertive"]';

/** Live region đọc được: không aria-hidden, không display:none/visibility:hidden (sr-only bằng clip vẫn hợp lệ). */
const readLiveRegions = (page: Page) =>
  page.locator(LIVE).evaluateAll((els) =>
    els.map((e) => {
      const style = getComputedStyle(e);
      return {
        key: e.id || e.outerHTML.slice(0, 60),
        text: e.textContent?.trim() ?? '',
        exposed: !e.closest('[aria-hidden="true"]') && style.display !== 'none' && style.visibility !== 'hidden' && !(e as HTMLElement).hidden,
      };
    }),
  );

/** Form lỗi: submit bằng bàn phím → aria-invalid, thông điệp liên kết và hiện với AT, focus về field lỗi đầu, live region có sẵn đổi nội dung để thông báo lỗi. */
export async function checkFormErrors(page: Page, c: { submit: Locator; invalid: Locator[] }): Promise<FlowResult> {
  const problems: string[] = [];
  const trace: string[] = [];
  const before = new Map((await readLiveRegions(page)).map((r) => [r.key, r.text]));
  await c.submit.focus();
  await page.keyboard.press('Enter');
  for (const field of c.invalid) {
    const info = await field.evaluate((el) => {
      const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
      const msgs = ids.map((id) => document.getElementById(id)).filter((m): m is HTMLElement => Boolean(m));
      const exposed = (m: HTMLElement) =>
        !m.hidden && !m.closest('[aria-hidden="true"]') && getComputedStyle(m).display !== 'none' && getComputedStyle(m).visibility !== 'hidden';
      return {
        name: el.getAttribute('name') ?? el.id,
        invalid: el.getAttribute('aria-invalid'),
        message: msgs.filter(exposed).map((m) => m.textContent?.trim() ?? '').join(' ').trim(),
        hiddenMessage: msgs.some((m) => !exposed(m) && m.textContent?.trim()),
      };
    });
    trace.push(`${info.name}: aria-invalid=${info.invalid} message='${info.message}' hidden=${info.hiddenMessage}`);
    if (info.invalid !== 'true') problems.push(`FIELD_NOT_MARKED_INVALID: ${info.name}`);
    if (!info.message) {
      problems.push(info.hiddenMessage ? `ERROR_MESSAGE_HIDDEN: ${info.name} message is hidden from assistive tech` : `ERROR_NOT_ASSOCIATED: ${info.name} has no aria-describedby message`);
    }
  }
  const first = c.invalid[0];
  if (first && !(await first.evaluate((el) => el === document.activeElement))) {
    problems.push(`FOCUS_NOT_ON_ERROR: focus is on ${await describeActive(page)}`);
  }
  const after = await readLiveRegions(page);
  trace.push(...after.map((r) => `live ${r.key.slice(0, 30)}: '${r.text}' exposed=${r.exposed}`));
  const changed = after.filter((r) => r.text && r.text !== before.get(r.key));
  const announced = changed.filter((r) => r.exposed);
  if (announced.length === 0) {
    problems.push(changed.length > 0 ? 'ERROR_NOT_ANNOUNCED: the live region that changed is hidden from assistive tech' : 'ERROR_NOT_ANNOUNCED: no live region changed to carry the error');
  } else if (!announced.some((r) => before.has(r.key))) {
    problems.push('LIVE_REGION_CREATED_LATE: live region was inserted with the message; screen readers may miss it');
  }
  return { problems, trace };
}

/** Reflow (WCAG 1.4.10 tham chiếu): ở 320 CSS px không cuộn ngang VÀ không có nội dung bị cắt ngoài viewport (trừ vùng tự cuộn ngang như bảng). */
export async function checkReflow(page: Page, width = 320): Promise<FlowResult> {
  const original = page.viewportSize();
  await page.setViewportSize({ width, height: 640 });
  const m = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const scrolls = (el: Element | null): boolean =>
      Boolean(el && el !== document.documentElement && (/(auto|scroll)/.test(getComputedStyle(el).overflowX) || scrolls(el.parentElement)));
    const clipped = Array.from(document.body.querySelectorAll('*'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > vw + 0.5 && !scrolls(el.parentElement);
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`);
    return { scroll: document.documentElement.scrollWidth, client: vw, clipped };
  });
  if (original) await page.setViewportSize(original);
  const trace = [`width ${width}: scrollWidth ${m.scroll}, clientWidth ${m.client}, past-edge ${m.clipped.join(' ') || 'none'}`];
  const problems: string[] = [];
  if (m.scroll > m.client) problems.push(`REFLOW_HORIZONTAL_SCROLL: ${m.scroll}px > ${m.client}px at ${width}px`);
  else if (m.clipped.length > 0) problems.push(`REFLOW_CONTENT_CLIPPED: ${m.clipped.join(', ')} extend past ${m.client}px with no scroll`);
  return { problems, trace };
}

export function expectA11yFlow(label: string, result: FlowResult): void {
  if (result.problems.length > 0) {
    throw new Error(`A11Y_FLOW_FAILED (${label}): ${result.problems.join('; ')}\n${result.trace.join('\n')}`);
  }
}
