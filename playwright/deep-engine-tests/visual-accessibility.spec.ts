import { expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { evidenceTest as test } from '../tests/fixtures/evidence.fixture';
import { sha256 } from '../tests/support/evidence-integrity';
import { checkDialogFocus, checkFormErrors, checkReflow, type FlowResult } from '../tests/support/a11y-flows';
import { conformanceClaimProblems, formatScanReport, runAutomatedScan, SCAN_STATEMENT } from '../tests/support/a11y-scan';
import { APPROVAL_FILE, approveBaseline, checkBaseline, type ApprovalManifest } from '../tests/support/visual-baseline';
import { a11yPage, A11Y_VARIANTS, type A11yVariant } from './visual-accessibility.pages';
import {
  approveCandidate,
  baselineFile,
  nestedIndex,
  prepareVisualDir,
  replayFromReceipt,
  reviewFor,
  runVisual,
  TIMESTAMP_MASK,
  type VisualCase,
} from './visual-accessibility.harness';

/**
 * Phase 3 — Visual regression & accessibility (PLAN-16, TC-16-P3-1..3).
 * Visual: Playwright run con thật với cấu hình `visual-env.ts`, baseline chỉ có qua approval.
 * A11y: helper chạy trên trang tham chiếu, mỗi variant lỗi là một lỗi cài cố ý.
 */
const D1 = '2026-11-03 10:00';
const D2 = '2026-11-04 23:59';
const WHO = { approvedBy: 'qa-reviewer', author: 'dev-author', reason: 'Matches approved checkout design v3' };

function candidateAndApprove(label: string) {
  const dir = prepareVisualDir(label);
  const candidate = runVisual(dir, [['good', D1]], [TIMESTAMP_MASK]);
  const approval = approveCandidate(dir, candidate, 'card good', WHO);
  return { dir, candidate, approval };
}

test.describe('@REQ-16-P3 Phase 3 - Visual regression & accessibility (TC-16-P3-1..3)', () => {
  test.describe.configure({ mode: 'default', timeout: 240_000 });

  test('HM-12 - TC-16-P3-1 - AC-16-P3-1: intended UI change fails with actual/expected/diff; masked data does not', ({ evidence }) => {
    const { dir, candidate } = candidateAndApprove('diff');
    // tint = #000→#333 chữ tổng tiền: dưới ngưỡng mặc định 0.2 (QA P2), phải vẫn bị bắt.
    const cases: VisualCase[] = [['good', D1], ['good', D2], ['shifted', D1], ['price', D1], ['tint', D1]];
    const v = runVisual(dir, cases, [TIMESTAMP_MASK]);
    expect(v.run.receipt?.counts, v.run.output).toMatchObject({ matched: 5, executed: 5, expected: 2, unexpected: 3 });
    expect(v.run.receipt?.verdict.evidence).toBe('COMPLETE');
    for (const ok of [`good @ ${D1}`, `good @ ${D2}`]) {
      expect(reviewFor(v, ok).review, ok).toMatchObject({ result: 'MATCH', problems: [] });
    }
    for (const bad of ['shifted', 'price', 'tint']) {
      const { manifest, review, read } = reviewFor(v, bad);
      expect(manifest.outcome.status, bad).toBe('failed');
      expect(review?.result, bad).toBe('DIFF');
      expect(review?.problems.join(), bad).toContain('VISUAL_DIFF');
      // Reviewer thấy đủ ảnh gốc, ảnh thực tế và diff; hash trong review khớp artifact evidence.
      for (const label of ['expected', 'actual', 'diff']) {
        const bytes = read(`checkout-card-${label}.png`);
        expect(bytes, `${bad} ${label}`).not.toBeNull();
        expect(review?.images[label], `${bad} ${label}`).toBe(sha256(bytes!));
      }
      expect(review?.images.expected).toBe(review?.baseline.approvedSha256);
    }
    // Control: bỏ mask thì chính thay đổi timestamp gây diff → mask mới là thứ hấp thụ nhiễu dữ liệu.
    const unmasked = runVisual(dir, [['good', D2]], []);
    expect(unmasked.run.receipt?.counts).toMatchObject({ executed: 1, unexpected: 1 });
    expect(reviewFor(unmasked, 'good').review?.result).toBe('DIFF');

    // UAT (d): replay chỉ từ receipt (argv + env đã ghi) cho cùng kết cục; chỉ mục run con nằm trong evidence ngoài.
    expect(v.run.receipt?.execution.recordedEnv).toEqual({ REF_VISUAL_CASES: JSON.stringify(cases), REF_VISUAL_MASKS: JSON.stringify([TIMESTAMP_MASK]) });
    const replay = replayFromReceipt(dir, v);
    expect(replay.run.receipt?.counts).toMatchObject({ matched: 5, executed: 5, expected: 2, unexpected: 3 });
    expect(['shifted', 'price', 'tint'].map((b) => reviewFor(replay, b).review?.result)).toEqual(['DIFF', 'DIFF', 'DIFF']);
    evidence.attach('nested-runs.json', nestedIndex([candidate, v, unmasked, replay]));
  });

  test('HM-12 - TC-16-P3-2 - AC-16-P3-2: missing, unapproved, overwritten or stale baselines never pass', ({ evidence }) => {
    const dir = prepareVisualDir('approval');
    const file = baselineFile(dir);
    // Thiếu baseline, kể cả khi gọi --update-snapshots=missing: fail, có ảnh ứng viên, không tự ghi baseline.
    const missing = runVisual(dir, [['good', D1]], [TIMESTAMP_MASK], ['--update-snapshots=missing']);
    const first = reviewFor(missing, 'good');
    expect(missing.run.receipt?.counts).toMatchObject({ executed: 1, unexpected: 1 });
    expect(first.review).toMatchObject({ result: 'BLOCKED' });
    expect(first.review?.problems.join()).toContain('BASELINE_MISSING');
    expect(first.read('checkout-card-actual.png')).not.toBeNull();
    expect(fs.existsSync(file), 'no baseline written without approval').toBe(false);

    // Approval bị từ chối: tự duyệt, không lý do, ứng viên bị sửa.
    expect(() => approveCandidate(dir, missing, 'good', { ...WHO, approvedBy: WHO.author })).toThrow(/SELF_APPROVAL/);
    expect(() => approveCandidate(dir, missing, 'good', { ...WHO, reason: ' ' })).toThrow(/APPROVAL_WITHOUT_REASON/);
    // QA P2: tên tác giả đổi hoa/thường, thêm khoảng trắng hay ký tự zero-width vẫn là tự duyệt.
    for (const alias of ['Dev-Author', ' dev-author ', 'dev-author\u200b', '\uFF24\uFF25\uFF36-author']) {
      expect(() => approveCandidate(dir, missing, 'good', { ...WHO, approvedBy: alias }), JSON.stringify(alias)).toThrow(/SELF_APPROVAL/);
    }
    const env = first.review!.env;
    const forged = { file, candidate: Buffer.from('forged'), ...WHO, env, masks: [TIMESTAMP_MASK] };
    const source = { runId: 'r', attemptId: 'a', artifactSha256: first.review!.images.actual };
    expect(() => approveBaseline({ ...forged, source })).toThrow(/CANDIDATE_TAMPERED/);
    expect(fs.existsSync(file)).toBe(false);
    const approval = approveCandidate(dir, missing, 'good', WHO);

    // Kiểm approval theo dữ liệu: chưa duyệt / env lệch / mask chưa duyệt hoặc thiếu lý do / approval hỏng.
    const ok = checkBaseline({ file, env, masks: [TIMESTAMP_MASK] });
    expect(ok.problems).toEqual([]);
    const stale = checkBaseline({ file, env: { ...env, viewport: '1280x720', browser: 'chromium@0.0' }, masks: [TIMESTAMP_MASK] });
    expect(stale.problems.join()).toContain('STALE_BASELINE_ENV: viewport');
    expect(stale.problems.join()).toContain('STALE_BASELINE_ENV: browser');
    const extraMask = checkBaseline({ file, env, masks: [TIMESTAMP_MASK, { selector: '[data-testid="total"]', reason: 'hide price' }] });
    expect(extraMask.problems.join()).toContain('MASK_NOT_APPROVED');
    expect(checkBaseline({ file, env, masks: [{ selector: '[data-testid="total"]', reason: '' }] }).problems.join()).toContain('MASK_WITHOUT_REASON');
    const approvalPath = path.join(path.dirname(file), APPROVAL_FILE);
    const manifest = JSON.parse(fs.readFileSync(approvalPath, 'utf8')) as ApprovalManifest;
    const name = path.basename(file);
    fs.writeFileSync(approvalPath, JSON.stringify({ ...manifest, baselines: { [name]: { ...approval, reason: '' } } }));
    expect(checkBaseline({ file, env, masks: [TIMESTAMP_MASK] }).problems.join()).toContain('APPROVAL_INVALID');
    fs.writeFileSync(approvalPath, JSON.stringify({ ...manifest, baselines: {} }));
    expect(checkBaseline({ file, env, masks: [TIMESTAMP_MASK] }).problems.join()).toContain('BASELINE_UNAPPROVED');
    fs.writeFileSync(approvalPath, JSON.stringify(manifest));

    // QA P1-2: --ignore-snapshots tắt việc so ảnh → UI sai không được ghi MATCH.
    const ignored = runVisual(dir, [['shifted', D1]], [TIMESTAMP_MASK], ['--ignore-snapshots']);
    expect(ignored.run.receipt?.counts).toMatchObject({ executed: 1, unexpected: 1 });
    const skipped = reviewFor(ignored, 'shifted').review;
    expect(skipped?.result).toBe('BLOCKED');
    expect(skipped?.problems.join()).toContain('VISUAL_SNAPSHOTS_IGNORED');

    // --update-snapshots=all với UI sai: Playwright ghi đè baseline → kiểm sau bắt BASELINE_CHANGED, test fail.
    const overwrite = runVisual(dir, [['shifted', D1]], [TIMESTAMP_MASK], ['--update-snapshots=all']);
    expect(overwrite.run.receipt?.counts).toMatchObject({ executed: 1, unexpected: 1 });
    const over = reviewFor(overwrite, 'shifted').review;
    expect(over?.result).toBe('BLOCKED');
    expect(over?.problems.join()).toContain('BASELINE_CHANGED');
    expect(sha256(fs.readFileSync(file))).not.toBe(approval.sha256);

    // QA P1-1: sửa tay approval cho khớp ảnh đã bị ghi đè (không qua approveBaseline) → vẫn bị chặn.
    const current = fs.readFileSync(file);
    const handEdited = { ...approval, sha256: sha256(current), bytes: current.length };
    fs.writeFileSync(approvalPath, JSON.stringify({ ...manifest, baselines: { [name]: handEdited } }));
    const forgedApproval = checkBaseline({ file, env, masks: [TIMESTAMP_MASK] }).problems.join();
    fs.writeFileSync(approvalPath, JSON.stringify(manifest));
    expect(forgedApproval).toContain('APPROVAL_INVALID: approved hash is not the reviewed candidate');
    expect(forgedApproval).not.toContain('BASELINE_CHANGED');

    // Sau khi bị ghi đè: UI đúng vẫn không pass; mask chết, chưa duyệt, che chính target hoặc quá lớn đều bị chặn.
    const masks = [
      TIMESTAMP_MASK,
      { selector: '[data-testid="missing"]', reason: 'gone' },
      { selector: '[data-testid="card"]', reason: 'whole card' },
      { selector: 'h2, p, button', reason: 'most of the card' },
    ];
    const after = runVisual(dir, [['good', D1]], masks);
    expect(after.run.receipt?.counts).toMatchObject({ executed: 1, unexpected: 1 });
    const blocked = reviewFor(after, 'good');
    expect(blocked.review?.problems.join('; ')).toMatch(/BASELINE_CHANGED[\s\S]*MASK_NOT_APPROVED[\s\S]*MASK_EMPTY/);
    expect(blocked.review?.problems.join('; ')).toContain(`MASK_EMPTY: '[data-testid="card"]'`);
    expect(blocked.review?.problems.join('; ')).toContain(`MASK_TOO_LARGE: 'h2, p, button'`);
    expect(blocked.read('checkout-card-expected.png'), 'reviewer sees the current baseline').not.toBeNull();
    evidence.attach('nested-runs.json', nestedIndex([missing, ignored, overwrite, after]));
  });

  test('HM-12 - TC-16-P3-3 - AC-16-P3-3: modal and form-error flows check focus and keyboard; scans never claim WCAG conformance', async ({ page, evidence }) => {
    const flows = (variant: A11yVariant) => test.step(`variant ${variant}`, async () => {
      await page.setContent(a11yPage(variant));
      const dialog = await checkDialogFocus(page, { trigger: page.getByTestId('open'), dialog: page.getByTestId('dialog') });
      const form = await checkFormErrors(page, { submit: page.getByTestId('submit'), invalid: [page.getByTestId('email')] });
      const reflow = await checkReflow(page);
      const scan = await runAutomatedScan(page);
      return { dialog, form, reflow, scan };
    });
    const codes = (r: FlowResult) => r.problems.map((p) => p.split(':')[0]);

    const good = await flows('good');
    expect(good.dialog, good.dialog.trace.join('\n')).toEqual(expect.objectContaining({ problems: [] }));
    expect(good.dialog.trace.at(-1)).toContain('button#open');
    expect(good.form.problems).toEqual([]);
    expect(good.reflow.problems).toEqual([]);
    expect(good.scan.violations).toEqual([]);
    evidence.attach('a11y-good-report.json', good);

    // Mỗi variant lỗi: đúng check bị cài lỗi báo mã kỳ vọng, các check còn lại sạch (một nguyên nhân).
    const faults: Record<Exclude<A11yVariant, 'good' | 'unlabeled'>, ['dialog' | 'form' | 'reflow', string]> = {
      'no-trap': ['dialog', 'FOCUS_ESCAPED'],
      'no-restore': ['dialog', 'FOCUS_NOT_RESTORED'],
      'no-escape': ['dialog', 'DIALOG_NOT_DISMISSIBLE'],
      'no-focus-move': ['dialog', 'FOCUS_NOT_MOVED'],
      'no-role': ['dialog', 'DIALOG_SEMANTICS'],
      'tabindex-trap': ['dialog', 'CONTROL_NOT_TABBABLE'],
      'no-live': ['form', 'ERROR_NOT_ANNOUNCED'],
      'late-live': ['form', 'LIVE_REGION_CREATED_LATE'],
      'hidden-live': ['form', 'ERROR_NOT_ANNOUNCED'],
      'stale-status': ['form', 'ERROR_NOT_ANNOUNCED'],
      unassociated: ['form', 'ERROR_NOT_ASSOCIATED'],
      'hidden-msg': ['form', 'ERROR_MESSAGE_HIDDEN'],
      'no-invalid': ['form', 'FIELD_NOT_MARKED_INVALID'],
      'no-error-focus': ['form', 'FOCUS_NOT_ON_ERROR'],
      wide: ['reflow', 'REFLOW_HORIZONTAL_SCROLL'],
      clipped: ['reflow', 'REFLOW_CONTENT_CLIPPED'],
    };
    expect(Object.keys(faults).length + 2, 'every variant is exercised').toBe(A11Y_VARIANTS.length);
    for (const [variant, [check, code]] of Object.entries(faults) as [A11yVariant, ['dialog' | 'form' | 'reflow', string]][]) {
      const r = await flows(variant);
      evidence.attach(`a11y-${variant}-report.json`, r);
      expect(codes(r[check]), variant).toContain(code);
      for (const other of (['dialog', 'form', 'reflow'] as const).filter((c) => c !== check)) {
        expect(r[other].problems, `${variant}: ${other} must stay clean`).toEqual([]);
      }
    }
    // tabindex-trap: focus đứng trên container chứ không phải control → cũng phải báo FOCUS_NOT_MOVED.
    expect(codes((await flows('tabindex-trap')).dialog)).toContain('FOCUS_NOT_MOVED');
    const unlabeled = await flows('unlabeled');
    expect(unlabeled.scan.violations.map((v) => v.id)).toContain('button-name');
    // Report tự động: không bao giờ là conformance; checklist screen reader thủ công vẫn NOT_RUN.
    const text = formatScanReport(good.scan);
    expect(good.scan.conformanceClaim).toBe('NONE');
    expect(text.split('\n')[0]).toBe(SCAN_STATEMENT);
    expect(good.scan.manualChecks.every((m) => m.status === 'NOT_RUN')).toBe(true);
    expect(conformanceClaimProblems(text)).toEqual([]);
    const overclaims = [
      'Login page is WCAG 2.1 AA compliant (0 axe violations)',
      'Meets WCAG 2.1 AA',
      'WCAG 2.1 Level AA conformant',
      'The form is WCAG-compliant',
      'Fully compliant with WCAG 2.2',
      '100% accessible',
      'ADA-compliant checkout',
    ];
    for (const claim of overclaims) expect(conformanceClaimProblems(claim), claim).toHaveLength(1);
    evidence.attach('a11y-scan.txt', text, { mime: 'text/plain' });
  });
});
