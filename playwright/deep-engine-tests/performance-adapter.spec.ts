import { expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { evidenceTest as test } from '../tests/fixtures/evidence.fixture';
import { compareRuns, type PerfRunRecord } from '../tests/support/perf-compare';
import { runConstantArrival } from '../tests/support/perf-loadgen';
import { evaluateRun, formatPerfReport, REPORT_STATEMENT, type PerfSample } from '../tests/support/perf-metrics';
import { validateProfile, workloadHash, type PerfProfile } from '../tests/support/perf-profile';
import { cloneBundle, runNested, readManifests } from './evidence-pipeline.harness';
import { BASE_PROFILE, perfRecords, preparePerfDir, readArtifact, runPerf, type PerfRun } from './performance-adapter.harness';

/**
 * Phase 4 — Performance & tải (PLAN-16, TC-16-P4-1..3).
 * Public caller: Playwright run thật (process con) chạy load generator tham chiếu (Node core, mô hình
 * mở) vào app local; raw samples đi qua evidence Phase 1 và được tính lại độc lập ở đây.
 * Runner production (k6 hay khác) CHƯA được chọn — xem PDR-16-P4-02.
 */
const samplesOf = (v: PerfRun, i = 0): PerfSample[] =>
  (readArtifact(v, v.manifests[i], 'perf-samples.ndjson')?.toString('utf8') ?? '').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const telemetryOf = (v: PerfRun, i = 0) => JSON.parse(readArtifact(v, v.manifests[i], 'perf-telemetry.json')!.toString('utf8'));

test.describe('@REQ-16-P4 Phase 4 - Performance & load (TC-16-P4-1..3)', () => {
  test.describe.configure({ mode: 'default', timeout: 240_000 });

  test('HM-13 - TC-16-P4-1 - AC-16-P4-1: only an owner-approved workload and SLO can produce an SLO verdict', async ({ evidence }) => {
    const dir = preparePerfDir('approved');
    const healthy = runPerf(dir);
    expect(healthy.run.exitCode, healthy.run.output).toBe(0);
    const { records, problems } = perfRecords(healthy);
    expect(problems).toEqual([]);
    expect(records[0].result).toMatchObject({ verdict: 'SLO_MET', exitCode: 0, breaches: [] });
    const report = readArtifact(healthy, healthy.manifests[0], 'perf-report.txt')!.toString('utf8');
    expect(report.split('\n')[0]).toBe(REPORT_STATEMENT);

    // Cùng raw samples, khác trạng thái duyệt: không có approval / tự duyệt → chỉ "kiểm ngưỡng", không phải SLA.
    const raw = samplesOf(healthy);
    const tele = telemetryOf(healthy);
    const variants: [string, PerfProfile, string, string][] = [
      ['unapproved', { ...BASE_PROFILE, approval: null }, 'THRESHOLD_CHECK_ONLY', 'PROFILE_NOT_APPROVED'],
      ['self-approved', { ...BASE_PROFILE, approval: { ...BASE_PROFILE.approval!, approvedBy: ' QA-Author ' } }, 'THRESHOLD_CHECK_ONLY', 'SELF_APPROVAL'],
      ['no reason', { ...BASE_PROFILE, approval: { ...BASE_PROFILE.approval!, reason: '' } }, 'THRESHOLD_CHECK_ONLY', 'APPROVAL_WITHOUT_REASON'],
    ];
    for (const [label, profile, verdict, code] of variants) {
      const r = evaluateRun(profile, raw, tele);
      expect(r.verdict, label).toBe(verdict);
      expect(r.limitations.join(), label).toContain(`NOT_AN_SLA_CLAIM: ${code}`);
      expect(formatPerfReport(profile, r), label).not.toMatch(/SLO_MET|meets? (the )?SLA/i);
    }
    // Ngưỡng không có nguồn / không có SLO / workload sai mô hình → run không hợp lệ (exit 2), không tự đặt ngưỡng.
    const invalid: [string, PerfProfile, string][] = [
      ['threshold without source', { ...BASE_PROFILE, slo: [{ ...BASE_PROFILE.slo[0], source: '' }] }, 'SPEC_GAP'],
      ['no SLO', { ...BASE_PROFILE, slo: [] }, 'SPEC_GAP: no SLO rule'],
      ['closed model', { ...BASE_PROFILE, arrival: { ...BASE_PROFILE.arrival, mode: 'closed' as never } }, 'INVALID_ARRIVAL'],
      ['absolute URL target', { ...BASE_PROFILE, target: { alias: 'x', route: 'https://prod.example/orders' } }, 'INVALID_TARGET'],
      ['warm-up longer than run', { ...BASE_PROFILE, arrival: { ...BASE_PROFILE.arrival, warmupSec: 3 } }, 'INVALID_ARRIVAL'],
    ];
    for (const [label, profile, code] of invalid) {
      expect(validateProfile(profile).join(), label).toContain(code);
      expect(evaluateRun(profile, raw, tele), label).toMatchObject({ verdict: 'INVALID_RUN', exitCode: 2 });
    }
    // Generator chỉ bắn tải vào host local (quyền chạy load trên môi trường thật là Q-16-P4).
    await expect(runConstantArrival('https://staging.example.com', BASE_PROFILE)).rejects.toThrow(/LOAD_TARGET_NOT_ALLOWED/);
    evidence.attach('nested-runs.json', [{ runRoot: path.relative(path.resolve(__dirname, '..'), healthy.run.runRoot), verdict: healthy.run.receipt?.verdict.evidence }]);
  });

  test('HM-13 - TC-16-P4-2 - AC-16-P4-2: injected latency, errors and dropped work exit non-zero and keep raw metrics', () => {
    const dir = preparePerfDir('faults');
    const control = runPerf(dir);
    expect(control.run.exitCode, control.run.output).toBe(0);
    // [fault, breach kỳ vọng, số dropped tối thiểu trong raw]
    const cases: ['latency' | 'errors' | 'slow', RegExp, number][] = [
      ['latency', /^p95_ms .* violates <= 100/, 0],
      ['errors', /^error_rate 0\.25 violates <= 0\.01/, 0],
      ['slow', /^dropped \d+ violates <= 0/, 1],
    ];
    for (const [fault, breach, minDropped] of cases) {
      const v = runPerf(dir, { fault });
      expect(v.run.exitCode, `${fault}\n${v.run.output}`).toBe(1);
      expect(v.run.receipt?.counts, fault).toMatchObject({ executed: 1, unexpected: 1 });
      expect(v.run.receipt?.execution.recordedEnv?.PERF_FAULT, fault).toBe(fault);
      const { records, problems } = perfRecords(v);
      expect(problems, fault).toEqual([]);
      expect(records[0].result.verdict, fault).toBe('SLO_BREACHED');
      expect(records[0].result.breaches.some((b) => breach.test(b)), `${fault}: ${records[0].result.breaches.join(' | ')}`).toBe(true);
      // Raw samples giữ đủ mọi request (kể cả dropped/error), không chỉ số tóm tắt.
      const raw = samplesOf(v);
      expect(raw, fault).toHaveLength(BASE_PROFILE.arrival.ratePerSec * BASE_PROFILE.arrival.durationSec);
      expect(raw.filter((s) => s.outcome === 'dropped').length, fault).toBeGreaterThanOrEqual(minDropped);
    }
    // Không đủ sample → run không hợp lệ (exit 2 trong kết quả), Playwright vẫn fail.
    const tooFew = preparePerfDir('few', { ...BASE_PROFILE, stop: { ...BASE_PROFILE.stop, minSamples: 5_000 } });
    const few = runPerf(tooFew);
    expect(few.run.exitCode).toBe(1);
    expect(perfRecords(few).records[0].result).toMatchObject({ verdict: 'INVALID_RUN', exitCode: 2 });
    // Raw bị sửa sau khi ghi → evidence không verify, không dùng làm bằng chứng.
    const clone = cloneBundle(control.run, 'tampered');
    const art = control.manifests[0].artifacts.find((a) => a.name === 'perf-samples.ndjson')!;
    fs.appendFileSync(path.join(clone, art.path), '\n{"seq":9999}');
    const tampered = perfRecords({ ...control, run: { ...control.run, runRoot: clone } });
    expect(tampered.problems.join()).toMatch(/SIZE_MISMATCH|HASH_MISMATCH/);
  });

  test('HM-13 - TC-16-P4-3 - AC-16-P4-3: reruns with the same seed and profile are compared; one sample or a busy machine is never a regression', () => {
    const dir = preparePerfDir('compare');
    const repeats = (opts: Parameters<typeof runPerf>[1]) => {
      const v = runPerf(dir, { ...opts, repeatEach: 3 });
      const r = perfRecords(v);
      expect(r.problems, JSON.stringify(opts)).toEqual([]);
      expect(r.records, JSON.stringify(opts)).toHaveLength(3);
      return { v, records: r.records };
    };
    const baseline = repeats({});
    const same = repeats({});
    const slower = repeats({ fault: 'latency' });
    const busy = repeats({ busy: true });
    expect(busy.records.every((r) => r.telemetry.loopLagP99Ms > 50), 'busy fault really saturates the generator').toBe(true);

    expect(compareRuns(baseline.records, same.records).verdict).toBe('NO_REGRESSION');
    const reg = compareRuns(baseline.records, slower.records);
    expect(reg.verdict).toBe('REGRESSION_REPRODUCED');
    expect(reg.candidate.values.every((c) => c > Math.max(...reg.baseline.values))).toBe(true);
    expect(compareRuns(baseline.records, busy.records).verdict).toBe('INCONCLUSIVE_BUSY_ENV');

    const one = compareRuns(baseline.records, slower.records.slice(0, 1));
    expect(one.verdict, 'one sample is not a regression').toBe('INSUFFICIENT_SAMPLES');
    const edit = (rs: PerfRunRecord[], patch: Partial<PerfRunRecord>) => rs.map((r) => ({ ...r, ...patch }));
    const notComparable: [string, PerfRunRecord[], RegExp][] = [
      ['other seed', edit(slower.records, { seed: 7 }), /seed differs/],
      ['other workload', edit(slower.records, { workloadHash: workloadHash({ ...BASE_PROFILE, arrival: { ...BASE_PROFILE.arrival, ratePerSec: 80 } }) }), /workloadHash differs/],
      ['other machine', edit(slower.records, { env: { ...slower.records[0].env, cpus: 999 } }), /environment differs/],
      ['same attempt twice', [...baseline.records.slice(0, 2), baseline.records[0]], /counted twice/],
    ];
    for (const [label, candidate, pattern] of notComparable) {
      const c = compareRuns(baseline.records, candidate);
      expect(c.verdict, label).toBe('NOT_COMPARABLE');
      expect(c.problems.join(), label).toMatch(pattern);
    }
    expect(compareRuns(baseline.records, same.records, { metric: 'throughput_rps' }).problems.join()).toContain('UNSUPPORTED_METRIC');

    // UAT (d): replay một run chỉ từ receipt (argv + env đã ghi) → cùng kết cục.
    const single = runPerf(dir, { fault: 'latency' });
    const exec = single.run.receipt!.execution;
    const replay = runNested(dir, exec.argv.slice(4), exec.recordedEnv ?? {}, true, 'replay');
    expect(replay.exitCode).toBe(single.run.exitCode);
    const replayed = perfRecords({ run: replay, manifests: readManifests(replay) });
    expect(replayed.records[0].result.verdict).toBe('SLO_BREACHED');
  });
});
