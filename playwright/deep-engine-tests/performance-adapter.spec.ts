import { expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { evidenceTest as test } from '../tests/fixtures/evidence.fixture';
import { compareRuns, type PerfRunRecord } from '../tests/support/perf-compare';
import { runConstantArrival } from '../tests/support/perf-loadgen';
import { evaluateRun, formatPerfReport, percentile, REPORT_STATEMENT, type PerfSample, type PerfTelemetry } from '../tests/support/perf-metrics';
import { approveProfile, validateProfile, workloadHash, type PerfProfile } from '../tests/support/perf-profile';
import { cloneBundle } from './evidence-pipeline.harness';
import { startPerfApp } from './performance-reference-app';
import { BASE_PROFILE, perfIndex, perfRecords, preparePerfDir, profileDigests, readArtifact, replayPerf, runPerf, type PerfRun } from './performance-adapter.harness';

/**
 * Phase 4 — Performance & tải (PLAN-16, TC-16-P4-1..3).
 * Public caller: Playwright run thật (process con) chạy load generator tham chiếu (Node core, mô hình
 * mở, latency tính từ lịch) vào app local ở process riêng; raw samples đi qua evidence Phase 1.
 * Runner production (k6 hay khác) CHƯA được chọn — xem PDR-16-P4-02.
 */
const samplesOf = (v: PerfRun, i = 0): PerfSample[] =>
  (readArtifact(v, v.manifests[i], 'perf-samples.ndjson')?.toString('utf8') ?? '').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const telemetryOf = (v: PerfRun, i = 0): PerfTelemetry => JSON.parse(readArtifact(v, v.manifests[i], 'perf-telemetry.json')!.toString('utf8'));
const withSlo = (slo: PerfProfile['slo']): PerfProfile => ({ ...BASE_PROFILE, slo });

test.describe('@REQ-16-P4 Phase 4 - Performance & load (TC-16-P4-1..3)', () => {
  test.describe.configure({ mode: 'default', timeout: 300_000 });

  test('HM-13 - TC-16-P4-1 - AC-16-P4-1: only an owner-approved workload and SLO can produce an SLO verdict', async ({ evidence }) => {
    const healthy = runPerf(preparePerfDir('approved'));
    expect(healthy.run.exitCode, healthy.run.output).toBe(0);
    const { records, problems } = perfRecords(healthy);
    expect(problems).toEqual([]);
    expect(records[0].result).toMatchObject({ verdict: 'SLO_MET', exitCode: 0, breaches: [] });
    const report = readArtifact(healthy, healthy.manifests[0], 'perf-report.txt')!.toString('utf8');
    expect(report.split('\n')[0]).toBe(REPORT_STATEMENT);
    expect(report).toContain(`workload ${workloadHash(BASE_PROFILE)}`);

    // Qua runner thật: profile chưa duyệt → chỉ "kiểm ngưỡng"; SLO không bao giờ fail → bị từ chối TRƯỚC khi tạo tải.
    const unapproved = runPerf(preparePerfDir('unapproved', { ...BASE_PROFILE, approval: null }));
    expect(unapproved.run.exitCode).toBe(0);
    expect(perfRecords(unapproved).records[0].result.verdict).toBe('THRESHOLD_CHECK_ONLY');
    const tautology = runPerf(preparePerfDir('tautology', withSlo([...BASE_PROFILE.slo, { metric: 'p95_ms', op: '>=', value: 0, source: 'SLO-X' }])));
    expect(tautology.run.exitCode).toBe(1);
    expect(tautology.run.output).toContain('PROFILE_REJECTED');
    expect(samplesOf(tautology), 'no load generated for a rejected profile').toEqual([]);

    // Cùng raw samples, approval không hợp lệ: thiếu / tự duyệt (biến thể tên) / không lý do / thời điểm sai / nội dung đổi sau duyệt.
    const raw = samplesOf(healthy);
    const tele = telemetryOf(healthy);
    const widened = { ...BASE_PROFILE, slo: BASE_PROFILE.slo.map((r) => (r.metric === 'p95_ms' ? { ...r, value: 1e9 } : r)) };
    const approval = BASE_PROFILE.approval!;
    const variants: [string, PerfProfile, string][] = [
      ['unapproved', { ...BASE_PROFILE, approval: null }, 'PROFILE_NOT_APPROVED'],
      ['self-approved', { ...BASE_PROFILE, approval: { ...approval, approvedBy: ' QA_Author ' } }, 'SELF_APPROVAL'],
      ['no reason', { ...BASE_PROFILE, approval: { ...approval, reason: '' } }, 'APPROVAL_WITHOUT_REASON'],
      ['future approval', { ...BASE_PROFILE, approval: { ...approval, approvedAt: '2999-01-01T00:00:00Z' } }, 'APPROVAL_INVALID'],
      ['non-ISO approval time', { ...BASE_PROFILE, approval: { ...approval, approvedAt: '1' } }, 'APPROVAL_INVALID'],
      ['SLO widened after approval', widened, 'APPROVAL_STALE'],
    ];
    for (const [label, profile, code] of variants) {
      const r = evaluateRun(profile, raw, tele);
      expect(r.verdict, label).toBe('THRESHOLD_CHECK_ONLY');
      expect(r.limitations.join(), label).toContain(`NOT_AN_SLA_CLAIM: ${code}`);
      expect(formatPerfReport(profile, r), label).not.toMatch(/SLO_MET|meets? (the )?SLA/i);
    }
    // Re-approve đúng nội dung mới thì hợp lệ trở lại (approval gắn với nội dung, không với tên người).
    const reapproved = approveProfile(widened, { approvedBy: 'perf-owner', reason: 'r', at: '2026-11-03T00:00:00Z' });
    expect(evaluateRun(reapproved, raw, tele).verdict).toBe('SLO_MET');

    // Ngưỡng không nguồn / SLO thiếu chiều kiểm / ngược chiều / vô hạn / workload sai → run không hợp lệ (exit 2).
    const invalid: [string, PerfProfile, string][] = [
      ['threshold without source', withSlo(BASE_PROFILE.slo.map((r, i) => (i === 0 ? { ...r, source: '' } : r))), 'SPEC_GAP'],
      ['no SLO', withSlo([]), 'SPEC_GAP: no SLO rule'],
      ['no dropped rule', withSlo(BASE_PROFILE.slo.filter((r) => r.metric !== 'dropped')), 'no dropped-work rule'],
      ['no error rule', withSlo(BASE_PROFILE.slo.filter((r) => r.metric !== 'error_rate')), 'no error_rate rule'],
      ['latency with >=', withSlo([...BASE_PROFILE.slo, { metric: 'p99_ms', op: '>=', value: 0, source: 'S' }]), 'can never fail'],
      ['infinite threshold', withSlo([...BASE_PROFILE.slo, { metric: 'p99_ms', op: '<=', value: Infinity, source: 'S' }]), 'INVALID_SLO'],
      ['maxErrorRate NaN', { ...BASE_PROFILE, stop: { ...BASE_PROFILE.stop, maxErrorRate: NaN } }, 'INVALID_STOP'],
      ['closed model', { ...BASE_PROFILE, arrival: { ...BASE_PROFILE.arrival, mode: 'closed' as never } }, 'INVALID_ARRIVAL'],
      ['route escapes host', { ...BASE_PROFILE, target: { alias: 'x', route: '@evil.example/orders' } }, 'INVALID_TARGET'],
      ['fractional maxInFlight', { ...BASE_PROFILE, arrival: { ...BASE_PROFILE.arrival, maxInFlight: 2.5 } }, 'INVALID_ARRIVAL'],
    ];
    for (const [label, profile, code] of invalid) {
      expect(validateProfile(profile).join(), label).toContain(code);
      expect(evaluateRun(profile, raw, tele), label).toMatchObject({ verdict: 'INVALID_RUN', exitCode: 2 });
    }
    // Generator: chỉ host local, và validate profile trước khi gửi bất kỳ request nào.
    await expect(runConstantArrival('https://staging.example.com', BASE_PROFILE)).rejects.toThrow(/LOAD_TARGET_NOT_ALLOWED/);
    const escape = { ...BASE_PROFILE, target: { alias: 'x', route: '@evil.example/' } };
    await expect(runConstantArrival('http://127.0.0.1:9', escape)).rejects.toThrow(/PROFILE_REJECTED/);
    evidence.attach('nested-runs.json', perfIndex([healthy, unapproved, tautology]));
  });

  test('HM-13 - TC-16-P4-2 - AC-16-P4-2: injected latency, errors and dropped work exit non-zero and keep raw metrics', async ({ evidence }) => {
    const dir = preparePerfDir('faults');
    const control = runPerf(dir);
    expect(control.run.exitCode, control.run.output).toBe(0);
    // [fault, breach kỳ vọng, số dropped tối thiểu, error_rate tối thiểu (dropped tính là thất bại)]
    const cases: ['latency' | 'errors' | 'slow', RegExp, number, number][] = [
      ['latency', /^p95_ms .* violates <= 100/, 0, 0],
      ['errors', /^error_rate 0\.25 violates <= 0\.01/, 0, 0.25],
      ['slow', /^dropped \d+ violates <= 0/, 1, 0.01],
    ];
    const runs = [control];
    for (const [fault, breach, minDropped, minErrorRate] of cases) {
      const v = runPerf(dir, { fault });
      runs.push(v);
      expect(v.run.exitCode, `${fault}\n${v.run.output}`).toBe(1);
      expect(v.run.receipt?.execution.recordedEnv?.PERF_FAULT, fault).toBe(fault);
      const { records, problems } = perfRecords(v);
      expect(problems, fault).toEqual([]);
      expect(records[0].result.verdict, fault).toBe('SLO_BREACHED');
      expect(records[0].result.breaches.some((b) => breach.test(b)), `${fault}: ${records[0].result.breaches.join(' | ')}`).toBe(true);
      const raw = samplesOf(v);
      expect(raw, fault).toHaveLength(BASE_PROFILE.arrival.ratePerSec * BASE_PROFILE.arrival.durationSec);
      expect(raw.filter((s) => s.outcome === 'dropped').length, fault).toBeGreaterThanOrEqual(minDropped);
      expect(records[0].result.stats.error_rate, fault).toBeGreaterThanOrEqual(minErrorRate);
    }
    // Không đủ sample → run không hợp lệ (exit 2 trong kết quả), Playwright vẫn fail.
    const few = runPerf(preparePerfDir('few', { ...BASE_PROFILE, stop: { ...BASE_PROFILE.stop, minSamples: 5_000 } }));
    expect(few.run.exitCode).toBe(1);
    expect(perfRecords(few).records[0].result).toMatchObject({ verdict: 'INVALID_RUN', exitCode: 2 });

    // Raw không đủ/không nhất quán (vd adapter của runner khác) hoặc generator nghẽn → INVALID_RUN, không tự "đạt".
    const raw = samplesOf(control);
    const tele = telemetryOf(control);
    const relabelled = raw.map((s) => (s.seq % 2 ? { ...s, latencyMs: 5_000, warmup: true } : s));
    const broken: [string, PerfSample[], PerfTelemetry, string][] = [
      ['missing samples', raw.slice(0, 80), tele, 'INCOMPLETE_SAMPLES'],
      ['duplicated seq', raw.map((s) => ({ ...s, seq: 0 })), tele, 'INCOMPLETE_SAMPLES'],
      ['slow samples relabelled as warm-up', relabelled, tele, 'WARMUP_MISLABELED'],
      ['generator stalled once', raw, { ...tele, sendLagMaxMs: 400 }, 'ENVIRONMENT_BUSY'],
      ['generator saturated', raw, { ...tele, loopLagP99Ms: 900 }, 'ENVIRONMENT_BUSY'],
    ];
    for (const [label, samples, telemetry, code] of broken) {
      const r = evaluateRun(BASE_PROFILE, samples, telemetry);
      expect(r, label).toMatchObject({ verdict: 'INVALID_RUN', exitCode: 2 });
      expect(r.problems.join(), label).toContain(code);
    }
    // Biên: đúng ngưỡng là đạt, thấp hơn 0.01 là vi phạm; minSamples bằng số đo được là hợp lệ, +1 là không.
    const base = evaluateRun(BASE_PROFILE, raw, tele).stats;
    const atP95 = (value: number) => evaluateRun(withSlo(BASE_PROFILE.slo.map((r) => (r.metric === 'p95_ms' ? { ...r, value } : r))), raw, tele).verdict;
    expect([atP95(base.p95_ms!), atP95(base.p95_ms! - 0.01)]).toEqual(['THRESHOLD_CHECK_ONLY', 'THRESHOLD_BREACHED']);
    const need = (n: number) => evaluateRun({ ...BASE_PROFILE, stop: { ...BASE_PROFILE.stop, minSamples: n } }, raw, tele).verdict;
    expect([need(base.measured), need(base.measured + 1)]).toEqual(['THRESHOLD_CHECK_ONLY', 'INVALID_RUN']);
    expect([percentile([7], 95), percentile([1, 2, 3], 100), percentile([], 50)]).toEqual([7, 3, null]);

    // Coordinated omission: generator nghẽn 120 ms giữa chừng → latency phải gồm độ trễ gửi, không chỉ thời gian phục vụ.
    const app = await startPerfApp('none');
    try {
      const pending = runConstantArrival(app.url, BASE_PROFILE);
      await new Promise((r) => setTimeout(r, 1_000));
      const end = Date.now() + 120;
      while (Date.now() < end) {
        // chặn event loop có chủ đích
      }
      const stalled = await pending;
      const lagged = stalled.samples.filter((s) => s.outcome === 'ok' && (s.sentMs ?? 0) - s.scheduledMs >= 50);
      expect(lagged.length, 'the stall delayed some sends').toBeGreaterThan(0);
      for (const s of lagged) expect(s.latencyMs!, `seq ${s.seq}`).toBeGreaterThanOrEqual((s.sentMs ?? 0) - s.scheduledMs);
    } finally {
      await app.close();
    }

    // Raw bị sửa sau khi ghi → evidence không verify, không dùng làm bằng chứng.
    const clone = cloneBundle(control.run, 'tampered');
    const art = control.manifests[0].artifacts.find((a) => a.name === 'perf-samples.ndjson')!;
    fs.appendFileSync(path.join(clone, art.path), '\n{"seq":9999}');
    const tampered = perfRecords({ ...control, run: { ...control.run, runRoot: clone } });
    expect(tampered.problems.join()).toMatch(/SIZE_MISMATCH|HASH_MISMATCH/);
    evidence.attach('nested-runs.json', perfIndex([...runs, few]));
  });

  test('HM-13 - TC-16-P4-3 - AC-16-P4-3: reruns with the same seed and profile are compared; one sample or a busy machine is never a regression', ({ evidence }) => {
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
    expect(busy.records.every((r) => r.result.problems.some((p) => p.startsWith('ENVIRONMENT_BUSY'))), 'busy runs are invalid evidence').toBe(true);

    expect(compareRuns(baseline.records, same.records).verdict).toBe('NO_REGRESSION');
    const reg = compareRuns(baseline.records, slower.records);
    expect(reg.verdict).toBe('REGRESSION_REPRODUCED');
    expect(reg.candidate.values.every((c) => c > Math.max(...reg.baseline.values))).toBe(true);
    expect(compareRuns(baseline.records, busy.records).verdict).toBe('INCONCLUSIVE_BUSY_ENV');

    const one = compareRuns(baseline.records, slower.records.slice(0, 1));
    expect(one.verdict, 'one sample is not a regression').toBe('INSUFFICIENT_SAMPLES');
    const oneEach = compareRuns(baseline.records.slice(0, 1), slower.records.slice(0, 1), { minRepeats: 1 });
    expect(oneEach.verdict, 'minRepeats has a floor').toBe('INSUFFICIENT_SAMPLES');
    expect(compareRuns([], [], { minRepeats: 0 }).verdict).toBe('INSUFFICIENT_SAMPLES');
    const edit = (rs: PerfRunRecord[], patch: (r: PerfRunRecord) => Partial<PerfRunRecord>) => rs.map((r) => ({ ...r, ...patch(r) }));
    // Generator candidate chậm hơn baseline (dưới ngưỡng "bận") → không quy cho app.
    const drift = edit(same.records, (r) => ({ telemetry: { ...r.telemetry, loopLagP99Ms: r.telemetry.loopLagP99Ms + 20 } }));
    expect(compareRuns(baseline.records, drift).problems.join()).toContain('ENVIRONMENT_DRIFT');
    // Cùng p95 nhưng lỗi tăng → không được "NO_REGRESSION".
    const errorsUp = edit(same.records, (r) => ({ result: { ...r.result, stats: { ...r.result.stats, error_rate: 0.5 } } }));
    expect(compareRuns(baseline.records, errorsUp).verdict).toBe('REGRESSION_REPRODUCED');
    const faster = workloadHash({ ...BASE_PROFILE, arrival: { ...BASE_PROFILE.arrival, ratePerSec: 80 } });
    const notComparable: [string, PerfRunRecord[], RegExp][] = [
      ['other seed', edit(slower.records, () => ({ seed: 7 })), /seed differs/],
      ['other workload', edit(slower.records, () => ({ workloadHash: faster })), /workloadHash differs/],
      ['other machine', edit(slower.records, (r) => ({ env: { ...r.env, cpus: 999 } })), /environment differs/],
      ['same attempt twice', [...baseline.records.slice(0, 2), baseline.records[0]], /counted twice/],
    ];
    for (const [label, candidate, pattern] of notComparable) {
      const c = compareRuns(baseline.records, candidate);
      expect(c.verdict, label).toBe('NOT_COMPARABLE');
      expect(c.problems.join(), label).toMatch(pattern);
    }
    expect(compareRuns(baseline.records, same.records, { metric: 'throughput_rps' }).problems.join()).toContain('UNSUPPORTED_METRIC');
    expect(compareRuns(baseline.records, same.records, { relTolerance: -1 }).problems.join()).toContain('INVALID_OPTIONS');
    // Hash workload không phụ thuộc thứ tự key hay alias.
    const { stop, ...rest } = BASE_PROFILE;
    const reordered = JSON.parse(JSON.stringify({ stop, ...rest, target: { route: '/orders', alias: 'other' } })) as PerfProfile;
    expect(workloadHash(reordered)).toBe(workloadHash(BASE_PROFILE));

    // UAT (d): replay chỉ từ receipt (argv + env đã ghi) → cùng kết cục, cùng hash profile; profile bị sửa thì lộ ra.
    const single = runPerf(dir, { fault: 'latency' });
    const replay = replayPerf(dir, single);
    expect(replay.run.exitCode).toBe(single.run.exitCode);
    expect(perfRecords(replay).records[0].result.verdict).toBe('SLO_BREACHED');
    expect(profileDigests(replay)).toEqual(profileDigests(single));
    fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify({ ...BASE_PROFILE, slo: BASE_PROFILE.slo.slice().reverse() }));
    const drifted = replayPerf(dir, single);
    expect(profileDigests(drifted), 'edited profile is detected on replay').not.toEqual(profileDigests(single));
    evidence.attach('nested-runs.json', perfIndex([baseline.v, same.v, slower.v, busy.v, single, replay, drifted]));
  });
});
