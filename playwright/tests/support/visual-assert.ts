import { expect, test, type Locator, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import { sha256 } from './evidence-integrity';
import type { createEvidenceCollector } from './evidence-collector';
import { checkBaseline, type MaskRule } from './visual-baseline';
import { observeVisualEnv, VISUAL_EXPECT } from './visual-env';

/**
 * Public caller cho visual regression (PLAN-16 Phase 3): kiểm approval TRƯỚC khi so ảnh, so
 * bằng `toHaveScreenshot`, rồi kiểm lại SAU (bắt `--update-snapshots` ghi đè baseline đã duyệt).
 * Mọi kết cục đều attach `visual-review.json` + ảnh (actual / expected / diff) để reviewer thấy
 * cả ảnh gốc lẫn diff. Baseline thiếu/chưa duyệt/đổi/lệch env → fail, không bao giờ tự pass.
 */
type Evidence = Pick<ReturnType<typeof createEvidenceCollector>, 'attach'>;

export interface ApprovedScreenshotOptions {
  masks?: MaskRule[];
  evidence?: Evidence;
  /** Chỉ cho trang tham chiếu dữ liệu giả lập; ảnh thật luôn RESTRICTED (Phase 1). */
  synthetic?: boolean;
}

export const VISUAL_REVIEW_ARTIFACT = 'visual-review.json';
const SHOT = VISUAL_EXPECT.toHaveScreenshot;

function pageOf(target: Page | Locator): Page {
  return 'goto' in target ? target : target.page();
}

export async function expectApprovedScreenshot(target: Page | Locator, name: string, options: ApprovedScreenshotOptions = {}) {
  const info = test.info();
  const page = pageOf(target);
  const masks = options.masks ?? [];
  const file = info.snapshotPath(name, { kind: 'screenshot' });
  const env = await observeVisualEnv(page);
  const mask = masks.map((m) => page.locator(m.selector));
  const counts = await Promise.all(mask.map((l) => l.count()));
  const review = {
    schemaVersion: 'visual-review/1',
    name,
    env,
    masks,
    baseline: { sha256: fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null, approvedSha256: null as string | null },
    result: 'MATCH' as 'MATCH' | 'BLOCKED' | 'DIFF',
    problems: [] as string[],
    images: {} as Record<string, string>,
  };
  const keep = (label: string, bytes: Buffer) => {
    review.images[label] = sha256(bytes);
    options.evidence?.attach(`${name.replace(/\.png$/, '')}-${label}.png`, bytes, { mime: 'image/png', synthetic: options.synthetic });
  };
  const finish = () => options.evidence?.attach(VISUAL_REVIEW_ARTIFACT, review);

  const pre = checkBaseline({ file, env, masks });
  review.baseline.approvedSha256 = pre.approval?.sha256 ?? null;
  review.problems.push(...pre.problems);
  // Mask không khớp phần tử nào là mask "chết": không che gì nhưng tạo cảm giác đã xử lý nhiễu.
  for (const [i, n] of counts.entries()) {
    if (n === 0) review.problems.push(`MASK_EMPTY: '${masks[i].selector}' matches nothing`);
  }
  if (review.problems.length > 0) {
    review.result = 'BLOCKED';
    keep('actual', await target.screenshot({ ...SHOT, mask }));
    if (fs.existsSync(file)) keep('expected', fs.readFileSync(file));
    finish();
    throw new Error(`VISUAL_BASELINE_BLOCKED: ${review.problems.join('; ')}`);
  }
  try {
    if ('goto' in target) await expect(target).toHaveScreenshot(name, { ...SHOT, mask });
    else await expect(target).toHaveScreenshot(name, { ...SHOT, mask });
  } catch (err) {
    review.result = 'DIFF';
    review.problems.push(`VISUAL_DIFF: ${(err as Error).message.split('\n')[0]}`);
    for (const label of ['expected', 'actual', 'diff']) {
      const att = info.attachments.find((a) => a.path && a.name.endsWith(`-${label}.png`));
      if (att?.path && fs.existsSync(att.path)) keep(label, fs.readFileSync(att.path));
    }
    finish();
    throw err;
  }
  // `--update-snapshots` có thể đã ghi đè baseline trong lúc so: kiểm lại với approval.
  const post = checkBaseline({ file, env, masks });
  if (post.problems.length > 0) {
    review.result = 'BLOCKED';
    review.problems.push(...post.problems);
    keep('actual', fs.readFileSync(file));
    finish();
    throw new Error(`VISUAL_BASELINE_BLOCKED: ${post.problems.join('; ')}`);
  }
  finish();
}
