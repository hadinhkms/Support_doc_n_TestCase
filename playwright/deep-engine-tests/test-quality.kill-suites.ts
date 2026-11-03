import { integer } from '../tests/support/prop-arbitrary';
import { checkProperty } from '../tests/support/prop-check';
import type * as PerfMetrics from '../tests/support/perf-metrics';
import { workloadHash, type PerfProfile } from '../tests/support/perf-profile';
import { percentileProperty } from './test-quality.properties';
import type * as Reference from './test-quality.reference';

/**
 * Kill suite cho mutation run (PLAN-16 Phase 5, AC-16-P5-2): chạy trên module (gốc hoặc mutant)
 * được truyền vào, throw khi vi phạm. Kỳ vọng lấy từ contract (nearest-rank, perf-result/1 §B3 Phase 4),
 * không chép lại từ cài đặt. Mỗi suite PHẢI pass trên bản gốc (baseline) thì kết quả mutant mới có nghĩa.
 */
function must(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const PROFILE: PerfProfile = {
  schemaVersion: 'perf-profile/1',
  id: 'KILL',
  kind: 'load',
  author: 'qa',
  target: { alias: 'k', route: '/k' },
  arrival: { mode: 'constant-arrival-rate', ratePerSec: 10, durationSec: 2, warmupSec: 0.5, maxInFlight: 5 },
  dataset: { schema: 'k/1', seed: 1 },
  stop: { maxErrorRate: 0.5, minSamples: 10 },
  slo: [
    { metric: 'p95_ms', op: '<=', value: 100, source: 'S1' },
    { metric: 'error_rate', op: '<=', value: 0.2, source: 'S2' },
    { metric: 'dropped', op: '<=', value: 1, source: 'S3' },
  ],
  approval: null,
};
const QUIET = { loopLagP99Ms: 10, loopLagMaxMs: 20, sendLagP95Ms: 5, sendLagMaxMs: 10, cpuUserMs: 1, cpuSystemMs: 1, cpus: 4, rssMb: 50 };

function samples(outcome: (seq: number) => 'ok' | 'error' | 'dropped', latency: (seq: number) => number) {
  return Array.from({ length: 20 }, (_, seq) => ({
    seq,
    scheduledMs: seq * 100,
    sentMs: seq * 100,
    latencyMs: outcome(seq) === 'dropped' ? null : latency(seq),
    status: outcome(seq) === 'ok' ? 200 : null,
    outcome: outcome(seq),
    warmup: seq * 100 < 500,
  }));
}

export function perfMetricsSuite(m: typeof PerfMetrics): void {
  const prop = checkProperty(percentileProperty.name, percentileProperty.arb, percentileProperty.predicate(m.percentile), { seed: 7, numRuns: 150, source: percentileProperty.source });
  must(prop.status === 'PASSED', `percentile property: ${prop.failure?.error}`);
  // computeStats: warm-up 0.5 s = 5 sample loại; còn 15 đo; 2 lỗi + 1 dropped → error_rate 3/15.
  const raw = samples((s) => (s === 7 || s === 9 ? 'error' : s === 11 ? 'dropped' : 'ok'), (s) => 10 + s);
  const st = m.computeStats(raw, PROFILE);
  must(st.measured === 15 && st.ok === 12 && st.errors === 2 && st.dropped === 1, `counts ${JSON.stringify(st)}`);
  must(Math.abs((st.error_rate ?? -1) - 3 / 15) < 1e-12, `error_rate ${st.error_rate}`);
  must(Math.abs((st.throughput_rps ?? -1) - 12 / 1.5) < 1e-12, `throughput ${st.throughput_rps}`);
  // ok latency đã sắp: 15,16,18,20,22..29 (12 giá trị) → p50 hạng 6 = 23; p95/p99 hạng 12 = 29.
  must(st.p50_ms === 23 && st.p95_ms === 29 && st.p99_ms === 29, `percentiles ${st.p50_ms}/${st.p95_ms}/${st.p99_ms}`);
  // sampleProblems: đủ → []; thiếu / trùng / warm-up sai → có vấn đề.
  must(m.sampleProblems(raw, PROFILE).length === 0, 'complete samples flagged');
  must(m.sampleProblems(raw.slice(1), PROFILE).some((p) => p.startsWith('INCOMPLETE_SAMPLES')), 'missing sample not flagged');
  must(m.sampleProblems(raw.map((s) => ({ ...s, seq: s.seq === 3 ? 4 : s.seq })), PROFILE).length > 0, 'duplicate seq not flagged');
  must(m.sampleProblems(raw.map((s) => (s.seq === 6 ? { ...s, warmup: true } : s)), PROFILE).some((p) => p.startsWith('WARMUP')), 'warm-up relabel not flagged');
  must(m.sampleProblems(raw.map((s) => (s.seq === 4 ? { ...s, warmup: false } : s)), PROFILE).some((p) => p.startsWith('WARMUP')), 'warm-up unlabel not flagged');
  // busyProblems: đúng ngưỡng là chưa bận; vượt 1 đơn vị là bận (từng trường).
  must(m.busyProblems({ ...QUIET, ...m.BUSY }).length === 0, 'telemetry at the busy limit flagged');
  for (const k of Object.keys(m.BUSY) as (keyof typeof m.BUSY)[]) {
    must(m.busyProblems({ ...QUIET, [k]: m.BUSY[k] + 1 }).length === 1, `busy ${k} not flagged`);
  }
  // evaluateRun: exit 0 / 1 / 2 theo verdict; profile chưa duyệt không bao giờ ra SLO_*.
  const ok = m.evaluateRun(PROFILE, samples(() => 'ok', () => 10), QUIET);
  must(ok.exitCode === 0 && ok.verdict === 'THRESHOLD_CHECK_ONLY' && ok.breaches.length === 0, `healthy ${ok.verdict} ${ok.breaches}`);
  const slow = m.evaluateRun(PROFILE, samples(() => 'ok', () => 100.5), QUIET);
  must(slow.exitCode === 1 && slow.verdict === 'THRESHOLD_BREACHED' && slow.breaches.some((b) => b.startsWith('p95_ms')), `slow ${slow.verdict}`);
  const edge = m.evaluateRun(PROFILE, samples(() => 'ok', () => 100), QUIET);
  must(edge.exitCode === 0, `p95 exactly at the SLO must pass, got ${edge.breaches}`);
  const busy = m.evaluateRun(PROFILE, samples(() => 'ok', () => 10), { ...QUIET, loopLagP99Ms: 999 });
  must(busy.exitCode === 2 && busy.verdict === 'INVALID_RUN', `busy ${busy.verdict}`);
  const few = m.evaluateRun({ ...PROFILE, stop: { ...PROFILE.stop, minSamples: 16 } }, samples(() => 'ok', () => 10), QUIET);
  must(few.exitCode === 2, `15 measured < 16 must be invalid, got ${few.exitCode}`);
  const enough = m.evaluateRun({ ...PROFILE, stop: { ...PROFILE.stop, minSamples: 15 } }, samples(() => 'ok', () => 10), QUIET);
  must(enough.exitCode === 0, `15 measured == 15 must be valid, got ${enough.problems}`);
  const errors = m.evaluateRun(PROFILE, samples((s) => (s % 2 ? 'error' : 'ok'), () => 10), QUIET);
  // seq lẻ 5..19 lỗi = 8/15 > 0.2 (SLO) và > 0.5 (stop) → cả hai vi phạm.
  must(errors.exitCode === 1 && errors.breaches.some((b) => b.startsWith('error_rate')) && errors.breaches.some((b) => b.startsWith('STOP_CONDITION')), `errors ${errors.breaches}`);
  must(m.formatPerfReport(PROFILE, ok).split('\n')[0] === m.REPORT_STATEMENT, 'report statement missing');
  // Thêm sau mutation run đầu tiên (survivor không tương đương → thiếu kiểm, không phải triage):
  must(m.formatPerfReport(PROFILE, ok).includes('LIMIT NOT_AN_SLA_CLAIM'), 'report drops limitations');
  must(ok.workloadHash === workloadHash(PROFILE), `valid profile hash ${ok.workloadHash}`);
  const oneProblem = m.evaluateRun({ ...PROFILE, target: { alias: 'k', route: 'no-slash' } }, samples(() => 'ok', () => 10), QUIET);
  must(oneProblem.exitCode === 2 && oneProblem.verdict === 'INVALID_RUN' && oneProblem.workloadHash === 'invalid', `one profile problem ${oneProblem.exitCode}`);
  const noArrival = m.evaluateRun({ ...PROFILE, arrival: undefined as never }, samples(() => 'ok', () => 10), QUIET);
  must(noArrival.exitCode === 2, 'a profile without arrival must be INVALID_RUN, not a crash');
  for (const [seq, label] of [[-1, 'negative'], [20, 'equal to expected']] as const) {
    must(m.sampleProblems(raw.map((s) => (s.seq === 19 ? { ...s, seq } : s)), PROFILE).some((p) => p.startsWith('INCOMPLETE')), `seq ${label} not flagged`);
  }
  // Biên `>=` (throughput đúng bằng ngưỡng) và stop condition đúng bằng maxErrorRate đều phải đạt.
  const tput = m.evaluateRun({ ...PROFILE, slo: [...PROFILE.slo, { metric: 'throughput_rps', op: '>=', value: 10, source: 'S4' }] }, samples(() => 'ok', () => 10), QUIET);
  must(tput.exitCode === 0, `throughput exactly at the SLO must pass, got ${tput.breaches}`);
  const atStop = m.evaluateRun({ ...PROFILE, stop: { ...PROFILE.stop, maxErrorRate: 0.2 } }, samples((s) => (s === 6 || s === 8 || s === 10 ? 'error' : 'ok'), () => 10), QUIET);
  must(atStop.exitCode === 0, `error_rate exactly at maxErrorRate must pass, got ${atStop.breaches}`);
  must(threw(() => m.expectPerformance(slow)) && threw(() => m.expectPerformance(busy)) && !threw(() => m.expectPerformance(ok)), 'expectPerformance exit mapping');
}

function threw(fn: () => void): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

export async function referenceSuite(m: typeof Reference): Promise<void> {
  let calls = 0;
  must((await m.waitUntil(() => ++calls >= 3, 10)) === true && calls === 3, `waitUntil stops at the condition (calls ${calls})`);
  calls = 0;
  must((await m.waitUntil(() => (++calls, false), 4)) === false && calls === 4, `waitUntil gives up after maxTicks (calls ${calls})`);
  const clampProp = checkProperty('clamp stays in range', integer(-20, 20), (x) => {
    const r = m.clamp(x, -5, 5);
    return r >= -5 && r <= 5 && (x < -5 || x > 5 || r === x);
  }, { seed: 3, numRuns: 100, source: 'clamp definition' });
  must(clampProp.status === 'PASSED', `clamp: ${JSON.stringify(clampProp.failure)}`);
  must(m.clamp(-5, -5, 5) === -5 && m.clamp(5, -5, 5) === 5, 'clamp bounds are inclusive');
}

export const SUITES = { perfMetricsSuite, referenceSuite } as const;
