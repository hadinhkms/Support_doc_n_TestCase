import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { classifyReproduction, type ClassifyInput } from '../tests/support/repro-classify';
import { failureSignature } from '../tests/support/repro-signature';
import {
  attemptsFor,
  correlationTimeline,
  readAttemptJson,
  readReproRun,
  TIMELINE_ARTIFACT,
  type ReproRun,
  type TimelineEvent,
} from '../tests/support/repro-context';
import { verifyFix, type FixVerificationInput } from '../tests/support/repro-fix';
import { recipeArgs, replayEnv, validateRecipe, type ReproRecipe } from '../tests/support/repro-recipe';
import { cloneBundle, gitHead, newCanary } from './evidence-pipeline.harness';
import { CONTRACT, draftRecipe, execRecipe, prepareReproDir, specReader, withParentEnv } from './reproduction-pipeline.harness';

/**
 * Phase 2 — Tái hiện bug & xác minh bản sửa (PLAN-16, TC-16-P2-1..3).
 * Public caller: Playwright run thật trên ứng dụng tham chiếu, argv sinh từ recipe, evidence
 * Phase 1 được verify trước khi phân loại. Lỗi gắn với build `ref-app@1`, bản sửa là `ref-app@2`.
 */
const ANCHOR = 'deep-engine-tests/reproduction-reference-app.ts (POST /orders, POST /reserve)';

function classify(run: ReproRun, scenario: string, extra: Partial<ClassifyInput> = {}) {
  return classifyReproduction({
    scenario: attemptsFor(run, scenario),
    control: attemptsFor(run, 'control'),
    expectedSource: CONTRACT.source,
    dualProof: { runtimeEvidence: run.evidenceOk, sourceAnchor: ANCHOR },
    runProblems: run.problems,
    ...extra,
  });
}

const env = (build: string, actor: string, tenant = 'tenant-a') => ({
  APP_BUILD_ID: build,
  REF_APP_TENANT: tenant,
  REPRO_ACTOR: actor,
});

test.describe('@REQ-16-P2 Phase 2 - Bug reproduction & fix verification (TC-16-P2-1..3)', () => {
  // Mỗi test spawn nhiều Playwright run con; tuần tự trong một worker để không tranh tài nguyên.
  test.describe.configure({ mode: 'default', timeout: 360_000 });

  test('HM-11 - TC-16-P2-1 - AC-16-P2-1: three clean runs separate confirmed, intermittent, environment and test defects', () => {
    const dir = prepareReproDir('classify');
    const recipe = draftRecipe(dir);
    const { run, repro } = execRecipe(dir, recipe, env('ref-app@1', 'qa-author'));
    expect(repro.problems, run.output).toEqual([]);
    expect(run.exitCode, run.output).toBe(1);
    expect(run.receipt?.counts).toMatchObject({ matched: 9, executed: 9, expected: 3, unexpected: 6, notRun: 0 });

    const total = classify(repro, 'order-total');
    expect(total).toMatchObject({ status: 'CONFIRMED_BUG', numerator: 3, denominator: 3, problems: [] });
    expect(total.signatureText).toBe('order total | Expected: 17 | Received: 7');
    const race = classify(repro, 'reserve-race', { artificialTrigger: 'x-test-barrier=2 rendezvous' });
    expect(race).toMatchObject({ status: 'CONFIRMED_BUG', numerator: 3, denominator: 3 });
    expect(race.signatureText).toBe('remaining stock | Expected: 4 | Received: 7');
    expect(race.limitations.join()).toContain('ARTIFICIAL_TRIGGER');
    expect(new Set(attemptsFor(repro, 'order-total').map((a) => a.stateId)).size, 'state per attempt').toBe(3);

    // Correlation timeline: barrier thả đủ 2 request, mỗi request có event server, hai lần ghi đè.
    const raceAttempt = attemptsFor(repro, 'reserve-race')[0];
    const detail = repro.details.get(raceAttempt.attemptId)!;
    const events = readAttemptJson<TimelineEvent[]>(repro.runRoot, repro.manifests.get(raceAttempt.attemptId)!, TIMELINE_ARTIFACT)!;
    const timeline = correlationTimeline(events, detail.requestIds);
    expect(timeline.problems).toEqual([]);
    for (const a of attemptsFor(repro, 'reserve-race')) {
      const evs = readAttemptJson<TimelineEvent[]>(repro.runRoot, repro.manifests.get(a.attemptId)!, TIMELINE_ARTIFACT)!;
      const t = correlationTimeline(evs, repro.details.get(a.attemptId)!.requestIds);
      expect(t.problems, a.attemptId).toEqual([]);
      expect(t.events.filter((e) => e.event === 'barrier-release'), a.attemptId).toHaveLength(1);
    }
    expect(timeline.events.find((e) => e.event === 'barrier-release')?.detail).toMatchObject({ releaseOrder: 2 });
    expect(timeline.events.filter((e) => e.event === 'write').map((e) => e.detail)).toEqual([
      { read: 10, wrote: 7 },
      { read: 10, wrote: 7 },
    ]);

    // Gate điều kiện trên cùng dữ liệu: thiếu expected / lần chạy / dual proof / control → không Confirmed.
    expect(classify(repro, 'order-total', { expectedSource: null }).status).toBe('SPEC_GAP');
    const once = classify(repro, 'order-total', { scenario: attemptsFor(repro, 'order-total').slice(0, 1) });
    expect(once).toMatchObject({ status: 'OBSERVATION' });
    expect(once.problems.join()).toContain('INSUFFICIENT_ATTEMPTS: 1/3');
    const noProof = classify(repro, 'order-total', { dualProof: { runtimeEvidence: true } });
    expect(noProof.problems.join()).toContain('MISSING_DUAL_PROOF');
    const noControl = classify(repro, 'order-total', { control: [] });
    expect(noControl.problems.join()).toContain('CONTROL_MISSING');
    expect(classify(repro, 'control').status, 'healthy control 0/3').toBe('OBSERVATION');

    // Control chỉ có giá trị khi sạch, cùng run và có state riêng (review P1-1).
    const control = attemptsFor(repro, 'control');
    const scenario = attemptsFor(repro, 'order-total');
    const badControls: [string, typeof control, RegExp][] = [
      ['control from another run', control.map((a) => ({ ...a, runId: 'OLD-RUN' })), /CONTROL_OTHER_RUN/],
      ['control without verified evidence', control.map((a) => ({ ...a, evidenceOk: false })), /CONTROL_EVIDENCE_INCOMPLETE/],
      ['control cut short', [{ ...control[0], status: 'interrupted' as const }, ...control.slice(1)], /CONTROL_INTERRUPTED_ATTEMPTS/],
      ['control shares scenario state', control.map((a, i) => ({ ...a, stateId: scenario[i].stateId })), /CONTROL_SHARED_STATE/],
    ];
    for (const [label, ctl, pattern] of badControls) {
      const cls = classify(repro, 'order-total', { control: ctl });
      expect(cls.status, label).toBe('OBSERVATION');
      expect(cls.problems.join('; '), label).toMatch(pattern);
    }
    // Attempt không có signature / đếm trùng / run không verify → không Confirmed (review P3, P2-4).
    const noSig = classify(repro, 'order-total', { scenario: scenario.map((a) => ({ ...a, signature: null })) });
    expect(noSig.problems.join()).toContain('SIGNATURE_UNKNOWN');
    const dup = classify(repro, 'order-total', { scenario: [...scenario, { ...scenario[0], stateId: 'state-dup' }] });
    expect(dup.problems.join()).toContain('DUPLICATE_ATTEMPT');
    const dropped = classify(repro, 'order-total', { runProblems: ['REPRO_DETAIL_MISSING: t1 r0 p3'] });
    expect(dropped).toMatchObject({ status: 'OBSERVATION' });
    expect(classify(repro, 'order-total', { scenario: [] }).problems.join()).toContain('NO_ATTEMPTS');

    // Signature phân biệt assertion/locator/giá trị khác nhau, gộp thời gian/port/id biến động (review P1-2, P2-5).
    const diff = (field: string, from: string, to: string) =>
      `Error: expect(received).toEqual(expected) // deep equality\n\n- Expected  - 1\n+ Received  + 1\n\n  Object {\n-   "${field}": ${from},\n+   "${field}": ${to},\n  }`;
    const sig = (...e: string[]) => failureSignature(e)!.hash;
    const text = (loc: string) => `Error: expect(locator).toHaveText(expected) failed\n\nLocator: getByTestId('${loc}')\nExpected: "17"\nReceived: "7"`;
    expect(sig(diff('total', '17', '7'))).not.toBe(sig(diff('status', '"PAID"', '"OPEN"')));
    expect(sig(text('total'))).not.toBe(sig(text('banner')));
    expect(sig('Error: slot\n\nExpected: "10:30"\nReceived: "10:45"')).not.toBe(sig('Error: slot\n\nExpected: "10:30"\nReceived: "10:50"'));
    expect(sig('Error: a\n\nExpected: 1\nReceived: 2', 'Error: b\n\nExpected: 1\nReceived: 3')).not.toBe(sig('Error: a\n\nExpected: 1\nReceived: 2'));
    expect(sig('Error: down at http://127.0.0.1:51234/x after 812ms\n    at foo (C:/a/b.ts:1:2)')).toBe(sig('Error: down at http://127.0.0.1:60001/x after 95ms\n    at bar (D:/c.ts:9:9)'));

    // Các run sau chỉ cần control + order-total; grep chính xác để không rơi vào zero tests.
    const narrow = { ...recipe, command: { ...recipe.command, grep: 'TC-REF-[12] ' } };
    // Lỗi ngắt quãng xác định được (seed % 3): 1/3 → INTERMITTENT, không Confirmed.
    const intermittent = execRecipe(prepareReproDir('intermittent'), narrow, env('ref-app@1-intermittent', 'qa-author')).repro;
    expect(classify(intermittent, 'order-total')).toMatchObject({ status: 'INTERMITTENT_OBSERVATION', numerator: 1, denominator: 3 });

    // Môi trường thiếu precondition: control fail → ENVIRONMENT_ISSUE, không quy cho app.
    // Biến của shell cha không lọt vào replay (review P2-3): đặt tenant ở process cha, run con vẫn thiếu.
    const noTenant = { APP_BUILD_ID: 'ref-app@1', REPRO_ACTOR: 'qa-author' };
    const envRun = withParentEnv('REF_APP_TENANT', 'leaked-from-parent', () => execRecipe(prepareReproDir('env'), narrow, noTenant).repro);

    const envCls = classify(envRun, 'order-total');
    expect(envCls.status).toBe('ENVIRONMENT_ISSUE');
    expect(envCls.signatureText).toContain('[ENVIRONMENT] REF_APP_TENANT is not set');

    // Test defect (không reset, state dùng chung) trên bản sửa: attempt trùng state → TEST_DEFECT.
    const sharedEnv = { ...env('ref-app@2', 'qa-author'), REPRO_TEST_DEFECT: 'shared-state' };
    const shared = execRecipe(prepareReproDir('test-defect'), narrow, sharedEnv).repro;
    const sharedCls = classify(shared, 'order-total');
    expect(sharedCls.status).toBe('TEST_DEFECT');
    expect(sharedCls.problems.join()).toContain('SHARED_STATE');
    expect(sharedCls.signatureText).toContain('persisted total');

    // Oracle sai ở control trên build lỗi: scenario vẫn fail 3/3 nhưng control khỏe fail → TEST_DEFECT.
    const oracleEnv = { ...env('ref-app@1', 'qa-author'), REPRO_TEST_DEFECT: 'wrong-oracle' };
    const oracle = execRecipe(prepareReproDir('wrong-oracle'), narrow, oracleEnv).repro;
    expect(attemptsFor(oracle, 'order-total').filter((a) => a.status === 'failed')).toHaveLength(3);
    const oracleCls = classify(oracle, 'order-total');
    expect(oracleCls).toMatchObject({ status: 'TEST_DEFECT', numerator: 3, denominator: 3 });
    expect(oracleCls.signatureText).toBe('control total | Expected: 5 | Received: 4');

    // Grep không khớp test nào → không có bằng chứng, không được phân loại thành PASS/BUG.
    const empty = execRecipe(prepareReproDir('empty'), { ...recipe, command: { ...recipe.command, grep: 'TC-NOPE' } }, env('ref-app@1', 'qa-author')).repro;
    expect(empty.evidenceOk).toBe(false);
    expect(empty.attempts).toEqual([]);
    expect(empty.problems.join()).toMatch(/INVALID_EMPTY_RUN|RECEIPT_UNREADABLE/);
  });

  test('HM-11 - TC-16-P2-2 - AC-16-P2-2: another verifier rebuilds synthetic state from the recipe and sees the same observable', () => {
    const authorDir = prepareReproDir('author');
    const author = execRecipe(authorDir, draftRecipe(authorDir), env('ref-app@1', 'qa-author', 'tenant-author')).repro;
    const found = classify(author, 'order-total');
    expect(found.status).toBe('CONFIRMED_BUG');
    const published: ReproRecipe = {
      ...draftRecipe(authorDir),
      observable: { scenario: 'order-total', signature: found.signature, signatureText: found.signatureText, numerator: found.numerator, denominator: found.denominator },
    };
    const handoff = path.join(authorDir, 'recipe.json');
    fs.writeFileSync(handoff, JSON.stringify(published, null, 2));

    // Người kiểm chứng: thư mục mới, tenant synthetic của họ, env chỉ gồm tên recipe khai báo.
    const reviewerDir = prepareReproDir('reviewer');
    const handed = JSON.parse(fs.readFileSync(handoff, 'utf8')) as ReproRecipe;
    const options = { head: gitHead(), readSpec: specReader(reviewerDir) };
    expect(validateRecipe(handed, options)).toEqual([]);
    expect(replayEnv(handed, {}).problems).toEqual(['MISSING_ENV: APP_BUILD_ID', 'MISSING_ENV: REF_APP_TENANT', 'MISSING_ENV: REPRO_ACTOR']);
    const replayed = replayEnv(handed, { APP_BUILD_ID: handed.source.appBuild!, REF_APP_TENANT: 'tenant-reviewer', REPRO_ACTOR: 'qa-reviewer' });
    expect(replayed.problems).toEqual([]);
    const replay = execRecipe(reviewerDir, handed, replayed.env).repro;
    const again = classify(replay, handed.observable.scenario);
    expect(again).toMatchObject({ status: 'CONFIRMED_BUG', signature: handed.observable.signature, numerator: 3, denominator: 3 });
    expect(replay.actor).toBe('qa-reviewer');
    expect(replay.runId).not.toBe(author.runId);
    const authorStates = new Set(author.attempts.map((a) => a.stateId));
    expect(replay.attempts.filter((a) => authorStates.has(a.stateId)), 'no state reused from author').toEqual([]);

    // Recipe là dữ liệu: lệnh/đường dẫn/env/session/secret/stale/spec sửa đều bị từ chối trước khi chạy.
    const canary = newCanary('recipe-canary');
    const probes: [string, (r: ReproRecipe) => void, RegExp][] = [
      ['shell metachar in grep', (r) => (r.command.grep = 'TC-REF; rm -rf /'), /UNSAFE_ARG/],
      ['absolute spec path', (r) => (r.command.spec = 'C:/Windows/evil.spec.ts'), /UNSAFE_PATH/],
      ['parent traversal', (r) => (r.command.spec = '../outside.spec.ts'), /UNSAFE_PATH/],
      ['arbitrary tool', (r) => (r.command.tool = 'bash' as never), /UNKNOWN_TOOL/],
      ['env value embedded', (r) => (r.envNames = ['REF_APP_TENANT=tenant-author']), /ENV_VALUE_EMBEDDED/],
      ['stored login session', (r) => r.steps.push('reuse .auth/user.json storageState'), /SESSION_STATE/],
      ['secret literal', (r) => (r.businessContext += ` password=${canary}`), /SECRET_LIKE_CONTENT/],
      ['single attempt', (r) => (r.command.repeatEach = 1), /REPEAT_EACH_OUT_OF_RANGE/],
      ['no authoritative expected', (r) => (r.expected = { source: null, sha256: null }), /SPEC_GAP/],
      ['stale qa revision', (r) => (r.source.qaRevision = '0'.repeat(40)), /STALE_RECIPE/],
      ['edited spec', (r) => (r.command.specSha256 = 'f'.repeat(64)), /SPEC_CHANGED/],
      ['unknown schema', (r) => ((r as { schemaVersion: string }).schemaVersion = 'repro-recipe/0'), /UNSUPPORTED_RECIPE/],
    ];
    for (const [label, mutate, pattern] of probes) {
      const bad = structuredClone(handed);
      mutate(bad);
      expect(validateRecipe(bad, { ...options, secrets: [canary] }).join('; '), label).toMatch(pattern);
      expect(() => recipeArgs(bad, { ...options, secrets: [canary] }), label).toThrow(/RECIPE_REJECTED/);
    }
  });

  test('HM-11 - TC-16-P2-3 - AC-16-P2-3: before fails the target assertion, after passes the same expected, independent rerun agrees', () => {
    const recipeDir = prepareReproDir('before');
    const recipe = draftRecipe(recipeDir);
    const beforeExec = execRecipe(recipeDir, recipe, env('ref-app@1', 'dev-author'));
    const before = beforeExec.repro;
    const afterExec = execRecipe(prepareReproDir('after'), recipe, env('ref-app@2', 'dev-author'));
    const after = afterExec.repro;
    const rerun = execRecipe(prepareReproDir('rerun'), recipe, env('ref-app@2', 'qa-reviewer', 'tenant-review')).repro;
    expect(afterExec.run.exitCode, afterExec.run.output).toBe(0);
    for (const r of [before, after, rerun]) expect(r.problems).toEqual([]);

    const totalSig = classify(before, 'order-total').signature!;
    const raceSig = classify(before, 'reserve-race').signature!;
    const base: FixVerificationInput = {
      scenario: 'order-total',
      targetSignature: totalSig,
      expectedSource: CONTRACT.source,
      dualProof: { runtimeEvidence: true, sourceAnchor: ANCHOR },
      author: 'dev-author',
      before,
      after,
      regression: ['control', 'reserve-race'],
      independentRerun: rerun,
      // Worktree local đang dirty → INVESTIGATION_ONLY; gate thật chạy trên CI (trusted) không cần cờ này.
      allowUntrusted: true,
    };
    expect(verifyFix(base)).toMatchObject({
      status: 'VERIFIED_FIXED',
      problems: [],
      before: '3/3 failed on ref-app@1',
      after: '3/3 passed on ref-app@2',
    });
    // Concurrency: lost update dưới barrier cũng được xác minh before/after.
    const raceFix = verifyFix({ ...base, scenario: 'reserve-race', targetSignature: raceSig, regression: ['control', 'order-total'] });
    expect(raceFix.status).toBe('VERIFIED_FIXED');

    // BR-16-P2: sửa expected để "làm xanh" trên build lỗi → after pass nhưng bị từ chối.
    const edited = { ...CONTRACT, order: { ...CONTRACT.order, expected: 7 } };
    const greenByEdit = execRecipe(prepareReproDir('edited-expected', edited), recipe, env('ref-app@1', 'dev-author')).repro;
    expect(classify(greenByEdit, 'order-total').numerator, 'edited expected now passes').toBe(0);
    const cheat = verifyFix({ ...base, after: greenByEdit, regression: ['control'] });
    expect(cheat.status).toBe('FIX_IMPLEMENTED_UNVERIFIED');
    expect(cheat.problems.join('; ')).toMatch(/AFTER_EXPECTED_CHANGED[\s\S]*NO_BUILD_CHANGE/);

    // Evidence after bị sửa sau khi ghi → không còn là bằng chứng.
    const clone = cloneBundle(afterExec.run, 'tampered');
    const target = [...after.manifests.values()][0].artifacts.find((a) => a.name === 'repro.json')!;
    fs.appendFileSync(path.join(clone, target.path), ' ');
    const tampered = readReproRun(clone);
    expect(verifyFix({ ...base, after: tampered }).problems.join()).toContain('AFTER_EVIDENCE_INCOMPLETE');

    const probes: [string, Partial<FixVerificationInput>, RegExp][] = [
      ['before missing', { before: null }, /BEFORE_MISSING/],
      ['wrong target assertion', { targetSignature: raceSig }, /BEFORE_SIGNATURE_MISMATCH/],
      ['after is still broken', { after: before }, /AFTER_NOT_PASSING[\s\S]*NO_BUILD_CHANGE/],
      ['test revision moved', { after: { ...after, qaRevision: '0'.repeat(40) } }, /AFTER_TEST_REVISION_CHANGED/],
      ['data profile moved', { after: { ...after, seedProfile: '1' } }, /AFTER_DATA_PROFILE_CHANGED/],
      ['no regression selected', { regression: [] }, /REGRESSION_MISSING/],
      ['regression broken', { after: before, regression: ['reserve-race'] }, /REGRESSION_FAILED/],
      ['rerun by the author', { independentRerun: { ...rerun, actor: 'dev-author' } }, /NOT_INDEPENDENT/],
      ['rerun is the after run', { independentRerun: { ...after, actor: 'qa-reviewer-2' } }, /NOT_INDEPENDENT: rerun is the after run/],
      ['rerun on another build', { independentRerun: before }, /RERUN_BUILD_MISMATCH/],
      ['no rerun', { independentRerun: null }, /INDEPENDENT_RERUN_MISSING/],
      // Review P2-1/P2-2: before phải là Confirmed Bug; hash/revision phải biết; evidence phải trusted.
      ['before is a test defect', { before: { ...before, attempts: before.attempts.map((a) => (a.scenario === 'order-total' ? { ...a, stateId: 'state-shared' } : a)) } }, /BEFORE_NOT_CONFIRMED: TEST_DEFECT/],
      ['target as its own regression', { regression: ['control', 'order-total'] }, /REGRESSION_INVALID/],
      ['expected hash unknown', { before: { ...before, expectedSha256: null }, after: { ...after, expectedSha256: null }, independentRerun: { ...rerun, expectedSha256: null } }, /AFTER_EXPECTED_UNKNOWN/],
      ['untrusted evidence', { allowUntrusted: false, after: { ...after, trust: 'INVESTIGATION_ONLY' } }, /AFTER_UNTRUSTED_EVIDENCE/],
    ];
    for (const [label, patch, pattern] of probes) {
      const result = verifyFix({ ...base, ...patch });
      expect(result.status, label).toBe('FIX_IMPLEMENTED_UNVERIFIED');
      expect(result.problems.join('; '), label).toMatch(pattern);
    }
    // Không chạy được before: NOT_FEASIBLE có lý do vẫn không được kết luận sửa xong.
    const notFeasible = verifyFix({ ...base, before: null, notFeasible: { reason: 'ref-app@1 retired', historicalEvidence: before.runId! } });
    expect(notFeasible).toMatchObject({ status: 'FIX_IMPLEMENTED_UNVERIFIED', before: 'NOT_FEASIBLE' });
    expect(notFeasible.limitations.join()).toContain('BEFORE_NOT_FEASIBLE: ref-app@1 retired');
  });
});
