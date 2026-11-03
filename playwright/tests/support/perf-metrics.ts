import { approvalProblems, validateProfile, type PerfProfile, type SloMetric } from './perf-profile';

/**
 * Raw metrics → thống kê → verdict (PLAN-16 Phase 4, T4.4). Mọi số liệu tính lại được từ raw
 * samples (giữ nguyên trong evidence). Warm-up bị loại khỏi thống kê; percentile nearest-rank.
 * Exit code: 0 đạt ngưỡng, 1 vượt ngưỡng, 2 run không hợp lệ (thiếu sample, profile lỗi).
 */
export interface PerfSample {
  seq: number;
  scheduledMs: number;
  latencyMs: number | null;
  status: number | null;
  outcome: 'ok' | 'error' | 'dropped';
  warmup: boolean;
}

export interface PerfTelemetry {
  /** Độ trễ event loop của chính load generator: cao → máy tạo tải bận, latency đo được bị nhiễm. */
  loopLagP99Ms: number;
  loopLagMaxMs: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  cpus: number;
  rssMb: number;
}

export type PerfStats = Record<SloMetric, number | null> & {
  samples: number;
  measured: number;
  ok: number;
  errors: number;
  windowSec: number;
};

export type PerfVerdict = 'SLO_MET' | 'SLO_BREACHED' | 'THRESHOLD_CHECK_ONLY' | 'THRESHOLD_BREACHED' | 'INVALID_RUN';

export interface PerfResult {
  schemaVersion: 'perf-result/1';
  verdict: PerfVerdict;
  exitCode: 0 | 1 | 2;
  stats: PerfStats;
  breaches: string[];
  problems: string[];
  limitations: string[];
}

export const BUSY_LOOP_LAG_MS = 50;
export const REPORT_STATEMENT = 'Synthetic reference workload: results are not a production capacity or SLA claim.';

export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

export function computeStats(samples: readonly PerfSample[], profile: PerfProfile): PerfStats {
  const measured = samples.filter((s) => !s.warmup);
  const ok = measured.filter((s) => s.outcome === 'ok');
  const lat = ok.map((s) => s.latencyMs as number);
  const windowSec = Math.max(profile.arrival.durationSec - profile.arrival.warmupSec, 1e-9);
  const done = measured.filter((s) => s.outcome !== 'dropped');
  return {
    samples: samples.length,
    measured: measured.length,
    ok: ok.length,
    errors: measured.filter((s) => s.outcome === 'error').length,
    dropped: measured.filter((s) => s.outcome === 'dropped').length,
    windowSec,
    p50_ms: percentile(lat, 50),
    p95_ms: percentile(lat, 95),
    p99_ms: percentile(lat, 99),
    error_rate: done.length ? (done.length - ok.length) / done.length : null,
    throughput_rps: ok.length / windowSec,
  };
}

export function evaluateRun(profile: PerfProfile, samples: readonly PerfSample[], telemetry: PerfTelemetry): PerfResult {
  const stats = computeStats(samples, profile);
  const problems = validateProfile(profile);
  const limitations = [REPORT_STATEMENT];
  const breaches: string[] = [];
  if (stats.measured < (profile.stop?.minSamples ?? Infinity)) {
    problems.push(`INSUFFICIENT_SAMPLES: ${stats.measured} measured < ${profile.stop?.minSamples}`);
  }
  const invalid = (): PerfResult => ({ schemaVersion: 'perf-result/1', verdict: 'INVALID_RUN', exitCode: 2, stats, breaches, problems, limitations });
  if (problems.length > 0) return invalid();
  for (const rule of profile.slo) {
    const actual = stats[rule.metric];
    const ok = actual !== null && (rule.op === '<=' ? actual <= rule.value : actual >= rule.value);
    if (!ok) breaches.push(`${rule.metric} ${actual === null ? 'unavailable' : +actual.toFixed(3)} violates ${rule.op} ${rule.value} (${rule.source})`);
  }
  if ((stats.error_rate ?? 0) > profile.stop.maxErrorRate) breaches.push(`STOP_CONDITION: error_rate ${stats.error_rate} > ${profile.stop.maxErrorRate}`);
  if (telemetry.loopLagP99Ms > BUSY_LOOP_LAG_MS) {
    limitations.push(`ENVIRONMENT_BUSY: load generator loop lag p99 ${telemetry.loopLagP99Ms}ms > ${BUSY_LOOP_LAG_MS}ms; latencies include client delay`);
  }
  const approval = approvalProblems(profile);
  if (approval.length > 0) limitations.push(...approval.map((a) => `NOT_AN_SLA_CLAIM: ${a}`));
  const approved = approval.length === 0;
  const verdict: PerfVerdict = breaches.length > 0 ? (approved ? 'SLO_BREACHED' : 'THRESHOLD_BREACHED') : approved ? 'SLO_MET' : 'THRESHOLD_CHECK_ONLY';
  return { schemaVersion: 'perf-result/1', verdict, exitCode: breaches.length > 0 ? 1 : 0, stats, breaches, problems, limitations };
}

export function formatPerfReport(profile: PerfProfile, r: PerfResult): string {
  const s = r.stats;
  return [
    REPORT_STATEMENT,
    `Profile ${profile.id} (${profile.kind}) · verdict ${r.verdict} · exit ${r.exitCode}`,
    `Samples ${s.samples} (measured ${s.measured}, ok ${s.ok}, errors ${s.errors}, dropped ${s.dropped}) over ${s.windowSec}s`,
    `p50 ${s.p50_ms} ms · p95 ${s.p95_ms} ms · p99 ${s.p99_ms} ms · error rate ${s.error_rate} · throughput ${s.throughput_rps?.toFixed(2)} rps`,
    ...r.breaches.map((b) => `BREACH ${b}`),
    ...r.problems.map((p) => `PROBLEM ${p}`),
    ...r.limitations.slice(1).map((l) => `LIMIT ${l}`),
  ].join('\n');
}

/** Wrapper cho spec: vượt ngưỡng hoặc run không hợp lệ → fail (runner exit ≠ 0). */
export function expectPerformance(r: PerfResult): void {
  if (r.exitCode !== 0) throw new Error(`PERF_${r.verdict}: ${[...r.breaches, ...r.problems].join('; ')}`);
}
