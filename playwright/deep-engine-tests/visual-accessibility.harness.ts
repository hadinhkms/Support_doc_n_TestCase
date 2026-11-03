import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EvidenceManifest } from '../tests/support/evidence-manifest';
import { verifyEvidenceBundle } from '../tests/support/evidence-verify';
import { approveBaseline, type MaskRule } from '../tests/support/visual-baseline';
import { VISUAL_REVIEW_ARTIFACT } from '../tests/support/visual-assert';
import type { VisualEnvKey } from '../tests/support/visual-env';
import type { CardVariant } from './visual-accessibility.pages';
import { prepareNestedRun, readManifests, runNested, type NestedRun } from './evidence-pipeline.harness';

/**
 * Harness cho visual-accessibility.spec.ts: Playwright run thật (process con) với cấu hình visual
 * cố định của `visual-env.ts`, spec con gọi `expectApprovedScreenshot` (public caller).
 */
const posix = (p: string) => p.split(path.sep).join('/');
const SUPPORT = posix(path.resolve(__dirname, '../tests/support'));
const PAGES = posix(path.join(__dirname, 'visual-accessibility.pages'));
const REPORTER = `${SUPPORT}/evidence-reporter.ts`;

export const TIMESTAMP_MASK: MaskRule = { selector: '[data-testid="timestamp"]', reason: 'server clock, not under test' };
export type VisualCase = [variant: CardVariant, stamp: string];

const VISUAL_SPEC = `
import { expectApprovedScreenshot } from '${SUPPORT}/visual-assert';
import { checkoutCard } from '${PAGES}';
const masks = JSON.parse(process.env.REF_VISUAL_MASKS ?? '[]');
const cases = JSON.parse(process.env.REF_VISUAL_CASES ?? '[]');
test.describe('@REQ-REF-V nested visual', () => {
  for (const [variant, stamp] of cases) {
    test('TC-REF-V - AC-REF-V card ' + variant + ' @ ' + stamp, async ({ page, evidence }) => {
      await page.setContent(checkoutCard(variant, stamp));
      await expectApprovedScreenshot(page.getByTestId('card'), 'checkout-card.png', { evidence, masks, synthetic: true });
    });
  }
});
`;

export function prepareVisualDir(label: string): string {
  const dir = prepareNestedRun(label, { 'visual.spec.ts': VISUAL_SPEC });
  const config = [
    "import { defineConfig } from '@playwright/test';",
    `import { initEvidenceRun } from '${SUPPORT}/evidence-run';`,
    `import { VISUAL_EXPECT, VISUAL_SNAPSHOT_TEMPLATE, VISUAL_UPDATE_SNAPSHOTS, VISUAL_USE } from '${SUPPORT}/visual-env';`,
    'initEvidenceRun(__dirname);',
    'export default defineConfig({',
    "  testDir: './specs', outputDir: './out', retries: 0, timeout: 30_000, workers: 1,",
    '  snapshotPathTemplate: VISUAL_SNAPSHOT_TEMPLATE, updateSnapshots: VISUAL_UPDATE_SNAPSHOTS,',
    '  expect: { ...VISUAL_EXPECT }, use: { ...VISUAL_USE },',
    `  reporter: [['junit', { outputFile: 'junit.xml' }], ['${REPORTER}', { junitFile: 'junit.xml' }]],`,
    '});',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'nested.config.ts'), config);
  return dir;
}

export const baselineFile = (dir: string) =>
  path.join(dir, 'specs', '__baselines__', 'visual.spec.ts', `checkout-card-${process.platform}.png`);

export interface VisualRun {
  run: NestedRun;
  manifests: EvidenceManifest[];
}

let runCounter = 0;

export function runVisual(dir: string, cases: VisualCase[], masks: MaskRule[], extraArgs: string[] = []): VisualRun {
  // EVIDENCE_RECORD_ENV: receipt ghi lại input replay (UAT bước d), không chỉ argv/cwd.
  const env = { REF_VISUAL_CASES: JSON.stringify(cases), REF_VISUAL_MASKS: JSON.stringify(masks), EVIDENCE_RECORD_ENV: 'REF_VISUAL_CASES,REF_VISUAL_MASKS' };
  const run = runNested(dir, ['specs/visual.spec.ts', ...extraArgs], env, true, `r${++runCounter}`);
  return { run, manifests: readManifests(run) };
}

/** Replay đúng như receipt ghi: argv sau `playwright test -c nested.config.ts` + env đã ghi. */
export function replayFromReceipt(dir: string, v: VisualRun): VisualRun {
  const exec = v.run.receipt!.execution;
  const prefix = ['playwright', 'test', '-c', 'nested.config.ts'];
  if (prefix.some((p, i) => exec.argv[i] !== p)) throw new Error(`unexpected argv ${exec.argv.join(' ')}`);
  const run = runNested(dir, exec.argv.slice(prefix.length), exec.recordedEnv ?? {}, true, `r${++runCounter}`);
  return { run, manifests: readManifests(run) };
}

/** Chỉ mục run con cho evidence của test ngoài: người tiếp quản không phải đoán đường dẫn bundle. */
export function nestedIndex(runs: VisualRun[]) {
  const pwRoot = path.resolve(__dirname, '..');
  return runs.map((v) => ({
    runId: v.run.receipt?.runId ?? null,
    runRoot: posix(path.relative(pwRoot, v.run.runRoot)),
    verdict: v.run.receipt?.verdict.evidence ?? null,
    counts: v.run.receipt?.counts ?? null,
    recordedEnv: v.run.receipt?.execution.recordedEnv ?? {},
  }));
}

export interface VisualReview {
  result: 'MATCH' | 'BLOCKED' | 'DIFF';
  problems: string[];
  env: VisualEnvKey;
  images: Record<string, string>;
  baseline: { sha256: string | null; approvedSha256: string | null };
}

/** Review + ảnh của attempt có title chứa `match`, đọc từ bundle (đường dẫn trong manifest). */
export function reviewFor(v: VisualRun, match: string) {
  const manifest = v.manifests.find((m) => m.identity.title.includes(match));
  if (!manifest) throw new Error(`no attempt titled '${match}'`);
  const read = (name: string) => {
    const a = manifest.artifacts.find((x) => x.name === name);
    return a ? fs.readFileSync(path.join(v.run.runRoot, a.path)) : null;
  };
  const review = JSON.parse(read(VISUAL_REVIEW_ARTIFACT)?.toString('utf8') ?? 'null') as VisualReview | null;
  return { manifest, review, read };
}

/** Reviewer duyệt ứng viên `actual` của attempt BLOCKED: bundle phải verify trước, hash phải khớp artifact. */
export function approveCandidate(dir: string, v: VisualRun, match: string, who: { approvedBy: string; author: string; reason: string }) {
  const bundle = verifyEvidenceBundle(v.run.runRoot);
  if (!bundle.ok) throw new Error(`candidate bundle not verified: ${bundle.problems.join('; ')}`);
  const { manifest, review, read } = reviewFor(v, match);
  const artifact = manifest.artifacts.find((a) => a.name === 'checkout-card-actual.png')!;
  return approveBaseline({
    file: baselineFile(dir),
    candidate: read(artifact.name)!,
    ...who,
    env: review!.env,
    masks: [TIMESTAMP_MASK],
    source: { runId: manifest.identity.runId, attemptId: manifest.attempt.attemptId, artifactSha256: artifact.sha256 },
  });
}
