import { BUSY_LOOP_LAG_MS, percentile, type PerfResult, type PerfTelemetry } from './perf-metrics';
import type { SloMetric } from './perf-profile';

/**
 * So sánh baseline ↔ candidate (PLAN-16 Phase 4, AC-16-P4-3). Chỉ so khi CÙNG workload hash,
 * dataset seed và env; mỗi bên ≥ `minRepeats` lần chạy hợp lệ; máy tạo tải không bận. Regression
 * chỉ "reproduced" khi MỌI lần candidate tệ hơn MỌI lần baseline vượt dung sai — một sample hoặc
 * môi trường bận không bao giờ thành regression.
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

const median = (v: number[]) => percentile(v, 50) ?? NaN;
const envKey = (r: PerfRunRecord) => `${r.env.os}|${r.env.node}|${r.env.cpus}|${r.env.cpuModel}`;

export function compareRuns(baseline: PerfRunRecord[], candidate: PerfRunRecord[], options: CompareOptions = {}) {
  const metric = options.metric ?? 'p95_ms';
  const minRepeats = options.minRepeats ?? 3;
  const rel = options.relTolerance ?? 0.2;
  const abs = options.absTolerance ?? 10;
  const all = [...baseline, ...candidate];
  const problems: string[] = [];
  const limitations = ['Comparison is valid only for the identical workload, dataset seed and environment recorded here'];
  const values = (rs: PerfRunRecord[]) => rs.map((r) => r.result.stats[metric]).filter((v): v is number => v !== null);
  const summary = (rs: PerfRunRecord[]) => {
    const v = values(rs);
    return { repeats: rs.length, values: v, median: v.length ? median(v) : null, max: v.length ? Math.max(...v) : null };
  };
  const out = (verdict: CompareVerdict) => ({ verdict, metric, baseline: summary(baseline), candidate: summary(candidate), problems, limitations });

  // Dung sai tuyệt đối tính bằng ms: chỉ áp cho metric latency (càng thấp càng tốt).
  if (!metric.endsWith('_ms')) problems.push(`UNSUPPORTED_METRIC: ${metric} (latency metrics only)`);
  for (const key of ['workloadHash', 'seed'] as const) {
    if (new Set(all.map((r) => r[key])).size > 1) problems.push(`NOT_COMPARABLE: ${key} differs between runs`);
  }
  if (new Set(all.map(envKey)).size > 1) problems.push('NOT_COMPARABLE: environment differs between runs');
  const ids = all.map((r) => `${r.runId}/${r.attemptId}`);
  if (new Set(ids).size !== ids.length) problems.push('NOT_COMPARABLE: the same attempt is counted twice');
  for (const r of all.filter((x) => x.result.verdict === 'INVALID_RUN')) problems.push(`NOT_COMPARABLE: ${r.attemptId} is an invalid run`);
  if (problems.length > 0) return out('NOT_COMPARABLE');
  if (baseline.length < minRepeats || candidate.length < minRepeats) {
    problems.push(`INSUFFICIENT_SAMPLES: need ${minRepeats} runs per side, got ${baseline.length}/${candidate.length}`);
    return out('INSUFFICIENT_SAMPLES');
  }
  const busy = all.filter((r) => r.telemetry.loopLagP99Ms > BUSY_LOOP_LAG_MS);
  if (busy.length > 0) {
    problems.push(`ENVIRONMENT_BUSY: ${busy.length} run(s) had load generator lag > ${BUSY_LOOP_LAG_MS}ms`);
    return out('INCONCLUSIVE_BUSY_ENV');
  }
  const b = values(baseline);
  const c = values(candidate);
  if (b.length !== baseline.length || c.length !== candidate.length) {
    problems.push(`METRIC_UNAVAILABLE: ${metric} missing in some runs`);
    return out('INCONCLUSIVE');
  }
  const limit = Math.max(...b) * (1 + rel) + abs;
  if (Math.min(...c) > limit) return out('REGRESSION_REPRODUCED');
  if (Math.max(...c) <= limit) return out('NO_REGRESSION');
  problems.push(`OVERLAP: candidate ${metric} range overlaps the baseline tolerance (${limit.toFixed(2)})`);
  return out('INCONCLUSIVE');
}
