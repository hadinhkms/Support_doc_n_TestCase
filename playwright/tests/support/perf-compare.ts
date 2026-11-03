import { percentile, type PerfResult, type PerfTelemetry } from './perf-metrics';
import type { SloMetric } from './perf-profile';

/**
 * So sánh baseline ↔ candidate (PLAN-16 Phase 4, AC-16-P4-3). Chỉ so khi CÙNG workload hash,
 * dataset seed và env; mỗi bên ≥ 3 lần chạy hợp lệ (không hạ được); máy tạo tải không bận và
 * không "trôi" giữa hai bên (độ trễ generator của candidate không cao hơn baseline). Regression chỉ
 * "reproduced" khi MỌI lần candidate tệ hơn MỌI lần baseline vượt dung sai — ở latency hoặc error rate.
 */
export interface PerfRunRecord {
  runId: string;
  attemptId: string;
  workloadHash: string;
  seed: number;
  env: { os: string; node: string; cpus: number; cpuModel: string };
  result: PerfResult;
  telemetry: PerfTelemetry;
}

export type CompareVerdict =
  | 'NOT_COMPARABLE'
  | 'INSUFFICIENT_SAMPLES'
  | 'INCONCLUSIVE_BUSY_ENV'
  | 'INCONCLUSIVE'
  | 'NO_REGRESSION'
  | 'REGRESSION_REPRODUCED';

export interface CompareOptions {
  metric?: SloMetric;
  minRepeats?: number;
  relTolerance?: number;
  absTolerance?: number;
}

/** Sàn/default do dev đặt — chờ owner (PDR-16-P4-03). */
export const COMPARE_FLOOR = { minRepeats: 3, relTolerance: 0.2, absToleranceMs: 5, errorRateDelta: 0.01, generatorDriftMs: 10 } as const;

const median = (v: number[]) => percentile(v, 50);
const envKey = (r: PerfRunRecord) => `${r.env?.os}|${r.env?.node}|${r.env?.cpus}|${r.env?.cpuModel}`;
const maxOf = (rs: PerfRunRecord[], f: (r: PerfRunRecord) => number) => Math.max(...rs.map(f));

export function compareRuns(baseline: PerfRunRecord[], candidate: PerfRunRecord[], options: CompareOptions = {}) {
  const metric = options.metric ?? 'p95_ms';
  const problems: string[] = [];
  const limitations = ['Comparison is valid only for the identical workload, dataset seed and environment recorded here'];
  const minRepeats = Math.max(COMPARE_FLOOR.minRepeats, options.minRepeats ?? 0);
  const rel = options.relTolerance ?? COMPARE_FLOOR.relTolerance;
  const abs = options.absTolerance ?? COMPARE_FLOOR.absToleranceMs;
  if (rel < 0 || abs < 0) problems.push('INVALID_OPTIONS: tolerances must be >= 0');
  if (!metric.endsWith('_ms')) problems.push(`UNSUPPORTED_METRIC: ${metric} (latency metrics only)`);
  const all = [...baseline, ...candidate];
  const values = (rs: PerfRunRecord[]) => rs.map((r) => r.result.stats[metric]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const summary = (rs: PerfRunRecord[]) => {
    const v = values(rs);
    return { repeats: rs.length, values: v, median: median(v), max: v.length ? Math.max(...v) : null };
  };
  const out = (verdict: CompareVerdict) => ({ verdict, metric, baseline: summary(baseline), candidate: summary(candidate), problems, limitations });

  for (const key of ['workloadHash', 'seed'] as const) {
    if (new Set(all.map((r) => r[key])).size > 1) problems.push(`NOT_COMPARABLE: ${key} differs between runs`);
  }
  if (new Set(all.map(envKey)).size > 1) problems.push('NOT_COMPARABLE: environment differs between runs');
  const ids = all.map((r) => `${r.runId}/${r.attemptId}`);
  if (new Set(ids).size !== ids.length) problems.push('NOT_COMPARABLE: the same attempt is counted twice');
  if (problems.length > 0) return out('NOT_COMPARABLE');
  const busy = all.filter((r) => r.result.problems.some((p) => p.startsWith('ENVIRONMENT_BUSY')));
  if (busy.length > 0) {
    problems.push(`ENVIRONMENT_BUSY: ${busy.length} run(s) had a saturated load generator`);
    return out('INCONCLUSIVE_BUSY_ENV');
  }
  for (const r of all.filter((x) => x.result.verdict === 'INVALID_RUN')) problems.push(`NOT_COMPARABLE: ${r.attemptId} is an invalid run`);
  if (problems.length > 0) return out('NOT_COMPARABLE');
  if (baseline.length < minRepeats || candidate.length < minRepeats) {
    problems.push(`INSUFFICIENT_SAMPLES: need ${minRepeats} runs per side, got ${baseline.length}/${candidate.length}`);
    return out('INSUFFICIENT_SAMPLES');
  }
  // Generator của candidate chậm hơn baseline (dù dưới ngưỡng "bận") → latency khác có thể do máy, không phải app.
  const drift = COMPARE_FLOOR.generatorDriftMs;
  const lagUp = maxOf(candidate, (r) => r.telemetry.loopLagP99Ms) - maxOf(baseline, (r) => r.telemetry.loopLagP99Ms);
  const sendUp = maxOf(candidate, (r) => r.telemetry.sendLagP95Ms) - maxOf(baseline, (r) => r.telemetry.sendLagP95Ms);
  if (!(lagUp <= drift && sendUp <= drift)) {
    problems.push(`ENVIRONMENT_DRIFT: candidate generator lag +${lagUp.toFixed(1)}ms / send lag +${sendUp.toFixed(1)}ms vs baseline`);
    return out('INCONCLUSIVE_BUSY_ENV');
  }
  const b = values(baseline);
  const c = values(candidate);
  if (b.length !== baseline.length || c.length !== candidate.length) {
    problems.push(`METRIC_UNAVAILABLE: ${metric} missing in some runs`);
    return out('INCONCLUSIVE');
  }
  const limit = Math.max(...b) * (1 + rel) + abs;
  const errLimit = maxOf(baseline, (r) => r.result.stats.error_rate ?? 1) + COMPARE_FLOOR.errorRateDelta;
  const errs = candidate.map((r) => r.result.stats.error_rate ?? 1);
  if (Math.min(...c) > limit || Math.min(...errs) > errLimit) return out('REGRESSION_REPRODUCED');
  if (Math.max(...c) <= limit && Math.max(...errs) <= errLimit) return out('NO_REGRESSION');
  problems.push(`OVERLAP: candidate ${metric}/error_rate overlaps the baseline tolerance (${limit.toFixed(2)} ms, ${errLimit.toFixed(3)})`);
  return out('INCONCLUSIVE');
}
