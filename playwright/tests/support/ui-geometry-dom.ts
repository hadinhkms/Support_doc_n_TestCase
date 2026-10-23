import type { Locator, Page } from '@playwright/test';

export type BoundingBox = { x: number; y: number; width: number; height: number };
export interface ViewportConfig { name: string; width: number; height: number }

export const DEFAULT_VIEWPORTS: ViewportConfig[] = [
  { name: 'mobile-320', width: 320, height: 640 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
];

export function boxesOverlap(a: BoundingBox, b: BoundingBox, tolerancePx = 1): boolean {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlapX > tolerancePx && overlapY > tolerancePx;
}

export async function waitForLayoutStability(page: Page, settleMs = 40): Promise<void> {
  await page.evaluate(async (ms) => {
    if (document.fonts && 'ready' in document.fonts) {
      await document.fonts.ready.catch(() => {});
    }
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, ms))),
    );
  }, settleMs);
}

export async function evaluateTextOverflowInScope(
  scope: Page | Locator,
  selectors: string,
  options: { allowEllipsis: boolean; allowScrollable: boolean },
): Promise<{ visibleCount: number; offenders: string[] }> {
  const rootLocator = 'mainFrame' in scope ? scope.locator('html') : scope;
  return rootLocator.evaluate(
    (root, arg) => {
      const elements = Array.from(root.querySelectorAll<HTMLElement>(arg.selectors));
      const offenders: string[] = [];
      let visibleCount = 0;

      for (const el of elements) {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          parseFloat(style.opacity || '1') === 0 ||
          rect.width <= 0 ||
          rect.height <= 0
        ) {
          continue;
        }
        visibleCount += 1;
        const isScrollable = ['auto', 'scroll'].some(
          (v) => style.overflowX === v || style.overflowY === v,
        );
        if (arg.allowScrollable && isScrollable) continue;
        const isEllipsis =
          style.overflowX === 'hidden' &&
          style.whiteSpace === 'nowrap' &&
          style.textOverflow === 'ellipsis';
        if (arg.allowEllipsis && isEllipsis) continue;

        const overflowX = el.scrollWidth > el.clientWidth + 1;
        const clipY = ['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowY);
        const overflowY = clipY && el.scrollHeight > el.clientHeight + 1;
        if (overflowX || overflowY) {
          const testId = el.getAttribute('data-testid');
          const desc = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${
            testId ? `[data-testid="${testId}"]` : ''
          }`;
          offenders.push(
            `${desc} (scroll=${el.scrollWidth}x${el.scrollHeight}, client=${el.clientWidth}x${el.clientHeight})`,
          );
        }
      }
      return { visibleCount, offenders };
    },
    { selectors, ...options },
  );
}

export async function evaluateContainmentAndAncestorClip(
  child: Locator,
  parent: Locator,
  tolerancePx: number,
  checkAncestorClips: boolean,
): Promise<{ ok: boolean; reason: string }> {
  const parentHandle = await parent.elementHandle();
  if (!parentHandle) return { ok: false, reason: 'Không tìm thấy phần tử cha' };
  try {
    return await child.evaluate(
      (childEl, arg) => {
        const { parentEl, tol, checkClips } = arg;
        const cRect = childEl.getBoundingClientRect();
        const pRect = parentEl.getBoundingClientRect();
        if (
          cRect.left < pRect.left - tol ||
          cRect.top < pRect.top - tol ||
          cRect.right > pRect.right + tol ||
          cRect.bottom > pRect.bottom + tol
        ) {
          return { ok: false, reason: 'Phần tử con tràn khỏi khung cha' };
        }
        if (checkClips) {
          let curr: HTMLElement | null = childEl.parentElement;
          while (curr && curr !== document.body && curr !== document.documentElement) {
            const st = window.getComputedStyle(curr);
            const clipsX = ['hidden', 'clip', 'scroll', 'auto'].includes(st.overflowX);
            const clipsY = ['hidden', 'clip', 'scroll', 'auto'].includes(st.overflowY);
            if (clipsX || clipsY) {
              const aRect = curr.getBoundingClientRect();
              if (
                (clipsX && (cRect.left < aRect.left - tol || cRect.right > aRect.right + tol)) ||
                (clipsY && (cRect.top < aRect.top - tol || cRect.bottom > aRect.bottom + tol))
              ) {
                return {
                  ok: false,
                  reason: `Phần tử con bị cắt bởi ancestor <${curr.tagName.toLowerCase()}>`,
                };
              }
            }
            curr = curr.parentElement;
          }
        }
        return { ok: true, reason: '' };
      },
      { parentEl: parentHandle, tol: tolerancePx, checkClips: checkAncestorClips },
    );
  } finally {
    await parentHandle.dispose();
  }
}

export async function evaluateOcclusionOnElement(
  locator: Locator,
  samplePoints: ('center' | 'corners')[],
): Promise<{ ok: boolean; reason: string }> {
  return locator.evaluate((el, pointsMode) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0)
      return { ok: false, reason: 'Phần tử có kích thước bằng 0' };
    let [clipL, clipT, clipR, clipB] = [0, 0, window.innerWidth, window.innerHeight];
    let curr: HTMLElement | null = el.parentElement;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      const st = window.getComputedStyle(curr);
      if (['hidden', 'clip', 'scroll', 'auto'].some((v) => st.overflowX === v || st.overflowY === v)) {
        const aRect = curr.getBoundingClientRect();
        clipL = Math.max(clipL, aRect.left);
        clipT = Math.max(clipT, aRect.top);
        clipR = Math.min(clipR, aRect.right);
        clipB = Math.min(clipB, aRect.bottom);
      }
      curr = curr.parentElement;
    }
    if (rect.left < clipL - 1 || rect.top < clipT - 1 || rect.right > clipR + 1 || rect.bottom > clipB + 1) {
      return { ok: false, reason: 'Phần tử bị cắt khuất bởi khung nhìn hoặc tổ tiên' };
    }
    const [inX, inY] = [Math.max(1, Math.min(3, rect.width / 4)), Math.max(1, Math.min(3, rect.height / 4))];
    const pts: { label: string; x: number; y: number }[] = [];
    if (pointsMode.includes('center'))
      pts.push({ label: 'center', x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    if (pointsMode.includes('corners')) {
      pts.push(
        { label: 'top-left', x: rect.left + inX, y: rect.top + inY },
        { label: 'top-right', x: rect.right - inX, y: rect.top + inY },
        { label: 'bottom-left', x: rect.left + inX, y: rect.bottom - inY },
        { label: 'bottom-right', x: rect.right - inX, y: rect.bottom - inY },
      );
    }
    for (const pt of pts) {
      const topEl = document.elementFromPoint(pt.x, pt.y);
      const isOwned =
        topEl !== null &&
        (el === topEl || el.contains(topEl) || (topEl.tagName === 'LABEL' && topEl.contains(el)));
      if (!isOwned) {
        const occluder = topEl ? `${topEl.tagName.toLowerCase()}${topEl.id ? `#${topEl.id}` : ''}` : 'null';
        return { ok: false, reason: `Điểm ${pt.label} bị che khuất bởi <${occluder}>` };
      }
    }
    return { ok: true, reason: '' };
  }, samplePoints);
}

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
      if (el instanceof HTMLInputElement && ['submit', 'button', 'reset'].includes(el.type) && el.value?.trim())
        return el.value.trim();
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
      if (st.display === 'none' || st.visibility === 'hidden' || r.width <= 0 || r.height <= 0)
        continue;
      visibleInteractiveCount += 1;
      if (!getName(el))
        violations.push(`<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}> thiếu accessible label`);
    }
    return { visibleInteractiveCount, violations };
  }, maxElements);
}
