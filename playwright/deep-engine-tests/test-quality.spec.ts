import { expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { evidenceTest as test } from '../tests/fixtures/evidence.fixture';
import { sha256 } from '../tests/support/evidence-integrity';
import { redactText } from '../tests/support/evidence-redaction';
import { applyMutant, generateMutants, type Mutant } from '../tests/support/mutation-engine';
import { evaluateMutation, type MutationOutcome } from '../tests/support/mutation-score';
import { checkProperty, replayProperty } from '../tests/support/prop-check';
import { runNested } from './evidence-pipeline.harness';
import { mutationAttempts, nestedIndex, prepareMutation, preparePropertyDir, propertyReports, runMutation, runProperties } from './test-quality.harness';
import { percentileProperty, redactionProperty } from './test-quality.properties';
import { brokenPercentile, naiveRedact } from './test-quality.reference';
import { PERF_METRICS_TRIAGE, REFERENCE_TRIAGE } from './test-quality.triage';

/**
 * Phase 5 — Property-based & chất lượng bộ test (PLAN-16, TC-16-P5-1..3).
 * Public caller: Playwright run thật (process con, evidence reporter) cho cả property lẫn mutation.
 * Runner/engine là bản tối giản không dependency; fast-check/Stryker chưa được chọn (PDR-16-P5-02).
 */
const PW_ROOT = path.resolve(__dirname, '..');
const SEED = 20261103;
const PERF_TARGET = 'tests/support/perf-metrics.ts';
const REF_TARGET = 'deep-engine-tests/test-quality.reference.ts';

function refMutation(label: string) {
  // Phạm vi: chỉ hai hàm suite kiểm (waitUntil, clamp); mutant ngoài phạm vi là "không được phủ", không phải survivor.
  const src = fs.readFileSync(path.join(PW_ROOT, REF_TARGET), 'utf8');
  const lines = src.split('\n');
  const startLine = lines.findIndex((l) => l.startsWith('export async function waitUntil')) + 1;
  const clampLine = lines.findIndex((l) => l.startsWith('export function clamp')) + 1;
  // Mutant dựng tay làm hỏng cú pháp → phải ra INVALID qua runner thật (không tính vào mẫu số).
  const broken: Mutant = {
    id: 'manualinvalid', file: REF_TARGET, line: clampLine, column: 1, operator: 'manual-syntax',
    original: '{', replacement: '{{', diff: { before: lines[clampLine - 1], after: `${lines[clampLine - 1]}{` },
  };
  return runMutation(prepareMutation(label, { target: REF_TARGET, suite: 'referenceSuite', startLine, extra: [broken] }));
}

test.describe('@REQ-16-P5 Phase 5 - Property-based & test quality (TC-16-P5-1..3)', () => {
  test.describe.configure({ mode: 'default', timeout: 420_000 });

  test('HM-14 - TC-16-P5-1 - AC-16-P5-1: a broken property shrinks to a minimal counterexample that replays from seed and path', ({ evidence }) => {
    const dir = preparePropertyDir('properties');
    const run = runProperties(dir, SEED);
    expect(run.exitCode, run.output).toBe(1);
    expect(run.receipt?.counts).toMatchObject({ matched: 4, executed: 4, expected: 2, unexpected: 2 });
    const reports = propertyReports(run);
    for (const real of ['real percentile', 'real redaction']) {
      expect(reports.get(real), real).toMatchObject({ status: 'PASSED', runsExecuted: 300, failure: null });
    }
    const cases = [
      ['broken percentile', percentileProperty.arb, percentileProperty.predicate(brokenPercentile), [[0, 0, 0, 0, 0, 0, -1, 0, 0], 12]],
      ['broken redaction', redactionProperty.arb, redactionProperty.predicate(naiveRedact), ['', 'password', ':', '000000']],
    ] as const;
    for (const [label, arb, predicate, expected] of cases) {
      const r = reports.get(label)!;
      expect(r.status, label).toBe('FAILED');
      expect(r.failure!.counterexample, label).toEqual(expected);
      expect(r.failure!.path, label).toHaveLength(r.failure!.shrinkSteps);
      // Nhỏ nhất theo shrinker: không candidate nào của counterexample còn vi phạm.
      const failing = (arb.shrink(r.failure!.counterexample as never) as unknown[]).filter((c) => {
        try {
          return (predicate as (v: unknown) => boolean)(c) === false;
        } catch {
          return true;
        }
      });
      expect(failing, `${label}: counterexample is locally minimal`).toEqual([]);
      // Replay chỉ từ seed + runIndex + path (không chạy lại N lần) → cùng input, cùng lỗi.
      const replay = replayProperty(arb as never, predicate as never, { seed: r.seed, runIndex: r.failure!.runIndex, path: r.failure!.path });
      expect(replay.problems, label).toEqual([]);
      expect(replay.value, label).toEqual(r.failure!.counterexample);
      // Report trong evidence đã qua redaction (secret cạnh key bị che) → so sau cùng phép redact.
      expect(redactText(replay.error ?? ''), label).toBe(r.failure!.error);
    }
    // Replay cả run từ receipt (argv + PROP_SEED đã ghi) → report giống hệt.
    const exec = run.receipt!.execution;
    expect(exec.recordedEnv).toEqual({ PROP_SEED: String(SEED) });
    const again = runNested(dir, exec.argv.slice(4), exec.recordedEnv ?? {}, true, 'replay');
    const replayed = propertyReports(again);
    for (const label of ['broken percentile', 'broken redaction']) {
      expect(replayed.get(label)?.failure, label).toEqual(reports.get(label)?.failure);
    }
    // Seed khác vẫn tìm ra lỗi (property không phụ thuộc một seed may mắn).
    const other = checkProperty(redactionProperty.name, redactionProperty.arb, redactionProperty.predicate(naiveRedact), { seed: 99, numRuns: 300, source: redactionProperty.source });
    expect(other.status).toBe('FAILED');
    // Không có nguồn invariant → SPEC_GAP, không chạy; path replay sai → báo, không đoán.
    expect(checkProperty('no source', percentileProperty.arb, () => true, { seed: 1, source: ' ' })).toMatchObject({ status: 'SPEC_GAP', runsExecuted: 0 });
    expect(replayProperty(percentileProperty.arb, () => true, { seed: 1, runIndex: 0, path: [999] }).problems.join()).toContain('REPLAY_PATH_INVALID');
    evidence.attach('nested-runs.json', nestedIndex([run, again]));
  });

  test('HM-14 - TC-16-P5-2 - AC-16-P5-2: meaningful mutants are killed; equivalents, accepted risks, timeouts and invalid mutants are classified', ({ evidence }) => {
    const before = sha256(fs.readFileSync(path.join(PW_ROOT, PERF_TARGET)));
    const perf = runMutation(prepareMutation('mut-perf', { target: PERF_TARGET, suite: 'perfMetricsSuite' }));
    const ref = refMutation('mut-ref');
    expect(sha256(fs.readFileSync(path.join(PW_ROOT, PERF_TARGET))), 'repo source is never mutated').toBe(before);

    const outcome = (mr: typeof perf, triage = PERF_METRICS_TRIAGE): MutationOutcome =>
      evaluateMutation({ mutants: mr.mutants, attempts: mutationAttempts(mr.run!), triage });
    const p = outcome(perf);
    expect(p.problems, JSON.stringify(p.results.filter((r) => r.status === 'SURVIVED').map((r) => r.mutant.id))).toEqual([]);
    // ACCEPTED_RISK vẫn là survivor không bị phát hiện → nằm trong mẫu số: 66 / (76 − 8 equivalent).
    expect(p).toMatchObject({ ok: true, baselinePassed: true, score: 66 / 68, threshold: null });
    expect(p.counts).toMatchObject({ total: 76, KILLED: 66, SURVIVED: 10, equivalent: 8, acceptedRisk: 2, INVALID: 0, NOT_RUN: 0 });
    const r = outcome(ref, REFERENCE_TRIAGE);
    expect(r.problems).toEqual([]);
    expect(r.counts).toMatchObject({ total: 9, KILLED: 4, TIMEOUT: 1, INVALID: 1, SURVIVED: 3, equivalent: 3 });
    expect(r.results.find((x) => x.mutant.operator === 'update')?.status, 'infinite async loop is a TIMEOUT').toBe('TIMEOUT');
    expect(r.results.find((x) => x.mutant.id === 'manualinvalid')?.status).toBe('INVALID');
    expect(r.score, '(killed + timeout) / (total - invalid - equivalent)').toBe(1);
    for (const res of p.results) expect(res.mutant.diff.after, res.mutant.id).not.toBe(res.mutant.diff.before);

    // Không triage được bằng exclude vô căn cứ: thiếu lý do / mục cũ / mục cho mutant đã bị diệt / thiếu triage.
    const killed = p.results.find((x) => x.status === 'KILLED')!.mutant.id;
    const probes: [string, typeof PERF_METRICS_TRIAGE, RegExp][] = [
      ['no triage', [], /UNTRIAGED_SURVIVOR: be1641dc919b/],
      ['triage without reason', PERF_METRICS_TRIAGE.map((t, i) => (i === 0 ? { ...t, reason: ' ' } : t)), /TRIAGE_WITHOUT_REASON[\s\S]*UNTRIAGED_SURVIVOR/],
      ['stale triage id', [...PERF_METRICS_TRIAGE, { ...PERF_METRICS_TRIAGE[0], mutantId: 'deadbeef0000' }], /STALE_TRIAGE: deadbeef0000/],
      ['triage of a killed mutant', [...PERF_METRICS_TRIAGE, { ...PERF_METRICS_TRIAGE[0], mutantId: killed }], /TRIAGE_NOT_NEEDED/],
    ];
    for (const [label, triage, pattern] of probes) {
      const o = outcome(perf, triage);
      expect(o.ok, label).toBe(false);
      expect(o.problems.join('; '), label).toMatch(pattern);
    }
    const noSource = evaluateMutation({ mutants: perf.mutants, attempts: mutationAttempts(perf.run!), triage: PERF_METRICS_TRIAGE, threshold: { value: 0.8, source: '' } });
    expect(noSource.problems.join()).toContain('SPEC_GAP: mutation threshold');
    const strict = evaluateMutation({ mutants: ref.mutants, attempts: mutationAttempts(ref.run!), triage: [], threshold: { value: 0.9, source: 'Q-16-P5 (example)' } });
    expect(strict.problems.join()).toMatch(/UNTRIAGED_SURVIVOR[\s\S]*SCORE_BELOW_THRESHOLD/);
    // Baseline đỏ → kết quả mutant vô nghĩa.
    const redBaseline = mutationAttempts(perf.run!).map((a) => (a.title.endsWith('BASELINE unmutated source') ? { ...a, status: 'failed' as const } : a));
    expect(evaluateMutation({ mutants: perf.mutants, attempts: redBaseline, triage: PERF_METRICS_TRIAGE }).problems.join()).toContain('BASELINE_NOT_GREEN');
    evidence.attach('mutation-report-perf-metrics.json', p);
    evidence.attach('mutation-report-reference.json', r);
    evidence.attach('nested-runs.json', nestedIndex([perf.run!, ref.run!]));
  });

  test('HM-14 - TC-16-P5-3 - AC-16-P5-3: results come from the real CLI and reporter, are stable across reruns and stale mutants are refused', ({ evidence }) => {
    const first = refMutation('mut-ref-a');
    const second = refMutation('mut-ref-b');
    // Quan sát cuối từ runner thật: exit code, receipt, JUnit của run con.
    for (const mr of [first, second]) {
      expect(mr.run!.exitCode, 'killed mutants make the nested run fail').toBe(1);
      expect(mr.run!.receipt?.verdict.evidence).toBe('COMPLETE');
      const junit = fs.readFileSync(path.join(mr.run!.runRoot, 'junit.xml'), 'utf8');
      expect(junit).toContain('MUTANT manualinvalid');
      // Playwright JUnit ghi assertion/throw là `errors`; tổng failures + errors = mutant bị diệt + timeout.
      const head = /<testsuites [^>]*failures="(\d+)"[^>]*errors="(\d+)"/.exec(junit);
      expect(Number(head?.[1]) + Number(head?.[2])).toBe(5);
    }
    // Chạy song song 4 worker, sandbox riêng từng mutant: hai lần chạy cho cùng phân loại.
    const statuses = (mr: typeof first) => Object.fromEntries(evaluateMutation({ mutants: mr.mutants, attempts: mutationAttempts(mr.run!), triage: REFERENCE_TRIAGE }).results.map((x) => [x.mutant.id, x.status]));
    expect(statuses(second)).toEqual(statuses(first));
    // ID mutant ổn định theo vị trí; source đổi → mutant cũ bị từ chối, triage cũ thành STALE.
    const src = fs.readFileSync(path.join(PW_ROOT, REF_TARGET), 'utf8');
    const again = generateMutants(src, { file: REF_TARGET });
    expect(again.map((m) => m.id)).toEqual(generateMutants(src, { file: REF_TARGET }).map((m) => m.id));
    const edited = src.replace('if (x < lo) return lo;', 'if (x < lo) {\n    return lo;\n  }');
    const target = again.find((m) => m.diff.before.includes('if (x < lo)'))!;
    expect(() => applyMutant(edited, target)).toThrow(/STALE_MUTANT/);
    const shifted = generateMutants(edited, { file: REF_TARGET }).map((m) => m.id);
    const staleTriage = REFERENCE_TRIAGE.filter((t) => !shifted.includes(t.mutantId));
    expect(staleTriage.length, 'editing the target invalidates old triage').toBeGreaterThan(0);
    // Operator không chạm comment/string/generic: không mutant nào nằm trong comment của file.
    expect(again.every((m) => !m.diff.before.trim().startsWith('*') && !m.diff.before.trim().startsWith('//'))).toBe(true);
    evidence.attach('nested-runs.json', nestedIndex([first.run!, second.run!]));
  });
});
