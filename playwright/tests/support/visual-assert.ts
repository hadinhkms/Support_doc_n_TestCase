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
/** Trần diện tích mask so với target: che nhiều hơn là không còn kiểm gì đáng kể. */
export const MAX_MASK_AREA_RATIO = 0.25;
// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');

async function measureMasks(target: Page | Locator, mask: Locator[]) {
  const box = 'goto' in target ? null : await target.boundingBox();
  const size = 'goto' in target ? target.viewportSize() : null;
  const targetArea = box ? box.width * box.height : (size?.width ?? 1) * (size?.height ?? 1);
  return Promise.all(
    mask.map(async (l) => {
      const boxes = await Promise.all((await l.all()).map((el) => el.boundingBox()));
      const area = boxes.reduce((sum, b) => sum + (b ? b.width * b.height : 0), 0);
      return { count: boxes.length, areaRatio: targetArea > 0 ? area / targetArea : 1 };
    }),
  );
}

function pageOf(target: Page | Locator): Page {
  return 'goto' in target ? target : target.page();
}

export async function expectApprovedScreenshot(target: Page | Locator, name: string, options: ApprovedScreenshotOptions = {}) {
  const info = test.info();
  const page = pageOf(target);
  const masks = options.masks ?? [];
  const file = info.snapshotPath(name, { kind: 'screenshot' });
  const base = name.replace(/\.png$/, '');
  const env = await observeVisualEnv(page);
  // Mask chỉ tìm TRONG target (một mask không thể che chính target) và bị giới hạn diện tích.
  const mask = masks.map((m) => target.locator(m.selector));
  const measured = await measureMasks(target, mask);
  const review = {
    schemaVersion: 'visual-review/1',
    name,
    env,
    masks,
    maskCoverage: measured.map((m, i) => ({ selector: masks[i].selector, ...m })),
    baseline: { sha256: fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null, approvedSha256: null as string | null },
    result: 'MATCH' as 'MATCH' | 'BLOCKED' | 'DIFF',
    problems: [] as string[],
    images: {} as Record<string, string>,
  };
  const keep = (label: string, bytes: Buffer) => {
    review.images[label] = sha256(bytes);
    options.evidence?.attach(`${base}-${label}.png`, bytes, { mime: 'image/png', synthetic: options.synthetic });
  };
  const finish = () => options.evidence?.attach(VISUAL_REVIEW_ARTIFACT, review);

  const pre = checkBaseline({ file, env, masks });
  review.baseline.approvedSha256 = pre.approval?.sha256 ?? null;
  review.problems.push(...pre.problems);
  // `--ignore-snapshots` / `ignoreSnapshots: true` làm toHaveScreenshot không so gì → không được ghi MATCH.
  if (info.project.ignoreSnapshots) review.problems.push('VISUAL_SNAPSHOTS_IGNORED: screenshot comparison is disabled for this run');
  // Mask không khớp phần tử nào là mask "chết": không che gì nhưng tạo cảm giác đã xử lý nhiễu.
  for (const [i, m] of measured.entries()) {
    if (m.count === 0) review.problems.push(`MASK_EMPTY: '${masks[i].selector}' matches nothing inside the target`);
    else if (m.areaRatio > MAX_MASK_AREA_RATIO) {
      review.problems.push(`MASK_TOO_LARGE: '${masks[i].selector}' hides ${Math.round(m.areaRatio * 100)}% of the target (max ${MAX_MASK_AREA_RATIO * 100}%)`);
    }
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
    review.problems.push(`VISUAL_DIFF: ${stripAnsi((err as Error).message).split('\n')[0]}`);
    for (const label of ['expected', 'actual', 'diff']) {
      const att = info.attachments.find((a) => a.path && a.name === `${base}-${label}.png`);
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
