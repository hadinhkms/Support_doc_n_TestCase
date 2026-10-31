import type { Locator, Page } from '@playwright/test';

export async function evaluateInteractiveA11yInScope(
  scope: Page | Locator,
  maxElements: number,
): Promise<{ visibleInteractiveCount: number; violations: string[] }> {
  const rootLocator = 'mainFrame' in scope ? scope.locator('html') : scope;
  return rootLocator.evaluate((root, limit) => {
    const sel =
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="link"]';
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(sel)).slice(0, limit);
    let visibleInteractiveCount = 0;
    const violations: string[] = [];
    const getName = (el: HTMLElement): string => {
      const aria = el.getAttribute('aria-label')?.trim();
      if (aria) return aria;
      const labelledBy = el.getAttribute('aria-labelledby')?.trim();
      if (labelledBy) {
        const t = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
          .join(' ')
          .trim();
        if (t) return t;
      }
      if (
        el instanceof HTMLInputElement &&
        ['submit', 'button', 'reset'].includes(el.type) &&
        el.value?.trim()
      ) {
        return el.value.trim();
      }
      if (el.id) {
        const lbl = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl?.textContent?.trim()) return lbl.textContent.trim();
      }
      return (
        el.closest('label')?.textContent?.trim() ||
        (el.innerText || el.textContent || '').trim() ||
        el.getAttribute('title')?.trim() ||
        el.getAttribute('placeholder')?.trim() ||
        ''
      );
    };
    for (const el of nodes) {
      const st = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (st.display === 'none' || st.visibility === 'hidden' || r.width <= 0 || r.height <= 0) {
        continue;
      }
      visibleInteractiveCount += 1;
      if (!getName(el)) {
        violations.push(
          `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}> thiếu accessible label`,
        );
      }
    }
    return { visibleInteractiveCount, violations };
  }, maxElements);
}

